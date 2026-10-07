/* Vision-LLM client (pure, no DOM). Usable from both the Service Worker
   (background tabs) and the side panel. All traffic goes through the unified
   providers entry (chatComplete), so any protocol works — including Gemini
   native image input without an OpenAI shim.
   模型选择（resolveVisionModel）按优先级：
     1. 当前渠道主模型 —— 反应式探测缓存 + 内置能力注册表
        （主模型能看图就用它，不再绕外挂）
     2. 显式配置的 visionConfig（主模型不能看图时的兜底）
   探测缓存是事实来源：注册表只覆盖常见家族，未收录模型靠一次真实调用定论。 */

import { chatComplete, ApiError } from './providers/index.js';
import { modelSupportsVision } from './model-capabilities.js';
import { getProjectConfig } from './storage.js';

async function getCurrentProjectId() {
  const { currentProject } = await chrome.storage.sync.get('currentProject');
  return currentProject || 'default';
}

/* ---- 反应式探测缓存（chrome.storage.local.visionProbeCache）---- */

const PROBE_CACHE_VER = 2;

async function readProbeCache() {
  try {
    const got = await chrome.storage.local.get(['visionProbeCache', 'visionProbeCacheVer']);
    if (got.visionProbeCacheVer !== PROBE_CACHE_VER) return {};
    return got.visionProbeCache || {};
  } catch (_) {
    return {};
  }
}

/** 带图请求的真实结局写回缓存：ok='ok'；接口明确拒图='no'。key 用小写模型名。 */
export async function recordVisionProbe(model, verdict) {
  if (!model || (verdict !== 'ok' && verdict !== 'no')) return;
  try {
    const cache = await readProbeCache();
    cache[String(model).toLowerCase()] = verdict;
    await chrome.storage.local.set({ visionProbeCache: cache, visionProbeCacheVer: PROBE_CACHE_VER });
  } catch (_) { /* 缓存失败不影响主流程 */ }
}

/** 判定错误是否为"该模型不接受图片输入"类拒绝（400/422 + 报文关键词） */
export function isImageUnsupportedError(err) {
  return err instanceof ApiError
    && (err.status === 400 || err.status === 422)
    && /image|图片|视觉|vision|multimodal|multi-modal|modalit|image_url|content type|unsupported/i.test(err.body || '');
}

/** 红块探测的自然语言判定。只把明确看见红色标成 ok；「看不到」对小图极常见，不得标 no。 */
export function interpretVisionProbeReply(text) {
  const t = String(text || '').slice(0, 200);
  const noSee = /看不到|无法看|不能看|没有图|看不见|不支持|no image|cannot see|can't see|unable to (see|view)|not support/i.test(t);
  const seesRed = /红|red|#f{1,2}0{2,4}|ff0000|scarlet|crimson/i.test(t);
  if (seesRed && !noSee) return 'ok';
  return '';
}

/**
 * 解析当前应使用的视觉模型。
 * 返回 { baseUrl, apiKey, model, protocol, maxTokens?, source } 或全空对象（不可用）。
 * source: 'main'（当前渠道主模型支持视觉）| 'explicit'（设置页外挂兜底）
 */
export async function resolveVisionModel() {
  const main = await tryMainVision();
  if (main) return main;

  const { visionConfig } = await chrome.storage.local.get('visionConfig');
  if (visionConfig && visionConfig.apiKey) {
    return { ...visionConfig, protocol: visionConfig.protocol || 'openai', source: 'explicit' };
  }
  return { baseUrl: '', apiKey: '', model: '', source: '' };
}

/** 当前渠道主模型若能看图则返回其配置，否则 null */
async function tryMainVision() {
  const projCfg = await getProjectConfig(await getCurrentProjectId());
  const model = projCfg.model || '';
  const apiKey = projCfg.apiKey || '';
  const baseUrl = projCfg.baseUrl || '';
  if (!model || !apiKey) return null;

  const cache = await readProbeCache();
  const probed = cache[String(model).toLowerCase()];
  const supports = probed === 'ok' ? true : (probed === 'no' ? false : modelSupportsVision(model));
  if (!supports) return null;

  return {
    baseUrl,
    apiKey,
    model,
    protocol: projCfg.protocol || 'openai',
    source: 'main',
  };
}

/* 兼容旧调用方（SW visionOcrViaCdp 等）：等价于 resolveVisionModel 的别名 */
export async function getVisionConfig() {
  return resolveVisionModel();
}

/* Send an image + text prompt to the Vision LLM. Returns { ok, content } or
   { ok:false, error }. No image scaling (caller scales if needed; SW has no
   canvas). 图片以规范内容块传入，协议转换交给各适配器（anthropic→base64 source、
   gemini→inline_data）。maxTokens is capped by config.maxTokens (default 1024,
   safe for GLM-4V-Flash). On a 400 mentioning max_tokens, auto-retries with
   halved value so any model works without manual tuning. */
export async function visionChat(imageDataUrl, prompt, { maxTokens = 1000, timeoutMs = 30000 } = {}) {
  let cfg;
  try {
    cfg = await resolveVisionModel();
  } catch (err) {
    return { ok: false, error: `读取 Vision 配置失败: ${err.message}` };
  }
  if (!cfg.apiKey) {
    return { ok: false, error: '当前渠道主模型不支持视觉，且未配置外挂 Vision。请换用带视觉的模型，或在设置页「视觉模型」里填一个兜底模型。' };
  }
  const cfgCap = Number(cfg.maxTokens) > 0 ? Number(cfg.maxTokens) : (cfg.source === 'main' ? maxTokens : 1024);
  let effective = Math.max(128, Math.min(maxTokens, cfgCap));
  while (effective >= 128) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { content } = await chatComplete(cfg, [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ] }], {
        maxTokens: effective,
        temperature: 0.1,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      await recordVisionProbe(cfg.model, 'ok');
      return { ok: true, content };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return { ok: false, error: 'Vision API 请求超时，请检查网络或更换模型。' };
      }
      // 400 提到 max_tokens -> 模型输出上限撞顶，减半重试
      if (err instanceof ApiError && err.status === 400
        && /max_tokens|max_completion_tokens|maximum|上限|limit/i.test(err.body)
        && effective > 128) {
        effective = Math.floor(effective / 2);
        continue;
      }
      // 真实被拒：该模型不吃图，持久标记，resolveVisionModel 下次不再选它
      if (isImageUnsupportedError(err)) {
        await recordVisionProbe(cfg.model, 'no');
        if (cfg.source === 'main') {
          const again = await resolveVisionModel();
          if (again.apiKey && again.source === 'explicit') {
            return visionChat(imageDataUrl, prompt, { maxTokens, timeoutMs });
          }
        }
        return { ok: false, error: `${cfg.model} 不支持图片输入（已记录）。请换用支持视觉的渠道，或在设置页配置外挂 Vision 兜底。` };
      }
      return { ok: false, error: `Vision API 调用失败${err.status ? ` (${err.status})` : ''}: ${String(err.message || err).slice(0, 200)}` };
    }
  }
  return { ok: false, error: 'Vision API 反复返回 max_tokens 非法错误，请到设置页调小 max_tokens 上限。' };
}

/** 设置页「测试连接」：发一张 1x1 PNG 验证连通性与图片接受度 */
export async function testVisionConnection(cfg, { timeoutMs = 15000 } = {}) {
  const ONE_PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { content } = await chatComplete(cfg, [{ role: 'user', content: [
      { type: 'text', text: '回复"OK"' },
      { type: 'image_url', image_url: { url: ONE_PX_PNG } },
    ] }], { maxTokens: Math.min(10, Number(cfg.maxTokens) || 1024), signal: controller.signal });
    return { ok: true, content };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, error: '连接超时' };
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

/** 读探测缓存：'ok' | 'no' | ''（未测或上次含糊，下次还会再试） */
export async function getVisionProbeStatus(model) {
  if (!model) return '';
  const cache = await readProbeCache();
  const v = cache[String(model).toLowerCase()];
  return v === 'ok' || v === 'no' ? v : '';
}

/* 16×16 不透明红 PNG。1×1 太小，视觉模型也常说「看不到」，会被误标成纯文本。
   问颜色而不是「回复 OK」：纯文本模型常会跟着说 OK。答出红才算看见；
   接口 400/422 拒图才标 no；自然语言含糊或说看不到都不写缓存。 */
const PROBE_RED_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=';
const probeInflight = new Map();

/**
 * 后台静默探测主模型是否真能看图。不阻塞发送/切渠道；同模型名去重。
 * 网络失败、超时、含糊回答都不写缓存，下次还有机会。
 */
export function scheduleVisionProbe(cfg, { timeoutMs = 8000 } = {}) {
  const model = String(cfg?.model || '').trim();
  if (!model || !cfg?.apiKey) return Promise.resolve('');
  const key = model.toLowerCase();
  if (probeInflight.has(key)) return probeInflight.get(key);

  const run = async () => {
    const existing = await getVisionProbeStatus(model);
    if (existing) return existing;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { content } = await chatComplete(cfg, [{ role: 'user', content: [
        { type: 'text', text: '图中这个色块是什么颜色？看不到图就回答「看不到」。只回答颜色词或「看不到」，不要解释。' },
        { type: 'image_url', image_url: { url: PROBE_RED_PNG } },
      ] }], { maxTokens: 32, signal: controller.signal });
      const verdict = interpretVisionProbeReply(content);
      if (verdict === 'ok') {
        await recordVisionProbe(model, 'ok');
        return 'ok';
      }
      return '';
    } catch (err) {
      if (err?.name === 'AbortError') return '';
      if (isImageUnsupportedError(err)) {
        await recordVisionProbe(model, 'no');
        return 'no';
      }
      return '';
    } finally {
      clearTimeout(timeout);
    }
  };

  const p = run().finally(() => probeInflight.delete(key));
  probeInflight.set(key, p);
  return p;
}

export const OCR_PROMPT = '提取这张网页截图中的所有可见文字内容。按从上到下、从左到右的阅读顺序输出纯文本，保持原文的段落分隔。只输出文字本身，不要添加任何解释、标注、页码或格式说明。表格用 | 分隔列。如果截图中没有文字，只返回一个空行。';
