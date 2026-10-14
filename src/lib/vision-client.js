/* Vision-LLM client (pure, no DOM). Usable from both the Service Worker
   (background tabs) and the side panel. All traffic goes through the unified
   providers entry (chatComplete), so any protocol works — including Gemini
   native image input without an OpenAI shim.
   视觉请求一律走当前渠道的主模型，不再外挂单独的 Vision 配置。 */

import { chatComplete, ApiError } from './providers/index.js';
import { getProjectConfig } from './storage.js';
import { estimateTokens } from './token-estimate.js';

async function getCurrentProjectId() {
  const { currentProject } = await chrome.storage.sync.get('currentProject');
  return currentProject || 'default';
}

/** 判定错误是否为"该模型不接受图片输入"类拒绝（400/422 + 报文关键词） */
export function isImageUnsupportedError(err) {
  return err instanceof ApiError
    && (err.status === 400 || err.status === 422)
    && /image|图片|视觉|vision|multimodal|multi-modal|modalit|image_url|content type|unsupported/i.test(err.body || '');
}

/**
 * 当前视觉调用使用的模型：始终是当前渠道主模型。
 * 返回 { baseUrl, apiKey, model, protocol, source:'main' }，未配置时 apiKey 为空。
 */
export async function resolveVisionModel() {
  const projCfg = await getProjectConfig(await getCurrentProjectId());
  const model = projCfg.model || '';
  const apiKey = projCfg.apiKey || '';
  const baseUrl = projCfg.baseUrl || '';
  if (!model || !apiKey) return { baseUrl: '', apiKey: '', model: '', source: '' };
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

/* Send an image + text prompt to the current channel model. Returns { ok, content }
   or { ok:false, error }. No image scaling (caller scales if needed; SW has no
   canvas). 图片以规范内容块传入，协议转换交给各适配器（anthropic→base64 source、
   gemini→inline_data）。On a 400 mentioning max_tokens, auto-retries with
   halved value so any model works without manual tuning. */
export async function visionChat(imageDataUrl, prompt, { maxTokens = 1000, timeoutMs = 30000 } = {}) {
  let cfg;
  try {
    cfg = await resolveVisionModel();
  } catch (err) {
    return { ok: false, error: `读取渠道配置失败: ${err.message}` };
  }
  if (!cfg.apiKey) {
    return { ok: false, error: '当前渠道未配置 API Key，无法做视觉识别。请先在设置里配置接入渠道。' };
  }
  let effective = Math.max(128, Math.min(maxTokens, Number(cfg.maxTokens) > 0 ? Number(cfg.maxTokens) : maxTokens));
  while (effective >= 128) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await chatComplete(cfg, [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ] }], {
        maxTokens: effective,
        temperature: 0.1,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return { ok: true, content: result.content, finishReason: result.finishReason || 'stop' };
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
      if (isImageUnsupportedError(err)) {
        return { ok: false, error: `${cfg.model} 不支持图片输入。请换一个支持视觉的模型。` };
      }
      return { ok: false, error: `Vision API 调用失败${err.status ? ` (${err.status})` : ''}: ${String(err.message || err).slice(0, 200)}` };
    }
  }
  return { ok: false, error: 'Vision API 反复返回 max_tokens 非法错误，请换一个输出上限更高的模型。' };
}

export const OCR_PROMPT = '提取这张网页截图中的所有可见文字内容。按从上到下、从左到右的阅读顺序输出纯文本，保持原文的段落分隔。只输出文字本身，不要添加任何解释、标注、页码或格式说明。表格用 | 分隔列。如果截图中没有文字，只返回一个空行。';

/** 单屏 OCR 输出上限。一屏密文可能超过旧的 4000，仍被截断时由 visionOcrScreen 续提。 */
export const OCR_MAX_TOKENS = 16000;
const OCR_CONTINUE_MAX = 4;

function outputWasCut(content, finishReason, maxTokens) {
  if (finishReason === 'length') return true;
  return estimateTokens(content) >= Math.floor(maxTokens * 0.9);
}

function appendOcrPiece(text, piece) {
  const next = String(piece || '').trim();
  if (!next) return text;
  if (!text) return next;
  const tail = text.slice(-160);
  if (tail && next.startsWith(tail)) return text + next.slice(tail.length);
  return `${text}\n${next}`;
}

/** 提取一屏截图的文字。输出被上限截断时，带着已写出的结尾再要后续，不把后半屏丢掉。 */
export async function visionOcrScreen(imageDataUrl, { timeoutMs = 45000 } = {}) {
  let text = '';
  let prompt = OCR_PROMPT;
  let truncated = false;
  for (let i = 0; i < OCR_CONTINUE_MAX; i++) {
    const vr = await visionChat(imageDataUrl, prompt, { maxTokens: OCR_MAX_TOKENS, timeoutMs });
    if (!vr.ok) {
      if (text) return { ok: true, content: text, truncated: true, error: vr.error };
      return vr;
    }
    text = appendOcrPiece(text, vr.content);
    truncated = outputWasCut(vr.content || '', vr.finishReason, OCR_MAX_TOKENS);
    if (!truncated) return { ok: true, content: text, truncated: false };
    const tail = text.slice(-200);
    prompt = `这张截图的可见文字还没提取完。从下面这段结尾之后继续，按阅读顺序只输出尚未写出的文字，不要重复结尾：\n${tail}`;
  }
  return {
    ok: true,
    content: text ? `${text}\n［此屏后部未取完］` : text,
    truncated: true,
  };
}
