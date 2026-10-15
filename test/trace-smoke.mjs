/* 任务追踪冒烟（node test/trace-smoke.mjs）：trace-log / trace-model / 简报 / ChatFlow。 */

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
const { buildTraceGraph, isGraphEmpty, focusNodeIds, ROOT_ID, buildProcessTimeline, isProcessEmpty } = await import('../src/lib/trace-model.js');
const { traceDetailHtml } = await import('../src/sidepanel/trace-graph.js');
const { chatFlowHtml } = await import('../src/sidepanel/chat-flow-view.js');
const { briefingHtml } = await import('../src/sidepanel/briefing-view.js');
const { buildBriefing } = await import('../src/lib/briefing-model.js');

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
const withFindings = T.subagentReportNodes({
  projectId: 'p1', parentId: 'sa1', threadId: 'chat', ts: 2000,
  report: {
    summary: 's',
    findings: [{ question: '价格？', answer: '在涨', supporting: ['c1'], contradicting: ['c2'], confidence: 'high' }],
    claims: [{ id: 'c1', claim: '油价上涨', evidence: [] }],
    unresolved: [], actions: [],
  },
});
ok(withFindings.some((n) => n.kind === 'finding' && n.meta.support[0] === 'sa1:c1'), 'finding 挂支撑 claim 节点 id');

const outlineNodes = T.reportTraceNodes({
  projectId: 'p1', parentId: 'turn1', threadId: 'chat', reportId: 'rp1', title: '格局变化',
  question: '低成本化会怎样？', entryId: 'doc-9',
  outline: {
    title: '格局变化', bluf: '价格战将蔓延',
    key_judgments: [{ judgment: '价格战很可能蔓延', confidence: 'medium', likelihood: '很可能', basis: ['E1'], counter: ['E2'], reasoning: '单价与产能' }],
    uncertainties: [{ issue: '停产传闻', basis: ['E2'] }],
    gaps: ['缺官方数据'],
  },
  evidence: [
    { id: 'E1', claim: '单价降至 400', verdict: 'entailment-pass', modality: 'claimed', attribution: 'A 厂', sources: [{ doc_id: 'd1', quote: '400' }] },
    { id: 'E2', claim: '已停产', verdict: 'overclaim', modality: 'speculative', sources: [{ doc_id: 'd2', quote: '暂停' }] },
    { id: 'E3', claim: '无关', verdict: 'entailment-pass', sources: [] },
  ],
});
ok(outlineNodes[0].kind === 'report' && outlineNodes[0].refs.entryId === 'doc-9', '研报节点带产出 id');
ok(outlineNodes.some((n) => n.kind === 'kj' && n.meta.support[0] === 'rp1:E1'), '核心判断挂证据节点');
ok(!outlineNodes.some((n) => n.title === '无关'), '未引用的证据不进图');
ok(T.normalizeTraceNode({ kind: 'finding' }).kind === 'finding', 'finding 是合法 kind');

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

const proc = buildProcessTimeline({
  nodes: [
    tn({ id: 'idle1', kind: 'turn', subtype: 'user', title: '怎么全是标签格式？', ts: t0 }),
    tn({ id: 'idle1r', parentId: 'idle1', kind: 'agent', title: '那是核验标签', ts: t0 + 10 }),
    tn({ id: 'work1', kind: 'turn', subtype: 'user', title: '稀土替代深度调研', ts: t0 + 100 }),
    tn({ id: 'saW', parentId: 'work1', kind: 'subagent', subtype: 'explore', title: '查论文', ts: t0 + 110, endedAt: t0 + 210, status: 'completed' }),
    ...T.subagentReportNodes({
      projectId: 'p1', parentId: 'saW', threadId: 'chat', ts: t0 + 200,
      report: {
        summary: 's',
        findings: [{ question: '替代进展？', answer: '中试阶段', supporting: ['c1'], contradicting: [], confidence: 'medium' }],
        claims: [{ id: 'c1', claim: '中试已启动', evidence: [] }],
        unresolved: [], actions: [],
      },
      verification: { claims: [{ id: 'c1', verdict: 'entailment-pass' }] },
    }),
  ],
  notes: [], tasks: [],
});
ok(!isProcessEmpty(proc), '过程时间线非空');
const idle = proc.threads[0].turns.find((t) => t.id === 'idle1');
const work = proc.threads[0].turns.find((t) => t.id === 'work1');
ok(idle.grade === 'idle' && work.grade === 'work', '闲聊回合降级，调研回合保留');
ok(work.subagents[0].groups[0].question === '替代进展？' && work.subagents[0].counts.pass === 1, '断言按 finding 分组');
const flowHtml = chatFlowHtml(proc);
ok(flowHtml.includes('ChatFlow') && flowHtml.includes('稀土替代深度调研') && !flowHtml.includes('怎么全是标签格式'), 'ChatFlow 只画调研回合');
ok(!flowHtml.includes('这条对话怎么走的') && flowHtml.includes('子代理'), 'ChatFlow 标题与派出线');
const brief = buildBriefing({
  nodes: [
    tn({ id: 'turnR', kind: 'turn', subtype: 'user', title: '稀土替代调研', ts: t0 }),
    ...T.reportTraceNodes({
      projectId: 'p1', parentId: 'turnR', threadId: 'chat', reportId: 'rpX', title: '定点前夜',
      question: '稀土替代到哪了',
      outline: {
        title: '定点前夜', bluf: '只会在 A0 上车',
        key_judgments: [{ judgment: '铁氧体先上 A0', confidence: 'medium', likelihood: '很可能', basis: ['E1'], counter: [], reasoning: '定点指向入门车' }],
      },
      evidence: [
        { id: 'E1', claim: '入门版采用铁氧体', verdict: 'entailment-pass', sources: [{ quote: '量产' }] },
      ],
    }),
  ],
});
const briefHtml = briefingHtml(brief);
ok(briefHtml.includes('j-trio') && briefHtml.includes('支撑') && briefHtml.includes('反对') && briefHtml.includes('未核'), '简报三列计数');
ok(!briefHtml.includes('tb-bar') && !briefHtml.includes('条越绿'), '简报不再用证据条');

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
