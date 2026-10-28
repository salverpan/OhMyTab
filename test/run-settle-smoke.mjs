/* 父代理失败收口 / 子任务等待冒烟。不碰 chrome.* */

import assert from 'node:assert';
import {
  hasLiveChildren, waitForLiveChildren, abortAndSettleChildren, recoverParentLlmCall,
} from '../src/lib/run-settle.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(!hasLiveChildren(null), '空 ctx 无子任务');
ok(!hasLiveChildren({ runningSubagents: new Set(), backgroundAborts: new Set() }), '空集合不算活动');
ok(hasLiveChildren({ runningSubagents: new Set(['sg_1']) }), 'runningSubagents 算活动');
ok(hasLiveChildren({ backgroundAborts: new Set([new AbortController()]) }), '未中止的 backgroundAborts 算活动');
{
  const dead = new AbortController();
  dead.abort();
  ok(!hasLiveChildren({ backgroundAborts: new Set([dead]) }), '已 abort 的后台控制器不算活动');
}

const kids = new Set(['a']);
let ticks = 0;
const settled = await waitForLiveChildren(
  { runningSubagents: kids },
  {
    intervalMs: 1,
    sleepFn: async () => {
      ticks += 1;
      if (ticks >= 2) kids.delete('a');
    },
  },
);
ok(settled && kids.size === 0 && ticks >= 2, '等到子任务清空才返回');

const timedOut = await waitForLiveChildren(
  { runningSubagents: new Set(['stuck']) },
  { timeoutMs: 5, intervalMs: 1, sleepFn: async () => {} },
);
ok(timedOut === false, '超时返回 false，不把失败提前写成已结束');

const ac = new AbortController();
const bg = new AbortController();
const leftover = new Set(['sg']);
let waitTicks = 0;
const aborted = await abortAndSettleChildren(ac, {
  runningSubagents: leftover,
  backgroundAborts: new Set([bg]),
}, {
  intervalMs: 1,
  sleepFn: async () => {
    waitTicks += 1;
    leftover.clear();
  },
});
ok(ac.signal.aborted && bg.signal.aborted, '父失败时先 abort 父信号和后台控制器');
ok(aborted && leftover.size === 0 && waitTicks >= 1, 'abort 后再等到子任务退出');

const net = new TypeError('Failed to fetch');
let attempts = 0;
const recovered = await recoverParentLlmCall(async () => {
  attempts += 1;
  if (attempts < 2) throw net;
  return { ok: true };
}, { hasProgress: false, sleepFn: async () => {} });
ok(recovered.action === 'ok' && recovered.result.ok && attempts === 2, '父代理网络中断后静默再打');

attempts = 0;
const salvage = await recoverParentLlmCall(async () => {
  attempts += 1;
  throw net;
}, { hasProgress: true, maxRecoveries: 1, sleepFn: async () => {} });
ok(salvage.action === 'salvage' && attempts === 2, '有进度且重试耗尽则 salvage，不立刻显示失败');

attempts = 0;
const boom = await recoverParentLlmCall(async () => {
  attempts += 1;
  throw net;
}, { hasProgress: false, maxRecoveries: 0, sleepFn: async () => {} });
ok(boom.action === 'throw' && attempts === 1, '无进度且不能再救才 throw');

const userAbort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
const stopped = await recoverParentLlmCall(async () => { throw userAbort; }, { hasProgress: true });
ok(stopped.action === 'abort', '用户中止不重试');

console.log(`run-settle-smoke: ${passed} ok`);
