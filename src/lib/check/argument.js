/** 观点质量评审：只调用 LLM，不核验事实。事实由 check_facts 负责。 */
import { streamChatWithTools } from '../ai-client.js';
import { emitUsage } from '../usage.js';

export const ARGUMENT_CHECKER_VERSION = 'citecat-argument-llm-v1';

export const ARGUMENT_REVIEW_TOOL = {
  type: 'function',
  function: {
    name: 'submit_argument_review',
    description: '提交对分析稿的观点质量评审。只评审，不改写，不核验事实。',
    parameters: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', description: '是否达到可交付标准。' },
        score: { type: 'number', description: '0 到 1 的整体质量分。' },
        summary: { type: 'string', description: '一句话评审结论。' },
        dimensions: {
          type: 'object',
          properties: {
            thesis_clarity: { type: 'number' },
            framework_fit: { type: 'number' },
            countercase_quality: { type: 'number' },
            recommendation_quality: { type: 'number' },
            decision_usefulness: { type: 'number' },
            non_generic_insight: { type: 'number' },
          },
          required: ['thesis_clarity', 'framework_fit', 'countercase_quality', 'recommendation_quality', 'decision_usefulness', 'non_generic_insight'],
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'weak-thesis / framework-mismatch / weak-countercase / evasive-stance / generic-analysis / weak-recommendation / missing-downside / missing-falsifier / other' },
              severity: { type: 'string', enum: ['error', 'warning'] },
              quote: { type: 'string', description: '被评审的原文短句。' },
              why: { type: 'string', description: '为什么有问题。' },
              fix: { type: 'string', description: '怎么改，不要重写全文。' },
            },
            required: ['type', 'severity', 'why', 'fix'],
          },
        },
      },
      required: ['ok', 'score', 'summary', 'dimensions', 'issues'],
    },
  },
};

function newReviewId() {
  return 'arg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

const SYSTEM = [
  '你是独立观点评审员，不是作者，也不是事实核查员。',
  '只评观点质量：',
  '1. 是否有明确 bottom_line 和选边，而不是虚假平衡；',
  '2. 分析框架是否适合领域，是否只是装饰；',
  '3. 关键判断是否有因果机制和证伪条件；',
  '4. 是否回应最强反方，而不是稻草人；',
  '5. 建议是否可执行，是否写清条件、下行代价和停止条件；',
  '6. 是否全面但有取舍，是否存在非显然洞察；',
  '7. 是否过度防御、用视情况而定或需要进一步研究替代判断。',
  '不要判断事实真假，不要要求结论逐字符合来源，不要改写全文，不要新增来源。',
  '必须调用 submit_argument_review，按结构化字段返回。',
].join('\n');

export async function reviewArgument({
  analysis = null,
  draft = '',
  frameworkCard = '',
  apiConfig = null,
  sameModelReview = true,
  signal = null,
  ctx = {},
  chat = streamChatWithTools,
} = {}) {
  if (!apiConfig || !apiConfig.apiKey) {
    return {
      ok: false,
      reviewId: newReviewId(),
      checker: ARGUMENT_CHECKER_VERSION,
      checkedAt: Date.now(),
      issues: [{ scope: 'runtime', type: 'no-api', severity: 'error', why: 'review_argument 需要可用的评审模型 API。', fix: '配置评审渠道后重试。' }],
      dimensions: null,
      score: null,
    };
  }
  if (!analysis && !String(draft || '').trim()) {
    return {
      ok: false,
      reviewId: newReviewId(),
      checker: ARGUMENT_CHECKER_VERSION,
      checkedAt: Date.now(),
      issues: [{ scope: 'input', type: 'empty-input', severity: 'error', why: '需要 analysis 或 draft 至少一个。', fix: '先写分析，再调用 review_argument。' }],
      dimensions: null,
      score: null,
    };
  }
  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        frameworkCard ? '## 框架方法卡\n' + frameworkCard : '',
        analysis ? '## 观点契约\n' + JSON.stringify(analysis, null, 2) : '',
        String(draft || '').trim() ? '## 正文\n' + String(draft).trim() : '',
      ].filter(Boolean).join('\n\n'),
    },
  ];
  const result = await chat(messages, [ARGUMENT_REVIEW_TOOL], apiConfig, () => {}, signal);
  emitUsage(ctx, result && result.usage);
  const call = (result && result.toolCalls || []).find((tc) => tc.name === 'submit_argument_review');
  if (!call) {
    return {
      ok: false,
      reviewId: newReviewId(),
      checker: ARGUMENT_CHECKER_VERSION,
      checkedAt: Date.now(),
      sameModelReview,
      issues: [{ scope: 'runtime', type: 'no-review', severity: 'error', why: '评审模型没有调用 submit_argument_review。', fix: '检查评审模型是否支持工具调用。' }],
      dimensions: null,
      score: null,
    };
  }
  const a = call.arguments || {};
  const issues = Array.isArray(a.issues) ? a.issues.map((x) => ({
    scope: 'argument',
    type: String(x.type || 'other'),
    severity: x.severity === 'warning' ? 'warning' : 'error',
    quote: String(x.quote || ''),
    why: String(x.why || ''),
    fix: String(x.fix || ''),
  })) : [];
  return {
    ok: a.ok === true && !issues.some((x) => x.severity === 'error'),
    reviewId: newReviewId(),
    checker: ARGUMENT_CHECKER_VERSION,
    checkedAt: Date.now(),
    sameModelReview,
    score: Number.isFinite(Number(a.score)) ? Math.max(0, Math.min(1, Number(a.score))) : null,
    summary: String(a.summary || ''),
    dimensions: a.dimensions && typeof a.dimensions === 'object' ? a.dimensions : null,
    issues,
    analysis,
  };
}

