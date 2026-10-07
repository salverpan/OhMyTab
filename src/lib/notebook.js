/**
 * 调研笔记本（事实库）—— 跨轮存活的主张 + 出处。
 *
 * 与「证据库」（artifact-store 的原文）分开：这里只放结论，原文永远按 doc_id 回读。
 * 后续问题先查笔记本，只有缺口或矛盾时才回证据库抽原文——调研规模因此从
 * 「token 线性涨」变成「结论近似常数，证据按需展开」。
 *
 * 存储：`chrome.storage.local` 的 `notebook_{projectId}`（与 entries / annotations 同款）。
 * 每条：{ id, claim, confidence, status, sources[], tags[], createdAt, updatedAt,
 *         kind?, verifyAt?, threadId?, supersedes?, supersededBy?, history[] }
 *   confidence: high | medium | low
 *   status:     open（待核实）| verified | refuted | dropped
 *   sources:    每条结论必须带出处（引用强制在工具层拦截空数组）
 *   追踪字段（任务时间线用，只追加不改写）：
 *     kind        observation（观察）| judgment（判断，默认）
 *     verifyAt    预计验证时刻（ms）
 *     threadId    所属追踪主题（心跳任务 id）
 *     supersedes  本条修正的旧笔记 id；旧笔记同步写 supersededBy，open 的旧笔记自动转 refuted
 *     history     状态变更流水 {ts, from, to, reason}，最多 MAX_HISTORY 条
 */

import { getArtifact } from './artifact-store.js';
import { logActivity } from './activity-log.js';
import { isCitationEligibleArtifact } from './source-model.js';

const MAX_NOTES = 200;
const DIGEST_MAX_CHARS = 1600;

const CONFIDENCE = ['high', 'medium', 'low'];
const STATUS = ['open', 'verified', 'refuted', 'dropped'];
const KIND = ['observation', 'judgment'];
const MAX_HISTORY = 30;

const key = (pid) => `notebook_${pid || 'default'}`;

function logNoteActivity(pid, action, label, claim, reason) {
  logActivity({
    projectId: pid || 'default',
    actor: 'system',
    cat: 'note',
    action,
    label,
    detail: reason ? `${claim} — ${reason}` : claim,
    status: 'ok',
  });
}

let writeChain = Promise.resolve();
function enqueue(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function normalizeConfidence(v) {
  const s = String(v || '').toLowerCase();
  return CONFIDENCE.includes(s) ? s : 'medium';
}

export function normalizeStatus(v) {
  const s = String(v || '').toLowerCase();
  return STATUS.includes(s) ? s : 'open';
}

/** 出处归一化：URL / doc_id#锚点 / doc_id / 纯描述 都收。 */
export function normalizeSource(src) {
  if (src && typeof src === 'object') {
    return {
      doc_id: String(src.doc_id || src.docId || ''),
      anchor: String(src.anchor || ''),
      url: String(src.url || ''),
      note: String(src.note || ''),
    };
  }
  const s = String(src || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return { doc_id: '', anchor: '', url: s, note: '' };
  const hash = s.indexOf('#');
  if (hash > 0) return { doc_id: s.slice(0, hash), anchor: s.slice(hash + 1), url: '', note: '' };
  if (s.startsWith('doc_')) return { doc_id: s, anchor: '', url: '', note: '' };
  return { doc_id: '', anchor: '', url: '', note: s };
}

export function formatSource(src) {
  if (!src) return '';
  if (src.doc_id) return `${src.doc_id}${src.anchor ? `#${src.anchor}` : ''}`;
  if (src.url) return src.url;
  return src.note || '';
}

export async function canVerifySources(pid, sources) {
  const list = (sources || []).filter(Boolean);
  if (!list.length || list.some((s) => !s.doc_id || !s.anchor)) return false;
  for (const source of list) {
    const doc = await getArtifact(source.doc_id).catch(() => null);
    if (!doc || String(doc.projectId || 'default') !== String(pid || 'default') || !isCitationEligibleArtifact(doc)) {
      return false;
    }
  }
  return true;
}

export async function listNotes(pid) {
  try {
    const k = key(pid);
    const { [k]: arr } = await chrome.storage.local.get(k);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

async function saveNotes(pid, notes) {
  const k = key(pid);
  await chrome.storage.local.set({ [k]: capNotes(notes) });
}

/** 超限时先丢最老的追踪观测（高频、可再生），再按老规矩截尾，避免长期心跳把判断挤出去。 */
export function capNotes(notes, max = MAX_NOTES) {
  if (notes.length <= max) return notes;
  let excess = notes.length - max;
  const drop = new Set();
  for (let i = notes.length - 1; i >= 0 && excess > 0; i--) {
    if (notes[i].kind === 'observation' && notes[i].threadId) {
      drop.add(i);
      excess -= 1;
    }
  }
  const kept = notes.filter((_, i) => !drop.has(i));
  return kept.slice(0, max);
}

export function normalizeKind(v) {
  const s = String(v || '').toLowerCase();
  return KIND.includes(s) ? s : 'judgment';
}

/** 接受毫秒数 / 数字字符串 / ISO 日期；无法解析返回 null。 */
export function normalizeVerifyAt(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const s = String(v).trim();
  if (/^\d{10,}$/.test(s)) return Number(s);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function pushHistory(note, to, reason, ts) {
  const history = Array.isArray(note.history) ? note.history : [];
  history.push({ ts, from: note.status ?? null, to, reason: String(reason || '').trim().slice(0, 300) });
  note.history = history.slice(-MAX_HISTORY);
}

function setStatus(note, to, reason, ts) {
  if (note.status === to) return;
  pushHistory(note, to, reason, ts);
  note.status = to;
}

export function addNote(pid, {
  claim, sources, confidence, status, tags, kind, verifyAt, supersedes, threadId, reason,
} = {}) {
  return enqueue(async () => {
    const text = String(claim || '').trim();
    if (!text) return { error: 'claim 不能为空。' };
    const srcs = (Array.isArray(sources) ? sources : [sources]).map(normalizeSource).filter(Boolean);
    if (!srcs.length) {
      return { error: '引用强制：sources 不能为空。填 doc_id（可带 #锚点）或 URL；没有出处就写清「无来源」并降置信度。' };
    }
    const notes = await listNotes(pid);
    const now = Date.now();
    const prevId = String(supersedes || '').trim();
    const prev = prevId ? notes.find((n) => n.id === prevId) : null;
    if (prevId && !prev) return { error: `supersedes 指向的笔记 ${prevId} 不存在。` };

    const tracked = !!(String(threadId || '').trim() || (prev && prev.threadId));
    const requestedStatus = normalizeStatus(status);
    // 追踪笔记新建时不可能已被后续事实证实；直接 verified 一律按待核实入账。
    const finalStatus = requestedStatus === 'verified'
      && (tracked || !await canVerifySources(pid, srcs))
      ? 'open'
      : requestedStatus;

    const note = {
      id: `nb_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      claim: text,
      confidence: normalizeConfidence(confidence),
      status: finalStatus,
      kind: normalizeKind(kind),
      sources: srcs,
      tags: (Array.isArray(tags) ? tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 5),
      createdAt: now,
      updatedAt: now,
      history: [{ ts: now, from: null, to: finalStatus, reason: '' }],
    };
    const due = normalizeVerifyAt(verifyAt);
    if (due) note.verifyAt = due;
    const thread = String(threadId || '').trim();
    if (thread) note.threadId = thread;
    else if (prev && prev.threadId) note.threadId = prev.threadId;

    if (prev) {
      note.supersedes = prev.id;
      prev.supersededBy = note.id;
      prev.updatedAt = now;
      if (prev.status === 'open') {
        setStatus(prev, 'refuted', reason || '被新判断修正', now);
      } else if (reason) {
        pushHistory(prev, prev.status, reason, now);
      }
    }

    notes.unshift(note);
    await saveNotes(pid, notes);
    logNoteActivity(pid, 'note.add', note.kind === 'observation' ? '记录观测' : (prev ? '修正判断' : '新增笔记'), note.claim);
    return { ok: true, note, count: Math.min(notes.length, MAX_NOTES) };
  });
}

export function updateNote(pid, id, patch = {}) {
  return enqueue(async () => {
    const notes = await listNotes(pid);
    const idx = notes.findIndex((n) => n.id === String(id || ''));
    if (idx < 0) return { error: `找不到笔记本条目 ${id}。` };
    const cur = notes[idx];
    const now = Date.now();
    const next = { ...cur, updatedAt: now };
    if (Array.isArray(cur.history)) next.history = cur.history.slice();
    if (patch.claim !== undefined) next.claim = String(patch.claim).trim() || cur.claim;
    if (patch.confidence !== undefined) next.confidence = normalizeConfidence(patch.confidence);
    if (patch.status !== undefined) setStatus(next, normalizeStatus(patch.status), patch.reason, now);
    if (patch.kind !== undefined) next.kind = normalizeKind(patch.kind);
    if (patch.verifyAt !== undefined) {
      const due = normalizeVerifyAt(patch.verifyAt);
      if (due) next.verifyAt = due;
      else delete next.verifyAt;
    }
    if (patch.threadId !== undefined) {
      const thread = String(patch.threadId || '').trim();
      if (thread) next.threadId = thread;
      else delete next.threadId;
    }
    if (patch.tags !== undefined) next.tags = (Array.isArray(patch.tags) ? patch.tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 5);
    if (patch.sources !== undefined) {
      const srcs = (Array.isArray(patch.sources) ? patch.sources : [patch.sources]).map(normalizeSource).filter(Boolean);
      if (!srcs.length) return { error: '引用强制：sources 不能清空。' };
      next.sources = srcs;
    }
    if (next.threadId) {
      // 追踪判断由后续观测核实，证据是 reason 里引用的新事实，不要求 doc_id#anchor。
      if (next.status === 'verified' && cur.status !== 'verified' && !String(patch.reason || '').trim()) {
        return { error: '追踪中的判断标记 verified 需要 reason：写清哪条新事实证实了它。' };
      }
    } else if (next.status === 'verified' && !await canVerifySources(pid, next.sources)) {
      return { error: '只有全部引用都含合格 doc_id#anchor 的笔记才能标记为 verified。' };
    }
    notes[idx] = next;
    await saveNotes(pid, notes);
    if (next.status !== cur.status) {
      logNoteActivity(pid, 'note.status', `笔记${STATUS_LABEL[next.status] || next.status}`, next.claim, patch.reason);
    }
    return { ok: true, note: next };
  });
}

export function removeNote(pid, id) {
  return enqueue(async () => {
    const notes = await listNotes(pid);
    const removed = notes.find((n) => n.id === String(id || ''));
    const next = notes.filter((n) => n.id !== String(id || ''));
    if (removed) logNoteActivity(pid, 'note.remove', '删除笔记', removed.claim);
    if (next.length === notes.length) return { error: `找不到笔记本条目 ${id}。` };
    await saveNotes(pid, next);
    return { ok: true, count: next.length };
  });
}

export function clearNotes(pid) {
  return enqueue(async () => {
    const previous = await listNotes(pid);
    await saveNotes(pid, []);
    return { ok: true, removed: previous.length };
  });
}

export function revalidateNotes(pid) {
  return enqueue(async () => {
    const notes = await listNotes(pid);
    let updated = 0;
    const next = [];
    for (const note of notes) {
      if (note.status === 'verified' && !await canVerifySources(pid, note.sources)) {
        const now = Date.now();
        const reopened = { ...note, history: Array.isArray(note.history) ? note.history.slice() : [], updatedAt: now };
        setStatus(reopened, 'open', '出处失效，退回待核实', now);
        next.push(reopened);
        updated += 1;
      } else {
        next.push(note);
      }
    }
    if (updated) await saveNotes(pid, next);
    return { ok: true, updated };
  });
}

const CONF_LABEL = { high: '高', medium: '中', low: '低' };
const STATUS_LABEL = { open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用' };

export function formatNoteLine(n) {
  const src = (n.sources || []).map(formatSource).filter(Boolean).join('、');
  return `- [${STATUS_LABEL[n.status] || n.status}|${CONF_LABEL[n.confidence] || n.confidence}] ${n.claim}${src ? ` —— ${src}` : ''}`;
}

/** 注入主助手动态前言的紧凑摘要（超长截断并指向 notebook(list)）。 */
export function formatNotebookDigest(notes, { maxChars = DIGEST_MAX_CHARS } = {}) {
  const list = Array.isArray(notes) ? notes : [];
  if (!list.length) return '';
  const openCount = list.filter((n) => n.status === 'open').length;
  const head = `## 调研笔记本（${list.length} 条，待核实 ${openCount} 条）`;
  const lines = [];
  let used = head.length;
  for (const n of list) {
    const line = formatNoteLine(n);
    if (used + line.length > maxChars) {
      lines.push(`- …还有 ${list.length - lines.length} 条，用 notebook(action="list") 查看全部`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return `${head}\n${lines.join('\n')}`;
}

export { CONFIDENCE, STATUS, KIND, MAX_NOTES, MAX_HISTORY };
