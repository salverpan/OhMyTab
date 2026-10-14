import assert from 'node:assert/strict';
import { SUBMIT_REPORT_TOOL, validateTaskReport, reportForMain } from '../src/lib/task-report.js';
import { SECTION_JOB_TOOL, runSectionJob, sectionJobCursor } from '../src/lib/section-worker.js';
import { SUBMIT_VERDICTS_TOOL } from '../src/lib/check/entailment.js';
import { deriveClaimVerdict, verificationForMain } from '../src/lib/check/index.js';
import { findQuoteInText, normalizeQuoteText } from '../src/lib/check/quote-match.js';
import { toAnthropicTools } from '../src/lib/providers/anthropic-messages.js';
import { toFunctionDeclarations } from '../src/lib/providers/gemini.js';
import { emitUsage, usageTotalTokens } from '../src/lib/usage.js';

let passed = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  passed += 1;
}

const validRaw = {
  summary: '完成核查',
  claims: [{
    id: 'c1',
    claim: '系统支持结构化交回。',
    confidence: 'high',
    evidence: [{ doc_id: 'doc_1', anchor: 'c2', quote: '结构化交回' }],
  }],
  actions: [],
  unresolved: [],
};
const checked = validateTaskReport(validRaw);
ok(!checked.error && checked.report.claims[0].evidence[0].anchor === 'c2', 'TaskReport 校验');
ok(validateTaskReport({ ...validRaw, claims: [{ id: 'c1', claim: 'x', evidence: [] }] }).error, '拒绝无证据 claim');
ok(reportForMain(checked.report).claims[0].sources[0] === 'doc_1#c2', 'Main 只接收短结构摘要');

ok(SUBMIT_REPORT_TOOL.function.name === 'submit_report', 'Sub 强制 submit_report');
ok(SUBMIT_VERDICTS_TOOL.function.name === 'submit_verdicts', 'Check 使用窄 verdict 工具');
ok(SECTION_JOB_TOOL.function.name === 'section_job', 'Nested 暴露 section_job');
ok(SECTION_JOB_TOOL.function.description.includes('content_next_offset'), 'section_job 说明续拉');
const more = sectionJobCursor({ chars: 20000, offset: 0, total: 50000, has_more: true, next_offset: 20000 });
ok(more.content_has_more === true && more.content_next_offset === 20000, '未读完时给出续拉偏移');
const done = sectionJobCursor({ chars: 1200, offset: 20000, total: 21200, has_more: false, next_offset: null });
ok(done.content_has_more === false && done.content_next_offset == null, '读完时不再给偏移');
ok(SUBMIT_REPORT_TOOL.function.parameters.required.includes('claims'), 'OpenAI 工具 schema 完整');
ok(toAnthropicTools([SUBMIT_REPORT_TOOL])[0].input_schema.required.includes('claims'), 'Anthropic 工具 schema 完整');
ok(toFunctionDeclarations([SUBMIT_REPORT_TOOL])[0].parameters.required.includes('claims'), 'Gemini 工具 schema 完整');

const blocked = JSON.parse(await runSectionJob({ doc_id: 'doc_1', goal: '抽取事实' }, {}));
ok(!blocked.ok && blocked.error.includes('只能由 Sub'), 'Nested 不能由 Main 调用');

ok(normalizeQuoteText('Ａ  \n B') === 'A B', 'NFKC 与空白归一化');
ok(findQuoteInText('前文 逐字引文 后文', '逐字引文').matchType === 'exact', '逐字 quote 匹配');
ok(findQuoteInText('前文 Ａ   B 后文', 'A B').matchType === 'normalized', '归一化 quote 匹配');
ok(!findQuoteInText('原文', '伪造引文').matched, '拒绝不存在的 quote');

const citationPass = { citation: 'citation-pass', passed: [{ sourceIdentity: 'https://a.test' }] };
const crossPass = {
  citation: 'citation-pass',
  passed: [{ sourceIdentity: 'https://a.test' }, { sourceIdentity: 'https://b.test' }],
};
ok(deriveClaimVerdict({ citation: 'citation-fail', passed: [] }, null) === 'citation-fail', 'citation 失败状态');
ok(deriveClaimVerdict(citationPass, { verdict: 'entails' }) === 'entailment-pass', 'entailment 通过状态');
ok(deriveClaimVerdict(crossPass, { verdict: 'entails' }) === 'cross-source-pass', '独立双信源状态');
ok(deriveClaimVerdict(citationPass, { verdict: 'overclaim' }) === 'overclaim', '过度推断状态');
ok(deriveClaimVerdict(citationPass, { verdict: 'contradicts' }) === 'source-conflict', '信源冲突状态');

const runtimeVerification = {
  checkRunId: 'chk_runtime',
  checkerVersion: 'citecat-check-v1',
  checkedAt: 123,
  counts: { 'entailment-pass': 1 },
  contentFailure: false,
  infrastructureFailure: false,
  claims: [{
    id: 'c1',
    claim: 'x',
    verdict: 'entailment-pass',
    reason: '',
    evidence: [{ status: 'citation-pass', evidence: { doc_id: 'doc_1', anchor: 'c2' } }],
  }],
};
const mainVerification = verificationForMain(runtimeVerification);
ok(mainVerification.check_run_id === 'chk_runtime' && mainVerification.checker === 'citecat-check-v1', '核验元数据由运行时封装');
ok(!mainVerification.claims && mainVerification.failures.length === 0, '通过项不重复交给主代理');
const failedVerification = verificationForMain({
  ...runtimeVerification,
  contentFailure: true,
  claims: [
    ...runtimeVerification.claims,
    { id: 'c2', claim: '停产', verdict: 'overclaim', reason: '原文只说暂停', evidence: [{ status: 'citation-pass', evidence: { doc_id: 'doc_9', anchor: 'c1' } }] },
  ],
});
ok(failedVerification.failures.length === 1 && failedVerification.failures[0].id === 'c2', '只把未通过项交给主代理');
ok(!JSON.stringify(validRaw).includes('check_run_id'), 'Sub report 不含核验身份字段');

ok(usageTotalTokens({ prompt_tokens: 10, completion_tokens: 5 }) === 15, 'usage 无 total 时按 prompt+completion');
ok(usageTotalTokens({ total_tokens: 9, prompt_tokens: 10, completion_tokens: 5 }) === 9, 'usage 优先 total_tokens');
const billed = [];
const usageCtx = { onUsage: (u) => billed.push(usageTotalTokens(u)) };
ok(emitUsage(usageCtx, { total_tokens: 4 }) === 4, 'emitUsage 单次入账');
ok(emitUsage(usageCtx, [{ total_tokens: 1 }, { prompt_tokens: 2, completion_tokens: 3 }]) === 6, 'emitUsage 数组入账');
ok(emitUsage({}, { total_tokens: 99 }) === 0, '无 onUsage 时不入账');
ok(billed.join(',') === '4,1,5', '宿主 onUsage 收到子代理/判定器用量');

console.log(`agent-pipeline-smoke: ${passed} passed`);
