/**
 * API usage 累加。侧栏角标通过 ctx.onUsage 入账。
 * 主 agent 回合在 panel 里自己加；子代理 / 章节 Worker / Check / 手动压缩必须走这里。
 */

export function usageTotalTokens(usage) {
  if (!usage) return 0;
  const total = Number(usage.total_tokens);
  if (Number.isFinite(total) && total > 0) return total;
  return (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0);
}

export function emitUsage(ctx, usage) {
  if (!ctx || typeof ctx.onUsage !== 'function') return 0;
  if (Array.isArray(usage)) {
    let n = 0;
    for (const item of usage) n += emitUsage(ctx, item);
    return n;
  }
  const n = usageTotalTokens(usage);
  if (!n) return 0;
  try { ctx.onUsage(usage); } catch (_) {}
  return n;
}
