import { getProjectConfig, saveEntry, updateEntry, getEntryByUrl, getEntries, deleteEntry, saveEntryList, getSubagentLimits } from '../lib/storage.js';
import { summarizeText, streamChatWithTools } from '../lib/ai-client.js';
import { extractContent, detectBlocked, detectVerificationPage, fetchViaTab } from '../lib/extractor.js';
import { htmlToText } from '../lib/html-utils.js';
import { detectVideoUrl, extractVideoTranscript } from '../lib/video-extractor.js';
import { findBestSimilarityMatch, similaritySeverity } from '../lib/similarity.js';
import { getTopTags, recordTags, mergeTags, replaceTagInEntries, applyTagMergesToTags } from '../lib/tag-library.js';
import {
  listFeeds, listFeedsForProject, updateFeed, deleteFeed as dbDeleteFeed,
  listItems, getItem, toggleStar, setCollectedEntryId, updateItemFullText,
  resetTranslateFailures,
  deleteAllItemsForFeeds, reorderFeeds,
  buildTokenIndexBatch, isIndexBuilt, getIndexBuildStatus, resetTokenIndex,
} from '../lib/feed-db.js';
import { subscribe as subscribeFeed, refreshFeed, refreshFeeds, setDefaultsProvider } from '../lib/feed-fetcher.js';
import { parseOPML } from '../lib/feed-parser.js';
import { runBackfill, getBackfillStatus, stopBackfill, setTranslateProvider } from '../lib/feed-backfill.js';
import { testCloudProvider } from '../lib/translator-cloud.js';
import { buildPageData, buildTabSnapshot, isReadableTab, tabListMeta, formatReaderSessionNote, TAB_SNAPSHOT_BUDGET_MS, TAB_SNAPSHOT_TAB_MS } from '../lib/page-data.js';
import { isDocumentFileUrl, readerUrlForRemote, fileNameFromUrl } from '../lib/doc-kind.js';
import { saveDocFile } from '../lib/doc-store.js';
import { loadImageSource, bytesToDataUrl } from '../lib/place-images.js';
import { sessionPool, initDebuggerDispatch } from '../lib/tab-session.js';
// 浮动聊天与侧栏 AI 平价：共用同一执行器（38 工具含 task/plan）与同一提示词/动态前言
import { processRoundToolCalls, buildEntriesDigest, retrieveMemories, HISTORY_KEEP_TAIL_TOKENS, contextCompactBudget } from '../lib/chat-executor.js';
import { compactHistory, estimateMessagesTokens, estimateTokens } from '../sidepanel/history-compact.js';
import { getStaticSystemPrompt, buildDynamicPreamble } from '../sidepanel/chat-prompt.js';
import { getPlan } from '../lib/plan.js';
import { listNotes } from '../lib/notebook.js';
import { listInsights } from '../lib/insight.js';
import { buildChatTools } from '../lib/tools.js';
import { listAgents, formatAgentCatalog, parseAgentMentions } from '../lib/subagent.js';
import { loadConnectors, formatApiCatalog } from '../lib/api-call.js';
import { AGENT_MAX_ROUNDS, AGENT_WRAP_HINT_ROUND } from '../lib/limits.js';
import { ensureWorkspaceMigration } from '../lib/workspace-migration.js';
// docx 编辑引擎服务（SW 无头跑 OOXML 手术，doc_edit 不再依赖阅读器编辑模式）
import * as docEditService from './doc-edit-service.js';
import {
  HEARTBEAT_ALARM, dueHeartbeatTasks, markHeartbeatQueued, ensureHeartbeatAlarm, queuedOrDueCount,
} from '../lib/heartbeat.js';
import {
  LICENSE_ALARM, LICENSE_DENIED,
  getLicenseView, activateLicense, heartbeatLicense,
  isRuntimeLicensed, ensureLicenseAlarm,
} from '../lib/license.js';

const FEED_REFRESH_ALARM = 'citecat-feed-refresh';
const INDEX_BUILD_ALARM = 'citecat-index-build';
const DEFAULT_REFRESH_MIN = 30;
const FEED_PREFS_KEY = 'feedPrefs';
const RETRY_TAB_KEY = 'retryTabMap';

ensureWorkspaceMigration().catch((err) => {
  console.error('[Citecat] workspace migration failed:', err);
});

/* ---- AI 工具打开的标签页追踪 ----
   manage_tabs(open) 记入 Map（tabId → owner）。
   owner = 子代理 session.id，或父代理 'chat'。
   子代理结束按 owner 关；父代理回合结束关 'chat'；浮动聊天端口断开关全部。
   用户自己点开的页（handleOpenTab 非 aiOpened）不记录。
   写入 chrome.storage.session，避免 MV3 SW 被杀后丢账、侧栏关不掉。 */
const AI_OPENED_TABS_KEY = 'aiOpenedTabs';
const aiOpenedTabs = new Map();

function persistAiTabs() {
  const obj = {};
  for (const [id, owner] of aiOpenedTabs) obj[String(id)] = owner;
  chrome.storage.session.set({ [AI_OPENED_TABS_KEY]: obj }).catch(() => {});
}

async function restoreAiTabs() {
  try {
    const { [AI_OPENED_TABS_KEY]: obj } = await chrome.storage.session.get(AI_OPENED_TABS_KEY);
    if (!obj || typeof obj !== 'object') return;
    for (const [k, owner] of Object.entries(obj)) {
      const id = Number(k);
      if (id > 0) aiOpenedTabs.set(id, owner || 'chat');
    }
  } catch (_) {}
}

const aiTabsReady = restoreAiTabs();

async function trackAiTab(tabId, owner = 'chat') {
  await aiTabsReady;
  if (!tabId) return;
  aiOpenedTabs.set(tabId, owner || 'chat');
  persistAiTabs();
}

async function closeAiTabs(filterOwner, extraIds) {
  await aiTabsReady;
  const ids = new Set();
  for (const raw of extraIds || []) {
    const n = Number(raw);
    if (n > 0) ids.add(n);
  }
  for (const [id, owner] of aiOpenedTabs) {
    if (!filterOwner || owner === filterOwner) ids.add(id);
  }
  for (const id of ids) aiOpenedTabs.delete(id);
  persistAiTabs();
  if (!ids.size) return 0;
  await Promise.all([...ids].map((id) => chrome.tabs.remove(id).catch(() => {})));
  return ids.size;
}

/* ---- Retry-tab map (survives SW restart via chrome.storage.session) ---- */

async function getRetryTabMap() {
  const { [RETRY_TAB_KEY]: map } = await chrome.storage.session.get(RETRY_TAB_KEY);
  return map || {};
}

async function setRetryTab(tabId, entryId) {
  const map = await getRetryTabMap();
  map[String(tabId)] = entryId;
  await chrome.storage.session.set({ [RETRY_TAB_KEY]: map });
}

async function removeRetryTab(tabId) {
  const map = await getRetryTabMap();
  delete map[String(tabId)];
  await chrome.storage.session.set({ [RETRY_TAB_KEY]: map });
}

async function getCurrentProject() {
  const { currentProject } = await chrome.storage.sync.get('currentProject');
  return currentProject || 'default';
}

// Click extension icon - open side panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

/* ---- Feed alarms ---- */

async function getFeedPrefs() {
  const { [FEED_PREFS_KEY]: prefs } = await chrome.storage.local.get(FEED_PREFS_KEY);
  return {
    intervalMin: DEFAULT_REFRESH_MIN,
    defaultMaxItems: 50,
    defaultFetchFrom: null,
    defaultFetchTo: null,
    defaultAutoTranslate: false,
    defaultTargetLanguage: 'zh-Hans',
    rsshubInstance: 'https://rsshub.app',
    translateProvider: 'google',          // 'google' | 'tencent' | 'local'
    tencentSecretId: '',
    tencentSecretKey: '',
    tencentRegion: 'ap-shanghai',
    ...(prefs || {}),
  };
}

// Inject global defaults provider into feed-fetcher
setDefaultsProvider(getFeedPrefs);

async function syncTranslateProvider() {
  const prefs = await getFeedPrefs();
  setTranslateProvider({
    provider: prefs.translateProvider || 'google',
    tencent: {
      secretId: prefs.tencentSecretId || '',
      secretKey: prefs.tencentSecretKey || '',
      region: prefs.tencentRegion || 'ap-shanghai',
    },
  });
}

async function scheduleFeedAlarm() {
  const prefs = await getFeedPrefs();
  await chrome.alarms.clear(FEED_REFRESH_ALARM);
  chrome.alarms.create(FEED_REFRESH_ALARM, {
    periodInMinutes: prefs.intervalMin,
  });
  console.log(`[SW] Feed alarm set: every ${prefs.intervalMin} min`);
}

async function tickHeartbeats() {
  const due = await dueHeartbeatTasks();
  if (!due.length) return;
  const leftover = [];
  for (const t of due) {
    const taken = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'HEARTBEAT_FIRE', task: t }, (r) => {
        if (chrome.runtime.lastError) resolve(false);
        else resolve(!!(r && r.taken));
      });
    });
    if (!taken) leftover.push(t.id);
  }
  if (leftover.length) await markHeartbeatQueued(leftover);
  try {
    const n = await queuedOrDueCount();
    await chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4e75df' });
  } catch (_) {}
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === INDEX_BUILD_ALARM) {
    // 倒排索引分批构建：alarm 触发时连续跑多批（SW 此时活着），
    // 每批后让出事件循环，避免单次占用过长。完成后清 alarm。
    try {
      const start = Date.now();
      for (;;) {
        const done = await buildTokenIndexBatch();
        if (done) {
          await chrome.alarms.clear(INDEX_BUILD_ALARM);
          console.log('[SW] feed token index built');
          break;
        }
        // 每批后让出事件循环（SW 有 30s 限制，保守每批后让出）
        await new Promise((r) => setTimeout(r, 10));
        // 单次 alarm 触发最多跑 ~25s，防止 SW 超时被杀
        if (Date.now() - start > 25000) break;
      }
    } catch (err) {
      console.warn('[SW] token index batch failed:', err);
    }
    return;
  }
  if (alarm.name === LICENSE_ALARM) {
    heartbeatLicense().catch((err) => console.warn('[SW] license heartbeat failed:', err));
    return;
  }
  if (alarm.name === HEARTBEAT_ALARM) {
    if (!(await isRuntimeLicensed())) return;
    tickHeartbeats().catch((err) => console.warn('[SW] heartbeat tick failed:', err));
    return;
  }
  if (alarm.name !== FEED_REFRESH_ALARM) return;
  if (!(await isRuntimeLicensed())) return;
  console.log('[SW] Feed alarm triggered');
  const feeds = await listFeeds();
  if (feeds.length === 0) return;
  await refreshFeeds(feeds.map((f) => f.id));
  const prefs = await getFeedPrefs();
  if (prefs.defaultTargetLanguage) {
    runBackfill(prefs.defaultTargetLanguage).catch(() => {});
  }
});

/* ---- Startup sequence: ensure dependencies are respected ---- */

async function initOnStartup() {
  try {
    // Step 0: 后台 tab 会话池的 CDP 事件分发（onEvent/onDetach 路由）
    initDebuggerDispatch();

    // Step 1: syncTranslateProvider must finish before runBackfill uses it
    await syncTranslateProvider();

    // Step 2: fire-and-forget — timers and periodic checks that don't block
    // 倒排索引不再开机自动重建（2026-08-27 封存）：所有写入路径（订阅刷新/导入/
    // 翻译回填全文/条目合并）都在 upsertItems/updateItemFullText 时增量建索引，
    // 存量迁移早已完成。全量重建只从设置页「重建全文索引」按钮手动触发
    //（FEED_RESET_INDEX 会建 alarm 兜底续跑，alarm 分支保留）。
    const tasks = [
      scheduleFeedAlarm(),
      ensureHeartbeatAlarm().catch(() => {}),
      ensureLicenseAlarm().catch(() => {}),
      heartbeatLicense().catch((err) => console.warn('[SW] license startup failed:', err)),
    ];

    // Step 3: kick off backfill after translate provider is settled
    const prefs = await getFeedPrefs();
    if (prefs.defaultTargetLanguage && await isRuntimeLicensed()) {
      tasks.push(
        runBackfill(prefs.defaultTargetLanguage).catch((err) =>
          console.warn('[SW] initial backfill failed:', err)
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error('[SW] startup error:', err);
  }
}

initOnStartup();

/* ---- 多标签页：快照 / 批量读取 / 后台 CDP 会话操作 ---- */

// 通用并发池（复用 handleFeedItemsCollect 的 inflight/queue 模式）
async function runPool(items, worker, concurrency) {
  const maxConcurrent = Math.max(1, Math.min(concurrency || 4, 6));
  const results = new Array(items.length);
  const queue = items.map((item, idx) => idx);
  const inflight = new Set();
  await new Promise((resolve) => {
    const pump = () => {
      while (inflight.size < maxConcurrent && queue.length > 0) {
        const idx = queue.shift();
        inflight.add(idx);
        worker(items[idx], idx)
          .then((r) => { results[idx] = r; inflight.delete(idx); pump(); })
          .catch((e) => { results[idx] = { error: e.message || String(e) }; inflight.delete(idx); pump(); });
      }
      if (inflight.size === 0 && queue.length === 0) resolve();
    };
    pump();
  });
  return results;
}

// manage_tabs(list) 快照：EXTRACT_SNAPSHOT + 单页超时 + 总预算，避免卡死「Managing tabs…」
async function handleTabSnapshot({ maxTabs = 20 } = {}) {
  const all = await chrome.tabs.query({});
  const candidates = all
    // 排除浏览器内部页与其它扩展页；Citecat 阅读器页（chrome-extension://.../src/reader/index.html）
    // 例外保留——它是可读/可操作的（doc_edit/doc_review 的目标页），曾因整段排除而消失于列表
    .filter(isReadableTab)
    .slice(0, maxTabs || 20);
  const deadline = Date.now() + TAB_SNAPSHOT_BUDGET_MS;
  const tabs = await runPool(candidates, async (t) => {
    if (Date.now() >= deadline) {
      return tabListMeta(t, { reason: '快照超时，仅标题/URL' });
    }
    const remaining = Math.max(200, deadline - Date.now());
    const s = await buildTabSnapshot(t, { timeoutMs: Math.min(TAB_SNAPSHOT_TAB_MS, remaining) });
    return { ...s, active: t.active };
  }, 6);
  return { success: true, tabs };
}

// read_many：批量 buildPageData（每页带 untrusted 标记），并发 4
async function handleTabReadMany({ tabIds, maxChars } = {}) {
  const ids = Array.isArray(tabIds) ? tabIds.map(Number).filter((n) => n > 0).slice(0, 10) : [];
  if (!ids.length) return { success: false, error: '需要 tab_ids 数组' };
  const pages = await runPool(ids, (tabId) => buildPageData(tabId, { format: 'auto', maxChars }), 4);
  return { success: true, pages };
}

// interact_page 的 CDP 类动作走持久会话池（前台/后台同一路径，不再每步 attach/detach）
async function handleTabSessionOperate({ tabId, action, args = {} } = {}) {
  try {
  const session = sessionPool.acquire(Number(tabId));
  const inputStyle = args.input_style || args.inputStyle || 'human';
  const waitMs = Number(args.wait_ms) || (inputStyle === 'fast' ? 80 : 800);
  switch (action) {
    case 'cdp_click':
    case 'click': {
      if (args.ref) {
        const pt = await session.clickRef(args.ref, { inputStyle });
        await new Promise((r) => setTimeout(r, waitMs));
        return { success: true, ...pt };
      }
      let x, y;
      if (args.selector && String(args.selector).includes(',')) {
        const parts = String(args.selector).split(',').map((s) => parseFloat(s.trim()));
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return { success: false, error: 'selector 格式应为 "x,y" 坐标' };
        x = parts[0]; y = parts[1];
        await session.clickAt(x, y, { inputStyle });
      } else {
        const n = parseInt(args.text, 10);
        if (isNaN(n)) return { success: false, error: '需要 ref、text=元素编号 或 selector="x,y"' };
        const coord = await session.clickElement(n, { inputStyle });
        x = coord.x; y = coord.y;
      }
      await new Promise((r) => setTimeout(r, waitMs));
      return { success: true, x, y };
    }
    case 'cdp_type':
    case 'type': {
      if (args.ref) {
        await session.typeRef(args.ref, args.text || '', { inputStyle, pressEnter: !!args.press_enter });
      } else {
        await session.typeText(args.text || '', { inputStyle });
        if (args.press_enter) await session.pressEnter();
      }
      return { success: true };
    }
    case 'page_snapshot': {
      const snap = await session.pageSnapshot({ includeIframes: args.include_iframes !== false });
      return { success: true, yaml: snap.yaml, items: snap.items, refCount: snap.refCount };
    }
    case 'ax_snapshot': {
      const snap = await session.pageSnapshot({ includeIframes: true });
      const items = snap.items.map((it, i) => ({ n: i + 1, ref: it.ref, role: it.role, name: it.name }));
      return { success: true, items, yaml: snap.yaml };
    }
    case 'ax_click': {
      if (args.ref) {
        const coord = await session.clickRef(args.ref, { inputStyle });
        return { success: true, x: coord.x, y: coord.y, ref: args.ref };
      }
      const n = parseInt(args.text, 10);
      if (isNaN(n)) return { success: false, error: 'ax_click 需要 text=元素编号 或 ref' };
      const coord = await session.axClick(n, { inputStyle });
      return { success: true, x: coord.x, y: coord.y };
    }
    case 'capture_network': {
      if (args.dump_only) {
        return { success: true, captures: session.dumpNetwork({ urlFilter: (args.text || '').trim() }) };
      }
      if (args.listen === 'start') {
        await session.startNetworkListen({ urlFilter: (args.text || '').trim() });
        return { success: true, listening: true };
      }
      const captures = await session.captureNetwork({
        urlFilter: (args.text || '').trim(),
        duration: Math.max(3000, Math.min(15000, Number(args.wait_ms) || 7000)),
        inputStyle,
      });
      return { success: true, captures };
    }
    case 'paginate': {
      const result = await session.paginate({ maxPages: args.max_pages || 10, inputStyle });
      return { success: true, ...result };
    }
    case 'screenshot': {
      const dataUrl = await session.screenshot();
      if (!dataUrl) return { success: false, error: '截图失败' };
      return { success: true, dataUrl };
    }
    case 'exec_js': {
      const r = await session.evalJS(args.text || '');
      return { success: true, result: r };
    }
    case 'exec_js_main': {
      const r = await session.evalJSMain(args.text || '');
      return { success: true, result: r };
    }
    case 'scroll': {
      await session.scroll(Number(args.text) || 0, { inputStyle });
      return { success: true };
    }
    case 'scroll_to_bottom':
      await session.scrollToBottom({ inputStyle });
      return { success: true };
    case 'navigate':
      await session.navigate(args.text || args.selector || '');
      return { success: true };
    default:
      return { success: false, error: `未知的后台会话动作: ${action}` };
  }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

// Notify content script on SPA navigation (pushState / replaceState / hash)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url }).catch(() => {});
});

/* 文档阅读器接管：浏览器内置 PDF viewer 是受保护扩展页面（content script
   无法注入）；Office / CSV 直链通常会变成下载，AI 也读不到正文。检测到
   pdf/docx/doc/xlsx/xls/csv URL 时用 Citecat 阅读器打开。15 秒内同 URL 去重。 */
const READER_BASE = chrome.runtime.getURL('src/reader/index.html');
const recentPdfOpens = new Map(); // url -> timestamp
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url || '';
  if (!isDocumentFileUrl(url)) return;
  if (url.startsWith('chrome-extension://')) return; // 阅读器自身
  const now = Date.now();
  if (recentPdfOpens.has(url) && now - recentPdfOpens.get(url) < 15000) return;
  recentPdfOpens.set(url, now);
  chrome.tabs.create({ url: READER_BASE + '?url=' + encodeURIComponent(url), active: true });
});
/* RSS 工具消息的 SW 直调 transport：SW 自发消息不会送达自己的 onMessage，
   所以浮动聊天执行器里 RSS 工具不走消息通道，而是直接调 SW 的 handler。 */
async function swFeedTransport(msg) {
  switch (msg.type) {
    case 'FEED_LIST': return await handleFeedList(msg.data);
    case 'FEED_ITEMS_LIST': return await handleFeedItemsList(msg.data);
    case 'FEED_ITEM_GET': return await handleFeedItemGet(msg.data);
    case 'FEED_ITEM_FETCH_FULL': return await handleFeedItemFetchFull(msg.data);
    case 'FEED_ITEMS_COLLECT': return await handleFeedItemsCollect(msg.data);
    case 'FEED_BUILD_INDEX': return await handleFeedBuildIndex();
    case 'FEED_INDEX_STATUS': return await handleFeedIndexStatus();
    case 'FEED_RESET_INDEX': return await handleFeedResetIndex();
    default: return { success: false, error: `未知 RSS 消息: ${msg.type}` };
  }
}

// 浮动聊天 AI（ann-chat 长连接）：与侧栏完全平价 —— 同一套系统提示词 +
// 动态前言 + 工具循环 + 每端口会话状态。对话历史由 SW 维护并随 done 回传
// content 侧（content 收到后用返回的 messages 覆盖本地历史，保证工具消息不丢）。
// 活跃 ann-chat 端口注册表：entries_* 变化时标记各端口缓存脏位（见下）。
const annChatPorts = new Set();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (Object.keys(changes).some((k) => k.startsWith('entries_'))) {
    annChatPorts.forEach((st) => { st.entriesDirty = true; });
  }
});

// 全局阅读器会话注册表：多个阅读器 tab 并存时各自登记（每 45s 心跳刷新）。
// 侧栏/浮动/阅读器三种聊天都据此定位"文档编辑页"，doc_edit 不依赖发起聊天的页面。
// 曾是单槽变量：多阅读器并存时后报的（常是只读页心跳）覆盖先报的编辑中会话，
// 导致 doc_edit 被路由到不在编辑模式的阅读器、误报"当前不在编辑模式"。
const readerSessions = new Map(); // tabId -> { tabId, docId, kind, title, editMode, ts }

// 候选排序：编辑模式优先，其次最近上报
function sortedReaderSessions() {
  return [...readerSessions.values()].sort((a, b) =>
    (Number(b.editMode) - Number(a.editMode)) || (b.ts - a.ts));
}

// 选最优会话（验证 tab 存活，顺手清理已关 tab 的陈旧条目）
async function pickReaderSession() {
  for (const s of sortedReaderSessions()) {
    const tab = await chrome.tabs.get(s.tabId).catch(() => null);
    if (tab) return s;
    readerSessions.delete(s.tabId);
  }
  return null;
}

function sessionReaderNote() {
  return formatReaderSessionNote(sortedReaderSessions()[0]);
}

// 把 DOC_EDIT / DOC_REVIEW 路由到阅读器会话：按"编辑模式 > 最新"逐个尝试，
// 单个会话不可达（扩展重载前的旧页面）或明确"不在编辑模式/编辑器未初始化"
// （未执行任何操作，安全）时降级尝试下一个。
// kindFilter：只尝试匹配文档类型的会话（xlsx 编辑绝不发给 docx 阅读器——
// 否则 docx 阅读器会回"docx 编辑由后台引擎执行"且该文案不在降级正则里，
// 被当成最终结果返回给模型，掩盖真实执行结果（Bug 1 修复）。
async function routeDocMessage(type, tool, args, kindFilter) {
  const noneErr = type === 'DOC_EDIT'
    ? '找不到可编辑的库内文档：请传 doc_id，或先打开该 docx/xlsx 的阅读器。无需点「编辑」，doc_edit 由后台直接改原件'
    : '找不到可审阅的库内 docx：请传 doc_id，或先打开该文档的阅读器。无需点「编辑」';
  let list = sortedReaderSessions();
  if (kindFilter) list = list.filter(kindFilter);
  if (list.length === 0) return { ok: false, error: noneErr };
  let lastResp = null;
  for (const s of list) {
    const tab = await chrome.tabs.get(s.tabId).catch(() => null);
    if (!tab) { readerSessions.delete(s.tabId); continue; }
    try {
      const resp = await chrome.tabs.sendMessage(s.tabId, { type, tool, args: args || {} });
      if (resp) {
        const err = String(resp.error || '');
        if (resp.ok === false && /不在编辑模式|编辑器未初始化|仅在 docx|审阅修订仅|docx 编辑由后台引擎执行/.test(err)) {
          lastResp = resp; // 该阅读器不在编辑态：没执行任何操作，试下一个
          continue;
        }
        return resp;
      }
      lastResp = { ok: false, error: '阅读器无响应' };
    } catch (err) {
      lastResp = { ok: false, error: '阅读器不可达: ' + (err.message || String(err)) };
      readerSessions.delete(s.tabId); // 陈旧会话（旧实例页面），清掉防再撞
    }
  }
  return lastResp || { ok: false, error: noneErr };
}

/* ---- 图表光栅化代跑（SW 无 DOM，向有 DOM 的页面要一张 PNG） ----
 * 内容脚本与阅读器页都实现了 RASTERIZE_CHART（用 chat-charts.js 的同一份渲染器），
 * 回传 base64 dataURL —— 字节不走 sendMessage（ArrayBuffer 会被 JSON 化成 {}）。
 * chat-charts.js 是 DOM-only 模块，SW 不 import（禁静态导入），所以这里自带解码。 */
function base64ToBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  const bin = atob(comma >= 0 ? String(dataUrl).slice(comma + 1) : '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function rasterizeChartViaPage(tabId, option, opts = {}) {
  if (!option) return { ok: false, error: '缺少 option' };
  let target = tabId;
  if (!target) {
    // 聊天由侧栏发起（无 tab）：退而求其次找任意一个阅读器页
    const sess = sortedReaderSessions()[0];
    target = sess ? sess.tabId : null;
  }
  if (!target) {
    return { ok: false, error: '没有可用的页面来渲染图表（请从页面/阅读器的浮动聊天或侧栏发起）' };
  }
  let resp = null;
  try {
    resp = await chrome.tabs.sendMessage(target, {
      type: 'RASTERIZE_CHART',
      option,
      width: opts.width,
      height: opts.height,
    });
  } catch (err) {
    return { ok: false, error: '目标页面不可达：' + (err.message || String(err)) };
  }
  if (!resp || !resp.ok || !resp.dataUrl) {
    return { ok: false, error: (resp && resp.error) || '页面未返回图片' };
  }
  const bytes = base64ToBytes(resp.dataUrl);
  if (!bytes.length) return { ok: false, error: '页面返回了空图片' };
  return { ok: true, bytes, width: resp.width || opts.width, height: resp.height || opts.height };
}

/* ---- doc_edit / doc_review 统一分发（docx / xlsx 均 SW 无头引擎） ---- */
docEditService.setProjectProvider(getCurrentProject);
docEditService.setDocUpdatedListener((docId) => {
  // docx 内容变化：通知正在看该文档的阅读器页刷新（修订痕迹随之可见）
  for (const s of readerSessions.values()) {
    if (s.docId === docId) {
      chrome.tabs.sendMessage(s.tabId, { type: 'DOC_UPDATED', docId }).catch(() => {});
    }
  }
});

// 目标解析：args.doc_id 显式优先；缺省取最优阅读器会话的文档
function resolveDocTarget(args) {
  const explicit = args && args.doc_id ? String(args.doc_id) : null;
  if (explicit) {
    const sess = [...readerSessions.values()].find((s) => s.docId === explicit);
    return { docId: explicit, kind: sess ? (sess.kind || null) : null };
  }
  const s = sortedReaderSessions()[0];
  if (s && s.docId) return { docId: s.docId, kind: s.kind || null };
  return null;
}

// 文档类型：会话已知直接用；否则查当前项目库条目 format
async function docKindFor(docId, known) {
  const editable = new Set(['xlsx', 'docx', 'doc', 'txt']);
  if (editable.has(known)) return known;
  try {
    const pid = await getCurrentProject();
    const entries = await getEntries(pid);
    const e = entries.find((x) => x.id === docId);
    if (e && e.format) return e.format;
  } catch (_) {}
  return known || null;
}

async function dispatchDocEdit(d) {
  const args = d.args || {};
  const tool = d.tool;
  const target = resolveDocTarget(args);
  if (!target) {
    return { ok: false, error: 'doc_edit 需要目标文档：传 doc_id（库内条目 id），或先打开该文档的阅读器。无需点「编辑」' };
  }
  let kind = await docKindFor(target.docId, target.kind);
  if (kind === 'txt') {
    const r = await docEditService.editTextDoc(target.docId, tool, args);
    return r;
  }
  let convertedNote = '';
  if (kind === 'doc') {
    const promo = await docEditService.promoteDocToDocx(target.docId);
    if (!promo || promo.ok === false) return promo || { ok: false, error: '无法把 .doc 转成可编辑文档' };
    kind = 'docx';
    convertedNote = promo.summary || '';
  }
  if (kind === 'xlsx') {
    if (tool === 'export') {
      try {
        const exp = await docEditService.exportXlsxDoc(target.docId);
        await docEditService.updateXlsxEntryFullText(target.docId);
        let downloaded = false;
        const sess = [...readerSessions.values()].find((s) => s.docId === target.docId);
        if (sess) {
          try {
            const r = await chrome.tabs.sendMessage(sess.tabId, { type: 'DOC_EXPORT_DOWNLOAD', docId: target.docId });
            downloaded = !!(r && r.ok);
          } catch (_) {}
        }
        return { ok: true, summary: downloaded ? '已保存并触发下载（见阅读器页）' : '已保存到库内副本（在文库打开该表格即可查看/下载最新版）', pending: exp.pending };
      } catch (err) {
        return { ok: false, error: '导出失败: ' + (err.message || String(err)) };
      }
    }
    return docEditService.editXlsxDoc(target.docId, tool, args);
  }
  if (kind !== 'docx') {
    return { ok: false, error: 'doc_edit 支持 docx / xlsx / txt，以及 .doc（编辑时会转成 docx）。该文档类型未知或不受支持' };
  }
  if (tool === 'export') {
    // 保存：持久化（逐编辑已写回）+ 更新库条目全文 + 触发阅读器下载；
    // 响应回显"导出文件含 N 条修订"，下载后打开可核对（自证完整性）
    try {
      const exp = await docEditService.exportWordDoc(target.docId);
      await docEditService.updateEntryFullText(target.docId);
      let downloaded = false;
      const sess = [...readerSessions.values()].find((s) => s.docId === target.docId);
      if (sess) {
        try {
          const r = await chrome.tabs.sendMessage(sess.tabId, { type: 'DOC_EXPORT_DOWNLOAD', docId: target.docId });
          downloaded = !!(r && r.ok);
        } catch (_) {}
      }
      const revNote = exp.pending > 0 ? `，导出文件含 ${exp.pending} 条待审修订痕迹（Word 打开可逐条接受/拒绝）` : '';
      const summary = (downloaded ? '已保存并触发下载（见阅读器页）' : '已保存到库内副本（在文库打开该文档即可查看/下载最新版）') + revNote;
      return { ok: true, summary: convertedNote ? `${convertedNote}。${summary}` : summary, pending: exp.pending, converted_from: convertedNote ? 'doc' : undefined };
    } catch (err) {
      return { ok: false, error: '导出失败: ' + (err.message || String(err)) };
    }
  }
  const edited = await docEditService.editWordDoc(target.docId, tool, args);
  if (convertedNote && edited && edited.ok !== false) {
    edited.converted_from = 'doc';
    edited.summary = edited.summary ? `${convertedNote}。${edited.summary}` : convertedNote;
  }
  return edited;
}

async function dispatchDocReview(d) {
  const args = d.args || {};
  const target = resolveDocTarget(args);
  if (!target) {
    return { ok: false, error: 'doc_review 需要目标文档：传 doc_id（库内条目 id），或先打开该文档的阅读器。无需点「编辑」' };
  }
  const kind = await docKindFor(target.docId, target.kind);
  if (kind !== 'docx') {
    return { ok: false, error: '审阅修订仅支持 docx 文档' };
  }
  return docEditService.reviewWordDoc(target.docId, d.tool, args);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ann-chat') return;
  let abortCtrl = null;
  let chatGen = 0;
  const portState = {
    pid: null,
    entries: [],
    entriesDirty: true,  // 条目缓存脏位：浮动聊天每轮消息不再全量重读 entries_*（库大时几 MB，首字延迟大头）
    messages: [],      // 权威对话历史（含 assistant/tool 消息，随 done 回传）
    summary: '',       // 早期对话的压缩摘要（auto_compact 工具写入）
    pendingCollect: null,
    previewId: null,
    selectedIds: new Set(),
    toolUndos: [],
    axSnapshotMap: new Map(),
    pendingSuggestions: null,
    pendingScopeQuiz: null,
    pendingCharts: [],
    pendingImages: [],
    subagentSessions: new Map(),
    runningSubagents: new Set(),
  };
  annChatPorts.add(portState);
  const ctx = {
    get entries() { return portState.entries; },
    set entries(v) { portState.entries = v; },
    get projectId() { return portState.pid; },
    get previewId() { return portState.previewId; },
    set previewId(v) { portState.previewId = v; },
    get pendingCollect() { return portState.pendingCollect; },
    set pendingCollect(v) { portState.pendingCollect = v; },
    get selectedIds() { return portState.selectedIds; },
    set selectedIds(v) { portState.selectedIds = v; },
    get toolUndos() { return portState.toolUndos; },
    set toolUndos(v) { portState.toolUndos = v; },
    get chatHistory() { return portState.messages; },
    set chatHistory(v) { portState.messages = v; },
    get chatHistorySummary() { return portState.summary; },
    set chatHistorySummary(v) { portState.summary = v; },
    get pendingSuggestions() { return portState.pendingSuggestions; },
    set pendingSuggestions(v) { portState.pendingSuggestions = v; },
    get pendingScopeQuiz() { return portState.pendingScopeQuiz; },
    set pendingScopeQuiz(v) { portState.pendingScopeQuiz = v; },
    get pendingCharts() { return portState.pendingCharts; },
    set pendingCharts(v) { portState.pendingCharts = Array.isArray(v) ? v : []; },
    onChart: (chart) => { try { port.postMessage({ type: 'ui', chart }); } catch (_) {} },
    get pendingImages() { return portState.pendingImages; },
    set pendingImages(v) { portState.pendingImages = Array.isArray(v) ? v : []; },
    onImage: (image) => { try { port.postMessage({ type: 'ui', image }); } catch (_) {} },
    onPlan: (plan) => { try { port.postMessage({ type: 'ui', plan }); } catch (_) {} },
    onDocEdit: (card) => { try { port.postMessage({ type: 'ui', docEdit: card }); } catch (_) {} },
    // 图表导出到 docx 要真 DOM：SW 自己没有，向发起聊天的那一页（内容脚本/阅读器）借
    rasterizeChart: (option, opts) => rasterizeChartViaPage(
      port.sender && port.sender.tab ? port.sender.tab.id : null,
      option,
      opts,
    ),
    get axSnapshotMap() { return portState.axSnapshotMap; },
    set axSnapshotMap(v) { portState.axSnapshotMap = v; },
    tabTarget: port.sender && port.sender.tab ? port.sender.tab.id : null, // 固定在发起聊天的那一页
    allowBackground: false,
    get subagentSessions() { return portState.subagentSessions; },
    set subagentSessions(v) { portState.subagentSessions = v; },
    get runningSubagents() { return portState.runningSubagents; },
    set runningSubagents(v) { portState.runningSubagents = v; },
    onSubagentEvent: (card) => { try { port.postMessage({ type: 'subagent', card }); } catch (_) {} },
    onSubagentWriteRefresh: async () => {
      portState.entries = await getEntries(portState.pid);
      portState.entriesDirty = false;
    },
    showToast: (msg) => { try { port.postMessage({ type: 'ui', toast: msg }); } catch (_) {} },
    onEntriesChanged: () => {},
    ui: {
      clearContextState: () => {},
      clearMessages: () => { try { port.postMessage({ type: 'ui', clearHistory: true }); } catch (_) {} },
    },
    closeOwnedAiTabs: (owner, extraIds) => closeAiTabs(owner, extraIds),
    // SW 场景桥：消息通道全部直调自身 handler（自发消息收不到）
    bridge: {
      fetchPage: (url) => handleFetchPage({ url }),
      openTab: (data) => handleOpenTab({ ...(data || {}), aiOpened: true }),
      collectContent: (data) => handleCollectContent(data),
      tabSnapshot: () => handleTabSnapshot({}),
      tabReadMany: (data) => handleTabReadMany(data),
      tabSessionOperate: (data) => handleTabSessionOperate(data),
      feedTransport: swFeedTransport,
      broadcastCollectionStatus: (data) => broadcastCollectionStatus(data).catch(() => {}),
      // 文档编辑：docx / xlsx 均由 SW 引擎直接执行（无需编辑模式/阅读器）
      notifyDocUpdated: (docId) => docEditService.invalidateDoc(docId),
      docEdit: async ({ tool, args }) => dispatchDocEdit({ tool, args }),
      // 审阅修订：docx 修订管理（list/accept/reject），SW 引擎执行
      docReview: async ({ tool, args }) => dispatchDocReview({ tool, args }),
    },
  };

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'ABORT') {
      if (abortCtrl) abortCtrl.abort();
      return;
    }
    if (msg.type !== 'CHAT') return;
    const myGen = ++chatGen;
    const live = () => myGen === chatGen;
    const emit = (payload) => {
      if (!live()) return;
      try { port.postMessage(payload); } catch (_) {}
    };
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const { signal } = abortCtrl;
    if (!(await isRuntimeLicensed())) {
      emit({ type: 'error', error: LICENSE_DENIED.error });
      return;
    }
    if (!live()) return;
    const pid = await getCurrentProject();
    if (!live()) return;
    const apiConfig = await getProjectConfig(pid);
    if (!live()) return;
    if (!apiConfig.apiKey) {
      emit({ type: 'error', error: '未配置 API Key，请先在设置中填写' });
      return;
    }
    if (signal.aborted) {
      emit({ type: 'done', messages: portState.messages, aborted: true });
      return;
    }
    const projectSwitched = portState.pid !== pid;
    portState.pid = pid;
    // 条目缓存：仅首次连接 / 切换项目 / entries_* 有写入（本端口写库工具或他处变更）时
    // 才从 storage 全量重读。库里条目带全文，逐条消息重读是浮动聊天首字延迟的大头。
    if (portState.entriesDirty || projectSwitched) {
      portState.entries = await getEntries(pid);
      portState.entriesDirty = false;
    }
    if (!live()) return;
    portState.pendingSuggestions = null;
    portState.pendingScopeQuiz = null;
    portState.pendingCharts = [];
    portState.pendingImages = [];
    let roundText = '';
    let savedFinal = false;
    let showedQuiz = false;
    let turnDone = false;
    try {
      // ---- 消息组装（与侧栏 buildMessagesForApi 同构）----
      // system（静态前缀）→ 压缩摘要 → 历史 → 动态前言 → 本条用户消息
      const userMessages = Array.isArray(msg.messages) ? msg.messages.filter((m) => m && m.role === 'user') : [];
      const lastUser = userMessages[userMessages.length - 1] || { role: 'user', content: '' };
      const userText = (lastUser.content || '').toString();
      const { maxParallel } = await getSubagentLimits().catch(() => ({ maxParallel: undefined }));
      if (!live()) return;

      // 动态前言（与侧栏 buildDynamicContext 同源；tab 信息用发起聊天的页面）
      const now = new Date();
      const tzOffset = -now.getTimezoneOffset() / 60;
      const tzLabel = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset}`;
      const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${tzLabel}`;
      const senderTab = port.sender && port.sender.tab;
      const currentTabInfo = (senderTab && isReadableTab(senderTab))
        ? `${senderTab.url}\n${(senderTab.title || '').slice(0, 100)}`
        : '';
      const memories = await retrieveMemories(userText, {
        currentUrl: (senderTab && senderTab.url) || '',
      });
      if (!live()) return;
      const agents = await listAgents().catch(() => []);
      const mentionedAgents = parseAgentMentions(userText, agents.map((a) => a.name));
      const selCtx = msg.context || {};
      const selectionBlock = selCtx.system
        ? '\n' + selCtx.system
        : (selCtx.text
          ? `\n### 当前选区（页面划选/元素，本次提问的对象）\n选区类型：${selCtx.kind === 'element' ? '页面元素' : '选中文本'}\n${selCtx.text}${selCtx.extra ? '\n' + selCtx.extra : ''}`
          : '');
      const preamble = buildDynamicPreamble({
        entryDigest: buildEntriesDigest(portState.entries, portState.selectedIds, 40),
        selectedIdList: '',
        selectedPreview: '',
        deltas: userText ? [`用户消息: ${userText.slice(0, 200)}`] : [],
        currentProject: pid,
        dateStr,
        currentTabInfo: currentTabInfo + sessionReaderNote(),
        memories,
        agentCatalog: formatAgentCatalog(agents),
        mentionedAgents,
        notebookNotes: await listNotes(pid),
        insights: await listInsights(pid),
        plan: await getPlan(pid),
        apiCatalog: formatApiCatalog(await loadConnectors()),
      });
      if (!live()) return;
      if (signal.aborted) {
        emit({ type: 'done', messages: portState.messages, aborted: true });
        return;
      }
      // 用户消息在开问之前入史。最终回答（无 tool_calls 的那一轮）也必须入史，
      // 否则下一轮模型看不到自己刚说的话，追问「第二点呢」会失忆。
      // 被更新的一轮顶掉时不要再写，避免旧回答插到新问题后面。
      portState.messages.push(lastUser);
      const callMessages = [
        { role: 'system', content: getStaticSystemPrompt({ maxParallel }) },
      ];
      if (portState.summary) {
        callMessages.push({
          role: 'system',
          content: `## 前情摘要（早期对话已压缩，仅供参考，如有冲突以最新上下文为准）\n${portState.summary}`,
        });
      }
      callMessages.push(...portState.messages.slice(0, -1));
      callMessages.push({ role: 'user', content: preamble + selectionBlock });
      callMessages.push(lastUser);

      ctx.apiConfig = apiConfig;
      ctx.subagentParentSignal = signal;
      ctx.currentTabInfo = currentTabInfo + sessionReaderNote();
      const chatTools = buildChatTools(agents, { maxParallel });

      // ---- 工具循环（与侧栏 sendMessage 同构）----
      for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
        if (!live() || signal.aborted) break;
        roundText = '';
        // 接近工具调用上限：注入收尾提示（与侧栏一致；只进 callMessages 不进 portState 持久历史）
        if (round === AGENT_WRAP_HINT_ROUND) {
          callMessages.push({ role: 'system', content: '已接近工具调用次数上限。请基于已获取的信息尽快给出最终回答，仅在确有必要时再调用一次工具。' });
        }
        const result = await streamChatWithTools(callMessages, chatTools, apiConfig,
          (chunk) => {
            roundText += chunk;
            emit({ type: 'chunk', text: chunk });
          },
          signal);
        if (!live()) return;
        if (signal.aborted) break;
        if (result.toolCalls.length === 0) {
          const finalText = String(result.content || roundText || '').trim();
          roundText = '';
          if (finalText) {
            portState.messages.push({ role: 'assistant', content: finalText });
            savedFinal = true;
          }
          break;
        }

        // 一轮工具调用：骨架在 chat-executor.processRoundToolCalls（与侧栏共用一份实现），
        // 这里只注入浮动窗的端口上报与写库后的缓存重读
        await processRoundToolCalls({
          result,
          apiMessages: callMessages,
          historyMessages: portState.messages,
          ctx,
          signal,
          minAcceptDelayMs: 600, // 与侧栏同节奏：状态行 520ms 内完成淡出，防快速切换残留
          hooks: {
            start: (label, name) => emit({ type: 'tool', status: 'start', label, tool: name }),
            argError: (label) => emit({ type: 'tool', status: 'error', label }),
            done: (label) => emit({ type: 'tool', status: 'done', label }),
            fail: (label) => emit({ type: 'tool', status: 'error', label }),
            // 写库工具：统一兜底重读；重读后缓存已是最新，清脏位避免下轮重复读
            writeRefresh: async () => {
              if (!live()) return;
              portState.entries = await getEntries(pid);
              portState.entriesDirty = false;
            },
          },
        });
        // 工具轮的正文已经记在 assistant.tool_calls 上，不要再当成最终回答存一次
        roundText = '';
        if (!live()) return;
        if (signal.aborted) break;

        // suggest_actions / ask_research_scope：把确认 UI 推给 content 侧渲染
        if (portState.pendingSuggestions) {
          emit({ type: 'ui', suggestions: portState.pendingSuggestions });
          portState.pendingSuggestions = null;
        }
        if (portState.pendingScopeQuiz) {
          emit({ type: 'ui', scopeQuiz: portState.pendingScopeQuiz });
          portState.pendingScopeQuiz = null;
          showedQuiz = true;
          turnDone = true;
          break;
        }
        if (portState.toolUndos.length > 0) {
          emit({ type: 'ui', undo: portState.toolUndos.length });
          portState.toolUndos = [];
        }
        turnDone = true;
      }
      if (!live()) return;
      if (signal.aborted) {
        const partial = roundText.trim();
        if (partial) portState.messages.push({ role: 'assistant', content: partial + '\n\n(已中断)' });
        emit({ type: 'done', messages: portState.messages, aborted: true });
        closeAiTabs('chat').catch(() => {});
        return;
      }
      if (!savedFinal && !showedQuiz) {
        if (turnDone) {
          portState.messages.push({ role: 'assistant', content: '已执行操作。' });
        } else {
          const reason = 'AI 未返回内容，请检查模型配置或稍后重试。';
          portState.messages.push({ role: 'assistant', content: reason });
          emit({ type: 'chunk', text: reason });
        }
      }
      // 让 tool 状态行停留一下再进入回复（与侧栏 600ms 最小停留同感）
      await new Promise((r) => setTimeout(r, 300));
      if (!live()) return;
      emit({ type: 'done', messages: portState.messages });
      closeAiTabs('chat').catch(() => {});

      // 非阻塞后台压缩（与侧栏 scheduleBackgroundCompaction 同策略；阈值按模型窗口推导）
      if (turnDone && estimateMessagesTokens(portState.messages) + estimateTokens(portState.summary) > contextCompactBudget(apiConfig)) {
        compactSwHistory(portState, apiConfig).catch(() => {});
      }
    } catch (err) {
      if (!live()) return;
      if (err.name === 'AbortError' || signal.aborted) {
        const partial = roundText.trim();
        if (partial) portState.messages.push({ role: 'assistant', content: partial + '\n\n(已中断)' });
        emit({ type: 'done', messages: portState.messages, aborted: true });
        closeAiTabs('chat').catch(() => {});
        return;
      }
      const partial = roundText.trim();
      if (partial) portState.messages.push({ role: 'assistant', content: partial });
      emit({ type: 'error', error: err.message, messages: portState.messages });
      closeAiTabs('chat').catch(() => {});
    }
  });
  port.onDisconnect.addListener(() => {
    annChatPorts.delete(portState);
    if (abortCtrl) abortCtrl.abort();
    closeAiTabs().catch(() => {});
  });
});

async function compactSwHistory(portState, apiConfig) {
  const r = await compactHistory({
    history: portState.messages,
    priorSummary: portState.summary,
    apiCfg: apiConfig,
    budgetTokens: 0,
    keepTailTokens: HISTORY_KEEP_TAIL_TOKENS,
  });
  if (r.compacted) {
    portState.messages = r.history;
    portState.summary = r.summary;
  }
}

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  if (message.type === 'GET_LICENSE_STATE') {
    getLicenseView()
      .then((data) => sendResponse({ success: true, ...data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === 'ACTIVATE_LICENSE') {
    activateLicense(message.data && message.data.key)
      .then((data) => sendResponse({ success: !!data.ok, ...data }))
      .catch((err) => sendResponse({ success: false, ok: false, error: err.message || String(err) }));
    return true;
  }

  const dispatch = () => {
  switch (message.type) {
    case 'COLLECT':
      handleCollect(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'RETRY':
      handleRetry(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'OPEN_TAB':
      handleOpenTab(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'CLOSE_AI_TABS':
      closeAiTabs(message.data && message.data.owner, message.data && message.data.tabIds)
        .then((closed) => sendResponse({ success: true, closed }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'CHECK_URL':
      handleCheckUrl(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'DELETE_ENTRY':
      handleDeleteEntry(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FETCH_PAGE':
      handleFetchPage(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'COLLECT_CONTENT':
      handleCollectContent(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'COLLECT_SNIPPET':
      handleCollectSnippet(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'COLLECT_IMAGE':
      handleCollectImage(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'GET_IMAGE_SOURCE':
      handleGetImageSource(message.data).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    // 原网页/阅读器删除标注时联动：删掉关联的 snippet 条目（幂等）
    case 'DELETE_SNIPPET_BY_ANNOTATION':
      handleDeleteSnippetByAnnotation(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    // 主世界读取图表实例数据（ECharts option / Chart.js data）——选区元素数据视图用
    case 'EXTRACT_CHART_DATA': {
      const tabId = sender.tab ? sender.tab.id : null;
      if (tabId == null) { sendResponse({ success: false, error: '无法定位标签页' }); return false; }
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (sel) => {
          try {
            const el = document.querySelector(sel);
            if (!el) return { ok: false, error: '元素不存在' };
            // ECharts：沿祖先找 _echarts_instance_ 容器
            let node = el;
            while (node && node !== document.body) {
              const instId = node.getAttribute && node.getAttribute('_echarts_instance_');
              if (instId && window.echarts && window.echarts.getInstanceByDom) {
                const inst = window.echarts.getInstanceByDom(node);
                if (inst && typeof inst.getOption === 'function') {
                  const opt = inst.getOption();
                  return { ok: true, type: 'echarts', data: JSON.stringify(opt) };
                }
              }
              node = node.parentElement;
            }
            // Chart.js
            if (window.Chart && window.Chart.getChart) {
              const canvases = el.matches && el.matches('canvas') ? [el] : Array.from(el.querySelectorAll('canvas'));
              for (const c of canvases) {
                const inst = window.Chart.getChart(c);
                if (inst && inst.data) {
                  return { ok: true, type: 'chartjs', data: JSON.stringify(inst.data) };
                }
              }
            }
            return { ok: false, error: '未找到可读取的图表实例（站点可能私有打包了图表库）' };
          } catch (e) {
            return { ok: false, error: String(e) };
          }
        },
        args: [String(message.data && message.data.selector || '')],
      }).then((results) => {
        sendResponse({ success: true, result: results && results[0] ? results[0].result : null });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    case 'BROADCAST_COLLECTION_STATUS':
      broadcastCollectionStatus(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_SUBSCRIBE':
      handleFeedSubscribe(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_SUBSCRIBE_BATCH':
      handleFeedSubscribeBatch(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_IMPORT_OPML':
      handleFeedImportOPML(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_LIST':
      handleFeedList(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_BUILD_INDEX':
      handleFeedBuildIndex().then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_INDEX_STATUS':
      handleFeedIndexStatus().then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_RESET_INDEX':
      handleFeedResetIndex().then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_UPDATE':
      handleFeedUpdate(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_DELETE':
      handleFeedDelete(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_DELETE_ALL_ITEMS':
      handleFeedDeleteAllItems(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_REORDER':
      handleFeedReorder(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_REFRESH_ONE':
      handleFeedRefreshOne(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_REFRESH_ALL':
      handleFeedRefreshAll(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_ITEMS_LIST':
      handleFeedItemsList(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_ITEM_GET':
      handleFeedItemGet(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_ITEM_STAR':
      handleFeedItemStar(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_ITEM_FETCH_FULL':
      handleFeedItemFetchFull(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_ITEMS_COLLECT':
      handleFeedItemsCollect(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'FEED_GET_PREFS':
      getFeedPrefs().then((prefs) => sendResponse({ success: true, prefs }));
      return true;
    case 'FEED_SET_PREFS':
      handleFeedSetPrefs(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TRANSLATE_GET_STATUS':
      sendResponse({ success: true, status: getBackfillStatus() });
      return false;
    case 'TRANSLATE_RUN':
      getFeedPrefs().then((prefs) => {
        runBackfill(prefs.defaultTargetLanguage).catch((err) => console.warn('[SW] backfill failed:', err));
        sendResponse({ success: true });
      });
      return true;
    case 'TRANSLATE_STOP':
      stopBackfill();
      sendResponse({ success: true });
      return false;
    case 'TRANSLATE_TEST_PROVIDER':
      handleTestTranslateProvider(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TRANSLATE_RETRY_FAILED':
      (async () => {
        const prefs = await getFeedPrefs();
        const n = await resetTranslateFailures(prefs.defaultTargetLanguage);
        runBackfill(prefs.defaultTargetLanguage).catch(() => {});
        return { success: true, reset: n };
      })().then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TAB_SNAPSHOT':
      handleTabSnapshot(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TAB_READ_MANY':
      handleTabReadMany(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TAB_SESSION_OPERATE':
      handleTabSessionOperate(message.data).then(sendResponse).catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    case 'TAB_SESSION_STATUS':
      sendResponse({ success: true, sessions: sessionPool.status() });
      return false;
    case 'TAB_SESSION_RELEASE':
      sessionPool.release(Number(message.data && message.data.tabId));
      sendResponse({ success: true });
      return false;
    case 'READER_SESSION': {
      // 阅读器页上报会话状态（open / editing / closed），45s 心跳刷新
      const tabId = sender && sender.tab ? sender.tab.id : null;
      const d = message.data || {};
      if (tabId == null) return false;
      if (d.state === 'closed') {
        readerSessions.delete(tabId);
      } else {
        readerSessions.set(tabId, {
          tabId,
          docId: d.docId || null,
          kind: d.docKind || '',
          title: d.docTitle || '',
          editMode: d.state === 'editing',
          ts: Date.now(),
        });
      }
      return false;
    }
    case 'READER_SESSION_GET':
      pickReaderSession().then((s) => sendResponse({ session: s }));
      return true;
    case 'DOC_EDIT': {
      // 侧栏聊天 doc_edit：docx / xlsx 均 SW 无头引擎
      const d = message.data || {};
      dispatchDocEdit(d).then((resp) => sendResponse(resp));
      return true;
    }
    case 'DOC_FILE_CHANGED': {
      const docId = (message.data || {}).docId;
      if (docId) docEditService.invalidateDoc(docId);
      sendResponse({ ok: true });
      return false;
    }
    case 'DOC_REVIEW': {
      // 侧栏聊天 doc_review：docx 修订管理，SW 引擎执行
      const d = message.data || {};
      dispatchDocReview(d).then((resp) => sendResponse(resp));
      return true;
    }
    case 'DOC_EXPORT': {
      // 阅读器保存按钮：SW 导出并写回 + 更新条目全文。
      // 注意：响应**不能**带 ArrayBuffer——chrome.runtime.sendMessage 走 JSON
      // 序列化，ArrayBuffer 会变 {}（曾导致下载文件内容为 "[object Object]" 15 字节）。
      // 阅读器侧从共享的 doc-store IDB 直读最新字节。
      const docId = (message.data || {}).docId;
      if (!docId) { sendResponse({ ok: false, error: '缺少 docId' }); return false; }
      (async () => {
        try {
          await docEditService.exportWordDoc(docId);
          await docEditService.updateEntryFullText(docId);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err.message || String(err) });
        }
      })();
      return true;
    }
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
  };

  isRuntimeLicensed().then((ok) => {
    if (!ok) {
      sendResponse(LICENSE_DENIED);
      return;
    }
    dispatch();
  }).catch((err) => sendResponse({ success: false, error: err.message }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (aiOpenedTabs.delete(tabId)) persistAiTabs();
  readerSessions.delete(tabId);
  const map = await getRetryTabMap();
  const entryId = map[String(tabId)];
  if (entryId) {
    await removeRetryTab(tabId);
    handleRetry({ entryId }).catch(console.error);
  }
});

async function handleCollect({ url, originalTitle, content, publishedAt }) {
  const pid = await getCurrentProject();
  console.log('[SW] 收到采集请求:', url, originalTitle, content ? '(pre-extracted)' : '(need fetch)');

  const existing = await getEntryByUrl(url, pid);
  if (existing) {
    if (existing.status === 'completed') {
      console.log('[SW] URL 已采集过');
      return { success: false, error: '该 URL 已采集过' };
    }
    // retry: reuse existing entry, update fullText if new content provided
    console.log('[SW] 重试已有条目:', existing.id);
    if (content) {
      await updateEntry(existing.id, { fullText: content, originalTitle: originalTitle || existing.originalTitle, candidatePublishedAt: publishedAt || existing.candidatePublishedAt || null }, pid);
      existing.fullText = content;
      existing.originalTitle = originalTitle || existing.originalTitle;
      existing.candidatePublishedAt = publishedAt || existing.candidatePublishedAt || null;
    }
    const result = await processEntry(existing, pid, !!content);
    return result;
  }

  const id = generateId();
  const entry = {
    id,
    url,
    originalTitle: originalTitle || '',
    aiTitle: '',
    aiSummary: '',
    fullText: content || '',
    candidatePublishedAt: publishedAt || null,
    createdAt: Date.now(),
    status: 'collecting',
    errorMessage: '',
  };

  await saveEntry(entry, pid);
  console.log('[SW] 条目已保存:', id);
  const result = await processEntry(entry, pid, !!content);
  return result;
}

async function handleRetry({ entryId }) {
  const pid = await getCurrentProject();
  const entries = await getEntries(pid);
  const entry = entries.find((e) => e.id === entryId);

  if (!entry) {
    return { success: false, error: '条目不存在' };
  }

  const updated = { ...entry, status: 'collecting', errorMessage: '' };
  await updateEntry(entryId, updated, pid);
  const result = await processEntry(updated, pid);
  return result;
}

async function handleCheckUrl({ url }) {
  const pid = await getCurrentProject();
  const entry = await getEntryByUrl(url, pid);
  return { collected: !!(entry && entry.status === 'completed') };
}

async function handleDeleteEntry({ url }) {
  const pid = await getCurrentProject();
  const entry = await getEntryByUrl(url, pid);
  if (entry) {
    await deleteEntry(entry.id, pid);
    await broadcastCollectionStatus({ urls: [url] });
    return { success: true };
  }
  return { success: false, error: '条目不存在' };
}

async function broadcastCollectionStatus(data = {}) {
  const payload = {
    type: 'COLLECTION_STATUS_CHANGED',
    urls: data.urls || [],
    refreshAll: !!data.refreshAll,
  };
  // 通道 1：content script（tabs.sendMessage 只送得到 tab 里的 content script）
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => {
    if (!tab.id) return Promise.resolve();
    return chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
  }));
  // 通道 2：扩展页面（side panel 等）。tabs.sendMessage 送不到 side panel，
  // 此前 panel 只能靠 storage.onChanged（Chromium 在 panel 隐藏/节流时会漏
  // 事件，导致"入库了前端不显示/删了还在，重开才正常"）。runtime 通道一并
  // 送达 content script，其处理函数是幂等的（重读 storage），重复无害。
  try {
    await chrome.runtime.sendMessage(payload);
  } catch (_) {}
  return { success: true };
}

async function handleOpenTab({ url, entryId, retryOnClose = true, pendingAnnotationId = null, aiOpened = false, active = true, owner = 'chat' }) {
  const dest = readerUrlForRemote(url);
  const tab = await chrome.tabs.create({ url: dest, active: active !== false });
  if (aiOpened) await trackAiTab(tab.id, owner);
  if (entryId && retryOnClose) {
    await setRetryTab(tab.id, entryId);
  }
  if (pendingAnnotationId) {
    // 页面加载完成后通知 content script 滚动到对应高亮（双向关联：库 → 网页）
    const scrollOnce = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(scrollOnce);
        chrome.tabs.sendMessage(tab.id, { type: 'SCROLL_TO_ANNOTATION', annotationId: pendingAnnotationId }).catch(() => {});
      }
    };
    chrome.tabs.onUpdated.addListener(scrollOnce);
  }
  return { success: true, tabId: tab.id };
}

async function summarizeWithTags(content, apiConfig, url, candidateDate, pid) {
  const recommendedTags = await getTopTags(pid);
  const result = await summarizeText(content, apiConfig, url, candidateDate, recommendedTags);

  // Execute AI-suggested tag merges
  if (result.tagMerges && result.tagMerges.length > 0) {
    const entries = await getEntries(pid);
    let entriesChanged = false;
    for (const [fromTag, toTag] of result.tagMerges) {
      await mergeTags(pid, fromTag, toTag);
      if (replaceTagInEntries(entries, fromTag, toTag)) {
        entriesChanged = true;
      }
    }
    if (entriesChanged) {
      await saveEntryList(entries, pid);
    }
  }

  result.tags = applyTagMergesToTags(result.tags || [], result.tagMerges || []);
  if (result.tags.length > 0) {
    await recordTags(result.tags, pid);
  }
  return result;
}

async function processEntry(entry, pid = 'default', skipFetch = false) {
  const upd = (updates) => updateEntry(entry.id, updates, pid);
  try {
    await upd({ status: 'collecting' });
    console.log('[SW] 开始采集:', entry.url, skipFetch ? '(skip fetch)' : '');

    const apiConfig = await getProjectConfig(pid);

    // ---- Video URL detection (unchanged) ----
    const videoInfo = detectVideoUrl(entry.url);
    if (videoInfo) {
      console.log('[SW] 检测到视频:', videoInfo.platform, videoInfo.videoId);
      try {
        await upd({ status: 'collecting', errorMessage: '正在提取字幕...' });
        const transcript = await extractVideoTranscript(videoInfo);
        const finalTitle = transcript.title || entry.originalTitle || '无标题';
        await upd({
          originalTitle: finalTitle,
          fullText: transcript.content,
          status: 'summarizing',
          errorMessage: transcript.hasTranscript ? '' : '无字幕',
        });

        const aiResult = await summarizeWithTags(transcript.content, apiConfig, entry.url, entry.candidatePublishedAt || '', pid);
        const cost = calcTokens(aiResult.usage);
        await upd({
          status: 'completed',
          aiTitle: aiResult.aiTitle,
          aiSummary: aiResult.aiSummary,
          source: aiResult.source || '',
          sourceTier: aiResult.sourceTier || 'low',
          sourceTierReason: aiResult.sourceTierReason || '',
          tags: aiResult.tags || [],
          hasTranscript: transcript.hasTranscript,
          usage: aiResult.usage || null,
          cost: cost || null,
          publishedAt: aiResult.publishedAt || entry.candidatePublishedAt || todayStr(),
        });
        await updateSimilarityForEntry(entry.id, pid);
        console.log('[SW] 视频采集完成:', entry.id);
        return { success: true, id: entry.id };
      } catch (err) {
        console.error('[SW] 视频采集失败:', err.message);
        await upd({
          status: 'error',
          errorMessage: `视频采集失败: ${err.message}`,
        });
        return { success: false, error: err.message };
      }
    }

    if (!apiConfig.apiKey) {
      await upd({ status: 'error', errorMessage: '请先在设置页配置 API Key' });
      return { success: false, error: '请先在设置页配置 API Key' };
    }

    // ---- Fast path: content pre-extracted by content script (Readability on live DOM) ----
    if (skipFetch && entry.fullText && entry.fullText.length >= 20) {
      console.log('[SW] 使用预提取内容, 跳过 fetch');
      await upd({
        originalTitle: entry.originalTitle || '无标题',
        fullText: entry.fullText,
        status: 'summarizing',
      });
      try {
        const aiResult = await summarizeWithTags(entry.fullText, apiConfig, entry.url, entry.candidatePublishedAt || '', pid);
        const cost = calcTokens(aiResult.usage);
        await upd({
          status: 'completed',
          aiTitle: aiResult.aiTitle,
          aiSummary: aiResult.aiSummary,
          source: aiResult.source || '',
          sourceTier: aiResult.sourceTier || 'low',
          sourceTierReason: aiResult.sourceTierReason || '',
          tags: aiResult.tags || [],
          usage: aiResult.usage || null,
          cost: cost || null,
          publishedAt: aiResult.publishedAt || entry.candidatePublishedAt || todayStr(),
        });
        await updateSimilarityForEntry(entry.id, pid);
        console.log('[SW] 采集完成 (预提取):', entry.id);
        return { success: true, id: entry.id };
      } catch (err) {
        console.error('[SW] AI 调用失败:', err.message);
        await upd({ status: 'error', errorMessage: `AI 调用失败: ${err.message}` });
        return { success: false, error: `AI 调用失败: ${err.message}` };
      }
    }

    // ---- Normal path: need to fetch content ----
    let title = '';
    let content = '';
    let candidatePublishedAt = entry.candidatePublishedAt || null;

    // Primary: background tab with Readability extraction (via content script messaging)
    console.log('[SW] 尝试后台标签页提取:', entry.url);
      try {
        const tabResult = await fetchViaTab(entry.url);
        title = tabResult.title;
        content = tabResult.content;
        candidatePublishedAt = tabResult.publishedAt || candidatePublishedAt;
        const verification = detectVerificationPage(title, content);
        if (verification.blocked) {
          await upd({ status: 'blocked', errorMessage: verification.reason });
          return { success: false, error: verification.reason, needsVerification: true };
        }
        console.log('[SW] 标签页提取成功, 正文长度:', content.length);
      } catch (tabErr) {
      console.log('[SW] 标签页提取失败, 降级到 fetch:', tabErr.message);
      // Fallback: fetch() + DOMParser + Readability
      try {
        const result = await fetchAndExtract(entry.url);
        if (!result.success) {
          await upd({ status: 'blocked', errorMessage: result.error });
          return { success: false, error: result.error, needsVerification: !!result.needsVerification };
        }
        title = result.title;
        content = result.content;
        candidatePublishedAt = result.publishedAt || candidatePublishedAt;
        console.log('[SW] fetch 提取成功, 正文长度:', content.length);
      } catch (fetchErr) {
        console.error('[SW] fetch 也失败:', fetchErr.message);
        await upd({ status: 'error', errorMessage: `无法访问: ${fetchErr.message}` });
        return { success: false, error: `无法访问: ${fetchErr.message}` };
      }
    }

    if (!content || content.length < 20) {
      console.log('[SW] 正文太短或为空');
      await upd({ status: 'error', errorMessage: '无法提取页面内容' });
      return { success: false, error: '无法提取页面内容' };
    }

    const finalTitle = entry.originalTitle || title || '无标题';
    await upd({
      originalTitle: finalTitle,
      fullText: content,
      candidatePublishedAt,
      status: 'summarizing',
    });

    console.log('[SW] 正在调用 AI...');
    let aiResult;
    try {
      aiResult = await summarizeWithTags(content, apiConfig, entry.url, candidatePublishedAt || '', pid);
    } catch (err) {
      console.error('[SW] AI 调用失败:', err.message);
      await upd({ status: 'error', errorMessage: `AI 调用失败: ${err.message}` });
      return { success: false, error: `AI 调用失败: ${err.message}` };
    }

    console.log('[SW] AI 调用成功:', aiResult.aiTitle);
    const cost = calcTokens(aiResult.usage);
    await upd({
      status: 'completed',
      aiTitle: aiResult.aiTitle,
      aiSummary: aiResult.aiSummary,
      source: aiResult.source || '',
      sourceTier: aiResult.sourceTier || 'low',
      sourceTierReason: aiResult.sourceTierReason || '',
      tags: aiResult.tags || [],
      usage: aiResult.usage || null,
      cost: cost || null,
      publishedAt: aiResult.publishedAt || candidatePublishedAt || todayStr(),
    });
    await updateSimilarityForEntry(entry.id, pid);
    console.log('[SW] 采集完成:', entry.id);
    return { success: true, id: entry.id };
  } catch (err) {
    console.error('[SW] 处理异常:', err);
    await upd({
      status: 'error',
      errorMessage: `处理异常: ${err.message}`,
    });
    return { success: false, error: `处理异常: ${err.message}` };
  }
}

function calcTokens(usage) {
  if (!usage) return null;
  const total = usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  return `${total} tokens`;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/* Shared fetch + extract pipeline used by both processEntry and handleFetchPage. */
async function fetchAndExtract(url) {
  const response = await fetch(url, { credentials: 'include', headers: FETCH_HEADERS });
  const html = await response.text();
  const blockResult = detectBlocked(response, html);
  if (blockResult.blocked) {
    return { success: false, error: blockResult.reason, needsVerification: !!blockResult.needsVerification };
  }
  const extracted = extractContent(html, url);
  const verification = detectVerificationPage(extracted.title, extracted.content);
  if (verification.blocked) {
    return { success: false, error: verification.reason, needsVerification: true };
  }
  return { success: true, title: extracted.title, content: extracted.content, publishedAt: extracted.publishedAt || null };
}

async function fetchDocumentViaReader(url) {
  const readerUrl = READER_BASE + '?url=' + encodeURIComponent(url);
  const tab = await chrome.tabs.create({ url: readerUrl, active: false });
  const tabId = tab && tab.id;
  if (!tabId) return { success: false, error: '无法打开文档阅读器' };
  try {
    const deadline = Date.now() + 25000;
    let last = null;
    let emptyTries = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 450));
      const sess = readerSessions.get(tabId);
      if (sess && sess.kind) {
        last = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' }).catch(() => null);
        if (last && typeof last.content === 'string' && last.content.trim().length >= 1) {
          return {
            success: true,
            title: last.title || fileNameFromUrl(url),
            content: last.content,
            publishedAt: null,
          };
        }
        emptyTries += 1;
        if (emptyTries >= 5) break;
      }
    }
    last = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' }).catch(() => last);
    if (last && typeof last.content === 'string' && last.content.trim()) {
      return { success: true, title: last.title || fileNameFromUrl(url), content: last.content, publishedAt: null };
    }
    return { success: false, error: '无法从该文档提取文本（可能是扫描版、加密或空文件）' };
  } finally {
    await chrome.tabs.remove(tabId).catch(() => {});
  }
}

async function handleFetchPage({ url }) {
  console.log('[SW] FETCH_PAGE:', url);
  if (isDocumentFileUrl(url)) {
    try {
      return await fetchDocumentViaReader(url);
    } catch (err) {
      return { success: false, error: err.message || String(err) };
    }
  }

  // Primary: background tab with Readability (bypasses login walls, JS rendering)
  try {
    const tabResult = await fetchViaTab(url);
    if (tabResult.content && tabResult.content.length >= 20) {
      const verification = detectVerificationPage(tabResult.title, tabResult.content);
      if (verification.blocked) {
        return { success: false, error: verification.reason, needsVerification: true };
      }
      return { success: true, title: tabResult.title, content: tabResult.content, publishedAt: tabResult.publishedAt || null };
    }
  } catch (_) { /* fall through */ }

  // Fallback: fetch() + DOMParser + Readability
  try {
    const result = await fetchAndExtract(url);
    if (!result.success) return result;
    if (result.content && result.content.length >= 20) return result;
    return { success: false, error: '无法提取页面内容' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleCollectContent({ url, title, content, publishedAt }) {
  const pid = (await chrome.storage.sync.get('currentProject')).currentProject || 'default';
  const id = generateId();
  const entry = {
    id, url, originalTitle: title || '无标题',
    fullText: content, aiTitle: '', aiSummary: '',
    candidatePublishedAt: publishedAt || null,
    tags: [], createdAt: Date.now(),
    status: 'summarizing', errorMessage: '',
  };
  await saveEntry(entry, pid);

  const apiConfig = await getProjectConfig(pid);
  try {
    const aiResult = await summarizeWithTags(content, apiConfig, url, publishedAt || '', pid);
    const cost = calcTokens(aiResult.usage);
    await updateEntry(id, {
      status: 'completed',
      aiTitle: aiResult.aiTitle,
      aiSummary: aiResult.aiSummary,
      source: aiResult.source || '',
      sourceTier: aiResult.sourceTier || 'low',
      sourceTierReason: aiResult.sourceTierReason || '',
      tags: aiResult.tags || [],
      usage: aiResult.usage || null,
      cost: cost || null,
      publishedAt: aiResult.publishedAt || publishedAt || todayStr(),
    }, pid);
    await updateSimilarityForEntry(id, pid);
  } catch (err) {
    await updateEntry(id, { status: 'error', errorMessage: `AI 摘要失败: ${err.message}` }, pid);
    return { success: false, error: err.message };
  }

  return { success: true, id };
}

/* 划词/检视收藏：原文 verbatim 入库，状态直接 completed，不走 AI 总结。 */
async function handleCollectSnippet({ url, title, text, kind, annotationId }) {
  const pid = (await chrome.storage.sync.get('currentProject')).currentProject || 'default';
  const snippet = String(text || '').trim().slice(0, 5000);
  if (!snippet) return { success: false, error: '片段内容为空' };
  const all = await getEntries(pid);
  const existing = all.find((e) =>
    e.kind === 'snippet'
    && String(e.url || '') === String(url || '')
    && String(e.fullText || '') === snippet
  ) || (annotationId ? all.find((e) => e.kind === 'snippet' && e.annotationId === annotationId) : null);
  if (existing) return { success: true, id: existing.id };
  const id = generateId();
  const entry = {
    id,
    url,
    originalTitle: title || '无标题',
    fullText: snippet,
    aiTitle: snippet.slice(0, 40),
    aiSummary: snippet,
    kind: 'snippet',
    annotationId: annotationId || null,
    annotationKind: kind || '',
    note: '',
    source: 'collect',
    tags: [],
    createdAt: Date.now(),
    status: 'completed',
    errorMessage: '',
    publishedAt: todayStr(),
  };
  await saveEntry(entry, pid);
  broadcastCollectionStatus({ urls: [url] }).catch(() => {});
  return { success: true, id };
}

function imageFormatFrom(mime, url) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  const u = String(url || '').toLowerCase();
  if (u.includes('.png')) return 'png';
  if (u.includes('.webp')) return 'webp';
  if (u.includes('.gif')) return 'gif';
  return 'jpg';
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes: bytes.buffer };
}

async function handleGetImageSource({ id, projectId } = {}) {
  const pid = projectId || (await chrome.storage.sync.get('currentProject')).currentProject || 'default';
  const loaded = await loadImageSource(pid, id);
  if (!loaded) return { ok: false, error: '找不到该图片' };
  return {
    ok: true,
    id: loaded.entry.id,
    alt: loaded.entry.aiTitle || '',
    mime: loaded.mime,
    dataUrl: bytesToDataUrl(loaded.bytes, loaded.mime),
  };
}

async function handleCollectImage({ url, title, imageUrl, dataUrl, alt, mime }) {
  const pid = (await chrome.storage.sync.get('currentProject')).currentProject || 'default';
  const src = String(imageUrl || '').trim();
  const pageUrl = String(url || '').trim();
  if (!src && !dataUrl) return { success: false, error: '没有可收藏的图片' };
  const all = await getEntries(pid);
  const existing = src
    ? all.find((e) => e.kind === 'image' && e.imageUrl === src && String(e.url || '') === pageUrl)
    : null;
  if (existing) return { success: true, id: existing.id };

  let bytes = null;
  let format = imageFormatFrom(mime, src);
  if (dataUrl) {
    const parsed = dataUrlToBuffer(dataUrl);
    if (parsed) {
      bytes = parsed.bytes;
      format = imageFormatFrom(parsed.mime, src);
    }
  }
  if (!bytes && src && !src.startsWith('blob:') && !src.startsWith('data:')) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      bytes = await resp.arrayBuffer();
      format = imageFormatFrom(resp.headers.get('content-type'), src);
    } catch (err) {
      return { success: false, error: '图片读取失败: ' + (err.message || err) };
    }
  }
  if (!bytes) return { success: false, error: '无法读取该图片（可能受跨域限制）' };

  const caption = String(alt || '').trim();
  const id = generateId();
  const fileName = (caption || title || '图片').slice(0, 40).replace(/[<>:"/\\|?*]/g, '_') + '.' + format;
  const entry = {
    id,
    url: pageUrl,
    imageUrl: src,
    originalTitle: caption || title || '图片',
    aiTitle: caption || title || '图片',
    aiSummary: caption,
    fullText: [caption, title, src, pageUrl].filter(Boolean).join('\n'),
    kind: 'image',
    format,
    fileName,
    fileSize: bytes.byteLength,
    docId: id,
    source: 'collect',
    tags: [],
    createdAt: Date.now(),
    status: 'completed',
    errorMessage: '',
    publishedAt: todayStr(),
  };
  await saveDocFile(id, bytes);
  await saveEntry(entry, pid);
  broadcastCollectionStatus({ urls: [pageUrl].filter(Boolean) }).catch(() => {});
  return { success: true, id };
}

async function findEntryByAnnotation(annotationId, pid) {
  const all = await getEntries(pid);
  return all.find((e) => e.kind === 'snippet' && e.annotationId === annotationId) || null;
}

async function handleDeleteSnippetByAnnotation({ annotationId }) {
  if (!annotationId) return { success: false, error: '缺少 annotationId' };
  const pid = (await chrome.storage.sync.get('currentProject')).currentProject || 'default';
  const target = await findEntryByAnnotation(annotationId, pid);
  if (target) {
    await deleteEntry(target.id, pid);
    await broadcastCollectionStatus({ refreshAll: true });
    return { success: true, deleted: target.id };
  }
  return { success: true, deleted: null }; // 无关联条目：幂等
}

async function updateSimilarityForEntry(entryId, pid) {
  const all = await getEntries(pid);
  const entry = all.find((e) => e.id === entryId);
  if (!entry || entry.status !== 'completed') return null;

  const candidates = all.filter((e) => e.id !== entryId && e.status === 'completed');
  const similarity = findBestSimilarityMatch(entry, candidates);
  await updateEntry(entryId, { similarity: similarity || null }, pid);

  if (similarity?.matchedEntryId) {
    const matched = all.find((e) => e.id === similarity.matchedEntryId);
    const currentSeverity = similaritySeverity(matched?.similarity?.level);
    const nextSeverity = similaritySeverity(similarity.level);
    const currentScore = matched?.similarity?.finalScore || 0;
    if (matched && (nextSeverity > currentSeverity || similarity.finalScore > currentScore)) {
      await updateEntry(matched.id, {
        similarity: {
          ...similarity,
          matchedEntryId: entry.id,
          matchedTitle: entry.aiTitle || entry.originalTitle || '',
        },
      }, pid);
    }
  }

  return similarity;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function generateId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Strip HTML to plain text in SW context (no DOM available).
 */
/* ======================================================================
 * RSS / Atom feed handlers
 * ====================================================================== */

async function handleFeedSubscribe({ url, scope }) {
  if (!url) return { success: false, error: '请输入 URL' };
  const pid = await getCurrentProject();
  const feedScope = scope === 'project' ? pid : 'global';
  try {
    const { feed, inserted } = await subscribeFeed({ url, scope: feedScope });
    return { success: true, feed, inserted };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Bulk subscribe - accepts an array of {url, title?, siteUrl?} or plain url strings.
 * Runs with concurrency cap (4), returns per-item result.
 */
async function handleFeedSubscribeBatch({ items, scope }) {
  if (!Array.isArray(items) || items.length === 0) return { success: false, error: '没有可订阅的 URL' };
  const pid = await getCurrentProject();
  const feedScope = scope === 'project' ? pid : 'global';

  const queue = items.map((i) => typeof i === 'string' ? { url: i } : i).filter((i) => i.url);
  const results = [];
  const CONCURRENCY = 4;

  const workers = new Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const { feed, inserted } = await subscribeFeed({ url: item.url, scope: feedScope });
        results.push({ url: item.url, ok: true, feed, inserted });
      } catch (err) {
        results.push({ url: item.url, ok: false, error: err.message });
      }
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  return { success: true, results, ok, fail, total: results.length };
}

/**
 * Import an OPML file. Parses via offscreen, then runs batch subscribe.
 */
async function handleFeedImportOPML({ xmlText, scope }) {
  if (!xmlText) return { success: false, error: 'OPML 内容为空' };
  let opmlFeeds;
  try {
    opmlFeeds = parseOPML(xmlText);
  } catch (err) {
    return { success: false, error: 'OPML 解析失败: ' + err.message };
  }
  if (!opmlFeeds || opmlFeeds.length === 0) {
    return { success: false, error: 'OPML 中未发现订阅源' };
  }
  return handleFeedSubscribeBatch({ items: opmlFeeds, scope });
}

async function handleFeedList({ scope } = {}) {
  const pid = await getCurrentProject();
  let feeds;
  if (scope === 'all') feeds = await listFeeds();
  else feeds = await listFeedsForProject(pid);
  return { success: true, feeds, projectId: pid };
}

async function handleFeedUpdate({ feedId, updates }) {
  if (!feedId || !updates) return { success: false, error: '参数缺失' };
  const next = await updateFeed(feedId, updates);
  return { success: !!next, feed: next };
}

async function handleFeedDelete({ feedId }) {
  if (!feedId) return { success: false, error: '参数缺失' };
  await dbDeleteFeed(feedId);
  return { success: true };
}

/** 倒排索引构建：触发一批（SW 或侧边栏调用）。构建本身可能耗时较长
    （5000 条拆多个子事务），sendMessage 等待期间 SW 可能被杀导致响应丢失，
    因此这里只做"轻量触发 + 立即返回状态"，实际构建由 alarm/启动循环负责。 */
async function handleFeedBuildIndex() {
  const built = await isIndexBuilt();
  if (built) {
    await chrome.alarms.clear(INDEX_BUILD_ALARM);
    return { success: true, done: true, progress: 1 };
  }
  // 触发构建（fire-and-forget，不等待完成），返回当前状态
  buildTokenIndexBatch()
    .then((done) => {
      if (done) {
        chrome.alarms.clear(INDEX_BUILD_ALARM).catch(() => {});
        console.log('[SW] feed token index built (from message)');
      }
    })
    .catch((err) => console.warn('[SW] token index batch failed (from message):', err));
  return { success: true, done: false };
}

/** 查询索引构建进度：{ built, done, total } */
async function handleFeedIndexStatus() {
  const st = await getIndexBuildStatus();
  return { success: true, built: st.built, done: st.done, total: st.total };
}

/** 重置倒排索引（清空 + 删进度），之后由构建循环从头重建 */
async function handleFeedResetIndex() {
  await chrome.alarms.clear(INDEX_BUILD_ALARM);
  await resetTokenIndex();
  // 立即创建 alarm 兜底：即使侧边栏没开，也能周期触发重建
  await chrome.alarms.create(INDEX_BUILD_ALARM, { periodInMinutes: 1 });
  return { success: true };
}

async function handleFeedDeleteAllItems({ scope, feedIds } = {}) {
  const pid = await getCurrentProject();
  let targetIds;
  if (Array.isArray(feedIds) && feedIds.length > 0) {
    targetIds = feedIds;
  } else {
    const feeds = scope === 'all' ? await listFeeds() : await listFeedsForProject(pid);
    targetIds = feeds.map((f) => f.id);
  }
  if (targetIds.length === 0) return { success: true, deleted: 0 };
  const deleted = await deleteAllItemsForFeeds(targetIds);
  return { success: true, deleted };
}

async function handleFeedReorder({ feedIds } = {}) {
  if (!Array.isArray(feedIds) || feedIds.length === 0) return { success: false, error: '参数缺失' };
  const updated = await reorderFeeds(feedIds);
  return { success: true, updated };
}

async function handleFeedRefreshOne({ feedId }) {
  if (!feedId) return { success: false, error: '参数缺失' };
  try {
    const result = await refreshFeed(feedId);
    const prefs = await getFeedPrefs();
    if (prefs.defaultTargetLanguage) runBackfill(prefs.defaultTargetLanguage).catch(() => {});
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleFeedRefreshAll({ scope, feedIds } = {}) {
  const pid = await getCurrentProject();
  let ids = Array.isArray(feedIds) ? feedIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!ids.length) {
    const feeds = scope === 'all' ? await listFeeds() : await listFeedsForProject(pid);
    ids = feeds.map((f) => f.id);
  }
  const results = await refreshFeeds(ids);
  const inserted = results.reduce((s, r) => s + (r.inserted || 0), 0);
  const errors = results.filter((r) => !r.ok).length;
  const prefs = await getFeedPrefs();
  if (prefs.defaultTargetLanguage) runBackfill(prefs.defaultTargetLanguage).catch(() => {});
  return { success: true, results, inserted, errors, total: results.length };
}

async function handleFeedItemsList({ feedId, feedIds, limit, beforePublishedAt, onlyStarred, scope, searchQuery, searchAny, searchInFullText, indexOnly, skipIds, metaOnly }) {
  const pid = await getCurrentProject();
  let targetIds = null;
  if (feedId) {
    targetIds = [feedId];
  } else if (Array.isArray(feedIds) && feedIds.length > 0) {
    targetIds = feedIds;
  } else {
    // Default: all feeds visible to current project (or all if scope=all)
    const feeds = scope === 'all' ? await listFeeds() : await listFeedsForProject(pid);
    targetIds = feeds.map((f) => f.id);
  }
  if (targetIds.length === 0) return { success: true, items: [], complete: true, hasMore: false };
  const items = await listItems({
    feedIds: targetIds,
    limit: limit || 80,
    beforePublishedAt: beforePublishedAt || null,
    onlyStarred: !!onlyStarred,
    searchQuery: searchQuery || '',
    searchAny: searchAny || '',
    searchInFullText: !!searchInFullText,
    indexOnly: !!indexOnly,
    skipIds: Array.isArray(skipIds) ? skipIds : null,
    metaOnly: !!metaOnly,
  });
  // indexOnly 时 listItems 返回 { items, complete }
  if (indexOnly && items && Array.isArray(items.items)) {
    return { success: true, items: items.items, complete: items.complete !== false };
  }
  // 补差请求：listItems 返回 { items, hasMore }
  if (items && Array.isArray(items.items)) {
    return { success: true, items: items.items, hasMore: !!items.hasMore, complete: true };
  }
  return { success: true, items, complete: true };
}

async function handleFeedItemGet({ itemId }) {
  if (!itemId) return { success: false, error: '参数缺失' };
  const item = await getItem(itemId);
  return { success: !!item, item };
}

async function handleFeedItemStar({ itemId }) {
  if (!itemId) return { success: false, error: '参数缺失' };
  await toggleStar(itemId);
  return { success: true };
}

/**
 * Fetch the full article for a feed item using the existing extractor pipeline.
 * Stores fullText back on the item so subsequent reads are instant.
 */
async function handleFeedItemFetchFull({ itemId, force }) {
  const item = await getItem(itemId);
  if (!item) return { success: false, error: '条目不存在' };
  if (item.hasFullText && !force) {
    return { success: true, fullText: item.fullText, title: item.title, publishedAt: item.publishedAt, cached: true };
  }
  if (!item.link) return { success: false, error: '此条目无链接' };

  // Reuse FETCH_PAGE logic
  const resp = await handleFetchPage({ url: item.link });
  if (!resp.success) return resp;

  await updateItemFullText(itemId, resp.content, true);
  // Trigger backfill so fullText gets translated too
  const prefs = await getFeedPrefs();
  if (prefs.defaultTargetLanguage) runBackfill(prefs.defaultTargetLanguage).catch(() => {});
  return { success: true, fullText: resp.content, title: resp.title, publishedAt: resp.publishedAt, cached: false };
}

/**
 * Send selected feed items through the AI summarization pipeline - entries library.
 * For each item:
 *   1. Ensure we have fullText (use item.fullText / contentHtml-stripped / fetch fresh)
 *   2. Call processEntry-like path (saveEntry + AI summarize + similarity)
 *   3. Write back collectedEntryId
 *
 * Returns: { success, results: [{ itemId, entryId, ok, error }] }
 */
async function handleFeedItemsCollect({ itemIds, projectId, concurrency }) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return { success: false, error: '请选择至少一个条目' };
  const pid = projectId || await getCurrentProject();
  const apiConfig = await getProjectConfig(pid);
  if (!apiConfig.apiKey) {
    return { success: false, error: '请先在设置中配置 AI API Key' };
  }

  const maxConcurrent = Math.max(1, Math.min(concurrency || 3, 6));

  async function processOne(itemId) {
    let entryId = null;
    let link = '';
    try {
      const item = await getItem(itemId);
      if (!item) return { itemId, ok: false, error: '条目不存在' };
      if (item.collectedEntryId) {
        return { itemId, ok: true, entryId: item.collectedEntryId, alreadyCollected: true };
      }

      const bodyFromHtml = item.contentHtml ? htmlToText(item.contentHtml, { preserveNewlines: false }) : '';
      // 证据要锚在原文上：翻译回填会就地改写 summary，原文在 originalSummary。
      const bodyFromSummary = item.originalSummary || item.summary || '';
      let fullText = item.fullText || bodyFromHtml || bodyFromSummary || '';
      let title = item.title || '';
      let publishedAt = item.publishedAt
        ? new Date(item.publishedAt).toISOString().slice(0, 10)
        : null;

      const hasFetchableLink = !!item.link && /^https?:\/\//i.test(item.link);
      const MIN_CHARS = 250;

      // --- Enough content already? ---
      if (fullText.trim().length >= MIN_CHARS) {
        link = hasFetchableLink ? item.link : `feed-item://${itemId}`;
        const existingEntry = await getEntryByUrl(link, pid);
        if (existingEntry) {
          await setCollectedEntryId(itemId, existingEntry.id);
          return { itemId, ok: true, entryId: existingEntry.id, alreadyCollected: true };
        }
        entryId = generateId();
        await saveEntry({
          id: entryId, url: link,
          originalTitle: title || item.title || '无标题',
          fullText, aiTitle: '', aiSummary: '',
          candidatePublishedAt: publishedAt, tags: [],
          createdAt: Date.now(), status: 'summarizing', errorMessage: '',
        }, pid);
        broadcastCollectionStatus({ urls: [link] }).catch(() => {});
      }

      // --- Not enough content, try fetching from origin ---
      else if (hasFetchableLink) {
        link = item.link;
        const existingEntry = await getEntryByUrl(link, pid);
        if (existingEntry) {
          await setCollectedEntryId(itemId, existingEntry.id);
          return { itemId, ok: true, entryId: existingEntry.id, alreadyCollected: true };
        }
        entryId = generateId();
        await saveEntry({
          id: entryId, url: link,
          originalTitle: title || item.title || '无标题',
          fullText, aiTitle: '', aiSummary: '',
          candidatePublishedAt: publishedAt, tags: [],
          createdAt: Date.now(), status: 'collecting', errorMessage: '',
        }, pid);
        broadcastCollectionStatus({ urls: [link] }).catch(() => {});

        let fetchedOk = false;
        try {
          const fetched = await handleFetchPage({ url: link });
          if (fetched.success && fetched.content && fetched.content.length >= MIN_CHARS) {
            fullText = fetched.content;
            title = title || fetched.title;
            if (fetched.publishedAt) publishedAt = fetched.publishedAt;
            await updateItemFullText(itemId, fullText, true);
            await updateEntry(entryId, {
              fullText, originalTitle: title || '无标题',
              candidatePublishedAt: publishedAt, status: 'summarizing',
            }, pid);
            broadcastCollectionStatus({ urls: [link] }).catch(() => {});
            fetchedOk = true;
          }
        } catch (_) { /* fall through to AI search */ }

        if (!fetchedOk) {
          await updateEntry(entryId, { status: 'error', errorMessage: '回源抓取失败，转交 AI 查找' }, pid).catch(() => {});
          broadcastCollectionStatus({ urls: [link] }).catch(() => {});
          return {
            itemId, ok: false, entryId, error: '回源抓取失败或正文不足',
            needsAiSearch: true,
            payload: { itemId, title: item.title || '', summary: bodyFromSummary || bodyFromHtml || '' },
          };
        }
      }

      // --- Not enough content, no link -> AI search ---
      else {
        return {
          itemId, ok: false,
          error: '此条目无链接且正文过短',
          needsAiSearch: true,
          payload: { itemId, title: item.title || '', summary: bodyFromSummary || bodyFromHtml || '' },
        };
      }

      // --- Summarize ---
      if (!fullText || fullText.trim().length < 20) {
        await updateEntry(entryId, { status: 'error', errorMessage: '无法获取正文' }, pid);
        broadcastCollectionStatus({ urls: [link] }).catch(() => {});
        return { itemId, ok: false, entryId, error: '无法获取正文' };
      }

      const aiResult = await summarizeWithTags(fullText, apiConfig, link, publishedAt || '', pid);
      const cost = calcTokens(aiResult.usage);
      await updateEntry(entryId, {
        status: 'completed',
        aiTitle: aiResult.aiTitle,
        aiSummary: aiResult.aiSummary,
        source: aiResult.source || '',
        sourceTier: aiResult.sourceTier || 'low',
        sourceTierReason: aiResult.sourceTierReason || '',
        tags: aiResult.tags || [],
        usage: aiResult.usage || null,
        cost: cost || null,
        publishedAt: aiResult.publishedAt || publishedAt || todayStr(),
      }, pid);
      await updateSimilarityForEntry(entryId, pid);
      await setCollectedEntryId(itemId, entryId);
      broadcastCollectionStatus({ urls: [link] }).catch(() => {});
      return { itemId, ok: true, entryId };
    } catch (err) {
      if (entryId) {
        try {
          await updateEntry(entryId, { status: 'error', errorMessage: `AI 摘要失败: ${err.message}` }, pid);
          if (link) broadcastCollectionStatus({ urls: [link] }).catch(() => {});
        } catch (_) {}
      }
      return { itemId, ok: false, entryId, error: err.message };
    }
  }

  // Concurrent worker pool: keep at most maxConcurrent items in flight at once
  const queue = itemIds.slice();
  const results = [];
  const inflight = new Set();
  while (queue.length > 0 || inflight.size > 0) {
    while (inflight.size < maxConcurrent && queue.length > 0) {
      const id = queue.shift();
      const p = processOne(id).then((r) => {
        results.push(r);
        inflight.delete(p);
      });
      inflight.add(p);
    }
    if (inflight.size > 0) await Promise.race(inflight);
  }

  return { success: true, results };
}

async function handleFeedSetPrefs({ prefs }) {
  const before = await getFeedPrefs();
  const merged = { ...before, ...(prefs || {}) };
  await chrome.storage.local.set({ [FEED_PREFS_KEY]: merged });
  await scheduleFeedAlarm();
  // Reload translation provider config (covers provider/key/region changes)
  await syncTranslateProvider();
  // Target language changed - run backfill so existing items get re-translated
  if (prefs && prefs.defaultTargetLanguage && prefs.defaultTargetLanguage !== before.defaultTargetLanguage) {
    runBackfill(merged.defaultTargetLanguage).catch((err) => console.warn('[SW] backfill on lang change failed:', err));
  } else if (prefs && prefs.defaultAutoTranslate && !before.defaultAutoTranslate) {
    runBackfill(merged.defaultTargetLanguage).catch((err) => console.warn('[SW] backfill on enable failed:', err));
  } else if (prefs && (prefs.translateProvider !== undefined || prefs.tencentSecretId !== undefined || prefs.tencentSecretKey !== undefined)) {
    // Provider/credentials changed → reset failure counts so previously-failed
    // items retry under the new provider, then restart backfill.
    const reset = await resetTranslateFailures(merged.defaultTargetLanguage).catch(() => 0);
    console.log('[SW] translate provider changed, reset', reset, 'failed items');
    runBackfill(merged.defaultTargetLanguage).catch(() => {});
  }
  return { success: true, prefs: merged };
}

async function handleTestTranslateProvider({ provider, tencent } = {}) {
  try {
    // For tencent: if user left SecretKey blank in the form, fall back to saved value
    let creds = tencent || {};
    if (provider === 'tencent' && (!creds.secretKey || !creds.secretId)) {
      const saved = await getFeedPrefs();
      creds = {
        secretId: creds.secretId || saved.tencentSecretId,
        secretKey: creds.secretKey || saved.tencentSecretKey,
        region: creds.region || saved.tencentRegion,
      };
    }
    const result = await testCloudProvider({
      provider: provider || 'google',
      targetLanguage: 'zh-Hans',
      tencent: creds,
    });
    return { success: true, ok: result.ok, sample: result.sample, error: result.error };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
