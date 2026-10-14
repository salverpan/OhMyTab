/* 研报写作阶段冒烟（node test/report-smoke.mjs）。用假模型驱动，不碰 chrome.*。 */

import assert from 'node:assert/strict';
import {
  buildEvidencePool, formatPoolForPrompt, validateOutline, lintReport, renderReport,
  extractRefs, composeReport, OUTLINE_TOOL, writingSystemPrompt,
} from '../src/lib/report-writer.js';
import { collectPassages, splitDraft, writeDocument } from '../src/lib/document-writer.js';
import { validateTaskReport, reportForMain, SUBMIT_REPORT_TOOL } from '../src/lib/task-report.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';
import { toAnthropicTools } from '../src/lib/providers/anthropic-messages.js';
import { toFunctionDeclarations } from '../src/lib/providers/gemini.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

// ---------- findings 协议 ----------
const ev = [{ doc_id: 'doc_a', anchor: 'c1', quote: 'q' }];
const threeClaims = ['甲', '乙', '丙'].map((t, i) => ({ id: `c${i + 1}`, claim: t, attribution: 'X', modality: 'reported', evidence: ev }));
const base = { summary: 's', claims: threeClaims, actions: [], unresolved: [] };
ok(!validateTaskReport(base).error, '默认不强制 findings（章节 Worker 共用）');
ok(/findings/.test(validateTaskReport(base, { requireFindings: true }).error || ''), '调研型交回缺 findings 被拒');
ok(/不存在的 claim id/.test(validateTaskReport({
  ...base, findings: [{ question: 'Q', answer: 'A', supporting: ['c9'], confidence: 'high' }],
}, { requireFindings: true }).error || ''), 'findings 引用未知 claim 被拒');
const withFindings = validateTaskReport({
  ...base,
  findings: [{ question: 'Q1', answer: '甲乙说明趋势在加速', supporting: ['c1', 'c2'], contradicting: ['c3'], confidence: 'medium' }],
}, { requireFindings: true });
ok(!withFindings.error && withFindings.report.findings[0].contradicting[0] === 'c3', 'findings 通过并保留反方');
const forMain = reportForMain(withFindings.report);
ok(forMain.findings[0].question === 'Q1', '主代理摘要带 findings');
ok(forMain.findings[0].supporting[0].id === 'c1' && forMain.findings[0].supporting[0].sources[0] === 'doc_a#c1', '事实挂在判断下并带出处');
ok(forMain.findings[0].contradicting[0].claim === '丙', '反方事实也挂在判断下');
ok(!forMain.claims, '有 findings 时不再平铺 claims');
const piled = reportForMain(validateTaskReport(base).report);
ok(piled.claim_count === 3 && !piled.claims, '多条事实但没有 findings 时只留条数');
ok(!validateTaskReport({ ...base, claims: threeClaims.slice(0, 2) }, { requireFindings: true }).error, '少量 claims 不强制 findings');
ok(SUBMIT_REPORT_TOOL.function.parameters.properties.findings.items.required.includes('answer'), 'submit_report schema 含 findings');

// ---------- 工具注册 ----------
ok(CHAT_TOOLS.some((t) => t.function.name === 'compose_report'), 'CHAT_TOOLS 含 compose_report');
ok(PARENT_ONLY_TOOLS.has('compose_report'), 'compose_report 父级专属');
ok(toAnthropicTools([OUTLINE_TOOL])[0].input_schema.required.includes('key_judgments'), 'Anthropic 骨架 schema');
ok(toFunctionDeclarations([OUTLINE_TOOL])[0].parameters.required.includes('bluf'), 'Gemini 骨架 schema');

// ---------- 证据池 ----------
const passEv = (doc, anchor, quote, url) => ({ status: 'citation-pass', evidence: { doc_id: doc, anchor, quote }, sourceUrl: url });
const sessions = [
  {
    id: 'sg_1',
    description: '查装备',
    report: { findings: [{ question: '成本趋势？', answer: '单价在下降', supporting: ['c1', 'c2'], contradicting: [], confidence: 'medium' }] },
    verification: {
      claims: [
        { id: 'c1', claim: 'A 厂 2026 年单价降至 400 美元', attribution: 'A 厂', modality: 'claimed', verdict: 'entailment-pass', independentSources: 1, evidence: [passEv('doc_1', 'c2', '单价降至 400 美元', 'https://a.test/1')] },
        { id: 'c2', claim: 'B 厂产能翻倍', attribution: '路透社', modality: 'reported', verdict: 'cross-source-pass', independentSources: 2, evidence: [passEv('doc_2', 'c0', '产能翻倍', 'https://b.test/2')] },
        { id: 'c3', claim: 'C 厂已停产', attribution: '匿名', modality: 'speculative', verdict: 'overclaim', reason: '原文只说暂停', evidence: [{ status: 'citation-pass', evidence: { doc_id: 'doc_3', anchor: 'c1', quote: '暂停' } }] },
      ],
    },
  },
  {
    id: 'sg_2',
    description: '查政策',
    report: { findings: [] },
    verification: {
      claims: [
        { id: 'c1', claim: 'B 厂产能翻倍。', attribution: '路透社', modality: 'reported', verdict: 'entailment-pass', independentSources: 1, evidence: [passEv('doc_4', 'c5', '产能翻倍', 'https://c.test/4')] },
        { id: 'c2', claim: '欧盟拟出台出口管制', attribution: '欧盟委员会', modality: 'claimed', verdict: 'entailment-pass', independentSources: 1, evidence: [passEv('doc_5', 'p3', '出口管制', 'https://d.test/5')] },
      ],
    },
  },
  { id: 'sg_3', description: '未完成', verification: null },
];
const pool = buildEvidencePool({ sessions });
ok(pool.taskCount === 2, '只计有核验结果的子任务');
ok(pool.items.length === 4, '跨任务同一主张去重');
ok(pool.usableCount === 3 && pool.items.slice(0, 3).every((i) => i.usable), '已核验证据排在前面');
const merged = pool.items.find((i) => i.claim.startsWith('B 厂'));
ok(merged.sources.length === 2 && merged.independentSources === 2, '去重时合并出处与独立信源数');
ok(pool.findings[0].supporting.length === 2 && pool.findings[0].supporting.every((id) => /^E\d+$/.test(id)), 'findings 映射为全局 E 编号');
ok(buildEvidencePool({ sessions, taskIds: ['sg_2'] }).items.length === 2, 'task_ids 过滤');
const notePool = buildEvidencePool({ notes: [
  { id: 'n1', claim: '笔记事实', status: 'verified', sources: [{ doc_id: 'doc_9', anchor: 'c1' }] },
  { id: 'n2', claim: '被推翻的', status: 'refuted', sources: [] },
  { id: 'n3', claim: '待核实的', status: 'open', sources: [{ url: 'https://x.test' }] },
] });
ok(notePool.items.length === 2 && notePool.usableCount === 1, '笔记本：verified 可用、open 不可用、refuted 排除');

const poolText = formatPoolForPrompt(pool);
ok(/可作为事实使用的证据（3 条/.test(poolText) && /未通过核验/.test(poolText) && /过度推断/.test(poolText), '证据池分组展示');
ok(/\[F1\]/.test(poolText) && /声称｜A 厂/.test(poolText), '证据池带 findings 与模态归因');

// ---------- 骨架校验 ----------
const unusableId = pool.items.find((i) => !i.usable).id;
const goodOutline = {
  title: '低成本化正在改变格局',
  bluf: '成本下降与产能扩张同时发生，管制是主要变数。',
  key_judgments: [
    { judgment: '价格战很可能在一年内蔓延', likelihood: '很可能', confidence: 'medium', basis: ['E1', 'E2'], counter: [unusableId], reasoning: '单价与产能同时变化' },
  ],
  sections: [{ heading: '成本曲线下移', thesis: '规模效应开始显现', points: [{ point: '单价下降', basis: ['E1'] }] }],
  uncertainties: [{ issue: 'C 厂状态不明', basis: [unusableId] }],
};
ok(validateOutline(goodOutline, pool).outline, '合格骨架通过');
ok(/没有任何已核验证据支撑/.test(validateOutline({
  ...goodOutline, key_judgments: [{ ...goodOutline.key_judgments[0], basis: [unusableId] }],
}, pool).error || ''), '只挂未核验证据的判断被拒');
ok(/不存在的证据/.test(validateOutline({ ...goodOutline, sections: [{ heading: 'h', thesis: 't', points: [{ point: 'p', basis: ['E99'] }] }] }, pool).error || ''), '骨架引用未知证据被拒');

// ---------- lint ----------
const goodDraft = [
  '# 低成本化正在改变格局',
  '> 成本下降与产能扩张同时发生 [E1][E2]。',
  '## 核心判断',
  '1. **价格战很可能蔓延**（可能性：很可能｜置信度：中）——单价与产能同时变化 [E1][E2]。',
  '## 成本曲线下移',
  '我们判断规模效应已经开始显现。A 厂称 2026 年单价降至 400 美元 [E1]，据路透社报道 B 厂产能翻倍 [E2, E3]，两者叠加意味着价格下探还有空间。',
  '## 分歧与不确定性',
  `有传闻称 C 厂已停产，但未经核实 [${unusableId}]。`,
].join('\n');
const goodLint = lintReport(goodDraft, pool, { length: 'brief' });
ok(goodLint.major.length === 0, '合格稿无重大问题');
ok(extractRefs('[E1, E2][E3，E4]').join() === 'E1,E2,E3,E4', '解析多种引用写法');
const listDraft = [
  '# T', '## 核心判断', '1. 判断 [E1]', '## 现状',
  ...Array.from({ length: 7 }, (_, i) => `- 事实 ${i} [E1]`),
  `- 停产 [${unusableId}]`, '- 未知 [E42]',
].join('\n');
const badLint = lintReport(listDraft, pool);
ok(badLint.major.some((m) => /清单/.test(m)), '识别清单化正文');
ok(badLint.major.some((m) => /E42/.test(m)), '识别未知引用');
ok(badLint.major.some((m) => m.includes(unusableId)), '识别未核验证据被当事实');
ok(lintReport('# T\n## 现状\n一段话 [E1]', pool).major.some((m) => /核心判断/.test(m)), '识别缺核心判断');

// ---------- 渲染 ----------
const docs = new Map([['doc_1', { title: 'A 厂公告', url: 'https://a.test/1' }]]);
const rendered = renderReport(`${goodDraft}\n\n## 参考来源\n- 模型自己写的列表`, pool, { docs, taskCount: 2 });
ok(!/\[E\d+/.test(rendered.markdown), '正文 E 编号全部替换');
ok(/\[1\]\[2\]/.test(rendered.markdown), '按首次出现顺序编号');
ok(!/模型自己写的列表/.test(rendered.markdown), '去掉模型自写的参考来源');
ok(/## 参考来源与证据/.test(rendered.markdown) && /\[A 厂公告\]\(https:\/\/a\.test\/1\)/.test(rendered.markdown), '附录含来源标题链接');
ok(/原文：「单价降至 400 美元」/.test(rendered.markdown), '附录含逐字引文');
ok(rendered.cited === 4, '附录只列正文引用过的证据');
ok(/核心判断/.test(writingSystemPrompt()) && /不要按来源或子任务分章/.test(writingSystemPrompt()), '写作协议约束结构');

// ---------- 端到端（假模型） ----------
const calls = [];
const fakeChat = async (messages, tools) => {
  calls.push({ tools: tools.map((t) => t.function.name), messages });
  if (tools.some((t) => t.function.name === 'submit_outline')) {
    const round = calls.filter((c) => c.tools.includes('submit_outline')).length;
    const args = round === 1 ? { ...goodOutline, key_judgments: [{ ...goodOutline.key_judgments[0], basis: ['E77'] }] } : goodOutline;
    return { content: '', toolCalls: [{ id: `o${round}`, name: 'submit_outline', arguments: args }], usage: { total_tokens: 10 } };
  }
  const writes = calls.filter((c) => !c.tools.length).length;
  return { content: writes === 1 ? listDraft : goodDraft, toolCalls: [], usage: { total_tokens: 20 } };
};
let billed = 0;
const result = await composeReport(
  { question: '低成本无人机格局会怎么变？', hypotheses: ['价格战即将到来'], length: 'brief' },
  {
    apiConfig: { apiKey: 'k' },
    sessions,
    chat: fakeChat,
    getDoc: async (id) => (id === 'doc_1' ? { title: 'A 厂公告', url: 'https://a.test/1' } : null),
    ctx: { onUsage: (u) => { billed += u.total_tokens; } },
    now: new Date('2026-10-09T00:00:00Z'),
  },
);
ok(result.ok, '端到端生成成功');
ok(calls.filter((c) => c.tools.includes('submit_outline')).length === 2, '骨架校验失败后重试');
const synthUser = calls[0].messages[1].content;
ok(/待检验假设/.test(synthUser) && /H1\. 价格战即将到来/.test(synthUser) && /今天：2026-10-09/.test(synthUser), '综合阶段拿到问题、假设与日期');
const writeCalls = calls.filter((c) => !c.tools.length);
ok(writeCalls.length === 2 && /RUNTIME-LINT/.test(writeCalls[1].messages.at(-1).content), '初稿 lint 不过时修订一次');
ok(!/对话|chatHistory/.test(writeCalls[0].messages[1].content.slice(0, 200)), '写作上下文只含简报/骨架/证据');
ok(result.stats.revised && result.stats.evidence_cited === 4 && result.stats.tasks === 2, '统计字段');
ok(/## 参考来源与证据/.test(result.markdown) && result.title === goodOutline.title, '最终稿带附录与标题');
ok(billed === 10 * 2 + 20 * 2, '各阶段用量入账');

const thin = await composeReport({ question: 'q' }, { apiConfig: { apiKey: 'k' }, sessions: [], chat: fakeChat });
ok(!thin.ok && /explore/.test(thin.error), '证据不足时拒绝并提示补派');
ok(!(await composeReport({}, { apiConfig: { apiKey: 'k' }, sessions })).ok, '缺 question 被拒');

const passageReport = validateTaskReport({
  summary: '覆盖了审批',
  claims: [],
  actions: [],
  unresolved: ['航线时限'],
  passages: [{ use: '审批', doc_id: 'doc_a', anchor: 'c3', quote: '由市交通局会同军方划设' }],
});
ok(!passageReport.error && passageReport.report.passages[0].anchor === 'c3', '阅读交回接受 passages');
ok(/use/.test(validateTaskReport({
  summary: 's', claims: [], actions: [], unresolved: [],
  passages: [{ doc_id: 'doc_a', anchor: 'c1', quote: 'q' }],
}).error || ''), '缺 use 的段落被拒');
const passageMain = reportForMain(passageReport.report);
ok(passageMain.covered[0] === '审批' && passageMain.passage_count === 1 && !passageMain.claims, '主代理只看覆盖，不看引文');
ok(collectPassages([{ id: 't1', report: passageReport.report }]).length === 1, '写作阶段收集段落');
ok(splitDraft('<<<DOC>>>\n# 方案\n正文\n<<<GAPS>>>\n- 申报时限').gaps[0] === '申报时限', '改稿分隔缺口');
const docCalls = [];
const docChat = async (messages) => {
  docCalls.push(messages[0].content);
  if (docCalls.length === 1) return { content: '# 试点方案\n第 3 周提交。', usage: { total_tokens: 3 } };
  return { content: '<<<DOC>>>\n# 试点方案\n第 3 周提交（假设）。\n<<<GAPS>>>\n', usage: { total_tokens: 4 } };
};
const written = await writeDocument(
  { genre: '策划方案', brief: '三个月试点，能拿去开会', audience: '管委会' },
  {
    apiConfig: { apiKey: 'k' },
    sessions: [{ id: 't1', report: passageReport.report }],
    chat: docChat,
    ctx: {},
  },
);
ok(written.ok && written.title === '试点方案' && /假设/.test(written.markdown), '按体裁写成并采用改稿');
ok(docCalls[0].includes('策划方案') && docCalls[1].includes('<<<DOC>>>'), '写作与改稿分两次');
ok(docCalls[0].includes('img:id') && docCalls[1].includes('img:id'), '写作与改稿都保留材料原图引用');
const held = await writeDocument(
  { genre: '策划方案', brief: '三个月试点' },
  {
    apiConfig: { apiKey: 'k' },
    sessions: [{ id: 't1', report: passageReport.report }],
    chat: async () => ({ content: '<<<DOC>>>\n# 方案\n<<<GAPS>>>\n申报时限', usage: { total_tokens: 1 } }),
    ctx: {},
  },
);
ok(!held.ok && held.need_reading[0] === '申报时限', '关键缺口不保存，退回补读');
ok(!(await writeDocument({ genre: '策划方案', brief: 'x' }, { apiConfig: { apiKey: 'k' }, sessions: [], chat: docChat })).ok, '没有段落时拒绝成文');

console.log(`report-smoke: ${passed} passed`);
