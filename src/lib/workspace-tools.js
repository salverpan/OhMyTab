/**
 * 工作区工具处理器 —— ingest / read_section / search_workspace / notebook。
 *
 * 与 artifact-store（纯存储）、notebook（纯事实库）分开：这里只做「工具参数 → 存储调用」
 * 的编排，便于 chat-executor 的 switch 保持一行调用，也便于冒烟测试直接 import。
 */

import { buildPageData } from './page-data.js';
import {
  putArtifact, getArtifact, listArtifacts,
  readSection, searchArtifacts, deleteArtifact, clearArtifacts,
} from './artifact-store.js';
import {
  listNotes, addNote, updateNote, removeNote, formatNoteLine,
} from './notebook.js';
import { inferEntryType, isCitationEligibleArtifact } from './source-model.js';
import { EXEC_OUTPUT_CAP_CHARS } from './limits.js';

/** 太短的页面不值得占工作区（正文量级判断，非截断）。 */
const MIN_INGEST_CHARS = 1200;

function brief(a) {
  return JSON.stringify(a);
}

/**
 * 来源库哲学：不是「读过就入库」，而是「值得反复用才入库」。
 *
 * 进来源：
 *   - 用户主动投入（上传 / 采集 / 划词 / 显式 ingest）
 *   - 深度任务：子代理（explore / general / browser / 自定义）读到的网页
 * 不进来源：
 *   - 主对话随口问答、读当前页、单次事实核查
 *
 * via=auto-read 是读页顺带落下的缓存；via=ingest 是主动投入。
 * 存量记录没有 via：子代理 origin 留下，主代理随口读过的 page 视为草稿、不进来源树。
 */
export function shouldAutoIngestRead(ctx) {
  return !!(ctx && String(ctx.subagentKind || '').trim());
}

export function isMaterialArtifact(doc) {
  if (!doc) return false;
  const origin = String(doc.origin || '');
  const via = String(doc.via || '');
  if (!isCitationEligibleArtifact(doc)) return false;
  if (doc.kind === 'entry' || via === 'ingest') return true;
  if (via === 'auto-read') return origin !== '' && origin !== 'main';
  return origin !== '' && origin !== 'main';
}

const SPILL_PREVIEW_CHARS = 800;

/**
 * 超长工具输出：全文进工作区，模型只拿编号。失败则退回全文，不静默 slice。
 * 默认按衍生材料入库（不可引用）；网站原始数据（网络抓包）传 kind='page' +
 * trustClass='source' 覆盖，使其可进证据链。
 * @returns {Promise<string>}
 */
export async function spillOversizedOutput(text, ctx, {
  title = '工具输出', url = '', kind = 'text', provenanceType = '', trustClass = 'derived',
} = {}) {
  const raw = String(text ?? '');
  if (raw.length <= EXEC_OUTPUT_CAP_CHARS) return raw;
  try {
    const res = await putArtifact({
      kind: String(kind || 'text'),
      url: String(url || ''),
      title: String(title || '工具输出').slice(0, 80),
      text: raw,
      meta: {
        via: 'overflow',
        origin: (ctx && ctx.subagentKind) || 'main',
        projectId: (ctx && ctx.projectId) || '',
        provenanceType: String(provenanceType || (String(kind) === 'page' ? 'web' : 'derived')),
        trustClass: String(trustClass || 'derived'),
      },
    });
    if (res && res.docId) {
      return JSON.stringify({
        spilled: true,
        doc_id: res.docId,
        title: String(title || '工具输出').slice(0, 80),
        chars: res.chars,
        chunks: res.chunks,
        preview: raw.slice(0, SPILL_PREVIEW_CHARS),
        hint: '完整输出已写入工作区。用 read_section(doc_id) 续拉，不要凭预览补全。',
      });
    }
  } catch (err) {
    console.warn('[OhMyTab] spill oversized output failed:', err);
  }
  return raw;
}

/** 读页结果 → artifact（在 chat-executor 的 read_* 分支里调用）。 */
export async function autoIngestRead(payload, ctx, { offset = 0 } = {}) {
  try {
    if (!shouldAutoIngestRead(ctx)) return null;
    if (!payload || payload.error || !payload.url) return null;
    // 只在首读（offset=0）落库：续拉切片会把完整正文覆盖成半截
    if (Number(offset) > 0) return null;
    const data = payload.data || {};
    const text = typeof data.content === 'string' ? data.content : '';
    if (text.length < MIN_INGEST_CHARS) return null;
    const partial = !!data.content_has_more;
    const res = await putArtifact({
      kind: 'page',
      url: payload.url,
      title: payload.title || '',
      text,
      meta: {
        via: 'auto-read',
        partial,
        charsTotal: Number(data.content_total) || text.length,
        origin: (ctx && ctx.subagentKind) || 'main',
        projectId: (ctx && ctx.projectId) || '',
        provenanceType: 'web',
        trustClass: 'source',
        capturedAt: Date.now(),
        pages: Number(payload.pageCount) || 0,
        // 分页切片时正文只是首段，而页偏移是按全文算的——两者对不上就不能挂，
        // 否则 read_section(page=N) 会切出错位的内容。
        pageOffsets: (!partial && Array.isArray(payload.pageOffsets)) ? payload.pageOffsets : null,
      },
    });
    if (!res || !res.docId) return null;
    return { doc_id: res.docId, chars: res.chars, partial, reused: !!res.reused };
  } catch (_) {
    return null; // 落库失败不影响读取本身
  }
}

function ingestMeta(ctx, extra = {}) {
  return {
    via: 'ingest',
    origin: (ctx && ctx.subagentKind) || 'main',
    projectId: (ctx && ctx.projectId) || '',
    ...extra,
  };
}

/**
 * ingest：把「已经在库里的来源」变成可寻址 artifact。
 * 网页正文只在深度任务（子代理 read_*）时自动落库；主对话随口读页不会。
 * 本工具覆盖：
 *   1) 来源条目（含 PDF / docx 提取出的全文）
 *   2) 指定标签页（主对话需要反复回读时主动调用）
 */
export async function ingestTool(args = {}, ctx = {}) {
  const source = String(args.source || '').trim();
  if (!source) return brief({ error: 'ingest 需要 source（来源条目 id 或标签页 id）。任意文本不能作为可核验证据入库。' });

  // 1) 来源条目
  const entry = (ctx.entries || []).find((e) => e.id === source);
  if (entry) {
    if (inferEntryType(entry) === 'output') {
      return brief({ error: 'AI 产出不能重新 ingest 为来源；请引用它所使用的原始来源。' });
    }
    const res = await putArtifact({
      kind: 'entry',
      url: entry.url || '',
      title: entry.aiTitle || entry.originalTitle || '',
      text: entry.fullText || '',
      meta: ingestMeta(ctx, {
        site: entry.source || '',
        sourceEntryId: entry.id,
        provenanceType: entry.provenance?.type || 'entry',
        trustClass: entry.provenance?.trustClass || 'source',
        capturedAt: entry.provenance?.capturedAt || entry.createdAt || Date.now(),
        pages: entry.pageCount || 0,
        pageOffsets: entry.pageOffsets || null,
      }),
    });
    if (!res || !res.docId) return brief({ error: res && res.error ? res.error : '该条目没有正文，无法入工作区。' });
    return brief({ doc_id: res.docId, title: entry.aiTitle || entry.originalTitle || '', chars: res.chars, chunks: res.chunks, reused: res.reused });
  }

  // 2) 标签页 id
  if (/^\d+$/.test(source)) {
    const tabId = Number(source);
    const payload = await buildPageData(tabId, { format: 'auto' });
    if (payload.error) return brief({ error: payload.error });
    const text = (payload.data && payload.data.content) || '';
    if (text.length < 200) return brief({ error: '该页没有可入库的正文（可能是列表/仪表盘页）。' });
    const partial = !!(payload.data && payload.data.content_has_more);
    const res = await putArtifact({
      kind: 'page',
      url: payload.url,
      title: payload.title || '',
      text,
      meta: ingestMeta(ctx, {
        partial,
        charsTotal: Number(payload.data && payload.data.content_total) || text.length,
        provenanceType: 'web',
        trustClass: 'source',
        capturedAt: Date.now(),
        pages: Number(payload.pageCount) || 0,
        pageOffsets: (!partial && Array.isArray(payload.pageOffsets)) ? payload.pageOffsets : null,
      }),
    });
    if (!res || !res.docId) return brief({ error: res && res.error ? res.error : '入库失败。' });
    return brief({ doc_id: res.docId, title: payload.title || '', chars: res.chars, chunks: res.chunks, reused: res.reused });
  }

  return brief({ error: `找不到来源条目或标签页 ${source}。任意文本不能作为可核验证据入库。` });
}

export async function readSectionTool(args = {}, ctx = {}) {
  const docId = String(args.doc_id || '').trim();
  if (!docId) return brief({ error: 'read_section 需要 doc_id（从 ingest / read_* 结果或 search_workspace 拿）。' });
  const doc = await getArtifact(docId);
  const pid = String(ctx.projectId || 'default');
  if (!doc || String(doc.projectId || 'default') !== pid) {
    return brief({ error: `当前项目找不到 doc_id=${docId}。用 search_workspace 查本项目工作区。` });
  }
  const res = await readSection(docId, {
    chunk: args.chunk,
    page: args.page,
    offset: args.offset,
    maxChars: args.max_chars,
  });
  return brief(res);
}

export async function searchWorkspaceTool(args = {}, ctx = {}) {
  const query = String(args.query || '').trim();
  const docId = String(args.doc_id || '').trim();
  const limit = Number(args.limit) || 8;
  const projectId = (ctx && ctx.projectId) || '';
  if (!query && !docId) {
    const listed = await listArtifacts({ limit: 80, projectId }).catch(() => []);
    const materials = listed.filter(isMaterialArtifact).slice(0, limit);
    return brief({
      query: '',
      hits: materials.map((d) => ({
        doc_id: d.doc_id, anchor: d.doc_id, title: d.title, url: d.url,
        heading: '', snippet: `${d.chars} 字符 / ${d.chunks} 块${d.partial ? '（部分）' : ''}`, score: 0,
      })),
      total: materials.length,
    });
  }
  const res = await searchArtifacts(query, { docId, limit, projectId });
  const hits = [];
  for (const h of res.hits || []) {
    const doc = await getArtifact(h.doc_id).catch(() => null);
    if (isMaterialArtifact(doc || h)) hits.push(h);
  }
  const next = { ...res, hits, total: hits.length };
  if (query && !hits.length) {
    const listed = await listArtifacts({ limit: 200, projectId }).catch(() => []);
    const total = listed.filter(isMaterialArtifact).length;
    return brief({ ...next, hint: total ? `本项目来源有 ${total} 篇，但没有命中「${query}」。可换关键词，或对需要反复回读的来源用 ingest。` : '本项目来源还是空的：深度调研（Sub）读到的网页会自动进入；随口问答不会。需要留下的页面用 ingest。' });
  }
  return brief(next);
}

const NOTEBOOK_HELP = 'notebook 需要 action：add / list / update / remove。';

export async function notebookTool(args = {}, ctx = {}) {
  const action = String(args.action || '').trim().toLowerCase();
  const pid = ctx.projectId || 'default';
  const activeThread = () => {
    try {
      return typeof ctx.getActiveHeartbeatTaskId === 'function'
        ? String(ctx.getActiveHeartbeatTaskId() || '')
        : '';
    } catch (_) {
      return '';
    }
  };

  if (action === 'add') {
    const res = await addNote(pid, {
      claim: args.claim,
      sources: args.sources,
      confidence: args.confidence,
      status: args.status,
      tags: args.tags,
      kind: args.kind,
      verifyAt: args.verify_at,
      supersedes: args.supersedes,
      threadId: args.thread_id || activeThread(),
      reason: args.reason,
    });
    if (res.error) return brief(res);
    return brief({ ok: true, id: res.note.id, count: res.count, thread: res.note.threadId || undefined });
  }

  if (action === 'list') {
    const notes = await listNotes(pid);
    if (!notes.length) return brief({ count: 0, notes: [], hint: '笔记本还是空的。调研有结论后用 notebook(add) 记下来，带出处。' });
    const statusFilter = String(args.status || '').trim().toLowerCase();
    const threadFilter = String(args.thread_id || '').trim();
    const filtered = notes.filter((n) => (!statusFilter || n.status === statusFilter)
      && (!threadFilter || n.threadId === threadFilter));
    return JSON.stringify({
      count: filtered.length,
      notes: filtered.map((n) => ({
        id: n.id, claim: n.claim, confidence: n.confidence, status: n.status,
        sources: (n.sources || []).map((s) => (s.doc_id ? `${s.doc_id}${s.anchor ? `#${s.anchor}` : ''}` : (s.url || s.note))),
        updatedAt: n.updatedAt,
        ...(n.threadId ? { thread_id: n.threadId } : {}),
        ...(n.kind && n.threadId ? { kind: n.kind } : {}),
        ...(n.verifyAt ? { verify_at: new Date(n.verifyAt).toISOString() } : {}),
        ...(n.supersededBy ? { superseded_by: n.supersededBy } : {}),
      })),
    }, null, 0);
  }

  if (action === 'update') {
    const res = await updateNote(pid, args.id, {
      claim: args.claim, confidence: args.confidence, status: args.status,
      sources: args.sources, tags: args.tags,
      kind: args.kind, verifyAt: args.verify_at, reason: args.reason,
    });
    if (res.error) return brief(res);
    return brief({ ok: true, id: res.note.id, status: res.note.status, confidence: res.note.confidence });
  }

  if (action === 'remove') {
    const res = await removeNote(pid, args.id);
    return brief(res.error ? res : { ok: true, count: res.count });
  }

  return brief({ error: NOTEBOOK_HELP });
}

export { formatNoteLine, listArtifacts, listNotes, deleteArtifact, clearArtifacts };
