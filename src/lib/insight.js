/**
 * 决策洞察（insight）：主代理用 record_insight 工具主动上报的“高阶要素”。
 *
 * 与笔记本的区别：笔记本是带出处的事实 / 判断（可核查）；insight 是给决策者看的叙事骨架——
 * 目标、决策（备选与取舍）、结论（含置信度与变化）、转向、风险、待你拍板、下一步。
 * 存在 trace-log 里（kind='insight'），挂在上报时所在的回合下，任务追踪的“决策视图”读它。
 *
 * 零额外模型调用：全靠主代理在已有回合里顺手调用；没调就没有，读图时再由规则补一部分信号。
 */

import { putTrace, listTrace, newTraceId, CHAT_THREAD } from './trace-log.js';

export const INSIGHT_TYPES = ['goal', 'decision', 'conclusion', 'pivot', 'risk', 'ask', 'next'];
/** 需要被“处理掉”的类型：从 open 走到 resolved / dropped。其余类型创建即 active。 */
const OPEN_TYPES = new Set(['ask', 'risk', 'next']);
/** 同线程内新值自动取代旧值的类型（“当前结论”“当前目标”只有一个）。 */
const SINGLETON_TYPES = new Set(['goal', 'conclusion']);
const CONF_RANK = { low: 1, medium: 2, high: 3 };

export const INSIGHT_HELP = 'record_insight 需要 action：add / resolve / list。add 需要 type（goal/decision/conclusion/pivot/risk/ask/next）与 title。';

export function isLiveInsight(n) {
  return !!n && n.kind === 'insight' && (n.status === 'open' || n.status === 'active');
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function brief(obj) {
  return JSON.stringify(obj, null, 0);
}

function parseDue(v) {
  if (v == null || v === '') return 0;
  const t = typeof v === 'number' ? v : Date.parse(String(v));
  return Number.isFinite(t) && t > 0 ? t : 0;
}

export async function listInsights(projectId, { limit = 600 } = {}) {
  const rows = await listTrace(projectId, { limit });
  return rows.filter((n) => n.kind === 'insight').sort((a, b) => b.ts - a.ts);
}

function turnContext(ctx) {
  const call = (fn) => {
    try { return typeof fn === 'function' ? String(fn() || '') : ''; } catch (_) { return ''; }
  };
  const turnId = call(ctx.getTraceTurnId);
  const threadId = call(ctx.getTraceThreadId) || call(ctx.getActiveHeartbeatTaskId) || CHAT_THREAD;
  return { turnId, threadId };
}

export async function insightTool(args = {}, ctx = {}) {
  const action = String(args.action || 'add').trim().toLowerCase();
  const pid = ctx.projectId || 'default';

  if (action === 'list') {
    const all = await listInsights(pid);
    const live = all.filter(isLiveInsight);
    if (!live.length) return brief({ count: 0, insights: [], hint: '决策板还是空的。有结论 / 转向 / 风险 / 需要用户拍板的事时用 record_insight(add) 记一笔。' });
    return brief({
      count: live.length,
      insights: live.slice(0, 20).map((n) => ({
        id: n.id, type: n.subtype, title: n.title, status: n.status,
        ...(n.meta.confidence ? { confidence: n.meta.confidence } : {}),
        ...(n.meta.dueAt ? { due_at: new Date(n.meta.dueAt).toISOString() } : {}),
      })),
    });
  }

  if (action === 'resolve') {
    const id = String(args.id || '').trim();
    if (!id) return brief({ error: 'resolve 需要 id（从 list 或决策板摘要拿）。' });
    const all = await listInsights(pid);
    const cur = all.find((n) => n.id === id);
    if (!cur) return brief({ error: `没有找到 id=${id} 的决策板条目。` });
    const status = String(args.status || 'resolved').toLowerCase() === 'dropped' ? 'dropped' : 'resolved';
    const reason = clip(args.reason, 200);
    const next = {
      ...cur,
      status,
      endedAt: Date.now(),
      text: reason ? `${cur.text ? `${cur.text}\n` : ''}结果：${reason}` : cur.text,
    };
    const res = putTrace(next);
    await res.done;
    return brief({ ok: true, id, status });
  }

  if (action !== 'add') return brief({ error: INSIGHT_HELP });

  const type = String(args.type || '').trim().toLowerCase();
  if (!INSIGHT_TYPES.includes(type)) return brief({ error: `type 必须是 ${INSIGHT_TYPES.join(' / ')} 之一。` });
  const title = clip(args.title, 160);
  if (!title) return brief({ error: 'title 不能为空：一句话说清这条决策要素。' });

  const { turnId, threadId } = turnContext(ctx);
  const all = await listInsights(pid);
  const byId = new Map(all.map((n) => [n.id, n]));

  let prev = null;
  const wanted = String(args.supersedes || '').trim();
  if (wanted && byId.has(wanted)) prev = byId.get(wanted);
  else if (SINGLETON_TYPES.has(type)) {
    prev = all.find((n) => n.subtype === type && n.threadId === threadId && isLiveInsight(n)) || null;
  }

  const confidence = ['high', 'medium', 'low'].includes(args.confidence) ? args.confidence : (type === 'conclusion' ? 'medium' : '');
  let trend = ['up', 'down', 'flat'].includes(args.trend) ? args.trend : '';
  if (!trend && prev && prev.meta.confidence && confidence) {
    const d = CONF_RANK[confidence] - CONF_RANK[prev.meta.confidence];
    trend = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  }

  const id = newTraceId('ins');
  const now = Date.now();
  const node = putTrace({
    id,
    projectId: pid,
    parentId: turnId,
    threadId,
    kind: 'insight',
    subtype: type,
    ts: now,
    title,
    text: clip(args.why || args.reason, 400),
    status: OPEN_TYPES.has(type) ? 'open' : 'active',
    meta: {
      confidence,
      trend,
      trigger: args.trigger,
      options: args.options,
      chosen: args.chosen,
      supersedes: prev ? prev.id : '',
      dueAt: parseDue(args.due_at),
    },
  });
  if (prev && isLiveInsight(prev)) {
    const old = putTrace({
      ...prev,
      status: 'superseded',
      endedAt: now,
      meta: { ...prev.meta, supersededBy: id },
    });
    await old.done;
  }
  await node.done;
  return brief({ ok: true, id, ...(prev ? { superseded: prev.id } : {}) });
}

const TYPE_LABEL = {
  goal: '目标', decision: '决策', conclusion: '结论', pivot: '转向', risk: '风险', ask: '待用户拍板', next: '下一步',
};

/**
 * 注入每轮动态前言的决策板摘要：只列仍然有效的条目，带 id，方便 resolve / supersedes，
 * 也避免重复上报。控制在 ~900 字符内。
 */
export function formatInsightDigest(insights, { maxChars = 900 } = {}) {
  const live = (Array.isArray(insights) ? insights : [])
    .filter(isLiveInsight)
    .sort((a, b) => b.ts - a.ts);
  if (!live.length) return '';
  const lines = ['### 决策板（你用 record_insight 上报过且仍有效的条目；已处理的用 resolve 关掉，推翻旧结论用 supersedes）'];
  let size = lines[0].length;
  let shown = 0;
  for (const n of live) {
    const bits = [`[${TYPE_LABEL[n.subtype] || n.subtype}]`, n.id, '|', clip(n.title, 80)];
    if (n.meta.confidence) bits.push(`(置信${n.meta.confidence === 'high' ? '高' : n.meta.confidence === 'low' ? '低' : '中'})`);
    if (n.meta.dueAt) bits.push(`预计 ${new Date(n.meta.dueAt).toISOString().slice(0, 16).replace('T', ' ')}`);
    const line = `- ${bits.join(' ')}`;
    if (size + line.length > maxChars) break;
    lines.push(line);
    size += line.length;
    shown += 1;
  }
  if (shown < live.length) lines.push(`- …另有 ${live.length - shown} 条（record_insight(list) 查看）`);
  return lines.join('\n');
}
