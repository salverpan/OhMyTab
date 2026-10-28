/**
 * 主代理收尾：工具轮结束后必须再给模型一次「只写回答、不再调工具」的机会。
 *
 * 旧行为在时间/token 预算用尽时把收尾提示推进 messages 然后直接 break，
 * 模型根本看不到那条提示；工具轮若返回空正文，界面就合成「已执行操作：…」。
 * 订阅日报这类「refresh + 多次 query + fetch 全文」以前会先把时间预算用完，
 * 于是用户只看到工具清单、看不到日报。时间预算现已关闭（maxMinutes=0）。
 */

export const FINALIZE_EMPTY_AFTER_TOOLS =
  '工具已执行完毕。请基于以上工具结果直接给出完整回答，不要再调用任何工具。' +
  '订阅日报或推荐新闻请用已查询到的标题、摘要、链接和日期成文；没有全文的条目据实标明，不要编造正文。';

export const FINALIZE_BUDGET_TOKENS =
  '研究预算已用完。停止扩大检索，基于已有材料给出明确判断，并把未解决项写进回答。不要再调用工具。';

export const FINALIZE_BUDGET_TIME =
  '研究时间预算已用完。停止扩大检索，基于已有材料给出明确判断，并把未解决项写进回答。不要再调用工具。';

export const FINALIZE_MAX_ROUNDS =
  '已达到工具轮次上限。请基于已获取的信息给出最终回答，不要再调用工具。';

export function inspectTurnBudget(policy, {
  round = 0,
  maxRounds = Infinity,
  turnUsageSum = 0,
} = {}) {
  const p = policy || {};
  if (p.maxTokens && turnUsageSum > p.maxTokens) {
    return { finalize: true, reason: FINALIZE_BUDGET_TOKENS };
  }
  if (Number.isFinite(maxRounds) && maxRounds >= 1 && round >= maxRounds - 1) {
    return { finalize: true, reason: FINALIZE_MAX_ROUNDS };
  }
  return { finalize: false, reason: '' };
}

export function shouldFinalizeEmptyAnswer({
  turnHadTools,
  toolCalls,
  content,
  alreadyFinalized,
} = {}) {
  if (alreadyFinalized) return false;
  if (!turnHadTools) return false;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) return false;
  return !String(content || '').trim();
}

export function toolsForFinalizeRound(chatTools, finalize) {
  return finalize ? [] : chatTools;
}

export function emptyToolFallbackText(toolNames) {
  const names = (Array.isArray(toolNames) ? toolNames : [])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  const list = names.length ? names.join('、') : '若干工具';
  return `工具已跑完（${list}），但没有写出最终回答。请再发一句「继续，根据刚才的工具结果作答」。`;
}
