/** 网络错误重试：默认最多重试 5 次，指数退避 + 抖动。 */

export const NETWORK_MAX_RETRIES = 5;
export const NETWORK_RETRY_BASE_MS = 500;
export const NETWORK_RETRY_MAX_DELAY_MS = 8000;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 521, 522, 523, 524, 529]);
const RETRYABLE_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
]);

export function formatNetworkError(err) {
  if (!err) return '未知错误';
  if (err.name === 'AbortError') return '已中断';
  const msg = String(err.message || err || '').trim();
  if (/failed to fetch|fetch failed|networkerror|network error|load failed/i.test(msg)) {
    return '连不上模型服务（网络中断或 API 地址不可达）';
  }
  return msg || '未知错误';
}

export function isRetryableNetworkError(err) {
  if (!err || err.name === 'AbortError') return false;
  const status = Number(err.status || err.statusCode || 0);
  if (status && RETRYABLE_STATUS.has(status)) return true;
  if (err.timeout === true) return true;
  const code = String(err.code || '').toUpperCase();
  if (RETRYABLE_CODES.has(code)) return true;
  const msg = String(err.message || err).toLowerCase();
  return /(failed to fetch|networkerror|network error|fetch failed|load failed|socket hang up|connection reset|econnreset|etimedout|enotfound|eai_again|econnrefused|网络错误|网络连接|连接重置)/i.test(msg);
}

export function networkRetryDelayMs(retryNumber, err = {}) {
  const retryAfter = Number(err.retryAfterMs || err.retryAfter || 0);
  if (retryAfter > 0) return Math.min(30000, Math.max(0, retryAfter));
  const n = Math.max(1, Number(retryNumber) || 1);
  const base = Math.min(NETWORK_RETRY_MAX_DELAY_MS, NETWORK_RETRY_BASE_MS * (2 ** (n - 1)));
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

export function networkSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      const e = new Error('Aborted');
      e.name = 'AbortError';
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      const e = new Error('Aborted');
      e.name = 'AbortError';
      reject(e);
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * @param {Function} fn async attempt
 * @param {object} opts maxRetries/signal/canRetry/onRetry/delayFn/sleepFn
 */
export async function withNetworkRetry(fn, {
  maxRetries = NETWORK_MAX_RETRIES,
  signal = null,
  canRetry = null,
  onRetry = null,
  delayFn = networkRetryDelayMs,
  sleepFn = networkSleep,
} = {}) {
  let retries = 0;
  for (;;) {
    try {
      return await fn(retries);
    } catch (err) {
      if (err?.name === 'AbortError' || (signal && signal.aborted)) throw err;
      if (!isRetryableNetworkError(err)) throw err;
      if (canRetry && !canRetry(err, retries)) throw err;
      if (retries >= maxRetries) throw err;
      retries += 1;
      const delayMs = Math.max(0, Number(delayFn(retries, err)) || 0);
      try { onRetry?.({ attempt: retries, maxRetries, delayMs, error: err }); } catch (_) {}
      await sleepFn(delayMs, signal);
    }
  }
}
