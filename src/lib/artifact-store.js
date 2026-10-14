/**
 * 工作区（artifact 层）—— 把读到的原文落成可按 doc_id + 锚点回读的条目。
 *
 * 统一地址：网页 / RSS / 文库文档 / 子代理产物一视同仁，都用 docId 寻址。
 * 主对话只拿 { doc_id, outline, chars }，原文留在库里，按需 readSection 回读；
 * 子代理交回的「出处」就是 doc_id#锚点，父代理可低成本核验。
 *
 * IndexedDB `citecat-artifacts`（v2）
 *   docs   keyPath docId → { docId, kind, url, title, site, chars, charsTotal, partial,
 *                            pages, pageOffsets, outline, fullText, createdAt, updatedAt,
 *                            origin, via }
 *          index url —— 同一 URL 重复读不新建 doc（内容变长才覆盖）
 *   chunks keyPath key  → { key: `${docId}#${ord}`, docId, ord, heading, text, start, end }
 *          index docId
 *
 * 检索 v1 = 关键词全扫 chunks（单条 ~1k 字符，几千条量级毫秒级）。量级上来再上
 * feed-db 那套 2-gram 倒排；语义检索暂不做（用户 2026-09-10 拍板：先不引向量）。
 */

const DB_NAME = 'citecat-artifacts';
import { inferArtifactProvenance, isCitationEligibleArtifact } from './source-model.js';

const DB_VERSION = 2;
const STORE_DOCS = 'docs';
const STORE_CHUNKS = 'chunks';

const CHUNK_TARGET_CHARS = 1000;
/** 看起来像标题的短行（Markdown / 中文章节 / 数字编号），用于给分块挂 heading。 */
const HEADING_RE = /^(#{1,6}\s+\S|第\s*[0-9一二三四五六七八九十百零]+\s*[章节節篇部讲]|[0-9]+(\.[0-9]+){0,3}[\s、.．]|[一二三四五六七八九十]+[、.．])/;
const HEADING_MAX_CHARS = 80;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => {
      // 与 feed-db 同款：被旧连接阻塞时重置 promise，避免永久卡住
      dbPromise = null;
      reject(new Error('IndexedDB blocked by another connection'));
    };
    req.onupgradeneeded = () => {
      const db = req.result;
      let docs;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        docs = db.createObjectStore(STORE_DOCS, { keyPath: 'docId' });
        docs.createIndex('url', 'url', { unique: false });
        docs.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        docs = req.transaction.objectStore(STORE_DOCS);
      }
      if (!docs.indexNames.contains('sourceEntryId')) docs.createIndex('sourceEntryId', 'sourceEntryId', { unique: false });
      if (!docs.indexNames.contains('trustClass')) docs.createIndex('trustClass', 'trustClass', { unique: false });
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunks = db.createObjectStore(STORE_CHUNKS, { keyPath: 'key' });
        chunks.createIndex('docId', 'docId', { unique: false });
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

function tx(storeNames, mode = 'readonly') {
  return openDB().then((db) => {
    const transaction = db.transaction(storeNames, mode);
    return {
      transaction,
      stores: Array.isArray(storeNames)
        ? Object.fromEntries(storeNames.map((n) => [n, transaction.objectStore(n)]))
        : { [storeNames]: transaction.objectStore(storeNames) },
      done: new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('transaction aborted'));
      }),
    };
  });
}

function req2promise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sha1Hex(str) {
  const buf = new TextEncoder().encode(String(str));
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(String(str));
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hydrateArtifactRecord(doc) {
  if (!doc) return null;
  const inferred = inferArtifactProvenance(doc);
  return {
    ...doc,
    provenanceType: doc.provenanceType || inferred.type,
    trustClass: doc.trustClass || inferred.trustClass,
    sourceEntryId: doc.sourceEntryId || '',
    capturedAt: Number(doc.capturedAt || doc.createdAt) || 0,
  };
}

/**
 * 稳定 docId：同一项目内同页重复读复用；不同项目必须有不同 id。
 * default 保留旧指纹，避免升级后现有默认项目来源全部失联。
 */
export async function makeDocId({ url, title, text, projectId = '' } = {}) {
  const pid = String(projectId || '');
  const scope = pid && pid !== 'default' ? `project|${pid}|` : '';
  const key = url
    ? `${scope}url|${String(url).trim()}`
    : `${scope}txt|${String(title || '').trim()}|${String(text || '').slice(0, 200)}`;
  return `doc_${(await sha1Hex(key)).slice(0, 16)}`;
}

/** 超长段落按句末/换行回退切成 ~target 字符的片，保留原文偏移。 */
function splitLongPara(text, start, target) {
  const out = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + target, text.length);
    if (end < text.length) {
      const win = text.slice(pos, end);
      const cut = Math.max(win.lastIndexOf('。'), win.lastIndexOf('！'), win.lastIndexOf('？'), win.lastIndexOf('\n'), win.lastIndexOf('. '));
      if (cut > target * 0.5) end = pos + cut + 1;
    }
    const piece = text.slice(pos, end).trim();
    if (piece) out.push({ text: piece, start: start + pos, end: start + end });
    pos = end;
  }
  return out;
}

/**
 * 结构切块：按行扫描 —— 短标题行另起一块，普通行累积到 ~1k 字符，空行只作分隔。
 * 不按固定字数硬切；单块仍过长（无标题巨段）再按句末回退切。
 * @returns {Array<{heading: string, text: string, start: number, end: number}>}
 */
export function splitChunks(raw) {
  const src = String(raw || '');
  const chunks = [];
  let cur = null;
  let heading = '';
  let offset = 0;

  const startBlock = (text, start, len) => ({ heading, text, start, end: start + len });
  const flush = () => { if (cur && cur.text) chunks.push(cur); cur = null; };

  for (const line of src.split('\n')) {
    const lineStart = offset;
    offset += line.length + 1; // +1 = 换行符
    const t = line.trim();
    if (!t) continue;
    if (t.length <= HEADING_MAX_CHARS && HEADING_RE.test(t)) {
      flush();
      heading = t;
      cur = startBlock(t, lineStart, line.length);
      continue;
    }
    if (!cur) {
      cur = startBlock(t, lineStart, line.length);
    } else if (cur.text.length + t.length + 1 > CHUNK_TARGET_CHARS) {
      flush();
      cur = startBlock(t, lineStart, line.length);
    } else {
      cur.text += `\n${t}`;
      cur.end = lineStart + line.length;
    }
  }
  flush();

  const out = [];
  for (const c of chunks) {
    if (c.text.length <= CHUNK_TARGET_CHARS * 1.5) { out.push(c); continue; }
    for (const piece of splitLongPara(c.text, c.start, CHUNK_TARGET_CHARS)) {
      out.push({ heading: c.heading, ...piece });
    }
  }
  return out;
}

function outlineOf(chunks) {
  const out = [];
  for (const c of chunks) {
    const h = String(c.heading || '').trim();
    if (!h) continue;
    if (out.length && out[out.length - 1] === h) continue;
    out.push(h.slice(0, 120));
  }
  return out.slice(0, 60);
}

/**
 * 写入一条 artifact（同 URL 已有更长正文则跳过）。
 * @returns {Promise<{docId, chars, chunks, pages, partial, reused}>}
 */
export async function putArtifact({ kind = 'page', url = '', title = '', text = '', meta = {} } = {}) {
  const body = String(text || '').trim();
  if (!body) return { docId: '', chars: 0, chunks: 0, reused: false, error: '正文为空' };
  const projectId = String(meta.projectId || '');
  const docId = await makeDocId({ url, title, text: body, projectId });
  const now = Date.now();
  const chunks = splitChunks(body);
  const inferred = inferArtifactProvenance({
    kind,
    url,
    provenanceType: meta.provenanceType,
    trustClass: meta.trustClass,
  });

  const existing = await getArtifact(docId).catch(() => null);
  if (existing && existing.chars >= body.length) {
    return { docId, chars: existing.chars, chunks: existing.chunkCount || 0, pages: existing.pages || 0, partial: !!existing.partial, reused: true };
  }

  const doc = {
    docId,
    kind,
    url: String(url || ''),
    title: String(title || ''),
    site: String(meta.site || ''),
    chars: body.length,
    charsTotal: Number(meta.charsTotal) || body.length,
    partial: !!meta.partial,
    pages: Number(meta.pages) || 0,
    pageOffsets: Array.isArray(meta.pageOffsets) ? meta.pageOffsets : null,
    outline: outlineOf(chunks),
    chunkCount: chunks.length,
    fullText: body,
    origin: String(meta.origin || ''),
    via: String(meta.via || (existing && existing.via) || ''),
    provenanceType: String(meta.provenanceType || (existing && existing.provenanceType) || inferred.type),
    trustClass: String(meta.trustClass || (existing && existing.trustClass) || inferred.trustClass),
    sourceEntryId: String(meta.sourceEntryId || (existing && existing.sourceEntryId) || ''),
    capturedAt: Number(meta.capturedAt || (existing && existing.capturedAt)) || now,
    contentHash: await sha256Hex(body),
    // 归属项目：删库时按此级联清理（存量记录无此字段，按 'default' 处理）
    projectId,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const t = await tx([STORE_DOCS, STORE_CHUNKS], 'readwrite');
  // 覆盖写：先清旧 chunks（同一事务内，避免留下孤儿块）
  if (existing) {
    const oldKeys = await req2promise(t.stores[STORE_CHUNKS].index('docId').getAllKeys(docId));
    for (const k of oldKeys) t.stores[STORE_CHUNKS].delete(k);
  }
  t.stores[STORE_DOCS].put(doc);
  chunks.forEach((c, ord) => {
    t.stores[STORE_CHUNKS].put({
      key: `${docId}#${ord}`,
      docId,
      ord,
      heading: c.heading || '',
      text: c.text,
      start: c.start,
      end: c.end,
    });
  });
  await t.done;
  return { docId, chars: doc.chars, chunks: chunks.length, pages: doc.pages, partial: doc.partial, reused: false };
}

export async function getArtifact(docId) {
  if (!docId) return null;
  const t = await tx(STORE_DOCS);
  return hydrateArtifactRecord(await req2promise(t.stores[STORE_DOCS].get(String(docId))));
}

export async function updateArtifact(docId, patch = {}) {
  const id = String(docId || '');
  if (!id) return { error: '需要 doc_id' };
  const existing = await getArtifact(id);
  if (!existing) return { error: '找不到该来源' };
  const next = { ...existing, updatedAt: Date.now() };
  if (patch.title != null) next.title = String(patch.title).trim();
  const t = await tx(STORE_DOCS, 'readwrite');
  t.stores[STORE_DOCS].put(next);
  await t.done;
  return { ok: true };
}

/** 紧凑列表（不含正文），给 search_workspace 空查询 / 工作区总览用。 */
export async function listArtifacts({ limit = 30, projectId = '' } = {}) {
  const t = await tx(STORE_DOCS);
  const all = await req2promise(t.stores[STORE_DOCS].getAll());
  const pid = projectId ? String(projectId) : '';
  return all
    .map(hydrateArtifactRecord)
    .filter((d) => !pid || String(d.projectId || 'default') === pid)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 30)))
    .map((d) => ({
      doc_id: d.docId, kind: d.kind, title: d.title, url: d.url,
      chars: d.chars, chunks: d.chunkCount || 0, pages: d.pages || 0,
      partial: !!d.partial, updatedAt: d.updatedAt, projectId: d.projectId || '',
      origin: d.origin || '', via: d.via || '', provenanceType: d.provenanceType || '',
      trustClass: d.trustClass || '', sourceEntryId: d.sourceEntryId || '',
      contentHash: d.contentHash || '', capturedAt: d.capturedAt || 0,
    }));
}

export async function countArtifacts({ projectId = '' } = {}) {
  if (!projectId) {
    const t = await tx(STORE_DOCS);
    return req2promise(t.stores[STORE_DOCS].count());
  }
  const docs = await listArtifacts({ limit: 200, projectId });
  return docs.length;
}

/**
 * 按锚点回读一段。
 * @param {string} docId
 * @param {{chunk?: number|string, page?: number, offset?: number, maxChars?: number}} sel
 */
export async function readSection(docId, sel = {}) {
  const doc = await getArtifact(docId);
  if (!doc) return { error: `找不到 doc_id=${docId}。用 search_workspace 查工作区里有什么。` };
  const full = String(doc.fullText || '');
  const maxChars = Math.max(500, Math.min(60000, Number(sel.maxChars) || 8000));
  const provenance = {
    type: doc.provenanceType,
    trustClass: doc.trustClass,
    sourceEntryId: doc.sourceEntryId || '',
    contentHash: doc.contentHash || '',
    capturedAt: doc.capturedAt || 0,
    citationEligible: isCitationEligibleArtifact(doc),
  };

  if (sel.chunk !== undefined && sel.chunk !== null && sel.chunk !== '') {
    const ord = Number(String(sel.chunk).replace(/^c/i, ''));
    if (!Number.isFinite(ord)) return { error: 'chunk 需要序号（0 起），如 chunk=3 或 chunk="c3"。' };
    const t = await tx(STORE_CHUNKS);
    const rec = await req2promise(t.stores[STORE_CHUNKS].get(`${doc.docId}#${ord}`));
    if (!rec) return { error: `doc ${docId} 没有第 ${ord} 块（共 ${doc.chunkCount || 0} 块）。` };
    return {
      doc_id: doc.docId, title: doc.title, url: doc.url, anchor: `${doc.docId}#c${ord}`,
      heading: rec.heading || '', text: rec.text, chars: rec.text.length,
      chunk: ord, chunk_count: doc.chunkCount || 0, outline: doc.outline || [],
      provenance,
    };
  }

  if (sel.page !== undefined && sel.page !== null && sel.page !== '') {
    const p = Number(sel.page);
    const offs = doc.pageOffsets;
    if (!Array.isArray(offs) || !offs.length) return { error: `doc ${docId} 没有页偏移（非 PDF 或未记录）。改用 offset 或 chunk。` };
    const hit = offs.find((o) => Number(o.page) === p);
    if (!hit) return { error: `页码 ${p} 超范围（1-${offs.length}）。` };
    const pageText = full.slice(hit.start, hit.end);
    const text = pageText.slice(0, maxChars);
    const next = hit.start + text.length;
    const hasMore = next < hit.end;
    return {
      doc_id: doc.docId, title: doc.title, url: doc.url, anchor: `${doc.docId}#p${p}`,
      text, chars: text.length, page: p, pages: doc.pages || offs.length,
      offset: hit.start, total: full.length,
      has_more: hasMore, next_offset: hasMore ? next : null,
      provenance,
    };
  }

  const off = Math.max(0, Math.floor(Number(sel.offset) || 0));
  const slice = full.slice(off, off + maxChars);
  const next = off + slice.length;
  const hasMore = next < full.length;
  return {
    doc_id: doc.docId, title: doc.title, url: doc.url, anchor: `${doc.docId}#o${off}`,
    text: slice, chars: slice.length, offset: off, total: full.length,
    has_more: hasMore, next_offset: hasMore ? next : null,
    outline: doc.outline || [], provenance,
  };
}

function snippetAt(text, idx, len = 200) {
  const start = Math.max(0, idx - 60);
  const s = text.slice(start, start + len).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '…' : '') + s + (start + len < text.length ? '…' : '');
}

/**
 * 关键词检索（v1 全扫 chunks）。query 为空 = 列出工作区文档。
 * @returns {Promise<{query, hits, scanned, total}>}
 */
export async function searchArtifacts(query, { docId = '', limit = 8, projectId = '' } = {}) {
  const q = String(query || '').trim();
  const max = Math.max(1, Math.min(30, Number(limit) || 8));
  const pid = projectId ? String(projectId) : '';
  if (!q) {
    const docs = await listArtifacts({ limit: max, projectId: pid });
    return { query: '', hits: docs.map((d) => ({ doc_id: d.doc_id, anchor: d.doc_id, title: d.title, url: d.url, heading: '', snippet: `${d.chars} 字符 / ${d.chunks} 块${d.partial ? '（部分）' : ''}`, score: 0 })), total: docs.length };
  }
  const needle = q.toLowerCase();
  const t = await tx(STORE_CHUNKS);
  const chunks = docId
    ? await req2promise(t.stores[STORE_CHUNKS].index('docId').getAll(String(docId)))
    : await req2promise(t.stores[STORE_CHUNKS].getAll());
  const titles = new Map();
  const hits = [];
  let scanned = 0;
  for (const c of chunks) {
    if (pid) {
      if (!titles.has(c.docId)) {
        const d = await getArtifact(c.docId);
        titles.set(c.docId, d || {});
      }
      const doc = titles.get(c.docId) || {};
      if (String(doc.projectId || 'default') !== pid) continue;
    }
    scanned += 1;
    const text = String(c.text || '');
    const low = text.toLowerCase();
    let idx = low.indexOf(needle);
    if (idx < 0) continue;
    let score = 0;
    let first = idx;
    while (idx >= 0) { score += 1; idx = low.indexOf(needle, idx + needle.length); }
    if (String(c.heading || '').toLowerCase().includes(needle)) score += 3;
    hits.push({ chunk: c, score, first });
  }
  hits.sort((a, b) => b.score - a.score || a.chunk.ord - b.chunk.ord);
  const top = hits.slice(0, max);
  for (const h of top) {
    if (!titles.has(h.chunk.docId)) {
      const d = await getArtifact(h.chunk.docId);
      titles.set(h.chunk.docId, d || {});
    }
  }
  return {
    query: q,
    hits: top.map((h) => ({
      doc_id: h.chunk.docId,
      anchor: `${h.chunk.docId}#c${h.chunk.ord}`,
      title: (titles.get(h.chunk.docId) || {}).title || '',
      url: (titles.get(h.chunk.docId) || {}).url || '',
      heading: h.chunk.heading || '',
      snippet: snippetAt(h.chunk.text, h.first),
      score: h.score,
    })),
    scanned,
    total: hits.length,
  };
}

export async function deleteArtifact(docId) {
  const id = String(docId || '');
  if (!id) return { ok: false, error: '需要 doc_id' };
  const t = await tx([STORE_DOCS, STORE_CHUNKS], 'readwrite');
  const keys = await req2promise(t.stores[STORE_CHUNKS].index('docId').getAllKeys(id));
  for (const k of keys) t.stores[STORE_CHUNKS].delete(k);
  t.stores[STORE_DOCS].delete(id);
  await t.done;
  return { ok: true, removed_chunks: keys.length };
}

/** 按 docId、URL 或来源 Entry 级联删除证据快照。 */
export async function deleteArtifactsMatching({
  projectId = '', url = '', docId = '', sourceEntryId = '',
} = {}) {
  const pid = projectId ? String(projectId) : '';
  const wantUrl = String(url || '');
  const wantDoc = String(docId || '');
  const wantEntry = String(sourceEntryId || '');
  if (!wantUrl && !wantDoc && !wantEntry) return { ok: true, removed: 0 };
  const t = await tx(STORE_DOCS);
  const seen = new Set();
  const hits = [];
  if (wantDoc) {
    const d = await req2promise(t.stores[STORE_DOCS].get(wantDoc));
    if (d) { seen.add(d.docId); hits.push(d); }
  }
  if (wantUrl) {
    const byUrl = await req2promise(t.stores[STORE_DOCS].index('url').getAll(wantUrl));
    for (const d of byUrl) {
      if (seen.has(d.docId)) continue;
      seen.add(d.docId);
      hits.push(d);
    }
  }
  if (wantEntry) {
    const byEntry = await req2promise(t.stores[STORE_DOCS].index('sourceEntryId').getAll(wantEntry));
    for (const d of byEntry) {
      if (seen.has(d.docId)) continue;
      seen.add(d.docId);
      hits.push(d);
    }
  }
  const mine = hits.filter((d) => !pid || String(d.projectId || 'default') === pid);
  for (const d of mine) await deleteArtifact(d.docId);
  return { ok: true, removed: mine.length };
}

export async function clearArtifacts() {
  const t = await tx([STORE_DOCS, STORE_CHUNKS], 'readwrite');
  t.stores[STORE_DOCS].clear();
  t.stores[STORE_CHUNKS].clear();
  await t.done;
  return { ok: true };
}

/** 某项目的全部来源快照（含正文与元数据，供删库前留撤销快照）。 */
export async function dumpArtifacts({ projectId = '' } = {}) {
  const pid = String(projectId || 'default');
  const t = await tx(STORE_DOCS);
  const all = await req2promise(t.stores[STORE_DOCS].getAll());
  return all.filter((d) => String(d.projectId || 'default') === pid);
}

/** 删库级联：清掉某项目的全部来源快照（docs + chunks，同一事务）。 */
export async function deleteArtifactsByProject(projectId = '') {
  const docs = await dumpArtifacts({ projectId });
  if (!docs.length) return 0;
  const t = await tx([STORE_DOCS, STORE_CHUNKS], 'readwrite');
  for (const d of docs) {
    t.stores[STORE_DOCS].delete(d.docId);
    const keys = await req2promise(t.stores[STORE_CHUNKS].index('docId').getAllKeys(d.docId));
    for (const k of keys) t.stores[STORE_CHUNKS].delete(k);
  }
  await t.done;
  return docs.length;
}

/** v2 懒迁移：给存量证据补 provenance 与正文 hash；docId/chunks 保持不变。 */
export async function migrateArtifactProvenance() {
  const read = await tx(STORE_DOCS);
  const all = await req2promise(read.stores[STORE_DOCS].getAll());
  const pending = [];
  for (const raw of all) {
    const doc = hydrateArtifactRecord(raw);
    if (raw.contentHash && raw.provenanceType && raw.trustClass && raw.capturedAt) continue;
    pending.push({
      ...doc,
      contentHash: raw.contentHash || await sha256Hex(String(raw.fullText || '')),
      capturedAt: Number(raw.capturedAt || raw.createdAt) || Date.now(),
    });
  }
  if (!pending.length) return { updated: 0 };
  const write = await tx(STORE_DOCS, 'readwrite');
  for (const doc of pending) write.stores[STORE_DOCS].put(doc);
  await write.done;
  return { updated: pending.length };
}
