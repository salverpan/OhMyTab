/* 各协议思考字段怎么发。目录命中走厂商形态；未收录按 Base URL 猜，Off 不带字段。
 * 探测缓存（omit / maxEffort）优先于目录，避免重复 400。 */

import {
  inferModelCaps,
  effortToOpenAI,
  effortToDeepSeek,
  effortToThinkingBudget,
  effortToGeminiBudget,
  providerHintFromCfg,
  resolveEffortId,
} from '../model-limits.js';
import { peekEffortProbe, clampEffortToMax } from '../effort-probe.js';

export function resolveReasoningPlan(cfg) {
  const caps = inferModelCaps(cfg?.model, cfg);
  if (cfg?.omitReasoning) {
    return { send: false, effortId: 'off', caps, omit: true };
  }
  const probe = peekEffortProbe(cfg);
  if (probe?.omit) {
    return { send: false, effortId: 'off', caps, probe, omit: true };
  }
  if (caps.reasoning === 'none' || caps.reasoning === 'always') {
    return { send: false, effortId: caps.reasoning === 'always' ? 'high' : 'off', caps, probe };
  }
  const raw = String(cfg?.effort || caps.defaultEffort || 'off').trim();
  let effortId = resolveEffortId(raw);
  if (probe?.maxEffort) effortId = clampEffortToMax(effortId, probe.maxEffort);
  if (effortId === 'off' && caps.source === 'fallback') {
    return { send: false, effortId, caps, probe };
  }
  return { send: true, effortId, caps, probe };
}

/** OpenAI 兼容系。未知主机也发 reasoning_effort（聚合/中转最常见）。Off+未收录：不发。 */
export function applyOpenAIReasoning(body, cfg) {
  const plan = resolveReasoningPlan(cfg);
  if (!plan.send) return;
  const { effortId } = plan;
  const hint = providerHintFromCfg(cfg);
  const model = String(cfg?.model || '');

  if (hint === 'deepseek' || /deepseek-v4/i.test(model)) {
    if (effortId === 'off') {
      body.thinking = { type: 'disabled' };
    } else {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = effortToDeepSeek(effortId);
    }
    return;
  }
  if (hint === 'zhipuai' || /^glm-/i.test(model)) {
    body.thinking = { type: effortId === 'off' ? 'disabled' : 'enabled' };
    return;
  }
  if (effortId === 'off') {
    body.reasoning_effort = effortToOpenAI(effortId);
    return;
  }
  body.reasoning_effort = effortToOpenAI(effortId);
}

export function applyAnthropicThinking(body, cfg) {
  const plan = resolveReasoningPlan(cfg);
  if (!plan.send) return;
  const budget = effortToThinkingBudget(plan.effortId);
  if (budget <= 0) return;
  body.thinking = { type: 'enabled', budget_tokens: budget };
  const floor = budget + 4096;
  if ((body.max_tokens || 0) < floor) body.max_tokens = floor;
}

export function applyGeminiThinking(generationConfig, cfg) {
  const plan = resolveReasoningPlan(cfg);
  if (!plan.send) return;
  const budget = effortToGeminiBudget(plan.effortId);
  if (budget <= 0) return;
  generationConfig.thinkingConfig = { thinkingBudget: budget };
}
