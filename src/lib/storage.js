import { normalizeEntryRecord } from './source-model.js';
import { logActivity } from './activity-log.js';
import {
  SUBAGENT_MAX_PARALLEL, SUBAGENT_MAX_TABS, SUBAGENT_BUDGET_TOKENS, SUBAGENT_BUDGET_MINUTES,
  clampSubagentMaxParallel, clampSubagentMaxTabs, clampSubagentBudgetTokens, clampSubagentBudgetMinutes,
} from './limits.js';

const STORAGE_KEYS = {
  BLACKLIST: 'blacklist',
  API_CONFIG: 'apiConfig',
  ENTRIES: 'entries',
};

const CHANNELS_KEY = 'aiChannels';       // chrome.storage.local：渠道档案列表
const ACTIVE_CHANNEL_KEY = 'activeChannelId';
const CUSTOM_SUBAGENTS_KEY = 'customSubagents'; // 用户自定义子代理（name/description/prompt/tools）
const SUBAGENT_LIMITS_KEY = 'subagentLimits'; // { maxParallel, maxTabs, budgetTokens, budgetMinutes, checkChannelId }

const DEFAULT_API_CONFIG = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-v4-flash',
  // 模型上下文窗口（tokens）。用于推导对话历史自动压缩阈值（chat-executor.js
  // 的 contextCompactBudget）。按所用模型填写：
  // GLM-4.6=200000 / DeepSeek=64000 / GPT-4o=128000 / Gemini 等 1M 窗口=1000000；不填用默认 1M
  contextTokens: 1000000,
  // 旧下拉，只在首次迁移搜索渠道时读取。现行选择见 search-channels.js 的 activeSearchChannelId。
  searchProvider: 'auto',
};

const DEFAULT_BLACKLIST = [];


export async function getBlacklist() {
  const { [STORAGE_KEYS.BLACKLIST]: list } =
    await chrome.storage.sync.get(STORAGE_KEYS.BLACKLIST);
  return list ?? [...DEFAULT_BLACKLIST];
}

export async function setBlacklist(list) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.BLACKLIST]: list });
}

export async function getApiConfig() {
  const { [STORAGE_KEYS.API_CONFIG]: config } =
    await chrome.storage.sync.get(STORAGE_KEYS.API_CONFIG);
  return config ?? { ...DEFAULT_API_CONFIG };
}

export async function setApiConfig(config) {
  await chrome.storage.sync.set({ [STORAGE_KEYS.API_CONFIG]: config });
}

function entryKey(projectId) {
  return `entries_${projectId || 'default'}`;
}

// ---- 写队列 ----
// 所有写操作都是「读全量数组 → 改 → 写回全量」。批量采集（handleFeedItemsCollect
// 并发 3~6）时若并发执行读改写会互相覆盖，静默丢条目。这里按 storage key 串行化，
// 每个写操作排队等前一个完成后才读，保证同一 key 的写不丢失。
const _writeQueues = new Map(); // key -> 链尾 Promise（已吞错）

function _enqueue(key, fn) {
  const prev = _writeQueues.get(key) || Promise.resolve();
  const next = prev.then(() => fn(), () => fn()); // 前一个失败不阻塞后续
  _writeQueues.set(key, next.then(() => undefined, () => undefined)); // 链尾吞错
  return next;
}

export async function getEntries(projectId) {
  const key = entryKey(projectId);
  const { [key]: entries } = await chrome.storage.local.get(key);
  return Array.isArray(entries) ? entries.map(normalizeEntryRecord) : [];
}

function entryLabel(e) {
  const title = (e && (e.aiTitle || e.originalTitle || e.fileName)) || '(无标题)';
  const fmt = e && e.format ? ` [${String(e.format).toUpperCase()}]` : '';
  return `${title}${fmt}`;
}

/** 文库条目变更进统一操作日志（任何来源：网页采集 / 上传 / AI / 用户）。 */
function logEntryActivity(projectId, action, label, entry) {
  logActivity({
    projectId: projectId || 'default',
    actor: 'system',
    cat: 'file',
    action,
    label,
    detail: entryLabel(entry),
    status: 'ok',
  });
}

// 只有这些字段变化才算“内容/身份”变更；采集状态流转（collecting→summarizing→…）不记。
const ENTRY_LOGGED_UPDATE_KEYS = ['aiTitle', 'originalTitle', 'fileName', 'tags', 'format'];

export async function saveEntry(entry, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const entries = await getEntries(projectId);
    entries.unshift(normalizeEntryRecord(entry));
    await chrome.storage.local.set({ [key]: entries });
    logEntryActivity(projectId, 'entry.add', '文库新增', entry);
  });
}

export async function saveEntries(newEntries, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const entries = await getEntries(projectId);
    entries.unshift(...newEntries.map(normalizeEntryRecord));
    await chrome.storage.local.set({ [key]: entries });
    for (const e of newEntries.slice(0, 20)) logEntryActivity(projectId, 'entry.add', '文库新增', e);
  });
}

export async function updateEntry(id, updates, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const entries = await getEntries(projectId);
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    entries[idx] = normalizeEntryRecord({ ...entries[idx], ...updates });
    await chrome.storage.local.set({ [key]: entries });
    if (updates && ENTRY_LOGGED_UPDATE_KEYS.some((k) => k in updates)) {
      logEntryActivity(projectId, 'entry.update', '文库更新', entries[idx]);
    }
    return entries[idx];
  });
}

export async function saveEntryList(entries, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    await chrome.storage.local.set({ [key]: entries.map(normalizeEntryRecord) });
  });
}

export async function deleteEntry(id, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const entries = await getEntries(projectId);
    const removed = entries.find((e) => e.id === id);
    const filtered = entries.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [key]: filtered });
    if (removed) logEntryActivity(projectId, 'entry.delete', '文库删除', removed);
  });
}

export async function clearEntries(projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const count = (await getEntries(projectId)).length;
    await chrome.storage.local.set({ [key]: [] });
    if (count) {
      logActivity({
        projectId: projectId || 'default', actor: 'system', cat: 'file',
        action: 'entry.clear', label: '文库清空', detail: `${count} 条`, status: 'ok',
      });
    }
  });
}

export async function reorderEntries(orderedIds, projectId) {
  const key = entryKey(projectId);
  return _enqueue(key, async () => {
    const all = await getEntries(projectId);
    const map = new Map(all.map((e) => [e.id, e]));
    const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);
    await chrome.storage.local.set({ [key]: reordered });
    return reordered;
  });
}

export async function getEntryByUrl(url, projectId) {
  const entries = await getEntries(projectId);
  return entries.find((e) => e.url === url);
}

function clampContextTokens(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 16000 && n <= 2000000 ? Math.floor(n) : undefined;
}

/** 把存量「单模型渠道」和 {id,name,contextTokens} 条目统一成模型列表。 */
export function normalizeChannelModels(ch) {
  if (!ch || typeof ch !== 'object') return [];
  if (Array.isArray(ch.models) && ch.models.length) {
    return ch.models.map((m, i) => {
      if (typeof m === 'string') {
        const name = m.trim();
        return name ? { id: `m_${i}`, name } : null;
      }
      const name = String(m?.name || m?.model || '').trim();
      if (!name) return null;
      const ctx = clampContextTokens(m?.contextTokens);
      const effort = String(m?.effort || '').trim();
      return {
        id: String(m?.id || `m_${i}`),
        name,
        ...(ctx ? { contextTokens: ctx } : {}),
        ...(effort ? { effort } : {}),
      };
    }).filter(Boolean);
  }
  const name = String(ch.model || '').trim();
  if (!name) return [];
  const ctx = clampContextTokens(ch.contextTokens);
  const effort = String(ch.effort || '').trim();
  return [{ id: 'm_default', name, ...(ctx ? { contextTokens: ctx } : {}), ...(effort ? { effort } : {}) }];
}

/** 当前渠道正在用的那条模型；无列表时回落旧的 ch.model。 */
export function resolveChannelModel(ch) {
  const models = normalizeChannelModels(ch);
  if (!models.length) {
    return {
      id: '',
      name: String(ch?.model || '').trim(),
      contextTokens: clampContextTokens(ch?.contextTokens),
      effort: String(ch?.effort || '').trim(),
    };
  }
  return models.find((m) => m.id === ch.activeModelId)
    || models.find((m) => m.name === ch.model)
    || models[0];
}

function hydrateChannel(ch) {
  if (!ch || typeof ch !== 'object') return ch;
  const models = normalizeChannelModels(ch);
  const active = resolveChannelModel({ ...ch, models });
  return {
    ...ch,
    models,
    activeModelId: active.id || '',
    model: active.name || ch.model || '',
    contextTokens: active.contextTokens || clampContextTokens(ch.contextTokens),
    effort: active.effort || ch.effort || '',
  };
}

export async function getProjectConfig(projectId) {
  // 渠道系统优先（2026-08-27）：激活渠道是 baseUrl/key/model 的唯一事实来源，
  // 切换只改 activeChannelId（及渠道内 activeModelId），所有消费方零改动受益。
  const chans = await getAiChannels();
  if (chans.length > 0) {
    const { [ACTIVE_CHANNEL_KEY]: activeId } = await chrome.storage.local.get(ACTIVE_CHANNEL_KEY);
    const cur = chans.find((c) => c.id === activeId) || chans[0];
    if (cur && (cur.apiKey || cur.baseUrl)) {
      const active = resolveChannelModel(cur);
      const ctxRaw = Number(active.contextTokens ?? cur.contextTokens);
      return {
        model: active.name || cur.model || DEFAULT_API_CONFIG.model,
        baseUrl: cur.baseUrl || DEFAULT_API_CONFIG.baseUrl,
        protocol: cur.protocol || 'openai',
        apiKey: cur.apiKey || '',
        contextTokens: Number.isFinite(ctxRaw) && ctxRaw >= 16000 && ctxRaw <= 2000000
          ? Math.floor(ctxRaw)
          : DEFAULT_API_CONFIG.contextTokens,
        effort: active.effort || cur.effort || '',
        channelId: cur.id,
        channelName: cur.name || cur.id,
      };
    }
  }
  // 渠道未初始化/为空时回落旧逻辑（存量配置兜底）
  const key = `projConfig_${projectId || 'default'}`;
  const { [key]: config } = await chrome.storage.sync.get(key);
  const apiConfig = await getApiConfig();
  const ctxRaw = Number(config?.contextTokens);
  return {
    model: config?.model || DEFAULT_API_CONFIG.model,
    baseUrl: config?.baseUrl || DEFAULT_API_CONFIG.baseUrl,
    // 接口协议（providers/index.js）：'openai' | 'anthropic' | 'gemini'，存量配置回落 openai
    protocol: config?.protocol || 'openai',
    apiKey: apiConfig.apiKey || '',
    // 上下文窗口：项目配置有效值优先，否则默认（异常值一律回落默认，钳制交给 chat-executor）
    contextTokens: Number.isFinite(ctxRaw) && ctxRaw >= 16000 && ctxRaw <= 2000000
      ? Math.floor(ctxRaw)
      : DEFAULT_API_CONFIG.contextTokens,
    effort: config?.effort || '',
  };
}

/* ---- AI 渠道管理（ccswitch 式命名档案 + 单一激活指针）----
 * 数据存 chrome.storage.local（含 API Key，刻意不入 sync：避开 8KB 上限且密钥不跨设备漂移）。
 * 首次使用由 ensureDefaultChannel() 从旧配置合成「默认」渠道，之后旧 projConfig 的
 * model/baseUrl 字段不再参与解析（保留在库里做回滚安全垫）。 */

export async function getAiChannels() {
  const { [CHANNELS_KEY]: list } = await chrome.storage.local.get(CHANNELS_KEY);
  return (Array.isArray(list) ? list : []).map(hydrateChannel);
}

export async function saveAiChannels(list) {
  await chrome.storage.local.set({ [CHANNELS_KEY]: list });
}

export async function getActiveChannelId() {
  const { [ACTIVE_CHANNEL_KEY]: id } = await chrome.storage.local.get(ACTIVE_CHANNEL_KEY);
  return typeof id === 'string' ? id : '';
}

export async function setActiveChannelId(id) {
  await chrome.storage.local.set({ [ACTIVE_CHANNEL_KEY]: id });
}

/** 切到指定渠道下的指定模型；同时更新渠道指针与该渠道的 activeModelId。 */
export async function setActiveChannelModel(channelId, modelId) {
  const list = await getAiChannels();
  const idx = list.findIndex((c) => c.id === channelId);
  if (idx < 0) return;
  const ch = list[idx];
  const models = normalizeChannelModels(ch);
  const picked = models.find((m) => m.id === modelId) || models[0];
  if (!picked) return;
  list[idx] = {
    ...ch,
    models,
    activeModelId: picked.id,
    model: picked.name,
    contextTokens: picked.contextTokens || ch.contextTokens,
    effort: picked.effort || ch.effort || '',
  };
  await saveAiChannels(list);
  await setActiveChannelId(channelId);
}

/** 改当前激活模型的上下文窗口 / 思考档位，不换模型。 */
export async function setActiveModelTuning({ contextTokens, effort } = {}) {
  const list = await getAiChannels();
  const activeId = await getActiveChannelId();
  const idx = list.findIndex((c) => c.id === activeId);
  const i = idx >= 0 ? idx : 0;
  if (!list[i]) return;
  const ch = list[i];
  const models = normalizeChannelModels(ch);
  const active = resolveChannelModel({ ...ch, models });
  const nextModels = models.map((m) => {
    if (m.id !== active.id && m.name !== active.name) return m;
    const next = { ...m };
    if (contextTokens != null) {
      const ctx = clampContextTokens(contextTokens);
      if (ctx) next.contextTokens = ctx;
    }
    if (effort != null) next.effort = String(effort);
    return next;
  });
  const picked = nextModels.find((m) => m.id === active.id) || nextModels[0];
  list[i] = {
    ...ch,
    models: nextModels,
    activeModelId: picked?.id || ch.activeModelId,
    model: picked?.name || ch.model,
    contextTokens: picked?.contextTokens || ch.contextTokens,
    effort: picked?.effort || ch.effort,
  };
  await saveAiChannels(list);
}

/** 渠道未初始化时，用现有生效配置（apiConfig + 默认项目 projConfig）合成首个「默认」渠道。
 * 幂等：已有任何渠道时原样返回。返回最新渠道列表。 */
export async function ensureDefaultChannel() {
  let list = await getAiChannels();
  if (list.length > 0) return list;
  const key = 'projConfig_default';
  const { [key]: legacy } = await chrome.storage.sync.get(key);
  const apiCfg = await getApiConfig();
  const ctxRaw = Number(legacy?.contextTokens);
  const contextTokens = clampContextTokens(ctxRaw) || DEFAULT_API_CONFIG.contextTokens;
  const modelName = legacy?.model || DEFAULT_API_CONFIG.model;
  list = [{
    id: 'default',
    name: '默认',
    protocol: legacy?.protocol || 'openai',
    baseUrl: legacy?.baseUrl || DEFAULT_API_CONFIG.baseUrl,
    apiKey: apiCfg.apiKey || '',
    models: [{ id: 'm_default', name: modelName, contextTokens }],
    activeModelId: 'm_default',
    model: modelName,
    contextTokens,
  }];
  await saveAiChannels(list);
  await setActiveChannelId('default');
  return list;
}

export async function getCustomSubagents() {
  const { [CUSTOM_SUBAGENTS_KEY]: list } = await chrome.storage.local.get(CUSTOM_SUBAGENTS_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveCustomSubagents(list) {
  await chrome.storage.local.set({ [CUSTOM_SUBAGENTS_KEY]: Array.isArray(list) ? list : [] });
}

export function normalizeSubagentLimits(raw) {
  const pick = (k, d) => (raw && raw[k] != null && raw[k] !== '' ? raw[k] : d);
  return {
    maxParallel: clampSubagentMaxParallel(pick('maxParallel', SUBAGENT_MAX_PARALLEL)),
    maxTabs: clampSubagentMaxTabs(pick('maxTabs', SUBAGENT_MAX_TABS)),
    budgetTokens: clampSubagentBudgetTokens(pick('budgetTokens', SUBAGENT_BUDGET_TOKENS)),
    budgetMinutes: clampSubagentBudgetMinutes(pick('budgetMinutes', SUBAGENT_BUDGET_MINUTES)),
    checkChannelId: String((raw && raw.checkChannelId) || ''),
  };
}

/**
 * 用户配置的子代理限额：批次并行、同时打开标签、单个子代理的 token / 耗时预算、
 * Check 审查模型所用渠道（空 = 跟随子代理自己的模型）。未配置时回落 limits.js 默认值。
 */
export async function getSubagentLimits() {
  try {
    const { [SUBAGENT_LIMITS_KEY]: stored } = await chrome.storage.local.get(SUBAGENT_LIMITS_KEY);
    return normalizeSubagentLimits(stored);
  } catch (_) {
    return normalizeSubagentLimits(null);
  }
}

export async function setSubagentLimits(patch = {}) {
  let prev = null;
  try { ({ [SUBAGENT_LIMITS_KEY]: prev } = await chrome.storage.local.get(SUBAGENT_LIMITS_KEY)); } catch (_) { /* ignore */ }
  const defined = Object.fromEntries(Object.entries(patch || {}).filter(([, v]) => v !== undefined));
  const next = normalizeSubagentLimits({ ...(prev || {}), ...defined });
  await chrome.storage.local.set({ [SUBAGENT_LIMITS_KEY]: next });
  return next;
}

export async function setProjectConfig(projectId, config) {
  const key = `projConfig_${projectId || 'default'}`;
  const { [key]: existing } = await chrome.storage.sync.get(key);
  const { promptTemplate, promptTemplateVersion, ...rest } = config;
  const next = { ...existing, ...rest };
  // 旧版设置页曾把摘要提示词写进项目配置；提示词只认 ai-client.js 的常量。
  delete next.promptTemplate;
  delete next.promptTemplateVersion;
  await chrome.storage.sync.set({ [key]: next });
}

export { STORAGE_KEYS, DEFAULT_BLACKLIST, DEFAULT_API_CONFIG };
