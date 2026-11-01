/* 心跳后台调度冒烟：领取、并发保护、收尾与 per-task 存储清理。不碰真实 chrome.* */

import assert from 'node:assert';

const mem = new Map();
const alarms = new Map();

function pick(keys) {
  if (keys == null) return Object.fromEntries(mem);
  if (Array.isArray(keys)) {
    const out = {};
    for (const k of keys) if (mem.has(k)) out[k] = mem.get(k);
    return out;
  }
  if (typeof keys === 'string') {
    return mem.has(keys) ? { [keys]: mem.get(keys) } : {};
  }
  if (typeof keys === 'object') {
    const out = {};
    for (const [k, def] of Object.entries(keys)) out[k] = mem.has(k) ? mem.get(k) : def;
    return out;
  }
  return {};
}

globalThis.chrome = {
  storage: {
    local: {
      async get(keys) { return pick(keys); },
      async set(obj) { for (const [k, v] of Object.entries(obj || {})) mem.set(k, v); },
      async remove(keys) { for (const k of (Array.isArray(keys) ? keys : [keys])) mem.delete(k); },
    },
  },
  alarms: {
    async clear(name) { return alarms.delete(name); },
    async get(name) { return alarms.get(name) || null; },
    create(name, info) { alarms.set(name, info); },
  },
};

const {
  HEARTBEAT_STORAGE_KEY, HEARTBEAT_ALARM, HEARTBEAT_STALE_RUNNING_MS,
  claimDueHeartbeatTasks, markHeartbeatFinished, queuedOrDueCount,
  heartbeatSessionsKey, heartbeatInboxKey, deleteHeartbeatTask,
  isHeartbeatTaskRunning, runningHeartbeatProjectIds, adoptHeartbeatRun,
  purgeAllHeartbeatTasks, restoreHeartbeatTasks,
} = await import('../src/lib/heartbeat.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const now = Date.now();
const task = (id, patch) => ({
  id,
  projectId: 'p1',
  name: id,
  prompt: '巡检',
  enabled: true,
  schedule: { type: 'interval', everyMin: 30 },
  nextRunAt: now - 60_000,
  lastStatus: null,
  updatedAt: now - 60_000,
  queued: false,
  ...patch,
});
mem.set(HEARTBEAT_STORAGE_KEY, [
  task('due', { queued: true }),
  task('future', { nextRunAt: now + 60_000 }),
  task('stale', { lastStatus: 'running', updatedAt: now - 11 * 60_000 }),
  task('fresh-running', { lastStatus: 'running', updatedAt: now }),
  task('disabled', { enabled: false }),
]);

const first = await claimDueHeartbeatTasks(now);
ok(first.map((t) => t.id).sort().join(',') === 'due,stale', '只领取到期且未在运行的任务（含旧 queued）');
ok(first.every((t) => t.lastStatus === 'running' && !t.queued), '领取即标记 running / 清 queued');
const second = await claimDueHeartbeatTasks(now);
ok(second.length === 0, '同一 tick 不会重复领取');

const saved = mem.get(HEARTBEAT_STORAGE_KEY);
ok(saved.find((t) => t.id === 'due').lastStatus === 'running', 'running 已原子落盘');
ok(saved.find((t) => t.id === 'fresh-running').lastStatus === 'running', '正在运行的不被抢走');
ok(isHeartbeatTaskRunning({ lastStatus: 'running', projectId: 'p1', updatedAt: now }, now), '新鲜 running 算活动');
ok(!isHeartbeatTaskRunning({ lastStatus: 'running', updatedAt: now - HEARTBEAT_STALE_RUNNING_MS - 1 }, now), '过期 running 不算活动');
ok(!isHeartbeatTaskRunning({ lastStatus: 'error', lastResult: '心跳任务失败' }, now), '失败态不算活动');
const livePids = runningHeartbeatProjectIds([
  { lastStatus: 'running', projectId: 'alpha', updatedAt: now },
  { lastStatus: 'error', projectId: 'beta', updatedAt: now },
  { lastStatus: 'running', projectId: 'gamma', updatedAt: now - HEARTBEAT_STALE_RUNNING_MS - 1 },
], now);
ok(livePids.has('alpha') && !livePids.has('beta') && !livePids.has('gamma') && livePids.size === 1, '项目呼吸灯只跟正在跑的心跳绑定');

ok(await adoptHeartbeatRun('due', 'panel') === true, '侧栏可以认领刚领取的任务');
ok(await adoptHeartbeatRun('due', 'panel') === true, '同一 runner 再认领幂等');
ok(await adoptHeartbeatRun('due', 'sw') === false, 'SW 抢不走已被侧栏认领的任务');
ok(await adoptHeartbeatRun('fresh-running', 'sw') === true, '未认领的 running 可被 SW 认领');
const staleSnap = mem.get(HEARTBEAT_STORAGE_KEY).find((t) => t.id === 'stale');
const skippedOld = await markHeartbeatFinished('stale', { ok: true, result: 'old-run', runStartedAt: Number(staleSnap.runStartedAt) - 5 });
ok(skippedOld.lastStatus === 'running', '过期轮次的收尾不会结束新一轮');

const finished = await markHeartbeatFinished('due', { ok: true, result: '本轮结果：油价 80 美元' });
ok(finished.lastStatus === 'ok' && finished.lastResult.includes('油价'), '成功收尾并写入最近结果');
ok(finished.nextRunAt > now, '收尾后安排下一次');
ok(finished.runs.length === 1 && finished.runs[0].status === 'ok', '运行流水落一条');
ok((await queuedOrDueCount()) === 0, 'running / 已排期任务不重复计入角标');

const failed = await markHeartbeatFinished('stale', { ok: false, error: 'Failed to fetch', result: '心跳任务失败：Failed to fetch' });
ok(failed.lastStatus === 'error' && failed.lastStatus !== 'running', '失败后不再保持 running');
ok(failed.lastError.includes('Failed to fetch'), '失败原因写入 lastError');

// per-task 工作线程与 inbox 清理
const tasks = mem.get(HEARTBEAT_STORAGE_KEY).slice();
tasks.push(task('delete-me', { nextRunAt: now + 60_000 }));
mem.set(HEARTBEAT_STORAGE_KEY, tasks);
mem.set(heartbeatSessionsKey('p1'), { 'delete-me': { history: [{ role: 'user', content: 'x' }] }, keep: { history: [] } });
mem.set(heartbeatInboxKey('p1'), [
  { taskId: 'delete-me', hbKey: 'a' },
  { taskId: 'keep', hbKey: 'b' },
]);
await deleteHeartbeatTask('delete-me');
ok(!(mem.get(heartbeatSessionsKey('p1')) || {})['delete-me'], '删任务清理任务线程');
ok(mem.get(heartbeatInboxKey('p1')).length === 1 && mem.get(heartbeatInboxKey('p1'))[0].taskId === 'keep', '删任务只清该任务 UI 气泡');
ok(alarms.has(HEARTBEAT_ALARM), '有启用任务时保留 1 分钟 alarm');

const reviveId = 'revive-me';
const afterDel = mem.get(HEARTBEAT_STORAGE_KEY).slice();
afterDel.push(task(reviveId, { nextRunAt: now + 60_000, lastStatus: 'running', runStartedAt: now, updatedAt: now }));
mem.set(HEARTBEAT_STORAGE_KEY, afterDel);
await deleteHeartbeatTask(reviveId);
const revived = await markHeartbeatFinished(reviveId, { ok: true, result: 'ghost' });
ok(revived == null, '删掉后再收尾不会把任务写回来');
ok(!(mem.get(HEARTBEAT_STORAGE_KEY) || []).some((t) => t.id === reviveId), '任务表里没有被复活的条目');

const noon = new Date();
noon.setHours(12, 0, 0, 0);
const nineToday = new Date(noon);
nineToday.setHours(9, 0, 0, 0);
const nineYest = new Date(nineToday);
nineYest.setDate(nineYest.getDate() - 1);
mem.set(HEARTBEAT_STORAGE_KEY, [
  task('daily-yest', { schedule: { type: 'daily', time: '09:00' }, nextRunAt: nineYest.getTime(), lastStatus: null }),
  task('once-yest', { schedule: { type: 'once', at: nineYest.getTime() }, nextRunAt: nineYest.getTime(), lastStatus: null }),
  task('today-overdue', { schedule: { type: 'daily', time: '09:00' }, nextRunAt: nineToday.getTime(), lastStatus: null }),
]);
const catchUp = await claimDueHeartbeatTasks(noon.getTime());
const catchIds = catchUp.map((t) => t.id).sort();
ok(catchIds.includes('daily-yest') && catchIds.includes('today-overdue'), '隔日 daily 跳到今天后仍可当天补跑；当天过期直接补');
ok(!catchIds.includes('once-yest'), '隔日一次性任务不再领取');
const onceSaved = mem.get(HEARTBEAT_STORAGE_KEY).find((t) => t.id === 'once-yest');
ok(onceSaved.enabled === false && !onceSaved.nextRunAt, '隔日 once 停用且不再排期');

mem.set(HEARTBEAT_STORAGE_KEY, [
  task('orphan', { projectId: 'gone-pid', nextRunAt: now + 60_000 }),
  task('keep-default', { projectId: 'default', nextRunAt: now + 60_000 }),
]);
mem.set(heartbeatSessionsKey('gone-pid'), { orphan: { history: [] } });
mem.set(heartbeatInboxKey('gone-pid'), [{ taskId: 'orphan' }]);
const wiped = await purgeAllHeartbeatTasks();
ok(wiped.map((t) => t.id).sort().join(',') === 'keep-default,orphan', '全量删除返回全部任务');
ok((mem.get(HEARTBEAT_STORAGE_KEY) || []).length === 0, '全量删除后任务表为空');
ok(!mem.has(heartbeatSessionsKey('gone-pid')), '全量删除清掉无主项目线程');
ok(!alarms.has(HEARTBEAT_ALARM), '没有启用任务时清掉 heartbeat alarm');
await restoreHeartbeatTasks(wiped);
ok((mem.get(HEARTBEAT_STORAGE_KEY) || []).some((t) => t.id === 'orphan'), '撤销能把无主心跳写回');

console.log(`heartbeat-background-smoke: ${passed} ok`);
