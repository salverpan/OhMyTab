/**
 * 论证图数据模型（纯函数）。
 *
 * 回答“结论靠什么站住”：问题 → 结论 → 判断 → 证据。
 * 支撑边 support、反对边 counter。过程树（谁调用了谁）不在这里。
 *
 * 优先用 compose_report 写入的 report/kj/evidence；还没有研报时，
 * 用最近一次调研回合的 findings + claims 搭临时骨架。
 */

export const ARG_KINDS = ['question', 'conclusion', 'judgment', 'evidence', 'bundle', 'gap'];

export const ARG_SIZE = {
  question: { w: 220, h: 52 },
  conclusion: { w: 250, h: 78 },
  judgment: { w: 250, h: 84 },
  evidence: { w: 220, h: 62 },
  bundle: { w: 200, h: 48 },
  gap: { w: 220, h: 48 },
};

const ARG_RANK = { question: 0, conclusion: 1, judgment: 2, evidence: 3, bundle: 3, gap: 3 };

export function sizeOfArg(node) {
  return ARG_SIZE[node.kind] || ARG_SIZE.evidence;
}

/** 按列排布（问题 | 结论 | 判断 | 证据）。反对边不参与位置。 */
export function layoutArgumentGraph(graph, { colGap = 64, rowGap = 12 } = {}) {
  const cols = [[], [], [], []];
  for (const n of graph.nodes || []) {
    const r = ARG_RANK[n.kind];
    cols[r == null ? 3 : r].push(n);
  }
  const placed = [];
  let x = 16;
  let height = 16;
  for (const col of cols) {
    let y = 16;
    let colW = 0;
    for (const n of col) {
      const { w, h } = sizeOfArg(n);
      placed.push({ id: n.id, x, y, width: w, height: h });
      y += h + rowGap;
      colW = Math.max(colW, w);
    }
    height = Math.max(height, y);
    x += (colW || 200) + colGap;
  }
  return { nodes: placed, width: x, height };
}

const PASSED = new Set(['cross-source-pass', 'entailment-pass', 'citation-pass', 'notebook-verified']);
const FAILED = new Set(['citation-fail', 'overclaim', 'source-conflict']);
const MAX_EVIDENCE_PER_JUDGMENT = 6;

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function ms(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toneOfEvidence(status) {
  if (PASSED.has(status)) return 'good';
  if (FAILED.has(status)) return 'bad';
  return 'warn';
}

function makeNode(fields) {
  return {
    subtype: '', title: '', text: '', status: '', ts: 0, endedAt: 0, refs: {}, meta: {},
    collapsible: false, collapsed: false, childCount: 0, hiddenCount: 0, depth: 0,
    ...fields,
  };
}

function childrenOf(nodes, parentId) {
  return (nodes || []).filter((n) => n && n.parentId === parentId);
}

function edge(type, source, target) {
  return { id: `${type}:${source}>${target}`, source, target, type };
}

function verdictCounts(items) {
  const c = { pass: 0, fail: 0, unverified: 0, total: items.length };
  for (const it of items) {
    if (PASSED.has(it.status)) c.pass += 1;
    else if (FAILED.has(it.status)) c.fail += 1;
    else c.unverified += 1;
  }
  return c;
}

function bundleNode(id, items, label, ts, expandId) {
  const counts = verdictCounts(items);
  const bits = [];
  if (counts.pass) bits.push(`通过 ${counts.pass}`);
  if (counts.unverified) bits.push(`未核验 ${counts.unverified}`);
  if (counts.fail) bits.push(`失败 ${counts.fail}`);
  return makeNode({
    id,
    kind: 'bundle',
    title: `${label} ${counts.total} 条`,
    text: bits.join(' · '),
    ts,
    status: counts.fail ? 'contested' : (counts.unverified && !counts.pass ? 'source-unverified' : 'ok'),
    meta: { counts, hiddenIds: items.map((x) => x.id), expandId: expandId || '' },
    collapsible: true,
    collapsed: true,
    childCount: counts.total,
    hiddenCount: counts.total,
  });
}

function maybeEvidence(parentId, items, kind, rel, outNodes, outEdges, expanded) {
  const sorted = items.slice().sort((a, b) => {
    const ra = PASSED.has(a.status) ? 0 : FAILED.has(a.status) ? 2 : 1;
    const rb = PASSED.has(b.status) ? 0 : FAILED.has(b.status) ? 2 : 1;
    return ra - rb || (b.ts || 0) - (a.ts || 0);
  });
  const expand = expanded.has(parentId);
  if (!expand && sorted.length > MAX_EVIDENCE_PER_JUDGMENT) {
    const shown = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    for (const n of shown) {
      outNodes.push(n);
      outEdges.push(edge(rel, parentId, n.id));
    }
    const b = bundleNode(`${parentId}:${kind}-more`, rest, '其余', rest[0]?.ts || 0, parentId);
    outNodes.push(b);
    outEdges.push(edge(rel, parentId, b.id));
    return;
  }
  for (const n of sorted) {
    outNodes.push(n);
    outEdges.push(edge(rel, parentId, n.id));
  }
}

function evidenceFromTrace(n) {
  return makeNode({
    id: n.id,
    kind: 'evidence',
    title: n.title,
    text: n.text,
    status: n.status || 'source-unverified',
    ts: ms(n.ts),
    refs: n.refs || {},
    meta: { ...(n.meta || {}), tone: toneOfEvidence(n.status) },
  });
}

function fromReport(report, all, expanded) {
  const kids = childrenOf(all, report.id);
  const judgments = kids.filter((n) => n.kind === 'kj');
  const evidenceById = new Map(kids.filter((n) => n.kind === 'evidence').map((n) => [n.id, evidenceFromTrace(n)]));
  const gaps = kids.filter((n) => n.kind === 'unresolved');
  const qid = `${report.id}:q`;
  const nodes = [
    makeNode({
      id: qid, kind: 'question', title: report.meta?.question || '核心问题', ts: ms(report.ts),
    }),
    makeNode({
      id: report.id, kind: 'conclusion', title: report.title, text: report.text,
      status: report.status, ts: ms(report.ts), refs: report.refs || {},
      meta: { ...(report.meta || {}), entryId: report.refs?.entryId || '' },
    }),
  ];
  const edges = [edge('leads', qid, report.id)];
  for (const j of judgments) {
    const jn = makeNode({
      id: j.id, kind: 'judgment', title: j.title, text: j.text,
      subtype: j.subtype, ts: ms(j.ts),
      meta: { likelihood: j.meta?.likelihood, confidence: j.subtype },
    });
    nodes.push(jn);
    edges.push(edge('leads', report.id, j.id));
    const support = (j.meta?.support || []).map((id) => evidenceById.get(id)).filter(Boolean);
    const counter = (j.meta?.counter || []).map((id) => evidenceById.get(id)).filter(Boolean);
    maybeEvidence(j.id, support, 's', 'support', nodes, edges, expanded);
    maybeEvidence(j.id, counter, 'c', 'counter', nodes, edges, expanded);
  }
  for (const g of gaps) {
    nodes.push(makeNode({
      id: g.id, kind: 'gap', title: g.title, subtype: g.subtype || 'gap', ts: ms(g.ts),
    }));
    edges.push(edge('leads', report.id, g.id));
  }
  const seen = new Set();
  return {
    nodes: nodes.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))),
    edges,
    empty: judgments.length === 0 && !report.text,
    source: 'report',
    activeId: report.id,
  };
}

function fromFindings(turn, all, expanded) {
  const kids = [];
  const walk = (id) => {
    for (const c of childrenOf(all, id)) {
      kids.push(c);
      walk(c.id);
    }
  };
  walk(turn.id);
  const findings = kids.filter((n) => n.kind === 'finding');
  const claims = kids.filter((n) => n.kind === 'claim');
  const claimById = new Map(claims.map((c) => [c.id, evidenceFromTrace(c)]));
  const linked = new Set();
  const qid = `${turn.id}:q`;
  const nodes = [
    makeNode({ id: qid, kind: 'question', title: turn.title || '调研问题', ts: ms(turn.ts) }),
  ];
  const edges = [];
  const reply = kids.find((n) => n.kind === 'agent' && n.text);
  if (reply) {
    const cid = `${turn.id}:bluf`;
    nodes.push(makeNode({
      id: cid, kind: 'conclusion', title: clip(reply.title || reply.text, 120), text: reply.text, ts: ms(reply.ts),
    }));
    edges.push(edge('leads', qid, cid));
    for (const f of findings) edges.push(edge('leads', cid, f.id));
  } else {
    for (const f of findings) edges.push(edge('leads', qid, f.id));
  }
  for (const f of findings) {
    nodes.push(makeNode({
      id: f.id, kind: 'judgment', title: f.text || f.title, text: f.title !== f.text ? f.title : '',
      subtype: f.subtype, ts: ms(f.ts),
      meta: { question: f.title, confidence: f.subtype },
    }));
    const support = (f.meta?.support || []).map((id) => claimById.get(id)).filter(Boolean);
    const counter = (f.meta?.counter || []).map((id) => claimById.get(id)).filter(Boolean);
    for (const n of [...support, ...counter]) linked.add(n.id);
    maybeEvidence(f.id, support, 's', 'support', nodes, edges, expanded);
    maybeEvidence(f.id, counter, 'c', 'counter', nodes, edges, expanded);
  }
  const orphans = claims.filter((c) => !linked.has(c.id)).map((c) => evidenceFromTrace(c));
  if (orphans.length) {
    const b = bundleNode(`${turn.id}:orphan`, orphans, '未归入问题的断言', orphans[0].ts, turn.id);
    nodes.push(b);
    edges.push(edge('leads', nodes.find((n) => n.kind === 'conclusion')?.id || qid, b.id));
  }
  const seen = new Set();
  return {
    nodes: nodes.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))),
    edges,
    empty: findings.length === 0 && claims.length === 0,
    source: 'findings',
    activeId: turn.id,
  };
}

function workScore(turn, all) {
  const kids = childrenOf(all, turn.id);
  let n = 0;
  for (const k of kids) {
    if (k.kind === 'subagent' || k.kind === 'report') n += 3;
    if (k.kind === 'finding' || k.kind === 'kj') n += 2;
    n += childrenOf(all, k.id).filter((c) => c.kind === 'finding' || c.kind === 'claim' || c.kind === 'kj').length;
  }
  return n;
}

/**
 * @param {{nodes?: Array, expanded?: Record<string, boolean>, activeId?: string}} input
 * @returns {{nodes, edges, empty, source, activeId, options}}
 */
export function buildArgumentGraph({ nodes = [], expanded = {}, activeId = '' } = {}) {
  const all = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.id);
  const exp = new Set(Object.keys(expanded || {}).filter((k) => expanded[k]));
  const reports = all.filter((n) => n.kind === 'report').sort((a, b) => ms(b.ts) - ms(a.ts));
  const turns = all.filter((n) => n.kind === 'turn').sort((a, b) => workScore(b, all) - workScore(a, all) || ms(b.ts) - ms(a.ts));
  const options = [
    ...reports.map((r) => ({ id: r.id, kind: 'report', title: r.title || '研报', ts: ms(r.ts) })),
    ...turns.filter((t) => workScore(t, all) > 0 && !reports.some((r) => r.parentId === t.id))
      .map((t) => ({ id: t.id, kind: 'turn', title: clip(t.title, 40), ts: ms(t.ts) })),
  ];
  const pick = options.find((o) => o.id === activeId) || options[0];
  if (!pick) {
    return { nodes: [], edges: [], empty: true, source: '', activeId: '', options: [] };
  }
  const graph = pick.kind === 'report'
    ? fromReport(reports.find((r) => r.id === pick.id), all, exp)
    : fromFindings(turns.find((t) => t.id === pick.id), all, exp);
  return { ...graph, options, activeId: pick.id };
}

export function isArgumentEmpty(graph) {
  return !graph || graph.empty || !graph.nodes.some((n) => n.kind === 'judgment' || n.kind === 'conclusion');
}

/** 默认框住问题 + 结论 + 判断，证据太多时不整图缩小。 */
export function argumentFocusIds(graph) {
  if (!graph || !graph.nodes.length) return [];
  const core = graph.nodes.filter((n) => n.kind === 'question' || n.kind === 'conclusion' || n.kind === 'judgment');
  return (core.length ? core : graph.nodes).map((n) => n.id);
}
