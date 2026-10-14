/* 决策板与 P0 核验冒烟（node test/decision-smoke.mjs）：
 * 独立信源计数、claim 归因/模态、子代理预算、限额归一化、决策板模型与渲染。 */

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

const I = await import('../src/lib/check/independence.js');
const { validateTaskReport, reportForMain, normalizeModality } = await import('../src/lib/task-report.js');
const { budgetState } = await import('../src/lib/subagent.js');
const { normalizeSubagentLimits } = await import('../src/lib/storage.js');
const D = await import('../src/lib/decision-model.js');
const { decisionBoardHtml } = await import('../src/sidepanel/decision-board.js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

// ---------- 独立信源 ----------
ok(I.registrableDomain('news.bbc.co.uk') === 'bbc.co.uk', 'co.uk 主域名');
ok(I.registrableDomain('www.reuters.com') === 'reuters.com', 'www 去掉');
ok(I.registrableDomain('finance.yahoo.com') === 'yahoo.com', '子域归并');
ok(I.sourceIdentityOf({ publisher: 'Reuters', url: 'https://finance.yahoo.com/x' }) === 'pub:reuters', '发布方优先于域名');
ok(I.sourceIdentityOf({ url: 'https://a.bbc.co.uk/x' }) === 'dom:bbc.co.uk', '无发布方用主域名');
ok(I.sourceIdentityOf({ fallback: 'e1' }) === 'doc:e1', '都没有回落 doc');

const wire = 'The defense ministry said on Tuesday that 40 drones were intercepted over the Black Sea overnight.';
ok(I.quoteSimilarity(wire, `${wire} Officials gave no further details.`) === 1, '包含关系视为同文');
ok(I.quoteSimilarity(wire, '据当地媒体报道，港口附近发生爆炸，暂无伤亡信息。') < 0.2, '不同文本相似度低');

const syndicated = I.independentSources([
  { sourceIdentity: 'dom:reuters.com', evidence: { quote: wire } },
  { sourceIdentity: 'dom:yahoo.com', evidence: { quote: wire } },
  { sourceIdentity: 'dom:msn.com', evidence: { quote: `${wire} Officials gave no further details.` } },
]);
ok(syndicated.count === 1, '三家转同一通稿只算 1 个独立来源');

const independent = I.independentSources([
  { sourceIdentity: 'dom:reuters.com', evidence: { quote: wire } },
  { sourceIdentity: 'pub:kyivindependent', evidence: { quote: 'Air defense units reported shooting down dozens of Shahed-type drones near Odesa.' } },
  { sourceIdentity: 'dom:reuters.com', evidence: { quote: 'another passage' } },
]);
ok(independent.count === 2, '不同发布方、不同文本算 2 个');

// ---------- claim 归因 / 模态 ----------
const evidence = [{ doc_id: 'e1', anchor: 'p1', quote: 'q' }];
const r = validateTaskReport({
  summary: 's',
  claims: [
    { id: 'c1', claim: '俄国防部称拦截 40 架无人机', attribution: '俄国防部', modality: 'claimed', event_time: '2026-10-06', evidence },
    { id: 'c2', claim: 'x', modality: 'bogus', evidence },
  ],
  actions: [],
  unresolved: ['未找到乌方回应'],
});
ok(!r.error, '报告校验通过');
ok(r.report.claims[0].attribution === '俄国防部' && r.report.claims[0].modality === 'claimed', '保留归因与模态');
ok(r.report.claims[0].event_time === '2026-10-06', '保留事件时间');
ok(r.report.claims[1].modality === 'reported', '非法模态回落 reported');
ok(normalizeModality('confirmed') === 'confirmed', 'confirmed 合法');
const forMain = reportForMain(r.report);
ok(forMain.claims[0].modality === 'claimed' && forMain.claims[0].attribution === '俄国防部', '主代理摘要带模态');

// ---------- 预算 ----------
const t0 = Date.now();
ok(budgetState({ tokens: 1000, ms: 0 }, 900, t0).ratio >= 0.9, 'token 比例');
ok(budgetState({ tokens: 1000, ms: 0 }, 900, t0).by === 'token', '由 token 触发');
ok(budgetState({ tokens: 0, ms: 1000 }, 0, t0 - 2000).ratio >= 2, '耗时比例');
ok(budgetState({ tokens: 0, ms: 1000 }, 0, t0 - 2000).by === 'time', '由耗时触发');
ok(budgetState({ tokens: 0, ms: 0 }, 1e9, 0).ratio === 0, '0 = 不限');

const lim = normalizeSubagentLimits(null);
ok(lim.budgetTokens > 0 && lim.budgetMinutes > 0 && lim.checkChannelId === '', '默认限额');
ok(normalizeSubagentLimits({ budgetTokens: 0, budgetMinutes: 0 }).budgetTokens === 0, '允许设为不限');

// ---------- 决策板 ----------
const now = Date.UTC(2026, 9, 7, 12);
const H = 3600 * 1000;
const nodes = [
  { id: 'u1', kind: 'turn', subtype: 'user', title: '评估黑海无人机袭击态势', threadId: 'chat', ts: now - 5 * H },
  { id: 'g1', kind: 'insight', subtype: 'goal', title: '判断黑海袭击是否升级', status: 'active', threadId: 'chat', ts: now - 5 * H },
  { id: 'k1', kind: 'insight', subtype: 'conclusion', title: '袭击频率上升但规模未变', status: 'active', threadId: 'chat', ts: now - 2 * H, meta: { confidence: 'medium', trend: 'up' } },
  { id: 'k0', kind: 'insight', subtype: 'conclusion', title: '袭击频率稳定', status: 'superseded', threadId: 'chat', ts: now - 30 * H, endedAt: now - 2 * H },
  { id: 'a1', kind: 'insight', subtype: 'ask', title: '是否扩大到亚速海', status: 'open', threadId: 'chat', ts: now - H, meta: { options: ['扩大', '维持'] } },
  { id: 'n1', kind: 'insight', subtype: 'next', title: '查乌方海军通报', status: 'open', threadId: 'chat', ts: now - H },
  { id: 'r1', kind: 'insight', subtype: 'risk', title: '俄方数字可能夸大', status: 'open', threadId: 'chat', ts: now - H },
  { id: 's1', kind: 'subagent', title: '查拦截数字', threadId: 'chat', ts: now - 3 * H },
  { id: 's1:c1', kind: 'claim', subtype: 'high', title: '俄国防部称拦截 40 架', status: 'entailment-pass', threadId: 'chat', ts: now - 3 * H, meta: { modality: 'claimed' } },
  { id: 's1:c2', kind: 'claim', subtype: 'medium', title: '敖德萨港口受损', status: 'cross-source-pass', threadId: 'chat', ts: now - 3 * H, meta: { modality: 'confirmed', sources: 2 } },
  { id: 's1:c3', kind: 'claim', subtype: 'medium', title: '船只沉没', status: 'source-conflict', threadId: 'chat', ts: now - 3 * H },
  { id: 's1:u1', kind: 'unresolved', title: '未找到乌方伤亡数字', threadId: 'chat', ts: now - 3 * H },
  { id: 'h1', kind: 'turn', subtype: 'heartbeat', title: '例行', threadId: 'hb_1', ts: now - 4 * H },
  { id: 'h1:c1', kind: 'claim', subtype: 'low', title: '某厂交付新型号', status: 'entailment-pass', threadId: 'hb_1', ts: now - 4 * H },
];
const notes = [
  { id: 'note1', claim: '港口防空薄弱', status: 'open', confidence: 'high', threadId: 'chat', updatedAt: now - 3 * H, verifyAt: now - H },
  { id: 'note2', claim: '袭击由新型号执行', status: 'refuted', threadId: 'chat', updatedAt: now - H,
    history: [{ ts: now - H, from: 'open', to: 'refuted', reason: '型号识别错误' }] },
  { id: 'note3', claim: '已放弃的旧判断', status: 'dropped', threadId: 'chat', updatedAt: now - H },
];
const tasks = [{ id: 'hb_1', name: '无人机厂商动态', enabled: true, nextRunAt: now + H }];

const board = D.buildDecisionBoard({ nodes, notes, tasks, now });
ok(!board.empty, '有内容');
ok(board.attention.asks.length === 1 && board.attention.asks[0].options.length === 2, '待拍板带备选');
ok(board.attention.overdue.some((o) => o.noteId === 'note1'), '到期笔记进关注区');
ok(board.attention.alerts.some((a) => a.type === 'refuted'), '被推翻进关注区');
ok(board.attention.alerts.some((a) => a.type === 'replaced'), '结论被替换进关注区');

const chat = board.issues.find((t) => t.threadId === 'chat');
ok(board.issues[0].threadId === 'chat', '有待拍板的议题排第一');
ok(chat.title === '判断黑海袭击是否升级', '议题标题取 goal');
ok(chat.conclusion && chat.conclusion.title === '袭击频率上升但规模未变', '取当前有效结论');
ok(chat.strength.total === 3 && chat.strength.strong === 1 && chat.strength.single === 1 && chat.strength.contested === 1, '证据强度分档');
ok(chat.strength.weakModality === 1, '“某方称”计为弱模态');
ok(chat.disputes.some((d) => d.type === 'source-conflict') && chat.disputes.some((d) => d.type === 'risk'), '分歧含冲突与风险');
ok(chat.gaps.some((g) => g.type === 'unresolved') && chat.gaps.some((g) => g.type === 'next'), '缺口含未查清与下一步');
ok(chat.gaps.some((g) => g.type === 'single-source'), '高置信单源进缺口');
ok(chat.judgments.every((j) => j.noteId !== 'note2' && j.noteId !== 'note3'), '被推翻/放弃的判断不列为现行判断');
ok(chat.judgments[0].noteId === 'note1' && chat.judgments[0].overdue, '到期判断置顶');
ok(chat.subagents === 1, '调研次数');

const hb = board.issues.find((t) => t.threadId === 'hb_1');
ok(hb && hb.title === '无人机厂商动态' && hb.kind === 'heartbeat' && hb.nextRunAt === now + H, '心跳议题');

const deleted = D.buildDecisionBoard({ nodes: [{ id: 'x', kind: 'claim', title: 't', status: 'entailment-pass', threadId: 'hb_gone', ts: now }], now });
ok(deleted.issues[0].deleted, '任务已删除标记');
ok(D.buildDecisionBoard({ now }).empty, '空输入为空');

ok(D.researchPrompt('黑海', { type: 'single-source', title: 'X' }).includes('第二来源'), '单源调研指令');
ok(D.decisionPrompt({ title: 'A', options: ['1', '2'] }).includes('1 / 2'), '决策指令带备选');

// ---------- 渲染 ----------
const html = decisionBoardHtml(board);
ok(html.includes('需要你关注') && html.includes('待你拍板'), '关注区');
ok(html.includes('当前结论') && html.includes('置信中') && html.includes('↑'), '结论与趋势');
ok(html.includes('db-seg is-strong') && html.includes('db-seg is-contested'), '强度条');
ok(html.includes('data-db-draft=') && html.includes('派去调研'), '调研按钮');
ok(html.includes('data-db-note="note1"'), '笔记可点开');
ok(html.includes('只证明了“某方这么说”'), '弱模态提示');
ok(!/<script/i.test(decisionBoardHtml(D.buildDecisionBoard({
  nodes: [{ id: 'q', kind: 'insight', subtype: 'goal', title: '<script>alert(1)</script>', status: 'active', threadId: 'chat', ts: now }], now,
}))), '转义');
ok(decisionBoardHtml({ empty: true }).includes('db-empty'), '空态');

console.log(`decision-smoke: ${passed} assertions passed`);
