/**
 * 任务追踪时间线的数据模型（纯函数，无 DOM / 无 chrome）。
 *
 * 输入：笔记本条目（带 threadId 的才入线）+ 心跳任务（含 runs[]）。
 * 输出：按追踪主题（thread = 心跳任务 id）分组、按时间倒序的事件列表。
 * 事件类型：
 *   run          心跳运行流水
 *   observation  观测（kind=observation 的笔记）
 *   judgment     判断（kind=judgment 的笔记），带 status / verifyAt / 修正链
 *   verdict      判断的状态变更（核实 / 推翻 / 弃用 / 退回），来自 note.history
 */

export const TIMELINE_FILTERS = ['all', 'open', 'refuted'];
export const MAX_EVENTS_PER_THREAD = 40;

function ms(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function noteEvents(note, now) {
  const events = [];
  const kind = note.kind === 'observation' ? 'observation' : 'judgment';
  const ts = ms(note.createdAt);
  if (!ts) return events;

  if (kind === 'observation') {
    events.push({
      type: 'observation',
      ts,
      noteId: note.id,
      text: note.claim,
      status: note.status,
    });
    return events;
  }

  events.push({
    type: 'judgment',
    ts,
    noteId: note.id,
    text: note.claim,
    status: note.status,
    confidence: note.confidence,
    verifyAt: ms(note.verifyAt) || null,
    overdue: note.status === 'open' && ms(note.verifyAt) > 0 && ms(note.verifyAt) <= now,
    supersedes: note.supersedes || '',
    supersededBy: note.supersededBy || '',
  });

  for (const h of Array.isArray(note.history) ? note.history : []) {
    if (!h || h.from == null) continue; // 第一条是创建，不算状态变更
    const hts = ms(h.ts);
    if (!hts) continue;
    events.push({
      type: 'verdict',
      ts: hts,
      noteId: note.id,
      to: h.to,
      from: h.from,
      reason: h.reason || '',
      text: note.claim,
    });
  }
  return events;
}

function matchesFilter(ev, filter) {
  if (filter === 'open') return ev.type === 'judgment' && ev.status === 'open';
  if (filter === 'refuted') {
    if (ev.type === 'judgment') return ev.status === 'refuted' || !!ev.supersedes;
    if (ev.type === 'verdict') return ev.to === 'refuted';
    return false;
  }
  return true;
}

/**
 * @param {{notes?: Array, tasks?: Array, filter?: string, now?: number}} input
 * @returns {{threads: Array, totalEvents: number}}
 */
export function buildTimeline({ notes = [], tasks = [], filter = 'all', now = Date.now() } = {}) {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const byThread = new Map();
  const ensure = (id) => {
    if (!byThread.has(id)) byThread.set(id, { id, events: [], counts: { open: 0, verified: 0, refuted: 0, observation: 0 } });
    return byThread.get(id);
  };

  for (const t of tasks) {
    if (Array.isArray(t.runs) && t.runs.length) ensure(t.id);
  }

  for (const note of notes) {
    if (!note || !note.threadId) continue;
    const thread = ensure(note.threadId);
    if (note.kind === 'observation') {
      thread.counts.observation += 1;
    } else if (note.status in thread.counts) {
      thread.counts[note.status] += 1;
    }
    thread.events.push(...noteEvents(note, now));
  }

  let totalEvents = 0;
  const threads = [];
  for (const thread of byThread.values()) {
    const task = taskById.get(thread.id) || null;
    if (task) {
      for (const run of Array.isArray(task.runs) ? task.runs : []) {
        const ts = ms(run.at);
        if (!ts) continue;
        thread.events.push({
          type: 'run',
          ts,
          status: run.status === 'error' ? 'error' : 'ok',
          durationMs: Number(run.durationMs) || 0,
          error: run.error || '',
        });
      }
    }
    const all = thread.events.sort((a, b) => b.ts - a.ts);
    const filtered = all.filter((ev) => matchesFilter(ev, filter));
    if (!filtered.length) continue;
    totalEvents += filtered.length;
    threads.push({
      id: thread.id,
      name: task ? task.name : '已删除的追踪任务',
      deleted: !task,
      enabled: task ? task.enabled !== false : false,
      nextRunAt: task ? ms(task.nextRunAt) || null : null,
      lastRunAt: task ? ms(task.lastRunAt) || null : null,
      counts: thread.counts,
      events: filtered.slice(0, MAX_EVENTS_PER_THREAD),
      hiddenEvents: Math.max(0, filtered.length - MAX_EVENTS_PER_THREAD),
      latestTs: filtered[0].ts,
    });
  }
  threads.sort((a, b) => b.latestTs - a.latestTs);
  return { threads, totalEvents };
}

/* ---------------- 活动流（统一操作日志） ---------------- */

export const ACTIVITY_FILTERS = ['all', 'main', 'sub', 'file', 'web', 'note', 'user'];
export const ACTIVITY_PAGE = 60;
export const ACTIVITY_COLLAPSE_MS = 90 * 1000;

function activityMatches(ev, filter) {
  switch (filter) {
    case 'main': return ev.actor === 'main' || ev.actor === 'heartbeat';
    case 'sub': return ev.actor === 'sub';
    case 'user': return ev.actor === 'user';
    case 'file': return ev.cat === 'file';
    case 'web': return ev.cat === 'web';
    case 'note': return ev.cat === 'note';
    default: return true;
  }
}

function sameKind(a, b) {
  return a.actor === b.actor && a.actorId === b.actorId && a.action === b.action
    && a.status === b.status && a.cat === b.cat;
}

/**
 * 把原始事件（任意顺序）整理成活动流：过滤、按时间倒序、把相邻的同类重复操作折叠成 ×N。
 * 折叠只合并“同一主体做同一件事、且时间上连续（间隔 <= collapseMs）”的记录，
 * 生命周期类（turn / subagent.*）不折叠，保证起止可见。
 * @returns {{items: Array, matched: number, hidden: number}}
 */
export function buildActivityStream(events = [], { filter = 'all', limit = ACTIVITY_PAGE, collapseMs = ACTIVITY_COLLAPSE_MS } = {}) {
  const sorted = (Array.isArray(events) ? events : [])
    .filter((ev) => ev && activityMatches(ev, filter))
    .sort((a, b) => (b.ts - a.ts) || ((b.seq || 0) - (a.seq || 0)));

  const items = [];
  for (const ev of sorted) {
    const last = items[items.length - 1];
    const lifecycle = ev.cat === 'turn' || String(ev.action).startsWith('subagent.');
    if (last && !lifecycle && !last.lifecycle && sameKind(last, ev) && last.firstTs - ev.ts <= collapseMs) {
      last.count += 1;
      last.firstTs = ev.ts;
      if (ev.status === 'error') last.status = 'error';
      continue;
    }
    items.push({
      ts: ev.ts,
      firstTs: ev.ts,
      actor: ev.actor,
      actorId: ev.actorId || '',
      actorName: ev.actorName || '',
      cat: ev.cat,
      action: ev.action,
      label: ev.label || ev.action,
      detail: ev.detail || '',
      status: ev.status || '',
      durationMs: ev.durationMs || 0,
      lifecycle,
      count: 1,
    });
  }
  const shown = items.slice(0, Math.max(1, limit));
  return { items: shown, matched: items.length, hidden: Math.max(0, items.length - shown.length) };
}
