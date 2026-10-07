import { streamChatWithTools } from '../ai-client.js';
import { CHECK_BATCH_SIZE, CHECK_TIMEOUT_MS } from '../limits.js';
import { emitUsage } from '../usage.js';

const VERDICTS = new Set(['entails', 'overclaim', 'contradicts', 'unclear']);

export const SUBMIT_VERDICTS_TOOL = {
  type: 'function',
  function: {
    name: 'submit_verdicts',
    description: '提交每条 claim 相对给定引文的蕴含判断。',
    parameters: {
      type: 'object',
      properties: {
        verdicts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              verdict: { type: 'string', enum: [...VERDICTS] },
              reason: { type: 'string', description: '最多一句，只说明引文支持或缺少什么。' },
            },
            required: ['id', 'verdict'],
          },
        },
      },
      required: ['verdicts'],
    },
  },
};

function validateVerdicts(raw, expectedIds) {
  if (!raw || !Array.isArray(raw.verdicts)) return null;
  const map = new Map();
  for (const item of raw.verdicts) {
    const id = String(item?.id || '');
    const verdict = String(item?.verdict || '');
    if (!expectedIds.has(id) || !VERDICTS.has(verdict)) continue;
    map.set(id, { verdict, reason: String(item.reason || '').slice(0, 300) });
  }
  return map.size === expectedIds.size ? map : null;
}

async function judgeBatch(items, apiConfig, parentSignal, ctx) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onAbort, { once: true });
  }
  const expected = new Set(items.map((i) => i.id));
  const messages = [
    {
      role: 'system',
      content:
        '你是严格的证据蕴含判定器。不得使用外部知识。只判断 CLAIM 是否由 QUOTES 直接支持：'
        + 'entails=完整直接支持；overclaim=方向相关但加入引文没有的范围/因果/数字；'
        + 'contradicts=引文明示相反；unclear=无法判断。'
        + '每条还带 attribution（说话主体）与 modality（confirmed/claimed/reported/denied/assessed/speculative）。'
        + '把它们当作 CLAIM 的一部分一起判：modality=confirmed 但引文只显示某方声称、媒体转述或匿名消息，判 overclaim；'
        + 'attribution 与引文里的说话主体不符，判 overclaim。必须调用 submit_verdicts。',
    },
    {
      role: 'user',
      content: JSON.stringify(items.map((item) => ({
        id: item.id,
        claim: item.claim,
        attribution: item.attribution || '',
        modality: item.modality || 'reported',
        quotes: item.quotes,
      }))),
    },
  ];
  try {
    for (let round = 0; round < 2; round++) {
      const result = await streamChatWithTools(messages, [SUBMIT_VERDICTS_TOOL], apiConfig, () => {}, controller.signal);
      emitUsage(ctx, result.usage);
      const submit = (result.toolCalls || []).find((tc) => tc.name === 'submit_verdicts');
      const verdicts = submit ? validateVerdicts(submit.arguments, expected) : null;
      if (verdicts) return { verdicts, usage: result.usage || null };
      messages.push({ role: 'assistant', content: result.content || '' });
      messages.push({ role: 'user', content: '[RUNTIME] 结果不完整。必须为每个 id 调用 submit_verdicts。' });
    }
    return { error: 'unparseable' };
  } catch (error) {
    return { error: controller.signal.aborted ? 'timeout' : (error.message || String(error)) };
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onAbort);
  }
}

export async function judgeEntailment(items, apiConfig, signal, ctx) {
  const out = new Map();
  const usage = [];
  if (!apiConfig || !apiConfig.apiKey) {
    for (const item of items) out.set(item.id, { verdict: 'unclear', reason: 'no-api', infrastructure: true });
    return { verdicts: out, usage };
  }
  for (let i = 0; i < items.length; i += CHECK_BATCH_SIZE) {
    const batch = items.slice(i, i + CHECK_BATCH_SIZE);
    const result = await judgeBatch(batch, apiConfig, signal, ctx);
    if (result.error) {
      for (const item of batch) out.set(item.id, { verdict: 'unclear', reason: result.error, infrastructure: true });
      continue;
    }
    for (const [id, verdict] of result.verdicts) out.set(id, verdict);
    if (result.usage) usage.push(result.usage);
  }
  return { verdicts: out, usage };
}
