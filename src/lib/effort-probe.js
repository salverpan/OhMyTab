/* 思考参数探测。
 *
 * 未收录模型没有目录可查：用户可选 effort，默认 Off 不发字段。
 * 若 400/422 像思考参数导致的：取值非法降一档，字段不认识则整段剥掉。
 * 最多 2 次定向重试，结果按 (host, model) 缓存在 chrome.storage.local.effortProbeCache。
 * 用户再拨档位会清掉该条，允许重新探测。不把「Off 能通」写成模型永不支持思考。
 */

import { resolveEffortId } from './model-limits.js';

const CACHE_KEY = 'effortProbeCache';
const EFFORT_ORDER = ['off', 'low', 'medium', 'high', 'xhigh'];

let live = {};

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return String(url || '').trim(); }
}

export function effortProbeKey(cfg) {
  return `${hostOf(cfg?.baseUrl)}|${String(cfg?.model || '').trim().toLowerCase()}`;
}

function persist() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.set({ [CACHE_KEY]: live }).catch(() => {});
  } catch { /* node / 无权限 */ }
}

async function hydrate() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    const bag = await chrome.storage.local.get(CACHE_KEY);
    if (bag[CACHE_KEY] && typeof bag[CACHE_KEY] === 'object') live = bag[CACHE_KEY];
  } catch { /* ignore */ }
}

hydrate();

function errText(err) {
  return `${err?.message || ''} ${err?.body || ''}`;
}

function isClientParamError(err) {
  const status = Number(err?.status);
  return !!err && (err.name === 'ApiError' || status === 400 || status === 422)
    && (status === 400 || status === 422);
}

/** 协议类报错：思考字段不认识或取值非法。401/429/超窗不要走这里。 */
export function isReasoningParamError(err) {
  if (!isClientParamError(err)) return false;
  return /reasoning_effort|reasoning effort|thinking_budget|thinkingBudget|thinkingConfig|budget_tokens|thinking\.type|"thinking"|'thinking'|unknown.?paramet.+(think|reason)|does not support (thinking|reasoning)|unrecognized.+(thinking|reason)|unexpected.+(thinking|reason)|extra_forbidden.+(thinking|reason)|invalid.+(thinking|reasoning)/i.test(errText(err));
}

export function isEffortValueError(err) {
  if (!isReasoningParamError(err)) return false;
  return /invalid[_\s-]*(reasoning[_\s-]*effort|effort)|unknown value.{0,40}effort|reasoning_effort.{0,40}(invalid|not supported|not one of|unsupported)|xhigh|does not support.{0,24}(xhigh|max)/i.test(errText(err));
}

export function dropEffortOne(id) {
  const i = EFFORT_ORDER.indexOf(resolveEffortId(id));
  if (i <= 0) return 'off';
  return EFFORT_ORDER[i - 1];
}

export function clampEffortToMax(id, maxEffort) {
  const cur = resolveEffortId(id);
  if (!maxEffort) return cur;
  const a = EFFORT_ORDER.indexOf(cur);
  const b = EFFORT_ORDER.indexOf(resolveEffortId(maxEffort));
  if (a < 0) return cur;
  if (b < 0) return cur;
  return EFFORT_ORDER[Math.min(a, b)];
}

export function peekEffortProbe(cfg) {
  return live[effortProbeKey(cfg)] || null;
}

function write(cfg, rec) {
  const k = effortProbeKey(cfg);
  if (!k || k === '|') return;
  live[k] = { ...rec, at: Date.now() };
  persist();
}

export function rememberEffortOutcome(cfg) {
  if (!cfg) return;
  if (cfg.omitReasoning) {
    write(cfg, { omit: true });
    return;
  }
  if (cfg._effortDropped && cfg.effort) {
    write(cfg, { maxEffort: resolveEffortId(cfg.effort) });
  }
}

export function clearEffortProbe(cfg) {
  const k = effortProbeKey(cfg);
  if (!k || !(k in live)) return;
  delete live[k];
  persist();
}

/** 最多 2 次：取值非法先降一档；其余剥字段。已剥过则停。 */
export function planEffortRetry(cfg, err) {
  if (!isReasoningParamError(err)) return null;
  if (cfg?.omitReasoning) return null;
  if (isEffortValueError(err) && !cfg._effortDropped) {
    const cur = resolveEffortId(cfg.effort);
    const next = dropEffortOne(cur);
    if (next && next !== 'off' && next !== cur) {
      return { ...cfg, effort: next, _effortDropped: true };
    }
  }
  return { ...cfg, omitReasoning: true };
}

export function resetEffortProbeForTests() {
  live = {};
}
