/**
 * 任务追踪思维导图的数据模型（纯函数，无 DOM / React / chrome）。
 *
 * 输入：
 *   nodes   trace-log 里的内容节点（turn / agent / subagent / claim / unresolved / action）
 *   notes   笔记本条目（判断 judgment / 观测 observation，带 supersedes 链与 history）
 *   tasks   心跳任务（给线程起名）
 * 输出：扁平的 nodes[] + edges[]，供渲染层（React Flow）与布局（dagre）使用。
 *
 * 结构：root(项目) -> thread(对话 / 每个心跳任务) -> turn -> agent | subagent -> claim ...
 * 判断 / 观测按 createdAt 落入所属线程里“最近一次开始的回合”下；
 * 判断被修正（supersedes）用一条独立的 revise 边（旧 -> 新），不参与树布局。
 */

export const ROOT_ID = 'root';
export const CHAT_THREAD_ID = 'chat';
export const DEFAULT_RECENT_TURNS = 5;
/** 判断 / 观测在回合结束多久之内仍算该回合产生的 */
export const NOTE_GRACE_MS = 60 * 1000;

function ms(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

const threadNodeId = (threadId) => `thread:${threadId}`;
const noteNodeId = (noteId) => `note:${noteId}`;

function makeNode(fields) {
  return {
    subtype: '', title: '', text: '', status: '', ts: 0, endedAt: 0, refs: {}, meta: {},
    ...fields,
  };
}

function noteToNode(note, now) {
  const observation = note.kind === 'observation';
  const history = (Array.isArray(note.history) ? note.history : [])
    .filter((h) => h && h.from != null)
    .map((h) => ({ ts: ms(h.ts), from: h.from, to: h.to, reason: h.reason || '' }));
  const lastReason = history.length ? history[history.length - 1].reason : '';
  const verifyAt = ms(note.verifyAt);
  return makeNode({
    id: noteNodeId(note.id),
    kind: observation ? 'observation' : 'judgment',
    subtype: note.confidence || '',
    title: note.claim || '',
    text: lastReason,
    status: note.status || 'open',
    ts: ms(note.createdAt),
    refs: { noteId: note.id },
    meta: {
      noteId: note.id,
      supersedes: note.supersedes || '',
      supersededBy: note.supersededBy || '',
      confidence: note.confidence || '',
      verifyAt: verifyAt || null,
      overdue: note.status === 'open' && verifyAt > 0 && verifyAt <= now,
      history,
    },
  });
}

/** 选出判断 / 观测应挂的回合：该线程里 ts <= 创建时间的最近一个，且创建时间没超过其结束 + 宽限。 */
function pickTurnForNote(turns, createdAt) {
  let best = null;
  for (const t of turns) {
    if (t.ts <= createdAt && (!best || t.ts > best.ts)) best = t;
  }
  if (!best) return null;
  if (best.endedAt && createdAt > best.endedAt + NOTE_GRACE_MS) return null;
  return best;
}

/**
 * @param {object} input
 * @param {Array} [input.nodes]
 * @param {Array} [input.notes]
 * @param {Array} [input.tasks]
 * @param {string} [input.projectName]
 * @param {Record<string,'collapsed'|'expanded'>} [input.overrides] 用户手动折叠 / 展开
 * @param {number} [input.recentTurns] 每个线程默认展开的最近回合数
 * @param {number} [input.now]
 * @returns {{nodes: Array, edges: Array, stats: object}}
 */
export function buildTraceGraph({
  nodes = [], notes = [], tasks = [], projectName = '', overrides = {}, recentTurns = DEFAULT_RECENT_TURNS, now = Date.now(),
} = {}) {
  const taskById = new Map((tasks || []).map((t) => [t.id, t]));
  const all = new Map(); // id -> node（含 root / thread）
  const parentOf = new Map();
  const childrenOf = new Map();

  const link = (child, parent) => {
    parentOf.set(child, parent);
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(child);
  };

  all.set(ROOT_ID, makeNode({ id: ROOT_ID, kind: 'root', title: projectName || '项目' }));

  const ensureThread = (threadId) => {
    const id = threadNodeId(threadId);
    if (all.has(id)) return id;
    const isChat = threadId === CHAT_THREAD_ID;
    const task = isChat ? null : taskById.get(threadId);
    all.set(id, makeNode({
      id,
      kind: 'thread',
      subtype: isChat ? 'chat' : 'heartbeat',
      title: isChat ? '对话' : (task ? task.name : '已删除的追踪任务'),
      status: task && task.enabled === false ? 'paused' : '',
      meta: { threadId, deleted: !isChat && !task },
    }));
    link(id, ROOT_ID);
    return id;
  };

  const traceNodes = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.id);
  const traceIds = new Set(traceNodes.map((n) => n.id));
  const turnsByThread = new Map();

  for (const n of traceNodes) {
    const threadId = n.threadId || CHAT_THREAD_ID;
    all.set(n.id, makeNode({
      id: n.id,
      kind: n.kind,
      subtype: n.subtype || '',
      title: n.title || '',
      text: n.text || '',
      status: n.status || '',
      ts: ms(n.ts),
      endedAt: ms(n.endedAt),
      refs: n.refs || {},
      meta: { threadId },
    }));
    if (n.kind === 'turn') {
      if (!turnsByThread.has(threadId)) turnsByThread.set(threadId, []);
      turnsByThread.get(threadId).push(all.get(n.id));
    }
  }
  for (const n of traceNodes) {
    const threadId = n.threadId || CHAT_THREAD_ID;
    const parent = n.parentId && traceIds.has(n.parentId) && n.parentId !== n.id ? n.parentId : ensureThread(threadId);
    link(n.id, parent);
  }

  const noteList = (Array.isArray(notes) ? notes : []).filter((n) => n && n.id);
  const noteIds = new Set(noteList.map((n) => n.id));
  for (const note of noteList) {
    const threadId = note.threadId || CHAT_THREAD_ID;
    const node = noteToNode(note, now);
    if (!node.ts) continue;
    all.set(node.id, node);
    const turn = pickTurnForNote(turnsByThread.get(threadId) || [], node.ts);
    link(node.id, turn ? turn.id : ensureThread(threadId));
  }

  // 循环保护：环上的节点摘到线程根。trace 数据由多上下文写入，不假设一定无环。
  for (const id of [...parentOf.keys()]) {
    const seen = new Set([id]);
    let cur = parentOf.get(id);
    while (cur && cur !== ROOT_ID) {
      if (seen.has(cur)) {
        const threadId = (all.get(id).meta && all.get(id).meta.threadId) || CHAT_THREAD_ID;
        const old = parentOf.get(id);
        const arr = childrenOf.get(old);
        if (arr) arr.splice(arr.indexOf(id), 1);
        link(id, ensureThread(threadId));
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur);
    }
  }

  const sortKids = (id) => {
    const kids = childrenOf.get(id);
    if (kids) kids.sort((a, b) => (all.get(a).ts - all.get(b).ts) || a.localeCompare(b));
  };
  for (const id of all.keys()) sortKids(id);
  // thread 按最近活动倒序：最新的追踪在最上方。
  const lastTs = (id) => {
    let t = all.get(id).ts || 0;
    for (const k of childrenOf.get(id) || []) t = Math.max(t, lastTs(k));
    return t;
  };
  const rootKids = childrenOf.get(ROOT_ID) || [];
  const threadLast = new Map(rootKids.map((id) => [id, lastTs(id)]));
  rootKids.sort((a, b) => threadLast.get(b) - threadLast.get(a));

  // 默认折叠：每个线程只展开最近 N 个回合；用户 overrides 优先。
  const defaultCollapsed = new Set();
  for (const threadId of rootKids) {
    const turns = (childrenOf.get(threadId) || []).filter((id) => all.get(id).kind === 'turn');
    turns.sort((a, b) => all.get(b).ts - all.get(a).ts);
    for (const id of turns.slice(Math.max(1, recentTurns))) defaultCollapsed.add(id);
  }
  const isCollapsed = (id) => {
    const o = overrides && overrides[id];
    if (o === 'collapsed') return true;
    if (o === 'expanded') return false;
    return defaultCollapsed.has(id);
  };

  const descendantCount = (id) => {
    let n = 0;
    for (const k of childrenOf.get(id) || []) n += 1 + descendantCount(k);
    return n;
  };

  const outNodes = [];
  const outEdges = [];
  const visible = new Set();
  const visibleAncestor = new Map(); // 被折叠隐藏的节点 -> 最近可见祖先（给 revise 边重定向）

  const walk = (id, depth, hiddenBy) => {
    const node = all.get(id);
    const kids = childrenOf.get(id) || [];
    if (hiddenBy) {
      visibleAncestor.set(id, hiddenBy);
      for (const k of kids) walk(k, depth + 1, hiddenBy);
      return;
    }
    visible.add(id);
    const collapsed = kids.length > 0 && isCollapsed(id);
    outNodes.push({
      ...node,
      depth,
      childCount: kids.length,
      collapsible: kids.length > 0,
      collapsed,
      hiddenCount: collapsed ? descendantCount(id) : 0,
    });
    for (const k of kids) {
      if (!collapsed) {
        outEdges.push({ id: `e:${id}>${k}`, source: id, target: k, type: 'tree' });
      }
      walk(k, depth + 1, collapsed ? id : '');
    }
  };
  walk(ROOT_ID, 0, '');

  // 判断修正边：旧 -> 新。任一端被折叠时重定向到可见祖先，同一对只画一条。
  const resolveVisible = (id) => (visible.has(id) ? id : (visibleAncestor.get(id) || ''));
  const seenRevise = new Set();
  for (const note of noteList) {
    if (!note.supersedes || !noteIds.has(note.supersedes)) continue;
    const from = resolveVisible(noteNodeId(note.supersedes));
    const to = resolveVisible(noteNodeId(note.id));
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`;
    if (seenRevise.has(key)) continue;
    seenRevise.add(key);
    outEdges.push({ id: `r:${key}`, source: from, target: to, type: 'revise', label: '修正' });
  }

  const count = (kind) => outNodes.filter((n) => n.kind === kind).length;
  return {
    nodes: outNodes,
    edges: outEdges,
    stats: {
      threads: count('thread'),
      turns: count('turn'),
      subagents: count('subagent'),
      claims: count('claim'),
      judgments: count('judgment'),
      revisions: outEdges.filter((e) => e.type === 'revise').length,
      totalNodes: all.size - 1,
    },
  };
}

/**
 * “回到最新”的聚焦集合：最近活跃线程的最新回合及其整棵子树，加上通往它的 root / thread。
 * 图很大时整图适应会缩到看不清字，默认视图只框这一块。
 */
export function focusNodeIds(graph) {
  if (!graph || !graph.nodes.length) return [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const kids = new Map();
  for (const e of graph.edges) {
    if (e.type !== 'tree') continue;
    if (!kids.has(e.source)) kids.set(e.source, []);
    kids.get(e.source).push(e.target);
  }
  const ids = [ROOT_ID];
  const thread = (kids.get(ROOT_ID) || [])[0];
  if (!thread) return ids;
  ids.push(thread);
  const turns = (kids.get(thread) || []).filter((id) => byId.get(id).kind === 'turn');
  const threadKids = kids.get(thread) || [];
  let pick;
  if (turns.length) {
    const latest = turns.reduce((a, b) => (byId.get(b).ts >= byId.get(a).ts ? b : a));
    // 线程根下比最新回合还新的零散节点（手写笔记等）也算“最新”。
    pick = [latest, ...threadKids.filter((id) => byId.get(id).kind !== 'turn' && byId.get(id).ts > byId.get(latest).ts)];
  } else {
    pick = threadKids.slice(-6);
  }
  const walk = (id) => { ids.push(id); for (const k of kids.get(id) || []) walk(k); };
  for (const id of pick) walk(id);
  return ids;
}

/** 图是否几乎为空（只有 root，或 root + 空线程）。渲染层据此显示引导文案。 */
export function isGraphEmpty(graph) {
  return !graph || graph.nodes.filter((n) => n.kind !== 'root' && n.kind !== 'thread').length === 0;
}

/** 节点卡片上的短标题。 */
export function shortTitle(node, max = 56) {
  return clip(node.title, max);
}

const PASSED_VERDICT = new Set(['cross-source-pass', 'entailment-pass', 'citation-pass', 'notebook-verified']);
const FAILED_VERDICT = new Set(['citation-fail', 'overclaim', 'source-conflict']);

function tallyVerdicts(claims) {
  const t = { pass: 0, fail: 0, unverified: 0, total: claims.length };
  for (const c of claims) {
    if (PASSED_VERDICT.has(c.status)) t.pass += 1;
    else if (FAILED_VERDICT.has(c.status)) t.fail += 1;
    else t.unverified += 1;
  }
  return t;
}

function kidsOf(byParent, id) {
  return byParent.get(id) || [];
}

/**
 * 过程时间线：回合分级 + 断言按 finding 聚合。断言不再平铺成图节点。
 */
export function buildProcessTimeline({
  nodes = [], notes = [], tasks = [], projectName = '', now = Date.now(),
} = {}) {
  const taskById = new Map((tasks || []).map((t) => [t.id, t]));
  const trace = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.id);
  const byId = new Map(trace.map((n) => [n.id, n]));
  const byParent = new Map();
  for (const n of trace) {
    const p = n.parentId && byId.has(n.parentId) ? n.parentId : '';
    const key = p || `thread:${n.threadId || CHAT_THREAD_ID}`;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => ms(a.ts) - ms(b.ts) || a.id.localeCompare(b.id));

  const noteList = (Array.isArray(notes) ? notes : []).filter((n) => n && n.id);
  const turnsByThread = new Map();
  for (const n of trace) {
    if (n.kind !== 'turn') continue;
    const tid = n.threadId || CHAT_THREAD_ID;
    if (!turnsByThread.has(tid)) turnsByThread.set(tid, []);
    turnsByThread.get(tid).push(n);
  }

  const notesByTurn = new Map();
  for (const note of noteList) {
    const tid = note.threadId || CHAT_THREAD_ID;
    const turn = pickTurnForNote(turnsByThread.get(tid) || [], ms(note.createdAt));
    const key = turn ? turn.id : `thread:${tid}`;
    if (!notesByTurn.has(key)) notesByTurn.set(key, []);
    notesByTurn.get(key).push(noteToNode(note, now));
  }

  function packClaims(subId) {
    const kids = kidsOf(byParent, subId);
    const findings = kids.filter((n) => n.kind === 'finding');
    const claims = kids.filter((n) => n.kind === 'claim');
    const unresolved = kids.filter((n) => n.kind === 'unresolved');
    const actions = kids.filter((n) => n.kind === 'action');
    const linked = new Set();
    const groups = findings.map((f) => {
      const support = (f.meta?.support || []).map((id) => byId.get(id)).filter((c) => c && c.kind === 'claim');
      const counter = (f.meta?.counter || []).map((id) => byId.get(id)).filter((c) => c && c.kind === 'claim');
      for (const c of [...support, ...counter]) linked.add(c.id);
      return {
        id: f.id,
        question: f.title,
        answer: f.text,
        confidence: f.subtype,
        support,
        counter,
        counts: tallyVerdicts([...support, ...counter]),
      };
    });
    const orphans = claims.filter((c) => !linked.has(c.id));
    if (orphans.length) {
      groups.push({
        id: `${subId}:orphan`, question: '', answer: '', confidence: '',
        support: orphans, counter: [], counts: tallyVerdicts(orphans), orphan: true,
      });
    }
    return {
      findings, claims, unresolved, actions, groups,
      counts: tallyVerdicts(claims),
    };
  }

  function packTurn(turn) {
    const kids = kidsOf(byParent, turn.id);
    const subagents = kids.filter((n) => n.kind === 'subagent').map((s) => {
      const packed = packClaims(s.id);
      return {
        id: s.id, type: s.subtype, title: s.title, status: s.status,
        ts: ms(s.ts), endedAt: ms(s.endedAt), text: s.text, ...packed,
      };
    });
    const reports = kids.filter((n) => n.kind === 'report');
    const reply = [...kids].reverse().find((n) => n.kind === 'agent');
    const judgments = notesByTurn.get(turn.id) || [];
    const work = subagents.length > 0 || reports.length > 0 || judgments.some((j) => j.kind === 'judgment');
    return {
      id: turn.id,
      subtype: turn.subtype,
      title: turn.title,
      text: turn.text,
      status: turn.status,
      ts: ms(turn.ts),
      endedAt: ms(turn.endedAt),
      grade: work ? 'work' : 'idle',
      reply: reply ? { id: reply.id, title: reply.title, text: reply.text, status: reply.status } : null,
      subagents,
      reports: reports.map((r) => ({
        id: r.id, title: r.title, text: r.text, entryId: r.refs?.entryId || '',
        judgments: kidsOf(byParent, r.id).filter((n) => n.kind === 'kj').length,
      })),
      judgments,
    };
  }

  const threadIds = new Set(trace.map((n) => n.threadId || CHAT_THREAD_ID));
  for (const note of noteList) threadIds.add(note.threadId || CHAT_THREAD_ID);
  const threads = [];
  for (const tid of threadIds) {
    const isChat = tid === CHAT_THREAD_ID;
    const task = isChat ? null : taskById.get(tid);
    const turns = (turnsByThread.get(tid) || []).slice().sort((a, b) => ms(b.ts) - ms(a.ts)).map(packTurn);
    const looseNotes = notesByTurn.get(`thread:${tid}`) || [];
    if (!turns.length && !looseNotes.length && isChat) continue;
    threads.push({
      id: tid,
      title: isChat ? '对话' : (task ? task.name : '已删除的追踪任务'),
      kind: isChat ? 'chat' : 'heartbeat',
      paused: !!(task && task.enabled === false),
      deleted: !isChat && !task,
      turns,
      looseNotes,
    });
  }
  threads.sort((a, b) => {
    const ta = a.turns[0]?.ts || 0;
    const tb = b.turns[0]?.ts || 0;
    return tb - ta;
  });
  const workTurns = threads.reduce((n, t) => n + t.turns.filter((x) => x.grade === 'work').length, 0);
  return {
    projectName: projectName || '项目',
    threads,
    stats: {
      threads: threads.length,
      turns: threads.reduce((n, t) => n + t.turns.length, 0),
      workTurns,
      subagents: threads.reduce((n, t) => n + t.turns.reduce((m, u) => m + u.subagents.length, 0), 0),
    },
  };
}

export function isProcessEmpty(model) {
  return !model || !model.threads.some((t) => t.turns.length || t.looseNotes.length);
}
