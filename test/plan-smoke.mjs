/* 任务清单工具冒烟（node test/plan-smoke.mjs）：存储读写 + UI 通知 + 项目隔离。
   chrome.storage.local 用内存 stub（本仓其它冒烟不碰 chrome.*，这里必须碰）。 */

import assert from 'node:assert';

const store = new Map();
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        const keys = Array.isArray(key) ? key : [key];
        const out = {};
        for (const k of keys) if (store.has(k)) out[k] = JSON.parse(store.get(k));
        return out;
      },
      async set(obj) {
        for (const [k, v] of Object.entries(obj)) store.set(k, JSON.stringify(v));
      },
      async remove(key) {
        for (const k of (Array.isArray(key) ? key : [key])) store.delete(k);
      },
    },
  },
};

const { planTool, getPlan } = await import('../src/lib/plan.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

// —— set：落盘 + 通知宿主（清单卡就地更新靠这个回调）——
const notified = [];
const ctx = { projectId: 'p1', onPlan: (p) => notified.push(p) };
const r1 = await planTool({ action: 'set', items: [{ text: '拉数据', status: 'doing' }, { text: '写结论' }] }, ctx);
ok(typeof r1 === 'string' && r1.includes('0/2 已完成'), 'set 返回带进度的清单文本: ' + r1.split('\n')[0]);
ok(notified.length === 1 && notified[0].items.length === 2, 'set 必须通知宿主一次并带完整清单');
ok(notified[0].items[0].status === 'doing' && notified[0].items[1].status === 'todo', '通知里状态正确');
const stored = await getPlan('p1');
ok(stored.items.length === 2 && stored.updatedAt > 0, '清单已落盘（plan_p<id>）');
ok(store.has('plan_p1'), '存储键为 plan_<projectId>');

// —— set 整表重发语义：旧条目被替换，不是追加 ——
const r2 = await planTool({ action: 'set', items: [{ text: '拉数据', status: 'done' }, { text: '写结论', status: 'doing' }] }, ctx);
ok(r2.includes('1/2 已完成'), 'set 是整表替换: ' + r2.split('\n')[0]);
ok((await getPlan('p1')).items.length === 2, '重发后条目数不增长');
ok(notified.length === 2, '每次 set 都通知宿主');

// —— get：读回 ——
const r3 = await planTool({ action: 'get', items: [] }, ctx);
ok(r3.includes('[✓] 拉数据') && r3.includes('[→] 写结论'), 'get 返回带状态符号的清单');
ok(notified.length === 2, 'get 不触发 UI 通知');

// —— 项目隔离 ——
await planTool({ action: 'set', items: ['别的项目'] }, { projectId: 'p2', onPlan: () => {} });
ok((await getPlan('p1')).items.length === 2, '另一项目的清单互不干扰');

// —— 空清单 / 非法动作 / 缺 ctx.onPlan 都不崩 ——
const bad = await planTool({ action: 'set', items: [] }, ctx);
ok(/items 至少要有一条/.test(bad) && notified.length === 2, '空清单报错且不通知宿主');
const unknown = await planTool({ action: 'bogus' }, ctx);
ok(/只支持 set/.test(unknown), '未知 action 提示可用动作');
const noCb = await planTool({ action: 'set', items: ['无回调'] }, { projectId: 'p3' });
ok(noCb.includes('0/1 已完成'), '宿主未提供 onPlan 时不抛错');

// —— clear：撤卡（通知 null）+ 删除存储键 ——
const r4 = await planTool({ action: 'clear' }, { projectId: 'p3', onPlan: (p) => notified.push(p) });
ok(r4.includes('已清空') && notified[notified.length - 1] === null, 'clear 通知 null（宿主据此撤卡）');
ok(!store.has('plan_p3'), 'clear 删除存储键');

console.log(`plan-smoke: ${passed} ok`);
