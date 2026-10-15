/**
 * 子代理运行时 —— 对齐 OpenCode Task / Claude Code Agent / Codex spawn / Pi AgentSession
 * 的共识，收口到 SuperCat 浏览器场景：
 *
 * - 父代理通过 `task` 工具派活；子代理独立消息数组，只把摘要交回父上下文
 * - 内置 explore（只读调研）/ general（可写多步）/ browser（页面自动化）
 * - 自定义 agent 存在 chrome.storage.local.customSubagents
 * - 默认同轮并行、禁止嵌套、可 task_id 续传；background 仅侧栏允许（浮动窗 SW 等前台）
 *
 * 不把 OpenCode 的 session 树、Codex 的 git worktree、权限 ask 弹窗搬进来——
 * 浏览器里对应物是「独立上下文 + 工具白名单 + 自己开的 aiOpened 标签」。
 */

import { streamChatWithTools } from './ai-client.js';
import { putTrace, subagentReportNodes, CHAT_THREAD } from './trace-log.js';
import {
  processRoundToolCalls, registerTaskTool, registerSectionJobTool, retrieveMemories, executeToolCall,
} from './chat-executor.js';
import { formatMemoriesBlock } from './agent-memory.js';
import { CHAT_TOOLS } from './tools.js';
import { SUBMIT_REPORT_TOOL } from './task-report.js';
import { SECTION_JOB_TOOL, runSectionJob } from './section-worker.js';
import { runCheckPipeline, verificationForMain } from './check/index.js';
import { getAiChannels, getCustomSubagents, getSubagentLimits, resolveChannelModel } from './storage.js';
import {
  SUBAGENT_MAX_DEPTH, SUBAGENT_MAX_PARALLEL, SUBAGENT_MAX_TABS,
  SUBAGENT_BUDGET_WARN_RATIO, SUBAGENT_FORCED_SUBMIT_ROUNDS,
  clampSubagentMaxTabs,
} from './limits.js';
import { isExploreInteractAllowed } from './subagent-policy.js';
import {
  BUILTIN_AGENTS, AGENT_NAME_RE, parseAgentMentions, validateCustomAgent,
  formatAgentCatalog, filterToolsForAgent, allowedToolNames, formatTaskResult,
  revisionRequestFor, serializeSubagentSessions, restoreSubagentSessions,
} from './subagent-core.js';
import { appendViewportShots } from './tool-round-messages.js';
import { emitUsage, usageTotalTokens } from './usage.js';
import { logActivity } from './activity-log.js';

export { SUBAGENT_MAX_PARALLEL, isExploreInteractAllowed };
export {
  BUILTIN_AGENTS, parseAgentMentions, validateCustomAgent, formatAgentCatalog,
  filterToolsForAgent, formatTaskResult, revisionRequestFor,
  serializeSubagentSessions, restoreSubagentSessions,
};

export async function listAgents() {
  const custom = await getCustomSubagents().catch(() => []);
  const extra = (custom || []).map((a) => ({
    name: String(a.name || '').toLowerCase(),
    description: String(a.description || ''),
    prompt: String(a.prompt || ''),
    tools: Array.isArray(a.tools) && a.tools.length ? a.tools : ['*'],
    channelId: a.channelId || '',
    custom: true,
    id: a.id,
  })).filter((a) => AGENT_NAME_RE.test(a.name));
  return [...BUILTIN_AGENTS, ...extra];
}

function newTaskId() {
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRuntime(ctx) {
  if (!ctx.subagentSessions) ctx.subagentSessions = new Map();
  if (!ctx.runningSubagents) ctx.runningSubagents = new Set();
  return ctx;
}

async function channelApiConfig(channelId, fallbackContextTokens) {
  if (!channelId) return null;
  try {
    const chans = await getAiChannels();
    const cur = (chans || []).find((c) => c.id === channelId);
    if (!cur || !(cur.apiKey || cur.baseUrl)) return null;
    const active = resolveChannelModel(cur);
    const ctxRaw = Number(active.contextTokens ?? cur.contextTokens);
    return {
      apiKey: cur.apiKey || '',
      baseUrl: cur.baseUrl || '',
      model: active.name || cur.model || '',
      protocol: cur.protocol || 'openai',
      contextTokens: Number.isFinite(ctxRaw) ? ctxRaw : fallbackContextTokens,
      effort: active.effort || cur.effort || '',
    };
  } catch (_) {
    return null;
  }
}

async function resolveSubagentApiConfig(ctx, agent) {
  const fromChannel = await channelApiConfig(agent && agent.channelId, ctx.apiConfig && ctx.apiConfig.contextTokens);
  return fromChannel || ctx.apiConfig;
}

/** Check 审查模型：设置里指定了渠道就用它，否则返回 null（由 Check 回落到撰写模型并打标）。 */
async function resolveJudgeApiConfig(ctx, limits) {
  return channelApiConfig(limits && limits.checkChannelId, ctx.apiConfig && ctx.apiConfig.contextTokens);
}

export function budgetState(budget, usedTokens, startedAt) {
  const tokenRatio = budget.tokens > 0 ? usedTokens / budget.tokens : 0;
  const timeRatio = budget.ms > 0 ? (Date.now() - startedAt) / budget.ms : 0;
  const ratio = Math.max(tokenRatio, timeRatio);
  return { ratio, by: tokenRatio >= timeRatio ? 'token' : 'time' };
}

async function closeSubagentTabs(ctx) {
  const owner = ctx && ctx.subagentOwner;
  const ids = [...((ctx && ctx.subagentOpenedTabs) || [])];
  if (ctx) ctx.subagentOpenedTabs = new Set();
  if (ctx && typeof ctx.closeOwnedAiTabs === 'function') {
    await ctx.closeOwnedAiTabs(owner, ids);
    return;
  }
  if (ids.length && typeof chrome !== 'undefined' && chrome.tabs) {
    await Promise.all(ids.map((id) => chrome.tabs.remove(id).catch(() => {})));
  }
  if (owner && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      await chrome.runtime.sendMessage({ type: 'CLOSE_AI_TABS', data: { owner, tabIds: ids } });
    } catch (_) {}
  }
}

function currentUrlFromTabInfo(info) {
  const s = String(info || '');
  const m = s.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : '';
}

async function memoriesBlockForChild(prompt, ctx) {
  try {
    const memories = await retrieveMemories(String(prompt || ''), {
      currentUrl: currentUrlFromTabInfo(ctx && ctx.currentTabInfo),
    });
    return formatMemoriesBlock(memories);
  } catch (_) {
    return '';
  }
}

function childSystemPrompt(agent, maxTabs = SUBAGENT_MAX_TABS) {
  return [
    `你是 SuperCat 的「${agent.name}」子代理。不要扮演对用户说话的主助手。`,
    '禁止调用 task。禁止 clear_context / suggest_actions / ask_research_scope / manage_heartbeat / save_memory。',
    '经验记忆只读：系统会按当前页与任务自动注入相关条目（如有）。不要调用 save_memory；值得记的经验写进给父代理的报告即可。',
    `标签预算：同时最多打开 ${maxTabs} 个标签页。读完不需要的先 manage_tabs(close, tab_id) 关掉再开新的——读过的内容仍在你的上下文里，不必为留着标签而占额度。`,
    '任务完成后必须调用 submit_report。自然语言正文、Markdown 或自称“已完成”都不算交回。',
    ...(agent.name === 'explore'
      ? [
        '阅读交回使用 passages：每条包含 use、doc_id、anchor、逐字 quote。claims 传空数组，不要写 findings。',
        '查过但没有原文的要点写进 unresolved。summary 只列覆盖了哪些 use，不要写文档正文。',
      ]
      : [
        '事实拆成 claims；每条 evidence 必须给 doc_id、锚点和来源逐字 quote。只有 URL、标签页 id 或转述的内容放 unresolved，不得伪造证据。',
        '每条 claim 写明 attribution（最初是谁说的，不是转载网站）与 modality。当事方的说法是 claimed，媒体转述是 reported，不要把它们写成 confirmed；claim 句子本身也要保留“X 称”。',
        '查过但没找到的方向也写进 unresolved。操作型任务把已执行动作写入 actions；没有事实 claim 时 claims 可以为空。',
      ]),
    '单篇长文档超出当前上下文时可调用 section_job。'
      + '返回 content_has_more=true 时，用相同 doc_id 与 goal、只传 offset=content_next_offset 续拉，直到 content_has_more=false。'
      + '阅读任务把其中的逐字 quote 收进 passages。不要用它代替普通网页检索。',
    '禁止把网页原文或大段摘录粘进 summary；长材料只通过 evidence 锚点引用。',
    '',
    agent.prompt || '',
  ].join('\n');
}

async function runSubagentLoop(session, prompt, ctx, signal, agent, apiCfg, tools, limits) {
  const messages = session.messages;
  if (messages.length === 0) {
    const storedTabs = Number(ctx && ctx.subagentMaxTabs);
    const maxTabs = Number.isFinite(storedTabs) && storedTabs >= 1
      ? clampSubagentMaxTabs(storedTabs)
      : limits.maxTabs;
    messages.push({ role: 'system', content: childSystemPrompt(agent, maxTabs) });
    const tab = ctx.currentTabInfo ? `当前用户页面：${ctx.currentTabInfo}` : '当前用户页面：未知';
    const memBlock = await memoriesBlockForChild(prompt, ctx);
    const memNote = memBlock
      ? `\n\n${memBlock}`
      : '';
    messages.push({
      role: 'user',
      content: `[SYSTEM-CONTEXT]\n你在独立上下文中工作。${tab}\n项目：${ctx.projectId || 'default'}\n不要切换用户正在看的标签；需要访问网页时 manage_tabs(open) 开后台标签，用返回的 tab_id 调 read_tab。任务结束会自动关掉你开过的页。\n经验记忆只读：已按当前页与任务检索注入（如有）。不要调用 save_memory；值得记的经验写进给父代理的报告即可。${memNote}`,
    });
  }
  messages.push({ role: 'user', content: String(prompt || '') });

  const childCtx = Object.create(ctx);
  childCtx.subagentDepth = (ctx.subagentDepth || 0) + 1;
  childCtx.subagentKind = agent.name;
  childCtx.subagentAllowedTools = allowedToolNames(agent, CHAT_TOOLS);
  childCtx.subagentAllowedTools.add('submit_report');
  childCtx.subagentAllowedTools.add('section_job');
  childCtx.subagentOpenedTabs = new Set();
  childCtx.subagentOwner = session.id;
  // 必须定义成 childCtx 的自有属性：三个宿主都把 chatHistory/chatHistorySummary
  // 做成 accessor（panel.js → 模块级变量、service-worker.js → portState），
  // Object.create 出来的 childCtx 普通赋值会命中原型上的 setter，把父代理的
  // 历史变量整个换成子代理的消息数组（2026-09-10 落盘取证：父 history[0] 是
  // 子代理 system prompt）。defineProperty 绕开访问器，只写子代理自己的槽。
  Object.defineProperty(childCtx, 'chatHistory', {
    value: messages, writable: true, configurable: true, enumerable: true,
  });
  Object.defineProperty(childCtx, 'chatHistorySummary', {
    value: '', writable: true, configurable: true, enumerable: true,
  });
  Object.defineProperty(childCtx, 'submittedReport', {
    value: null, writable: true, configurable: true, enumerable: true,
  });

  if (agent.name === 'browser') {
    try {
      const snap = await executeToolCall('browser_act', { op: 'observe' }, childCtx);
      const shot = childCtx._viewportShot;
      childCtx._viewportShot = null;
      messages.push({ role: 'user', content: `[PAGE-SNAPSHOT]\n${snap}` });
      if (shot) appendViewportShots(messages, messages, [shot]);
    } catch (_) {}
  }

  let lastText = '';
  let lastEmit = 0;
  let missingSubmitAttempts = 0;
  const budget = {
    tokens: Number(limits.budgetTokens) || 0,
    ms: (Number(limits.budgetMinutes) || 0) * 60000,
  };
  const startedAt = Date.now();
  let usedTokens = 0;
  let warned = false;
  let forced = false;
  let forcedRounds = 0;
  const submitOnly = [SUBMIT_REPORT_TOOL];
  try {
    // 不设轮次上限；按 token / 耗时预算收口。耗尽时只留 submit_report，强制交回已有工作。
    for (;;) {
    if (signal && signal.aborted) break;
    const state = budgetState(budget, usedTokens, startedAt);
    if (!forced && state.ratio >= 1) {
      forced = true;
      session.card.budgetExhausted = state.by;
      childCtx.subagentAllowedTools = new Set(['submit_report']);
      childCtx.subagentBudgetForced = true;
      messages.push({
        role: 'user',
        content: `[RUNTIME] ${state.by === 'token' ? 'token' : '耗时'}预算已用完，不能再调用其它工具。现在立即调用 submit_report：已核实的写进 claims，能回答的问题写进 findings，没查完的方向和原因写进 unresolved。`,
      });
    } else if (!warned && !forced && state.ratio >= SUBAGENT_BUDGET_WARN_RATIO) {
      warned = true;
      messages.push({
        role: 'user',
        content: '[RUNTIME] 预算已用掉大部分。停止扩大检索范围，补齐最关键的缺口后尽快调用 submit_report。',
      });
    }
    if (forced && forcedRounds >= SUBAGENT_FORCED_SUBMIT_ROUNDS) break;
    if (forced) forcedRounds += 1;
    let roundStarted = false;
    const result = await streamChatWithTools(messages, forced ? submitOnly : tools, apiCfg, (chunk) => {
      if (!chunk) return;
      if (!roundStarted) {
        lastText = '';
        roundStarted = true;
      }
      lastText += chunk;
      session.card.report = lastText;
      session.card.status = 'running';
      const now = Date.now();
      if (now - lastEmit < 80) return;
      lastEmit = now;
      try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
    }, signal);
    emitUsage(ctx, result.usage);
    usedTokens += usageTotalTokens(result.usage);
    session.card.budget = { usedTokens, elapsedMs: Date.now() - startedAt, tokens: budget.tokens, ms: budget.ms };
    if (result.content) lastText = result.content;
    session.card.report = lastText;
    try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
    if (!result.toolCalls || result.toolCalls.length === 0) {
      if (childCtx.submittedReport) break;
      if (forced) {
        messages.push({ role: 'user', content: '[RUNTIME] 预算已用完，唯一可做的是调用 submit_report。' });
        continue;
      }
      if (missingSubmitAttempts >= 1) break;
      missingSubmitAttempts += 1;
      messages.push({
        role: 'user',
        content: '[RUNTIME] 你还没有调用 submit_report。现在必须用该工具提交结构化结果；不要再输出自然语言报告。',
      });
      continue;
    }
    await processRoundToolCalls({
      result,
      apiMessages: messages,
      historyMessages: messages,
      ctx: childCtx,
      signal,
      minAcceptDelayMs: 200,
      hooks: {
        start: (label, name) => {
          session.card.currentTool = name;
          session.card.currentLabel = label;
          session.card.status = 'running';
          try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
        },
        argError: () => {
          session.card.currentTool = '';
          session.card.currentLabel = '';
          try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
        },
        done: () => {
          session.card.currentTool = '';
          session.card.currentLabel = '';
          try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
        },
        fail: () => {
          session.card.currentTool = '';
          session.card.currentLabel = '';
          try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
        },
        writeRefresh: async (name) => {
          if (typeof ctx.onSubagentWriteRefresh === 'function') await ctx.onSubagentWriteRefresh(name);
          else ctx.onEntriesChanged?.();
        },
      },
    });
    if (childCtx.submittedReport) break;
    }
  } finally {
    await closeSubagentTabs(childCtx);
  }
  session.updatedAt = Date.now();
  return {
    text: lastText || '',
    report: childCtx.submittedReport,
    submitted: !!childCtx.submittedReport,
    budgetExhausted: forced ? (session.card.budgetExhausted || 'token') : '',
  };
}

/**
 * 执行 task 工具。由 chat-executor 经 registerTaskTool 调用。
 */
export async function runTaskTool(args, ctx = {}) {
  ensureRuntime(ctx);
  const depth = ctx.subagentDepth || 0;
  if (depth >= SUBAGENT_MAX_DEPTH) {
    return formatTaskResult({
      id: args.task_id || '',
      type: args.subagent_type,
      state: 'error',
      summary: '嵌套被拒',
      text: `已达到子代理深度上限（${SUBAGENT_MAX_DEPTH}）。把任务拆给当前这一层做完，或交回父代理另派。`,
    });
  }

  const type = String(args.subagent_type || '').trim().toLowerCase();
  if (!type) {
    return formatTaskResult({
      id: '', type: '', state: 'error', summary: '缺少类型',
      text: 'task 需要 subagent_type（explore / general / browser，或设置里的自定义名）。',
    });
  }

  const agents = await listAgents();
  const agent = agents.find((a) => a.name === type);
  if (!agent) {
    return formatTaskResult({
      id: '', type, state: 'error', summary: '未知类型',
      text: `未知子代理类型「${type}」。可用：${agents.map((a) => a.name).join(', ')}。`,
    });
  }

  const prompt = String(args.prompt || '').trim();
  let effectivePrompt = prompt;
  const description = String(args.description || '').trim() || type;
  if (!args.task_id && !prompt) {
    return formatTaskResult({
      id: '', type, state: 'error', summary: '缺少 prompt',
      text: '新建任务必须提供 prompt：写清目标、约束、以及最终要交回父代理的信息。',
    });
  }

  let session;
  if (args.task_id) {
    session = ctx.subagentSessions.get(String(args.task_id));
    if (!session) {
      return formatTaskResult({
        id: String(args.task_id), type, state: 'error', summary: '无法续传',
        text: `找不到 task_id=${args.task_id}。只能续传本会话里已经派过的子代理。`,
      });
    }
    if (ctx.runningSubagents.has(session.id)) {
      return formatTaskResult({
        id: session.id, type: session.type, state: 'running', summary: '仍在运行',
        text: '该子代理仍在运行。不要轮询；前台任务请等它返回，后台任务完成会自动回注。',
      });
    }
    if (args.revision === true) {
      if (!session.verification?.contentFailure) {
        return formatTaskResult({
          id: session.id,
          type: session.type,
          state: 'error',
          summary: '无需内容修正',
          text: session.verification?.infrastructureFailure
            ? '上次失败属于读取/API 基础设施错误，不消耗内容修正次数；请稍后普通续传。'
            : '上次 Check 没有内容失败项。',
          verification: verificationForMain(session.verification),
        });
      }
      if ((Number(session.revisionCount) || 0) >= 1) {
        return formatTaskResult({
          id: session.id,
          type: session.type,
          state: 'error',
          summary: '修正次数已用完',
          text: '同一任务最多进行一次内容修正。请由 Main 保留失败项并作最终裁决。',
          verification: verificationForMain(session.verification),
        });
      }
      session.revisionCount = (Number(session.revisionCount) || 0) + 1;
      effectivePrompt = revisionRequestFor(session.verification);
    }
    if (prompt) session.messages = session.messages || [];
    session.description = description || session.description;
    const prevPrompt = String((session.card && session.card.prompt) || '');
    session.card = {
      ...(session.card || {}),
      id: session.id,
      type: session.type,
      description: session.description,
      status: 'running',
      steps: [],
      background: false,
      prompt: prompt ? (prevPrompt ? `${prevPrompt}\n\n[续传] ${prompt}` : prompt) : prevPrompt,
    };
  } else {
    const id = newTaskId();
    session = {
      id,
      type,
      description,
      messages: [],
      updatedAt: Date.now(),
      card: {
        id, type, description, status: 'running', steps: [], background: false, prompt,
      },
    };
    ctx.subagentSessions.set(id, session);
  }

  const apiCfg = await resolveSubagentApiConfig(ctx, agent);
  if (!apiCfg || !apiCfg.apiKey) {
    session.card.status = 'error';
    try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
    return formatTaskResult({
      id: session.id, type, state: 'error', summary: '无 API',
      text: '未配置 API Key，子代理无法启动。',
    });
  }

  const tools = [...filterToolsForAgent(agent, CHAT_TOOLS), SECTION_JOB_TOOL, SUBMIT_REPORT_TOOL];
  const background = args.background === true && ctx.allowBackground === true;
  session.card.background = background;
  try { ctx.onSubagentEvent?.(session.card); } catch (_) {}

  const run = async (signal) => {
    ctx.runningSubagents.add(session.id);
    const startedAt = Date.now();
    const logSub = (action, status, label, detail) => logActivity({
      projectId: ctx.projectId || 'default',
      actor: 'sub',
      actorId: session.id,
      actorName: session.type,
      cat: 'agent',
      action,
      label,
      detail: detail || description,
      status,
      durationMs: action === 'subagent.end' ? Date.now() - startedAt : 0,
    });
    logSub('subagent.start', 'ok', background ? '子代理启动（后台）' : '子代理启动');
    // 续传的子代理挂在它上一次运行下面（“加深”分支）；首次派出则挂在当前回合下。
    const tracePid = ctx.projectId || 'default';
    const traceThread = (typeof ctx.getTraceThreadId === 'function' && ctx.getTraceThreadId()) || CHAT_THREAD;
    const { node: traceNode } = putTrace({
      projectId: tracePid,
      parentId: session.traceNodeId || (typeof ctx.getTraceTurnId === 'function' ? ctx.getTraceTurnId() : ''),
      threadId: traceThread,
      kind: 'subagent',
      subtype: session.type,
      title: description,
      text: args.task_id ? (args.revision === true ? '内容修正' : '续传') : '',
      status: 'running',
      refs: { taskId: session.id },
    });
    if (traceNode) session.traceNodeId = traceNode.id;
    const traceEnd = (status, text, report, verification) => {
      if (!traceNode) return;
      putTrace({ ...traceNode, endedAt: Date.now(), status, text: text || traceNode.text });
      for (const n of subagentReportNodes({
        projectId: tracePid, parentId: traceNode.id, threadId: traceThread, report, verification,
      })) putTrace(n);
    };
    try {
      const limits = await getSubagentLimits().catch(() => ({}));
      const result = await runSubagentLoop(session, effectivePrompt || '请继续上次未完成的任务并调用 submit_report。', ctx, signal, agent, apiCfg, tools, limits);
      const aborted = signal && signal.aborted;
      const incomplete = !aborted && !result.submitted;
      const state = aborted ? 'error' : (incomplete ? 'incomplete' : 'completed');
      session.report = result.report || null;
      const passageOnly = !!(result.report && (result.report.passages || []).length && !(result.report.claims || []).length);
      session.verification = result.submitted && !passageOnly
        ? await runCheckPipeline(result.report, {
          projectId: ctx.projectId || 'default',
          apiConfig: apiCfg,
          judgeApiConfig: await resolveJudgeApiConfig(ctx, limits),
          signal,
          ctx,
        })
        : null;
      const budgetNote = result.budgetExhausted
        ? `${result.budgetExhausted === 'time' ? '耗时' : 'token'}预算用完后被强制交回，覆盖可能不全，见 unresolved。`
        : '';
      session.card.status = state;
      session.card.error = aborted ? '已中断' : (incomplete
        ? (result.budgetExhausted ? '预算用完且未能提交报告，任务未完成' : '未调用 submit_report，任务未完成')
        : '');
      session.card.budgetNote = budgetNote;
      session.card.currentTool = '';
      session.card.currentLabel = '';
      session.card.report = result.report?.summary || result.text || '';
      session.card.structuredReport = result.report || null;
      session.card.verification = session.verification;
      try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
      traceEnd(state, result.report?.summary || result.text || session.card.error, result.report, session.verification);
      logSub(
        'subagent.end',
        state === 'completed' ? 'ok' : 'error',
        state === 'completed' ? '子代理完成' : (aborted ? '子代理中断' : '子代理未提交'),
        result.report?.summary ? `${description} — ${result.report.summary}` : description,
      );
      return formatTaskResult({
        id: session.id,
        type: session.type,
        state,
        summary: aborted ? `已中断: ${description}` : (incomplete ? `未完成: ${description}` : description),
        text: aborted ? '子代理已中断。' : (incomplete ? session.card.error : budgetNote),
        report: result.report,
        verification: verificationForMain(session.verification),
      });
    } catch (err) {
      session.card.status = 'error';
      session.card.error = (err && err.message) || String(err);
      session.card.currentTool = '';
      session.card.currentLabel = '';
      try { ctx.onSubagentEvent?.(session.card); } catch (_) {}
      traceEnd('error', session.card.error);
      logSub('subagent.end', 'error', '子代理失败', `${description} — ${session.card.error}`);
      return formatTaskResult({
        id: session.id,
        type: session.type,
        state: 'error',
        summary: `失败: ${description}`,
        text: `Subagent failed (task_id: ${session.id}): ${session.card.error}`,
      });
    } finally {
      ctx.runningSubagents.delete(session.id);
    }
  };

  if (background) {
    const bgAbort = new AbortController();
    const parentSignal = ctx.subagentParentSignal;
    const onParentAbort = () => bgAbort.abort();
    if (parentSignal) {
      if (parentSignal.aborted) bgAbort.abort();
      else parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
    ctx.registerBackgroundAbort?.(bgAbort);
    const started = formatTaskResult({
      id: session.id,
      type: session.type,
      state: 'running',
      summary: `后台任务已启动: ${description}`,
      text: [
        '子代理正在后台运行。完成或失败后会自动回注，不要 sleep/轮询/重复派同一任务。',
        `task_id: ${session.id}（完成后如需加深可带 task_id 续传）。`,
        '请继续做不重叠的工作，或向用户简短说明已派出后台任务。',
      ].join('\n'),
    });
    Promise.resolve()
      .then(() => run(bgAbort.signal))
      .then((text) => {
        if (bgAbort.signal.aborted) return;
        let state = 'error';
        try { state = JSON.parse(text).state || state; } catch (_) {}
        try { ctx.onSubagentBackgroundDone?.({ id: session.id, description, text, ok: state === 'completed', runtimeMeta: session.verification || null }); } catch (_) {}
      })
      .catch((err) => {
        if (bgAbort.signal.aborted) return;
        const text = formatTaskResult({
          id: session.id, type: session.type, state: 'error',
          summary: `失败: ${description}`,
          text: (err && err.message) || String(err),
        });
        try { ctx.onSubagentBackgroundDone?.({ id: session.id, description, text, ok: false }); } catch (_) {}
      })
      .finally(() => {
        ctx.unregisterBackgroundAbort?.(bgAbort);
        if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
      });
    return started;
  }

  return run(ctx.subagentParentSignal || undefined);
}

registerTaskTool(runTaskTool);
registerSectionJobTool(runSectionJob);
