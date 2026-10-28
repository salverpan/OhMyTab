import assert from 'node:assert/strict';
import { chatComplete } from '../src/lib/providers/index.js';
import {
  NETWORK_MAX_RETRIES,
  isRetryableNetworkError,
  formatNetworkError,
  networkRetryDelayMs,
  withNetworkRetry,
} from '../src/lib/net-retry.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(NETWORK_MAX_RETRIES === 5, '默认重试次数为 5');

ok(isRetryableNetworkError(new TypeError('Failed to fetch')), 'TypeError: Failed to fetch 可重试');
ok(/连不上模型服务/.test(formatNetworkError(new TypeError('Failed to fetch'))), 'Failed to fetch 译成连不上模型服务');
ok(!/已经结束/.test(formatNetworkError(new TypeError('Failed to fetch'))), '失败文案不再谎称任务已结束');
ok(isRetryableNetworkError(new TypeError('network error')), 'network error 文案可重试');
ok(isRetryableNetworkError({ code: 'ECONNRESET', message: 'socket hang up' }), 'ECONNRESET 可重试');
ok(isRetryableNetworkError({ status: 503, message: 'API 503' }), '503 可重试');
ok(isRetryableNetworkError({ status: 429, message: 'API 429' }), '429 可重试');
ok(!isRetryableNetworkError({ status: 401, message: 'API 401' }), '401 不重试');
ok(!isRetryableNetworkError({ name: 'AbortError', message: 'aborted' }), '用户中止不重试');
ok(networkRetryDelayMs(3, { retryAfterMs: 1200 }) === 1200, '尊重 Retry-After');

let attempts = 0;
const value = await withNetworkRetry(async () => {
  attempts += 1;
  if (attempts < 3) throw new TypeError('Failed to fetch');
  return 'ok';
}, { sleepFn: async () => {} });
ok(value === 'ok' && attempts === 3, '失败两次后成功');

let tries = 0;
await assert.rejects(
  withNetworkRetry(async () => {
    tries += 1;
    throw new TypeError('Failed to fetch');
  }, { sleepFn: async () => {} }),
  /Failed to fetch/,
);
ok(tries === 6, '5 次重试后停止，总共尝试 6 次');

let abortTries = 0;
await assert.rejects(
  withNetworkRetry(async () => {
    abortTries += 1;
    const e = new Error('Aborted');
    e.name = 'AbortError';
    throw e;
  }, { sleepFn: async () => {} }),
  /Aborted/,
);
ok(abortTries === 1, 'AbortError 不消耗重试');

let noRetryTries = 0;
await assert.rejects(
  withNetworkRetry(async () => {
    noRetryTries += 1;
    throw Object.assign(new Error('API 401'), { status: 401 });
  }, { sleepFn: async () => {} }),
  /API 401/,
);
ok(noRetryTries === 1, '非网络 4xx 不重试');

let streamTries = 0;
await assert.rejects(
  withNetworkRetry(async () => {
    streamTries += 1;
    throw new TypeError('Failed to fetch');
  }, { canRetry: () => false, sleepFn: async () => {} }),
  /Failed to fetch/,
);
ok(streamTries === 1, '已经开始流式输出后不重放');

const realFetch = globalThis.fetch;
let providerCalls = 0;
try {
  globalThis.fetch = async () => {
    providerCalls += 1;
    if (providerCalls === 1) {
      return new Response(JSON.stringify({ error: { message: 'temporary' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const providerReply = await chatComplete({
    protocol: 'openai', baseUrl: 'https://example.invalid/v1', apiKey: 'k', model: 'test-model',
  }, [{ role: 'user', content: 'hi' }], { maxTokens: 16 });
  ok(providerReply.content === 'ok' && providerCalls === 2, 'AI provider 503 后自动重试成功');
} finally {
  globalThis.fetch = realFetch;
}
console.log(`net-retry-smoke: ${passed} ok`);

