/**
 * 决策板数据模型（纯函数，无 DOM / chrome）。
 *
 * 任务追踪的过程树回答“AI 做了什么”；决策板回答决策者的五个问题：
 *   1. 需要我拍板什么？           ask / decision（带备选）
 *   2. 我们现在认为什么、多可靠？  conclusion + 笔记判断 + 证据强度
 *   3. 哪里有分歧、哪些看法被推翻？ risk / 冲突 / 过度断言 / refuted / 修正
 *   4. 还不知道什么、下一步查哪？   unresolved / next / 单一来源 / 到期待验证
 *   5. 最近变了什么？              转向、结论替换、判断状态变化
 *
 * 一个“议题”= 一个追踪线程（对话，或每个心跳任务）。输入与 trace-model 相同。
 */

import { MODALITY_LABEL } from './task-report.js';

export const CHAT_THREAD_ID = 'chat';
export const RECENT_MS = 7 * 24 * 3600 * 1000;
const MAX_LIST = 5;

const STRONG = new Set(['cross-source-pass']);
const SINGLE = new Set(['entailment-pass']);
const CONTESTED = new Set(['overclaim', 'source-conflict', 'citation-fail']);
const WEAK_MODALITY = new Set(['claimed', 'reported', 'speculative']);

function ms(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function norm(s) {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** 同一句话只留最新一条。 */
function dedupeLatest(items, key = (x) => norm(x.title)) {
  const best = new Map();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    const cur = best.get(k);
    if (!cur || it.ts > cur.ts) best.set(k, it);
  }
  return [...best.values()].sort((a, b) => b.ts - a.ts);
}

export function claimStrength(claim) {
  const v = claim.status || '';
  if (STRONG.has(v)) return 'strong';
  if (SINGLE.has(v)) return 'single';
  if (CONTESTED.has(v)) return 'contested';
  return 'unverified';
}

export const STRENGTH_LABEL = {
  strong: '多源印证', single: '单一来源', contested: '存疑', unverified: '未核验',
};

function emptyIssue(threadId) {
  return {
    threadId,
    title: '',
    name: '',
    kind: threadId === CHAT_THREAD_ID ? 'chat' : 'heartbeat',
    goal: null,
    conclusion: null,
    judgments: [],
    strength: { strong: 0, single: 0, contested: 0, unverified: 0, weakModality: 0, total: 0 },
    disputes: [],
    gaps: [],
    changes: [],
    lastTs: 0,
    subagents: 0,
    nextRunAt: 0,
    paused: false,
    deleted: false,
  };
}

/**
 * @param {{nodes?: Array, notes?: Array, tasks?: Array, now?: number}} input
 * @returns {{attention: {asks: Array, alerts: Array, overdue: Array}, issues: Array, empty: boolean}}
 */
export function buildDecisionBoard({ nodes = [], notes = [], tasks = [], now = Date.now() } = {}) {
  const taskById = new Map((tasks || []).map((t) => [t.id, t]));
  const issues = new Map();
  const issue = (threadId) => {
    const id = threadId || CHAT_THREAD_ID;
    if (!issues.has(id)) issues.set(id, emptyIssue(id));
    return issues.get(id);
  };
  const recent = (ts) => ts > 0 && now - ts <= RECENT_MS;
  const trace = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.id);

  const latestUserTurn = new Map();
  const claims = [];
  const asks = [];

  for (const n of trace) {
    const t = issue(n.threadId);
    const ts = ms(n.ts);
    t.lastTs = Math.max(t.lastTs, ts, ms(n.endedAt));
    const meta = n.meta || {};

    if (n.kind === 'turn' && n.subtype === 'user' && n.title) {
      const cur = latestUserTurn.get(t.threadId);
      if (!cur || ts > cur.ts) latestUserTurn.set(t.threadId, { ts, title: n.title });
    } else if (n.kind === 'subagent') {
      t.subagents += 1;
    } else if (n.kind === 'claim') {
      claims.push({ ...n, ts, threadId: t.threadId });
    } else if (n.kind === 'unresolved') {
      t.gaps.push({ type: 'unresolved', title: n.title, ts, source: '子代理未查清' });
    } else if (n.kind === 'insight') {
      const live = n.status === 'open' || n.status === 'active';
      const item = {
        id: n.id, type: n.subtype, title: n.title, text: n.text || '', ts, status: n.status,
        confidence: meta.confidence || '', trend: meta.trend || '', options: meta.options || [],
        chosen: meta.chosen || '', dueAt: ms(meta.dueAt), supersedes: meta.supersedes || '',
        threadId: t.threadId,
      };
      if (n.subtype === 'goal' && live && (!t.goal || ts > t.goal.ts)) t.goal = item;
      else if (n.subtype === 'conclusion' && live && (!t.conclusion || ts > t.conclusion.ts)) t.conclusion = item;
      else if (n.subtype === 'ask' && live) asks.push(item);
      else if (n.subtype === 'decision' && live && item.options.length && !item.chosen) asks.push(item);
      else if (n.subtype === 'risk' && live) t.disputes.push({ type: 'risk', title: n.title, text: n.text || '', ts });
      else if (n.subtype === 'next' && live) t.gaps.push({ type: 'next', title: n.title, ts, source: 'AI 建议的下一步', insightId: n.id });
      if (n.subtype === 'pivot' && recent(ts)) t.changes.push({ type: 'pivot', title: n.title, text: n.text || '', ts });
      if (n.subtype === 'conclusion' && n.status === 'superseded' && recent(ms(n.endedAt) || ts)) {
        t.changes.push({ type: 'replaced', title: n.title, ts: ms(n.endedAt) || ts, by: meta.supersededBy || '' });
      }
      if (live && item.dueAt && item.dueAt <= now && n.subtype !== 'ask') {
        t.gaps.push({ type: 'due', title: n.title, ts: item.dueAt, source: '到了预计复核时间', insightId: n.id });
      }
    }
  }

  for (const c of dedupeLatest(claims)) {
    const t = issue(c.threadId);
    const s = claimStrength(c);
    const meta = c.meta || {};
    t.strength[s] += 1;
    t.strength.total += 1;
    const passed = s === 'strong' || s === 'single';
    if (passed && WEAK_MODALITY.has(meta.modality)) t.strength.weakModality += 1;
    if (s === 'contested') {
      t.disputes.push({
        type: c.status, title: c.title, text: c.text || '', ts: c.ts,
        attribution: meta.attribution || '',
      });
    } else if (s === 'single' && c.subtype === 'high') {
      t.gaps.push({ type: 'single-source', title: c.title, ts: c.ts, source: '高置信但只有一个来源，需要第二来源' });
    }
  }

  const overdue = [];
  const noteList = (Array.isArray(notes) ? notes : []).filter((n) => n && n.id && n.kind !== 'observation');
  for (const note of noteList) {
    const t = issue(note.threadId);
    const ts = ms(note.updatedAt) || ms(note.createdAt);
    t.lastTs = Math.max(t.lastTs, ts);
    const status = note.status || 'open';
    if (status === 'dropped') continue;
    const verifyAt = ms(note.verifyAt);
    const isOverdue = status === 'open' && verifyAt > 0 && verifyAt <= now;
    if (status !== 'refuted' && !note.supersededBy) {
      t.judgments.push({
        noteId: note.id, title: note.claim || '', status, confidence: note.confidence || '',
        ts, overdue: isOverdue, sources: Array.isArray(note.sources) ? note.sources.length : 0,
      });
    }
    if (isOverdue) {
      overdue.push({ noteId: note.id, title: note.claim || '', ts: verifyAt, threadId: t.threadId });
    }
    for (const h of Array.isArray(note.history) ? note.history : []) {
      const hts = ms(h.ts);
      if (!recent(hts) || h.from == null || h.from === h.to) continue;
      if (h.to === 'refuted') {
        t.disputes.push({ type: 'refuted', title: note.claim || '', text: h.reason || '', ts: hts, noteId: note.id });
      }
      if (h.to === 'verified' || h.to === 'refuted' || (h.from === 'verified' && h.to === 'open')) {
        t.changes.push({ type: `note-${h.to === 'open' ? 'reopened' : h.to}`, title: note.claim || '', text: h.reason || '', ts: hts, noteId: note.id });
      }
    }
  }

  const rank = { open: 0, verified: 1 };
  const conf = { high: 0, medium: 1, low: 2, '': 3 };
  const out = [];
  for (const t of issues.values()) {
    const task = t.kind === 'heartbeat' ? taskById.get(t.threadId) : null;
    t.deleted = t.kind === 'heartbeat' && !task;
    t.paused = !!(task && task.enabled === false);
    t.nextRunAt = task && task.enabled !== false ? ms(task.nextRunAt) : 0;
    t.name = t.kind === 'chat' ? '对话' : (task ? task.name : '已删除的追踪任务');
    const lastAsk = latestUserTurn.get(t.threadId);
    t.title = (t.goal && t.goal.title) || (t.kind === 'heartbeat' && task ? task.name : '') || (lastAsk ? lastAsk.title : '') || t.name;

    t.judgments.sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2)
      || (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1)
      || (conf[a.confidence] ?? 3) - (conf[b.confidence] ?? 3)
      || b.ts - a.ts);
    t.judgmentTotal = t.judgments.length;
    t.judgments = t.judgments.slice(0, MAX_LIST);
    t.disputes = dedupeLatest(t.disputes).slice(0, MAX_LIST);
    t.gaps = dedupeLatest(t.gaps).slice(0, MAX_LIST);
    t.changes = dedupeLatest(t.changes, (x) => `${x.type}|${norm(x.title)}`).slice(0, MAX_LIST);

    const hasContent = t.goal || t.conclusion || t.judgmentTotal || t.strength.total
      || t.disputes.length || t.gaps.length || t.changes.length;
    if (hasContent) out.push(t);
  }
  // 有待拍板 / 争议的议题排前面，其次按最近活动。
  const urgency = (t) => (asks.some((a) => a.threadId === t.threadId) ? 2 : 0) + (t.disputes.length ? 1 : 0);
  out.sort((a, b) => urgency(b) - urgency(a) || b.lastTs - a.lastTs);

  const alerts = [];
  for (const t of out) {
    for (const d of t.disputes) {
      if (recent(d.ts) && (d.type === 'refuted' || d.type === 'source-conflict')) {
        alerts.push({ ...d, threadId: t.threadId, issueTitle: t.title });
      }
    }
    for (const c of t.changes) {
      if (c.type === 'replaced' || c.type === 'pivot') alerts.push({ ...c, threadId: t.threadId, issueTitle: t.title });
    }
  }

  const issueTitle = new Map(out.map((t) => [t.threadId, t.title]));
  const withTitle = (x) => ({ ...x, issueTitle: issueTitle.get(x.threadId) || '' });
  return {
    attention: {
      asks: dedupeLatest(asks).map(withTitle),
      alerts: dedupeLatest(alerts).slice(0, MAX_LIST),
      overdue: overdue.sort((a, b) => a.ts - b.ts).slice(0, MAX_LIST).map(withTitle),
    },
    issues: out,
    empty: out.length === 0 && asks.length === 0,
  };
}

/** “据此派调研”的预填指令：用户确认后发送，不自动发。 */
export function researchPrompt(issueTitle, gap) {
  const topic = clip(issueTitle, 60);
  const what = clip(gap.title, 160);
  if (gap.type === 'single-source') {
    return `针对「${topic}」：下面这条结论目前只有一个来源，请找独立的第二来源核实或推翻它，交回带出处的结论。\n结论：${what}`;
  }
  if (gap.type === 'due') {
    return `针对「${topic}」：这条判断到了复核时间，请查最新信息，确认它是否仍然成立。\n判断：${what}`;
  }
  return `针对「${topic}」补一个信息缺口：${what}\n请派子代理查证，交回带出处的结论；查不到也请说明查了哪些来源。`;
}

export function decisionPrompt(ask) {
  const opts = (ask.options || []).length ? `\n备选：${ask.options.join(' / ')}` : '';
  return `关于「${clip(ask.title, 120)}」，我的决定是：${opts}`;
}

export { MODALITY_LABEL };
