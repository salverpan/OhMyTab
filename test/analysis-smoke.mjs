import assert from 'node:assert/strict';
import {
  validateAnalysisContract,
  formatAnalysisBrief,
  STANCE_DIRECTIONS,
} from '../src/lib/analysis-contract.js';
import { reviewArgument, ARGUMENT_REVIEW_TOOL } from '../src/lib/check/argument.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';
import { validateResearchSubmission } from '../src/lib/research-result.js';
import { formatFrameworkCatalog, formatFrameworkCard } from '../src/lib/analysis-frameworks.js';
import { validateAnalystMemo } from '../src/lib/analysis-memo.js';
import {
  routeResearchMode, resolveLoopRounds, researchStopGap, nextResearchHold,
  researchCarryFromHistory, formatResearchPolicyBlock, RESEARCH_POLICIES,
} from '../src/lib/research-mode.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const valid = {
  bottom_line: '我判断该公司的竞争壁垒正在变弱，未来两个季度利润率仍会承压。',
  stance: { direction: 'oppose', confidence: 0.72, reason: '价格战已经传导到毛利，且渠道库存仍在上升。' },
  framework: { id: 'five-forces', name: '利润池与波特五力', why: '问题核心是行业利润分配和进入壁垒变化。', limitation: '无法量化管理层执行力。' },
  key_judgments: [{ id: 'j1', statement: '毛利率下降不是一次性因素。', basis: '连续三个季度下降', confidence: 'high', falsifier: '下一季度毛利率显著回升且库存下降。' }],
  strongest_countercase: { argument: '原材料降价会快速修复毛利。', response: '原材料只占成本三成，且售价同步下调。' },
  recommendation: { action: '下调盈利预期并降低仓位。', conditions: '下一季报毛利率仍低于 15%。', upside: '若价格战结束，利润弹性较大。', downside: '若公司提价成功，可能错过反弹。', stop_condition: '毛利率连续两个季度回升时复盘。', leading_indicators: ['渠道库存', '终端折扣'] },
  unresolved: ['管理层是否愿意牺牲份额'],
};
const good = validateAnalysisContract(valid);
ok(good.ok, '完整观点契约通过');
ok(good.report.stance.confidence === 0.72, '置信度保留');
ok(good.report.framework.name.includes('五力'), '框架保留');
ok(STANCE_DIRECTIONS.includes('conditional-support'), '支持条件性倾向');
ok(!validateAnalysisContract({ ...valid, bottom_line: '' }).ok, '缺少核心判断被拒');
ok(!validateAnalysisContract({ ...valid, stance: { ...valid.stance, direction: 'neutral' } }).ok, '中立方向被拒');
ok(!validateAnalysisContract({ ...valid, strongest_countercase: { argument: '', response: '' } }).ok, '缺少反方被拒');
ok(!validateAnalysisContract({ ...valid, recommendation: { ...valid.recommendation, downside: '' } }).ok, '缺少下行风险被拒');

const brief = formatAnalysisBrief(valid);
ok(brief.includes('核心判断') && brief.includes('利润池与波特五力'), '观点契约可注入 Writer');
ok(brief.includes('证伪条件') && brief.includes('下行风险'), 'Writer 看到证伪与代价');

const dims = { thesis_clarity: 0.8, framework_fit: 0.8, countercase_quality: 0.7, recommendation_quality: 0.8, decision_usefulness: 0.8, non_generic_insight: 0.7 };
const reviewChat = async () => ({ usage: { total_tokens: 3 }, toolCalls: [{ name: 'submit_argument_review', arguments: { ok: true, score: 0.8, summary: 'ok', dimensions: dims, issues: [] } }] });
const reviewOk = await reviewArgument({ analysis: valid, draft: '## 核心判断\n我判断该公司壁垒正在变弱，因此下调盈利预期。', apiConfig: { apiKey: 'k' }, chat: reviewChat });
ok(reviewOk.ok && reviewOk.checker === 'citecat-argument-llm-v1', 'LLM 观点评审通过');
ok(ARGUMENT_REVIEW_TOOL.function.name === 'submit_argument_review', 'LLM 评审使用结构化工具');
const noApiReview = await reviewArgument({ analysis: valid, chat: reviewChat });
ok(!noApiReview.ok && noApiReview.issues[0].type === 'no-api', 'LLM 评审无 API 时明确失败');
const badChat = async () => ({ usage: { total_tokens: 1 }, toolCalls: [{ name: 'submit_argument_review', arguments: { ok: false, score: 0.3, summary: 'evasive', dimensions: dims, issues: [{ type: 'evasive-stance', severity: 'error', why: '没有选边', fix: '给出明确倾向' }] } }] });
const reviewBad = await reviewArgument({ draft: '一方面行业在增长，另一方面公司也有风险。', apiConfig: { apiKey: 'k' }, chat: badChat });
ok(!reviewBad.ok, 'LLM 评审拒绝防御性表达');
ok(reviewBad.issues.some((i) => i.type === 'evasive-stance'), 'LLM 返回结构化 issue');

const writeDef = CHAT_TOOLS.find((t) => t.function.name === 'write_document');
ok(writeDef.function.parameters.required.includes('analysis'), 'write_document 强制 analysis');
ok(writeDef.function.parameters.properties.analysis.properties.framework.required.includes('id'), 'analysis.framework 强制 id');
const loadDef = CHAT_TOOLS.find((t) => t.function.name === 'load_framework');
ok(loadDef.function.parameters.properties.id.enum.includes('no_framework') && loadDef.function.parameters.properties.id.enum.includes('custom'), 'load_framework 支持 no_framework/custom');
ok(CHAT_TOOLS.some((t) => t.function.name === 'check_facts'), 'CHAT_TOOLS 含 check_facts');
ok(CHAT_TOOLS.some((t) => t.function.name === 'review_argument'), 'CHAT_TOOLS 含 review_argument');
ok(PARENT_ONLY_TOOLS.has('check_facts') && PARENT_ONLY_TOOLS.has('review_argument'), '双检查仅主代理可用');

ok(CHAT_TOOLS.length === 42, '42 个主工具');
ok(!CHAT_TOOLS.some((t) => ['confirm_collect', 'cancel_collect', 'clear_context'].includes(t.function.name)), '确认/取消采集与清空上下文不再暴露');
ok(CHAT_TOOLS.some((t) => t.function.name === 'auto_compact'), '保留上下文压缩');
ok(CHAT_TOOLS.some((t) => t.function.name === 'write_research_artifact'), '含研究笔记 artifact 工具');
ok(CHAT_TOOLS.some((t) => t.function.name === 'analyst_memo'), '含 Analyst Memo 工具');
ok(CHAT_TOOLS.some((t) => t.function.name === 'load_framework'), '含框架加载工具');
ok(PARENT_ONLY_TOOLS.has('analyst_memo') && PARENT_ONLY_TOOLS.has('load_framework'), 'Analyst Memo/框架加载父级专属');

const research = validateResearchSubmission({
  summary: '我判断该行业利润池正在向上游迁移。',
  artifact_id: 'doc_research_1',
  sources: ['doc_1#c2'],
  gaps: ['缺少二线厂商毛利'],
  claims: [],
});
ok(!research.error && research.research.artifact_id === 'doc_research_1' && research.research.gaps.length === 1, '轻量研究交回通过');
ok(!!validateResearchSubmission({ summary: 'x', sources: [], gaps: [] }).error, '缺少 artifact_id 被拒');

const catalog = formatFrameworkCatalog();
ok(catalog.includes('five-forces') && catalog.includes('ach'), '框架目录覆盖领域');
const card = formatFrameworkCard('five-forces');
ok(card.includes('必需输入') && card.includes('评审标准'), '框架方法卡含执行规范');

const memo = validateAnalystMemo({
  analysis: valid,
  red_team: {
    strongest_attack: '价格战可能在两个季度内结束。',
    vulnerable_assumptions: ['渠道库存继续上升'],
    evidence_that_would_flip: ['下一季毛利率回升且库存下降'],
    response: '当前库存和折扣数据仍指向恶化，暂不足以翻转判断。',
  },
});
ok(memo.ok && memo.memo.includes('Red Team') && memo.memo.includes('核心判断'), 'Analyst Memo + Red Team 通过');
ok(!validateAnalystMemo({ analysis: valid, red_team: {} }).ok, '缺少 Red Team 被拒');

const deep = routeResearchMode('全面分析行业竞争格局和投资价值，给明确建议');
ok(deep.mode === 'deep' && deep.policy.requireChecks && deep.policy.requireAnalystMemo, 'Deep Research 路由与预算');
ok(deep.policy.maxRounds === 0 && resolveLoopRounds(deep.policy, 100) === Infinity, '调研不按轮次封顶');
ok(formatResearchPolicyBlock({ policy: deep.policy }).includes('轮次不限'), '提示写轮次不限');
ok(!formatResearchPolicyBlock({ policy: RESEARCH_POLICIES.normal }).includes('最多 0'), '不把 0 轮写成上限');
const survey = routeResearchMode('调研中韩半导体基本面');
ok(survey.mode === 'deep', '「调研」走深度调研');
const carried = routeResearchMode('对话怎么结束了？', { unfinishedResearch: true });
ok(carried.mode === 'deep' && carried.reason === '上一轮调研尚未成文', '未成文的调研不因追问掉回普通模式');
const quick = routeResearchMode('这个函数在哪', { unfinishedResearch: true });
ok(quick.mode === 'normal', '明确的单点问题可以离开未完成调研');
const normal = routeResearchMode('这个函数在哪');
ok(normal.mode === 'normal' && !normal.policy.requireChecks, '普通模式路由');

function toolPair(id, name, body, args) {
  return [
    { role: 'assistant', tool_calls: [{ id, function: { name, arguments: JSON.stringify(args || {}) } }] },
    { role: 'tool', tool_call_id: id, content: typeof body === 'string' ? body : JSON.stringify(body) },
  ];
}
const explored = toolPair('t1', 'task', { ok: true, state: 'completed' }, { subagent_type: 'explore' });
ok(researchStopGap(explored, deep.policy).step === 'memo', '子代理交回后不能停，下一步是备忘录');
const memoed = [
  ...explored,
  ...toolPair('t2', 'analyst_memo', { ok: true }),
];
ok(researchStopGap(memoed, deep.policy).step === 'write', '备忘录之后必须 write_document');
const wrote = [
  ...memoed,
  ...toolPair('t3', 'write_document', { ok: true }),
];
ok(researchStopGap(wrote, deep.policy).step === 'review', '成文后还要评审');
const checked = [
  ...wrote,
  ...toolPair('t4', 'review_argument', { ok: true }),
  ...toolPair('t5', 'check_facts', { ok: true }),
];
ok(researchStopGap(checked, deep.policy) == null, '核验通过后可以收束');
ok(researchStopGap([], normal.policy) == null, '普通问答没有工具时不拦');
const hold = nextResearchHold(memoed, deep.policy, { holdStep: '', holdCount: 0 });
ok(hold.action === 'continue' && hold.gap.step === 'write', '停手时自动续跑成文');
ok(nextResearchHold(memoed, deep.policy, { waitingForUser: true }).action === 'stop', '等用户确认时不续跑');
const history = [
  { role: 'user', content: '调研中韩半导体' },
  ...memoed,
  { role: 'assistant', content: '先写到这里。' },
  { role: 'user', content: '【系统提示】上一轮任务涉及 4 次工具调用。' },
];
ok(researchCarryFromHistory(history), '系统提示不把未成文的调研抹掉');
ok(!researchCarryFromHistory([...history, ...toolPair('t3', 'write_document', { ok: true }), ...toolPair('t4', 'review_argument', { ok: true }), ...toolPair('t5', 'check_facts', { ok: true })]), '交付完成后不再携带');
const cardPestel = formatFrameworkCard('pestel');
const cardStp = formatFrameworkCard('stp-4p');
ok(cardPestel.includes('PESTEL') && cardPestel.includes('必需输入'), '新增 PESTEL 方法卡');
ok(cardStp.includes('STP') && cardStp.includes('评审标准'), '新增 STP+4P 方法卡');
ok(formatFrameworkCatalog().split('\n').length === 26, '框架目录扩展到 26 个');
ok(formatFrameworkCard('no_framework').includes('不使用固定框架'), 'no_framework 方法卡');
ok(formatFrameworkCard('custom').includes('自定义领域框架'), 'custom 方法卡');
const noFramework = validateAnalysisContract({ ...valid, framework: { id: 'no_framework', name: '不使用固定框架', why: '这是事实查询，不需要框架', limitation: '不做结构化因果分析' } });
ok(noFramework.ok, 'no_framework 合法');
const customFramework = validateAnalysisContract({ ...valid, framework: { id: 'custom', name: 'IRAC 法律分析', why: '法律问题需要 issue-rule-application-conclusion', limitation: '依赖具体法域和判例' } });
ok(customFramework.ok, 'custom 合法且 name 可为 IRAC');
const badCustom = validateAnalysisContract({ ...valid, framework: { id: 'custom', name: '自定义领域框架', why: '专业问题', limitation: '需要来源' } });
ok(!badCustom.ok && badCustom.issues.some((i) => i.type === 'custom-name-missing'), 'custom 不能只写通用名');
const badFrameworkId = validateAnalysisContract({ ...valid, framework: { id: 'does-not-exist', name: 'X', why: 'Y', limitation: 'Z' } });
ok(!badFrameworkId.ok && badFrameworkId.issues.some((i) => i.type === 'framework-unknown'), '未知框架 id 被拒');
console.log(`analysis-smoke: ${passed} passed`);






