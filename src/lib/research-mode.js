/** 普通模式与 Deep Research 的运行时路由和预算。
 * maxMinutes: 0 = 不限时。maxRounds / wrapHintRound: 0 = 不按轮次收尾。
 * 调研做到成文和核验之前，主循环不得因为模型停手而结束（见 researchStopGap）。 */
export const RESEARCH_MODE_NORMAL = 'normal';
export const RESEARCH_MODE_DEEP = 'deep';
/** 同一阶段连续停手超过这次数，才把缺口写给用户。 */
export const RESEARCH_HOLD_MAX = 8;
/** 等后台子任务交回的最长时间。用户中止会提前返回。 */
export const RESEARCH_CHILD_WAIT_MS = 6 * 60 * 60 * 1000;

export const RESEARCH_POLICIES = {
  normal: {
    mode: RESEARCH_MODE_NORMAL,
    maxRounds: 0,
    wrapHintRound: 0,
    maxTaskParallel: 2,
    maxSubagentsPerTurn: 2,
    maxTokens: 0,
    maxMinutes: 0,
    requireBrief: false,
    requireArtifact: false,
    requireAnalystMemo: false,
    requireRedTeam: false,
    requireChecks: false,
  },
  deep: {
    mode: RESEARCH_MODE_DEEP,
    maxRounds: 0,
    wrapHintRound: 0,
    maxTaskParallel: 6,
    maxSubagentsPerTurn: 12,
    maxTokens: 0,
    maxMinutes: 0,
    requireBrief: true,
    requireArtifact: true,
    requireAnalystMemo: true,
    requireRedTeam: true,
    requireChecks: true,
  },
};

export function policyForMode(mode) {
  return RESEARCH_POLICIES[mode === RESEARCH_MODE_DEEP ? RESEARCH_MODE_DEEP : RESEARCH_MODE_NORMAL];
}

const DEEP_RE = /(深度调研|深入研究|系统研究|深度分析|深入分析|全面分析|完整报告|研究报告|行业报告|行业分析|投资分析|竞争分析|尽调|调研|多源|多维度|竞争格局|投资价值|政策影响|战略分析|分析框架|判断趋势|决策建议|全面评估|latest|deep research)/i;
const NORMAL_RE = /(快速|简单|一句话|查一下|搜一下|总结当前|总结这页|这个函数|这个文件|是什么|在哪)/i;

export function routeResearchMode(text, opts = {}) {
  const s = String(text || '');
  const explicit = String(opts.explicitMode || '').toLowerCase();
  if (explicit === RESEARCH_MODE_DEEP || explicit === RESEARCH_MODE_NORMAL) {
    return { mode: explicit, reason: '用户显式指定', policy: policyForMode(explicit) };
  }
  if (opts.unfinishedResearch && !(NORMAL_RE.test(s) && !DEEP_RE.test(s))) {
    return { mode: RESEARCH_MODE_DEEP, reason: '上一轮调研尚未成文', policy: policyForMode(RESEARCH_MODE_DEEP) };
  }
  if (NORMAL_RE.test(s) && !DEEP_RE.test(s)) {
    return { mode: RESEARCH_MODE_NORMAL, reason: '命中快速/单点查询信号', policy: policyForMode(RESEARCH_MODE_NORMAL) };
  }
  let score = 0;
  const reasons = [];
  if (DEEP_RE.test(s)) { score += 3; reasons.push('多源/报告/深度分析信号'); }
  if (s.length > 120) { score += 1; reasons.push('问题较长'); }
  if ((s.match(/[？?]/g) || []).length >= 2) { score += 1; reasons.push('包含多个问题'); }
  if (Number(opts.selectedCount) >= 4) { score += 1; reasons.push('多条目比较'); }
  if (Number(opts.attachmentCount) >= 2) { score += 1; reasons.push('多附件'); }
  const mode = score >= 2 ? RESEARCH_MODE_DEEP : RESEARCH_MODE_NORMAL;
  return {
    mode,
    reason: reasons.length ? reasons.join('；') : '默认普通查询',
    policy: policyForMode(mode),
  };
}

export function formatResearchPolicyBlock(route) {
  const p = (route && route.policy) || RESEARCH_POLICIES.normal;
  const timeBudget = '时间不限';
  const tokenBudget = p.maxTokens ? ('约 ' + Math.round(p.maxTokens / 1000) + 'k tokens') : 'token 不限';
  const rounds = p.maxRounds > 0 ? ('最多 ' + p.maxRounds + ' 轮模型往返') : '轮次不限';
  return [
    '### 本轮研究模式',
    '- 模式: ' + p.mode + (route && route.reason ? '（' + route.reason + '）' : ''),
    '- 预算: ' + rounds + '；最多 ' + p.maxTaskParallel + ' 个并行 researcher；最多 ' + p.maxSubagentsPerTurn + ' 个子任务；' + tokenBudget + '；' + timeBudget + '。',
    '- 阶段要求: ' + (p.requireBrief ? '先写研究简报；' : '') + (p.requireArtifact ? '研究材料落 artifact；' : '') + (p.requireAnalystMemo ? 'Analyst Memo + Red Team；' : '') + (p.requireChecks ? '交付前必须 review_argument + check_facts。' : '不强制双 Check。'),
    '- 调研在 write_document 保存之前不得结束。备忘录、子代理交回和聊天里的判断都不是交付。不要等用户说「继续」。',
  ].join('\n');
}

/** policy.maxRounds <= 0 表示不封顶。未声明时用 fallback（主循环默认 AGENT_MAX_ROUNDS）。 */
export function resolveLoopRounds(policy, fallback = Infinity) {
  if (!policy || policy.maxRounds == null || policy.maxRounds === '') return fallback;
  const n = Number(policy.maxRounds);
  if (!Number.isFinite(n) || n <= 0) return Infinity;
  return Math.floor(n);
}

/** 0 或未启用表示不要注入「接近轮次上限」的收尾提示。 */
export function resolveWrapRound(policy, fallback = 0) {
  if (!policy || policy.wrapHintRound == null || policy.wrapHintRound === '') return fallback;
  const n = Number(policy.wrapHintRound);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function taskArgType(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return ''; }
  }
  if (!obj || typeof obj !== 'object') return '';
  return String(obj.subagent_type || obj.type || obj.agent || '').trim().toLowerCase();
}

function toolSucceeded(content) {
  const s = String(content == null ? '' : content).trim();
  if (!s || s === '已中断') return false;
  if (s.startsWith('参数错误') || s.startsWith('Error:') || s.startsWith('该子代理不能')) return false;
  if (/"ok"\s*:\s*false/.test(s)) return false;
  return true;
}

export function listToolOutcomes(messages) {
  const names = new Map();
  const types = new Map();
  const outcomes = [];
  for (const m of messages || []) {
    if (!m) continue;
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (!tc) continue;
        const id = tc.id || tc.tool_call_id;
        const fn = tc.function || {};
        const name = fn.name || tc.name || '';
        if (id) names.set(id, name);
        if (name === 'task' && id) types.set(id, taskArgType(fn.arguments != null ? fn.arguments : tc.arguments));
      }
    }
    if (m.role === 'tool') {
      const id = m.tool_call_id;
      outcomes.push({
        name: names.get(id) || '',
        ok: toolSucceeded(m.content),
        taskType: types.get(id) || '',
      });
    }
  }
  return outcomes;
}

function isResearchWork(outcome) {
  if (['load_framework', 'analyst_memo', 'write_research_artifact', 'write_document', 'review_argument', 'check_facts'].includes(outcome.name)) {
    return true;
  }
  return outcome.name === 'task' && outcome.taskType !== 'browser';
}

const RESEARCH_PROMPTS = {
  gather: '调研还没做完。不要结束本轮，不要在聊天里交半成品，也不要等用户说「继续」。继续检索、阅读或派 explore。子代理交回或材料够了，就 load_framework（如需）→ analyst_memo → write_document。',
  memo: '调研还不能停。下一步调用 analyst_memo（含 red_team）。备忘录不是交付物。不要等用户说「继续」。',
  write: '调研还不能停。分析师备忘录和子代理摘要都不是交付物。下一步调用 write_document，把已有 analysis 原样传入。不要在聊天里重写正文，不要等用户说「继续」。',
  review: '文档已保存，交付前还要 review_argument。未通过就按 issues 改判断并重新 write_document，然后再评审。不要结束本轮，不要等用户说「继续」。',
  facts: '文档已保存，还要 check_facts。有失败项就只改正事实和引文，然后重新核验。不要结束本轮，不要等用户说「继续」。',
};

const RESEARCH_LABELS = {
  gather: 'Continue',
  memo: '继续写分析师备忘录',
  write: '继续写成文档',
  review: '继续评审观点',
  facts: '继续核验事实',
};

function researchStep(step) {
  return { step, prompt: RESEARCH_PROMPTS[step], label: RESEARCH_LABELS[step] };
}

/** 本轮尾部若还有没做成的调研阶段，返回下一步；可以收束则返回 null。 */
export function researchStopGap(messages, policy) {
  const p = policy || {};
  const deep = p.mode === RESEARCH_MODE_DEEP;
  const outcomes = listToolOutcomes(messages);
  const started = outcomes.some(isResearchWork);
  if (!deep && !started) return null;
  const ok = (name) => outcomes.some((o) => o.name === name && o.ok);
  const productive = outcomes.filter((o) => o.ok && o.name !== 'ask_research_scope' && o.name !== 'suggest_actions');
  const explored = outcomes.some((o) => o.ok && o.name === 'task' && o.taskType !== 'browser');
  const framed = ok('load_framework') || ok('analyst_memo') || ok('write_research_artifact');
  if (!productive.length || (!explored && !framed && !ok('write_document') && productive.length < 3)) {
    return researchStep('gather');
  }
  if (deep && p.requireAnalystMemo && !ok('analyst_memo') && !ok('write_document')) return researchStep('memo');
  if (!ok('write_document')) return researchStep('write');
  if (deep && p.requireChecks && !ok('review_argument')) return researchStep('review');
  if (deep && p.requireChecks && !ok('check_facts')) return researchStep('facts');
  return null;
}

export function researchStuckText(step) {
  const name = {
    gather: '继续调研',
    memo: 'analyst_memo',
    write: 'write_document',
    review: 'review_argument',
    facts: 'check_facts',
  }[step] || '下一步工具';
  return `调研已自动往下走了多次，模型仍没有调用 ${name}。已有材料还在工作区。`;
}

/**
 * 模型不再调工具时：调研没做完就 continue（工具仍开着），做完才 stop。
 * 同一阶段连续停手超过 RESEARCH_HOLD_MAX 才 stuck。
 */
export function nextResearchHold(messages, policy, {
  holdStep = '',
  holdCount = 0,
  waitingForUser = false,
} = {}) {
  if (waitingForUser) return { action: 'stop', holdStep, holdCount, gap: null };
  const gap = researchStopGap(messages, policy);
  if (!gap) return { action: 'stop', holdStep: '', holdCount: 0, gap: null };
  const count = gap.step === holdStep ? holdCount + 1 : 1;
  if (count > RESEARCH_HOLD_MAX) {
    return { action: 'stuck', gap, holdStep: gap.step, holdCount: count, text: researchStuckText(gap.step) };
  }
  return { action: 'continue', gap, holdStep: gap.step, holdCount: count };
}

const STEP_TOOLS = {
  memo: ['load_framework', 'analyst_memo'],
  write: ['load_framework', 'analyst_memo', 'write_document'],
  review: ['analyst_memo', 'write_document', 'review_argument'],
  facts: ['check_facts', 'review_argument', 'write_document'],
};

/** gather 保留全部工具。其余阶段收窄到能推进交付的工具。 */
export function toolsForResearchStep(chatTools, step) {
  const allow = STEP_TOOLS[step];
  if (!allow) return chatTools;
  const set = new Set(allow);
  const filtered = (chatTools || []).filter((t) => set.has(t && t.function && t.function.name));
  return filtered.length ? filtered : chatTools;
}

/** 上一条真实用户消息之后若已开工但没成文，下一条接着走深度调研。 */
export function researchCarryFromHistory(history) {
  const msgs = Array.isArray(history) ? history : [];
  let start = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m || m.role !== 'user') continue;
    const text = typeof m.content === 'string' ? m.content : '';
    if (text.startsWith('【系统提示】') || text.startsWith('【后台子任务完成】')) continue;
    start = i + 1;
    break;
  }
  const tail = msgs.slice(start);
  if (!listToolOutcomes(tail).some(isResearchWork)) return false;
  return researchStopGap(tail, RESEARCH_POLICIES.deep) != null;
}

