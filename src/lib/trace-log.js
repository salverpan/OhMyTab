/**
 * 任务追踪的内容节点存储 —— 思维导图的数据源。
 *
 * 与 activity-log 的区别：activity 记“谁在何时调了什么工具”（流水账，不存内容）；
 * trace 记“说了什么、交回了什么、判断是什么”（带截断后的内容），并用 parentId 串成树：
 *
 *   turn（用户输入 / 心跳运行 / 子代理回报）
 *     ├─ agent     主代理本回合的回复
 *     ├─ subagent  派出的子代理
 *     │    ├─ finding     子代理对任务书问题的判断（meta.support / counter = claim 节点 id）
 *     │    ├─ claim       断言（status = 核验 verdict，text = 理由）
 *     │    ├─ unresolved  未解决项
 *     │    └─ action      执行的操作
 *     └─ report    compose_report 产出的研报（text = BLUF，refs.entryId = 产出条目）
 *          ├─ kj          核心判断（meta.support / counter = evidence 节点 id）
 *          ├─ evidence    判断引用的证据快照（status = 核验 verdict）
 *          └─ unresolved  不确定性（subtype=uncertainty）/ 信息缺口（subtype=gap）
 *
 * 判断 / 观测不在这里存：它们的权威数据在笔记本（supersedes 链、history），读图时合并。
 *
 * 存储用 IndexedDB（对话被压缩 / 清空后图仍在）。put 是 upsert：同 id 再写即更新，
 * 用于 running -> completed 这类状态推进。写入 fire-and-forget、吞错，绝不拖垮业务。
 */

const DB_NAME = 'citecat-trace';
const DB_VERSION = 1;
const STORE = 'nodes';
const CHANNEL = 'citecat-trace';

export const TRACE_MAX_PER_PROJECT = 3000;
const TRIM_EVERY = 40;

export const TRACE_KINDS = [
  'turn', 'agent', 'subagent', 'claim', 'unresolved', 'action', 'insight',
  'finding', 'report', 'kj', 'evidence',
];
export const CHAT_THREAD = 'chat';

const TITLE_MAX = 160;
const TEXT_MAX = 600;

const META_CONFIDENCE = ['high', 'medium', 'low'];
const META_TREND = ['up', 'down', 'flat'];
const META_TRIGGER = ['user', 'refuted', 'failure', 'new-info', 'other'];
const META_MODALITY = ['confirmed', 'claimed', 'reported', 'denied', 'assessed', 'speculative'];
const MAX_LINKS = 40;

/**
 * insight 节点的结构化附加字段（主代理上报的决策要素）。只保留白名单标量，
 * 没有的键不输出，保证旧节点 / 其它 kind 的 meta 恒为 {}。
 */
function normalizeMeta(m) {
  const x = m && typeof m === 'object' ? m : {};
  const out = {};
  if (META_CONFIDENCE.includes(x.confidence)) out.confidence = x.confidence;
  if (META_TREND.includes(x.trend)) out.trend = x.trend;
  if (META_TRIGGER.includes(x.trigger)) out.trigger = x.trigger;
  if (Array.isArray(x.options)) {
    const opts = x.options.map((o) => clip(o, 60)).filter(Boolean).slice(0, 4);
    if (opts.length) out.options = opts;
  }
  if (x.chosen) out.chosen = clip(x.chosen, 80);
  if (x.supersedes) out.supersedes = clip(x.supersedes, 60);
  if (x.supersededBy) out.supersededBy = clip(x.supersededBy, 60);
  if (Number(x.dueAt) > 0) out.dueAt = Number(x.dueAt);
  if (META_MODALITY.includes(x.modality)) out.modality = x.modality;
  if (x.attribution) out.attribution = clip(x.attribution, 80);
  if (x.eventTime) out.eventTime = clip(x.eventTime, 40);
  if (Number(x.sources) > 0) out.sources = Math.min(99, Math.floor(Number(x.sources)));
  if (x.likelihood) out.likelihood = clip(x.likelihood, 12);
  if (x.question) out.question = clip(x.question, 300);
  for (const k of ['support', 'counter']) {
    if (!Array.isArray(x[k])) continue;
    const ids = x[k].map((v) => clip(v, 160)).filter(Boolean).slice(0, MAX_LINKS);
    if (ids.length) out[k] = ids;
  }
  return out;
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export function newTraceId(prefix = 'n') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 规范化一个节点。refs 只保留白名单标量字段（不存参数、正文）。
 * subtype：turn 的来源（user / heartbeat / followup）；subagent 的工种；claim 的置信度等。
 */
export function normalizeTraceNode(n) {
  const x = n || {};
  const kind = TRACE_KINDS.includes(x.kind) ? x.kind : 'action';
  const refsIn = x.refs && typeof x.refs === 'object' ? x.refs : {};
  const refs = {};
  for (const k of ['taskId', 'checkRunId', 'docId', 'noteId', 'entryId']) {
    if (refsIn[k]) refs[k] = clip(refsIn[k], 80);
  }
  return {
    id: String(x.id || newTraceId(kind.slice(0, 2))),
    projectId: String(x.projectId || 'default'),
    parentId: x.parentId ? String(x.parentId) : '',
    threadId: String(x.threadId || CHAT_THREAD),
    kind,
    subtype: clip(x.subtype, 40),
    ts: Number(x.ts) > 0 ? Number(x.ts) : Date.now(),
    endedAt: Number(x.endedAt) > 0 ? Number(x.endedAt) : 0,
    title: clip(x.title, TITLE_MAX),
    text: clip(x.text, TEXT_MAX),
    status: clip(x.status, 40),
    refs,
    meta: normalizeMeta(x.meta),
  };
}

/* ---------------- 存储后端 ---------------- */

function createMemoryBackend() {
  const rows = new Map();
  return {
    async put(node) { rows.set(node.id, { ...node }); },
    async list(pid, { limit = 1500 } = {}) {
      return [...rows.values()]
        .filter((r) => r.projectId === pid)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit);
    },
    async count(pid) { return [...rows.values()].filter((r) => r.projectId === pid).length; },
    async trim(pid, max) {
      const mine = [...rows.values()].filter((r) => r.projectId === pid).sort((a, b) => a.ts - b.ts);
      for (const r of mine.slice(0, Math.max(0, mine.length - max))) rows.delete(r.id);
    },
    async clear(pid) {
      for (const [id, r] of rows) if (r.projectId === pid) rows.delete(id);
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
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
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
  async put(node) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(node);
    await txDone(tx);
  },
  async list(pid, { limit = 1500 } = {}) {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('pid_ts');
    const range = IDBKeyRange.bound([pid, 0], [pid, Infinity]);
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

/* ---------------- 广播 ---------------- */

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

/** 订阅内容节点变化（任一上下文写入都会触发）。返回取消函数。 */
export function subscribeTrace(cb) {
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
 * 写入（或按 id 更新）一个节点。fire-and-forget：promise 永不 reject。
 * 返回规范化后的节点（同步可用于拿 id）：`const node = putTrace(...).node`。
 */
export function putTrace(node) {
  let n;
  try { n = normalizeTraceNode(node); } catch (_) { return { node: null, done: Promise.resolve(false) }; }
  const done = (async () => {
    try {
      const b = getBackend();
      await b.put(n);
      writes += 1;
      if (writes % TRIM_EVERY === 0) await b.trim(n.projectId, TRACE_MAX_PER_PROJECT);
      broadcast(n.projectId);
      return true;
    } catch (_) {
      return false;
    }
  })();
  return { node: n, done };
}

export async function listTrace(projectId, opts = {}) {
  try { return await getBackend().list(String(projectId || 'default'), opts); } catch (_) { return []; }
}

export async function countTrace(projectId) {
  try { return await getBackend().count(String(projectId || 'default')); } catch (_) { return 0; }
}

export async function trimTrace(projectId, max = TRACE_MAX_PER_PROJECT) {
  try { await getBackend().trim(String(projectId || 'default'), max); } catch (_) { /* ignore */ }
}

export async function clearTrace(projectId) {
  const pid = String(projectId || 'default');
  try { await getBackend().clear(pid); } catch (_) { /* ignore */ }
  broadcast(pid);
}

/* ---------------- 子代理报告 -> 节点 ---------------- */

/**
 * 把一次子代理交回（报告 + 核验结果）展开成 claim / unresolved / action 子节点。
 * 纯函数，返回节点数组（未写入）；claim 的 status 是确定性核验 verdict，
 * 没有核验结果时为 ''（图上显示为“未核验”）。
 */
export function subagentReportNodes({ projectId, parentId, threadId, report, verification, ts }) {
  if (!report) return [];
  const base = Number(ts) > 0 ? Number(ts) : Date.now();
  const verdictById = new Map();
  for (const c of (verification && verification.claims) || []) verdictById.set(c.id, c);
  const nodes = [];
  let i = 0;
  const mk = (kind, fields) => normalizeTraceNode({
    projectId, parentId, threadId, kind, ts: base + (i++), ...fields,
  });
  const claimNodeId = (cid) => `${parentId}:${cid}`;
  (report.findings || []).forEach((f, idx) => {
    nodes.push(mk('finding', {
      id: `${parentId}:f${idx + 1}`,
      subtype: f.confidence || '',
      title: f.question,
      text: f.answer,
      meta: {
        support: (f.supporting || []).map(claimNodeId),
        counter: (f.contradicting || []).map(claimNodeId),
      },
    }));
  });
  for (const c of report.claims || []) {
    const v = verdictById.get(c.id);
    nodes.push(mk('claim', {
      id: `${parentId}:${c.id}`,
      subtype: c.confidence || '',
      title: c.claim,
      text: v ? (v.reason || '') : '',
      status: v ? v.verdict : '',
      meta: {
        modality: c.modality,
        attribution: c.attribution,
        eventTime: c.event_time,
        sources: v ? v.independentSources : 0,
      },
    }));
  }
  for (const u of report.unresolved || []) nodes.push(mk('unresolved', { id: `${parentId}:u${i}`, title: u }));
  for (const a of report.actions || []) {
    nodes.push(mk('action', { id: `${parentId}:a${i}`, title: a.description, refs: a.result_ref ? { docId: a.result_ref } : {} }));
  }
  return nodes;
}

/**
 * compose_report 的论证结构 -> report / kj / evidence / unresolved 节点。纯函数。
 * evidence 是判断所引证据的快照（不指回子代理的 claim 节点：同一主张可能来自多个子任务，已在证据池里合并）。
 * @param {object} input
 * @param {object} input.outline  validateOutline 之后的骨架
 * @param {Array}  input.evidence 判断所引证据快照（id 与 outline.basis / counter 对齐）
 */
export function reportTraceNodes({
  projectId, parentId = '', threadId, ts, reportId, title, question, entryId = '', outline, evidence = [],
}) {
  if (!outline || !reportId) return [];
  const base = Number(ts) > 0 ? Number(ts) : Date.now();
  let i = 0;
  const mk = (kind, fields) => normalizeTraceNode({
    projectId, threadId, kind, ts: base + (i++), parentId: reportId, ...fields,
  });
  const evId = (e) => `${reportId}:${e}`;
  const used = new Set();
  const judgments = outline.key_judgments || [];
  for (const k of judgments) for (const e of [...(k.basis || []), ...(k.counter || [])]) used.add(e);
  for (const u of outline.uncertainties || []) for (const e of u.basis || []) used.add(e);
  const items = evidence.filter((item) => used.has(item.id));
  const nodes = [normalizeTraceNode({
    id: reportId,
    projectId,
    parentId,
    threadId,
    kind: 'report',
    ts: base + (i++),
    title: title || outline.title,
    text: outline.bluf,
    status: 'ok',
    refs: entryId ? { entryId } : {},
    meta: { question, sources: items.length },
  })];
  judgments.forEach((k, idx) => {
    nodes.push(mk('kj', {
      id: `${reportId}:K${idx + 1}`,
      subtype: k.confidence || '',
      title: k.judgment,
      text: k.reasoning,
      meta: { likelihood: k.likelihood, support: (k.basis || []).map(evId), counter: (k.counter || []).map(evId) },
    }));
  });
  for (const item of items) {
    const src = (item.sources || []).find((s) => s.quote) || (item.sources || [])[0] || {};
    nodes.push(mk('evidence', {
      id: evId(item.id),
      subtype: item.confidence || '',
      title: item.claim,
      text: src.quote || '',
      status: item.verdict,
      refs: src.doc_id ? { docId: src.doc_id } : {},
      meta: {
        modality: item.modality,
        attribution: item.attribution,
        eventTime: item.eventTime,
        sources: item.independentSources,
      },
    }));
  }
  (outline.uncertainties || []).forEach((u, idx) => {
    nodes.push(mk('unresolved', {
      id: `${reportId}:u${idx + 1}`, subtype: 'uncertainty', title: u.issue, meta: { support: (u.basis || []).map(evId) },
    }));
  });
  (outline.gaps || []).forEach((g, idx) => {
    nodes.push(mk('unresolved', { id: `${reportId}:g${idx + 1}`, subtype: 'gap', title: g }));
  });
  return nodes;
}
