/**
 * 统一操作日志 —— 项目概览「活动」时间线的数据源。
 *
 * 记录一切可追溯的操作：主代理 / 子代理的每次工具调用与生命周期、对话回合、
 * 文库条目与文件变更、笔记本变更、用户在工作区里的操作。
 *
 * 存储用 IndexedDB（追加即原子，侧栏 / Service Worker / 阅读器多上下文并发写不丢事件），
 * 不用 chrome.storage 的读改写。写入 fire-and-forget、吞错：日志永远不能拖垮业务。
 *
 * 隐私：只存经白名单摘要后的短文本（summarizeToolArgs），URL 去掉 query/hash；
 * 不存工具参数原文、请求头、正文、输入框内容。
 */

const DB_NAME = 'citecat-activity';
const DB_VERSION = 1;
const STORE = 'events';
const CHANNEL = 'citecat-activity';

export const ACTIVITY_MAX_PER_PROJECT = 5000;
const TRIM_EVERY = 50;

export const ACTORS = ['user', 'main', 'sub', 'heartbeat', 'system'];
export const CATEGORIES = ['file', 'web', 'note', 'agent', 'turn', 'other'];

/* ---------------- 分类与文案 ---------------- */

const FILE_TOOLS = new Set([
  'create_document', 'doc_edit', 'doc_review', 'ingest', 'delete_entry', 'update_entry',
  'reorder_entries', 'collect_content', 'confirm_collect', 'cancel_collect', 'collect_feed_items',
  'fetch_entry', 'read_section', 'search_workspace',
]);
const WEB_TOOLS = new Set([
  'read_current_page', 'read_tab', 'read_many', 'interact_page', 'browser_act', 'search_web',
  'manage_tabs', 'open_dropdown', 'select_from_dropdown', 'describe_form', 'vision_find',
  'vision_read', 'vision_extract', 'click_at', 'cdp_click', 'cdp_type', 'ax_snapshot', 'ax_click',
  'extract_subtitles', 'exec_js_main', 'capture_network', 'fetch_video_transcript', 'call_api',
  'list_feeds', 'query_feed_items', 'fetch_feed_item', 'fetch_feed_items', 'refresh_feeds',
]);
const NOTE_TOOLS = new Set(['notebook', 'plan', 'save_memory', 'record_insight']);

export function categoryOfTool(name) {
  if (FILE_TOOLS.has(name)) return 'file';
  if (WEB_TOOLS.has(name)) return 'web';
  if (NOTE_TOOLS.has(name)) return 'note';
  return 'agent';
}

const TOOL_ZH = {
  read_current_page: '读取当前页', read_tab: '读取标签页', read_many: '批量读取标签页',
  interact_page: '操作页面', browser_act: '浏览器操作', search_web: '联网搜索',
  fetch_entry: '读取文库条目', delete_entry: '删除条目', update_entry: '更新条目',
  reorder_entries: '调整条目顺序', collect_content: '采集内容', confirm_collect: '确认采集',
  cancel_collect: '取消采集', clear_context: '清空上下文', auto_compact: '压缩上下文',
  list_feeds: '列出订阅源', query_feed_items: '查询订阅', fetch_feed_item: '读取订阅条目',
  fetch_feed_items: '批量读取订阅', collect_feed_items: '采集订阅条目', refresh_feeds: '刷新订阅',
  suggest_actions: '给出建议', ask_research_scope: '确认调研范围', manage_tabs: '管理标签页',
  create_document: '创建文档', plot_chart: '绘制图表', place_images: '投放图片', call_api: '调用 API', save_memory: '保存记忆',
  doc_edit: '编辑文档', doc_review: '审阅文档', manage_heartbeat: '管理定时任务', ingest: '入库',
  read_section: '读取章节', search_workspace: '搜索工作区', notebook: '笔记本', plan: '任务清单',
  task: '派出子代理', submit_report: '提交报告', section_job: '章节作业', write_document: '撰写文档', compose_report: '撰写文档', check_facts: '核验事实', review_argument: '评审观点', submit_research: '提交研究', write_research_artifact: '保存研究笔记', load_framework: '加载分析框架', analyst_memo: '分析师备忘录',
  extract_subtitles: '提取字幕', fetch_video_transcript: '获取视频字幕', capture_network: '抓取网络请求',
  exec_js_main: '执行页面脚本', vision_find: '视觉查找', vision_read: '视觉阅读', vision_extract: '视觉 OCR',
};

export function toolZh(name) {
  return TOOL_ZH[name] || name;
}

/* ---------------- 摘要（白名单，避免泄露） ---------------- */

function clip(s, n = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function safeUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return clip(`${u.host}${u.pathname === '/' ? '' : u.pathname}`, 100);
  } catch (_) {
    return clip(s.split(/[?#]/)[0], 100);
  }
}

const DETAIL_KEYS = [
  ['action', 'text'], ['act', 'text'], ['op', 'text'],
  ['title', 'text'], ['name', 'text'], ['file_name', 'text'], ['file', 'text'],
  ['url', 'url'], ['query', 'text'], ['q', 'text'], ['keyword', 'text'],
  ['description', 'text'], ['claim', 'text'],
  ['doc_id', 'text'], ['id', 'text'], ['tab_id', 'text'], ['format', 'text'],
];

export function summarizeToolArgs(name, args) {
  if (!args || typeof args !== 'object') return '';
  if (name === 'call_api') {
    return clip([args.method, safeUrl(args.url)].filter(Boolean).join(' '), 140);
  }
  const parts = [];
  const seen = new Set();
  for (const [key, kind] of DETAIL_KEYS) {
    const v = args[key];
    if (v == null || v === '' || typeof v === 'object') continue;
    const text = kind === 'url' ? safeUrl(v) : clip(v, 80);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    parts.push(text);
    if (parts.length >= 3) break;
  }
  return clip(parts.join(' · '), 160);
}

/** 由工具返回文本粗判成败（只看结构，不存内容）。 */
export function classifyToolResult(text) {
  const s = String(text ?? '').trim();
  if (!s) return 'ok';
  if (/^(参数错误|Error[:：]|该子代理不能)/.test(s)) return 'error';
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      if (o && (o.error || o.ok === false || o.success === false)) return 'error';
    } catch (_) { /* 非完整 JSON：当成功 */ }
  }
  return 'ok';
}

/* ---------------- 规范化 ---------------- */

export function normalizeEvent(evt) {
  const e = evt || {};
  const actor = ACTORS.includes(e.actor) ? e.actor : 'system';
  const cat = CATEGORIES.includes(e.cat) ? e.cat : 'other';
  return {
    projectId: String(e.projectId || 'default'),
    ts: Number(e.ts) > 0 ? Number(e.ts) : Date.now(),
    actor,
    actorId: clip(e.actorId, 60),
    actorName: clip(e.actorName, 40),
    cat,
    action: clip(e.action, 60),
    label: clip(e.label, 80),
    detail: clip(e.detail, 200),
    status: e.status === 'error' ? 'error' : (e.status === 'ok' ? 'ok' : ''),
    durationMs: Math.max(0, Math.round(Number(e.durationMs) || 0)),
  };
}

/* ---------------- 存储后端 ---------------- */

function createMemoryBackend() {
  const rows = [];
  let seq = 0;
  return {
    async add(evt) { rows.push({ ...evt, seq: ++seq }); },
    async list(pid, { limit = 200, before = Infinity } = {}) {
      return rows
        .filter((r) => r.projectId === pid && r.ts < before)
        .sort((a, b) => (b.ts - a.ts) || (b.seq - a.seq))
        .slice(0, limit);
    },
    async count(pid) { return rows.filter((r) => r.projectId === pid).length; },
    async trim(pid, max) {
      const mine = rows.filter((r) => r.projectId === pid).sort((a, b) => (a.ts - b.ts) || (a.seq - b.seq));
      const drop = new Set(mine.slice(0, Math.max(0, mine.length - max)));
      for (let i = rows.length - 1; i >= 0; i--) if (drop.has(rows[i])) rows.splice(i, 1);
    },
    async clear(pid) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].projectId === pid) rows.splice(i, 1);
    },
  };
}

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
        store.createIndex('pid_ts', ['projectId', 'ts']);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idbBackend = {
  async add(evt) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(evt);
    await txDone(tx);
  },
  async list(pid, { limit = 200, before = Infinity } = {}) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('pid_ts');
    const upper = Number.isFinite(before) ? [pid, before] : [pid, Infinity];
    const range = IDBKeyRange.bound([pid, 0], upper, false, Number.isFinite(before));
    const out = [];
    await new Promise((resolve, reject) => {
      const cur = index.openCursor(range, 'prev');
      cur.onerror = () => reject(cur.error);
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c || out.length >= limit) { resolve(); return; }
        out.push(c.value);
        c.continue();
      };
    });
    await txDone(tx);
    return out;
  },
  async count(pid) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const n = await reqP(tx.objectStore(STORE).index('pid_ts').count(IDBKeyRange.bound([pid, 0], [pid, Infinity])));
    await txDone(tx);
    return n;
  },
  async trim(pid, max) {
    const total = await this.count(pid);
    if (total <= max) return;
    let excess = total - max;
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.objectStore(STORE).index('pid_ts');
    await new Promise((resolve, reject) => {
      const cur = index.openCursor(IDBKeyRange.bound([pid, 0], [pid, Infinity]), 'next');
      cur.onerror = () => reject(cur.error);
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c || excess <= 0) { resolve(); return; }
        c.delete();
        excess -= 1;
        c.continue();
      };
    });
    await txDone(tx);
  },
  async clear(pid) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.objectStore(STORE).index('pid_ts');
    await new Promise((resolve, reject) => {
      const cur = index.openCursor(IDBKeyRange.bound([pid, 0], [pid, Infinity]));
      cur.onerror = () => reject(cur.error);
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) { resolve(); return; }
        c.delete();
        c.continue();
      };
    });
    await txDone(tx);
  },
};

let backend = null;
function getBackend() {
  if (backend) return backend;
  backend = typeof indexedDB === 'undefined' ? createMemoryBackend() : idbBackend;
  return backend;
}

/** 测试用：换成内存后端。 */
export function __useMemoryBackend() {
  backend = createMemoryBackend();
  return backend;
}

/* ---------------- 广播（同上下文 + 跨上下文） ---------------- */

let txChannel = null;
function broadcast(pid) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    if (!txChannel) {
      txChannel = new BroadcastChannel(CHANNEL);
      if (typeof txChannel.unref === 'function') txChannel.unref();
    }
    txChannel.postMessage({ pid });
  } catch (_) { /* ignore */ }
}

/** 订阅活动变化（任一上下文写入都会触发）。返回取消函数。 */
export function subscribeActivity(cb) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let ch = null;
  try {
    ch = new BroadcastChannel(CHANNEL);
    if (typeof ch.unref === 'function') ch.unref();
    ch.onmessage = (e) => { try { cb(e.data && e.data.pid); } catch (_) { /* ignore */ } };
  } catch (_) {
    return () => {};
  }
  return () => { try { ch.close(); } catch (_) { /* ignore */ } };
}

/* ---------------- 对外 API ---------------- */

let writes = 0;

/**
 * 追加一条活动。fire-and-forget：返回的 promise 永不 reject，业务侧不必 await。
 * @param {object} evt 见 normalizeEvent
 */
export function logActivity(evt) {
  let e;
  try { e = normalizeEvent(evt); } catch (_) { return Promise.resolve(false); }
  return (async () => {
    try {
      const b = getBackend();
      await b.add(e);
      writes += 1;
      if (writes % TRIM_EVERY === 0) await b.trim(e.projectId, ACTIVITY_MAX_PER_PROJECT);
      broadcast(e.projectId);
      return true;
    } catch (_) {
      return false;
    }
  })();
}

export async function listActivity(projectId, opts = {}) {
  try {
    return await getBackend().list(String(projectId || 'default'), opts);
  } catch (_) {
    return [];
  }
}

export async function countActivity(projectId) {
  try { return await getBackend().count(String(projectId || 'default')); } catch (_) { return 0; }
}

export async function clearActivity(projectId) {
  try { await getBackend().clear(String(projectId || 'default')); } catch (_) { /* ignore */ }
  broadcast(String(projectId || 'default'));
}

export async function trimActivity(projectId, max = ACTIVITY_MAX_PER_PROJECT) {
  try { await getBackend().trim(String(projectId || 'default'), max); } catch (_) { /* ignore */ }
}

/** 工具调用事件（execOneToolCall 用）。 */
export function logToolCall({ ctx, name, args, result, error, durationMs, rejected }) {
  // task 的起止由 subagent.start / subagent.end 记录，这里再记一条只会重复。
  if (name === 'task') return Promise.resolve(false);
  const sub = !!(ctx && ctx.subagentKind);
  const status = rejected || error ? 'error' : classifyToolResult(result);
  return logActivity({
    projectId: (ctx && ctx.projectId) || 'default',
    actor: sub ? 'sub' : 'main',
    actorId: sub ? (ctx.subagentOwner || '') : '',
    actorName: sub ? ctx.subagentKind : '',
    cat: categoryOfTool(name),
    action: name,
    label: toolZh(name),
    detail: error ? `${summarizeToolArgs(name, args)}${summarizeToolArgs(name, args) ? ' · ' : ''}${clip(error, 60)}` : summarizeToolArgs(name, args),
    status,
    durationMs,
  });
}


