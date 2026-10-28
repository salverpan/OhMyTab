/* 任务追踪时间线 / 概览统计冒烟（node test/timeline-smoke.mjs）。用内存版 chrome.storage。 */

import assert from 'node:assert';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(k) { return typeof k === 'string' ? { [k]: store[k] } : { ...store }; },
      async set(obj) { Object.assign(store, JSON.parse(JSON.stringify(obj))); },
      async remove(k) { delete store[k]; },
    },
  },
  runtime: { getURL: (p) => `chrome-extension://test/${p}`, onMessage: { addListener() {} } },
  alarms: {
    async clear() {}, async get() { return null; }, create() {},
  },
};

const { addNote, updateNote, listNotes, capNotes, MAX_NOTES } = await import('../src/lib/notebook.js');
const {
  markHeartbeatRunning, markHeartbeatFinished, upsertHeartbeatTask, appendRunRecord, HEARTBEAT_MAX_RUNS,
  heartbeatUserText, listHeartbeatTasks, purgeHeartbeatTasks, restoreHeartbeatTasks,
} = await import('../src/lib/heartbeat.js');
const { buildTimeline, MAX_EVENTS_PER_THREAD } = await import('../src/lib/timeline-model.js');
const { computeOverviewStats, buildOverviewCharts } = await import('../src/lib/overview-stats.js');
const { notebookTool } = await import('../src/lib/workspace-tools.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const PID = 'p1';
const URL_SRC = 'https://example.com/oil';

// —— 判断 → 证伪 → 修正链 ——
const first = await addNote(PID, {
  claim: '油价 20 分钟内将突破 82', sources: [URL_SRC], confidence: 'high',
  kind: 'judgment', verifyAt: Date.now() + 1200000, threadId: 'hb_oil',
});
ok(first.ok && first.note.kind === 'judgment' && first.note.threadId === 'hb_oil', '判断带 kind/threadId 入账');
ok(first.note.verifyAt > Date.now() && first.note.history.length === 1 && first.note.history[0].from === null, '初始 history 只有创建记录');

const direct = await addNote(PID, { claim: 'x', sources: [URL_SRC], status: 'verified', threadId: 'hb_oil' });
ok(direct.note.status === 'open', '追踪笔记新建即 verified 会被压回待核实');

const revised = await addNote(PID, {
  claim: '油价回落到 80 附近', sources: [URL_SRC], confidence: 'medium', kind: 'judgment',
  supersedes: first.note.id, reason: '实际跌到 79.8',
});
ok(revised.ok && revised.note.supersedes === first.note.id, '新判断记录 supersedes');
ok(revised.note.threadId === 'hb_oil', '修正继承旧判断的 threadId');

let notes = await listNotes(PID);
const old = notes.find((n) => n.id === first.note.id);
ok(old.status === 'refuted' && old.supersededBy === revised.note.id, '旧判断自动转 refuted 并回填 supersededBy');
ok(old.history.length === 2 && old.history[1].from === 'open' && old.history[1].to === 'refuted'
  && old.history[1].reason === '实际跌到 79.8', 'history 追加 open→refuted 与原因');

const bad = await addNote(PID, { claim: 'y', sources: [URL_SRC], supersedes: 'nb_missing' });
ok(bad.error && /不存在/.test(bad.error), 'supersedes 指向不存在的笔记被拒');

const noReason = await updateNote(PID, revised.note.id, { status: 'verified' });
ok(noReason.error && /reason/.test(noReason.error), '追踪判断核实必须写 reason');
const verified = await updateNote(PID, revised.note.id, { status: 'verified', reason: '14:40 读数 79.9' });
ok(verified.ok && verified.note.history.at(-1).to === 'verified', '带 reason 可核实并记入 history');

const plain = await addNote(PID, { claim: '普通结论', sources: [URL_SRC] });
const plainVerify = await updateNote(PID, plain.note.id, { status: 'verified' });
ok(plainVerify.error && /doc_id#anchor/.test(plainVerify.error), '非追踪笔记仍走出处核验');

// —— 工具层：线程自动归组 / 按 thread 过滤 ——
const ctx = { projectId: PID, getActiveHeartbeatTaskId: () => 'hb_oil' };
const added = JSON.parse(await notebookTool({
  action: 'add', claim: '布伦特 79.9', sources: [URL_SRC], kind: 'observation',
}, ctx));
ok(added.ok && added.thread === 'hb_oil', '心跳运行中 notebook(add) 自动带上 threadId');
const listed = JSON.parse(await notebookTool({ action: 'list', thread_id: 'hb_oil', status: 'open' }, ctx));
ok(listed.notes.every((n) => n.thread_id === 'hb_oil' && n.status === 'open') && listed.count >= 1, 'list 支持 thread_id + status 过滤');
ok(!listed.notes.some((n) => n.id === plain.note.id), '过滤后不含其他主题的笔记');

// —— 心跳 runs[]：记录与截断 ——
const task = await upsertHeartbeatTask({ name: '油价监测', prompt: '查油价', every: '30m' }, { projectId: PID });
await markHeartbeatRunning(task.id);
await markHeartbeatFinished(task.id, { ok: true });
await markHeartbeatRunning(task.id);
await markHeartbeatFinished(task.id, { ok: false, error: '超时' });
const { heartbeatTasks } = await chrome.storage.local.get('heartbeatTasks').then((r) => r);
const saved = heartbeatTasks.find((t) => t.id === task.id);
ok(saved.runs.length === 2 && saved.runs[0].status === 'ok' && saved.runs[1].status === 'error' && saved.runs[1].error === '超时', 'runs 记录状态与错误');
ok(saved.runs[0].durationMs >= 0 && saved.runs[0].endedAt >= saved.runs[0].at, 'runs 带起止与时长');

let runs = [];
for (let i = 0; i < HEARTBEAT_MAX_RUNS + 10; i++) runs = appendRunRecord(runs, { at: i, status: 'ok' });
ok(runs.length === HEARTBEAT_MAX_RUNS && runs[0].at === 10 && runs.at(-1).at === HEARTBEAT_MAX_RUNS + 9, 'runs 只保留最近 50 条');

const prompt = heartbeatUserText({ id: 'hb_oil', name: '油价监测', prompt: '查油价' });
ok(prompt.includes('supersedes') && prompt.includes('thread_id="hb_oil"') && prompt.includes('verify_at'), '心跳提示词包含追踪协议');

// —— 时间线模型 ——
notes = await listNotes(PID);
const model = buildTimeline({ notes, tasks: heartbeatTasks });
ok(model.threads.length === 2 && new Set(model.threads.map((t) => t.id)).size === 2, '模型按主题分组（笔记主题 + 仅有运行流水的任务）');
const thread = model.threads.find((t) => t.id === 'hb_oil');
ok(thread && thread.deleted, '任务已不存在的主题标为已删除');
const types = new Set(thread.events.map((e) => e.type));
ok(['observation', 'judgment', 'verdict'].every((t) => types.has(t)), '事件含观测 / 判断 / 验证');
ok(thread.events.every((e, i, a) => i === 0 || a[i - 1].ts >= e.ts), '事件按时间倒序');
ok(thread.counts.refuted === 1 && thread.counts.verified === 1 && thread.counts.observation === 1, '主题计数按状态统计');
ok(!buildTimeline({ notes, tasks: [] }).threads.some((t) => t.id === 'none'), '没有追踪数据的项目不产生主题');
ok(buildTimeline({ notes: [plain.note], tasks: [] }).threads.length === 0, '无 threadId 的笔记不进时间线');

const runThread = buildTimeline({ notes: [], tasks: heartbeatTasks }).threads.find((t) => t.id === task.id);
ok(runThread && runThread.events.length === 2 && runThread.events.every((e) => e.type === 'run') && !runThread.deleted, '只有运行流水的任务也出线');

const onlyRefuted = buildTimeline({ notes, tasks: heartbeatTasks, filter: 'refuted' });
const refEvents = onlyRefuted.threads.find((t) => t.id === 'hb_oil').events;
ok(refEvents.length >= 1 && refEvents.every((e) => e.type === 'judgment' || e.type === 'verdict'), '被推翻过滤只留判断与验证');
ok(refEvents.some((e) => e.type === 'verdict' && e.to === 'refuted'), '被推翻过滤含 refuted 验证事件');
const onlyOpen = buildTimeline({ notes, tasks: heartbeatTasks, filter: 'open' });
ok(onlyOpen.threads.every((t) => t.events.every((e) => e.type === 'judgment' && e.status === 'open')), '待核实过滤只留 open 判断');

const overdue = buildTimeline({
  notes: [{ id: 'n1', claim: 'c', kind: 'judgment', status: 'open', threadId: 't', createdAt: 1000, verifyAt: 2000, history: [{ ts: 1000, from: null, to: 'open' }] }],
  tasks: [], now: 5000,
});
ok(overdue.threads[0].events[0].overdue === true, '过了 verifyAt 仍待核实标记为已到验证期');

const many = Array.from({ length: MAX_EVENTS_PER_THREAD + 5 }, (_, i) => ({
  id: `o${i}`, claim: `obs ${i}`, kind: 'observation', status: 'open', threadId: 't', createdAt: 1000 + i, history: [],
}));
const capped = buildTimeline({ notes: many, tasks: [] }).threads[0];
ok(capped.events.length === MAX_EVENTS_PER_THREAD && capped.hiddenEvents === 5, '单主题事件封顶并提示隐藏数量');

// —— 笔记上限：先丢最老观测 ——
const big = [
  ...Array.from({ length: MAX_NOTES }, (_, i) => ({ id: `j${i}`, kind: 'judgment', threadId: 't' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `ob${i}`, kind: 'observation', threadId: 't' })),
];
const capNotesRes = capNotes(big);
ok(capNotesRes.length === MAX_NOTES && capNotesRes.every((n) => n.kind === 'judgment'), '超限时优先淘汰追踪观测而不是判断');

// —— 概览统计 ——
const now = new Date(2026, 8, 30, 12, 0, 0).getTime();
const day = 86400000;
const stats = computeOverviewStats({
  sources: [{ updatedAt: now, badge: '采集' }, { updatedAt: now - day, badge: '上传' }, { updatedAt: now - 40 * day, badge: '采集' }],
  outputs: [{ entry: { createdAt: now - 2 * day } }],
  notes: [
    { note: { createdAt: now, status: 'open', confidence: 'high' } },
    { note: { createdAt: now, status: 'refuted', confidence: 'high' } },
    { note: { createdAt: now, status: 'verified', confidence: 'low' } },
    { note: { createdAt: now, status: 'open', confidence: 'medium', kind: 'observation' } },
  ],
}, { now });
ok(stats.activity.labels.length === 14 && stats.activity.labels.at(-1) === '09-30', '近 14 天横轴到今天');
ok(stats.activity.sources.at(-1) === 1 && stats.activity.sources.at(-2) === 1, '来源按天计数');
ok(stats.activity.sources.reduce((a, b) => a + b, 0) === 2, '14 天之外的来源不计');
ok(stats.activity.outputs.at(-3) === 1 && stats.activity.notes.at(-1) === 4, '产出与笔记按天计数');
ok(stats.noteTotal === 3 && stats.noteStatus.open === 1 && stats.noteStatus.refuted === 1, '状态统计不含观测');
ok(computeOverviewStats({
  notes: [
    { note: { createdAt: now, status: 'open', confidence: 'high' }, updatedAt: now },
    { kind: 'artifact', title: '中韩半导体产业对比', updatedAt: now },
  ],
}, { now }).noteTotal === 1, '研究笔记 artifact 不进状态矩阵');
ok(stats.calibration[0][0] === 1 && stats.calibration[0][2] === 1 && stats.calibration[2][1] === 1, '置信度 × 状态矩阵');
ok(stats.sourceMix[0].name === '采集' && stats.sourceMix[0].count === 2, '来源构成按数量降序');
const charts = buildOverviewCharts(stats);
ok(charts.map((c) => c.id).join() === 'activity,status,calibration,sourceMix', '有数据时四张图齐全');
ok(charts.every((c) => c.option && c.option.type && c.height > 0), '每张图都有 option 与高度');
const activity = charts.find((c) => c.id === 'activity');
ok(activity.option.axis.y.grid === false && activity.option.axis.x.grid === false, '近 14 天新增不画网格');
ok(activity.option.axis.y.label === false && activity.option.axis.y.tick === false, '近 14 天新增不画 Y 刻度');
ok(buildOverviewCharts(computeOverviewStats({}, { now })).length === 0, '空项目不画图');

// —— 心跳任务跟项目走 ——
const other = await upsertHeartbeatTask({ name: '别的库', prompt: '巡检', every: '1h' }, { projectId: 'p2' });
const listedP1 = await listHeartbeatTasks(PID);
const listedP2 = await listHeartbeatTasks('p2');
ok(listedP1.every((t) => t.projectId === PID) && !listedP1.some((t) => t.id === other.id), 'list 只返回当前项目');
ok(listedP2.length === 1 && listedP2[0].id === other.id, '另一项目各自一份');
const taken = await purgeHeartbeatTasks('p2');
ok(taken.length === 1 && taken[0].id === other.id && (await listHeartbeatTasks('p2')).length === 0, '删库抽走该项目心跳');
ok((await listHeartbeatTasks(PID)).some((t) => t.id === task.id), '删别的库不影响本项目心跳');
await restoreHeartbeatTasks(taken);
ok((await listHeartbeatTasks('p2')).some((t) => t.id === other.id), '撤销写回心跳任务');
const rebound = await upsertHeartbeatTask({ id: other.id, name: '改名', projectId: PID });
ok(rebound.projectId === 'p2' && rebound.name === '改名', '更新不得把任务改挂到别的项目');

console.log(`timeline-smoke: ${passed} ok`);
