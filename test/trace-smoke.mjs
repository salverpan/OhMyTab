/* 任务追踪思维导图冒烟（node test/trace-smoke.mjs）：trace-log / trace-model / dagre 布局 / 详情卡。 */

import assert from 'node:assert';

const store = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(k) { return typeof k === 'string' ? { [k]: store[k] } : { ...store }; },
      async set(obj) { Object.assign(store, JSON.parse(JSON.stringify(obj))); },
      async remove(k) { delete store[k]; },
    },
    sync: { async get() { return {}; }, async set() {}, async remove() {} },
  },
  runtime: { getURL: (p) => `chrome-extension://test/${p}`, onMessage: { addListener() {} } },
  alarms: { async clear() {}, async get() { return null; }, create() {} },
};

const T = await import('../src/lib/trace-log.js');
T.__useMemoryBackend();
const { buildTraceGraph, isGraphEmpty, focusNodeIds, ROOT_ID } = await import('../src/lib/trace-model.js');
const { layoutGraph } = await import('../src/lib/trace-layout.js');
const { traceDetailHtml } = await import('../src/sidepanel/trace-graph.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

// —— trace-log：规范化 / upsert / 截断 / 修剪 / 清理 ——
const long = 'x'.repeat(2000);
const w = T.putTrace({ projectId: 'p1', kind: 'turn', subtype: 'user', title: long, text: long, status: 'running', ts: 1000,
  refs: { taskId: 't1', secret: 'NOPE', docId: 'd1' } });
await w.done;
ok(w.node.title.length <= 161 && w.node.text.length <= 601, '标题与正文被截断');
ok(w.node.refs.taskId === 't1' && w.node.refs.docId === 'd1' && !('secret' in w.node.refs), 'refs 只保留白名单字段');
ok(w.node.threadId === T.CHAT_THREAD && w.node.parentId === '', '默认线程为对话');

await T.putTrace({ ...w.node, status: 'ok', endedAt: 5000 }).done;
let rows = await T.listTrace('p1');
ok(rows.length === 1 && rows[0].status === 'ok' && rows[0].endedAt === 5000, '同 id 再写是更新而非新增');
ok(T.normalizeTraceNode({ kind: 'bogus' }).kind === 'action', '未知 kind 归为 action');

for (let i = 0; i < 6; i++) await T.putTrace({ id: `n${i}`, projectId: 'p2', kind: 'action', title: `a${i}`, ts: 100 + i }).done;
await T.trimTrace('p2', 4);
ok((await T.countTrace('p2')) === 4 && (await T.listTrace('p2')).every((r) => r.title !== 'a0' && r.title !== 'a1'), 'trim 丢最旧');
await T.clearTrace('p2');
ok((await T.countTrace('p2')) === 0 && (await T.countTrace('p1')) === 1, 'clear 只清本项目');

// —— 子代理报告 -> claim / unresolved / action 节点 ——
const reportNodes = T.subagentReportNodes({
  projectId: 'p1', parentId: 'sa1', threadId: 'chat', ts: 2000,
  report: {
    summary: 's',
    claims: [{ id: 'c1', claim: '油价上涨', confidence: 'high', evidence: [] }, { id: 'c2', claim: '库存下降', confidence: 'low', evidence: [] }],
    unresolved: ['需要确认来源'],
    actions: [{ description: '创建文档', result_ref: 'doc_9' }],
  },
  verification: { claims: [{ id: 'c1', verdict: 'cross-source-pass', reason: '' }, { id: 'c2', verdict: 'citation-fail', reason: '引文不存在' }] },
});
ok(reportNodes.length === 4 && reportNodes.every((n) => n.parentId === 'sa1'), '报告展开为 4 个子节点');
ok(reportNodes.find((n) => n.title === '库存下降').status === 'citation-fail'
  && reportNodes.find((n) => n.title === '库存下降').text === '引文不存在', '断言带核验 verdict 与理由');
ok(T.subagentReportNodes({ report: null }).length === 0, '无报告不产生节点');

// —— buildTraceGraph：层级 / 笔记归属 / 修正边 ——
const t0 = 1_700_000_000_000;
const tn = (o) => T.normalizeTraceNode({ projectId: 'p1', ...o });
const nodes = [
  tn({ id: 'turn1', kind: 'turn', subtype: 'user', title: '帮我查油价', ts: t0, endedAt: t0 + 30000, status: 'ok' }),
  tn({ id: 'reply1', parentId: 'turn1', kind: 'agent', title: '主代理回复', text: '油价 80', ts: t0 + 29000 }),
  tn({ id: 'sa1', parentId: 'turn1', kind: 'subagent', subtype: 'explore', title: '查油价', ts: t0 + 1000, status: 'completed' }),
  tn({ id: 'sa1:c1', parentId: 'sa1', kind: 'claim', title: '油价 80', status: 'cross-source-pass', ts: t0 + 20000 }),
  tn({ id: 'hb1', threadId: 'hb_oil', kind: 'turn', subtype: 'heartbeat', title: '心跳运行 · 油价', ts: t0 + 100000, endedAt: t0 + 130000 }),
  tn({ id: 'hb2', threadId: 'hb_oil', kind: 'turn', subtype: 'heartbeat', title: '心跳运行 · 油价', ts: t0 + 1300000, endedAt: t0 + 1330000 }),
];
const notes = [
  { id: 'j1', claim: '20 分钟内突破 82', kind: 'judgment', status: 'refuted', confidence: 'high', threadId: 'hb_oil', createdAt: t0 + 110000, supersededBy: 'j2',
    history: [{ ts: t0 + 110000, from: null, to: 'open' }, { ts: t0 + 1310000, from: 'open', to: 'refuted', reason: '实际 79' }] },
  { id: 'j2', claim: '回落到 78', kind: 'judgment', status: 'open', confidence: 'medium', threadId: 'hb_oil', createdAt: t0 + 1310000, supersedes: 'j1' },
  { id: 'o1', claim: '现价 79', kind: 'observation', status: 'open', threadId: 'hb_oil', createdAt: t0 + 1305000 },
  { id: 'free', claim: '手写笔记', kind: 'judgment', status: 'open', createdAt: t0 + 9_999_999 },
];
const tasks = [{ id: 'hb_oil', name: '追踪油价', enabled: true }];
const g = buildTraceGraph({ nodes, notes, tasks, now: t0 + 2_000_000 });
const byId = new Map(g.nodes.map((n) => [n.id, n]));
const parent = (id) => g.edges.find((e) => e.type === 'tree' && e.target === id)?.source;

ok(byId.has(ROOT_ID) && g.nodes.filter((n) => n.kind === 'thread').length === 2, '根下有 对话 + 心跳 两个线程');
ok(parent('turn1') === 'thread:chat' && parent('hb1') === 'thread:hb_oil', '回合挂在所属线程下');
ok(parent('sa1') === 'turn1' && parent('reply1') === 'turn1' && parent('sa1:c1') === 'sa1', '回复 / 子代理 / 断言的层级');
ok(byId.get('thread:hb_oil').title === '追踪油价', '心跳线程用任务名');
ok(parent('note:j1') === 'hb1' && parent('note:j2') === 'hb2' && parent('note:o1') === 'hb2', '判断按时间窗挂到所属心跳回合');
ok(parent('note:free') === 'thread:chat', '超出回合宽限的手写笔记挂线程根');
const revise = g.edges.filter((e) => e.type === 'revise');
ok(revise.length === 1 && revise[0].source === 'note:j1' && revise[0].target === 'note:j2', '修正边：旧判断 -> 新判断');
ok(byId.get('note:j1').status === 'refuted' && byId.get('note:j1').meta.supersededBy === 'j2', '旧判断带 supersededBy');
ok(g.stats.revisions === 1 && g.stats.judgments === 3, '统计');

const kids = (id) => g.edges.filter((e) => e.type === 'tree' && e.source === id).map((e) => e.target);
ok(kids('turn1')[0] === 'sa1', '同级按时间升序（子代理早于回复）');
const order = g.nodes.filter((n) => n.kind === 'thread').map((n) => n.id);
ok(order[0] === 'thread:chat', '最近有活动的线程排在前面（手写笔记最新）');

// 折叠：默认每线程只展开最近 N 回合；overrides 优先；修正边重定向
const many = [];
for (let i = 0; i < 8; i++) {
  many.push(tn({ id: `m${i}`, kind: 'turn', subtype: 'user', title: `问题${i}`, ts: t0 + i * 1000 }));
  many.push(tn({ id: `m${i}r`, parentId: `m${i}`, kind: 'agent', title: '回复', ts: t0 + i * 1000 + 500 }));
}
const folded = buildTraceGraph({ nodes: many, notes: [], tasks: [], recentTurns: 5, now: t0 + 1e6 });
const fm = new Map(folded.nodes.map((n) => [n.id, n]));
ok(fm.get('m0').collapsed && fm.get('m0').hiddenCount === 1 && !fm.has('m0r'), '更早的回合折叠且子节点被剔除');
ok(!fm.get('m7').collapsed && fm.has('m7r'), '最近回合展开');
const reopened = buildTraceGraph({ nodes: many, notes: [], tasks: [], recentTurns: 5, overrides: { m0: 'expanded', m7: 'collapsed' }, now: t0 + 1e6 });
ok(!reopened.nodes.find((n) => n.id === 'm0').collapsed && reopened.nodes.some((n) => n.id === 'm0r')
  && reopened.nodes.find((n) => n.id === 'm7').collapsed, '用户 overrides 覆盖默认折叠');

const hiddenRevise = buildTraceGraph({
  nodes: [
    tn({ id: 'a1', threadId: 'hb_oil', kind: 'turn', title: 'r1', ts: t0 }),
    tn({ id: 'a2', threadId: 'hb_oil', kind: 'turn', title: 'r2', ts: t0 + 1000 }),
  ],
  notes: [
    { id: 'x1', claim: 'old', kind: 'judgment', status: 'refuted', threadId: 'hb_oil', createdAt: t0 + 10, supersededBy: 'x2' },
    { id: 'x2', claim: 'new', kind: 'judgment', status: 'open', threadId: 'hb_oil', createdAt: t0 + 1010, supersedes: 'x1' },
  ],
  tasks, recentTurns: 1, now: t0 + 1e5,
});
const rv = hiddenRevise.edges.find((e) => e.type === 'revise');
ok(rv && rv.source === 'a1' && rv.target === 'note:x2', '旧判断被折叠时修正边重定向到可见祖先');

const focus = new Set(focusNodeIds(g));
ok(focus.has(ROOT_ID) && focus.has('thread:chat') && focus.has('note:free'), '聚焦集合取最近活跃线程');
const focusMany = new Set(focusNodeIds(folded));
ok(focusMany.has('m7') && focusMany.has('m7r') && !focusMany.has('m6') && !focusMany.has('m0'), '聚焦集合只含最新回合的整棵子树');
ok(focusNodeIds(buildTraceGraph({})).length === 1 && focusNodeIds(null).length === 0, '空图聚焦');

// 异常数据：环 / 孤儿 / 空
const cyc = buildTraceGraph({
  nodes: [tn({ id: 'c1', parentId: 'c2', kind: 'turn', ts: 1 }), tn({ id: 'c2', parentId: 'c1', kind: 'turn', ts: 2 }), tn({ id: 'o', parentId: 'ghost', kind: 'subagent', ts: 3 })],
  notes: [], tasks: [],
});
ok(cyc.nodes.some((n) => n.id === 'c1') && cyc.nodes.some((n) => n.id === 'c2'), '环状 parentId 不会卡死，节点仍可见');
ok(cyc.edges.some((e) => e.type === 'tree' && e.target === 'o' && e.source === 'thread:chat'), '找不到父节点的孤儿挂线程根');
ok(isGraphEmpty(buildTraceGraph({})) && !isGraphEmpty(g), '空图判定');

// —— dagre 布局 ——
const lay = layoutGraph(g);
const pos = new Map(lay.nodes.map((n) => [n.id, n]));
ok(lay.nodes.length === g.nodes.length && lay.width > 0 && lay.height > 0, '每个节点都有坐标');
let overlap = 0;
for (let i = 0; i < lay.nodes.length; i++) {
  for (let j = i + 1; j < lay.nodes.length; j++) {
    const a = lay.nodes[i];
    const b = lay.nodes[j];
    if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) overlap += 1;
  }
}
ok(overlap === 0, '节点互不重叠');
ok(g.edges.filter((e) => e.type === 'tree').every((e) => pos.get(e.source).x < pos.get(e.target).x), '父节点总在子节点左侧（从左到右）');

// —— 详情卡：转义 + 新旧对比 + 笔记跳转 ——
const noteById = new Map(notes.map((n) => [n.id, n]));
const card = traceDetailHtml(byId.get('note:j2'), noteById);
ok(card.includes('修正前') && card.includes('20 分钟内突破 82') && card.includes('data-tg-note="j2"'), '判断详情：新旧对比 + 打开笔记');
const cardOld = traceDetailHtml(byId.get('note:j1'), noteById);
ok(cardOld.includes('被修正为') && cardOld.includes('回落到 78') && cardOld.includes('实际 79'), '被推翻判断：指向修正后内容并保留理由');
const evil = traceDetailHtml({ id: 'x', kind: 'agent', title: '<img onerror=1>', text: '<script>1</script>', status: 'ok', ts: t0, meta: {} });
ok(!evil.includes('<script>') && !evil.includes('<img onerror') && evil.includes('&lt;script&gt;'), '详情卡转义 HTML');
ok(traceDetailHtml(null) === '', '无选中时不渲染');

console.log(`trace smoke passed: ${passed} assertions`);
