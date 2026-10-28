/**
 * 父代理回合收口：失败展示必须等子任务真正停掉。
 * 心跳 / 侧栏 / 浮动聊天共用，避免「聊天气泡已经失败、后台还在跑」。
 */

import { classifySubagentLlmError } from './subagent-core.js';
import { networkSleep } from './net-retry.js';

export function hasLiveChildren(ctx) {
  if (!ctx) return false;
  if (ctx.runningSubagents && ctx.runningSubagents.size > 0) return true;
  const bgs = ctx.backgroundAborts;
  if (bgs && bgs.size) {
    for (const c of bgs) {
      if (c && !(c.signal && c.signal.aborted)) return true;
    }
  }
  return false;
}

export async function waitForLiveChildren(ctx, {
  timeoutMs = 120000,
  intervalMs = 80,
  signal = null,
  sleepFn = null,
} = {}) {
  const sleep = sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const t0 = Date.now();
  while (hasLiveChildren(ctx)) {
    if (signal && signal.aborted) return false;
    if (Date.now() - t0 >= timeoutMs) return false;
    await sleep(intervalMs);
  }
  return true;
}

/** 先中止父信号和后台 AbortController，再等到 runningSubagents 清空（或超时）。 */
export async function abortAndSettleChildren(controller, ctx, opts = {}) {
  try { controller?.abort(); } catch (_) {}
  const bgs = ctx && ctx.backgroundAborts;
  if (bgs) {
    for (const c of bgs) {
      try { c.abort(); } catch (_) {}
    }
  }
  return waitForLiveChildren(ctx, {
    timeoutMs: opts.timeoutMs ?? 8000,
    intervalMs: opts.intervalMs,
    signal: opts.signal,
    sleepFn: opts.sleepFn,
  });
}

/**
 * 父代理 LLM 一轮：通道级重试耗尽后再救几轮。
 * 返回 { action: 'ok'|'retry 已消化'|'salvage'|'throw'|'abort', result?, error?, recoveries }
 */
export async function recoverParentLlmCall(fn, {
  signal = null,
  hasProgress = false,
  recoveries = 0,
  maxRecoveries,
  onRetry = null,
  sleepFn = null,
} = {}) {
  let used = Math.max(0, Number(recoveries) || 0);
  for (;;) {
    try {
      const result = await fn();
      return { action: 'ok', result, recoveries: 0 };
    } catch (err) {
      const decision = classifySubagentLlmError(err, {
        recoveries: used,
        maxRecoveries,
        hasProgress: !!hasProgress,
        aborted: !!(signal && signal.aborted) || err?.name === 'AbortError',
      });
      if (decision.action === 'retry') {
        used = decision.recoveries;
        try { onRetry?.(decision); } catch (_) {}
        await (sleepFn || networkSleep)(decision.delayMs, signal);
        continue;
      }
      return { action: decision.action, error: err, recoveries: used };
    }
  }
}
