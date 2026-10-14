/**
 * 任务追踪简报：问题 → 结论 → 几条判断（支撑 / 反对 / 未核）→ 缺口。
 */

import { researchPrompt, decisionPrompt } from './decision-model.js';

const PASSED = new Set(['cross-source-pass', 'entailment-pass', 'citation-pass', 'notebook-verified']);
const FAILED = new Set(['citation-fail', 'overclaim', 'source-conflict']);
const TOP_QUOTES = 2;
const MAX_JUDGMENTS = 6;

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function ms(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function kids(nodes, parentId) {
  return (nodes || []).filter((n) => n && n.parentId === parentId);
}

function descendants(nodes, id) {
  const out = [];
  const walk = (pid) => {
    for (const c of kids(nodes, pid)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

function countsOf(items) {
  const c = { pass: 0, fail: 0, unverified: 0, total: items.length };
  for (const it of items) {
    if (PASSED.has(it.status)) c.pass += 1;
    else if (FAILED.has(it.status)) c.fail += 1;
    else c.unverified += 1;
  }
  return c;
}

function packSide(items) {
  const sorted = items.slice().sort((a, b) => {
    const ra = PASSED.has(a.status) ? 0 : FAILED.has(a.status) ? 2 : 1;
    const rb = PASSED.has(b.status) ? 0 : FAILED.has(b.status) ? 2 : 1;
    return ra - rb;
  });
  return {
    counts: countsOf(items),
    top: sorted.slice(0, TOP_QUOTES).map((e) => ({
      id: e.id, title: e.title, text: e.text, status: e.status,
      attribution: e.meta?.attribution || '',
    })),
  };
}

function asEvidence(n) {
  return {
    id: n.id, title: n.title, text: n.text, status: n.status || 'source-unverified',
    meta: n.meta || {},
  };
}

function workScore(turn, all) {
  const k = kids(all, turn.id);
  let n = 0;
  for (const c of k) {
    if (c.kind === 'subagent' || c.kind === 'report') n += 3;
    n += kids(all, c.id).filter((x) => x.kind === 'finding' || x.kind === 'kj' || x.kind === 'claim').length;
  }
  return n;
}

function listCases(all) {
  const reports = all.filter((n) => n.kind === 'report').sort((a, b) => ms(b.ts) - ms(a.ts));
  const turns = all.filter((n) => n.kind === 'turn').sort((a, b) => workScore(b, all) - workScore(a, all) || ms(b.ts) - ms(a.ts));
  return [
    ...reports.map((r) => ({ id: r.id, kind: 'report', title: clip(r.title || '研报', 48), ts: ms(r.ts) })),
    ...turns.filter((t) => workScore(t, all) > 0 && !reports.some((r) => r.parentId === t.id))
      .map((t) => ({ id: t.id, kind: 'turn', title: clip(t.title, 48), ts: ms(t.ts) })),
  ];
}

function judgmentOf({ id, title, text, likelihood, confidence, support, counter }) {
  const s = packSide(support);
  const c = packSide(counter);
  const total = s.counts.total + c.counts.total;
  const net = total ? (s.counts.pass - c.counts.pass - c.counts.fail) / Math.max(1, total) : 0;
  return {
    id, title, text: text || '', likelihood: likelihood || '', confidence: confidence || '',
    support: s, counter: c,
    meter: {
      pass: s.counts.pass,
      warn: s.counts.unverified + c.counts.unverified,
      fail: s.counts.fail + c.counts.fail + c.counts.pass,
      total,
    },
    lean: net >= 0.25 ? 'support' : net <= -0.15 ? 'counter' : 'mixed',
  };
}

function fromReport(report, all) {
  const k = kids(all, report.id);
  const evidenceById = new Map(k.filter((n) => n.kind === 'evidence').map((n) => [n.id, asEvidence(n)]));
  const judgments = k.filter((n) => n.kind === 'kj').map((j) => judgmentOf({
    id: j.id,
    title: j.title,
    text: j.text,
    likelihood: j.meta?.likelihood,
    confidence: j.subtype,
    support: (j.meta?.support || []).map((id) => evidenceById.get(id)).filter(Boolean),
    counter: (j.meta?.counter || []).map((id) => evidenceById.get(id)).filter(Boolean),
  }));
  return {
    question: report.meta?.question || '',
    conclusion: { title: report.title, text: report.text, entryId: report.refs?.entryId || '' },
    judgments: judgments.slice(0, MAX_JUDGMENTS),
    gaps: k.filter((n) => n.kind === 'unresolved').map((g) => ({ id: g.id, title: g.title, type: g.subtype || 'gap' })),
    source: 'report',
  };
}

function fromTurn(turn, all) {
  const tree = descendants(all, turn.id);
  const findings = tree.filter((n) => n.kind === 'finding');
  const claims = tree.filter((n) => n.kind === 'claim');
  const claimById = new Map(claims.map((c) => [c.id, asEvidence(c)]));
  const reply = tree.find((n) => n.kind === 'agent' && n.text);
  const report = kids(all, turn.id).find((n) => n.kind === 'report');
  const judgments = findings.map((f) => judgmentOf({
    id: f.id,
    title: f.text || f.title,
    text: f.title && f.text && f.title !== f.text ? f.title : '',
    confidence: f.subtype,
    support: (f.meta?.support || []).map((id) => claimById.get(id)).filter(Boolean),
    counter: (f.meta?.counter || []).map((id) => claimById.get(id)).filter(Boolean),
  }));
  const gaps = tree.filter((n) => n.kind === 'unresolved').map((g) => ({ id: g.id, title: g.title, type: 'unresolved' }));
  return {
    question: turn.title || '',
    conclusion: report
      ? { title: report.title, text: report.text, entryId: report.refs?.entryId || '' }
      : (reply ? { title: clip(reply.title || reply.text, 160), text: '', entryId: '' } : null),
    judgments: judgments.slice(0, MAX_JUDGMENTS),
    gaps,
    source: 'findings',
  };
}

/**
 * @returns {{empty, options, activeId, question, conclusion, judgments, gaps, asks, disputes}}
 */
export function buildBriefing({ nodes = [], notes = [], tasks = [], activeId = '' } = {}) {
  const all = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.id);
  const options = listCases(all);
  const pick = options.find((o) => o.id === activeId) || options[0];
  if (!pick) {
    return { empty: true, options: [], activeId: '', question: '', conclusion: null, judgments: [], gaps: [], asks: [], disputes: [] };
  }
  const core = pick.kind === 'report'
    ? fromReport(all.find((n) => n.id === pick.id), all)
    : fromTurn(all.find((n) => n.id === pick.id), all);

  const asks = [];
  const disputes = [];
  for (const n of all) {
    if (n.kind !== 'insight') continue;
    const live = n.status === 'open' || n.status === 'active';
    if (!live) continue;
    if (n.subtype === 'ask' || (n.subtype === 'decision' && (n.meta?.options || []).length && !n.meta?.chosen)) {
      asks.push({ id: n.id, title: n.title, text: n.text, options: n.meta?.options || [] });
    }
    if (n.subtype === 'risk') disputes.push({ id: n.id, title: n.title, text: n.text, type: 'risk' });
  }
  for (const j of core.judgments) {
    if (j.counter.counts.total) {
      disputes.push({
        id: j.id, title: j.title, text: `反对证据 ${j.counter.counts.total} 条`, type: 'counter',
      });
    }
    if (j.meter.fail && j.lean !== 'support') {
      disputes.push({ id: `${j.id}:weak`, title: j.title, text: '核验失败或反对较多', type: 'weak' });
    }
  }
  const noteGaps = (Array.isArray(notes) ? notes : [])
    .filter((n) => n && n.status === 'open' && n.kind !== 'observation' && !n.supersededBy)
    .slice(0, 4)
    .map((n) => ({ id: n.id, title: n.claim, type: 'open-note', noteId: n.id }));

  const gaps = [...core.gaps, ...noteGaps].slice(0, 6);
  const empty = !core.conclusion && !core.judgments.length && !asks.length;
  return {
    empty,
    options,
    activeId: pick.id,
    question: core.question,
    conclusion: core.conclusion,
    judgments: core.judgments,
    gaps,
    asks: asks.slice(0, 3),
    disputes: disputes.slice(0, 5),
    topic: core.question || pick.title,
  };
}

export function isBriefingEmpty(b) {
  return !b || b.empty;
}

export { researchPrompt, decisionPrompt };
