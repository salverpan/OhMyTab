/* 研报写作阶段冒烟（node test/report-smoke.mjs）。用假模型驱动，不碰 chrome.*。 */

import assert from 'node:assert/strict';
import { collectPassages, splitDraft, writeDocument, applyCitations } from '../src/lib/document-writer.js';
import { validateTaskReport, reportForMain, SUBMIT_REPORT_TOOL } from '../src/lib/task-report.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';

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
ok(CHAT_TOOLS.some((t) => t.function.name === 'write_document'), 'CHAT_TOOLS 含 write_document');

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
ok(passageMain.covered[0] === '审批' && passageMain.passage_count === 1 && !passageMain.claims, '主代理不看引文');
ok(passageMain.summary === '覆盖了审批', '主代理能看见这一路的判断');
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
const cited = applyCitations(
  '去掉汽油之后，别的价格也在涨。',
  [{ doc_id: 'doc_a', anchor: 'c3', quote: '由市交通局会同军方划设', use: '审批' }],
  '<<<CITE>>>\n别的价格也在涨\tdoc_a#c3\n这句话不在正文\tdoc_a#c3\n别的价格也在涨\tdoc_missing#c9\n',
);
ok(cited.includes('别的价格也在涨〔doc_a#c3〕') && cited.includes('## 出处') && !cited.includes('doc_missing'), '出处只挂在原文存在的短句后');
ok(cited.startsWith('去掉汽油之后，别的价格也在涨〔doc_a#c3〕。'), '挂出处不改已经写好的句子');
const reportCalls = [];
const reported = await writeDocument(
  { genre: '研报', brief: '这轮物价说明什么' },
  {
    apiConfig: { apiKey: 'k' },
    sessions: [{ id: 't1', report: passageReport.report }],
    chat: async (messages) => {
      reportCalls.push(messages.map((m) => m.content).join('\n'));
      if (reportCalls.length === 1) return { content: '核心也在涨，所以不只是汽油。', usage: { total_tokens: 1 } };
      if (reportCalls.length === 2) return { content: '<<<DOC>>>\n核心也在涨，所以不只是汽油。\n<<<GAPS>>>\n', usage: { total_tokens: 1 } };
      return { content: '<<<CITE>>>\n不只是汽油\tdoc_a#c3\n', usage: { total_tokens: 1 } };
    },
    ctx: {},
  },
);
ok(reported.ok && reported.markdown.includes('不只是汽油〔doc_a#c3〕'), '研报定稿后才挂出处');
ok(reportCalls.length === 3 && reportCalls[2].includes('<<<CITE>>>'), '出处是单独一轮，不和改稿混在一起');
ok(reportCalls[0].includes('调查员的判断') && reportCalls[0].includes('覆盖了审批'), '写稿看得到调查员的判断');

console.log(`report-smoke: ${passed} passed`);
