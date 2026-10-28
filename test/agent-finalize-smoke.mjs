import assert from 'node:assert/strict';
import {
  inspectTurnBudget,
  shouldFinalizeEmptyAnswer,
  toolsForFinalizeRound,
  emptyToolFallbackText,
  FINALIZE_BUDGET_TOKENS,
  FINALIZE_MAX_ROUNDS,
  FINALIZE_EMPTY_AFTER_TOOLS,
} from '../src/lib/agent-finalize.js';
import { RESEARCH_POLICIES, formatResearchPolicyBlock } from '../src/lib/research-mode.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const normal = RESEARCH_POLICIES.normal;
const deep = RESEARCH_POLICIES.deep;
ok(normal.maxMinutes === 0, '普通模式时间不限');
ok(deep.maxMinutes === 0, 'Deep Research 时间不限');
ok(normal.maxTokens === 0 && deep.maxTokens === 0, '两种模式默认 token 不限');
ok(formatResearchPolicyBlock({ policy: normal }).includes('时间不限'), '普通模式提示写时间不限');
ok(formatResearchPolicyBlock({ policy: deep }).includes('时间不限'), 'Deep Research 提示写时间不限');
ok(formatResearchPolicyBlock({ policy: normal }).includes('token 不限'), '普通模式提示写 token 不限');

const started = 1_000_000;
ok(
  inspectTurnBudget(normal, {
    round: 8,
    maxRounds: 45,
    turnUsageSum: 1000,
    turnStartedAt: started,
    now: started + 60 * 60000,
  }).finalize === false,
  '默认策略跑一小时也不按时间收尾',
);

ok(
  inspectTurnBudget({ maxMinutes: 6 }, {
    round: 8,
    maxRounds: 45,
    turnUsageSum: 1000,
    turnStartedAt: started,
    now: started + 7 * 60000,
  }).finalize === false,
  '显式写了分钟数也不按墙钟收尾',
);

ok(
  inspectTurnBudget(normal, {
    round: 2,
    maxRounds: 45,
    turnUsageSum: 9_999_999,
  }).finalize === false,
  '默认 token 不限时累计用量再高也不按 token 收尾',
);

const tokensOut = inspectTurnBudget({ maxTokens: 250000 }, {
  round: 2,
  maxRounds: 45,
  turnUsageSum: 250001,
});
ok(tokensOut.finalize && tokensOut.reason === FINALIZE_BUDGET_TOKENS, '显式设了 token 上限才收尾');

const lastRound = inspectTurnBudget({}, { round: 44, maxRounds: 45 });
ok(lastRound.finalize && lastRound.reason === FINALIZE_MAX_ROUNDS, '最后一轮改成只写回答');

ok(
  inspectTurnBudget({}, { round: 0, maxRounds: 45 }).finalize === false,
  '首轮不收尾',
);

ok(
  shouldFinalizeEmptyAnswer({
    turnHadTools: true,
    toolCalls: [],
    content: '',
    alreadyFinalized: false,
  }),
  '工具跑完空正文要再逼一稿',
);
ok(
  !shouldFinalizeEmptyAnswer({
    turnHadTools: false,
    toolCalls: [],
    content: '',
    alreadyFinalized: false,
  }),
  '从未调工具的空回复不走收尾',
);
ok(
  !shouldFinalizeEmptyAnswer({
    turnHadTools: true,
    toolCalls: [],
    content: '',
    alreadyFinalized: true,
  }),
  '收尾只做一次',
);
ok(
  !shouldFinalizeEmptyAnswer({
    turnHadTools: true,
    toolCalls: [{ name: 'query_feed_items' }],
    content: '',
    alreadyFinalized: false,
  }),
  '还有工具调用时不收尾',
);

ok(Array.isArray(toolsForFinalizeRound(['a'], true)) && toolsForFinalizeRound(['a'], true).length === 0, '收尾轮去掉工具');
ok(toolsForFinalizeRound(['a'], false)[0] === 'a', '普通轮保留工具');

const fallback = emptyToolFallbackText(['refresh_feeds', 'query_feed_items', 'fetch_feed_items']);
ok(fallback.includes('refresh_feeds') && fallback.includes('请再发一句'), '兜底文案不再是已执行操作');
ok(FINALIZE_EMPTY_AFTER_TOOLS.includes('不要再调用任何工具'), '空正文收尾提示禁止继续调工具');

console.log(`agent finalize smoke: ${passed} passed`);
