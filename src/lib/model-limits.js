/* 模型窗口 / 输出上限 / 思考档位。
 *
 * 做法对齐 OpenCode / Cursor / LiteLLM：按模型 ID 查目录，不靠家族正则猜。
 * 目录来源：models.dev（https://models.dev/api.json），与 AI SDK / OpenCode 同一套数据。
 * 运行时 12h 刷新一次缓存在 chrome.storage.local；离线用打包快照。
 * Gemini / OpenRouter 等厂商接口若能问到，再覆盖该条。
 *
 * 思考深度仍然不是查询字段，是请求参数。目录只告诉你「这个 ID 支不支持 reasoning」。
 * 未收录：工作档位用常用台阶（默认 128k，滑块可到 2M），Effort 默认可选且默认 Off。
 */

import snapshot from './model-catalog-snapshot.json' with { type: 'json' };

export const EFFORT_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'Max' },
];

const CONTEXT_STEPS = [32000, 64000, 128000, 200000, 256000, 500000, 1000000, 2000000];
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_KEY = 'modelCatalogV1';
const MODELS_DEV_API = 'https://models.dev/api.json';

const CANON_PROVIDERS = new Set([
  'openai', 'anthropic', 'google', 'deepseek', 'zhipuai', 'zai', 'moonshotai',
  'xai', 'alibaba', 'alibaba-cn', 'mistral', 'meta', 'cohere', 'minimax',
  'bytedance', 'bytedance-seed', 'groq', 'togetherai', 'fireworks-ai',
  'perplexity', 'amazon-bedrock', 'openrouter', 'siliconflow', 'siliconflow-cn',
  'moonshot', 'dashscope', 'opencode',
]);

let liveIndex = snapshot.keys || {};
let liveMeta = { source: 'snapshot', generatedAt: snapshot.generatedAt || '' };

function installIndex(keys, meta) {
  if (keys && typeof keys === 'object') liveIndex = keys;
  if (meta) liveMeta = meta;
}

function normalize(id) {
  return String(id || '').trim().toLowerCase().replace(/_/g, '-');
}

function bareId(id) {
  const n = normalize(id);
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(i + 1) : n;
}

function dotted(id) {
  return id.replace(/\./g, '-');
}

export function providerHintFromCfg(cfg = {}) {
  const proto = String(cfg.protocol || '').toLowerCase();
  if (proto === 'anthropic') return 'anthropic';
  if (proto === 'gemini') return 'google';
  let host = '';
  try { host = new URL(cfg.baseUrl).hostname; } catch { host = ''; }
  if (/deepseek/.test(host)) return 'deepseek';
  if (/openai\.com/.test(host)) return 'openai';
  if (/anthropic/.test(host)) return 'anthropic';
  if (/googleapis|generativelanguage/.test(host)) return 'google';
  if (/bigmodel|zhipu|(^|\.)z\.ai$/.test(host)) return 'zhipuai';
  if (/dashscope|aliyuncs/.test(host)) return 'alibaba-cn';
  if (/moonshot/.test(host)) return 'moonshotai';
  if (/(^|\.)x\.ai$/.test(host)) return 'xai';
  if (/openrouter/.test(host)) return 'openrouter';
  if (/siliconflow/.test(host)) return 'siliconflow';
  if (/volces|volcengine|\.ark\./.test(host)) return 'bytedance';
  return '';
}

function recToCaps(rec, source, extra = {}) {
  const contextWindow = Number(Array.isArray(rec) ? rec[0] : rec?.c) || 128000;
  const maxOutput = Number(Array.isArray(rec) ? rec[1] : rec?.o) || 16384;
  const hasReasoning = !!(Array.isArray(rec) ? rec[2] : rec?.r);
  return {
    contextWindow,
    maxOutput,
    reasoning: hasReasoning ? 'effort' : 'none',
    source,
    ...extra,
  };
}

function lookupRecord(modelId, hint) {
  const n = normalize(modelId);
  if (!n) return null;
  const b = bareId(n);
  const bDot = dotted(b);
  const candidates = [];
  if (hint) {
    candidates.push(`${hint}/${n}`, `${hint}/${b}`, `${hint}/${bDot}`);
  }
  candidates.push(n, b, dotted(n), bDot);
  for (const k of candidates) {
    if (k && liveIndex[k]) return { rec: liveIndex[k], key: k };
  }

  let best = null;
  for (const k of Object.keys(liveIndex)) {
    const kb = bareId(k);
    const cont = kb === b || kb.startsWith(`${b}.`) || kb.startsWith(`${b}-`);
    if (!cont) continue;
    const hinted = hint && k.startsWith(`${hint}/`);
    const rec = liveIndex[k];
    const ctx = Number(Array.isArray(rec) ? rec[0] : rec?.c) || 0;
    const score = (hinted ? 1e12 : 0) + (1000 - kb.length) + ctx / 1e9;
    if (!best || score > best.score) best = { rec, key: k, score };
  }
  return best;
}

/** 未收录时滑块上限（常用档），不是厂商承诺的物理窗口。 */
export const FALLBACK_CONTEXT_WINDOW = 2000000;
export const FALLBACK_WORKING_CONTEXT = 128000;

function familyFallback(modelId) {
  const m = normalize(modelId);
  if (/deepseek-reasoner|deepseek-r1/.test(m)) {
    return { contextWindow: 128000, maxOutput: 65536, reasoning: 'always', source: 'fallback' };
  }
  return {
    contextWindow: FALLBACK_CONTEXT_WINDOW,
    maxOutput: 16384,
    reasoning: 'effort',
    source: 'fallback',
  };
}

function decorateEffort(caps, modelId, hint) {
  if (caps.reasoning !== 'effort') return caps;
  if (caps.source === 'fallback') {
    caps.defaultEffort = 'off';
    caps.supportedEfforts = EFFORT_LEVELS.map((x) => x.id);
    return caps;
  }
  const m = normalize(modelId);
  if (hint === 'deepseek' || /deepseek-v4/.test(m)) {
    caps.defaultEffort = 'high';
    caps.supportedEfforts = ['off', 'low', 'high', 'xhigh'];
  } else {
    caps.defaultEffort = 'medium';
    caps.supportedEfforts = EFFORT_LEVELS.map((x) => x.id);
  }
  return caps;
}

/** 同步查询。cfg 可带 protocol/baseUrl，用来选同一模型在不同厂商下的条目。 */
export function inferModelCaps(modelId, cfg) {
  const hint = providerHintFromCfg(cfg || {});
  const hit = lookupRecord(modelId, hint);
  if (hit?.rec) {
    return decorateEffort(recToCaps(hit.rec, liveMeta.source || 'catalog'), modelId, hint);
  }
  return decorateEffort(familyFallback(modelId), modelId, hint);
}

export function catalogSourceLabel(source) {
  if (source === 'api') return '厂商接口';
  if (source === 'catalog' || source === 'snapshot' || source === 'cache') return 'models.dev';
  return '未知模型，未收录';
}

/** Cursor：物理窗口很大时，工作上下文默认 200k，1M 要手选。未收录默认 128k。 */
export function defaultWorkingContext(maxWindow, source) {
  if (source === 'fallback') return FALLBACK_WORKING_CONTEXT;
  const max = Number(maxWindow) || 128000;
  if (max >= 200000) return 200000;
  return max;
}

export function formatContextLabel(n) {
  const v = Number(n) || 0;
  if (v >= 1000000 && v % 1000000 === 0) return `${v / 1000000}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

export function contextPresets(maxWindow) {
  const max = Number(maxWindow) || 128000;
  const steps = CONTEXT_STEPS.filter((n) => n <= max + 1000);
  if (max >= 16000 && !steps.some((n) => Math.abs(n - max) < 2000)) steps.push(max);
  return steps;
}

/** 档位 id，或两档之间的连续值 `r0.42`（0=Off … 1=Max）。 */
export function resolveEffortId(effort) {
  const s = String(effort || '').trim();
  if (s.startsWith('r')) {
    const g = Math.max(0, Math.min(1, Number(s.slice(1)) || 0));
    const i = Math.round(g * (EFFORT_LEVELS.length - 1));
    return EFFORT_LEVELS[i].id;
  }
  return s;
}

function lerpEffortMap(effort, map, fallback) {
  const s = String(effort || '').trim();
  if (s.startsWith('r')) {
    const g = Math.max(0, Math.min(1, Number(s.slice(1)) || 0));
    const n = EFFORT_LEVELS.length;
    const p = g * (n - 1);
    const i = Math.min(n - 2, Math.floor(p));
    const f = p - i;
    const a = map[EFFORT_LEVELS[i].id] ?? fallback;
    const b = map[EFFORT_LEVELS[i + 1].id] ?? fallback;
    return Math.round(a + f * (b - a));
  }
  return map[s] ?? fallback;
}

export function effortToOpenAI(effort) {
  const map = { off: 'none', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' };
  return map[resolveEffortId(effort)] || 'medium';
}

export function effortToDeepSeek(effort) {
  const map = { off: 'none', low: 'low', medium: 'high', high: 'high', xhigh: 'max' };
  return map[resolveEffortId(effort)] || 'high';
}

export function effortToThinkingBudget(effort) {
  const map = { off: 0, low: 2048, medium: 8192, high: 16384, xhigh: 32000 };
  return lerpEffortMap(effort, map, 8192);
}

export function effortToGeminiBudget(effort) {
  const map = { off: 0, low: 1024, medium: 4096, high: 8192, xhigh: 24576 };
  return lerpEffortMap(effort, map, 4096);
}

function compactApiJson(data) {
  const byKey = {};
  const put = (k, rec, force) => {
    k = normalize(k);
    if (!k || k.length < 2) return;
    if (!byKey[k] || force) byKey[k] = rec;
  };
  for (const [pid, prov] of Object.entries(data || {})) {
    if (!CANON_PROVIDERS.has(pid)) continue;
    for (const [mid, m] of Object.entries(prov.models || {})) {
      const rec = [Number(m.limit?.context) || 0, Number(m.limit?.output) || 0, m.reasoning ? 1 : 0];
      if (!rec[0] && !rec[1]) continue;
      put(`${pid}/${mid}`, rec, true);
      put(mid, rec, true);
      const bare = String(mid).split('/').pop();
      if (bare && bare !== mid) put(bare, rec, pid !== 'openrouter');
    }
  }
  return byKey;
}

async function readCache() {
  try {
    const bag = await chrome.storage.local.get(CACHE_KEY);
    return bag[CACHE_KEY] || null;
  } catch {
    return null;
  }
}

let lastRefreshAt = 0;
let inFlightRefresh = null;

/** 启动时若本地有刷新过的目录，立刻换上（比打包快照新）。 */
async function hydrateFromCache() {
  const cached = await readCache();
  if (cached?.keys) {
    installIndex(cached.keys, { source: 'cache', generatedAt: cached.generatedAt || '' });
    lastRefreshAt = cached.at || Date.now();
  }
}

hydrateFromCache();

async function fetchAndInstallCatalog() {
  const cached = await readCache();
  if (cached?.at && Date.now() - cached.at < CATALOG_TTL_MS && cached.keys) {
    installIndex(cached.keys, { source: 'cache', generatedAt: cached.generatedAt || '' });
    lastRefreshAt = cached.at;
    return liveMeta;
  }
  try {
    const res = await fetch(MODELS_DEV_API, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const keys = compactApiJson(data);
    const generatedAt = new Date().toISOString().slice(0, 10);
    const at = Date.now();
    installIndex(keys, { source: 'catalog', generatedAt });
    lastRefreshAt = at;
    chrome.storage.local.set({ [CACHE_KEY]: { at, generatedAt, keys } }).catch(() => {});
  } catch {
    if (cached?.keys) {
      installIndex(cached.keys, { source: 'cache', generatedAt: cached.generatedAt || '' });
      lastRefreshAt = cached.at || Date.now();
    }
  }
  return liveMeta;
}

/** 内存里已有快照即可立刻返回；过期时后台拉 models.dev，不挡住 UI。 */
export function refreshModelCatalog({ force = false } = {}) {
  const stale = force || !lastRefreshAt || Date.now() - lastRefreshAt > CATALOG_TTL_MS;
  if (!stale) return Promise.resolve(liveMeta);
  if (!inFlightRefresh) inFlightRefresh = fetchAndInstallCatalog().finally(() => { inFlightRefresh = null; });
  if (!force) return Promise.resolve(liveMeta);
  return inFlightRefresh;
}

/** 只问真能返回窗口数字的接口。兼容端点 GET /v1/models/{id} 大多只有 id，还会空等数秒。 */
export async function probeModelMeta({ protocol, baseUrl, apiKey, model }) {
  const proto = String(protocol || 'openai').toLowerCase();
  const modelId = String(model || '').trim();
  if (!modelId || !apiKey) return null;
  let host = '';
  try { host = new URL(baseUrl).hostname; } catch { host = ''; }
  const canProbe = proto === 'gemini' || host.includes('openrouter.ai');
  if (!canProbe) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    if (proto === 'gemini') {
      const root = String(baseUrl || '').replace(/\/+$/, '').replace(/\/(v1|v1beta)$/i, '') || 'https://generativelanguage.googleapis.com';
      const url = `${root}/v1beta/models/${encodeURIComponent(modelId)}`;
      const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal: ctrl.signal });
      if (!res.ok) return null;
      const data = await res.json();
      const input = Number(data.inputTokenLimit);
      const output = Number(data.outputTokenLimit);
      if (!input && !output) return null;
      return { contextWindow: input || undefined, maxOutput: output || undefined, source: 'api' };
    }
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data.data || []).find((x) => x.id === modelId || x.id?.endsWith('/' + modelId));
    if (!hit) return null;
    return {
      contextWindow: Number(hit.context_length) || undefined,
      maxOutput: Number(hit.top_provider?.max_completion_tokens) || undefined,
      source: 'api',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
