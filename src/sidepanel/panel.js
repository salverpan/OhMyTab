import { getEntries, updateEntry, reorderEntries, saveEntry, saveEntries, saveEntryList, getBlacklist, setBlacklist, getProjectConfig, setProjectConfig, getAiChannels, saveAiChannels, getActiveChannelId, setActiveChannelId, ensureDefaultChannel, normalizeChannelModels, resolveChannelModel, setActiveChannelModel, setActiveModelTuning, getCustomSubagents, saveCustomSubagents, getSubagentLimits, setSubagentLimits } from '../lib/storage.js';
import {
  ensureDefaultSearchChannels, getSearchChannels, saveSearchChannels,
  getActiveSearchChannelId, setActiveSearchChannelId, executeSearchChannel,
} from '../lib/search-channels.js';
import { SEARCH_PRESETS, searchPreset, normalizeSearchChannel } from '../lib/search-providers.js';
import { entriesToMarkdownDocxBlob, markdownToDocxBlob } from '../lib/md-to-docx.js';
import { testApiConnection, streamChatWithTools } from '../lib/ai-client.js';
import { createExportApi } from './panel-export.js';
import { PROVIDER_PRESETS } from '../lib/providers/presets.js';
import { inferModelCaps, formatContextLabel, contextPresets, EFFORT_LEVELS, probeModelMeta, refreshModelCatalog, catalogSourceLabel, defaultWorkingContext, resolveEffortId } from '../lib/model-limits.js';
import { peekEffortProbe, clearEffortProbe } from '../lib/effort-probe.js';
import { AGENT_MAX_ROUNDS, AGENT_WRAP_HINT_ROUND } from '../lib/limits.js';
import { isImageUnsupportedError } from '../lib/vision-client.js';
import {
  listHeartbeatTasks, upsertHeartbeatTask, deleteHeartbeatTask, heartbeatPresets,
  formatCadence, heartbeatUserText, queuedHeartbeatTasks, dueHeartbeatTasks,
  markHeartbeatRunning, markHeartbeatFinished, queuedOrDueCount, ensureHeartbeatAlarm,
  parseEvery, normalizeSchedule, WEEKDAY_LABEL, taskBelongsToProject,
} from '../lib/heartbeat.js';
import { buildChatTools } from '../lib/tools.js';
import { initFeedView, startManualIndexRebuild } from './feed-view.js';
import { mountPeekCat, setPeekCatThinking, peekCatEnter } from './pixel-cat.js';
import { getStaticSystemPrompt, buildDynamicPreamble } from './chat-prompt.js';
import { compactHistory, estimateMessagesTokens, estimateTokens } from './history-compact.js';
import { rollNumber } from '../lib/rolling-number.js';
import { buildPageData, formatReaderSessionNote, getBrowsingTab, isAppPanelPage } from '../lib/page-data.js';
import { getAnnotationsForUrl, saveAnnotation, deleteAnnotation } from '../lib/annotations.js';
import { saveDocFile, getDocFile, deleteDocFile } from '../lib/doc-store.js';
import { purgeProject, restoreProject, purgeProjects, restoreProjects } from '../lib/project-purge.js';
import { extractDocTextFromBuffer, normalizeSpreadsheetUpload } from '../lib/doc-import.js';
import { isUploadDocName } from '../lib/doc-kind.js';
import { pickLocalFiles } from '../lib/pick-files.js';
import { listNotes, clearNotes, revalidateNotes } from '../lib/notebook.js';
import { logActivity } from '../lib/activity-log.js';
import { putTrace, newTraceId, CHAT_THREAD } from '../lib/trace-log.js';
import { getPlan, clearPlan, planCardHtml, upsertPlanCardEl } from '../lib/plan.js';
import { listInsights } from '../lib/insight.js';
import { docEditsListHtml, upsertDocEditsCardEl, mergeEditsIntoList } from '../lib/doc-edits.js';
import { deleteArtifactsByProject, deleteArtifactsMatching } from '../lib/artifact-store.js';
import { inferEntryType } from '../lib/source-model.js';
import { deleteEntryCascade, restoreEntryCascade } from '../lib/entry-cascade.js';
import { createWorkspaceView } from './workspace-view.js';
import { ensureWorkspaceMigration } from '../lib/workspace-migration.js';
import { aoaToXlsxBuffer, rowsFromCreateDocumentArgs } from '../lib/create-xlsx.js';
// 共享工具执行器（侧栏与浮动聊天 AI 的唯一实现，功能平价）：
// 36 个 chat tools（含 refresh_feeds / plot_chart / call_api）；全部辅助函数已迁入 chat-executor.js，此处只保留宿主 ctx。
import { processRoundToolCalls, buildEntriesDigest, retrieveMemories, calcRelevance, contextCompactBudget, isContextOverflowError, HISTORY_KEEP_TAIL_TOKENS } from '../lib/chat-executor.js';
import { listAgents, parseAgentMentions, formatAgentCatalog, serializeSubagentSessions, restoreSubagentSessions, validateCustomAgent, BUILTIN_AGENTS } from '../lib/subagent.js';
import { subagentListHtml, upsertSubagentCardEl, syncLiveTurnOrder } from '../lib/subagent-ui.js';
import { syncInlineMedia, timelineParts } from '../lib/inline-media.js';
import { attachScopeQuiz } from '../lib/scope-quiz.js';
import { chartHostHtml, mountChatCharts, disposeChatCharts, appendChartInMessage, rasterizeChartOption } from '../lib/chat-charts.js';
import { loadConnectors, saveConnectors, formatApiCatalog, API_PRESETS, executeApiCall } from '../lib/api-call.js';
import { usageTotalTokens } from '../lib/usage.js';
import { THEME_KEY, applyDocumentTheme, loadThemeMode, normalizeThemeMode, saveThemeMode, watchSystemTheme } from '../lib/theme.js';
import gsap from 'gsap';
// AI 思考指示器：thinking-orbs（canvas 点阵球，9 状态 / 20px 行内 / 自动深浅色）
// 工具 → 动画状态映射抽到 lib/orb-state.js（侧栏 / 浮动 / 阅读器三处共用，保证一致）
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingOrb } from 'thinking-orbs';
import { ORB_STATE_BY_TOOL } from '../lib/orb-state.js';

let orbRoot = null; // ThinkingOrb 的 React root（AI 等待首个 chunk 期间显示）
let toolOrbEl = null; // 工具执行期间的临时 orb（AI 已输出文字、主 orb 卸载后补挂）
let toolOrbRoot = null;
let thinkingTextEl = null; // 当前 AI 气泡中 orb 右侧的 shimmer 文字（全程常驻）
let streamBodyEl = null;   // 当前 AI 气泡的流式正文容器（与 orb 行分离，orb 全程不卸载）

function mountThinkingOrb(el) {
  unmountThinkingOrb();
  orbRoot = createRoot(el);
  orbRoot.render(createElement(ThinkingOrb, {
    state: 'working',
    size: 20,
    theme: 'auto',
    'aria-label': 'AI 思考中',
  }));
}

/* 工具执行期间切换动画状态（同一 React root 直接 re-render，canvas 复用） */
function setOrbState(state) {
  if (!orbRoot) return;
  orbRoot.render(createElement(ThinkingOrb, {
    state,
    size: 20,
    theme: 'auto',
    'aria-label': 'AI 思考中',
  }));
}

/* orb 右侧的 shimmer 文字（Thinking / 工具状态 label / 工具错误），全程跟随 orb */
function setThinkingText(text, isError) {
  if (!thinkingTextEl) return;
  thinkingTextEl.textContent = text;
  thinkingTextEl.classList.toggle('error', !!isError);
}

function unmountThinkingOrb() {
  if (orbRoot) {
    try { orbRoot.unmount(); } catch (err) { console.warn('[SuperCat] orb unmount failed:', err); }
    orbRoot = null;
  }
}

/* 工具执行期间的临时 orb：挂在气泡内（独立容器），工具完成即卸载 */
function mountToolOrb(bubbleEl, state) {
  unmountToolOrb();
  toolOrbEl = document.createElement('span');
  toolOrbEl.className = 'chat-thinking-orb tool-orb';
  // 插入到 Thinking 行（.chat-ai-row）之前，使其位于正文区末尾、Thinking 行上方
  const aiRow = bubbleEl.querySelector('.chat-ai-row');
  if (aiRow) bubbleEl.insertBefore(toolOrbEl, aiRow);
  else bubbleEl.appendChild(toolOrbEl);
  toolOrbRoot = createRoot(toolOrbEl);
  toolOrbRoot.render(createElement(ThinkingOrb, {
    state,
    size: 20,
    theme: 'auto',
    'aria-label': 'AI 思考中',
  }));
}

function unmountToolOrb() {
  if (toolOrbRoot) {
    try { toolOrbRoot.unmount(); } catch (err) { console.warn('[SuperCat] tool orb unmount failed:', err); }
    toolOrbRoot = null;
  }
  if (toolOrbEl) {
    toolOrbEl.remove();
    toolOrbEl = null;
  }
}

/* 主 orb 在（AI 纯调工具）→ 切换状态；主 orb 已卸载（AI 先输出文字）→ 气泡内补挂工具 orb */
function syncToolOrb(bubbleEl, toolName) {
  const state = ORB_STATE_BY_TOOL[toolName] || 'working';
  if (orbRoot) setOrbState(state);
  else mountToolOrb(bubbleEl, state);
}

let entries = [];
let selectedIds = new Set();
let chatMessages = [];
let chatCost = null;
let chatUsage = null;
let lastTokenCount = 0; // Token 计数徽章当前显示值（苹果式滚动动画的 from）
let totalUsedTokens = 0; // 累计真实消耗：主 agent + 子代理 + 章节 Worker + Check + 压缩摘要的 API usage 求和
let pendingUserText = ''; // 本轮已发送但尚未入账的用户文本（流式期间作估算预览）
let liveTurnText = '';    // 本轮正在流式生成的 AI 文本（流式期间作估算预览）
let lastLiveMeterAt = 0;  // 流式期间 Token 计数刷新的节流时间戳
let chatWidth = 380;
let chatDragged = false; // once user drags, stop auto-adjusting width
let libCollapsed = true; // 默认只开对话；拉宽后出文库、再出预览
let wsNarrow = false; // 侧栏不够并排：只显示对话，按钮切换到工作区
let wsShowWorkspace = false; // 窄屏下当前是否显示工作区
let layoutStage = 0; // 0 对话 / 1 文库 / 2 预览
let previewCollapsed = true;
let libraryWidth = 0; // 文库树粘性宽度（px）；0 = 尚未快照
let sideResizeQuiet = 0;
let paneSplitDragging = false;
let workspaceApi = null;
let pendingDelete = null; // { entry, timeout } for undo
let undoToast = null;
let pendingSuggestions = null; // AI suggest_actions tool stores here
let pendingCharts = [];
let pendingImages = [];
let pendingScopeQuiz = null; // AI ask_research_scope tool stores here

/* 共享执行器的宿主上下文（accessor property：执行器读写的就是本文件的
   let 变量；ui 回调处理 panel 私有 UI 状态；bridge 走默认消息通道发 SW）。 */
const toolCtx = {
  get entries() { return entries; },
  set entries(v) { entries = v; },
  get projectId() { return currentProject; },
  get previewId() { return previewId; },
  set previewId(v) { previewId = v; },
  get pendingCollect() { return pendingCollect; },
  set pendingCollect(v) { pendingCollect = v; },
  get selectedIds() { return selectedIds; },
  set selectedIds(v) { selectedIds = v; },
  get toolUndos() { return toolUndos; },
  set toolUndos(v) { toolUndos = v; },
  get chatHistory() { return chatHistory; },
  set chatHistory(v) { chatHistory = v; },
  get chatHistorySummary() { return chatHistorySummary; },
  set chatHistorySummary(v) { chatHistorySummary = v; },
  get pendingSuggestions() { return pendingSuggestions; },
  set pendingSuggestions(v) { pendingSuggestions = v; },
  get pendingScopeQuiz() { return pendingScopeQuiz; },
  set pendingScopeQuiz(v) { pendingScopeQuiz = v; },
  get pendingCharts() { return pendingCharts; },
  set pendingCharts(v) { pendingCharts = Array.isArray(v) ? v : []; },
  get pendingImages() { return pendingImages; },
  set pendingImages(v) { pendingImages = Array.isArray(v) ? v : []; },
  onImage: (image) => {
    const last = chatMessages[chatMessages.length - 1];
    if (!last || last.role !== 'ai') return;
    stampImageOnMessage(last, image);
    if (!activeAiBubbleEl || !activeAiBubbleEl.isConnected) return;
    const stream = layoutBubbleImages(activeAiBubbleEl, last.text || '', last.images || []);
    if (stream) streamBodyEl = stream;
    syncLiveTurnOrder(activeAiBubbleEl, 'chat');
    if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  },
  onChart: (chart) => {
    const last = chatMessages[chatMessages.length - 1];
    if (last && last.role === 'ai') {
      last.charts = [...(last.charts || []).filter((c) => c.id !== chart.id), chart];
    }
    if (!activeAiBubbleEl) return;
    appendChartInMessage(activeAiBubbleEl, chart, '.chat-ai-row');
    syncLiveTurnOrder(activeAiBubbleEl, 'chat');
    if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  },
  onPlan: (plan) => applyPlanUpdate(plan, null),
  onDocEdit: (card) => applyDocEdit(card, null),
  // 图表导出到 docx 的光栅化能力（G2 要真 DOM，只有侧栏/阅读器这类宿主能提供）
  rasterizeChart: (option, opts) => rasterizeChartOption(option, opts),
  get axSnapshotMap() { return axSnapshotMap; },
  set axSnapshotMap(_v) {},
  showToast,
  onEntriesChanged: () => { render(); renderProjects(); if (workspaceApi) workspaceApi.refresh(); },
  ui: {
    // clear_context 的 panel 私有状态重置（chatHistory/pendingCollect 等共享
    // 状态由执行器自己清）
    clearContextState: () => {
      chatMessages = [];
      chatCost = null;
      chatUsage = null;
      chatDragged = false;
      lastEntrySnapshot = '';
      lastSelectionSnapshot = '';
      lastProjectSnapshot = '';
      contextDeltaInitialized = false;
      pendingSuggestions = null;
      pendingScopeQuiz = null;
      pendingCharts = [];
      pendingImages = [];
      pendingAttachments = [];
      liveSubagentCards.clear();
      toolCtx.subagentSessions = new Map();
      pendingSubagentFollowups = [];
      clearPlan(currentProject).catch(() => {});
      totalUsedTokens = 0;
      lastTokenCount = 0;
      pendingUserText = '';
      liveTurnText = '';
      updateTokenMeter();
      renderAttachChips();
      if (chatMessagesEl) {
        disposeChatCharts(chatMessagesEl);
        chatMessagesEl.innerHTML = '';
      }
    },
    clearMessages: () => {},
    onHeartbeatChanged: (opts) => {
      renderHeartbeatList();
      refreshHeartbeatBadge();
      if (opts && opts.open) setHeartbeatDrawerOpen(true);
    },
  },
  closeOwnedAiTabs: async (owner, extraIds) => {
    const ids = [...new Set((extraIds || []).map(Number).filter((n) => n > 0))];
    if (ids.length) {
      await Promise.all(ids.map((id) => chrome.tabs.remove(id).catch(() => {})));
    }
    try {
      await chrome.runtime.sendMessage({
        type: 'CLOSE_AI_TABS',
        data: { owner: owner || 'chat', tabIds: ids },
      });
    } catch (_) {}
  },
};

/* ---- 子代理运行时（侧栏宿主）---- */
toolCtx.subagentSessions = new Map();
toolCtx.runningSubagents = new Set();
toolCtx.allowBackground = true;
toolCtx.apiConfig = null;
toolCtx.currentTabInfo = '';
toolCtx.subagentParentSignal = null;
let liveSubagentCards = new Map();
let backgroundAborts = new Set();
let pendingSubagentFollowups = [];
let activeAiBubbleEl = null;
let turnSpawnedSubagents = new Set();
let agentListCache = { at: 0, list: [] };

async function getAgentListCached() {
  if (Date.now() - agentListCache.at < 4000 && agentListCache.list.length) return agentListCache.list;
  agentListCache = { at: Date.now(), list: await listAgents() };
  return agentListCache.list;
}

function invalidateAgentListCache() {
  agentListCache = { at: 0, list: [] };
}

function findMessageWithSubagent(id) {
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i];
    if (m && m.role === 'ai' && Array.isArray(m.subagents) && m.subagents.some((s) => s.id === id)) return m;
  }
  return null;
}

function snapshotTurnSubagents(run) {
  const spawned = run ? run.turnSpawned : turnSpawnedSubagents;
  const cards = run ? run.liveCards : liveSubagentCards;
  return [...spawned].map((id) => cards.get(id)).filter(Boolean);
}

function stampPendingChartsOn(msg, run) {
  const charts = run ? run.pendingCharts : pendingCharts;
  if (!msg || msg.role !== 'ai' || !charts || !charts.length) return;
  const have = new Set((msg.charts || []).map((c) => c.id));
  msg.charts = [...(msg.charts || []), ...charts.filter((c) => !have.has(c.id))];
  if (run) {
    run.pendingCharts = [];
    if (viewing(run)) pendingCharts = [];
  } else {
    pendingCharts = [];
  }
}

function stampPendingImagesOn(msg, run) {
  const images = run ? run.pendingImages : pendingImages;
  if (!msg || msg.role !== 'ai' || !images || !images.length) return;
  const have = new Set((msg.images || []).map((x) => x.id));
  msg.images = [...(msg.images || []), ...images.filter((x) => !have.has(x.id))];
  if (run) {
    run.pendingImages = [];
    if (viewing(run)) pendingImages = [];
  } else {
    pendingImages = [];
  }
}

function stampImageOnMessage(msg, image) {
  if (!msg || msg.role !== 'ai' || !image) return image;
  const at = Number.isFinite(image.at) ? image.at : (msg.text || '').length;
  const next = { ...image, at };
  msg.images = [...(msg.images || []).filter((x) => x.id !== next.id), next];
  return next;
}

function layoutBubbleImages(bubbleEl, text, images) {
  if (!bubbleEl) return null;
  return syncInlineMedia(bubbleEl, text || '', images || [], {
    streamClass: 'chat-stream-body',
    streamTag: 'div',
    pinSelector: ':scope > .chat-ai-row',
    renderSlice: (el, slice) => { el.innerHTML = slice ? renderChatText(slice) : ''; },
  });
}

function chatTextWithImagesHtml(msg) {
  return timelineParts((msg && msg.text) || '', msg && msg.images).map((part) => {
    if (part.kind === 'text') return part.text ? renderChatText(part.text) : '';
    const x = part.image;
    return `<img class="chat-placed-image" data-placed-id="${escAttr(x.id)}" src="${escAttr(x.dataUrl)}" alt="${escAttr(x.alt || '')}">`;
  }).join('');
}

/* ---- 任务清单卡（单实例：数据上只留最新一条 AI 消息的 plan 字段，DOM 上只留一张卡）---- */
function applyPlanUpdate(plan, run) {
  const msgs = run ? run.messages : chatMessages;
  const empty = !plan || !Array.isArray(plan.items) || !plan.items.length;
  for (const m of msgs) {
    if (m && m.plan) delete m.plan;
  }
  if (!empty) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'ai') last.plan = plan;
  }
  if (run && !viewing(run)) return;
  if (!chatMessagesEl) return;
  chatMessagesEl.querySelectorAll('.chat-plan[data-plan-card]').forEach((el) => el.remove());
  if (empty) return;
  const bubble = (run && run.activeAiBubbleEl) || activeAiBubbleEl;
  const host = (bubble && bubble.isConnected)
    ? bubble
    : chatMessagesEl.querySelector('.chat-msg.ai:last-of-type');
  if (!host) return;
  upsertPlanCardEl(host, plan, 'chat');
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

/* ---- 文档修改卡（对照 Cursor 的 diff 视图；同一文档一张卡，多次编辑就地累加）---- */
function applyDocEdit(card, run) {
  if (!card || !card.edits || !card.edits.length) return;
  const msgs = run ? run.messages : chatMessages;
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'ai') last.docEdits = mergeEditsIntoList(last.docEdits, card);
  if (run && !viewing(run)) return;
  if (!chatMessagesEl) return;
  const bubble = (run && run.activeAiBubbleEl) || activeAiBubbleEl;
  const host = (bubble && bubble.isConnected)
    ? bubble
    : chatMessagesEl.querySelector('.chat-msg.ai:last-of-type');
  if (!host) return;
  let stack = host.querySelector(':scope > .chat-diffs');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'chat-diffs';
    host.appendChild(stack);
  }
  upsertDocEditsCardEl(stack, card, 'chat');
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

/** 侧栏消息里没有清单时，从本项目存储补挂（浮动聊天建的清单切回侧栏也能看到）。 */
function reconcilePlanFromStorage(msgs, plan) {
  if (!plan || !plan.items || !plan.items.length || !Array.isArray(msgs)) return;
  const curAt = msgs.reduce((acc, m) => (m && m.plan && m.plan.updatedAt > acc ? m.plan.updatedAt : acc), 0);
  if (!(plan.updatedAt > curAt)) return;
  for (const m of msgs) {
    if (m && m.plan) delete m.plan;
  }
  const lastAi = [...msgs].reverse().find((m) => m && m.role === 'ai');
  if (lastAi) lastAi.plan = plan;
}

function stampTurnSubagentsOnLastMsg(run) {
  const msgs = run ? run.messages : chatMessages;
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'ai') last.subagents = snapshotTurnSubagents(run);
  if (run) run.activeAiBubbleEl = null;
  if (!run || viewing(run)) activeAiBubbleEl = null;
  return last;
}

/** 回合结束保留直播时间线，只拆 Thinking 行、补页脚。不要 innerHTML 整段重排（会把 subagent 卡片甩回顶部）。 */
function finalizeLiveAiBubble(bubbleEl, lastMsg, { fullText = '', interrupted = false } = {}) {
  unmountThinkingOrb();
  unmountToolOrb();
  thinkingTextEl = null;
  streamBodyEl = null;
  if (!bubbleEl) return;
  const think = bubbleEl.querySelector(':scope > .chat-ai-row');
  if (think) think.remove();
  stampPendingChartsOn(lastMsg);
  stampPendingImagesOn(lastMsg);
  layoutBubbleImages(bubbleEl, (lastMsg && lastMsg.text) || fullText || '', (lastMsg && lastMsg.images) || []);
  if (lastMsg && lastMsg.charts && lastMsg.charts.length) {
    const have = new Set([...bubbleEl.querySelectorAll('[data-chart-id]')].map((el) => el.getAttribute('data-chart-id')));
    for (const chart of lastMsg.charts) {
      if (chart && chart.id && !have.has(chart.id)) appendChartInMessage(bubbleEl, chart);
    }
  }
  if (interrupted && !bubbleEl.querySelector('.msg-interrupted')) {
    bubbleEl.insertAdjacentHTML('beforeend', '<div class="msg-interrupted">(已中断)</div>');
  }
  if (lastMsg?.suggestions?.actions?.length > 0 && !bubbleEl.querySelector('.suggestion-chips')) {
    bubbleEl.insertAdjacentHTML('beforeend', renderSuggestionChips(lastMsg.suggestions));
  }
  if (lastMsg?.scopeQuiz && !bubbleEl.querySelector('.scope-quiz-host')) {
    bubbleEl.insertAdjacentHTML('beforeend', '<div class="scope-quiz-host"></div>');
  }
  if (chatCost && !bubbleEl.querySelector('.msg-cost')) {
    bubbleEl.insertAdjacentHTML('beforeend', `<div class="msg-cost">${chatCost}</div>`);
  }
  bindSuggestionChips(bubbleEl);
  mountScopeQuizzes(bubbleEl);
  if (lastMsg && lastMsg.role === 'ai') {
    const wrap = bubbleEl.querySelector(':scope > .chat-subagents');
    const stream = bubbleEl.querySelector(':scope > .chat-stream-body');
    lastMsg.flow = (wrap && stream && [...bubbleEl.children].indexOf(stream) < [...bubbleEl.children].indexOf(wrap))
      ? 'text-first'
      : 'subagents-first';
  }
}

function applyLiveSubagentCard(card, run) {
  if (!card || !card.id) return;
  const cards = run ? run.liveCards : liveSubagentCards;
  const spawned = run ? run.turnSpawned : turnSpawnedSubagents;
  const msgs = run ? run.messages : chatMessages;
  cards.set(card.id, { ...card });
  spawned.add(card.id);
  let owner = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m && m.role === 'ai' && Array.isArray(m.subagents) && m.subagents.some((s) => s.id === card.id)) {
      owner = m;
      break;
    }
  }
  const last = msgs[msgs.length - 1];
  if (owner) {
    owner.subagents = owner.subagents.map((s) => (s.id === card.id ? { ...card } : s));
  } else if (last && last.role === 'ai') {
    last.subagents = [...(last.subagents || []).filter((s) => s.id !== card.id), { ...card }];
  }
  if (run && !viewing(run)) return;
  const bubble = (run && run.activeAiBubbleEl) || activeAiBubbleEl;
  const belongsToActive = !owner || owner === last;
  if (bubble && bubble.isConnected && belongsToActive) {
    upsertSubagentCardEl(bubble, card, 'chat');
    return;
  }
  const root = chatMessagesEl && chatMessagesEl.querySelector(`[data-subagent-id="${CSS.escape(card.id)}"]`)?.closest('.chat-msg.ai');
  if (root) upsertSubagentCardEl(root, card, 'chat');
}

function handleBackgroundSubagentDone(payload, run) {
  const notice = `【后台子任务完成】${payload && payload.description ? payload.description : ''}\ntask_id=${payload && payload.id ? payload.id : ''}\n\n${(payload && payload.text) || ''}`;
  const target = run || ensureRun(currentProject);
  if (target.inProgress) target.pendingFollowups.push(notice);
  else sendChatMessage(notice, { subagentFollowup: true, attachments: [], run: target });
  if (viewing(target)) pendingSubagentFollowups = target.pendingFollowups;
}

function drainIdleWork() {
  drainRun(ensureRun(currentProject));
}

toolCtx.onSubagentEvent = (card) => applyLiveSubagentCard(card);
// 心跳触发的那轮里，AI 用 manage_heartbeat(complete) 结束「自己」——宿主知道是哪个任务
toolCtx.getActiveHeartbeatTaskId = () => activeHeartbeatTaskId;
toolCtx.onSubagentBackgroundDone = (payload) => handleBackgroundSubagentDone(payload);
toolCtx.onSubagentWriteRefresh = async () => {
  entries = await getEntries(currentProject);
  render();
  renderProjects();
};
toolCtx.registerBackgroundAbort = (c) => { if (c) backgroundAborts.add(c); };
toolCtx.unregisterBackgroundAbort = (c) => { backgroundAborts.delete(c); };

const exportAllBtn = document.getElementById('exportAllBtn');
const exportSelectedBtn = document.getElementById('exportSelectedBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const cmdInput = document.getElementById('cmdInput');
const cmdSendBtn = document.getElementById('cmdSendBtn');
const chatCol = document.getElementById('chatCol');
const panelCollectEl = document.getElementById('panelCollect');
const chatMessagesEl = document.getElementById('chatMessages');
const cmdAttachBtn = document.getElementById('cmdAttachBtn');
const cmdAttachChips = document.getElementById('cmdAttachChips');
const cmdHeartbeatBtn = document.getElementById('cmdHeartbeatBtn');
const heartbeatDrawer = document.getElementById('heartbeatDrawer');
const heartbeatListEl = document.getElementById('heartbeatList');
let pendingAttachments = [];
let heartbeatEditingId = null;

// 工作区默认收起（先对话）；窄屏由宽度逻辑切换。restoreLibCollapsed 会校正持久化状态。

// Export 功能实现已拆至 panel-export.js：注入当前库状态（延迟取值）与格式化助手
const {
  exportOriginalEntries,
} =
  createExportApi({ getEntries: () => entries, getSelectedIds: () => selectedIds, getProjectId: () => currentProject, formatSourceTier });

function getProjectName() {
  const p = projects.find((x) => x.id === currentProject);
  return p?.name || currentProject || '默认';
}

async function initWorkspaceUi() {
  const root = document.getElementById('workspaceRoot');
  if (!root || workspaceApi) return;
  workspaceApi = createWorkspaceView({
    root,
    getProjectId: () => currentProject,
    getProjectName,
    getEntries: () => entries,
    getSelectedIds: () => selectedIds,
    setSelectedIds: (set) => { selectedIds = set; },
    onOpenDoc: (entry) => openDocPreview(entry),
    onConvertEntry: (entry) => convertPdfToEditable(entry),
    onDeleteEntry: async (entry) => {
      selectedIds.delete(entry.id);
      await deleteWithUndo(entry);
      entries = await getEntries(currentProject);
      render();
    },
    onRenameEntry: async (entry, title) => {
      await updateEntry(entry.id, { aiTitle: title }, currentProject);
      entries = await getEntries(currentProject);
      render();
    },
    onOpenUrl: (entry) => {
      if (entry?.url) window.open(entry.url, '_blank', 'noopener');
    },
    onExportOriginalEntries: (items) => exportOriginalEntries(items),
    onClearTrunk: (trunk) => clearWorkspaceTrunk(trunk),
    onDraftChat: (text) => draftChatMessage(text),
    showToast,
    onLibraryWidth: (w) => {
      paneSplitDragging = true;
      markSideResizing();
      libraryWidth = Math.max(MIN_WORKSPACE_W, Math.round(Number(w) || 0));
      panelCollectEl?.style.setProperty('--ws-tree-w', libraryWidth + 'px');
    },
    onPreviewSnapClose: () => {
      const panelW = (panelCollectEl && panelCollectEl.clientWidth) || 0;
      const leftover = leftoverAfterChat(panelW);
      markSideResizing();
      libraryWidth = Math.max(MIN_WORKSPACE_W, leftover);
      applyStage(1, { animate: false, persist: false, leftover, panelW });
      paneSplitDragging = false;
    },
    onPaneSplitEnd: () => {
      paneSplitDragging = false;
    },
  });
  await workspaceApi.init();
}

function syncWorkspaceToggleBtn() {
  const btn = document.getElementById('toggleLibBtn');
  if (!btn) return;
  let title = '展开工作区';
  if (wsNarrow) title = '切换到工作区';
  else if (!libCollapsed) title = '收起工作区';
  btn.title = title;
  btn.setAttribute('aria-label', title);
}

function applyNarrowMode(narrow) {
  const wasNarrow = wsNarrow;
  wsNarrow = !!narrow;
  if (!panelCollectEl) return;
  panelCollectEl.classList.toggle('ws-narrow', wsNarrow);
  const backBtn = document.getElementById('wsBackChatBtn');

  if (!wsNarrow) {
    panelCollectEl.classList.remove('ws-show-chat', 'ws-show-workspace');
    wsShowWorkspace = false;
    if (backBtn) backBtn.hidden = true;
    syncWorkspaceToggleBtn();
    return;
  }

  // 从并排缩到不够宽：只留对话，不把挤在一起的工作区硬留下。
  if (!wasNarrow) {
    wsShowWorkspace = false;
    setNarrowWorkspaceView(false);
    return;
  }
  panelCollectEl.classList.toggle('ws-show-workspace', wsShowWorkspace);
  panelCollectEl.classList.toggle('ws-show-chat', !wsShowWorkspace);
  if (backBtn) backBtn.hidden = !wsShowWorkspace;
  syncWorkspaceToggleBtn();
}

function setNarrowWorkspaceView(showWs) {
  wsShowWorkspace = !!showWs;
  if (!panelCollectEl || !wsNarrow) return;
  panelCollectEl.classList.toggle('ws-show-workspace', wsShowWorkspace);
  panelCollectEl.classList.toggle('ws-show-chat', !wsShowWorkspace);
  const backBtn = document.getElementById('wsBackChatBtn');
  if (backBtn) backBtn.hidden = !wsShowWorkspace;
  applyLibCollapsed(!wsShowWorkspace, false, false);
  if (!wsShowWorkspace && chatCol) {
    chatCol.style.width = collapsedChatWidth(panelCollectEl.clientWidth || window.innerWidth) + 'px';
  }
  syncWorkspaceToggleBtn();
}

document.getElementById('wsBackChatBtn')?.addEventListener('click', () => {
  setNarrowWorkspaceView(false);
});

document.getElementById('wsImportBtn')?.addEventListener('click', async () => {
  try {
    const files = await pickLocalFiles({ multiple: true });
    if (files.length) ingestFiles(files, { source: 'workspace' });
  } catch (err) {
    showToast('无法打开文件选择: ' + (err.message || err), true);
  }
});

exportAllBtn.addEventListener('click', (e) => {
  workspaceApi?.toggleExportMenu(e, 'all');
});
exportSelectedBtn.addEventListener('click', (e) => {
  workspaceApi?.toggleExportMenu(e, 'selected');
});
clearAllBtn.addEventListener('click', (e) => {
  if (workspaceApi) workspaceApi.toggleClearMenu(e);
});

let dragCounter = 0;

// 拖拽防泄漏：拖拽中断/被浏览器吞掉时 dragleave 可能不触发，dragCounter 卡住会让
// drop-overlay 蒙层永久残留（fixed 全屏 + z-index 200，盖住整个界面）。
// 方案：8 秒无拖拽活动即判定中断，强制复位隐藏。
const DRAG_STALE_MS = 8000;
let dragStaleTimer = 0;

function isFileDrag(e) {
  const types = e.dataTransfer && e.dataTransfer.types;
  if (!types) return false;
  if (typeof types.includes === 'function') return types.includes('Files');
  return Array.from(types).includes('Files');
}

function collectImportArmed() {
  return currentPanel === 0;
}

function resetFileDrop() {
  dragCounter = 0;
  clearTimeout(dragStaleTimer);
  hideDropOverlay();
}

function touchDragActivity() {
  clearTimeout(dragStaleTimer);
  dragStaleTimer = setTimeout(() => {
    if (document.querySelector('.drop-overlay')) resetFileDrop();
  }, DRAG_STALE_MS);
}

document.addEventListener('dragover', (e) => {
  if (!isFileDrag(e) || !collectImportArmed()) return;
  e.preventDefault();
  e.stopPropagation();
  touchDragActivity();
});

document.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e) || !collectImportArmed()) return;
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;
  touchDragActivity();
  if (dragCounter === 1) showDropOverlay();
});

document.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e) || !collectImportArmed()) return;
  e.preventDefault();
  e.stopPropagation();
  dragCounter = Math.max(0, dragCounter - 1);
  touchDragActivity();
  if (dragCounter === 0) hideDropOverlay();
});

document.addEventListener('drop', (e) => {
  const files = [...(e.dataTransfer?.files || [])];
  resetFileDrop();
  if (!files.length) return;
  e.preventDefault();
  if (!collectImportArmed()) return;
  e.stopPropagation();
  const inChat = !!(e.target && e.target.closest && e.target.closest('#chatCol'));
  ingestFiles(files, { source: inChat ? 'chat' : 'library' });
});

function showDropOverlay() {
  if (document.querySelector('.drop-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'drop-overlay';
  overlay.innerHTML = `
    <div class="drop-zone">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => {
    resetFileDrop();
  });
  touchDragActivity();
}

function hideDropOverlay() {
  const overlay = document.querySelector('.drop-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .12s ease-out';
    setTimeout(() => overlay.remove(), 120);
  }
}

function isImageFile(file) {
  return /^image\/(png|jpe?g|webp)$/i.test(file.type || '')
    || /\.(png|jpe?g|webp)$/i.test(file.name || '');
}

const FILE_SUPPORT_HINT = '可用：PDF / Word（doc、docx）/ Excel（xls、xlsx）/ CSV / Markdown / TXT / JSON，或 PNG / JPEG / WebP';

function rejectUnsupportedFile(file) {
  const name = (file && file.name) || '该文件';
  showToast(`不支持「${name}」。${FILE_SUPPORT_HINT}`, true);
}

async function compressImageFile(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  let w = bitmap.width;
  let h = bitmap.height;
  if (Math.max(w, h) > max) {
    const s = max / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  try { bitmap.close(); } catch (_) {}
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), previewUrl: canvas.toDataURL('image/jpeg', 0.72) };
}

async function ingestImageAsMaterial(file) {
  const id = crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const name = file.name || 'image.jpg';
  const lower = name.toLowerCase();
  const format = lower.endsWith('.png') ? 'png' : lower.endsWith('.webp') ? 'webp' : lower.endsWith('.gif') ? 'gif' : 'jpg';
  const ab = await file.arrayBuffer();
  const entry = {
    id,
    kind: 'image',
    format,
    fileName: name,
    fileSize: file.size || ab.byteLength,
    docId: id,
    fullText: name,
    aiTitle: name,
    originalTitle: name,
    aiSummary: '',
    source: 'upload',
    tags: [],
    createdAt: Date.now(),
    publishedAt: todayStr(),
    status: 'completed',
    errorMessage: '',
  };
  await saveDocFile(id, ab);
  await saveEntry(entry, currentProject);
  entries = await getEntries(currentProject);
  render();
}

function renderAttachChips() {
  if (!cmdAttachChips) return;
  if (!pendingAttachments.length) {
    cmdAttachChips.hidden = true;
    cmdAttachChips.innerHTML = '';
    return;
  }
  cmdAttachChips.hidden = false;
  cmdAttachChips.innerHTML = pendingAttachments.map((a) => {
    const thumb = a.kind === 'image' && a.previewUrl
      ? `<img src="${escAttr(a.previewUrl)}" alt="">`
      : `<span class="cmd-chip-file">${escHtml((a.format || 'FILE').toUpperCase().slice(0, 4))}</span>`;
    return `<div class="cmd-chip" data-id="${escAttr(a.id)}">${thumb}<span class="cmd-chip-name">${escHtml(a.name || '')}</span><button type="button" class="cmd-chip-x" data-id="${escAttr(a.id)}" aria-label="移除">✕</button></div>`;
  }).join('');
  cmdAttachChips.querySelectorAll('.cmd-chip-x').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingAttachments = pendingAttachments.filter((a) => a.id !== btn.dataset.id);
      renderAttachChips();
    });
  });
  updateSendButton();
}

async function ingestFiles(files, { source = 'chat' } = {}) {
  for (const file of files) {
    if (!file) continue;
    const name = (file.name || '').toLowerCase();
    if (isImageFile(file)) {
      if (source === 'library' || source === 'workspace') {
        try {
          await ingestImageAsMaterial(file);
        } catch (err) {
          showToast('图片入库失败: ' + (err.message || err), true);
        }
        continue;
      }
      try {
        const img = await compressImageFile(file);
        pendingAttachments.push({
          id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          kind: 'image',
          name: file.name || 'image.jpg',
          ...img,
        });
        renderAttachChips();
      } catch (err) {
        showToast('图片读取失败: ' + (err.message || err), true);
      }
      continue;
    }
    if (isUploadDocName(name)) {
      const doc = await uploadDocument(file);
      if (source !== 'library' && doc) {
        pendingAttachments.push({
          id: 'att_' + doc.id,
          kind: 'doc',
          name: doc.fileName || file.name,
          entryId: doc.id,
          format: doc.format,
        });
        renderAttachChips();
      }
      continue;
    }
    if (name.endsWith('.json') || file.type === 'application/json') {
      await handleImportFile(file);
      continue;
    }
    rejectUnsupportedFile(file);
  }
}

async function handleImportFile(file) {
  const name = (file.name || '').toLowerCase();
  // 按扩展名路由：JSON → 导入工作区；PDF/Word/Excel/CSV/Markdown/TXT → 来源入库（原件存 IDB）
  if (isUploadDocName(name)) {
    await uploadDocument(file);
    return;
  }
  if (!name.endsWith('.json') && file.type !== 'application/json') {
    rejectUnsupportedFile(file);
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.entries || !Array.isArray(data.entries)) {
      showToast('无效的导出文件', true);
      return;
    }
    const existing = await getEntries(currentProject);
    const existingIds = new Set(existing.map((e) => e.id));
    const toImport = data.entries.filter((e) => !existingIds.has(e.id));
    if (toImport.length > 0) {
      await saveEntries(toImport, currentProject);
    }
    entries = await getEntries(currentProject);
    render();
    const skipped = data.entries.length - toImport.length;
    if (skipped > 0) showToast(`跳过 ${skipped} 条已存在`);
  } catch (err) {
    showToast(`导入失败: ${err.message}`, true);
  }
}

const DOC_FORMAT_LABEL = { pdf: 'PDF', docx: 'DOCX', doc: 'DOC', xlsx: 'XLSX', csv: 'CSV', md: 'MD', txt: 'TXT' };

/**
 * 上传文档入库：提取全文 → 原件存 IndexedDB → 生成 document 条目。
 * 原件（IDB）供精确预览 / 编辑回写 / 下载；全文存条目供搜索与 AI 上下文。
 * 转换后作为新的可编辑产出加入工作区，原件保留。
 */
async function uploadDocument(file) {
  try {
    const raw = await file.arrayBuffer();
    const norm = await normalizeSpreadsheetUpload(file.name, raw);
    const { format, fullText, pageCount, pageOffsets } = await extractDocTextFromBuffer(norm.fileName, norm.arrayBuffer);
    if (!format) {
      showToast('不支持的文件类型: ' + file.name, true);
      return;
    }
    const id = crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    const summary = (fullText || '').replace(/\s+/g, ' ').trim();
    const doc = {
      id,
      kind: 'document',
      format,
      fileName: norm.fileName,
      fileSize: norm.arrayBuffer.byteLength,
      pageCount: pageCount || null,
      pageOffsets: Array.isArray(pageOffsets) && pageOffsets.length ? pageOffsets : null,
      docId: id, // IDB 原件 key（= 条目 id）
      fullText: fullText || '',
      aiTitle: file.name,
      originalTitle: file.name,
      aiSummary: summary.slice(0, 200),
      source: 'upload',
      tags: [],
      createdAt: Date.now(),
      publishedAt: todayStr(),
      status: 'completed',
      errorMessage: '',
    };
    // 先存原件再建条目：条目出现即保证可预览
    await saveDocFile(id, norm.arrayBuffer);
    await saveEntry(doc, currentProject);
    entries = await getEntries(currentProject);
    render();
    if (norm.converted) showToast(`${file.name} 已转为 ${norm.fileName}，可直接编辑`);
    else if (!fullText) showToast(file.name + ' 未提取到文本', true);
    return doc;
  } catch (err) {
    showToast('文档入库失败: ' + err.message, true);
    return null;
  }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* PDF 文本重排成 markdown：空行分段；段内断行拼接时两侧都是 CJK/全角
   则直接相连，否则补空格（中英混排）。PDF 文本没有 markdown 语义，
   转义结构字符让原文按字面进入 Word。 */
function pdfTextToMarkdown(raw) {
  const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
  const paras = [];
  let cur = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) { if (cur.length) { paras.push(cur); cur = []; } continue; }
    cur.push(t);
  }
  if (cur.length) paras.push(cur);
  return paras.map((lines) => {
    let s = lines[0];
    for (let i = 1; i < lines.length; i++) {
      s += (CJK.test(s[s.length - 1]) && CJK.test(lines[i][0]) ? '' : ' ') + lines[i];
    }
    return s.replace(/([\\`*_{}\[\]()#+.!|>~-])/g, '\\$1');
  }).join('\n\n');
}

/**
 * PDF / 旧版 .doc 卡片「转可编辑」：把提取的全文转成可编辑 docx 新条目（原件保留）。
 * 阅读器里这两类都是只读，这是拿到可编辑版本的通道；生成后直接打开预览。
 */
async function convertPdfToEditable(entry) {
  const raw = (entry.fullText || '').trim();
  const isDoc = entry.format === 'doc';
  if (!raw) {
    showToast('未提取到文本，无法转换', true);
    return;
  }
  showToast('正在生成可编辑文档…');
  try {
    const md = isDoc ? raw.replace(/\n{3,}/g, '\n\n') : pdfTextToMarkdown(raw);
    const baseName = (entry.fileName || (isDoc ? 'Word 文档' : 'PDF 文档')).replace(/\.(pdf|doc)$/i, '');
    const blob = await markdownToDocxBlob(md, { title: baseName });
    const id = crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    const doc = {
      id,
      kind: 'document',
      format: 'docx',
      fileName: baseName + '_可编辑.docx',
      fileSize: blob.size,
      pageCount: null,
      docId: id, // IDB 原件 key（= 条目 id）
      fullText: md,
      aiTitle: baseName + '（可编辑）',
      originalTitle: baseName + '（可编辑）',
      aiSummary: (entry.aiSummary || '').slice(0, 200),
      source: '',
      entryType: 'output',
      provenance: {
        type: 'derived',
        publisher: '',
        capturedAt: Date.now(),
        trustClass: 'derived',
        sourceEntryId: entry.id,
      },
      tags: [...(entry.tags || [])],
      createdAt: Date.now(),
      publishedAt: todayStr(),
      status: 'completed',
      errorMessage: '',
      convertedFrom: entry.id,
    };
    await saveDocFile(id, await blob.arrayBuffer());
    await saveEntry(doc, currentProject);
    entries = await getEntries(currentProject);
    render();
    openDocPreview(doc);
  } catch (err) {
    showToast('转换失败: ' + err.message, true);
  }
}

/**
 * 文档卡片「预览」：打开阅读器页渲染。
 * - 上传文档：原件已在 IDB，直接 ?doc=<docId> 打开
 * - AI 生成的 docx/xlsx/md/csv：创建时已落盘；旧条目无原件时在此补生成
 */
async function openDocPreview(entry) {
  const docId = entry.docId || entry.id;
  let name = entry.fileName || '';
  if (!entry.docId && entry.format === 'docx') {
    name = name || ((entry.aiTitle || '文档') + '.docx');
    const existing = await getDocFile(docId).catch(() => null);
    if (!existing) {
      try {
        const blob = await entriesToMarkdownDocxBlob([entry]);
        await saveDocFile(docId, await blob.arrayBuffer());
      } catch (err) {
        showToast('生成预览文档失败: ' + err.message, true);
        return;
      }
    }
  }
  if (!entry.docId && (entry.format === 'md' || entry.format === 'txt')) {
    name = name || ((entry.aiTitle || '文档') + (entry.format === 'txt' ? '.txt' : '.md'));
    const existing = await getDocFile(docId).catch(() => null);
    if (!existing) {
      try {
        const blob = new Blob([entry.fullText || ''], { type: 'text/plain;charset=utf-8' });
        await saveDocFile(docId, await blob.arrayBuffer());
      } catch (err) {
        showToast('生成预览文档失败: ' + err.message, true);
        return;
      }
    }
  }
  if (!entry.docId && entry.format === 'csv') {
    // AI 生成的 CSV 无原件：fullText 即 CSV 文本，包成 Blob 补存到 doc-store
    name = name || ((entry.aiTitle || '文档') + '.csv');
    const existing = await getDocFile(docId).catch(() => null);
    if (!existing) {
      if (!entry.fullText) {
        showToast('CSV 内容为空，无法预览', true);
        return;
      }
      try {
        const blob = new Blob([entry.fullText], { type: 'text/csv;charset=utf-8' });
        await saveDocFile(docId, await blob.arrayBuffer());
      } catch (err) {
        showToast('生成预览文档失败: ' + err.message, true);
        return;
      }
    }
  }
  if (entry.format === 'xlsx') {
    name = name || ((entry.aiTitle || entry.fileName || '表格') + (/\.xlsx$/i.test(name) ? '' : '.xlsx'));
    if (!/\.xlsx$/i.test(name)) name = name.replace(/\.(xls|csv)$/i, '') + '.xlsx';
    const existing = await getDocFile(docId).catch(() => null);
    if (!existing) {
      try {
        const { aoa } = rowsFromCreateDocumentArgs({
          content: entry.fullText || '',
          structured_data: entry.structuredData || null,
        });
        if (!aoa.length) {
          showToast('表格内容为空，无法预览', true);
          return;
        }
        const ab = await aoaToXlsxBuffer(aoa, entry.aiTitle || 'Sheet1');
        await saveDocFile(docId, ab);
      } catch (err) {
        showToast('生成预览表格失败: ' + err.message, true);
        return;
      }
    }
  }
  const url = chrome.runtime.getURL('src/reader/index.html')
    + '?doc=' + encodeURIComponent(docId)
    + '&name=' + encodeURIComponent(name || 'document');
  chrome.tabs.create({ url, active: true });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const n = Number(bytes);
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(msg, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'import-toast' + (isError ? ' import-toast-error' : '');
  toast.textContent = msg;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2500);
}

/* ---- Chat ---- */

let chatHistory = []; // { role, content } for API context
let lastEntrySnapshot = ''; // track entry list changes
let lastSelectionSnapshot = ''; // track selected-ids changes
let lastProjectSnapshot = ''; // track current-project changes

let contextDeltaInitialized = false;

function buildContextDelta(run) {
  const ent = run ? run.entries : entries;
  const sel = run ? run.selectedIds : selectedIds;
  const projSnapshot = (run ? run.pid : currentProject) || 'default';
  const snapshot = ent.map((e) => `${e.id}:${e.status}`).join(',');
  const selSnapshot = [...sel].sort().join(',');
  const initialized = run ? run.contextDeltaInitialized : contextDeltaInitialized;
  const prevProj = run ? run.lastProjectSnapshot : lastProjectSnapshot;
  const prevEntries = run ? run.lastEntrySnapshot : lastEntrySnapshot;
  const prevSel = run ? run.lastSelectionSnapshot : lastSelectionSnapshot;

  const notes = [];

  if (initialized) {
    if (projSnapshot !== prevProj) {
      notes.push(`当前项目已切换：${prevProj || '(未记录)'} → ${projSnapshot}。此前历史涉及的条目 id 可能不属于本项目，务必以最新「库中条目」列表为准，切勿沿用旧 id。`);
    }
    if (snapshot !== prevEntries) {
      notes.push('库中条目列表已发生变化（增删或状态更新）。旧对话中提到的条目状态可能已过时，请以最新列表为准。');
    }
    if (selSnapshot !== prevSel) {
      if (selSnapshot) {
        notes.push(`用户当前勾选已变化，最新勾选 id：[${selSnapshot}]。此前历史/工具返回中出现的其他条目全文，若不在本次勾选内，视为无效上下文，不要基于旧全文作答；如需引用，请重新调用 fetch_entry。`);
      } else {
        notes.push('用户已取消所有勾选。此前作为「已勾选全文」出现在上下文里的内容视为无效，不要再基于其作答。');
      }
    }
  }

  if (run) {
    run.lastEntrySnapshot = snapshot;
    run.lastSelectionSnapshot = selSnapshot;
    run.lastProjectSnapshot = projSnapshot;
    run.contextDeltaInitialized = true;
  }
  if (!run || viewing(run)) {
    lastEntrySnapshot = snapshot;
    lastSelectionSnapshot = selSnapshot;
    lastProjectSnapshot = projSnapshot;
    contextDeltaInitialized = true;
  }

  return notes;
}

async function buildDynamicContext(userText, run = null) {
  const ent = run ? run.entries : entries;
  const sel = run ? run.selectedIds : selectedIds;
  const pid = run ? run.pid : currentProject;
  // 条目摘要与浮动聊天 AI 共用同一实现（chat-executor.js），保证两侧提示词平价
  const entryDigest = buildEntriesDigest(ent, sel, 40);

  const selectedEntries = ent.filter((e) => sel.has(e.id));
  const selectedIdList = selectedEntries.map((e) => e.id).join(', ');
  const first = selectedEntries[0];
  const selectedPreview = first
    ? `--- ${first.aiTitle || first.originalTitle || '(无标题)'} (id=${first.id}) ---\nurl=${first.url || ''}\n${(first.fullText || first.aiSummary || '(无正文预览)').slice(0, 300)}${(first.fullText || '').length > 300 ? '\n…(截断，用 fetch_entry 拉取完整正文)' : ''}${selectedEntries.length > 1 ? `\n\n（另有 ${selectedEntries.length - 1} 条已勾选，需要时逐条 fetch_entry）` : ''}`
    : '';

  const deltas = buildContextDelta(run);

  const now = new Date();
  const tzOffset = -now.getTimezoneOffset() / 60;
  const tzLabel = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset}`;
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${tzLabel}`;

  // Fetch current tab info for the AI to know what page the user is on
  let currentTabUrl = '';
  let currentTabInfo = '';
  try {
    const tab = await getBrowsingTab();
    if (tab) {
      currentTabUrl = tab.url;
      currentTabInfo = `${tab.url}\n${(tab.title || '').slice(0, 100)}`;
    }
  } catch (_) {}

  // 全局阅读器会话：告知模型当前打开的文档；docx/xlsx 用 doc_edit，无需点「编辑」
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'READER_SESSION_GET' });
    const s = resp && resp.session;
    if (s) currentTabInfo += formatReaderSessionNote(s);
  } catch (_) {}

  // 按当前页 URL 前缀优先检索经验记忆（即使用户消息里没提站名）
  const memories = await retrieveMemories(userText || '', { currentUrl: currentTabUrl });
  if (run) run.tabInfo = currentTabInfo;
  if (!run || viewing(run)) toolCtx.currentTabInfo = currentTabInfo;
  const agents = await getAgentListCached();
  const mentionedAgents = parseAgentMentions(userText, agents.map((a) => a.name));

  return buildDynamicPreamble({
    entryDigest: entryDigest,
    selectedIdList,
    selectedPreview,
    deltas,
    currentProject: pid,
    dateStr,
    currentTabInfo,
    memories,
    agentCatalog: formatAgentCatalog(agents),
    mentionedAgents,
    notebookNotes: await listNotes(pid),
    insights: await listInsights(pid),
    plan: await getPlan(pid),
    apiCatalog: formatApiCatalog(await loadConnectors()),
  });
}

let chatHistorySummary = ''; // rolling LLM-generated summary of dropped older turns
// 压缩触发阈值不再写死 500k，按模型上下文窗口推导（chat-executor.js 的
// contextCompactBudget，读项目配置 contextTokens，默认 1M 窗口 -> 预算 ~680k）。
// 保留尾部 token 数用 chat-executor.js 导出的 HISTORY_KEEP_TAIL_TOKENS（32000）。

/**
 * Compact chat history using an industry-standard token-budget + LLM
 * summarization strategy. See `history-compact.js` for algorithm details.
 * Non-blocking philosophy: on failure the history is left untouched.
 *
 * @param {object} apiCfg
 * @param {object} [opts]
 * @param {boolean} [opts.force] Skip the budget check (used by the manual
 *                               auto_compact tool).
 * @returns {Promise<{compacted:boolean, dropped:number, summaryTokens:number, keptTokens:number}>}
 */
async function compactChatHistoryIfNeeded(apiCfg, opts = {}) {
  const budget = opts.force ? 0 : contextCompactBudget(apiCfg);
  const run = opts.run || null;
  const history = run ? run.history : chatHistory;
  const summary = run ? run.summary : chatHistorySummary;
  try {
    const r = await compactHistory({
      history,
      priorSummary: summary,
      apiCfg,
      budgetTokens: budget,
      keepTailTokens: HISTORY_KEEP_TAIL_TOKENS,
    });
    if (r.compacted) {
      if (run) {
        run.history = r.history;
        run.summary = r.summary;
      }
      if (!run || viewing(run)) {
        chatHistory = r.history;
        chatHistorySummary = r.summary;
        const visible = ensureRun(currentProject);
        if (!run && visible.loaded) {
          visible.history = chatHistory;
          visible.summary = chatHistorySummary;
        }
      }
      const summaryTokens = estimateTokens(r.summary);
      const keptTokens = estimateMessagesTokens(r.history);
      console.log(`[chat] history compacted: dropped ${r.dropped.length} messages, summary ${summaryTokens} tokens, kept ${keptTokens} tokens`);
      return { compacted: true, dropped: r.dropped.length, summaryTokens, keptTokens, cost: r.cost };
    }
    return { compacted: false, dropped: 0, summaryTokens: 0, keptTokens: estimateMessagesTokens(history) };
  } catch (err) {
    console.warn('[chat] history compaction failed, keeping raw:', err.message);
    return { compacted: false, dropped: 0, summaryTokens: 0, keptTokens: estimateMessagesTokens(history), error: err.message };
  }
}

let compactionInFlight = false;

/**
 * Fire-and-forget wrapper: schedule compaction after the current turn ends.
 * Ensures only one background compaction runs at a time. Announces success
 * with a subtle toast so the user knows the assistant's memory was compressed.
 */
function scheduleBackgroundCompaction(apiCfg, run) {
  const target = run || ensureRun(currentProject);
  if (target.compactionInFlight) return;
  const totalTokens = estimateMessagesTokens(target.history) + estimateTokens(target.summary);
  if (totalTokens <= contextCompactBudget(apiCfg)) return;

  target.compactionInFlight = true;
  Promise.resolve().then(async () => {
    try {
      const r = await compactChatHistoryIfNeeded(apiCfg, { run: target });
      if (r.compacted) {
        target.totalUsedTokens += usageTotalTokens(r.cost);
        if (viewing(target)) {
          totalUsedTokens = target.totalUsedTokens;
          showToast('已压缩早期对话');
          updateTokenMeter();
        }
        saveChatSession(target.pid);
      }
    } finally {
      target.compactionInFlight = false;
    }
  });
}

/* ---- 会话落盘（按项目持久化 + 可导出回放）----
 * chatMessages（UI 气泡）与 chatHistory（API 上下文，含 assistant tool_calls 与
 * tool 结果）双双存 chrome.storage.local 的 chatSession_{projectId}。
 * 关面板 / SW 重启 / 浏览器重启后对话可恢复；出问题可导出 JSON 回放排查
 * "它当时看到什么"。浮动聊天（ann-chat 端口）暂不落盘（权威历史在 SW 内存，
 * 端口生命周期短，恢复价值低）。 */
const chatSessionKey = (pid) => `chatSession_${pid || 'default'}`;

async function saveChatSession(pid = currentProject) {
  try {
    const id = pid || 'default';
    const run = projectRuns.get(id);
    if (run && run.loaded && id === currentProject) adoptVisible(run);
    const fromRun = run && run.loaded && id !== currentProject;
    const payload = {
      v: 1,
      project: id,
      messages: fromRun ? run.messages : chatMessages,
      history: fromRun ? run.history : chatHistory,
      summary: fromRun ? run.summary : chatHistorySummary,
      totalUsedTokens: fromRun ? run.totalUsedTokens : totalUsedTokens,
      subagentSessions: serializeSubagentSessions(fromRun ? run.subagentSessions : toolCtx.subagentSessions),
      updatedAt: Date.now(),
    };
    // 防御超大（正常有压缩兜底不会到这）：丢最老的 200 条再存
    if (JSON.stringify(payload).length > 4 * 1024 * 1024) {
      payload.history = payload.history.slice(-200);
      payload.messages = payload.messages.slice(-200);
    }
    await chrome.storage.local.set({ [chatSessionKey(pid)]: payload });
  } catch (err) {
    console.warn('[SuperCat] save chat session failed:', err.message);
  }
}

async function loadChatSession(pid = currentProject) {
  const id = pid || 'default';
  const run = ensureRun(id);
  if (run.loaded) {
    if (viewing(run)) {
      bindVisibleRun(run);
      renderChat();
      if (run.inProgress) reattachLiveTurn(run);
      updateTokenMeter();
      updateSendButton();
    }
    return true;
  }
  try {
    const key = chatSessionKey(id);
    const { [key]: s } = await chrome.storage.local.get(key);
    if (s && Array.isArray(s.history)) {
      run.messages = Array.isArray(s.messages) ? s.messages : [];
      run.history = s.history;
      run.summary = s.summary || '';
      run.totalUsedTokens = Number(s.totalUsedTokens) || 0;
      run.subagentSessions = restoreSubagentSessions(s.subagentSessions);
      // 清单按项目存（浮动聊天与侧栏共用）：会话里没有或更旧时，用存储里的补上
      try { reconcilePlanFromStorage(run.messages, await getPlan(id)); } catch (_) {}
    }
  } catch (_) {}
  run.loaded = true;
  if (viewing(run)) {
    bindVisibleRun(run);
    renderChat();
    updateTokenMeter();
    updateSendButton();
  }
  return true;
}

async function clearChatSession(pid = currentProject) {
  try { await chrome.storage.local.remove(chatSessionKey(pid)); } catch (_) {}
}

async function buildMessagesForApi(userText, attachments = [], run = null) {
  const history = run ? run.history : chatHistory;
  const summary = run ? run.summary : chatHistorySummary;
  const { maxParallel } = await getSubagentLimits().catch(() => ({ maxParallel: undefined }));
  const msgs = [
    { role: 'system', content: getStaticSystemPrompt({ maxParallel }) },
  ];
  if (summary) {
    msgs.push({
      role: 'system',
      content: `## 前情摘要（早期对话已压缩，仅供参考，如有冲突以最新上下文为准）\n${summary}`,
    });
  }
  msgs.push(...history);
  const preamble = await buildDynamicContext(userText, run);
  msgs.push({ role: 'user', content: preamble });
  msgs.push({ role: 'user', content: composeUserContent(userText, attachments) });
  return msgs;
}

function composeUserContent(userText, attachments = []) {
  const pins = (attachments || []).filter((a) => a.kind === 'doc' && a.entryId)
    .map((a) => `[已入库: ${a.name} (id=${a.entryId})]`);
  const text = pins.length ? pins.join('\n') + '\n' + userText : userText;
  const images = (attachments || []).filter((a) => a.kind === 'image' && a.dataUrl);
  if (!images.length) return text;
  return [
    { type: 'text', text },
    ...images.map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
  ];
}

let chatAbortController = null;
let chatQueue = [];
let chatInProgress = false;
// 每个项目一份对话运行时。切走只卸下界面，不 abort；切回来再挂上直播。
const projectRuns = new Map();

function viewing(run) {
  return !!run && run.pid === currentProject;
}

function runIsBusy(run) {
  return !!run && (
    run.inProgress ||
    run.draining ||
    run.runningSubagents.size > 0 ||
    run.backgroundAborts.size > 0
  );
}

function ensureRun(pid) {
  const id = pid || 'default';
  let run = projectRuns.get(id);
  if (!run) {
    run = {
      pid: id,
      loaded: false,
      discarded: false,
      messages: [],
      history: [],
      summary: '',
      totalUsedTokens: 0,
      queue: [],
      inProgress: false,
      abort: null,
      cost: null,
      pendingUserText: '',
      liveTurnText: '',
      pendingSuggestions: null,
      pendingScopeQuiz: null,
      pendingCharts: [],
      pendingImages: [],
      liveCards: new Map(),
      subagentSessions: new Map(),
      runningSubagents: new Set(),
      pendingFollowups: [],
      turnSpawned: new Set(),
      toolUndos: [],
      backgroundAborts: new Set(),
      heartbeatTaskId: null,
      draining: false,
      entries: [],
      selectedIds: new Set(),
      previewId: null,
      pendingCollect: null,
      axSnapshotMap: new Map(),
      activeAiBubbleEl: null,
      streamBodyEl: null,
      thinkingTextEl: null,
      bubbleEl: null,
      thinkingLabel: '',
      lastEntrySnapshot: '',
      lastSelectionSnapshot: '',
      lastProjectSnapshot: '',
      contextDeltaInitialized: false,
      tabInfo: '',
      compactionInFlight: false,
      lastLiveMeterAt: 0,
    };
    projectRuns.set(id, run);
  }
  if (!Array.isArray(run.pendingImages)) run.pendingImages = [];
  return run;
}

function adoptVisible(run) {
  if (!run) return;
  run.messages = chatMessages;
  run.history = chatHistory;
  run.summary = chatHistorySummary;
  run.totalUsedTokens = totalUsedTokens;
  run.queue = chatQueue;
  run.inProgress = chatInProgress;
  run.abort = chatAbortController;
  run.cost = chatCost;
  run.pendingUserText = pendingUserText;
  run.liveTurnText = liveTurnText;
  run.pendingSuggestions = pendingSuggestions;
  run.pendingScopeQuiz = pendingScopeQuiz;
  run.pendingCharts = pendingCharts;
  run.pendingImages = pendingImages;
  run.liveCards = liveSubagentCards;
  run.subagentSessions = toolCtx.subagentSessions;
  run.runningSubagents = toolCtx.runningSubagents;
  run.pendingFollowups = pendingSubagentFollowups;
  run.turnSpawned = turnSpawnedSubagents;
  run.toolUndos = toolUndos;
  run.backgroundAborts = backgroundAborts;
  run.heartbeatTaskId = activeHeartbeatTaskId;
  run.activeAiBubbleEl = activeAiBubbleEl;
  run.streamBodyEl = streamBodyEl;
  run.thinkingTextEl = thinkingTextEl;
  run.previewId = previewId;
  run.pendingCollect = pendingCollect;
  run.axSnapshotMap = axSnapshotMap;
  run.lastEntrySnapshot = lastEntrySnapshot;
  run.lastSelectionSnapshot = lastSelectionSnapshot;
  run.lastProjectSnapshot = lastProjectSnapshot;
  run.contextDeltaInitialized = contextDeltaInitialized;
  run.entries = entries;
  run.selectedIds = selectedIds;
  run.loaded = true;
}

function bindVisibleRun(run) {
  chatMessages = run.messages;
  chatHistory = run.history;
  chatHistorySummary = run.summary;
  totalUsedTokens = run.totalUsedTokens;
  lastTokenCount = 0;
  chatQueue = run.queue;
  chatInProgress = run.inProgress;
  chatAbortController = run.abort;
  chatCost = run.cost;
  pendingUserText = run.pendingUserText;
  liveTurnText = run.liveTurnText;
  pendingSuggestions = run.pendingSuggestions;
  pendingScopeQuiz = run.pendingScopeQuiz;
  pendingCharts = run.pendingCharts;
  pendingImages = run.pendingImages;
  liveSubagentCards = run.liveCards;
  toolCtx.subagentSessions = run.subagentSessions;
  toolCtx.runningSubagents = run.runningSubagents;
  pendingSubagentFollowups = run.pendingFollowups;
  turnSpawnedSubagents = run.turnSpawned;
  toolUndos = run.toolUndos;
  backgroundAborts = run.backgroundAborts;
  activeHeartbeatTaskId = run.heartbeatTaskId;
  activeAiBubbleEl = run.activeAiBubbleEl && run.activeAiBubbleEl.isConnected ? run.activeAiBubbleEl : null;
  thinkingTextEl = run.thinkingTextEl && run.thinkingTextEl.isConnected ? run.thinkingTextEl : null;
  streamBodyEl = run.streamBodyEl && run.streamBodyEl.isConnected ? run.streamBodyEl : null;
  previewId = run.previewId;
  pendingCollect = run.pendingCollect;
  axSnapshotMap = run.axSnapshotMap;
  lastEntrySnapshot = run.lastEntrySnapshot;
  lastSelectionSnapshot = run.lastSelectionSnapshot;
  lastProjectSnapshot = run.lastProjectSnapshot;
  contextDeltaInitialized = run.contextDeltaInitialized;
}

function refreshProjectLiveBadges(run) {
  if (run) {
    const busy = runIsBusy(run);
    if (run.busyBadge === busy) return;
    run.busyBadge = busy;
  }
  const list = document.getElementById('libraryList');
  if (!list || list.querySelector('.library-rename-input')) return;
  renderProjects();
}

/** 对话回合起止写入统一操作日志（心跳触发的回合标为 heartbeat）。 */
function logTurnActivity(run, started) {
  if (started) {
    run.turnStartedAt = Date.now();
    run.turnHeartbeatId = run.heartbeatTaskId || '';
  }
  const hbId = run.turnHeartbeatId || '';
  const hb = !!hbId;
  const firstLine = String(run.pendingUserText || '').split('\n')[0];
  logActivity({
    projectId: run.pid,
    actor: hb ? 'heartbeat' : 'main',
    actorId: hbId,
    cat: 'turn',
    action: started ? 'turn.start' : 'turn.end',
    label: started ? (hb ? '心跳任务开始' : '对话开始') : (hb ? '心跳任务结束' : '对话结束'),
    detail: started ? firstLine : '',
    status: 'ok',
    durationMs: started ? 0 : Date.now() - (run.turnStartedAt || Date.now()),
  });
}

/** 本回合结束时，从 API 历史里取主代理最后一条文字回复（跳过与上回合完全相同的陈旧值）。 */
function lastAssistantReply(run) {
  for (let i = run.history.length - 1; i >= 0; i--) {
    const m = run.history[i];
    if (m && m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()) return m.content;
  }
  return '';
}

/** 回合起止写入任务追踪的内容节点：开始 -> turn 节点；结束 -> 更新状态 + agent 回复节点。 */
function traceTurn(run, started) {
  const meta = run.turnMeta || {};
  if (started) {
    const hbId = run.turnHeartbeatId || '';
    const text = String(run.pendingUserText || '');
    const followup = !!meta.subagentFollowup;
    const first = text.split('\n').find((l) => l.trim()) || '';
    const { node } = putTrace({
      id: newTraceId('t'),
      projectId: run.pid,
      threadId: hbId || CHAT_THREAD,
      kind: 'turn',
      subtype: hbId ? 'heartbeat' : (followup ? 'followup' : 'user'),
      title: hbId ? `心跳运行 · ${meta.heartbeatName || ''}`.trim() : (followup ? '子代理回报' : first),
      text: hbId || followup ? '' : text,
      status: 'running',
    });
    run.traceTurn = node;
    run.traceTurnId = node ? node.id : '';
    return;
  }
  const turn = run.traceTurn;
  if (!turn) return;
  const aborted = !!(run.abort && run.abort.signal && run.abort.signal.aborted);
  putTrace({ ...turn, endedAt: Date.now(), status: aborted ? 'aborted' : 'ok' });
  const reply = lastAssistantReply(run);
  if (reply && reply !== run.traceLastReply) {
    run.traceLastReply = reply;
    putTrace({
      projectId: run.pid,
      parentId: turn.id,
      threadId: turn.threadId,
      kind: 'agent',
      title: reply.split('\n').find((l) => l.trim()) || '主代理回复',
      text: reply,
      ts: Date.now(),
      status: aborted ? 'aborted' : 'ok',
    });
  }
}

function setRunActive(run, active) {
  const was = run.inProgress;
  run.inProgress = active;
  if (!!was !== !!active) {
    logTurnActivity(run, active);
    traceTurn(run, active);
  }
  if (!active) run.abort = null;
  if (viewing(run)) {
    chatInProgress = active;
    if (!active) chatAbortController = null;
    updateSendButton();
  }
  if (was !== active) refreshProjectLiveBadges(run);
}

function mirrorScalars(run) {
  if (!viewing(run)) return;
  chatHistory = run.history;
  chatHistorySummary = run.summary;
  chatMessages = run.messages;
  chatQueue = run.queue;
  totalUsedTokens = run.totalUsedTokens;
  pendingUserText = run.pendingUserText;
  liveTurnText = run.liveTurnText;
  pendingSuggestions = run.pendingSuggestions;
  pendingScopeQuiz = run.pendingScopeQuiz;
  pendingCharts = run.pendingCharts;
  pendingImages = run.pendingImages;
  chatCost = run.cost;
  previewId = run.previewId;
  pendingCollect = run.pendingCollect;
  toolCtx.subagentSessions = run.subagentSessions;
  toolUndos = run.toolUndos;
  activeHeartbeatTaskId = run.heartbeatTaskId;
}

function stopRun(run) {
  if (!run) return;
  run.queue = [];
  if (viewing(run)) {
    chatQueue = run.queue;
    if (chatMessagesEl) chatMessagesEl.querySelectorAll('.chat-msg.queued').forEach((el) => el.remove());
  }
  if (run.abort) {
    try { run.abort.abort(); } catch (_) {}
    run.abort = null;
  }
  for (const c of run.backgroundAborts) {
    try { c.abort(); } catch (_) {}
  }
  run.backgroundAborts.clear();
  run.pendingFollowups = [];
  setRunActive(run, false);
  if (viewing(run)) {
    chatAbortController = null;
    pendingSubagentFollowups = run.pendingFollowups;
    backgroundAborts = run.backgroundAborts;
  }
  closeChatOpenedTabs(run);
}

function paintStream(run, fullText) {
  run.liveTurnText = fullText;
  const last = run.messages[run.messages.length - 1];
  if (last && last.role === 'ai') last.text = fullText;
  if (!viewing(run)) return;
  liveTurnText = fullText;
  const bubble = run.bubbleEl;
  if (bubble && bubble.isConnected) {
    const stream = layoutBubbleImages(bubble, fullText, (last && last.images) || []);
    if (stream) {
      run.streamBodyEl = stream;
      streamBodyEl = stream;
    }
    syncLiveTurnOrder(bubble, 'chat');
  } else if (run.streamBodyEl && run.streamBodyEl.isConnected) {
    streamBodyEl = run.streamBodyEl;
    run.streamBodyEl.innerHTML = renderChatText(fullText);
  } else return;
  if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  const nowTs = Date.now();
  if (nowTs - (run.lastLiveMeterAt || 0) > 700) {
    run.lastLiveMeterAt = nowTs;
    totalUsedTokens = run.totalUsedTokens;
    pendingUserText = run.pendingUserText;
    updateTokenMeter(true);
  }
}

function paintThinking(run, text, isError) {
  run.thinkingLabel = text || '';
  if (!viewing(run)) return;
  const el = run.thinkingTextEl;
  if (!el || !el.isConnected) return;
  thinkingTextEl = el;
  setThinkingText(text, isError);
}

function reattachLiveTurn(run) {
  if (!viewing(run) || !run.inProgress || !chatMessagesEl) return;
  const nodes = [...chatMessagesEl.querySelectorAll('.chat-msg.ai')];
  const bubbleEl = nodes[nodes.length - 1];
  if (!bubbleEl) return;
  const last = [...run.messages].reverse().find((m) => m && m.role === 'ai');
  const text = run.liveTurnText || (last && last.text) || '';
  const cards = (last && last.subagents) || [];
  bubbleEl.innerHTML =
    '<div class="chat-subagents"></div>' +
    '<div class="chat-stream-body"></div>' +
    '<div class="chat-ai-row"><span class="chat-thinking-orb"></span><span class="chat-thinking-text">Thinking</span></div>';
  for (const card of cards) {
    if (card) upsertSubagentCardEl(bubbleEl, card, 'chat');
  }
  run.bubbleEl = bubbleEl;
  run.thinkingTextEl = bubbleEl.querySelector('.chat-thinking-text');
  run.activeAiBubbleEl = bubbleEl;
  thinkingTextEl = run.thinkingTextEl;
  activeAiBubbleEl = bubbleEl;
  run.streamBodyEl = layoutBubbleImages(bubbleEl, text, (last && last.images) || [])
    || bubbleEl.querySelector('.chat-stream-body');
  streamBodyEl = run.streamBodyEl;
  mountThinkingOrb(bubbleEl.querySelector('.chat-thinking-orb'));
  if (run.thinkingLabel) setThinkingText(run.thinkingLabel, false);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function makeRunCtx(run) {
  const ctx = {
    get entries() { return run.entries; },
    set entries(v) {
      run.entries = v;
      if (viewing(run)) entries = v;
    },
    get projectId() { return run.pid; },
    get previewId() { return run.previewId; },
    set previewId(v) {
      run.previewId = v;
      if (viewing(run)) previewId = v;
    },
    get pendingCollect() { return run.pendingCollect; },
    set pendingCollect(v) {
      run.pendingCollect = v;
      if (viewing(run)) pendingCollect = v;
    },
    get selectedIds() { return run.selectedIds; },
    set selectedIds(v) {
      run.selectedIds = v;
      if (viewing(run)) selectedIds = v;
    },
    get toolUndos() { return run.toolUndos; },
    set toolUndos(v) {
      run.toolUndos = v;
      if (viewing(run)) toolUndos = v;
    },
    get chatHistory() { return run.history; },
    set chatHistory(v) {
      run.history = v;
      if (viewing(run)) chatHistory = v;
    },
    get chatHistorySummary() { return run.summary; },
    set chatHistorySummary(v) {
      run.summary = v;
      if (viewing(run)) chatHistorySummary = v;
    },
    get pendingSuggestions() { return run.pendingSuggestions; },
    set pendingSuggestions(v) {
      run.pendingSuggestions = v;
      if (viewing(run)) pendingSuggestions = v;
    },
    get pendingScopeQuiz() { return run.pendingScopeQuiz; },
    set pendingScopeQuiz(v) {
      run.pendingScopeQuiz = v;
      if (viewing(run)) pendingScopeQuiz = v;
    },
    get pendingCharts() { return run.pendingCharts; },
    set pendingCharts(v) {
      run.pendingCharts = Array.isArray(v) ? v : [];
      if (viewing(run)) pendingCharts = run.pendingCharts;
    },
    get pendingImages() { return run.pendingImages; },
    set pendingImages(v) {
      run.pendingImages = Array.isArray(v) ? v : [];
      if (viewing(run)) pendingImages = run.pendingImages;
    },
    onImage: (image) => {
      const last = run.messages[run.messages.length - 1];
      if (!last || last.role !== 'ai') return;
      stampImageOnMessage(last, image);
      if (!viewing(run)) return;
      const bubble = run.activeAiBubbleEl;
      if (!bubble || !bubble.isConnected) return;
      const stream = layoutBubbleImages(bubble, last.text || '', last.images || []);
      if (stream) {
        run.streamBodyEl = stream;
        streamBodyEl = stream;
      }
      syncLiveTurnOrder(bubble, 'chat');
      if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    },
    onChart: (chart) => {
      const last = run.messages[run.messages.length - 1];
      if (last && last.role === 'ai') {
        last.charts = [...(last.charts || []).filter((c) => c.id !== chart.id), chart];
      }
      if (!viewing(run)) return;
      const bubble = run.activeAiBubbleEl;
      if (!bubble || !bubble.isConnected) return;
      appendChartInMessage(bubble, chart, '.chat-ai-row');
      syncLiveTurnOrder(bubble, 'chat');
      if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    },
    onPlan: (plan) => applyPlanUpdate(plan, run),
    onDocEdit: (card) => applyDocEdit(card, run),
    rasterizeChart: (option, opts) => rasterizeChartOption(option, opts),
    get axSnapshotMap() { return run.axSnapshotMap; },
    set axSnapshotMap(_v) {},
    showToast: (msg, isError) => { if (viewing(run)) showToast(msg, isError); },
    onEntriesChanged: () => {
      if (!viewing(run)) return;
      entries = run.entries;
      render();
      renderProjects();
      if (workspaceApi) workspaceApi.refresh();
    },
    ui: {
      clearContextState: () => {
        run.messages = [];
        run.cost = null;
        run.pendingSuggestions = null;
        run.pendingScopeQuiz = null;
        run.pendingCharts = [];
        run.pendingImages = [];
        run.liveCards = new Map();
        run.subagentSessions = new Map();
        run.pendingFollowups = [];
        clearPlan(run.pid).catch(() => {});
        run.totalUsedTokens = 0;
        run.pendingUserText = '';
        run.liveTurnText = '';
        run.contextDeltaInitialized = false;
        run.lastEntrySnapshot = '';
        run.lastSelectionSnapshot = '';
        run.lastProjectSnapshot = '';
        if (!viewing(run)) return;
        chatMessages = run.messages;
        chatCost = null;
        pendingSuggestions = null;
        pendingScopeQuiz = null;
        pendingCharts = [];
        pendingImages = [];
        liveSubagentCards = run.liveCards;
        toolCtx.subagentSessions = run.subagentSessions;
        pendingSubagentFollowups = run.pendingFollowups;
        totalUsedTokens = 0;
        lastTokenCount = 0;
        pendingUserText = '';
        liveTurnText = '';
        updateTokenMeter();
        if (chatMessagesEl) {
          disposeChatCharts(chatMessagesEl);
          chatMessagesEl.innerHTML = '';
        }
      },
      clearMessages: () => {},
      onHeartbeatChanged: (opts) => {
        if (!viewing(run)) return;
        renderHeartbeatList();
        refreshHeartbeatBadge();
        if (opts && opts.open) setHeartbeatDrawerOpen(true);
      },
    },
    closeOwnedAiTabs: async (owner, extraIds) => {
      const ids = [...new Set((extraIds || []).map(Number).filter((n) => n > 0))];
      if (ids.length) {
        await Promise.all(ids.map((id) => chrome.tabs.remove(id).catch(() => {})));
      }
      try {
        await chrome.runtime.sendMessage({
          type: 'CLOSE_AI_TABS',
          data: { owner: owner || `chat:${run.pid}`, tabIds: ids },
        });
      } catch (_) {}
    },
    get openTabsInBackground() { return run.pid !== currentProject; },
    tabOwner: `chat:${run.pid}`,
    allowBackground: true,
    apiConfig: null,
    currentTabInfo: '',
    subagentParentSignal: null,
    onSubagentEvent: (card) => {
      applyLiveSubagentCard(card, run);
      refreshProjectLiveBadges(run);
    },
    getActiveHeartbeatTaskId: () => run.heartbeatTaskId,
    getTraceTurnId: () => run.traceTurnId || '',
    getTraceThreadId: () => run.turnHeartbeatId || '',
    onSubagentBackgroundDone: (payload) => handleBackgroundSubagentDone(payload, run),
    onSubagentWriteRefresh: async () => {
      run.entries = await getEntries(run.pid);
      if (viewing(run)) {
        entries = run.entries;
        render();
        renderProjects();
      }
    },
    registerBackgroundAbort: (c) => {
      if (c) run.backgroundAborts.add(c);
      refreshProjectLiveBadges(run);
    },
    unregisterBackgroundAbort: (c) => {
      run.backgroundAborts.delete(c);
      refreshProjectLiveBadges(run);
    },
    onUsage: (usage) => {
      const n = usageTotalTokens(usage);
      if (!n) return;
      run.totalUsedTokens += n;
      if (viewing(run)) {
        totalUsedTokens = run.totalUsedTokens;
        updateTokenMeter(true);
      }
      if (run.inProgress) return;
      clearTimeout(run.usageSaveTimer);
      run.usageSaveTimer = setTimeout(() => { saveChatSession(run.pid).catch(() => {}); }, 400);
    },
  };
  Object.defineProperty(ctx, 'subagentSessions', {
    configurable: true,
    enumerable: true,
    get() { return run.subagentSessions; },
    set(v) {
      run.subagentSessions = v;
      if (viewing(run)) toolCtx.subagentSessions = v;
    },
  });
  Object.defineProperty(ctx, 'runningSubagents', {
    configurable: true,
    enumerable: true,
    get() { return run.runningSubagents; },
    set(v) {
      run.runningSubagents = v;
      if (viewing(run)) toolCtx.runningSubagents = v;
    },
  });
  return ctx;
}

async function continueAfterTurn(run) {
  if (!run || run.discarded) return;
  setRunActive(run, false);
  if (viewing(run)) updateTokenMeter();
  await closeChatOpenedTabs(run);
  if (run.queue.length > 0) {
    const next = run.queue.shift();
    if (viewing(run)) {
      chatQueue = run.queue;
      const qb = chatMessagesEl?.querySelector(`[data-queue-id="${next.id}"]`);
      if (qb) qb.remove();
    }
    sendChatMessage(next.text, { run, attachments: [] });
    return;
  }
  drainRun(run);
}

const SEND_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
const STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function updateSendButton() {
  if (!cmdSendBtn) return;
  const hasInput = (cmdInput && cmdInput.value.trim()) || pendingAttachments.length;
  // 探头像素猫联动生成状态：呼吸加速 + 双爪快按（所有 chatInProgress 变化都会刷到这里）
  setPeekCatThinking(chatInProgress);
  cmdSendBtn.classList.remove('stop', 'send', 'disabled');
  if (chatInProgress && !hasInput) {
    // 生成中 + 输入框空 -> 停止态
    cmdSendBtn.classList.add('stop');
    cmdSendBtn.innerHTML = STOP_SVG;
    cmdSendBtn.title = '停止';
    cmdSendBtn.disabled = false;
  } else if (chatInProgress && hasInput) {
    // 生成中 + 有输入 -> 发送态(入队)
    cmdSendBtn.classList.add('send');
    cmdSendBtn.innerHTML = SEND_SVG;
    cmdSendBtn.title = '排队发送';
    cmdSendBtn.disabled = false;
  } else if (hasInput) {
    // 空闲 + 有输入 -> 发送态
    cmdSendBtn.classList.add('send');
    cmdSendBtn.innerHTML = SEND_SVG;
    cmdSendBtn.title = '发送';
    cmdSendBtn.disabled = false;
  } else {
    // 空闲 + 输入框空 -> 禁用态
    cmdSendBtn.classList.add('disabled');
    cmdSendBtn.innerHTML = SEND_SVG;
    cmdSendBtn.title = '发送';
    cmdSendBtn.disabled = true;
  }
}

// 初始：输入框为空，发送按钮显示禁用态（放在所有依赖声明之后）
updateSendButton();
// 探头像素猫：趴在输入框上沿（cmd-input-wrap 是“窗台”）
mountPeekCat(document.querySelector('#commandBar .cmd-input-wrap'));

cmdAttachBtn?.addEventListener('click', async () => {
  try {
    const files = await pickLocalFiles({ multiple: true });
    if (files.length) ingestFiles(files, { source: 'chat' });
  } catch (err) {
    showToast('无法打开文件选择: ' + (err.message || err), true);
  }
});
cmdInput?.addEventListener('paste', (e) => {
  const items = [...(e.clipboardData?.items || [])];
  const imageItems = items.filter((it) => it.type && it.type.startsWith('image/'));
  if (!imageItems.length) return;
  e.preventDefault();
  const files = imageItems.map((it) => it.getAsFile()).filter(Boolean);
  if (files.length) ingestFiles(files, { source: 'paste' });
});
function setHeartbeatDrawerOpen(open) {
  if (!heartbeatDrawer) return;
  heartbeatDrawer.classList.toggle('is-open', open);
  heartbeatDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  heartbeatDrawer.toggleAttribute('inert', !open);
  cmdHeartbeatBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) renderHeartbeatList();
}

cmdHeartbeatBtn?.addEventListener('click', () => {
  setHeartbeatDrawerOpen(!heartbeatDrawer?.classList.contains('is-open'));
});
document.getElementById('hbAddBtn')?.addEventListener('click', () => {
  heartbeatEditingId = 'new';
  renderHeartbeatList();
});

function formatNextRun(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return sameDay ? `下次 ${hh}:${mm}` : `下次 ${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function syncHeartbeatUi() {
  heartbeatEditingId = null;
  renderHeartbeatList();
  refreshHeartbeatBadge();
}

async function refreshHeartbeatBadge() {
  if (!cmdHeartbeatBtn) return;
  const n = await queuedOrDueCount(currentProject);
  const old = cmdHeartbeatBtn.querySelector('.cmd-hb-badge');
  if (old) old.remove();
  if (n > 0) {
    const b = document.createElement('span');
    b.className = 'cmd-hb-badge';
    b.textContent = n > 9 ? '9+' : String(n);
    cmdHeartbeatBtn.appendChild(b);
  }
  try {
    await chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4e75df' });
  } catch (_) {}
}

const HB_CHIP = { 5: '5 分', 15: '15 分', 30: '30 分', 60: '1 小时', 120: '2 小时', 360: '6 小时', 720: '12 小时', 1440: '24 小时' };

/** everyMin → {n, unit}，供「自定义间隔」输入框回填 */
function splitEveryMin(min) {
  const m = Math.max(5, Number(min) || 30);
  if (m % 1440 === 0) return { n: m / 1440, unit: 'd' };
  if (m % 60 === 0) return { n: m / 60, unit: 'h' };
  return { n: m, unit: 'm' };
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** epoch → <input type="datetime-local"> 需要的本地时间字符串 */
function localInputValue(ts) {
  const d = new Date(Number(ts) || Date.now());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** epoch → <input type="date"> 需要的本地日期字符串 */
function dateInputValue(ts) {
  const d = new Date(Number(ts) || Date.now());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function hbFormHtml(task) {
  const s = normalizeSchedule(task || {});
  const mode = s.type === 'once' ? 'once'
    : s.type === 'weekly' ? 'weekly'
      : s.type === 'daily' ? 'daily' : 'interval';
  const everyMin = s.type === 'interval' ? s.everyMin : 30;
  const { n: customN, unit: customUnit } = splitEveryMin(everyMin);
  const time = (s.type === 'daily' || s.type === 'weekly') ? s.time : '09:00';
  const wd = new Set(s.type === 'weekly' ? (s.weekdays || []) : [1, 2, 3, 4, 5]);
  const at = s.type === 'once' ? localInputValue(s.at) : '';

  const chips = heartbeatPresets().map((p) => {
    const on = s.type === 'interval' && p.everyMin === everyMin ? ' on' : '';
    return `<button type="button" class="hb-chip${on}" data-every="${escAttr(p.every)}">${HB_CHIP[p.everyMin] || p.label}</button>`;
  }).join('');
  const wdBtns = WEEKDAY_LABEL.map((label, i) =>
    `<button type="button" class="hb-wd${wd.has(i) ? ' on' : ''}" data-wd="${i}">${label}</button>`).join('');
  const modeBtn = (key, label) => `<button type="button" class="hb-mode-btn${mode === key ? ' on' : ''}" data-mode="${key}">${label}</button>`;

  return `<div class="hb-card hb-form" data-edit="${escAttr(task ? task.id : 'new')}" data-mode="${mode}">
    <label>名称</label><input type="text" class="hb-name" value="${escAttr(task ? task.name : '')}" placeholder="早报巡检">
    <label>到期后做什么</label><textarea class="hb-prompt" placeholder="列出今天订阅里的重要条目并摘要">${escHtml(task ? task.prompt : '')}</textarea>
    <label>时间</label>
    <div class="hb-cadence">
      <div class="hb-mode" role="tablist">
        ${modeBtn('interval', '每隔')}${modeBtn('daily', '每天')}${modeBtn('weekly', '每周')}${modeBtn('once', '一次')}
      </div>
      <div class="hb-interval-row"${mode === 'interval' ? '' : ' hidden'}>
        ${chips}
        <div class="hb-custom">
          <span>每</span>
          <input type="number" class="hb-num" min="1" max="999" value="${escAttr(customN)}" aria-label="间隔数值">
          <select class="hb-unit" aria-label="间隔单位">
            <option value="m"${customUnit === 'm' ? ' selected' : ''}>分钟</option>
            <option value="h"${customUnit === 'h' ? ' selected' : ''}>小时</option>
            <option value="d"${customUnit === 'd' ? ' selected' : ''}>天</option>
          </select>
        </div>
      </div>
      <div class="hb-daily-row"${mode === 'daily' ? '' : ' hidden'}>
        <input type="time" class="hb-time" value="${escAttr(time)}" step="60" aria-label="每天触发时间">
      </div>
      <div class="hb-weekly-row"${mode === 'weekly' ? '' : ' hidden'}>
        <div class="hb-wds">${wdBtns}</div>
        <input type="time" class="hb-time-w" value="${escAttr(time)}" step="60" aria-label="每周触发时间">
      </div>
      <div class="hb-once-row"${mode === 'once' ? '' : ' hidden'}>
        <input type="datetime-local" class="hb-at" value="${escAttr(at)}" aria-label="一次性触发时刻">
      </div>
      <div class="hb-until-row"${mode === 'once' ? ' hidden' : ''}>
        <label>截止（可选）</label>
        <input type="date" class="hb-until" value="${escAttr(s.until ? dateInputValue(s.until) : '')}" aria-label="截止日期">
      </div>
    </div>
    <div class="hb-form-actions">
      <button type="button" class="hb-text-btn hb-cancel">取消</button>
      <button type="button" class="hb-text-btn hb-save">保存</button>
    </div>
  </div>`;
}

async function renderHeartbeatList() {
  if (!heartbeatListEl) return;
  const tasks = await listHeartbeatTasks(currentProject);
  if (!tasks.length && heartbeatEditingId !== 'new') {
    heartbeatListEl.innerHTML = '<p class="hb-empty">还没有心跳任务。让 AI「每 30 分钟巡检订阅」，或点新建。</p>';
    return;
  }
  const cards = tasks.map((t) => {
    if (heartbeatEditingId === t.id) return hbFormHtml(t);
    const st = t.lastStatus === 'running' ? '执行中' : (t.queued ? '排队等待侧栏' : formatNextRun(t.nextRunAt));
    return `<div class="hb-card" data-id="${escAttr(t.id)}">
      <div class="hb-card-top">
        <button type="button" class="hb-toggle${t.enabled !== false ? ' on' : ''}" data-act="toggle" title="启用/暂停"></button>
        <div style="min-width:0;flex:1">
          <div class="hb-card-name">${escHtml(t.name)}</div>
          <div class="hb-card-meta">${escHtml(formatCadence(t))} · ${escHtml(st || '')}</div>
        </div>
        <div class="hb-card-actions">
          <button type="button" class="hb-icon-btn" data-act="edit" title="编辑">✎</button>
          <button type="button" class="hb-icon-btn danger" data-act="del" title="删除">✕</button>
        </div>
      </div>
      <div class="hb-card-prompt">${escHtml(t.prompt || '')}</div>
    </div>`;
  }).join('');
  heartbeatListEl.innerHTML = (heartbeatEditingId === 'new' ? hbFormHtml(null) : '') + cards;
}

heartbeatListEl?.addEventListener('click', async (e) => {
  const form = e.target.closest('.hb-form');
  const modeBtn = e.target.closest('.hb-mode-btn');
  const chip = e.target.closest('.hb-chip');
  if (form && modeBtn) {
    const mode = modeBtn.dataset.mode;
    form.dataset.mode = mode;
    form.querySelectorAll('.hb-mode-btn').forEach((b) => b.classList.toggle('on', b === modeBtn));
    for (const key of ['interval', 'daily', 'weekly', 'once']) {
      const row = form.querySelector(`.hb-${key}-row`);
      if (row) row.hidden = key !== mode;
    }
    const untilRow = form.querySelector('.hb-until-row');
    if (untilRow) untilRow.hidden = mode === 'once';
    return;
  }
  if (form && chip) {
    const parsed = parseEvery(chip.dataset.every || '30m');
    const { n, unit } = splitEveryMin(parsed && parsed.everyMin ? parsed.everyMin : 30);
    const numEl = form.querySelector('.hb-num');
    const unitEl = form.querySelector('.hb-unit');
    if (numEl) numEl.value = n;
    if (unitEl) unitEl.value = unit;
    form.querySelectorAll('.hb-chip').forEach((c) => c.classList.toggle('on', c === chip));
    return;
  }
  const wdBtn = e.target.closest('.hb-wd');
  if (form && wdBtn) {
    wdBtn.classList.toggle('on');
    return;
  }
  const save = e.target.closest('.hb-save');
  const cancel = e.target.closest('.hb-cancel');
  const actBtn = e.target.closest('[data-act]');
  if (cancel) { heartbeatEditingId = null; renderHeartbeatList(); return; }
  if (save && form) {
    const name = form.querySelector('.hb-name')?.value.trim();
    const prompt = form.querySelector('.hb-prompt')?.value.trim();
    const mode = form.dataset.mode || 'interval';
    const fields = { id: form.dataset.edit === 'new' ? undefined : form.dataset.edit, name, prompt };
    if (mode === 'interval') {
      const n = Math.max(1, parseInt(form.querySelector('.hb-num')?.value, 10) || 30);
      fields.every = `${n}${form.querySelector('.hb-unit')?.value || 'm'}`;
    } else if (mode === 'daily') {
      fields.time = form.querySelector('.hb-time')?.value || '09:00';
    } else if (mode === 'weekly') {
      fields.time = form.querySelector('.hb-time-w')?.value || '09:00';
      fields.weekdays = [...form.querySelectorAll('.hb-wd.on')].map((b) => Number(b.dataset.wd));
    } else {
      fields.at = form.querySelector('.hb-at')?.value || '';
    }
    if (mode !== 'once') {
      const until = form.querySelector('.hb-until')?.value;
      if (until) fields.until = until; // 留空 = 不设截止（也用于清掉原有截止）
    }
    try {
      await upsertHeartbeatTask(fields, { projectId: currentProject, createdBy: 'user' });
      heartbeatEditingId = null;
      await renderHeartbeatList();
      refreshHeartbeatBadge();
    } catch (err) {
      showToast(err.message || '保存失败', true);
    }
    return;
  }
  if (!actBtn) return;
  const card = actBtn.closest('.hb-card');
  const id = card && card.dataset.id;
  if (!id) return;
  const act = actBtn.dataset.act;
  if (act === 'edit') { heartbeatEditingId = id; renderHeartbeatList(); return; }
  if (act === 'del') {
    await deleteHeartbeatTask(id);
    await renderHeartbeatList();
    refreshHeartbeatBadge();
    return;
  }
  if (act === 'toggle') {
    const tasks = await listHeartbeatTasks(currentProject);
    const t = tasks.find((x) => x.id === id);
    await upsertHeartbeatTask({ id, enabled: !(t && t.enabled !== false) });
    await renderHeartbeatList();
    refreshHeartbeatBadge();
  }
});

let activeHeartbeatTaskId = null;
let drainingHeartbeat = false;

async function drainRun(run) {
  if (!run || run.discarded || run.inProgress || run.draining) return;
  if (run.pendingFollowups.length) {
    const text = run.pendingFollowups.shift();
    if (viewing(run)) pendingSubagentFollowups = run.pendingFollowups;
    sendChatMessage(text, { subagentFollowup: true, attachments: [], run });
    return;
  }
  const queued = await queuedHeartbeatTasks(run.pid);
  const due = (await dueHeartbeatTasks()).filter((t) => taskBelongsToProject(t, run.pid));
  const dueNow = queued[0] || due[0];
  if (!dueNow) {
    if (viewing(run)) refreshHeartbeatBadge();
    return;
  }
  if (run.inProgress) return;
  run.draining = true;
  if (viewing(run)) drainingHeartbeat = true;
  try {
    await runHeartbeatTask(dueNow, run);
  } finally {
    run.draining = false;
    if (viewing(run)) drainingHeartbeat = false;
  }
}

async function drainHeartbeatQueue() {
  return drainRun(ensureRun(currentProject));
}

async function runHeartbeatTask(task, run = ensureRun(task.projectId || currentProject)) {
  if (run.inProgress || run.discarded) return false;
  if (!run.loaded) await loadChatSession(run.pid);
  run.heartbeatTaskId = task.id;
  if (viewing(run)) activeHeartbeatTaskId = task.id;
  await markHeartbeatRunning(task.id);
  if (viewing(run)) {
    await renderHeartbeatList();
    refreshHeartbeatBadge();
  }
  sendChatMessage(heartbeatUserText(task), {
    heartbeat: true,
    heartbeatName: task.name,
    heartbeatTaskId: task.id,
    attachments: [],
    run,
  });
  return true;
}

async function closeHeartbeatTurn(ok, error, run) {
  const id = run ? run.heartbeatTaskId : activeHeartbeatTaskId;
  if (run) run.heartbeatTaskId = null;
  if (!run || viewing(run)) activeHeartbeatTaskId = null;
  if (id) {
    await markHeartbeatFinished(id, { ok, error });
    workspaceApi?.refresh().catch(() => {});
    if (!run || viewing(run)) {
      renderHeartbeatList();
      refreshHeartbeatBadge();
    }
  }
}

chrome.runtime.onMessage.addListener((message, _s, sendResponse) => {
  if (!message || message.type !== 'HEARTBEAT_FIRE') return;
  const task = message.task;
  if (!task) {
    sendResponse({ taken: false });
    return;
  }
  const run = ensureRun(task.projectId);
  if (run.inProgress || run.discarded) {
    sendResponse({ taken: false });
    return;
  }
  sendResponse({ taken: true });
  runHeartbeatTask(task, run);
});

// Update button icon when input changes
cmdInput?.addEventListener('input', () => {
  autoResizeInput();
  updateSendButton();
  refreshMentionMenu();
});
cmdInput?.addEventListener('blur', () => {
  setTimeout(hideMentionMenu, 120);
});

// 排队待发气泡：渲染到消息列表末尾，带取消按钮
function appendQueuedBubble(id, text) {
  if (!chatMessagesEl) return;
  const div = document.createElement('div');
  div.className = 'chat-msg user queued';
  div.dataset.queueId = id;
  div.innerHTML = `${escHtml(text)}<button class="queue-cancel-btn" title="取消发送" aria-label="取消发送">✕</button>`;
  chatMessagesEl.appendChild(div);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

async function closeChatOpenedTabs(run) {
  const owner = run && run.pid ? `chat:${run.pid}` : 'chat';
  try {
    await chrome.runtime.sendMessage({
      type: 'CLOSE_AI_TABS',
      data: { owner, tabIds: [] },
    });
  } catch (_) {}
}

function stopChat() {
  stopRun(ensureRun(currentProject));
}

function handleUserSend(text) {
  if (!text && pendingAttachments.length) {
    text = pendingAttachments.some((a) => a.kind === 'image') ? '请看这张图' : '请看我上传的文件';
  }
  if (!text) return;
  if (chatInProgress) {
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    chatQueue.push({ id, text });
    appendQueuedBubble(id, text);
    return;
  }
  sendChatMessage(text);
}

async function sendChatMessage(text, opts = {}) {
  const run = opts.run || ensureRun(currentProject);
  if (run.discarded) return;
  if (!run.loaded) await loadChatSession(run.pid);
  if (run.discarded) return;
  if (run.pid === currentProject) adoptVisible(run);
  run.entries = await getEntries(run.pid);
  if (viewing(run)) entries = run.entries;
  if (!run.selectedIds) run.selectedIds = new Set();

  run.pendingSuggestions = null;
  run.pendingScopeQuiz = null;
  run.pendingCharts = [];
  run.pendingImages = [];
  if (viewing(run)) {
    pendingSuggestions = null;
    pendingScopeQuiz = null;
    pendingCharts = [];
    pendingImages = [];
    settleOpenScopeQuizzes();
  } else {
    for (const m of run.messages) {
      if (!m.scopeQuiz || m.scopeQuiz.locked) continue;
      m.scopeQuiz.skipped = true;
      m.scopeQuiz.locked = true;
    }
  }
  const turnAttachments = opts.attachments
    ? opts.attachments
    : (viewing(run) ? pendingAttachments.splice(0, pendingAttachments.length) : []);
  if (viewing(run)) renderAttachChips();
  run.pendingUserText = text;
  run.turnMeta = {
    heartbeatName: opts.heartbeatName || '',
    subagentFollowup: !!opts.subagentFollowup,
  };
  run.liveTurnText = '';
  run.lastLiveMeterAt = 0;
  if (viewing(run)) {
    pendingUserText = text;
    liveTurnText = '';
    lastLiveMeterAt = 0;
  }
  addChatBubble('user', text, {
    heartbeat: !!opts.heartbeat,
    heartbeatName: opts.heartbeatName || '',
    subagentFollowup: !!opts.subagentFollowup,
    attachments: turnAttachments.map((a) => ({
      kind: a.kind, name: a.name, previewUrl: a.previewUrl, entryId: a.entryId, format: a.format,
    })),
  }, run);
  if (opts.heartbeatTaskId) {
    run.heartbeatTaskId = opts.heartbeatTaskId;
    if (viewing(run)) activeHeartbeatTaskId = opts.heartbeatTaskId;
  }

  const config = await getProjectConfig(run.pid);
  if (run.discarded) return;
  if (!config.apiKey) {
    const msg = '请先在设置页面配置 AI API。点击右上角齿轮图标进入设置。';
    run.pendingUserText = '';
    run.liveTurnText = '';
    run.history.push({ role: 'assistant', content: msg });
    addChatBubble('ai', msg, {}, run);
    mirrorScalars(run);
    await closeHeartbeatTurn(false, '未配置 API', run);
    return;
  }
  const apiCfg = {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    protocol: config.protocol || 'openai',
    contextTokens: config.contextTokens,
    effort: config.effort || '',
  };
  const ctx = makeRunCtx(run);
  ctx.apiConfig = apiCfg;
  if (viewing(run)) toolCtx.apiConfig = apiCfg;
  run.abort = new AbortController();
  const { signal } = run.abort;
  ctx.subagentParentSignal = signal;
  run.turnSpawned = new Set();
  if (viewing(run)) {
    chatAbortController = run.abort;
    turnSpawnedSubagents = run.turnSpawned;
  }
  setRunActive(run, true);
  const chatTools = buildChatTools(await getAgentListCached(), await getSubagentLimits().catch(() => ({})));

  // Build request. History compaction is deferred until AFTER the response so
  // this turn is not blocked; the next turn will benefit from the shrunken
  // history. See scheduleBackgroundCompaction() below.
  let messages;
  try {
    messages = await buildMessagesForApi(text, turnAttachments, run);
  } catch (err) {
    const msg = `请求准备失败: ${err.message || '无法构建上下文'}。`;
    run.pendingUserText = '';
    run.liveTurnText = '';
    run.history.push({ role: 'assistant', content: msg });
    addChatBubble('ai', msg, {}, run);
    mirrorScalars(run);
    await saveChatSession(run.pid);
    await closeHeartbeatTurn(false, err && err.message, run);
    await continueAfterTurn(run);
    return;
  }
  ctx.currentTabInfo = run.tabInfo || '';
  if (run.discarded) {
    setRunActive(run, false);
    return;
  }
  const turnStart = messages.length; // 本轮消息追加起点（溢出恢复时用 slice 保留本轮全文）

  let bubbleEl = null;
  let fullText = '';
  let finalUsage = null;
  let turnUsageSum = 0; // 本轮所有 round 的真实 usage 求和（多轮工具调用会多次请求）
  let firstChunkReceived = false;
  run.toolUndos = [];
  if (viewing(run)) toolUndos = run.toolUndos;
  // 轮数口径统一来自 lib/limits.js（与 SW 浮动聊天同一来源，不再两边手抄）
  const MAX_ROUNDS = AGENT_MAX_ROUNDS;
  const WRAP_HINT_ROUND = AGENT_WRAP_HINT_ROUND;
  const turnMessages = []; // assistant+tool messages from this turn, saved to chatHistory after
  let overflowRecovered = false; // 上下文超限自动恢复只做一次，防死循环

  // Show thinking indicator immediately (before first API chunk arrives)
  bubbleEl = addChatBubble('ai', '', {}, run);
  if (bubbleEl && viewing(run)) {
    // 直播顺序：子代理卡片（顶）→ 主 agent 流式正文 → Thinking 行（底）
    bubbleEl.innerHTML =
      '<div class="chat-subagents"></div>' +
      '<div class="chat-stream-body"></div>' +
      '<div class="chat-ai-row"><span class="chat-thinking-orb"></span><span class="chat-thinking-text">Thinking</span></div>';
    mountThinkingOrb(bubbleEl.querySelector('.chat-thinking-orb'));
    run.bubbleEl = bubbleEl;
    run.thinkingTextEl = bubbleEl.querySelector('.chat-thinking-text');
    run.streamBodyEl = bubbleEl.querySelector('.chat-stream-body');
    run.activeAiBubbleEl = bubbleEl;
    thinkingTextEl = run.thinkingTextEl;
    streamBodyEl = run.streamBodyEl;
    activeAiBubbleEl = bubbleEl;
  }

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (signal.aborted || run.discarded) break;
      while (run.pendingFollowups.length) {
        const notice = run.pendingFollowups.shift();
        messages.push({ role: 'user', content: notice });
        turnMessages.push({ role: 'user', content: notice });
      }
      // 接近工具调用上限：注入收尾提示，引导模型用已有信息给最终回答（不进 turnMessages/历史）
      if (round === WRAP_HINT_ROUND) {
        messages.push({ role: 'system', content: '已接近工具调用次数上限。请基于已获取的信息尽快给出最终回答，仅在确有必要时再调用一次工具。' });
      }
      // 每轮复位：让本轮首 chunk 能清文字+设 orb。
      // 曾是整个 turn 一次（firstChunkReceived 不复位），导致多轮工具后流式正文期间
      // 文字卡在 "Thinking" 不清--用户看到"明明操作了 tools 还是 thinking"。
      firstChunkReceived = false;
      let result;
      try {
        result = await streamChatWithTools(
          messages, chatTools, apiCfg,
          (chunk) => {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              run.thinkingLabel = '';
              if (viewing(run)) {
                setOrbState('working');
                setThinkingText('');
              }
            }
            fullText += chunk;
            paintStream(run, fullText);
          },
          signal
        );
      } catch (err) {
        // 上下文超限自动恢复（仅一次）：压缩更早的历史，本轮 read 结果保持完整重试。
        // 不折叠/截断本轮工具结果（read 在源头已分页，AI 可用 offset 续拉）。
        if (!signal.aborted && !overflowRecovered && isContextOverflowError(err)) {
          overflowRecovered = true;
          const turnMsgs = messages.slice(turnStart); // 本轮已发生消息（含完整 read 结果）
          await compactChatHistoryIfNeeded(apiCfg, { force: true, run }).catch(() => {});
          const base = await buildMessagesForApi(text, [], run);
          messages.length = 0;
          messages.push(...base, ...turnMsgs);
          fullText = '';
          firstChunkReceived = false;
          paintStream(run, '');
          if (viewing(run)) showToast('上下文已压缩并重试');
          round--; // for 循环 continue 会自增，先减一保持轮次不变
          continue;
        }
        throw err;
      }

      if (result.usage) {
        finalUsage = result.usage;
        turnUsageSum += usageTotalTokens(result.usage);
      }

      // No tool calls - model is done
      if (result.toolCalls.length === 0) break;
      if (signal.aborted) break;

      // 一轮工具调用：骨架在 chat-executor.processRoundToolCalls（与 SW 浮动聊天共用），
      // 这里只注入侧栏的 UI 反馈（orb 动画 / shimmer 状态行）与写库后的界面刷新
      await processRoundToolCalls({
        result,
        apiMessages: messages,
        historyMessages: turnMessages,
        ctx,
        signal,
        minAcceptDelayMs: 600,
        hooks: {
          start: (label, name) => {
            paintThinking(run, `${label}…`);
            if (viewing(run) && run.bubbleEl && run.bubbleEl.isConnected) syncToolOrb(run.bubbleEl, name);
          },
          argError: (label) => {
            paintThinking(run, `⚠ ${label}`, true);
            if (viewing(run)) {
              unmountToolOrb();
              setOrbState('working');
            }
          },
          done: () => {
            paintThinking(run, 'Thinking');
            if (viewing(run)) {
              unmountToolOrb();
              setOrbState('working');
            }
          },
          fail: (label) => {
            paintThinking(run, `✗ ${label}`, true);
            if (viewing(run)) {
              unmountToolOrb();
              setOrbState('working');
            }
          },
          writeRefresh: async () => {
            run.entries = await getEntries(run.pid);
            if (viewing(run)) {
              entries = run.entries;
              render();
              renderProjects();
            }
          },
        },
      });

      // Show undo toast for this round
      if (run.toolUndos.length > 0 && viewing(run)) {
        const count = run.toolUndos.length;
        const undos = [...run.toolUndos];
        run.toolUndos = [];
        toolUndos = run.toolUndos;
        console.log(`[SuperCat] undo toast shown: ${count} 项可撤销`);
        showUndoToast(`已执行 ${count} 项操作`, async () => {
          console.log('[SuperCat] undo clicked, steps:', undos.length);
          let undoFailed = false;
          for (const fn of undos.reverse()) {
            try { await fn(); } catch (err) {
              undoFailed = true;
              console.error('undo step failed:', err);
            }
          }
          console.log('[SuperCat] undo steps done, refreshing...');
          try {
            const fresh = await getEntries(run.pid);
            run.entries = fresh;
            if (currentProject === run.pid) {
              entries = fresh;
              render();
              renderProjects();
            }
          } catch (err) {
            undoFailed = true;
            console.error('[SuperCat] undo refresh failed:', err);
          }
          if (undoFailed) showToast('撤销部分失败', true);
        });
      }
      if (run.pendingScopeQuiz) break;
    }

    if (run.discarded) return;
    if (signal.aborted) {
      const lastAbort = stampTurnSubagentsOnLastMsg(run);
      const keep = !!(fullText || (lastAbort && lastAbort.charts && lastAbort.charts.length) || (lastAbort && lastAbort.subagents && lastAbort.subagents.length));
      if (viewing(run) && keep && bubbleEl && bubbleEl.isConnected) {
        finalizeLiveAiBubble(bubbleEl, lastAbort, { fullText, interrupted: true });
      } else if (viewing(run) && bubbleEl && bubbleEl.parentNode) {
        unmountThinkingOrb();
        unmountToolOrb();
        thinkingTextEl = null;
        streamBodyEl = null;
        bubbleEl.remove();
      }
      run.history.push({ role: 'user', content: composeUserContent(text, turnAttachments) });
      for (const m of turnMessages) run.history.push(m);
      if (fullText) run.history.push({ role: 'assistant', content: fullText + '\n\n(已中断)' });
      run.totalUsedTokens += turnUsageSum;
      run.pendingUserText = '';
      run.liveTurnText = '';
      mirrorScalars(run);
      if (!run.discarded) await saveChatSession(run.pid);
      await closeHeartbeatTurn(false, '已中断', run);
      await continueAfterTurn(run);
      return;
    }
  } catch (err) {
    if (run.discarded) return;
    const aborted = err.name === 'AbortError' || signal.aborted;
    if (aborted) {
      const lastAbort = stampTurnSubagentsOnLastMsg(run);
      const keep = !!(fullText || (lastAbort && lastAbort.charts && lastAbort.charts.length) || (lastAbort && lastAbort.subagents && lastAbort.subagents.length));
      if (viewing(run) && keep && bubbleEl && bubbleEl.isConnected) {
        finalizeLiveAiBubble(bubbleEl, lastAbort, { fullText, interrupted: true });
      } else if (viewing(run) && bubbleEl && bubbleEl.parentNode) {
        unmountThinkingOrb();
        unmountToolOrb();
        thinkingTextEl = null;
        streamBodyEl = null;
        bubbleEl.remove();
      }
      run.totalUsedTokens += turnUsageSum;
      run.pendingUserText = '';
      run.liveTurnText = '';
      mirrorScalars(run);
    } else {
      if (viewing(run)) {
        unmountThinkingOrb();
        unmountToolOrb();
        thinkingTextEl = null;
        streamBodyEl = null;
      }
      run.cost = null;
      run.toolUndos = [];
      const msg = `请求失败: ${err.message || '网络错误'}。请检查网络连接和 API 地址。`;
      run.totalUsedTokens += turnUsageSum;
      run.pendingUserText = '';
      run.liveTurnText = '';
      if (viewing(run) && isImageUnsupportedError(err) && turnAttachments.some((a) => a.kind === 'image')) {
        showToast('当前模型不支持图片', true);
      }
      run.history.push({ role: 'assistant', content: msg });
      addChatBubble('ai', msg, {}, run);
      mirrorScalars(run);
      await saveChatSession(run.pid);
    }
    await closeHeartbeatTurn(!aborted, aborted ? '已中断' : (err && err.message), run);
    await continueAfterTurn(run);
    return;
  }

  if (run.discarded) return;
  // 等用户点范围卡 / 建议按钮时，即使模型没写正文也要留下气泡挂卡，
  // 不能走「已执行操作」摘要（调研航升常见：search_web 后 ask_research_scope、无 stream 文本）。
  if (!fullText && !run.pendingScopeQuiz && !run.pendingSuggestions && !run.pendingCharts.length && !(run.pendingImages || []).length && !run.turnSpawned.size) {
    if (viewing(run)) {
      unmountThinkingOrb();
      unmountToolOrb();
      thinkingTextEl = null;
      streamBodyEl = null;
      if (bubbleEl && bubbleEl.parentNode) bubbleEl.remove();
    }
    if (turnMessages.length > 0) {
      const toolNames = turnMessages
        .filter((m) => m.role === 'assistant' && m.tool_calls)
        .flatMap((m) => m.tool_calls.map((tc) => tc.function.name));
      const summary = `已执行操作：${toolNames.join('、')}。`;
      run.history.push({ role: 'user', content: composeUserContent(text, turnAttachments) });
      for (const m of turnMessages) run.history.push(m);
      run.history.push({ role: 'assistant', content: summary });
      addChatBubble('ai', summary, {}, run);
    } else {
      const reason = 'AI 未返回内容，请检查模型配置或稍后重试。';
      run.history.push({ role: 'assistant', content: reason });
      addChatBubble('ai', reason, {}, run);
    }
    stampTurnSubagentsOnLastMsg(run);
    mirrorScalars(run);
    await saveChatSession(run.pid);
    await closeHeartbeatTurn(false, 'empty', run);
    await continueAfterTurn(run);
    return;
  }

  run.cost = formatTokens(finalUsage);
  run.history.push({ role: 'user', content: composeUserContent(text, turnAttachments) });
  for (const m of turnMessages) run.history.push(m);
  run.history.push({ role: 'assistant', content: fullText });

  const toolCallCount = turnMessages.filter((m) => m.role === 'tool').length;
  if (toolCallCount >= 3 && !run.pendingScopeQuiz && !run.pendingSuggestions) {
    run.history.push({ role: 'user', content: `【系统提示】上一轮任务涉及 ${toolCallCount} 次工具调用。如有值得记住的经验（成功的方法选择器、失败的教训、站点特定技巧、用户偏好），调用 save_memory(domain, lesson, tags) 保存。无值得记住的经验则忽略此提示，直接回应用户的下一条消息。` });
  }

  run.totalUsedTokens += turnUsageSum;
  run.pendingUserText = '';
  run.liveTurnText = '';
  mirrorScalars(run);
  if (viewing(run)) updateTokenMeter();

  scheduleBackgroundCompaction(apiCfg, run);

  const lastMsg = run.messages[run.messages.length - 1];
  if (lastMsg && lastMsg.role === 'ai') {
    lastMsg.text = fullText;
    lastMsg.subagents = snapshotTurnSubagents(run);
    if (run.pendingSuggestions) {
      lastMsg.suggestions = run.pendingSuggestions;
      run.pendingSuggestions = null;
    }
    if (run.pendingScopeQuiz) {
      lastMsg.scopeQuiz = run.pendingScopeQuiz;
      run.pendingScopeQuiz = null;
    }
    stampPendingChartsOn(lastMsg, run);
    stampPendingImagesOn(lastMsg, run);
  }
  run.activeAiBubbleEl = null;
  if (viewing(run)) activeAiBubbleEl = null;
  if (viewing(run) && bubbleEl && bubbleEl.isConnected) {
    finalizeLiveAiBubble(bubbleEl, lastMsg, { fullText });
    const chips = (lastMsg?.suggestions?.actions?.length > 0)
      ? renderSuggestionChips(lastMsg.suggestions) : '';
    const quizHost = lastMsg?.scopeQuiz ? '<div class="scope-quiz-host"></div>' : '';
    if (chips || quizHost) {
      requestAnimationFrame(() => {
        if (bubbleEl.isConnected) bubbleEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
      });
    }
  }

  if (!run.discarded) await saveChatSession(run.pid);
  await closeHeartbeatTurn(true, '', run);
  await continueAfterTurn(run);
}

function formatTokens(usage) {
  if (!usage) return null;
  const total = usageTotalTokens(usage);
  // Cache hit token field varies by provider:
  //   OpenAI / 智谱 GLM       → usage.prompt_tokens_details.cached_tokens
  //   DeepSeek                → usage.prompt_cache_hit_tokens
  //   Anthropic-compat        → usage.cache_read_input_tokens
  const cached =
    usage.prompt_tokens_details?.cached_tokens ||
    usage.prompt_cache_hit_tokens ||
    usage.cache_read_input_tokens ||
    0;
  if (cached > 0) {
    const pct = usage.prompt_tokens ? Math.round((cached / usage.prompt_tokens) * 100) : 0;
    return `${total} tokens · 缓存 ${cached}（${pct}%）`;
  }
  return `${total} tokens`;
}

/* ---- AI 对话 Token 计数徽章（chat-header 右上蓝色药丸，苹果式数字滚动） ---- */

/** 累计消耗口径：全部 agent 的 API 真实 usage 求和打底；流式期间主对话用估算预览，回合结束用真实值校准 */
function computeChatTokens() {
  return totalUsedTokens
    + (pendingUserText ? estimateTokens(pendingUserText) + 4 : 0)
    + (liveTurnText ? estimateTokens(liveTurnText) : 0);
}

function updateTokenMeter(quick = false) {
  const numEl = document.querySelector('#chatTokenMeter .ctm-num');
  if (!numEl) return;
  const t = computeChatTokens();
  try {
    // 流式期间用快节奏滚动，回合结束等离散事件用默认节奏
    rollNumber(numEl, lastTokenCount, t, quick ? { duration: 220, stagger: 6 } : {});
  } catch (_) {
    numEl.textContent = t.toLocaleString('en-US');
  }
  lastTokenCount = t;
}

let nestedUsageSaveTimer = 0;
toolCtx.onUsage = (usage) => {
  const n = usageTotalTokens(usage);
  if (!n) return;
  totalUsedTokens += n;
  updateTokenMeter(true);
  if (chatInProgress) return;
  clearTimeout(nestedUsageSaveTimer);
  nestedUsageSaveTimer = setTimeout(() => { saveChatSession().catch(() => {}); }, 400);
};

let toolUndos = [];
let axSnapshotMap = new Map(); // n -> backendDOMNodeId (for ax_click)


let pendingCollect = null; // { url, title, content, textHash? } awaiting confirm_collect
let previewId = null;      // id of entry awaiting confirmation

function addChatBubble(role, text, extra = {}, run = null) {
  const msgs = run ? run.messages : chatMessages;
  msgs.push({ role, text, ...extra });
  if (run && !viewing(run)) return null;
  if (run) chatMessages = run.messages;
  renderChat();
  return chatMessagesEl ? chatMessagesEl.lastElementChild : null;
}

function renderMsgThumbs(atts) {
  if (!atts || !atts.length) return '';
  const imgs = atts.filter((a) => a.kind === 'image' && a.previewUrl)
    .map((a) => `<img src="${escAttr(a.previewUrl)}" alt="${escAttr(a.name || '')}">`).join('');
  const docs = atts.filter((a) => a.kind === 'doc')
    .map((a) => `<span class="cmd-chip"><span class="cmd-chip-file">${escHtml((a.format || 'DOC').toUpperCase().slice(0, 4))}</span><span class="cmd-chip-name">${escHtml(a.name || '')}</span></span>`).join('');
  if (!imgs && !docs) return '';
  return `<div class="user-thumbs">${imgs}${docs}</div>`;
}

function chatChartsHtml(msg) {
  if (!msg || !msg.charts || !msg.charts.length) return '';
  return `<div class="chat-live-charts">${chartHostHtml(msg.charts)}</div>`;
}

function chatDocEditsHtml(msg) {
  return docEditsListHtml(msg && msg.docEdits, 'chat');
}

function chatPlanHtml(msg) {
  if (!msg || !msg.plan) return '';
  return planCardHtml(msg.plan, 'chat');
}

function renderChat() {
  unmountThinkingOrb();
  unmountToolOrb();
  updateTokenMeter();
  if (chatMessages.length === 0) {
    if (chatMessagesEl) {
      disposeChatCharts(chatMessagesEl);
      chatMessagesEl.innerHTML = '';
    }
    if (chatQueue.length > 0) chatQueue.forEach((q) => appendQueuedBubble(q.id, q.text));
    return;
  }
  if (!chatMessagesEl) return;
  disposeChatCharts(chatMessagesEl);
  chatMessagesEl.innerHTML = chatMessages.map((m, i) => {
    const last = i === chatMessages.length - 1 ? ' chat-msg-anim' : '';
    if (m.role === 'divider') return `<div class="chat-divider-turn">${escHtml(m.text)}</div>`;
    const cost = (m.role === 'ai' && i === chatMessages.length - 1 && chatCost)
      ? `<div class="msg-cost">${chatCost}</div>` : '';
    if (m.role === 'user') {
      const hb = m.heartbeat ? `<div class="chat-hb-tag">心跳 · ${escHtml(m.heartbeatName || '定时任务')}</div>` : '';
      const sg = m.subagentFollowup ? `<div class="chat-hb-tag">后台任务完成</div>` : '';
      return `<div class="chat-msg user${m.heartbeat ? ' heartbeat' : ''}${m.subagentFollowup ? ' subagent-followup' : ''}${last}" data-msg-idx="${i}">${hb}${sg}${renderMsgThumbs(m.attachments)}${escHtml(m.text)}</div>`;
    }
    const text = chatTextWithImagesHtml(m);
    const chips = (m.suggestions && m.suggestions.actions && m.suggestions.actions.length > 0)
      ? renderSuggestionChips(m.suggestions) : '';
    const quizHost = m.scopeQuiz ? '<div class="scope-quiz-host"></div>' : '';
    const cards = subagentListHtml(m.subagents, 'chat');
    const body = m.flow === 'text-first' ? `${text}${cards}` : `${cards}${text}`;
    return `<div class="chat-msg ai${last}" data-msg-idx="${i}">${body}${chatChartsHtml(m)}${chatDocEditsHtml(m)}${chatPlanHtml(m)}${chips}${quizHost}${cost}</div>`;
  }).join('');
  if (chatQueue.length > 0) chatQueue.forEach((q) => appendQueuedBubble(q.id, q.text));
  if (chatMessagesEl) {
    bindSuggestionChips(chatMessagesEl);
    mountScopeQuizzes(chatMessagesEl);
    mountChatCharts(chatMessagesEl);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
}

cmdSendBtn.addEventListener('click', () => {
  const val = cmdInput.value.trim();
  if (chatInProgress) {
    if (val || pendingAttachments.length) {
      // AI is busy but user typed / attached something -> queue it
      cmdInput.value = '';
      autoResizeInput();
      handleUserSend(val);
    } else {
      // Input empty + AI busy -> stop
      stopChat();
    }
    return;
  }
  if (!val && !pendingAttachments.length) return;
  cmdInput.value = '';
  autoResizeInput();
  handleUserSend(val);
});

/* 侧栏 ↔ 整页。同一套界面只留一个：整页打开时关掉侧栏，回到侧栏时关掉整页。 */
let surfaceTabId = null;
let surfaceWindowId = null;

function paintSurfaceButton() {
  const btn = document.getElementById('surfaceToggleBtn');
  if (!btn) return;
  const page = surfaceTabId != null;
  const label = page ? '回到侧栏' : '在整页打开';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  document.body.classList.toggle('surface-page', page);
}

async function prepareSurface() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id && isAppPanelPage(tab.url)) {
      const listed = await chrome.tabs.query({ windowId: tab.windowId });
      if (listed.some((t) => t.id === tab.id)) {
        surfaceTabId = tab.id;
        surfaceWindowId = tab.windowId;
        document.body.classList.add('surface-page');
      }
    }
    if (surfaceWindowId == null) {
      const win = await chrome.windows.getCurrent();
      surfaceWindowId = win?.id ?? null;
    }
  } catch (_) {}
  paintSurfaceButton();
}

function bindSurfaceToggle() {
  const btn = document.getElementById('surfaceToggleBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (surfaceTabId != null) {
      const tabId = surfaceTabId;
      const windowId = surfaceWindowId;
      saveChatSession().catch(() => {});
      chrome.sidePanel.open({ windowId }).then(() => {
        chrome.tabs.remove(tabId).catch(() => {});
      }).catch((err) => {
        showToast(err?.message || '无法打开侧栏', true);
      });
      return;
    }
    const url = chrome.runtime.getURL('src/sidepanel/index.html');
    const windowId = surfaceWindowId;
    saveChatSession().finally(() => {
      chrome.tabs.query({ url }, (found) => {
        const closeSide = () => {
          if (windowId == null || !chrome.sidePanel?.close) return;
          chrome.sidePanel.close({ windowId }).catch(() => {});
        };
        if (found && found[0]) {
          chrome.tabs.update(found[0].id, { active: true }, () => {
            chrome.windows.update(found[0].windowId, { focused: true }, closeSide);
          });
          return;
        }
        chrome.tabs.create({ url, active: true }, closeSide);
      });
    });
  });
}
bindSurfaceToggle();

// 导出会话：完整 JSON（UI 气泡 + API 上下文含 tool_calls/工具结果/摘要/token），
// 用于回放排查"它当时看到什么、为什么那么做"
const chatExportBtn = document.getElementById('chatExportBtn');
if (chatExportBtn) {
  chatExportBtn.addEventListener('click', () => {
    if (!chatHistory.length && !chatMessages.length) {
      showToast('当前没有可导出的对话');
      return;
    }
    const dump = {
      app: 'SuperCat',
      schema: 'citecat-session/v1',
      project: currentProject,
      exportedAt: new Date().toISOString(),
      summary: chatHistorySummary,
      totalUsedTokens,
      uiMessages: chatMessages,
      apiHistory: chatHistory,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supercat-session-${currentProject}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

const cmdClearBtn = document.getElementById('cmdClearBtn');
if (cmdClearBtn) {
  cmdClearBtn.addEventListener('click', async () => {
    if (chatInProgress) stopChat();
    chatQueue = [];
    chatHistory = [];
    chatMessages = [];
    chatCost = null;
    chatUsage = null;
    chatDragged = false;
    lastEntrySnapshot = '';
    lastSelectionSnapshot = '';
    lastProjectSnapshot = '';
    contextDeltaInitialized = false;
    chatHistorySummary = '';
    totalUsedTokens = 0;
    pendingUserText = '';
    liveTurnText = '';
    clearChatSession(); // 落盘会话一并清掉，重开面板不再恢复
    clearPlan(currentProject).catch(() => {}); // 清单与对话同生共死，避免残留旧计划污染前言
    adoptVisible(ensureRun(currentProject));
    updateTokenMeter();
    if (chatMessagesEl) chatMessagesEl.innerHTML = '';
    if (cmdInput) { cmdInput.value = ''; autoResizeInput(); }
    updateSendButton();
    render();
  });
}

// 排队气泡取消按钮：事件委托
chatMessagesEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('.queue-cancel-btn');
  if (!btn) return;
  const bubble = btn.closest('.chat-msg.queued');
  if (!bubble) return;
  const id = bubble.dataset.queueId;
  chatQueue = chatQueue.filter(q => q.id !== id);
  bubble.remove();
});

// 输入框随内容增高。先把高度收到 0 再量 scrollHeight，避免 max-height / flex 把测量值卡住。
// 外层卡片在列底部，消息区 min-height:0 让位，所以多出来的高度向上长。
function autoResizeInput() {
  if (!cmdInput) return;
  const messages = chatMessagesEl;
  const stickToBottom = !!messages
    && (messages.scrollHeight - messages.scrollTop - messages.clientHeight) < 48;
  const cap = parseFloat(getComputedStyle(cmdInput).maxHeight);
  const max = Number.isFinite(cap) ? cap : 200;
  cmdInput.style.height = '0px';
  const next = Math.min(max, cmdInput.scrollHeight);
  cmdInput.style.height = next + 'px';
  if (stickToBottom) messages.scrollTop = messages.scrollHeight;
}

function hideMentionMenu() {
  const menu = document.getElementById('cmdMentionMenu');
  if (menu) menu.hidden = true;
}

function mentionQueryAtCursor(value, pos) {
  const left = String(value || '').slice(0, pos);
  const m = /(?:^|\s)@([a-z0-9-]*)$/i.exec(left);
  return m ? m[1].toLowerCase() : null;
}

function applyMention(name) {
  if (!cmdInput || !name) return;
  const pos = cmdInput.selectionStart || cmdInput.value.length;
  const q = mentionQueryAtCursor(cmdInput.value, pos);
  if (q == null) return;
  const start = pos - q.length - 1;
  cmdInput.value = cmdInput.value.slice(0, start) + '@' + name + ' ' + cmdInput.value.slice(pos);
  const nextPos = start + name.length + 2;
  cmdInput.setSelectionRange(nextPos, nextPos);
  hideMentionMenu();
  autoResizeInput();
  updateSendButton();
  cmdInput.focus();
}

async function refreshMentionMenu() {
  const menu = document.getElementById('cmdMentionMenu');
  if (!menu || !cmdInput) return;
  const q = mentionQueryAtCursor(cmdInput.value, cmdInput.selectionStart || cmdInput.value.length);
  if (q == null) { hideMentionMenu(); return; }
  const agents = await getAgentListCached();
  const hits = agents.filter((a) => a.name.startsWith(q) || (a.description || '').toLowerCase().includes(q));
  if (!hits.length) { hideMentionMenu(); return; }
  menu.innerHTML = hits.slice(0, 8).map((a, i) =>
    `<button type="button" class="cmd-mention-item${i === 0 ? ' on' : ''}" data-name="${escAttr(a.name)}"><strong>@${escHtml(a.name)}</strong><span>${escHtml((a.description || '').slice(0, 48))}</span></button>`
  ).join('');
  menu.hidden = false;
  menu.querySelectorAll('.cmd-mention-item').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); applyMention(btn.dataset.name); });
  });
}

cmdInput.addEventListener('keydown', (e) => {
  const menu = document.getElementById('cmdMentionMenu');
  if (menu && !menu.hidden && (e.key === 'Escape' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
    if (e.key === 'Escape') { hideMentionMenu(); e.preventDefault(); return; }
    const items = [...menu.querySelectorAll('.cmd-mention-item')];
    const cur = items.findIndex((el) => el.classList.contains('on'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? (cur + 1) % Math.max(items.length, 1) : (cur - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('on', i === next));
      return;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && items.length) {
      e.preventDefault();
      const pick = items[cur >= 0 ? cur : 0];
      if (pick) applyMention(pick.dataset.name);
      return;
    }
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    cmdSendBtn.click();
  }
  // Shift+Enter 不拦截，textarea 自然换行
});

init();
bootColorScheme();

/* ---------------------------------------------------------------
   UI scaling for different display densities
   --------------------------------------------------------------- */

const UI_SCALE_KEY = 'uiScale';
const UI_SCALE_LOCAL_KEY = 'citecatUiScale';
const UI_SCALE_STEPS = ['0.25', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.85', '0.9', '0.95', '1', '1.05', '1.1', '1.15', '1.2', '1.3', '1.4', '1.5'];

function normalizeUiScaleMode(v) {
  if (v === 'auto') return 'auto';
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return 'auto';
  const hit = UI_SCALE_STEPS.find((s) => Math.abs(parseFloat(s) - n) < 0.001);
  return hit || 'auto';
}

function autoUiScale() {
  const dpr = window.devicePixelRatio || 1;
  const w = screen.width || 1920;
  if (dpr >= 1.9 && w >= 2400) return 0.95;
  if (dpr >= 1.4) return 0.92;
  if (dpr >= 1.2) return 0.95;
  if (dpr <= 1.05 && w >= 2400) return 1.30;
  if (dpr <= 1.05 && w >= 1900) return 1.05;
  return 1.0;
}

function resolveUiScale(mode) {
  if (mode === 'auto') return autoUiScale();
  const n = parseFloat(mode);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function writeUiScaleLocal(mode) {
  try { localStorage.setItem(UI_SCALE_LOCAL_KEY, mode); } catch (_) {}
}

async function getStoredUiScale() {
  try {
    const r = await chrome.storage.local.get(UI_SCALE_KEY);
    if (r && r[UI_SCALE_KEY] != null && r[UI_SCALE_KEY] !== '') return normalizeUiScaleMode(r[UI_SCALE_KEY]);
  } catch (_) {}
  try {
    const local = localStorage.getItem(UI_SCALE_LOCAL_KEY);
    if (local) return normalizeUiScaleMode(local);
  } catch (_) {}
  return 'auto';
}

function syncUiScaleSelect(mode) {
  const scaleEl = document.getElementById('uiScaleSelect');
  if (scaleEl && scaleEl.value !== mode) scaleEl.value = mode;
}

let uiScaleToastTimer = 0;
function flashUiScale(text) {
  let el = document.getElementById('uiScaleToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'uiScaleToast';
    el.className = 'ui-scale-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(uiScaleToastTimer);
  uiScaleToastTimer = setTimeout(() => el.classList.remove('show'), 700);
}

async function setUiScale(mode, { toast = false } = {}) {
  const stored = normalizeUiScaleMode(mode);
  writeUiScaleLocal(stored);
  try { await chrome.storage.local.set({ [UI_SCALE_KEY]: stored }); } catch (_) {}
  const scale = resolveUiScale(stored);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  syncUiScaleSelect(stored);
  if (toast) flashUiScale(stored === 'auto' ? '自动' : `${Math.round(scale * 100)}%`);
}

async function applyUiScale() {
  const mode = await getStoredUiScale();
  writeUiScaleLocal(mode);
  document.documentElement.style.setProperty('--ui-scale', String(resolveUiScale(mode)));
  syncUiScaleSelect(mode);
}

function stepUiScale(current, dir) {
  const n = Number(current);
  if (dir > 0) {
    return UI_SCALE_STEPS.find((s) => parseFloat(s) > n + 0.001) || UI_SCALE_STEPS[UI_SCALE_STEPS.length - 1];
  }
  let prev = UI_SCALE_STEPS[0];
  for (const s of UI_SCALE_STEPS) {
    if (parseFloat(s) < n - 0.001) prev = s;
  }
  return prev;
}

function bindUiScaleKeys() {
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    let action = null;
    if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') action = 'reset';
    else if (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') action = 'in';
    else if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') action = 'out';
    if (!action) return;
    if (action === 'reset' && e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'reset') {
      setUiScale('1', { toast: true });
      return;
    }
    setUiScale(stepUiScale(getUiZoom(), action === 'in' ? 1 : -1), { toast: true });
  }, true);
}

applyUiScale();
bindUiScaleKeys();

let colorSchemeMode = 'auto';

async function bootColorScheme() {
  colorSchemeMode = await loadThemeMode();
  applyDocumentTheme(colorSchemeMode);
  const themeEl = document.getElementById('colorSchemeSelect');
  if (themeEl) themeEl.value = colorSchemeMode;
  watchSystemTheme(() => colorSchemeMode, () => applyDocumentTheme('auto'));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[THEME_KEY]) return;
    colorSchemeMode = normalizeThemeMode(changes[THEME_KEY].newValue);
    applyDocumentTheme(colorSchemeMode);
    const el = document.getElementById('colorSchemeSelect');
    if (el && el.value !== colorSchemeMode) el.value = colorSchemeMode;
  });
}

function getUiZoom() {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));
  return Number.isFinite(z) && z > 0 ? z : 1;
}
/* ---------------------------------------------------------------
   Bottom tab-bar — user-resizable height
   --------------------------------------------------------------- */

const TAB_BAR_HEIGHT_KEY = 'tabBarHeight';
const TAB_BAR_MIN = 44;     // just enough to contain a 40px button
const TAB_BAR_MAX = 140;    // up to ~100px of extra breathing room
const TAB_BAR_DEFAULT = 60;

async function applyTabBarHeight() {
  let h = TAB_BAR_DEFAULT;
  try {
    const { [TAB_BAR_HEIGHT_KEY]: stored } = await chrome.storage.local.get(TAB_BAR_HEIGHT_KEY);
    if (stored && stored >= TAB_BAR_MIN && stored <= TAB_BAR_MAX) h = stored;
  } catch (_) {}
  document.documentElement.style.setProperty('--tab-bar-height', h + 'px');
}

function bindTabBarResizer() {
  const resizer = document.getElementById('tabBarResizer');
  const tabBar = document.getElementById('tabBar');
  if (!resizer || !tabBar) return;

  let dragging = false;
  let startY = 0;
  let startH = 0;

  resizer.addEventListener('mousedown', (e) => {
    dragging = true;
    startY = e.clientY;
    startH = tabBar.getBoundingClientRect().height;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    // Drag up → bigger; drag down → smaller
    const next = Math.max(TAB_BAR_MIN, Math.min(TAB_BAR_MAX, startH - (e.clientY - startY)));
    document.documentElement.style.setProperty('--tab-bar-height', next + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const h = Math.round(tabBar.getBoundingClientRect().height);
    chrome.storage.local.set({ [TAB_BAR_HEIGHT_KEY]: h }).catch(() => {});
  });

  // Double-click to reset
  resizer.addEventListener('dblclick', () => {
    document.documentElement.style.setProperty('--tab-bar-height', TAB_BAR_DEFAULT + 'px');
    chrome.storage.local.set({ [TAB_BAR_HEIGHT_KEY]: TAB_BAR_DEFAULT }).catch(() => {});
  });
}

applyTabBarHeight();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindTabBarResizer);
} else {
  bindTabBarResizer();
}

let _refreshScheduled = false;
async function refreshEntriesAndRender() {
  if (_refreshScheduled) return;
  _refreshScheduled = true;
  await Promise.resolve();
  _refreshScheduled = false;
  try {
    entries = await getEntries(currentProject);
    render();
  } catch (err) {
    // 刷新的任何异常都打日志：静默吞错会让"入库不显示/删除还在"无迹可查
    console.error('[SuperCat] refreshEntriesAndRender failed:', err);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'COLLECTION_STATUS_CHANGED') {
    refreshEntriesAndRender();
  }
});

// Chromium 已知问题：side panel 隐藏/不可见时 storage.onChanged 事件可能不
// 送达（重新可见后也不会补发），表现为"入库了前端不显示、删了还在，重开
// 侧边栏才正常"。面板重新可见时主动从 storage 重读兜底。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshEntriesAndRender();
    drainIdleWork();
    refreshHeartbeatBadge();
  }
});

// 终极刷新保障：**任何**上下文（AI 工具 / SW 采集 / 订阅入库 / 多窗口 sidepanel / 将来新功能）
// 写入了 entries_* storage，本窗口自动从 storage 重读刷新。
// refreshEntriesAndRender 有微任务防抖，批量写入只合并刷新一次；刷新是读操作，不会回写 storage，无循环。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const touched = Object.keys(changes).some((k) => k.startsWith('entries_'));
  if (touched) refreshEntriesAndRender();
  const workspaceTouched = Object.keys(changes).some((k) =>
    k.startsWith('notebook_'));
  if (workspaceTouched && workspaceApi) {
    workspaceApi.refresh().catch(() => {});
  }
  if (changes.heartbeatTasks) {
    renderHeartbeatList();
    refreshHeartbeatBadge();
  }
});

async function applyLicenseGate(view) {
  if (!view) {
    view = await chrome.runtime.sendMessage({ type: 'GET_LICENSE_STATE' }).catch(() => ({ ok: false }));
  }
  const ok = !!(view && view.ok);
  document.body.classList.remove('license-pending');
  document.body.classList.toggle('license-locked', !ok);
  document.body.classList.toggle('license-ok', ok);
  const gate = document.getElementById('licenseGate');
  if (gate) gate.hidden = ok;
  const statusEl = document.getElementById('licenseStatusLine');
  if (statusEl) {
    if (ok) {
      const exp = view.exp ? new Date(Number(view.exp) * 1000).toLocaleDateString() : '';
      const bits = ['已激活'];
      if (view.note) bits.push(view.note);
      if (exp) bits.push('有效至 ' + exp);
      statusEl.textContent = bits.join(' · ');
    } else {
      statusEl.textContent = (view && view.error) || '未激活';
    }
  }
}

function bindLicenseGate() {
  const btn = document.getElementById('licenseActivateBtn');
  const input = document.getElementById('licenseKeyInput');
  const gateStatus = document.getElementById('licenseGateStatus');
  const run = async () => {
    const key = (input?.value || '').trim();
    if (!key) {
      if (gateStatus) { gateStatus.textContent = '请输入授权码'; gateStatus.className = 'status-msg error'; }
      return;
    }
    if (btn) btn.disabled = true;
    if (gateStatus) { gateStatus.textContent = '激活中…'; gateStatus.className = 'status-msg'; }
    const resp = await chrome.runtime.sendMessage({
      type: 'ACTIVATE_LICENSE',
      data: { key },
    }).catch((err) => ({ ok: false, error: err.message }));
    if (btn) btn.disabled = false;
    if (resp && resp.ok) {
      if (input) input.value = '';
      if (gateStatus) { gateStatus.textContent = '已激活'; gateStatus.className = 'status-msg success'; }
      await applyLicenseGate(resp);
    } else {
      if (gateStatus) {
        gateStatus.textContent = (resp && resp.error) || '激活失败';
        gateStatus.className = 'status-msg error';
      }
    }
  };
  btn?.addEventListener('click', run);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'LICENSE_STATE_CHANGED') applyLicenseGate(message.data);
  });
}

bindLicenseGate();

async function init() {
  await prepareSurface();
  await applyLicenseGate().catch((err) => {
    console.warn('[SuperCat] license gate failed:', err);
    document.body.classList.remove('license-pending');
    document.body.classList.add('license-locked');
    const gate = document.getElementById('licenseGate');
    if (gate) gate.hidden = false;
  });
  await ensureWorkspaceMigration().catch((err) => {
    console.error('[SuperCat] workspace migration failed:', err);
  });
  await loadProjects();
  try {
    await initWorkspaceUi();
  } catch (err) {
    console.error('[SuperCat] workspace init failed:', err);
  }
  // 渠道系统初始化：首次运行把旧配置合成「默认」渠道；聊天头部触发按钮 + 弹出菜单
  try {
    await ensureDefaultChannel();
    refreshModelCatalog().catch(() => {});
    await refreshChatChannelSwitcher();
    const triggerBtn = document.getElementById('chatChannelSwitch');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 别让同一击把刚打开的菜单经外点关闭器又关掉
        toggleChatChannelMenu();
      });
      // 外点关闭 / Esc 关闭（全局只绑这一次）
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-channel-wrap')) closeChatChannelMenu();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeChatChannelMenu();
          if (heartbeatDrawer?.classList.contains('is-open')) setHeartbeatDrawerOpen(false);
        }
      });
    }
  } catch (err) { console.warn('[SuperCat] channel init failed:', err); }
  chrome.storage.local.remove(['visionConfig', 'visionProbeCache', 'visionProbeCacheVer']).catch(() => {});
  entries = await getEntries(currentProject);
  await loadChatSession(); // 恢复当前项目的对话（关面板/SW 重启不丢）
  adoptVisible(ensureRun(currentProject));
  render();
  updateTokenMeter();
  await ensureHeartbeatAlarm();
  refreshHeartbeatBadge();
  drainIdleWork();
}

function render() {
  workspaceApi?.refresh().catch((err) => console.error('[SuperCat] workspace refresh failed:', err));
  updateToolbar();
}

async function clearWorkspaceTrunk(trunk = 'all') {
  const clearSources = trunk === 'sources' || trunk === 'all';
  const clearOutputs = trunk === 'outputs' || trunk === 'all';
  const clearNotebook = trunk === 'notes' || trunk === 'all';
  const removed = entries.filter((entry) => {
    const type = inferEntryType(entry);
    return (clearSources && type === 'source') || (clearOutputs && type === 'output');
  });
  const keep = entries.filter((entry) => !removed.includes(entry));

  if (removed.length) {
    for (const entry of removed) {
      const docId = String(entry.docId || entry.id || '');
      if (docId) {
        const docUrl = `doc://lib/${docId}`;
        const annotations = await getAnnotationsForUrl(docUrl).catch(() => []);
        for (const annotation of annotations) await deleteAnnotation(docUrl, annotation.id).catch(() => {});
        await deleteDocFile(docId).catch(() => {});
      }
      if (!clearSources) {
        await deleteArtifactsMatching({
          projectId: currentProject,
          url: entry.url || '',
          docId,
          sourceEntryId: entry.id,
        }).catch(() => {});
      }
    }
    await saveEntryList(keep, currentProject);
  }
  if (clearSources) {
    await deleteArtifactsByProject(currentProject).catch(() => {});
    if (!clearNotebook) await revalidateNotes(currentProject);
  }
  if (clearNotebook) await clearNotes(currentProject);
  if (trunk === 'all') await clearPlan(currentProject).catch(() => {}); // 整库清空 = 连同任务清单

  selectedIds.clear();
  entries = await getEntries(currentProject);
  notifyCollectionStatusChanged({ refreshAll: true });
  render();
  await workspaceApi?.refresh();
}

/* ---- Undo delete toast ---- */

// 向 source URL 的所有标签页发送消息（snippet 删除/恢复联动）
// 向 source URL 的相关页面发送消息（snippet 删除/恢复联动）：
// ① 打开该 URL 的普通网页（content script）
// ② 文档阅读器标签页（扩展页，URL 参数里带文档地址）
async function notifySourceTabs(url, type, data) {
  try {
    const tabs = await chrome.tabs.query({ url });
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, { type, data }).catch(() => {});
    }
  } catch (_) {}
  try {
    const all = await chrome.tabs.query({});
    for (const t of all) {
      if (!t.url || !t.url.includes('/src/reader/index.html')) continue;
      try {
        const docUrl = new URL(t.url).searchParams.get('url');
        if (docUrl === url) {
          chrome.tabs.sendMessage(t.id, { type, data }).catch(() => {});
        }
      } catch (_) {}
    }
  } catch (_) {}
}

async function deleteWithUndo(entry) {
  // snippet 联动：源标注一并删除（快照留档，撤销时恢复），并通知原网页解包高亮
  let annSnapshot = null;
  if (entry.kind === 'snippet' && entry.annotationId && entry.url) {
    try {
      const list = await getAnnotationsForUrl(entry.url);
      annSnapshot = list.find((a) => a.id === entry.annotationId) || null;
      if (annSnapshot) await deleteAnnotation(entry.url, entry.annotationId);
    } catch (_) {}
    notifySourceTabs(entry.url, 'DELETE_ANNOTATION_MARK', { id: entry.annotationId });
  }
  const cascadeSnapshot = await deleteEntryCascade(entry, currentProject);
  if (cascadeSnapshot.error) {
    showToast(cascadeSnapshot.error, true);
    return;
  }
  notifyCollectionStatusChanged({ urls: [entry.url] });
  showUndoToast(`已删除`, async () => {
    await restoreEntryCascade(cascadeSnapshot);
    if (annSnapshot) {
      try { await saveAnnotation(entry.url, annSnapshot); } catch (_) {}
      notifySourceTabs(entry.url, 'REPLAY_ANNOTATIONS', {});
    }
    entries = await getEntries(currentProject);
    render();
    notifyCollectionStatusChanged({ urls: [entry.url] });
  });
}

function notifyCollectionStatusChanged({ urls = [], refreshAll = false } = {}) {
  chrome.runtime.sendMessage({
    type: 'BROADCAST_COLLECTION_STATUS',
    data: { urls: urls.filter(Boolean), refreshAll },
  }).catch(() => {});
}

function showUndoToast(msg, onUndo) {
  if (undoToast) {
    clearTimeout(pendingDelete);
    if (undoToast) { undoToast.remove(); undoToast = null; }
  }

  undoToast = document.createElement('div');
  undoToast.className = 'undo-toast';
  undoToast.setAttribute('role', 'status');
  undoToast.setAttribute('aria-live', 'polite');
  undoToast.innerHTML = `${escHtml(msg)} <button class="undo-btn">撤销</button>`;
  document.body.appendChild(undoToast);

  undoToast.querySelector('.undo-btn').addEventListener('click', async () => {
    clearTimeout(pendingDelete);
    undoToast.classList.add('fade-out');
    undoToast.addEventListener('animationend', () => { if (undoToast) { undoToast.remove(); undoToast = null; } });
    await onUndo();
  });

  pendingDelete = setTimeout(() => {
    if (undoToast) {
      undoToast.classList.add('fade-out');
      undoToast.addEventListener('animationend', () => { if (undoToast) { undoToast.remove(); undoToast = null; } });
      pendingDelete = null;
    }
  }, 4000);
}

function updateToolbar() {
  if (workspaceApi) {
    workspaceApi.updateToolbar();
    return;
  }
  const hasCompleted = entries.some((e) => e.status === 'completed');
  const hasSelected = selectedIds.size > 0;

  exportAllBtn.disabled = !hasCompleted;
  exportSelectedBtn.disabled = !hasSelected;
  clearAllBtn.disabled = entries.length === 0;
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function renderSuggestionChips(suggestions) {
  // Backward compat: old shape was a bare array; new shape is { actions, multiSelect, prompt }
  const opts = Array.isArray(suggestions)
    ? { actions: suggestions, multiSelect: false, prompt: '' }
    : (suggestions || { actions: [] });
  // 兼容字符串数组（模型偶发）：字符串 → {label, action, payload}
  const acts = (opts.actions || []).filter(Boolean).map((s) =>
    typeof s === 'string' ? { label: s, action: s, payload: '' } : s);
  if (acts.length === 0) return '';

  const multi = !!opts.multiSelect;
  const prompt = opts.prompt ? `<div class="suggestion-prompt">${escHtml(opts.prompt)}</div>` : '';
  const chips = acts.map((s, i) =>
    `<button class="suggestion-chip${multi ? ' multi' : ''}" style="animation-delay:${i * 0.06}s" data-action="${escAttr(s.action)}" data-payload="${escAttr(s.payload)}" data-label="${escAttr(s.label)}" title="${escAttr(s.action)}: ${escAttr(s.payload)}">${escHtml(s.label)}</button>`
  ).join('');
  const confirm = multi
    ? '<button class="suggestion-confirm" disabled>确认所选</button>'
    : '';
  return `<div class="suggestion-chips${multi ? ' multi-mode' : ''}" data-multi="${multi ? '1' : '0'}">${prompt}${chips}${confirm}</div>`;
}

function bindSuggestionChips(container) {
  if (!container) return;
  container.querySelectorAll('.suggestion-chips').forEach((group) => {
    const isMulti = group.dataset.multi === '1';
    const chips = group.querySelectorAll('.suggestion-chip');

    if (isMulti) {
      const confirmBtn = group.querySelector('.suggestion-confirm');
      const refreshConfirm = () => {
        const n = group.querySelectorAll('.suggestion-chip.selected').length;
        if (confirmBtn) {
          confirmBtn.disabled = n === 0;
          confirmBtn.textContent = n > 0 ? `确认 ${n} 项` : '确认所选';
        }
      };
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('selected');
          refreshConfirm();
        });
      });
      confirmBtn?.addEventListener('click', () => {
        const picked = [...group.querySelectorAll('.suggestion-chip.selected')]
          .map((c) => ({
            label: c.dataset.label || c.textContent || '',
            action: c.dataset.action || '',
            payload: c.dataset.payload || '',
          }));
        if (picked.length === 0) return;
        group.classList.add('dismissing');
        // Compose a single chat message representing all chosen actions
        const labels = picked.map((p) => p.label).join('、');
        const detail = picked.map((p) => `- ${p.label}（${p.action}: ${p.payload}）`).join('\n');
        const msg = `我选择了：${labels}\n${detail}`;
        if (cmdInput) { cmdInput.value = ''; autoResizeInput(); updateSendButton(); }
        handleUserSend(msg);
      });
      return;
    }

    // Single-select: click sends the button's label as a chat message
    chips.forEach((chip) => {
      chip.addEventListener('click', async () => {
        const label = chip.dataset.label || chip.textContent || '';
        group.classList.add('dismissing');
        if (cmdInput) { cmdInput.value = ''; autoResizeInput(); updateSendButton(); }
        handleUserSend(label);
      });
    });
  });
}

function settleOpenScopeQuizzes() {
  for (const m of chatMessages) {
    if (!m.scopeQuiz || m.scopeQuiz.locked) continue;
    m.scopeQuiz.skipped = true;
    m.scopeQuiz.locked = true;
  }
}

function mountScopeQuizzes(container) {
  if (!container) return;
  const bubbles = container.classList.contains('chat-msg')
    ? [container]
    : [...container.querySelectorAll('.chat-msg[data-msg-idx]')];
  bubbles.forEach((bubble) => {
    const idx = Number(bubble.dataset.msgIdx);
    const msg = Number.isFinite(idx) ? chatMessages[idx] : null;
    const quiz = (msg && msg.scopeQuiz) || (bubble === container ? chatMessages[chatMessages.length - 1]?.scopeQuiz : null);
    if (!quiz) return;
    let host = bubble.querySelector('.scope-quiz-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'scope-quiz-host';
      bubble.appendChild(host);
    }
    attachScopeQuiz(host, quiz, {
      onUpdate: () => { saveChatSession(); },
      onComplete: (text) => {
        handleUserSend(text);
      },
    });
  });
}

function renderChatText(s) {
  // 0. Strip SUGGEST lines
  s = s.replace(/^\s*\[SUGGES?T:.+$/gm, '');

  const ph = []; // placeholders for pre-built HTML snippets

  function hold(html) { ph.push(html); return `\x00${ph.length - 1}\x00`; }

  // Safe URL filter: only http/https/mailto protocols allowed, reject javascript: etc.
  const safeUrl = (url) => {
    const u = url.trim();
    if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
    // Fallback: strip dangerous protocols
    return u.replace(/^[^:]+:/, '') || '#';
  };

  // 1. Protect fenced code blocks
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    hold(`<pre><code>${escHtml(code.trim())}</code></pre>`)
  );

  // 2. Protect inline code
  s = s.replace(/`([^`\n]+)`/g, (_, code) =>
    hold(`<code>${escHtml(code)}</code>`)
  );

  // 3. Images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, alt, url) =>
    hold(`<img src="${safeUrl(url)}" alt="${escHtml(alt)}" class="chat-img" onerror="this.style.display='none'">`)
  );

  // 4. Named links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, text, url) =>
    hold(`<a href="${safeUrl(url)}" target="_blank" rel="noopener" class="chat-link">${escHtml(text)}</a>`)
  );

  // 5. Escape remaining HTML
  let html = escHtml(s);

  // 6. Bold **...** (before italic to avoid * conflicts)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 7. Italic *...*
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // 8. Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 9. Tables — must process before lists (pipes look like list markers)
  html = html.replace(/(^(\|.+\|)\n\|[-: |]+\|\n((?:\|.+\|\n?)+))/gm, (block, _1, headerRow, bodyRows) => {
    const thead = headerRow.split('|').filter(c => c.trim()).map(c =>
      `<th>${c.trim()}</th>`
    ).join('');
    const tbody = bodyRows.trim().split('\n').map(row =>
      '<tr>' + row.split('|').filter(c => c.trim()).map(c =>
        `<td>${c.trim()}</td>`
      ).join('') + '</tr>'
    ).join('');
    return hold(`<table class="chat-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`);
  });

  // 10. Nested lists (handles up to 2 levels of indentation)
  html = processLists(html);

  // 11. Blockquote >
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 12. Horizontal rule --- / ***
  html = html.replace(/^(?:---|\*\*\*)[-*\s]*$/gm, '<hr>');

  // 13. Paragraph breaks: collapse multiple newlines, wrap in <p>
  html = html.replace(/\n{2,}/g, '\n\n');
  // Split by double newlines, wrap each block that isn't already a block element
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap block-level elements in <p>
    if (/^<(?:h[1-6]|table|ul|ol|pre|blockquote|hr|div)[ >]/.test(trimmed)) return trimmed;
    // Single newlines within paragraph → <br>
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 14. Naked URLs → clickable links (skip already inside tags)
  html = html.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener" class="chat-link">$1</a>'
  );

  // 15. Restore placeholders
  html = html.replace(/\x00(\d+)\x00/g, (_, i) => ph[+i] || '');

  return html;
}

// Parse nested lists: up to 2 indent levels
function processLists(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Check if this line starts a list item
    const ulMatch = line.match(/^(\s*)[-*] (.+)/);
    const olMatch = line.match(/^(\s*)(\d+)\. (.+)/);
    const match = ulMatch || olMatch;
    if (!match) { result.push(line); i++; continue; }

    const indent = match[1].length;
    const isOL = !!olMatch;
    const items = [];
    let j = i;

    while (j < lines.length) {
      const l = lines[j];
      const um = l.match(/^(\s*)[-*] (.+)/);
      const om = l.match(/^(\s*)(\d+)\. (.+)/);
      const m = um || om;
      if (!m) {
        // Empty line or continuation — only break if it's truly a non-list line
        if (!l.trim()) { j++; continue; }
        if (m === null && /^\S/.test(l)) break;
        // Non-matching line — might be a continuation, append to last item
        if (items.length > 0) {
          items[items.length - 1].content += '\n' + l.trimStart();
        }
        j++; continue;
      }
      if (m[1].length !== indent) break; // different indent level → parent handles it
      const content = (um ? um[2] : om[3]);
      // Check for nested list on next line
      let nestedHTML = '';
      const nextLine = lines[j + 1];
      if (nextLine) {
        const nIndent = indent + 2;
        const num = nextLine.match(new RegExp(`^ {${nIndent}}[-*] `));
        const nol = nextLine.match(new RegExp(`^ {${nIndent}}\\d+\\. `));
        if (num || nol) {
          // Collect nested lines
          const nestedLines = [];
          let k = j + 1;
          while (k < lines.length) {
            const nl = lines[k];
            if (nl.match(new RegExp(`^ {${nIndent}}[-*] `)) || nl.match(new RegExp(`^ {${nIndent}}\\d+\\. `))) {
              nestedLines.push(nl.slice(nIndent));
            } else if (!nl.trim()) { break; }
            else break;
            k++;
          }
          if (nestedLines.length > 0) {
            nestedHTML = '<ul>' + nestedLines.map(nl =>
              `<li>${nl.replace(/^[-*] /, '').replace(/^\d+\. /, '')}</li>`
            ).join('') + '</ul>';
            j = k - 1; // will be incremented by j++ at end of loop
          }
        }
      }
      const tag = (um || om);
      items.push({ content: content + nestedHTML });
      j++;
    }

    const tag = isOL ? 'ol' : 'ul';
    result.push(`<${tag}>${items.map(it => `<li>${it.content}</li>`).join('')}</${tag}>`);
    i = j;
  }
  return result.join('\n');
}

function escAttr(s) {
  // String() 包裹：调用点会传数字（间隔数值、weekday 下标），非字符串没有 .replace
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatSourceTier(tier) {
  return ['high', 'medium', 'low'].includes(tier) ? tier : 'low';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* ---- Tab switching ---- */

let currentPanel = 0;
const panels = document.querySelectorAll('.panel');
const tabBtns = document.querySelectorAll('.tab-btn');

/* 底部 tab 滑动指示条：平滑跟随激活按钮（纯视觉，不影响切换逻辑） */
function updateTabSlider() {
  const slider = document.getElementById('tabSlider');
  const activeBtn = document.querySelector('.tab-btn.active');
  if (!slider || !activeBtn) return;
  const SLIDER_W = 40; // 与 style.css 的 .tab-slider 宽度一致
  const x = activeBtn.offsetLeft + (activeBtn.offsetWidth - SLIDER_W) / 2;
  slider.style.width = SLIDER_W + 'px';
  slider.style.transform = `translateX(${x}px)`;
}

// 侧栏宽度变化（拖动侧栏/窗口缩放/DevTools 开合）时按钮居中位置会变，
// 滑块必须重算，否则停在旧位置造成"对不齐"。rAF 节流合并多次触发。
let sliderRaf = 0;
function refreshSliderPosition() {
  cancelAnimationFrame(sliderRaf);
  sliderRaf = requestAnimationFrame(updateTabSlider);
}
// 侧边栏宽度自适应：不够宽只留对话（顶栏按钮切到工作区）；够宽才并排，再宽出预览。
// 已有栏的像素宽度粘住，多出来的宽度给最右一栏（对话有下限，用户可拖分割线改）。
const ratioObserved = document.getElementById('panelContainer');
const SIDEBAR_SPLIT_OPEN_W = 720;  // 达到才允许对话+工作区并排
const SIDEBAR_SPLIT_CLOSE_W = 640; // 缩到此宽度以下改回只显示对话 / 整页切换

function shouldUseCompact(panelW) {
  if (wsNarrow) return panelW < SIDEBAR_SPLIT_OPEN_W;
  return panelW < SIDEBAR_SPLIT_CLOSE_W;
}
const LIB_OPEN_LEFT = 220;
const LIB_CLOSE_LEFT = 140;
const PREV_MIN_W = 176;
const PREVIEW_SPLIT_W = 5;
const MIN_WORKSPACE_W = 200;
const CHAT_DIVIDER_W = 6;
let lastSideRatio = null;
let sideRatioReady = false;
let sideRatioRaf = 0;

function leftoverAfterChat(panelW) {
  return panelW - chatWidth - CHAT_DIVIDER_W;
}

function previewNeedLeft() {
  return (libraryWidth || MIN_WORKSPACE_W) + PREV_MIN_W + PREVIEW_SPLIT_W;
}

function markSideResizing() {
  if (!panelCollectEl) return;
  panelCollectEl.classList.add('is-side-resizing');
  clearTimeout(sideResizeQuiet);
  sideResizeQuiet = setTimeout(() => {
    panelCollectEl.classList.remove('is-side-resizing');
  }, 140);
}

function setPreviewCollapsed(collapsed) {
  previewCollapsed = !!collapsed;
  panelCollectEl?.classList.toggle('preview-collapsed', previewCollapsed);
  const preview = document.getElementById('wsPreview');
  if (preview && collapsed) {
    preview.style.flex = '';
    preview.style.maxWidth = '';
  }
}

function syncLayoutClasses(stage) {
  if (!panelCollectEl) return;
  panelCollectEl.classList.toggle('ws-stage-0', stage === 0);
  panelCollectEl.classList.toggle('ws-stage-1', stage === 1);
  panelCollectEl.classList.toggle('ws-stage-2', stage === 2);
  if (libraryWidth) panelCollectEl.style.setProperty('--ws-tree-w', libraryWidth + 'px');
}

function snapshotLibraryWidth(leftover, stage) {
  if (stage === 2) {
    return Math.max(MIN_WORKSPACE_W, leftover - PREV_MIN_W - PREVIEW_SPLIT_W);
  }
  return Math.max(MIN_WORKSPACE_W, leftover);
}

function applyStage(stage, { animate = false, persist = false, leftover = 0, panelW = 0 } = {}) {
  const prev = layoutStage;
  layoutStage = stage;
  const openingLib = prev === 0 && stage >= 1 && !libraryWidth;

  if (stage === 0) {
    libraryWidth = 0;
    setPreviewCollapsed(true);
    applyLibCollapsed(true, animate, persist);
    if (chatCol && panelW) chatCol.style.width = collapsedChatWidth(panelW) + 'px';
  } else {
    if (openingLib || (stage >= 1 && !libraryWidth)) {
      libraryWidth = snapshotLibraryWidth(leftover, stage);
    }
    setPreviewCollapsed(stage < 2);
    applyLibCollapsed(false, animate, persist);
    applyChatLayout(chatWidth, false);
  }
  syncLayoutClasses(stage);

  if (panelCollectEl) {
    if (stage < 1) panelCollectEl.classList.remove('ws-lib-in');
    if (stage < 2) panelCollectEl.classList.remove('ws-preview-in');
  }

  if (animate && stage > prev && panelCollectEl) {
    panelCollectEl.classList.remove('ws-lib-in', 'ws-preview-in');
    void panelCollectEl.offsetWidth;
    if (prev === 0 && stage >= 1) panelCollectEl.classList.add('ws-lib-in');
    if (stage === 2 && prev < 2) panelCollectEl.classList.add('ws-preview-in');
  }
}

function resolveStage(leftover, current) {
  if (current >= 2) {
    if (leftover <= LIB_CLOSE_LEFT) return 0;
    if (leftover < previewNeedLeft() - 80) return 1;
    return 2;
  }
  if (current >= 1) {
    if (leftover >= previewNeedLeft()) return 2;
    if (leftover <= LIB_CLOSE_LEFT) return 0;
    return 1;
  }
  if (leftover >= previewNeedLeft() && leftover >= LIB_OPEN_LEFT + PREV_MIN_W) return 2;
  if (leftover >= LIB_OPEN_LEFT) return 1;
  return 0;
}

function applyLayoutFromWidth({ animate = false, persist = false } = {}) {
  const panelW = (panelCollectEl && panelCollectEl.clientWidth) || 0;
  if (!panelW) return;

  const compact = shouldUseCompact(panelW);
  applyNarrowMode(compact);

  if (compact) {
    setPreviewCollapsed(true);
    libraryWidth = 0;
    layoutStage = wsShowWorkspace ? 1 : 0;
    syncLayoutClasses(layoutStage);
    if (!wsShowWorkspace && chatCol) chatCol.style.width = collapsedChatWidth(panelW) + 'px';
    return;
  }

  // 文库/预览分割线拖动中：不要按 leftover 开关预览，否则树一变宽就会关了又开。
  if (paneSplitDragging) return;

  const leftover = leftoverAfterChat(panelW);
  const current = libCollapsed ? 0 : layoutStage;
  const next = resolveStage(leftover, current);
  applyStage(next, { animate, persist, leftover, panelW });
}

function handleSideRatioAuto() {
  const panelW = (ratioObserved && ratioObserved.clientWidth) || window.innerWidth || 0;
  if (!panelW) return;
  lastSideRatio = panelW;
  markSideResizing();
  applyLayoutFromWidth({ animate: false, persist: false });
}

function scheduleSideRatioAuto() {
  if (!sideRatioReady) return;
  markSideResizing();
  if (sideRatioRaf) return;
  sideRatioRaf = requestAnimationFrame(() => {
    sideRatioRaf = 0;
    handleSideRatioAuto();
  });
}

// ResizeObserver 观察主容器宽度（Side Panel 拖动宽度变化必触发）；
// 同时挂 window.resize 兜底，部分 Chrome 版本侧栏拖动只派发 window resize。
if (ratioObserved && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(scheduleSideRatioAuto).observe(ratioObserved);
}

window.addEventListener('resize', () => {
  refreshSliderPosition();
  scheduleSideRatioAuto();
  placeSettingsTabPill();
});
if (typeof ResizeObserver !== 'undefined') {
  const tabBarEl = document.getElementById('tabBar');
  if (tabBarEl) new ResizeObserver(refreshSliderPosition).observe(tabBarEl);
}
updateTabSlider();

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchPanel(parseInt(btn.dataset.panel)));
});

function switchPanel(targetIdx) {
  if (targetIdx === currentPanel) return;
  resetFileDrop();

  const goingRight = targetIdx > currentPanel;
  const oldPanel = panels[currentPanel];
  const newPanel = panels[targetIdx];

  // Slide old out
  oldPanel.classList.remove('active');
  oldPanel.classList.add(goingRight ? 'slide-left' : 'slide-right');

  // Slide new in
  newPanel.style.display = '';
  newPanel.classList.remove('slide-left', 'slide-right');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newPanel.classList.add('active');
    });
  });

  // Update tab buttons
  tabBtns.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  tabBtns[targetIdx].classList.add('active');
  tabBtns[targetIdx].setAttribute('aria-selected', 'true');
  updateTabSlider();

  // 切回聊天面板：探头猫重新探头跳出（切走时随面板一起淡出）
  if (targetIdx === 0) peekCatEnter();

  if (targetIdx === 1) initFeedView({
    showToast,
    escHtml,
    escAttr,
    askAi: (text) => {
      switchPanel(0);
      // Wait one frame so the panel transition starts before we trigger chat
      setTimeout(() => {
        if (cmdInput) { cmdInput.value = ''; autoResizeInput(); }
        sendChatMessage(text);
      }, 50);
    },
    goToCollect: (entryId) => {
      switchPanel(0);
      if (wsNarrow) setNarrowWorkspaceView(true);
      else if (libCollapsed) applyLibCollapsed(false);
      if (entryId) workspaceApi?.focusEntry?.(entryId);
    },
  });
  if (targetIdx === 3) initSettings();

  currentPanel = targetIdx;
  // 切回采集页时强制从 storage 重读：订阅页加入来源 / 页面划词收藏 / AI
  // 入库等写入发生在其他页面时，本页可能没收到任何通知事件
  if (targetIdx === 0) refreshEntriesAndRender();
}

/* ---- Project management ---- */

let projects = [];
let currentProject = 'default';

async function loadProjects() {
  const { projects: raw } = await chrome.storage.sync.get('projects');
  projects = raw || [{ id: 'default', name: '默认' }];
  const { currentProject: cp } = await chrome.storage.sync.get('currentProject');
  currentProject = cp || 'default';
  renderProjects();
  // currentProject 确定后再恢复该项目专属的 chat 宽度 / 库侧栏折叠态。
  // 之前恢复发生在 loadProjects 完成前，非 default 项目读到的是 default 的 key。
  await restoreChatWidth();
  await restoreLibCollapsed();
}

function goToChatPanel() {
  setNarrowWorkspaceView(false);
  switchPanel(0);
}

/** 决策板“派去调研 / 去回答”：只预填输入框，由用户改完再发。 */
function draftChatMessage(text) {
  if (!cmdInput || !text) return;
  goToChatPanel();
  cmdInput.value = String(text);
  autoResizeInput();
  updateSendButton();
  cmdInput.focus();
  cmdInput.setSelectionRange(cmdInput.value.length, cmdInput.value.length);
}

function resetChatRuntimeState() {
  chatQueue = [];
  if (chatMessagesEl) chatMessagesEl.querySelectorAll('.chat-msg.queued').forEach((el) => el.remove());
  chatHistory = [];
  chatMessages = [];
  chatCost = null;
  chatUsage = null;
  chatDragged = false;
  lastEntrySnapshot = '';
  lastSelectionSnapshot = '';
  lastProjectSnapshot = '';
  contextDeltaInitialized = false;
  chatHistorySummary = '';
  totalUsedTokens = 0;
  lastTokenCount = 0;
  pendingUserText = '';
  liveTurnText = '';
  pendingSuggestions = null;
  pendingScopeQuiz = null;
  pendingCharts = [];
  pendingImages = [];
  liveSubagentCards.clear();
  toolCtx.subagentSessions = new Map();
  pendingSubagentFollowups = [];
  activeAiBubbleEl = null;
  pendingAttachments = [];
  renderAttachChips();
}

let projectSwitchChain = Promise.resolve();

function applyProject(id) {
  projectSwitchChain = projectSwitchChain
    .catch(() => {})
    .then(() => applyProjectNow(id));
  return projectSwitchChain;
}

async function applyProjectNow(id) {
  if (!id) return;
  if (id === currentProject) {
    goToChatPanel();
    return;
  }
  const oldPid = currentProject;
  const oldRun = ensureRun(oldPid);
  adoptVisible(oldRun);
  currentProject = id;
  try {
    await chrome.storage.sync.set({ currentProject: id });
    await saveChatSession(oldPid);
    pendingAttachments = [];
    renderAttachChips();
    entries = await getEntries(id);
    const next = ensureRun(id);
    if (next.inProgress && next.selectedIds) selectedIds = next.selectedIds;
    else {
      selectedIds = new Set();
      next.selectedIds = selectedIds;
    }
    next.entries = entries;
    await restoreChatWidth();
    await restoreLibCollapsed();
    await loadChatSession(id);
    if (workspaceApi) await workspaceApi.projectChanged();
    syncHeartbeatUi();
    render();
    renderProjects();
    updateSendButton();
    if (!next.inProgress) drainRun(next);
  } finally {
    goToChatPanel();
  }
}

function renderProjects() {
  const list = document.getElementById('libraryList');
  if (!list) return;

  list.innerHTML = projects.map((p) => `
    <div class="library-card${p.id === currentProject ? ' current' : ''}" data-id="${p.id}">
      <div class="library-card-main">
        <div class="library-card-name">${runIsBusy(projectRuns.get(p.id)) ? '<span class="library-card-live" title="进行中"></span>' : ''}${escHtml(p.name)}</div>
      </div>
      <div class="library-card-actions">
        <button class="library-rename-btn" data-rename="${p.id}" title="重命名" aria-label="重命名">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        ${p.id !== 'default' ? `<button class="library-del-btn" data-del="${p.id}">&times;</button>` : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.library-rename-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.library-card');
      const nameEl = card?.querySelector('.library-card-name');
      if (nameEl) startProjectRename(nameEl, btn.dataset.rename);
    });
  });

  // Click to switch project
  list.querySelectorAll('.library-card').forEach((card) => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.library-del-btn')) return;
      if (e.target.closest('.library-rename-btn')) return;
      if (e.target.closest('.library-rename-input')) return;
      await applyProject(card.dataset.id);
    });
  });

  // Delete：删项目 = 级联删除（来源/产出 / 原件 / 工作区证据 / 笔记 / 标签 / 配置 / 会话 / 标注 / 心跳任务），
  // 保留 AI 记忆与订阅；不弹二次确认，与条目删除同款撤销（4 秒）。
  list.querySelectorAll('.library-del-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const proj = projects.find((p) => p.id === id) || { id, name: id };
      const wasCurrent = currentProject === id;
      const victim = projectRuns.get(id);
      if (victim) {
        victim.discarded = true;
        stopRun(victim);
        projectRuns.delete(id);
      }
      projects = projects.filter((p) => p.id !== id);
      await chrome.storage.sync.set({ projects });
      // 先留快照再清（原件字节超过上限时只恢复记录，见 project-purge.js）
      const snap = await purgeProject(id).catch((err) => {
        console.error('[SuperCat] purgeProject failed:', err);
        return null;
      });
      if (wasCurrent) {
        currentProject = 'default';
        await chrome.storage.sync.set({ currentProject: 'default' });
        resetChatRuntimeState();
        entries = await getEntries(currentProject);
        selectedIds.clear();
        await restoreChatWidth();
        await restoreLibCollapsed();
        await loadChatSession(); // 回到 default：恢复 default 的会话（若有）
        if (workspaceApi) await workspaceApi.projectChanged();
        syncHeartbeatUi();
        renderChat();
        render();
      }
      renderProjects();
      notifyCollectionStatusChanged({ refreshAll: true });
      if (!snap) return;
      const n = (snap.entries || []).length;
      showUndoToast(`已删除「${proj.name}」及其全部内容（${n} 个条目）`, async () => {
        projects.push(proj);
        await chrome.storage.sync.set({ projects });
        await restoreProject(snap);
        if (wasCurrent) {
          const staying = ensureRun(currentProject);
          adoptVisible(staying);
          currentProject = id;
          projectRuns.delete(id);
          await chrome.storage.sync.set({ currentProject: id });
          await loadChatSession();
          if (workspaceApi) await workspaceApi.projectChanged();
          renderChat();
        }
        entries = await getEntries(currentProject);
        syncHeartbeatUi();
        render();
        renderProjects();
        notifyCollectionStatusChanged({ refreshAll: true });
      });
    });
  });
}

function startProjectRename(nameEl, id) {
  const project = projects.find((p) => p.id === id);
  if (!project || !nameEl) return;

  const oldName = project.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.className = 'library-rename-input';
  input.style.width = getRenameInputWidth(oldName, nameEl) + 'px';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    const newName = input.value.trim() || oldName;
    project.name = newName;
    await chrome.storage.sync.set({ projects });
    input.replaceWith(nameEl);
    nameEl.textContent = newName;
    if (project.id === currentProject && workspaceApi) {
      workspaceApi.refresh().catch(() => {});
    }
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { input.blur(); }
    if (ev.key === 'Escape') { input.value = oldName; input.blur(); }
  });
  input.addEventListener('click', (ev) => ev.stopPropagation());
}

function getRenameInputWidth(text, nameEl) {
  const card = nameEl.closest('.library-card');
  const actions = card?.querySelector('.library-card-actions');
  const cardWidth = card?.getBoundingClientRect().width || 280;
  const actionsWidth = actions?.getBoundingClientRect().width || 0;
  const maxWidth = Math.max(112, Math.min(260, cardWidth - actionsWidth - 56));

  const measure = document.createElement('span');
  measure.className = 'library-name-measure';
  measure.textContent = text || '项目';
  document.body.appendChild(measure);
  const measured = Math.ceil(measure.getBoundingClientRect().width) + 24;
  measure.remove();

  return Math.min(Math.max(measured, 112), maxWidth);
}

document.getElementById('addLibraryBtn').addEventListener('click', async () => {
  const input = document.getElementById('newLibraryInput');
  const name = input.value.trim();
  if (!name) return;
  const id = 'proj_' + Date.now();
  projects.push({ id, name });
  await chrome.storage.sync.set({ projects });
  input.value = '';
  renderProjects();
});

/* ---- Settings panel ---- */

let settingsEventsBound = false;

async function initSettings() {
  const [blacklist, feedPrefsResp] = await Promise.all([
    getBlacklist(),
    chrome.runtime.sendMessage({ type: 'FEED_GET_PREFS' }).catch(() => null),
  ]);

  document.getElementById('blacklistTextarea').value = blacklist.join('\n');
  await ensureDefaultChannel(); // 首次进设置页：把旧配置合成「默认」渠道（幂等）
  renderChannelManager();
  await ensureDefaultSearchChannels();
  await renderSearchChannels();
  const prefs = (feedPrefsResp && feedPrefsResp.prefs) || {};
  const autoEl = document.getElementById('feedAutoTranslate');
  const langEl = document.getElementById('feedTargetLang');
  if (autoEl) autoEl.checked = !!prefs.defaultAutoTranslate;
  if (langEl) langEl.value = prefs.defaultTargetLanguage || 'zh-Hans';
  const provEl = document.getElementById('translateProvider');
  if (provEl) provEl.value = prefs.translateProvider || 'google';
  const tIdEl = document.getElementById('tencentSecretId');
  const tKeyEl = document.getElementById('tencentSecretKey');
  const tRegEl = document.getElementById('tencentRegion');
  if (tIdEl) tIdEl.value = prefs.tencentSecretId || '';
  if (tKeyEl) tKeyEl.value = '';
  if (tKeyEl) tKeyEl.placeholder = prefs.tencentSecretKey ? '已保存（留空保持不变）' : 'SecretKey';
  if (tRegEl) tRegEl.value = prefs.tencentRegion || 'ap-shanghai';
  toggleTencentCredVisibility();
  const rsshubEl = document.getElementById('rsshubInstance');
  if (rsshubEl) rsshubEl.value = prefs.rsshubInstance || 'https://rsshub.app';
  const refreshIntervalEl = document.getElementById('feedRefreshInterval');
  if (refreshIntervalEl) refreshIntervalEl.value = prefs.intervalMin || 30;

  await renderApiConnectors();
  const chips = document.getElementById('apiPresetChips');
  if (chips && !chips.dataset.ready) {
    chips.dataset.ready = '1';
    chips.innerHTML = API_PRESETS.map((p) =>
      `<button type="button" class="preset-chip" data-preset="${escAttr(p.id)}">${escHtml(p.name)}</button>`
    ).join('');
  }

  // UI scale selector (stored in chrome.storage.local, not in feed prefs)
  const themeEl = document.getElementById('colorSchemeSelect');
  if (themeEl) {
    themeEl.value = colorSchemeMode || 'auto';
    if (!themeEl.dataset.bound) {
      themeEl.dataset.bound = '1';
      themeEl.addEventListener('change', async () => {
        colorSchemeMode = normalizeThemeMode(themeEl.value);
        await saveThemeMode(colorSchemeMode);
        showSettingsStatus('colorSchemeStatus', '已应用', 'success');
      });
    }
  }

  const scaleEl = document.getElementById('uiScaleSelect');
  if (scaleEl) {
    scaleEl.value = await getStoredUiScale();
    if (!scaleEl.dataset.bound) {
      scaleEl.dataset.bound = '1';
      scaleEl.addEventListener('change', async () => {
        await setUiScale(scaleEl.value);
        showSettingsStatus('uiScaleStatus', '已应用', 'success');
      });
    }
  }

  bindSettingsEvents();
  requestAnimationFrame(placeSettingsTabPill);
  renderMemoryList();
  renderSubagentSettings();
}

async function renderMemoryList() {
  const container = document.getElementById('memoryList');
  const countEl = document.getElementById('memoryCount');
  if (!container) return;
  const { agentMemories = [] } = await chrome.storage.local.get('agentMemories');
  if (countEl) countEl.textContent = `共 ${agentMemories.length} 条`;
  if (agentMemories.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px 0;">暂无记忆。AI 完成复杂任务后会自动积累经验。</p>';
    return;
  }
  const sorted = [...agentMemories].sort((a, b) => calcRelevance(b) - calcRelevance(a));
  container.innerHTML = '';
  for (const m of sorted) {
    const card = document.createElement('div');
    card.className = 'mem-card';
    card.dataset.memId = m.id;
    card.style.cssText = 'padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--bg-card);';
    const prefixes = (m.urlPrefixes || []).map((p) => `<span style="background:var(--bg-accent);padding:2px 8px;border-radius:4px;font-size:11px;color:var(--accent);">${escHtml(p)}</span>`).join(' ');
    const tags = (m.tags || []).map((t) => `<span style="background:var(--bg-accent);padding:2px 8px;border-radius:4px;font-size:11px;color:var(--text-muted);">${escHtml(t)}</span>`).join(' ');
    const age = m.lastAccessed ? Math.round((Date.now() - m.lastAccessed) / 86400000) + '天前访问' : '新';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:11px;font-weight:600;color:var(--accent);background:var(--bg-accent);padding:2px 8px;border-radius:4px;">${escHtml(m.domain || 'general')}</span>
        <span style="font-size:11px;color:var(--text-muted);">${'★'.repeat(m.importance || 3)} · ${age}</span>
      </div>
      <div class="mem-lesson-text" style="font-size:13px;line-height:1.5;color:var(--text);padding:4px 0;">${escHtml(m.lesson || '')}</div>
      ${(prefixes || tags) ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${prefixes}${tags}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button class="btn btn-sm mem-edit-btn" style="padding:3px 10px;font-size:12px;">编辑</button>
        <button class="btn btn-sm btn-secondary mem-del-btn" style="padding:3px 10px;font-size:12px;">删除</button>
      </div>`;
    container.appendChild(card);
  }
  // Bind buttons (use event delegation to avoid duplicate handler issues)
  container.querySelectorAll('.mem-del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('[data-mem-id]');
      const id = card.dataset.memId;
      const { agentMemories: mems = [] } = await chrome.storage.local.get('agentMemories');
      await chrome.storage.local.set({ agentMemories: mems.filter((m) => m.id !== id) });
      renderMemoryList();
    });
  });
  container.querySelectorAll('.mem-edit-btn').forEach((btn) => {
    btn.addEventListener('click', function onEdit() {
      const card = this.closest('[data-mem-id]');
      const id = card.dataset.memId;
      const textEl = card.querySelector('.mem-lesson-text');
      const oldText = textEl.textContent;
      // Replace text with textarea
      textEl.innerHTML = '';
      const ta = document.createElement('textarea');
      ta.value = oldText;
      ta.style.cssText = 'width:100%;min-height:80px;font-size:13px;padding:6px 8px;border:1px solid var(--accent);border-radius:4px;resize:vertical;font-family:inherit;color:var(--text);background:var(--bg);';
      textEl.appendChild(ta);
      ta.focus();
      // Change button to save
      this.textContent = '保存';
      this.classList.add('btn-primary');
      this.classList.remove('btn-secondary');
      // Replace handler: remove old, add save handler
      this.removeEventListener('click', onEdit);
      this.addEventListener('click', async function onSave() {
        const newText = ta.value.trim();
        if (newText && newText !== oldText) {
          const { agentMemories: mems = [] } = await chrome.storage.local.get('agentMemories');
          const idx = mems.findIndex((m) => m.id === id);
          if (idx >= 0) {
            mems[idx].lesson = newText;
            mems[idx].updatedAt = Date.now();
            await chrome.storage.local.set({ agentMemories: mems });
          }
        }
        renderMemoryList();
      });
    });
  });
}

/* ---- 渠道管理（ccswitch 式：命名档案 + 单一激活指针）----
 * 每个渠道独立保存 name/protocol/baseUrl/apiKey，以及 models[]（多模型）；
 * 切换改 activeChannelId + 该渠道的 activeModelId，getProjectConfig() 解析当前模型——
 * key 随渠道持久保留，来回切换永不重输。 */

let channelEditingId = null; // null = 新增模式

const PENCIL_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const TRASH_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

function parseModelContextTokens(raw) {
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && v >= 16000 && v <= 2000000 ? v : undefined;
}

function newChannelModelId() {
  return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readChannelModelsFromForm() {
  return [...document.querySelectorAll('#chModelList .ch-model-row')].map((row) => {
    const name = row.querySelector('.ch-model-name')?.value.trim() || '';
    const ctx = parseModelContextTokens(row.querySelector('.ch-model-ctx')?.value);
    return {
      id: row.dataset.id || newChannelModelId(),
      name,
      ...(ctx ? { contextTokens: ctx } : {}),
    };
  }).filter((m) => m.name);
}

function channelModelRowHtml(m) {
  const ctx = m?.contextTokens ? String(m.contextTokens) : '';
  return `<div class="ch-model-row" data-id="${escAttr(m?.id || newChannelModelId())}">`
    + `<input type="text" class="ch-model-name" placeholder="模型 ID，如 deepseek-v4-flash" value="${escAttr(m?.name || '')}" aria-label="模型名称">`
    + `<input type="number" class="ch-model-ctx" min="16000" max="2000000" step="1000" placeholder="窗口" value="${escAttr(ctx)}" title="上下文窗口 tokens（选填）" aria-label="上下文窗口">`
    + `<button type="button" class="channel-icon-btn is-danger ch-model-del" title="移除此模型" aria-label="移除此模型">${TRASH_SVG}</button>`
    + '</div>';
}

function syncChannelModelRowActions() {
  const rows = document.querySelectorAll('#chModelList .ch-model-row');
  rows.forEach((row) => {
    const del = row.querySelector('.ch-model-del');
    if (del) del.hidden = rows.length <= 1;
  });
}

function renderChannelModelRows(models) {
  const list = document.getElementById('chModelList');
  if (!list) return;
  const items = (models && models.length)
    ? models
    : [{ id: newChannelModelId(), name: '' }];
  list.innerHTML = items.map((m) => channelModelRowHtml(m)).join('');
  syncChannelModelRowActions();
}

function addChannelModelRow(seed) {
  const list = document.getElementById('chModelList');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', channelModelRowHtml(seed || { id: newChannelModelId(), name: '' }));
  syncChannelModelRowActions();
  const names = list.querySelectorAll('.ch-model-name');
  names[names.length - 1]?.focus();
}

function fillChannelModelsFromPreset(preset) {
  const names = Array.isArray(preset?.models) && preset.models.length
    ? preset.models.map((n) => String(n || '').trim()).filter(Boolean)
    : (preset?.model ? [String(preset.model).trim()] : []);
  if (!names.length) {
    renderChannelModelRows([]);
    return;
  }
  renderChannelModelRows(names.map((name) => ({ id: newChannelModelId(), name })));
}

function readChannelForm() {
  const models = readChannelModelsFromForm();
  return {
    name: document.getElementById('chName').value.trim(),
    protocol: document.getElementById('chProtocol').value || 'openai',
    baseUrl: document.getElementById('chBaseUrl').value.trim(),
    apiKey: document.getElementById('chApiKey').value.trim(),
    models,
    model: models[0]?.name || '',
    contextTokens: models[0]?.contextTokens,
  };
}

function openChannelEditor(ch) {
  channelEditingId = ch ? ch.id : null;
  const editor = document.getElementById('channelEditor');
  if (!editor) return;
  editor.hidden = false;
  document.getElementById('chName').value = ch?.name || '';
  document.getElementById('chProtocol').value = ch?.protocol || 'openai';
  document.getElementById('chBaseUrl').value = ch?.baseUrl || '';
  document.getElementById('chApiKey').value = ch?.apiKey || '';
  renderChannelModelRows(normalizeChannelModels(ch));
  document.getElementById('saveChannelBtn').textContent = ch ? '保存修改' : '保存渠道';
  document.getElementById('saveAsNewChannelBtn').hidden = !ch;
  document.getElementById('cancelChannelBtn').hidden = false;
  showSettingsStatus('chStatus', '', '');
  editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function closeChannelEditor() {
  channelEditingId = null;
  const editor = document.getElementById('channelEditor');
  if (editor) editor.hidden = true;
}

async function submitChannelForm({ asNew }) {
  const f = readChannelForm();
  if (!f.baseUrl || !f.models.length) {
    showSettingsStatus('chStatus', 'Base URL 和至少一个模型名称必填', 'error');
    return;
  }
  if (!f.apiKey && !confirm('未填 API Key，该渠道调用会失败。确定继续保存？')) return;
  const channels = await getAiChannels();
  let id;
  let saved;
  if (!asNew && channelEditingId && channels.some((c) => c.id === channelEditingId)) {
    id = channelEditingId;
    const idx = channels.findIndex((c) => c.id === id);
    const prev = channels[idx];
    const keep = f.models.find((m) => m.id === prev.activeModelId)
      || f.models.find((m) => m.name === prev.model)
      || f.models[0];
    saved = {
      ...prev,
      ...f,
      models: f.models,
      activeModelId: keep.id,
      model: keep.name,
      contextTokens: keep.contextTokens,
    };
    channels[idx] = saved;
  } else {
    id = 'ch_' + Date.now().toString(36);
    const first = f.models[0];
    saved = {
      id,
      ...f,
      models: f.models,
      activeModelId: first.id,
      model: first.name,
      contextTokens: first.contextTokens,
    };
    channels.push(saved);
    await setActiveChannelId(id);
  }
  await saveAiChannels(channels);
  closeChannelEditor();
  renderChannelManager();
}

async function switchChannel(id) {
  await setActiveChannelId(id);
  await renderChannelManager(); // 重绘渠道列表行选中态与头部切换器（内含 refreshChatChannelSwitcher）
}

let editingApiConnectorId = null;
let editingSearchChannelId = null;
let searchEditorProvider = 'tavily';

function searchChannelMeta(c) {
  const preset = searchPreset(c.provider);
  if (preset.needsKey) return c.apiKey ? '已填 Key' : '未填 Key';
  if (preset.needsBase) return c.baseUrl ? c.baseUrl.replace(/^https?:\/\//, '') : '未填地址';
  if (c.provider === 'deepseek') return '跟随当前 AI 渠道';
  return '无需 Key';
}

function syncSearchEditorFields() {
  const preset = searchPreset(searchEditorProvider);
  const keyWrap = document.getElementById('schKeyWrap');
  const baseWrap = document.getElementById('schBaseWrap');
  const hint = document.getElementById('schHint');
  const keyEl = document.getElementById('schApiKey');
  if (keyWrap) keyWrap.hidden = !preset.needsKey;
  if (baseWrap) baseWrap.hidden = !preset.needsBase;
  if (hint) hint.textContent = preset.hint || '';
  if (keyEl && preset.keyPlaceholder && !String(keyEl.placeholder).includes('已保存')) {
    keyEl.placeholder = preset.keyPlaceholder;
  }
  document.querySelectorAll('#searchPresetChips .preset-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.provider === searchEditorProvider);
  });
}

function openSearchEditor(channel) {
  const ed = document.getElementById('searchChannelEditor');
  if (!ed) return;
  ed.hidden = false;
  editingSearchChannelId = channel && channel.id ? channel.id : null;
  searchEditorProvider = channel?.provider || 'tavily';
  const nameEl = document.getElementById('schName');
  const keyEl = document.getElementById('schApiKey');
  const baseEl = document.getElementById('schBaseUrl');
  if (nameEl) nameEl.value = channel?.name || '';
  if (keyEl) {
    keyEl.value = '';
    const preset = searchPreset(searchEditorProvider);
    keyEl.placeholder = channel && channel.apiKey ? '已保存（留空保持不变）' : (preset.keyPlaceholder || 'API Key');
  }
  if (baseEl) baseEl.value = channel?.baseUrl || '';
  syncSearchEditorFields();
  const status = document.getElementById('schStatus');
  if (status) { status.textContent = ''; status.className = 'status-msg'; }
}

async function renderSearchChannels() {
  const listEl = document.getElementById('searchChannelList');
  if (!listEl) return;
  const list = await getSearchChannels();
  const activeId = await getActiveSearchChannelId();
  const cur = list.find((c) => c.id === activeId) || list[0];
  listEl.innerHTML = list.map((c) => {
    const isActive = c.id === (cur && cur.id);
    return `<div class="channel-row${isActive ? ' active' : ''}"${isActive ? '' : ` data-sch-act="use" data-id="${escAttr(c.id)}"`}>`
      + `<div class="channel-row-main"><span class="channel-name">${escHtml(c.name)}</span>`
      + `<span class="channel-meta">${escHtml(searchPreset(c.provider).label)} · ${escHtml(searchChannelMeta(c))}</span></div>`
      + `<div class="channel-row-actions">`
      + (isActive ? '<span class="channel-in-use">使用中</span>' : '')
      + `<button type="button" class="channel-icon-btn" data-sch-act="edit" data-id="${escAttr(c.id)}" title="编辑" aria-label="编辑">${PENCIL_SVG}</button>`
      + `<button type="button" class="channel-icon-btn is-danger" data-sch-act="del" data-id="${escAttr(c.id)}" data-name="${escAttr(c.name)}" title="删除" aria-label="删除">${TRASH_SVG}</button>`
      + '</div></div>';
  }).join('');
}

function readSearchForm(list) {
  const existing = (list || []).find((c) => c.id === editingSearchChannelId);
  const preset = searchPreset(searchEditorProvider);
  let apiKey = (document.getElementById('schApiKey')?.value || '').trim();
  if (!apiKey && existing && existing.provider === searchEditorProvider) apiKey = existing.apiKey;
  return normalizeSearchChannel({
    id: editingSearchChannelId || undefined,
    name: document.getElementById('schName')?.value,
    provider: searchEditorProvider,
    apiKey,
    baseUrl: document.getElementById('schBaseUrl')?.value,
  });
}

function bindSearchChannelEvents() {
  const chips = document.getElementById('searchPresetChips');
  if (chips && !chips.dataset.ready) {
    chips.dataset.ready = '1';
    chips.innerHTML = SEARCH_PRESETS.map((p) =>
      `<button type="button" class="preset-chip" data-provider="${escAttr(p.provider)}">${escHtml(p.label)}</button>`
    ).join('');
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-provider]');
      if (!btn) return;
      const prev = searchPreset(searchEditorProvider);
      searchEditorProvider = btn.dataset.provider;
      const next = searchPreset(searchEditorProvider);
      const nameEl = document.getElementById('schName');
      if (nameEl && (!nameEl.value.trim() || nameEl.value.trim() === prev.label)) nameEl.value = next.label;
      const keyEl = document.getElementById('schApiKey');
      if (keyEl && !keyEl.value) keyEl.placeholder = next.keyPlaceholder || 'API Key';
      syncSearchEditorFields();
    });
  }

  document.getElementById('addSearchChannelBtn')?.addEventListener('click', () => {
    openSearchEditor(null);
  });
  document.getElementById('cancelSearchChannelBtn')?.addEventListener('click', () => {
    const ed = document.getElementById('searchChannelEditor');
    if (ed) ed.hidden = true;
    editingSearchChannelId = null;
  });
  document.getElementById('saveSearchChannelBtn')?.addEventListener('click', async () => {
    const list = await getSearchChannels();
    const form = readSearchForm(list);
    const preset = searchPreset(form.provider);
    if (preset.needsKey && !form.apiKey) {
      showSettingsStatus('schStatus', '请填写 API Key', 'error');
      return;
    }
    if (preset.needsBase && !form.baseUrl) {
      showSettingsStatus('schStatus', '请填写 Base URL', 'error');
      return;
    }
    const idx = list.findIndex((c) => c.id === form.id);
    if (idx >= 0) list[idx] = form;
    else list.push(form);
    await saveSearchChannels(list);
    const ed = document.getElementById('searchChannelEditor');
    if (ed) ed.hidden = true;
    editingSearchChannelId = null;
    await renderSearchChannels();
    showSettingsStatus('searchChannelStatus', '已保存。点击该行即可使用', 'success');
  });
  document.getElementById('testSearchChannelBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('testSearchChannelBtn');
    const list = await getSearchChannels();
    const form = readSearchForm(list);
    const preset = searchPreset(form.provider);
    if (preset.needsKey && !form.apiKey) {
      showSettingsStatus('schStatus', '请先填写 API Key', 'error');
      return;
    }
    if (preset.needsBase && !form.baseUrl) {
      showSettingsStatus('schStatus', '请先填写 Base URL', 'error');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '测试中...'; }
    try {
      const apiConfig = await getProjectConfig(currentProject);
      const hit = await executeSearchChannel(form, 'reuters', { apiConfig });
      const n = (hit.text.match(/^- /gm) || []).length;
      showSettingsStatus('schStatus', `成功，${n || 1} 条`, 'success');
    } catch (err) {
      showSettingsStatus('schStatus', err.message || String(err), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '测试搜索'; }
    }
  });
  document.getElementById('searchChannelList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-sch-act]');
    const row = e.target.closest('.channel-row');
    const act = btn?.dataset.schAct || row?.dataset.schAct;
    const id = btn?.dataset.id || row?.dataset.id;
    if (!act || !id || act === 'edit' && !btn) return;
    if (act === 'use') {
      await setActiveSearchChannelId(id);
      await renderSearchChannels();
      return;
    }
    if (act === 'edit') {
      const list = await getSearchChannels();
      openSearchEditor(list.find((c) => c.id === id) || null);
      return;
    }
    if (act === 'del') {
      const list = await getSearchChannels();
      if (list.length <= 1) {
        showSettingsStatus('searchChannelStatus', '至少保留一个搜索', 'error');
        return;
      }
      if (!confirm(`删除搜索「${btn.dataset.name}」？`)) return;
      const next = list.filter((c) => c.id !== id);
      await saveSearchChannels(next);
      if (await getActiveSearchChannelId() === id) await setActiveSearchChannelId(next[0].id);
      await renderSearchChannels();
      showSettingsStatus('searchChannelStatus', '已删除', 'success');
    }
  });
}

function syncApiAuthFields() {
  const t = document.getElementById('apiConnAuth')?.value || 'none';
  const key = document.getElementById('apiConnKeyWrap');
  const secret = document.getElementById('apiConnSecretWrap');
  const header = document.getElementById('apiConnHeaderWrap');
  const query = document.getElementById('apiConnQueryWrap');
  if (key) key.hidden = t === 'none';
  if (secret) secret.hidden = !(t === 'hmac_sha256' || t === 'basic');
  if (header) header.hidden = !(t === 'header' || t === 'hmac_sha256');
  if (query) query.hidden = t !== 'query';
}

function parkApiEditor() {
  const ed = document.getElementById('apiConnectorEditor');
  const actions = document.getElementById('addApiConnectorBtn')?.closest('.form-actions');
  if (ed && actions) actions.insertAdjacentElement('afterend', ed);
  return ed;
}

async function renderApiConnectors() {
  const listEl = document.getElementById('apiConnectorList');
  if (!listEl) return;
  const ed = parkApiEditor();
  const keepOpen = !!(ed && !ed.hidden && editingApiConnectorId);
  const keepId = editingApiConnectorId;
  const list = await loadConnectors();
  if (!list.length) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--muted);margin:0">尚未保存。免费无需 Key 的接口也可以保存，用来提醒 AI 有这条渠道。</p>';
    return;
  }
  listEl.innerHTML = list.map((c) => {
    const free = c.authType === 'none' && !c.apiKey;
    const meta = `${free ? '免费' : c.authType}${c.allowWrite ? ' · 可写' : ' · 只读'}`;
    const editing = keepOpen && c.id === keepId;
    return `<div class="channel-row${editing ? ' active' : ''}" data-id="${escAttr(c.id)}">`
      + `<div class="channel-row-main"><span class="channel-name">${escHtml(c.name)}</span>`
      + `<span class="channel-meta">${escHtml((c.baseUrl || '').replace(/^https?:\/\//, ''))} · ${escHtml(meta)}</span></div>`
      + `<div class="channel-row-actions">`
      + `<button type="button" class="channel-icon-btn" data-api-act="edit" data-id="${escAttr(c.id)}" title="编辑" aria-label="编辑">${PENCIL_SVG}</button>`
      + `<button type="button" class="channel-icon-btn is-danger" data-api-act="del" data-id="${escAttr(c.id)}" data-name="${escAttr(c.name)}" title="删除" aria-label="删除">${TRASH_SVG}</button>`
      + '</div></div>';
  }).join('');
  if (keepOpen && ed) {
    const row = [...listEl.querySelectorAll('.channel-row')].find((el) => el.dataset.id === keepId);
    if (row) row.insertAdjacentElement('afterend', ed);
  }
}

function openApiEditor(conn, place) {
  const ed = document.getElementById('apiConnectorEditor');
  if (!ed) return;
  ed.hidden = false;
  editingApiConnectorId = conn && conn.id ? conn.id : null;
  const listEl = document.getElementById('apiConnectorList');
  const anchor = place && place.anchor;
  if (anchor) anchor.insertAdjacentElement('afterend', ed);
  else if (place && place.afterAdd) parkApiEditor();
  listEl?.querySelectorAll('.channel-row').forEach((row) => {
    row.classList.toggle('active', row === anchor);
  });
  const nameEl = document.getElementById('apiConnName');
  const baseEl = document.getElementById('apiConnBase');
  const authEl = document.getElementById('apiConnAuth');
  const keyEl = document.getElementById('apiConnKey');
  const secretEl = document.getElementById('apiConnSecret');
  const headerEl = document.getElementById('apiConnHeader');
  const queryEl = document.getElementById('apiConnQuery');
  const writeEl = document.getElementById('apiConnWrite');
  const notesEl = document.getElementById('apiConnNotes');
  if (nameEl) nameEl.value = conn?.name || '';
  if (baseEl) baseEl.value = conn?.baseUrl || '';
  if (authEl) authEl.value = conn?.authType || 'none';
  if (keyEl) {
    keyEl.value = '';
    keyEl.placeholder = conn && conn.apiKey ? '已保存（留空保持不变）' : '密钥';
  }
  if (secretEl) {
    secretEl.value = '';
    secretEl.placeholder = conn && conn.apiSecret ? '已保存（留空保持不变）' : 'HMAC secret 或 Basic 密码';
  }
  if (headerEl) headerEl.value = conn?.headerName || '';
  if (queryEl) queryEl.value = conn?.queryName || 'api_key';
  if (writeEl) writeEl.checked = !!conn?.allowWrite;
  if (notesEl) notesEl.value = conn?.notes || '';
  syncApiAuthFields();
  const editStatus = document.getElementById('apiConnEditStatus');
  if (editStatus) { editStatus.textContent = ''; editStatus.className = 'status-msg'; }
  ed.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  nameEl?.focus({ preventScroll: true });
}

function fillApiPreset(p) {
  if (!p) return;
  openApiEditor({
    name: p.name,
    baseUrl: p.baseUrl,
    authType: p.authType,
    headerName: p.headerName,
    queryName: p.queryName,
    allowWrite: !!p.allowWrite,
    notes: p.notes,
  });
  editingApiConnectorId = null;
}

async function persistApiEditor() {
  const name = (document.getElementById('apiConnName')?.value || '').trim();
  if (!name) {
    showSettingsStatus('apiConnEditStatus', '需要名称', 'error');
    return null;
  }
  const baseUrl = (document.getElementById('apiConnBase')?.value || '').trim();
  if (!baseUrl || baseUrl === 'https://') {
    showSettingsStatus('apiConnEditStatus', '需要 Base URL（免费接口也要填根地址）', 'error');
    return null;
  }
  const list = await loadConnectors();
  const existing = list.find((c) => c.id === editingApiConnectorId);
  const key = (document.getElementById('apiConnKey')?.value || '').trim();
  const secret = (document.getElementById('apiConnSecret')?.value || '').trim();
  const authType = document.getElementById('apiConnAuth')?.value || 'none';
  const next = {
    ...(existing || {}),
    id: existing?.id,
    name,
    baseUrl,
    authType,
    apiKey: authType === 'none' ? '' : (key || existing?.apiKey || ''),
    apiSecret: (authType === 'hmac_sha256' || authType === 'basic') ? (secret || existing?.apiSecret || '') : '',
    headerName: (document.getElementById('apiConnHeader')?.value || '').trim(),
    queryName: (document.getElementById('apiConnQuery')?.value || '').trim() || 'api_key',
    allowWrite: !!document.getElementById('apiConnWrite')?.checked,
    notes: (document.getElementById('apiConnNotes')?.value || '').trim(),
    updatedAt: Date.now(),
  };
  const saved = existing
    ? list.map((c) => (c.id === existing.id ? next : c))
    : [...list, next];
  await saveConnectors(saved);
  const stored = await loadConnectors();
  const hit = stored.find((c) => c.name === name) || stored[stored.length - 1];
  editingApiConnectorId = hit ? hit.id : editingApiConnectorId;
  await renderApiConnectors();
  showSettingsStatus('apiConnEditStatus', '已保存', 'success');
  showSettingsStatus('apiConnectorStatus', '已保存', 'success');
  return hit;
}

/** 同步聊天头部切换器与设置页渠道列表行 */
async function renderChannelManager() {
  const channels = await getAiChannels();
  const activeId = await getActiveChannelId();
  const cur = channels.find((c) => c.id === activeId) || channels[0];

  await refreshChatChannelSwitcher();

  const listEl = document.getElementById('channelList');
  if (listEl) {
    listEl.innerHTML = channels.map((c) => {
      const isActive = c.id === (cur && cur.id);
      // 整行可点即切换（active 行无 data-act），不再单独放「使用」按钮
      return `<div class="channel-row${isActive ? ' active' : ''}"${isActive ? '' : ` data-act="use" data-id="${escAttr(c.id)}"`}>`
        + `<div class="channel-row-main"><span class="channel-name">${escHtml(channelIdentity(c).source)}</span>`
        + `<span class="channel-meta">${escHtml(channelModelsMeta(c))}</span></div>`
        + `<div class="channel-row-actions">`
        + (isActive ? '<span class="channel-in-use">使用中</span>' : '')
        + `<button class="channel-icon-btn" data-act="edit" data-id="${escAttr(c.id)}" title="编辑" aria-label="编辑">${PENCIL_SVG}</button>`
        + `<button class="channel-icon-btn is-danger" data-act="del" data-id="${escAttr(c.id)}" data-name="${escAttr(c.name || c.id)}" title="删除" aria-label="删除">${TRASH_SVG}</button>`
        + '</div></div>';
    }).join('');
  }
}

/** 聊天头部的快速切换下拉（无需进设置页就能换渠道） */
/* ---- 聊天头部渠道切换：模型名触发按钮 + 弹出菜单（发丝边框 + 聚焦虚化入场）---- */

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** 渠道来源（用户起的名字优先）+ 完整模型 ID，切换器 / 菜单 / 分隔线共用 */
function channelIdentity(ch) {
  const active = resolveChannelModel(ch);
  const model = String(active?.name || ch?.model || '').trim();
  const name = String(ch?.name || '').trim();
  const host = hostOf(ch?.baseUrl);
  const preset = host
    ? PROVIDER_PRESETS.find((p) => p.id !== 'custom' && p.baseUrl && hostOf(p.baseUrl) === host)
    : null;
  const fromUrl = preset ? preset.label.split('（')[0].trim() : host;
  const source = (name && name !== model) ? name : (fromUrl || name || '未配置');
  return {
    source,
    model: model || '未设模型',
    line: model ? `${source} · ${model}` : source,
  };
}

function channelModelsMeta(ch) {
  const models = normalizeChannelModels(ch);
  if (!models.length) return '未设模型';
  const names = models.map((m) => m.name);
  const active = resolveChannelModel(ch);
  if (names.length === 1) return names[0];
  const rest = names.filter((n) => n !== active.name);
  return `${active.name} · 另 ${rest.length} 个`;
}

const CHEVRON_SVG = '<svg class="cct-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

function resolvedEffort(modelName, stored, cfg) {
  const caps = inferModelCaps(modelName, cfg);
  const v = String(stored || '').trim();
  if (v) return v;
  if (caps.reasoning === 'none') return 'off';
  if (caps.reasoning === 'always') return 'high';
  return caps.defaultEffort || 'medium';
}

function effortLabelOf(id) {
  const named = resolveEffortId(id);
  return (EFFORT_LEVELS.find((e) => e.id === named) || {}).label || '';
}

let menuChannelCache = { channels: [], activeId: '' };

/** 触发按钮：模型名 + 思考深度（含默认档） */
async function refreshChatChannelSwitcher() {
  const btn = document.getElementById('chatChannelSwitch');
  if (!btn) return;
  const channels = await getAiChannels();
  const activeId = await getActiveChannelId();
  menuChannelCache = { channels, activeId };
  const cur = channels.find((c) => c.id === activeId) || channels[0];
  if (!cur) {
    btn.innerHTML = `<span class="cct-label">未配置渠道</span>${CHEVRON_SVG}`;
    btn.title = '切换模型';
    return;
  }
  const idn = channelIdentity(cur);
  const active = resolveChannelModel(cur);
  const effort = resolvedEffort(active.name, active.effort || cur.effort, cur);
  const effortText = effortLabelOf(effort) || '';
  btn.innerHTML = `<span class="cct-label">${escHtml(idn.model)}</span>`
    + (effortText ? `<span class="cct-effort">${escHtml(effortText)}</span>` : '')
    + CHEVRON_SVG;
  const ctx = active.contextTokens || cur.contextTokens;
  btn.title = `${idn.line}${effortText ? ` · ${effortText}` : ''}${ctx ? ` · ${formatContextLabel(ctx)}` : ''}`;
}

function closeChatChannelMenu() {
  const menu = document.querySelector('.chat-channel-menu');
  const triggerBtn = document.getElementById('chatChannelSwitch');
  if (!menu) return;
  menu.querySelectorAll('.ccm-slide').forEach(detachSlideSpring);
  if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
  menu.classList.add('closing');
  setTimeout(() => menu.remove(), 150);
}

async function handoffChannel(picked) {
  const model = picked ? channelIdentity(picked).model : '';
  if (model) addChatBubble('divider', `切换到 ${model}`);
  const win = Number(picked && picked.contextTokens) || 0;
  if (win > 0) {
    const used = estimateMessagesTokens(chatHistory) + estimateTokens(chatHistorySummary);
    if (used > win * 0.7) {
      showToast('新模型窗口较小，正在压缩更早对话…');
      await compactChatHistoryIfNeeded({
        apiKey: picked.apiKey, baseUrl: picked.baseUrl, model: picked.model,
        protocol: picked.protocol || 'openai', contextTokens: win,
      }, { force: true });
    }
  }
  await saveChatSession();
  renderChat();
}

function modelMenuHtml(channels, activeId, query) {
  const q = String(query || '').trim().toLowerCase();
  const cur = channels.find((c) => c.id === activeId) || channels[0];
  const groups = [];
  for (const c of channels) {
    const idn = channelIdentity(c);
    const models = normalizeChannelModels(c);
    const items = (models.length ? models : [{ id: '', name: '未设模型' }]).filter((m) => {
      if (!q) return true;
      return `${idn.source} ${m.name}`.toLowerCase().includes(q);
    });
    if (!items.length) continue;
    const rows = items.map((m) => {
      const activeModel = cur ? resolveChannelModel(cur) : null;
      const isActive = !!(cur && c.id === cur.id && (
        (m.id && (m.id === cur.activeModelId || m.id === activeModel?.id))
        || (!!m.name && m.name === activeModel?.name)
      ));
      const title = `${idn.source} · ${m.name}`;
      return `<button type="button" role="menuitem" class="ccm-item${isActive ? ' active' : ''}" data-ch="${escAttr(c.id)}" data-mid="${escAttr(m.id)}" ${m.id ? '' : 'disabled '}title="${escAttr(title)}">`
        + `<span class="ccm-check">${isActive ? '&#10003;' : ''}</span>`
        + `<span class="ccm-name">${escHtml(m.name)}</span>`
        + '</button>';
    }).join('');
    groups.push(
      `<div class="ccm-group" role="group" aria-label="${escAttr(idn.source)}">`
      + `<div class="ccm-group-label">${escHtml(idn.source)}</div>`
      + rows
      + '</div>'
    );
  }
  if (!channels.length) return '<div class="ccm-empty">尚未配置渠道，请到设置页新增</div>';
  if (!groups.length) return '<div class="ccm-empty">没有匹配的模型</div>';
  return groups.join('');
}

const SLIDE_SNAP_ENTER = 12;
const SLIDE_SNAP_LEAVE = 18;
const ALL_EFFORT_IDS = EFFORT_LEVELS.map((x) => x.id);

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function lerpNumeric(ratio, values) {
  const n = values.length;
  if (!n) return 0;
  if (n === 1) return values[0];
  const p = clamp01(ratio) * (n - 1);
  const i = Math.min(n - 2, Math.floor(p));
  const f = p - i;
  return values[i] + f * (values[i + 1] - values[i]);
}

function ratioFromNumeric(value, values) {
  const n = values.length;
  if (n <= 1) return 0;
  const v = Number(value);
  if (v <= values[0]) return 0;
  if (v >= values[n - 1]) return 1;
  for (let i = 0; i < n - 1; i++) {
    if (v <= values[i + 1]) {
      const span = values[i + 1] - values[i] || 1;
      return (i + (v - values[i]) / span) / (n - 1);
    }
  }
  return 1;
}

function nearestTickIfClose(value, values) {
  if (!values.length) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - value);
    if (d < bestD) { bestD = d; best = i; }
  }
  const tol = Math.max(1500, values[best] * 0.02);
  return bestD <= tol ? best : -1;
}

function magnetizeRatio(ratio, count, travelPx, lastSnapped) {
  const r = clamp01(ratio);
  if (count <= 1 || travelPx <= 0) return { ratio: 0, snapped: 0 };
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const dist = Math.abs(r - t) * travelPx;
    const limit = lastSnapped === i ? SLIDE_SNAP_LEAVE : SLIDE_SNAP_ENTER;
    if (dist <= limit && dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  if (best >= 0) return { ratio: best / (count - 1), snapped: best };
  return { ratio: r, snapped: -1 };
}

function nearestTickRatio(ratio, count) {
  if (count <= 1) return { ratio: 0, snapped: 0 };
  const i = Math.max(0, Math.min(count - 1, Math.round(clamp01(ratio) * (count - 1))));
  return { ratio: i / (count - 1), snapped: i };
}

const SLIDE_SPRING = { stiffness: 340, damping: 24, mass: 1 };
const SLIDE_EASE = 'cubic-bezier(0.34, 1.28, 0.46, 1)';

function prefersSlideReduce() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function rubberRatio(r) {
  if (r < 0) return -((-r) / (1 + (-r) * 2.4));
  if (r > 1) return 1 + ((r - 1) / (1 + (r - 1) * 2.4));
  return r;
}

function slideReleaseVelocity(samples, well) {
  if (!samples || samples.length < 2) return 0;
  const a = samples[0];
  const b = samples[samples.length - 1];
  const dt = (b.t - a.t) / 1000;
  const w = well.getBoundingClientRect().width || 1;
  if (dt < 0.012 || w <= 0) return 0;
  return Math.max(-7, Math.min(7, (b.x - a.x) / w / dt));
}

function detachSlideSpring(slider) {
  if (slider && slider._slideTick) {
    gsap.ticker.remove(slider._slideTick);
    slider._slideTick = null;
  }
}

function setSlideRatio(slider, ratio) {
  slider.dataset.ratio = String(ratio);
  slider.style.setProperty('--p', String(ratio));
}

function paintSlideChrome(slider, ratio, snapped) {
  const ticks = (slider.dataset.values || '').split(',').filter(Boolean);
  slider.dataset.snapped = String(snapped);
  slider.classList.toggle('is-snapped', snapped >= 0);
  const label = slideValueLabel(slider.dataset.kind, ticks, ratio, snapped);
  const btn = slider.querySelector('.ccm-slide-btn');
  if (btn && btn.textContent !== label) {
    btn.textContent = label;
    slider.style.setProperty('--bw', `${Math.max(52, btn.offsetWidth || 52)}px`);
  }
  slider.setAttribute('aria-valuetext', label);
  slider.querySelectorAll('.ccm-slide-mark').forEach((el, idx) => {
    el.classList.toggle('is-on', idx === snapped);
  });
}

function pulseSlideTick(slider, index) {
  if (index < 0 || prefersSlideReduce()) return;
  const el = slider.querySelectorAll('.ccm-slide-mark')[index];
  if (!el) return;
  gsap.fromTo(el, { '--s': 1.22 }, {
    '--s': 1,
    duration: 0.4,
    ease: SLIDE_EASE,
    overwrite: true,
  });
}

function applySlideVisual(slider, ratio, snapped) {
  detachSlideSpring(slider);
  setSlideRatio(slider, ratio);
  paintSlideChrome(slider, ratio, snapped);
}

function slideSettle(slider, to, snapped, velocity) {
  return new Promise((resolve) => {
    detachSlideSpring(slider);
    const from = Number(slider.dataset.ratio) || 0;
    const vel = Number(velocity) || 0;
    paintSlideChrome(slider, to, snapped);
    pulseSlideTick(slider, snapped);
    if (prefersSlideReduce() || (Math.abs(from - to) < 0.0015 && Math.abs(vel) < 0.12)) {
      setSlideRatio(slider, to);
      resolve();
      return;
    }
    let x = from;
    let v = vel;
    let prev = performance.now();
    let safety = 0;
    const { stiffness, damping, mass } = SLIDE_SPRING;
    const tick = () => {
      const now = performance.now();
      let dt = Math.min(0.034, (now - prev) / 1000);
      prev = now;
      const steps = dt > 0.018 ? 2 : 1;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        v += ((-stiffness * (x - to) - damping * v) / mass) * h;
        x += v * h;
      }
      setSlideRatio(slider, x);
      safety += 1;
      if ((Math.abs(v) < 0.07 && Math.abs(x - to) < 0.0018) || safety > 90) {
        setSlideRatio(slider, to);
        detachSlideSpring(slider);
        resolve();
      }
    };
    slider._slideTick = tick;
    gsap.ticker.add(tick);
  });
}

function pressSlideBtn(slider, down) {
  const btn = slider.querySelector('.ccm-slide-btn');
  if (!btn || prefersSlideReduce()) return;
  gsap.to(btn, {
    scale: down ? 1.07 : 1,
    duration: down ? 0.16 : 0.42,
    ease: down ? 'power2.out' : SLIDE_EASE,
    overwrite: true,
  });
}

function effortIndexOf(id) {
  const i = ALL_EFFORT_IDS.indexOf(id);
  return i < 0 ? 0 : i;
}

function globalToDisplayRatio(gRatio, tickIds) {
  const n = tickIds.length || 1;
  if (n <= 1) return 0;
  const gPos = clamp01(gRatio) * (ALL_EFFORT_IDS.length - 1);
  for (let i = 0; i < n - 1; i++) {
    const a = effortIndexOf(tickIds[i]);
    const b = effortIndexOf(tickIds[i + 1]);
    const hi = Math.max(a, b);
    if (gPos <= hi + 1e-6) {
      const f = b === a ? 0 : (gPos - a) / (b - a);
      return (i + clamp01(f)) / (n - 1);
    }
  }
  return 1;
}

function effortSlideState(stored, tickIds) {
  const n = tickIds.length || 1;
  const pos = n <= 1 ? 0 : 1 / (n - 1);
  const s = String(stored || '').trim();
  if (s.startsWith('r')) {
    const ratio = globalToDisplayRatio(Number(s.slice(1)) || 0, tickIds);
    return nearestTickRatio(ratio, n);
  }
  const named = resolveEffortId(s);
  const i = tickIds.indexOf(named);
  if (i >= 0) return { ratio: i * pos, snapped: i };
  const fallback = tickIds.indexOf('medium');
  const idx = fallback >= 0 ? fallback : Math.floor((n - 1) / 2);
  return { ratio: idx * pos, snapped: idx };
}

function slideValueLabel(kind, ticks, ratio, snapped) {
  if (kind === 'effort') {
    if (snapped >= 0 && ticks[snapped]) return effortLabelOf(ticks[snapped]) || ticks[snapped];
    const i = Math.round(clamp01(ratio) * Math.max(0, ticks.length - 1));
    return effortLabelOf(ticks[i]) || ticks[i] || '';
  }
  const nums = ticks.map(Number);
  const tokens = snapped >= 0 ? nums[snapped] : Math.round(lerpNumeric(ratio, nums) / 1000) * 1000;
  return formatContextLabel(tokens);
}

function slideControlHtml({ kind, label, ticks, ratio, snapped, disabled, hint }) {
  const n = ticks.length || 1;
  const r = clamp01(ratio);
  const values = ticks.map((t) => t.value).join(',');
  const valueLabel = slideValueLabel(kind, ticks.map((t) => t.value), r, snapped);
  const marks = ticks.map((t, idx) => {
    const tRatio = n <= 1 ? 0 : idx / (n - 1);
    const on = idx === snapped;
    return `<span class="ccm-slide-mark${on ? ' is-on' : ''}" data-i="${idx}" style="--t:${tRatio};--s:1" title="${escAttr(t.label)}">${escHtml(t.label)}</span>`;
  }).join('');
  return `<div class="ccm-slide${disabled ? ' is-disabled' : ''}${snapped >= 0 ? ' is-snapped' : ''}" data-kind="${escAttr(kind)}" data-values="${escAttr(values)}" data-ratio="${r}" data-snapped="${snapped}" role="slider" aria-valuetext="${escAttr(valueLabel)}" aria-disabled="${disabled ? 'true' : 'false'}" style="--p:${r}">`
    + `<div class="ccm-slide-head">`
    + `<span class="ccm-tune-label" title="${escAttr(hint || '')}">${escHtml(label)}</span>`
    + `</div>`
    + `<div class="ccm-slide-well">`
    + `<span class="ccm-slide-btn">${escHtml(valueLabel)}</span>`
    + `</div>`
    + `<div class="ccm-slide-marks">${marks}</div>`
    + `</div>`;
}

function modelTuneHtml(cur, probed) {
  if (!cur) return '';
  const active = resolveChannelModel(cur);
  const inferred = inferModelCaps(active.name, cur);
  const windowMax = Number(probed?.contextWindow) || inferred.contextWindow;
  const maxOut = Number(probed?.maxOutput) || inferred.maxOutput;
  const source = probed?.source || inferred.source;
  const effort = resolvedEffort(active.name, active.effort || cur.effort, cur);
  let ctxNow = Number(active.contextTokens || cur.contextTokens) || defaultWorkingContext(windowMax, source);
  if (ctxNow > windowMax) ctxNow = windowMax;
  const steps = contextPresets(windowMax);
  const canEffort = inferred.reasoning === 'effort';
  const probe = peekEffortProbe({ baseUrl: cur.baseUrl, model: active.name });
  const effortTicks = EFFORT_LEVELS.map((lv) => ({ value: lv.id, label: lv.label }));
  const effortState = effortSlideState(effort, effortTicks.map((t) => t.value));
  let effortHint = inferred.reasoning === 'always'
    ? '该模型思考默认开启，没有档位可调'
    : (canEffort ? '' : '当前模型不支持思考档位');
  if (canEffort && source === 'fallback') {
    effortHint = probe?.omit
      ? '该模型拒收思考参数，已省略字段；再拨档位会重新探测'
      : '未收录：可自选；协议报错会自动探测';
  }
  const ctxTicks = steps.map((n) => ({ value: String(n), label: formatContextLabel(n) }));
  const ctxSnap = nearestTickIfClose(ctxNow, steps);
  const ctxRatio = ctxSnap >= 0
    ? (steps.length <= 1 ? 0 : ctxSnap / (steps.length - 1))
    : ratioFromNumeric(ctxNow, steps);
  let meta = source === 'fallback'
    ? `常用档至 ${formatContextLabel(windowMax)} · 输出 ${formatContextLabel(maxOut)} · ${catalogSourceLabel(source)}`
    : `输入 ${formatContextLabel(windowMax)} · 输出 ${formatContextLabel(maxOut)} · ${catalogSourceLabel(source)}`;
  if (probe?.omit) meta += ' · 思考已省略';
  else if (probe?.maxEffort) meta += ` · 思考上限 ${probe.maxEffort}`;
  return `<div class="ccm-tune">`
    + slideControlHtml({
      kind: 'effort', label: 'Effort', ticks: effortTicks.length ? effortTicks : [{ value: 'off', label: 'Off' }],
      ratio: effortState.ratio, snapped: effortState.snapped, disabled: !canEffort, hint: effortHint,
    })
    + slideControlHtml({
      kind: 'context', label: 'Context', ticks: ctxTicks,
      ratio: ctxRatio, snapped: ctxSnap, disabled: false, hint: '',
    })
    + `<div class="ccm-meta">${escHtml(meta)}</div>`
    + `</div>`;
}

function toggleChatChannelMenu() {
  if (document.querySelector('.chat-channel-menu')) {
    closeChatChannelMenu();
    return;
  }
  const wrap = document.querySelector('.chat-channel-wrap');
  if (!wrap) return;
  const triggerBtn = document.getElementById('chatChannelSwitch');
  if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');

  const menu = document.createElement('div');
  menu.className = 'chat-channel-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = '<div class="ccm-search-wrap"><input class="ccm-search" type="search" placeholder="搜索模型" autocomplete="off"></div>'
    + '<div class="ccm-list"></div>'
    + '<div class="ccm-foot"></div>';
  wrap.appendChild(menu);

  const searchEl = menu.querySelector('.ccm-search');
  const listEl = menu.querySelector('.ccm-list');
  const footEl = menu.querySelector('.ccm-foot');
  let channels = [];
  let activeId = '';
  let query = '';
  let probed = null;

  let dragging = null;
  let holdPaint = false;

  const paint = () => {
    if (dragging || holdPaint) return;
    listEl.innerHTML = modelMenuHtml(channels, activeId, query);
    const cur = channels.find((c) => c.id === activeId) || channels[0];
    footEl.innerHTML = modelTuneHtml(cur, probed);
    footEl.querySelectorAll('.ccm-slide').forEach((el) => {
      const btn = el.querySelector('.ccm-slide-btn');
      if (btn) el.style.setProperty('--bw', `${Math.max(52, btn.offsetWidth || 52)}px`);
    });
  };

  const load = async () => {
    void refreshModelCatalog();
    channels = await getAiChannels();
    activeId = await getActiveChannelId();
    menuChannelCache = { channels, activeId };
    paint();
    const cur = channels.find((c) => c.id === activeId) || channels[0];
    if (!cur) return;
    const active = resolveChannelModel(cur);
    const caps = inferModelCaps(active.name, cur);
    const stored = Number(active.contextTokens || cur.contextTokens);
    if (stored > caps.contextWindow) {
      await setActiveModelTuning({ contextTokens: caps.contextWindow });
      channels = await getAiChannels();
      menuChannelCache = { channels, activeId };
      paint();
    }
  };

  const probeCurrent = () => {
    const cur = channels.find((c) => c.id === activeId) || channels[0];
    if (!cur) return;
    const active = resolveChannelModel(cur);
    probed = null;
    probeModelMeta({
      protocol: cur.protocol || 'openai',
      baseUrl: cur.baseUrl,
      apiKey: cur.apiKey,
      model: active.name,
    }).then((meta) => {
      if (!meta || !document.body.contains(menu)) return;
      probed = meta;
      paint();
    });
  };

  channels = menuChannelCache.channels;
  activeId = menuChannelCache.activeId;
  if (channels.length) paint();
  load().then(probeCurrent);

  searchEl.addEventListener('input', () => {
    query = searchEl.value;
    paint();
  });
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
  setTimeout(() => searchEl.focus(), 0);

  const wellRatio = (well, clientX) => {
    const r = well.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return (clientX - r.left) / r.width;
  };

  const moveSlider = (clientX) => {
    if (!dragging) return;
    const { slider, well } = dragging;
    dragging.samples.push({ x: clientX, t: performance.now() });
    if (dragging.samples.length > 6) dragging.samples.splice(0, dragging.samples.length - 6);
    if (Math.abs(clientX - dragging.originX) > 4) dragging.moved = true;
    if (dragging.fromMark && !dragging.moved) return;
    if (dragging.moved) detachSlideSpring(slider);
    const ticks = (slider.dataset.values || '').split(',').filter(Boolean);
    const finger = rubberRatio(wellRatio(well, clientX));
    const nearest = nearestTickRatio(clamp01(finger), ticks.length);
    dragging.snapped = slider.dataset.kind === 'effort'
      ? nearest.snapped
      : magnetizeRatio(clamp01(finger), ticks.length, well.getBoundingClientRect().width, dragging.snapped).snapped;
    setSlideRatio(slider, finger);
    paintSlideChrome(slider, finger, dragging.snapped);
  };

  const commitSlider = async (slider) => {
    const kind = slider.dataset.kind;
    const ticks = (slider.dataset.values || '').split(',').filter(Boolean);
    const ratio = Number(slider.dataset.ratio) || 0;
    const snapped = Number(slider.dataset.snapped);
    if (kind === 'effort') {
      const i = snapped >= 0 ? snapped : nearestTickRatio(ratio, ticks.length).snapped;
      const value = ticks[i];
      if (value) {
        const ch = channels.find((c) => c.id === activeId) || channels[0];
        const active = resolveChannelModel(ch);
        clearEffortProbe({ baseUrl: ch?.baseUrl, model: active?.name });
        await setActiveModelTuning({ effort: value });
      }
    }
    if (kind === 'context') {
      const nums = ticks.map(Number);
      const tokens = snapped >= 0 && Number.isFinite(nums[snapped])
        ? nums[snapped]
        : Math.round(lerpNumeric(ratio, nums) / 1000) * 1000;
      await setActiveModelTuning({ contextTokens: Math.max(16000, tokens) });
    }
    await refreshChatChannelSwitcher();
    await load();
  };

  menu.addEventListener('pointerdown', (e) => {
    const slider = e.target.closest('.ccm-slide');
    if (!slider || slider.classList.contains('is-disabled')) return;
    const well = slider.querySelector('.ccm-slide-well');
    if (!well) return;
    e.preventDefault();
    e.stopPropagation();
    const mark = e.target.closest('.ccm-slide-mark');
    const ticks = (slider.dataset.values || '').split(',').filter(Boolean);
    let snapped = Number(slider.dataset.snapped);
    detachSlideSpring(slider);
    dragging = {
      slider,
      well,
      snapped,
      samples: [{ x: e.clientX, t: performance.now() }],
      originX: e.clientX,
      moved: false,
      fromMark: !!(mark && mark.dataset.i != null),
      settlePromise: null,
    };
    slider.classList.add('is-dragging');
    pressSlideBtn(slider, true);
    try { slider.setPointerCapture(e.pointerId); } catch (_) {}
    if (dragging.fromMark) {
      snapped = Number(mark.dataset.i);
      const ratio = ticks.length <= 1 ? 0 : snapped / (ticks.length - 1);
      dragging.snapped = snapped;
      dragging.settlePromise = slideSettle(slider, ratio, snapped, 0);
    } else {
      moveSlider(e.clientX);
    }
  });
  menu.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moveSlider(e.clientX);
  });
  const endDrag = async (e) => {
    if (!dragging) return;
    const { slider, well, samples, moved, fromMark, settlePromise } = dragging;
    if (e && typeof e.clientX === 'number') {
      samples.push({ x: e.clientX, t: performance.now() });
    }
    const vel = moved ? slideReleaseVelocity(samples, well) : 0;
    const ticks = (slider.dataset.values || '').split(',').filter(Boolean);
    const kind = slider.dataset.kind;
    const raw = Number(slider.dataset.ratio) || 0;
    const clamped = clamp01(raw);
    let target;
    if (kind === 'effort') {
      target = nearestTickRatio(clamped, ticks.length);
    } else {
      const mag = magnetizeRatio(
        clamped,
        ticks.length,
        well.getBoundingClientRect().width,
        Number(slider.dataset.snapped),
      );
      target = mag.snapped >= 0 ? mag : { ratio: clamped, snapped: mag.snapped };
    }
    slider.classList.remove('is-dragging');
    pressSlideBtn(slider, false);
    dragging = null;
    try { slider.releasePointerCapture(e.pointerId); } catch (_) {}
    if (fromMark && !moved && settlePromise) {
      await settlePromise;
    } else {
      await slideSettle(slider, target.ratio, target.snapped, vel);
    }
    holdPaint = true;
    await commitSlider(slider);
    holdPaint = false;
  };
  menu.addEventListener('pointerup', endDrag);
  menu.addEventListener('pointercancel', endDrag);

  menu.addEventListener('click', async (e) => {
    if (e.target.closest('.ccm-slide')) return;
    const item = e.target.closest('.ccm-item');
    if (!item || item.disabled) return;
    e.preventDefault();
    const chId = item.dataset.ch;
    const modelId = item.dataset.mid;
    const cur = channels.find((c) => c.id === activeId) || channels[0];
    if (chId === activeId && modelId && modelId === (cur && cur.activeModelId)) {
      return;
    }
    await setActiveChannelModel(chId, modelId);
    const chans = await getAiChannels();
    const picked = chans.find((c) => c.id === chId);
    const active = picked ? resolveChannelModel(picked) : null;
    if (active && !active.contextTokens) {
      const caps = inferModelCaps(active.name, picked);
      await setActiveModelTuning({ contextTokens: defaultWorkingContext(caps.contextWindow, caps.source) });
    }
    await refreshChatChannelSwitcher();
    renderChannelManager();
    await load();
    probeCurrent();
    const fresh = await getAiChannels();
    await handoffChannel(fresh.find((c) => c.id === chId));
  });
}

async function renderSubagentSettings() {
  const builtinEl = document.getElementById('builtinAgentList');
  const customEl = document.getElementById('customAgentList');
  const chSel = document.getElementById('sgChannel');
  const limits = await getSubagentLimits().catch(() => null);
  const pEl = document.getElementById('sgMaxParallel');
  const tEl = document.getElementById('sgMaxTabs');
  const btEl = document.getElementById('sgBudgetTokens');
  const bmEl = document.getElementById('sgBudgetMinutes');
  const ckSel = document.getElementById('sgCheckChannel');
  if (pEl && limits) pEl.value = limits.maxParallel;
  if (tEl && limits) tEl.value = limits.maxTabs;
  if (btEl && limits) btEl.value = limits.budgetTokens;
  if (bmEl && limits) bmEl.value = limits.budgetMinutes;
  if (ckSel) {
    const chans = await getAiChannels().catch(() => []);
    ckSel.innerHTML = '<option value="">跟随子代理所用模型（不推荐）</option>' +
      (chans || []).map((c) => `<option value="${escAttr(c.id)}">${escHtml(c.name || c.id)}${c.model ? ` · ${escHtml(c.model)}` : ''}</option>`).join('');
    ckSel.value = (limits && limits.checkChannelId) || '';
  }
  if (builtinEl) {
    builtinEl.innerHTML = BUILTIN_AGENTS.map((a) =>
      `<div class="sg-card builtin"><strong>@${escHtml(a.name)}</strong><span>${escHtml(a.description)}</span></div>`
    ).join('');
  }
  const custom = await getCustomSubagents().catch(() => []);
  if (customEl) {
    if (!custom.length) customEl.innerHTML = '<p style="color:var(--text-muted);font-size:12px;margin:8px 0;">还没有自定义子代理。</p>';
    else {
      customEl.innerHTML = custom.map((a) =>
        `<div class="sg-card"><strong>@${escHtml(a.name)}</strong><span>${escHtml(a.description || '')}</span>` +
        `<div class="sg-card-actions"><button type="button" class="btn btn-sm" data-sg-edit="${escAttr(a.id)}">编辑</button>` +
        `<button type="button" class="btn btn-sm btn-secondary" data-sg-del="${escAttr(a.id)}">删除</button></div></div>`
      ).join('');
    }
  }
  if (chSel) {
    const keep = chSel.value;
    const chans = await getAiChannels().catch(() => []);
    chSel.innerHTML = '<option value="">跟随当前渠道</option>' +
      (chans || []).map((c) => `<option value="${escAttr(c.id)}">${escHtml(c.name || c.id)}</option>`).join('');
    chSel.value = keep;
  }
}

async function saveCustomSubagentFromForm() {
  const status = document.getElementById('sgStatus');
  const name = (document.getElementById('sgName')?.value || '').trim().toLowerCase();
  const description = (document.getElementById('sgDesc')?.value || '').trim();
  const prompt = (document.getElementById('sgPrompt')?.value || '').trim();
  const toolsRaw = (document.getElementById('sgTools')?.value || '*').trim();
  const channelId = document.getElementById('sgChannel')?.value || '';
  const editId = document.getElementById('sgSaveBtn')?.dataset.editId;
  const tools = toolsRaw === '*' ? ['*'] : toolsRaw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
  const list = await getCustomSubagents();
  const err = validateCustomAgent(
    { id: editId, name, description, prompt, tools },
    list.filter((a) => a.id !== editId).map((a) => a.name),
  );
  if (err) {
    if (status) status.textContent = err;
    return;
  }
  const next = {
    id: editId || ('sgc_' + Date.now().toString(36)),
    name, description, prompt, tools, channelId,
  };
  const others = list.filter((a) => a.id !== next.id);
  await saveCustomSubagents([...others, next]);
  invalidateAgentListCache();
  if (document.getElementById('sgSaveBtn')) document.getElementById('sgSaveBtn').dataset.editId = '';
  ['sgName', 'sgDesc', 'sgPrompt'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  const toolsEl = document.getElementById('sgTools');
  if (toolsEl) toolsEl.value = '*';
  if (status) status.textContent = '已保存';
  renderSubagentSettings();
}

const SETTINGS_TABS = [
  { id: 'talk', label: '对话' },
  { id: 'feed', label: '订阅' },
  { id: 'look', label: '界面' },
  { id: 'keep', label: '维护' },
];
const SETTINGS_PANE_KEY = 'citecat.settingsPane';
const settingsPaneScroll = new Map();

function readSettingsPane() {
  try {
    const id = sessionStorage.getItem(SETTINGS_PANE_KEY);
    if (SETTINGS_TABS.some((t) => t.id === id)) return id;
  } catch (_) { /* 侧栏被限制存储时退回第一页 */ }
  return SETTINGS_TABS[0].id;
}

function placeSettingsTabPill() {
  const bar = document.getElementById('settingsTabBar');
  const pill = document.getElementById('settingsTabPill');
  const active = bar && bar.querySelector('.settings-tab.active');
  if (!bar || !pill || !active || !active.offsetWidth) return;
  pill.style.width = active.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + active.offsetLeft + 'px)';
}

function showSettingsPane(id) {
  if (!SETTINGS_TABS.some((t) => t.id === id)) id = SETTINGS_TABS[0].id;
  const root = document.getElementById('panelSettings');
  if (!root) return;
  const scroller = root.querySelector('.settings-inner');
  const current = root.querySelector('.settings-pane:not([hidden])');
  const same = !!(current && current.dataset.settingsPane === id);
  if (!same && scroller && current) {
    settingsPaneScroll.set(current.dataset.settingsPane, scroller.scrollTop);
  }
  root.querySelectorAll('.settings-tab').forEach((btn) => {
    const on = btn.dataset.settingsPane === id;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
  });
  root.querySelectorAll('.settings-pane').forEach((pane) => {
    pane.hidden = pane.dataset.settingsPane !== id;
  });
  try { sessionStorage.setItem(SETTINGS_PANE_KEY, id); } catch (_) {}
  if (scroller && !same) scroller.scrollTop = settingsPaneScroll.get(id) || 0;
  placeSettingsTabPill();
}

function mountSettingsTabs() {
  const bar = document.getElementById('settingsTabBar');
  if (!bar || bar.dataset.ready) return;
  bar.dataset.ready = '1';
  bar.innerHTML = '<span class="settings-tab-pill" id="settingsTabPill" aria-hidden="true"></span>'
    + SETTINGS_TABS.map((t) =>
      `<button type="button" class="settings-tab" role="tab" data-settings-pane="${t.id}" aria-selected="false" tabindex="-1">${t.label}</button>`
    ).join('');
  bar.addEventListener('click', (e) => {
    const tab = e.target.closest('.settings-tab');
    if (!tab || !bar.contains(tab)) return;
    showSettingsPane(tab.dataset.settingsPane);
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...bar.querySelectorAll('.settings-tab')];
    const i = tabs.findIndex((b) => b.classList.contains('active'));
    if (i < 0) return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    e.preventDefault();
    showSettingsPane(next.dataset.settingsPane);
    next.focus();
  });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(placeSettingsTabPill).observe(bar);
  }
  showSettingsPane(readSettingsPane());
}

// 设置面板此时还是 display:none，滑块等打开后再量。先把标签画上，避免等数据时出现空轨道。
mountSettingsTabs();

function bindSettingsEvents() {
  if (settingsEventsBound) return;
  settingsEventsBound = true;

  mountSettingsTabs();

  // AI Memory: clear all
  const clearMemBtn = document.getElementById('clearMemoryBtn');
  if (clearMemBtn) {
    clearMemBtn.addEventListener('click', async () => {
      await chrome.storage.local.set({ agentMemories: [] });
      renderMemoryList();
    });
  }

  // 数据维护：清空所有库内容（保留 AI 记忆与订阅）
  const purgeAllBtn = document.getElementById('purgeAllLibraryBtn');
  if (purgeAllBtn) {
    purgeAllBtn.addEventListener('click', async () => {
      const status = document.getElementById('purgeAllStatus');
      const ids = projects.map((p) => p.id);
      if (!ids.length) { if (status) status.textContent = '没有库'; return; }
      purgeAllBtn.disabled = true;
      if (status) status.textContent = '正在清空…';
      try {
        const snaps = await purgeProjects(ids);
        entries = await getEntries(currentProject);
        render();
        renderProjects();
        notifyCollectionStatusChanged({ refreshAll: true });
        const total = snaps.reduce((n, s) => n + (s.entries || []).length, 0);
        if (status) status.textContent = `已清空 ${total} 个条目（${snaps.length} 个库）`;
        showUndoToast(`已清空 ${snaps.length} 个库的全部内容`, async () => {
          await restoreProjects(snaps);
          entries = await getEntries(currentProject);
          render();
          renderProjects();
          notifyCollectionStatusChanged({ refreshAll: true });
          if (status) status.textContent = '已撤销';
        });
      } catch (err) {
        if (status) status.textContent = '清空失败：' + ((err && err.message) || err);
      } finally {
        purgeAllBtn.disabled = false;
      }
    });
  }

  const sgLimitsSaveBtn = document.getElementById('sgLimitsSaveBtn');
  if (sgLimitsSaveBtn) {
    sgLimitsSaveBtn.addEventListener('click', async () => {
      const next = await setSubagentLimits({
        maxParallel: document.getElementById('sgMaxParallel')?.value,
        maxTabs: document.getElementById('sgMaxTabs')?.value,
        budgetTokens: document.getElementById('sgBudgetTokens')?.value,
        budgetMinutes: document.getElementById('sgBudgetMinutes')?.value,
        checkChannelId: document.getElementById('sgCheckChannel')?.value ?? undefined,
      });
      const pEl = document.getElementById('sgMaxParallel');
      const tEl = document.getElementById('sgMaxTabs');
      const btEl = document.getElementById('sgBudgetTokens');
      const bmEl = document.getElementById('sgBudgetMinutes');
      if (pEl) pEl.value = next.maxParallel;
      if (tEl) tEl.value = next.maxTabs;
      if (btEl) btEl.value = next.budgetTokens;
      if (bmEl) bmEl.value = next.budgetMinutes;
      showSettingsStatus('sgLimitsStatus', '已保存', 'success');
    });
  }
  const sgSaveBtn = document.getElementById('sgSaveBtn');
  if (sgSaveBtn) {
    sgSaveBtn.addEventListener('click', saveCustomSubagentFromForm);
  }
  const sgCustom = document.getElementById('customAgentList');
  if (sgCustom) {
    sgCustom.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-sg-del]');
      const edit = e.target.closest('[data-sg-edit]');
      if (del) {
        const id = del.dataset.sgDel;
        const list = await getCustomSubagents();
        await saveCustomSubagents(list.filter((a) => a.id !== id));
        invalidateAgentListCache();
        renderSubagentSettings();
        return;
      }
      if (edit) {
        const id = edit.dataset.sgEdit;
        const list = await getCustomSubagents();
        const a = list.find((x) => x.id === id);
        if (!a) return;
        document.getElementById('sgName').value = a.name || '';
        document.getElementById('sgDesc').value = a.description || '';
        document.getElementById('sgPrompt').value = a.prompt || '';
        document.getElementById('sgTools').value = Array.isArray(a.tools) ? a.tools.join(',') : '*';
        document.getElementById('sgChannel').value = a.channelId || '';
        document.getElementById('sgSaveBtn').dataset.editId = a.id;
      }
    });
  }

  // Listen for blacklist changes from quick-block
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blacklist) {
      const ta = document.getElementById('blacklistTextarea');
      if (ta) ta.value = (changes.blacklist.newValue || []).join('\n');
    }
  });
  document.getElementById('saveBlacklistBtn').addEventListener('click', async () => {
    const lines = document.getElementById('blacklistTextarea').value.split('\n').map((l) => l.trim()).filter(Boolean);
    await setBlacklist(lines);
    showSettingsStatus('blacklistStatus', '已保存', 'success');
  });

  document.getElementById('addDomainBtn').addEventListener('click', () => {
    const inp = document.getElementById('newDomainInput');
    const domain = inp.value.trim();
    if (!domain) return;
    const ta = document.getElementById('blacklistTextarea');
    const cur = ta.value.trim();
    ta.value = cur ? cur + '\n' + domain : domain;
    inp.value = '';
  });

  document.getElementById('addCurrentBtn').addEventListener('click', async () => {
    try {
      const tab = await getBrowsingTab();
      if (tab?.url) {
        const hostname = new URL(tab.url).hostname;
        const ta = document.getElementById('blacklistTextarea');
        const cur = ta.value.trim();
        ta.value = cur ? cur + '\n' + hostname : hostname;
        showSettingsStatus('blacklistStatus', `已添加: ${hostname}`, 'success');
      }
    } catch {
      showSettingsStatus('blacklistStatus', '无法获取当前网站域名', 'error');
    }
  });

  /* ---- 渠道管理事件 ---- */
  document.getElementById('addChannelBtn')?.addEventListener('click', async () => {
    openChannelEditor(null);
  });
  // 预设填充用芯片代替下拉：点击即填（原生 select 弹层在侧栏里收不起来）
  const chipsEl = document.getElementById('chPresetChips');
  if (chipsEl) {
    chipsEl.innerHTML = PROVIDER_PRESETS
      .filter((p) => p.id !== 'custom')
      .map((p) => `<button type="button" class="preset-chip" data-preset="${p.id}">${escHtml(p.label.split('（')[0])}</button>`)
      .join('');
    chipsEl.addEventListener('click', (e) => {
      const btnChip = e.target.closest('.preset-chip');
      if (!btnChip) return;
      const preset = PROVIDER_PRESETS.find((p) => p.id === btnChip.dataset.preset);
      if (!preset) return;
      if (preset.baseUrl) document.getElementById('chBaseUrl').value = preset.baseUrl;
      if (preset.protocol) document.getElementById('chProtocol').value = preset.protocol;
      fillChannelModelsFromPreset(preset);
      const nameEl = document.getElementById('chName');
      if (!nameEl.value.trim()) nameEl.value = preset.label.split('（')[0];
      showSettingsStatus('chStatus', `已填入 ${preset.label.split('（')[0]}`, 'success');
    });
  }
  document.getElementById('saveChannelBtn')?.addEventListener('click', () => submitChannelForm({ asNew: false }));
  document.getElementById('saveAsNewChannelBtn')?.addEventListener('click', () => submitChannelForm({ asNew: true }));
  document.getElementById('cancelChannelBtn')?.addEventListener('click', closeChannelEditor);
  document.getElementById('addChannelModelBtn')?.addEventListener('click', () => addChannelModelRow());
  document.getElementById('chModelList')?.addEventListener('click', (e) => {
    const del = e.target.closest('.ch-model-del');
    if (!del) return;
    const rows = document.querySelectorAll('#chModelList .ch-model-row');
    if (rows.length <= 1) return;
    del.closest('.ch-model-row')?.remove();
    syncChannelModelRowActions();
  });
  document.getElementById('testChannelBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('testChannelBtn');
    const f = readChannelForm();
    if (!f.baseUrl || !f.models.length) { showSettingsStatus('chStatus', '请先填 Base URL 和至少一个模型名称', 'error'); return; }
    btn.disabled = true;
    btn.textContent = '测试中...';
    const result = await testApiConnection(f);
    btn.disabled = false;
    btn.textContent = '测试连接';
    showSettingsStatus('chStatus', result.success ? '连接成功！' : `失败: ${result.error || ''}`, result.success ? 'success' : 'error');
  });
  document.getElementById('channelList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if (act === 'use') await switchChannel(id);
    if (act === 'edit') {
      const chans = await getAiChannels();
      openChannelEditor(chans.find((c) => c.id === id) || null);
    }
    if (act === 'del') {
      const chans = await getAiChannels();
      if (chans.length <= 1) { showSettingsStatus('channelStatus', '至少保留一个渠道', 'error'); return; }
      if (!confirm(`删除渠道「${btn.dataset.name}」？`)) return;
      const next = chans.filter((c) => c.id !== id);
      await saveAiChannels(next);
      if (await getActiveChannelId() === id) await setActiveChannelId(next[0].id); // 删除激活渠道 → 回落到第一个
      renderChannelManager();
      showSettingsStatus('channelStatus', '已删除', 'success');
    }
  });

  bindSearchChannelEvents();

  document.getElementById('addApiConnectorBtn')?.addEventListener('click', () => {
    openApiEditor(null, { afterAdd: true });
    showSettingsStatus('apiConnectorStatus', '', '');
  });
  document.getElementById('apiConnAuth')?.addEventListener('change', syncApiAuthFields);
  document.getElementById('apiPresetChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    fillApiPreset(API_PRESETS.find((p) => p.id === btn.dataset.preset));
  });
  document.getElementById('saveApiConnectorBtn')?.addEventListener('click', () => persistApiEditor());
  document.getElementById('cancelApiConnectorBtn')?.addEventListener('click', () => {
    const ed = document.getElementById('apiConnectorEditor');
    if (ed) ed.hidden = true;
    editingApiConnectorId = null;
    document.getElementById('apiConnectorList')?.querySelectorAll('.channel-row.active')
      .forEach((row) => row.classList.remove('active'));
  });
  document.getElementById('testApiConnectorBtn')?.addEventListener('click', async () => {
    const saved = await persistApiEditor();
    if (!saved) return;
    const btn = document.getElementById('testApiConnectorBtn');
    if (btn) { btn.disabled = true; btn.textContent = '测试中...'; }
    const result = await executeApiCall({ action: 'test', connector: saved.name });
    showSettingsStatus('apiConnEditStatus', result.ok ? `HTTP ${result.status}` : `失败: ${(result.error || '').slice(0, 120)}`, result.ok ? 'success' : 'error');
    if (btn) { btn.disabled = false; btn.textContent = '测试 GET'; }
  });
  document.getElementById('apiConnectorList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-api-act]');
    if (!btn) return;
    const list = await loadConnectors();
    const hit = list.find((c) => c.id === btn.dataset.id);
    if (btn.dataset.apiAct === 'edit') {
      if (!hit) {
        showSettingsStatus('apiConnectorStatus', '找不到这条连接', 'error');
        return;
      }
      openApiEditor(hit, { anchor: btn.closest('.channel-row') });
      return;
    }
    if (btn.dataset.apiAct === 'del') {
      if (!confirm(`删除 API 连接「${btn.dataset.name}」？`)) return;
      await saveConnectors(list.filter((c) => c.id !== btn.dataset.id));
      if (editingApiConnectorId === btn.dataset.id) {
        editingApiConnectorId = null;
        const ed = document.getElementById('apiConnectorEditor');
        if (ed) ed.hidden = true;
      }
      await renderApiConnectors();
      showSettingsStatus('apiConnectorStatus', '已删除', 'success');
    }
  });

  // Feed translation prefs
  const savePrefsBtn = document.getElementById('saveFeedPrefsBtn');
  if (savePrefsBtn) {
    savePrefsBtn.addEventListener('click', async () => {
      const provider = (document.getElementById('translateProvider')?.value) || 'google';
      const data = {
        defaultAutoTranslate: document.getElementById('feedAutoTranslate').checked,
        defaultTargetLanguage: document.getElementById('feedTargetLang').value,
        translateProvider: provider,
        tencentSecretId: (document.getElementById('tencentSecretId')?.value || '').trim(),
        tencentRegion: (document.getElementById('tencentRegion')?.value || 'ap-shanghai'),
      };
      const keyInput = (document.getElementById('tencentSecretKey')?.value || '').trim();
      if (keyInput) data.tencentSecretKey = keyInput; // only update if user typed something
      const resp = await chrome.runtime.sendMessage({
        type: 'FEED_SET_PREFS',
        data: { prefs: data },
      }).catch((err) => ({ success: false, error: err?.message }));
      if (resp && resp.success) {
        showSettingsStatus('feedPrefsStatus', '已保存', 'success');
        const tKeyEl = document.getElementById('tencentSecretKey');
        if (tKeyEl) { tKeyEl.value = ''; tKeyEl.placeholder = '已保存（留空保持不变）'; }
      } else {
        showSettingsStatus('feedPrefsStatus', '保存失败: ' + (resp?.error || '未知'), 'error');
      }
    });
  }

  const testTencentBtn = document.getElementById('testTencentBtn');
  if (testTencentBtn) {
    testTencentBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('tencentTestStatus');
      testTencentBtn.disabled = true;
      testTencentBtn.textContent = '测试中...';
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'status-msg'; }
      const resp = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_TEST_PROVIDER',
        data: {
          provider: 'tencent',
          tencent: {
            secretId: (document.getElementById('tencentSecretId')?.value || '').trim(),
            secretKey: (document.getElementById('tencentSecretKey')?.value || '').trim(),
            region: (document.getElementById('tencentRegion')?.value || 'ap-shanghai'),
          },
        },
      }).catch((err) => ({ success: false, error: err?.message }));
      testTencentBtn.disabled = false;
      testTencentBtn.textContent = '测试腾讯连接';
      if (resp && resp.success && resp.ok) {
        if (statusEl) { statusEl.textContent = '连接成功: ' + (resp.sample || ''); statusEl.className = 'status-msg success'; }
      } else {
        const msg = (resp && (resp.error || resp.result?.error)) || '失败';
        if (statusEl) { statusEl.textContent = '失败: ' + msg; statusEl.className = 'status-msg error'; }
      }
    });
  }

  const provSelect = document.getElementById('translateProvider');
  if (provSelect) provSelect.addEventListener('change', toggleTencentCredVisibility);

  const retryFailedBtn = document.getElementById('retryFailedTranslationsBtn');
  if (retryFailedBtn) {
    retryFailedBtn.addEventListener('click', async () => {
      retryFailedBtn.disabled = true;
      retryFailedBtn.textContent = '重置中...';
      const resp = await chrome.runtime.sendMessage({ type: 'TRANSLATE_RETRY_FAILED' })
        .catch((err) => ({ success: false, error: err?.message }));
      retryFailedBtn.disabled = false;
      retryFailedBtn.textContent = '重试失败条目';
      if (resp && resp.success) {
        showSettingsStatus('feedPrefsStatus', '已重置 ' + (resp.reset || 0) + ' 条，正在重新翻译…', 'success');
      } else {
        showSettingsStatus('feedPrefsStatus', '重置失败: ' + (resp?.error || '未知'), 'error');
      }
    });
  }

  // 全文索引手动重建：清空断点 -> 侧栏循环驱动 SW 批次（复用 feed-view 的进度条）
  const rebuildIdxBtn = document.getElementById('feedRebuildIndexBtn');
  if (rebuildIdxBtn) {
    rebuildIdxBtn.addEventListener('click', async () => {
      if (!confirm('确定重建全文搜索索引？将清空现有索引并全量重建，数万条需几分钟。')) return;
      rebuildIdxBtn.disabled = true;
      try {
        await startManualIndexRebuild();
        const poll = setInterval(async () => {
          let st = null;
          try { st = await chrome.runtime.sendMessage({ type: 'FEED_INDEX_STATUS' }); } catch (_) {}
          if (!st || st.built || !st.total || st.done >= st.total) {
            clearInterval(poll);
            rebuildIdxBtn.disabled = false;
            showSettingsStatus('feedIndexStatus', st && st.done ? `重建完成（${st.done} 条）` : '已无可重建内容', 'success');
          } else {
            showSettingsStatus('feedIndexStatus', `重建中 ${Math.round((st.done / st.total) * 100)}%（${st.done}/${st.total}）`, '');
          }
        }, 1500);
      } catch (err) {
        rebuildIdxBtn.disabled = false;
        showSettingsStatus('feedIndexStatus', '触发失败: ' + (err?.message || err), 'error');
      }
    });
  }

  const saveRsshubBtn = document.getElementById('saveRsshubBtn');
  if (saveRsshubBtn) {
    saveRsshubBtn.addEventListener('click', async () => {
      const raw = (document.getElementById('rsshubInstance').value || '').trim();
      const normalized = raw ? raw.replace(/\/+$/, '') : 'https://rsshub.app';
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        showSettingsStatus('rsshubStatus', '实例 URL 必须以 http:// 或 https:// 开头', 'error');
        return;
      }
      const resp = await chrome.runtime.sendMessage({
        type: 'FEED_SET_PREFS',
        data: { prefs: { rsshubInstance: normalized } },
      }).catch((err) => ({ success: false, error: err?.message }));
      if (resp && resp.success) {
        document.getElementById('rsshubInstance').value = normalized;
        showSettingsStatus('rsshubStatus', '已保存', 'success');
      } else {
        showSettingsStatus('rsshubStatus', '保存失败: ' + (resp?.error || '未知'), 'error');
      }
    });
  }

  const saveRefreshIntervalBtn = document.getElementById('saveRefreshIntervalBtn');
  if (saveRefreshIntervalBtn) {
    saveRefreshIntervalBtn.addEventListener('click', async () => {
      const val = parseInt(document.getElementById('feedRefreshInterval').value, 10);
      if (isNaN(val) || val < 5 || val > 1440) {
        showSettingsStatus('refreshIntervalStatus', '请输入 5-1440 之间的数字', 'error');
        return;
      }
      const resp = await chrome.runtime.sendMessage({
        type: 'FEED_SET_PREFS',
        data: { prefs: { intervalMin: val } },
      }).catch((err) => ({ success: false, error: err?.message }));
      if (resp && resp.success) {
        showSettingsStatus('refreshIntervalStatus', `已保存，每 ${val} 分钟刷新一次`, 'success');
      } else {
        showSettingsStatus('refreshIntervalStatus', '保存失败: ' + (resp?.error || '未知'), 'error');
      }
    });
  }

  // Listen for translate progress broadcasts from SW
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'TRANSLATE_PROGRESS') {
      renderTranslateProgress(message.data);
    }
  });
  refreshTranslateProgress();
  // Check for extension updates
  const versionEl = document.getElementById('extVersion');
  if (versionEl) versionEl.textContent = chrome.runtime.getManifest().version;

  // Auto-reload when Chrome has downloaded an update
  chrome.runtime.onUpdateAvailable.addListener((details) => {
    const statusEl = document.getElementById('updateStatus');
    if (statusEl) { statusEl.textContent = `新版本 v${details.version} 已就绪，正在重启...`; statusEl.className = 'status-msg success'; }
    setTimeout(() => chrome.runtime.reload(), 1000);
  });

  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('updateStatus');
      checkUpdateBtn.disabled = true;
      if (statusEl) { statusEl.textContent = '检查中...'; statusEl.className = 'status-msg'; }
      try {
        const resp = await fetch('http://47.104.128.124/citecat/update.xml?t=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) throw new Error('服务器不可达');
        const xml = await resp.text();
        const verMatch = xml.match(/<updatecheck[^>]*version=['"]([^'"]+)['"]/);
        const serverVersion = verMatch ? verMatch[1] : null;
        const currentVersion = chrome.runtime.getManifest().version;
        if (!serverVersion) {
          if (statusEl) { statusEl.textContent = '无法解析服务器版本信息'; statusEl.className = 'status-msg'; }
        } else if (serverVersion !== currentVersion) {
          if (statusEl) { statusEl.textContent = `发现新版本 v${serverVersion}，正在下载...`; statusEl.className = 'status-msg success'; }
          chrome.runtime.requestUpdateCheck(() => {});
          // If Chrome doesn't fire onUpdateAvailable within 15s, guide user to manual update
          let updated = false;
          const timeout = setTimeout(() => {
            if (!updated) {
              const isEdge = navigator.userAgent.includes('Edg/');
              const extPage = isEdge ? 'edge://extensions' : 'chrome://extensions';
              chrome.tabs.create({ url: extPage });
              if (statusEl) { statusEl.textContent = `新版本 v${serverVersion} 已就绪，已为你打开扩展管理页，请点击「更新」完成安装`; statusEl.className = 'status-msg'; }
              checkUpdateBtn.disabled = false;
            }
          }, 15000);
          chrome.runtime.onUpdateAvailable.addListener(function listener(details) {
            updated = true;
            clearTimeout(timeout);
            chrome.runtime.onUpdateAvailable.removeListener(listener);
            if (statusEl) { statusEl.textContent = `新版本 v${details.version} 已就绪，正在重启...`; statusEl.className = 'status-msg success'; }
            setTimeout(() => chrome.runtime.reload(), 1000);
          });
        } else {
          if (statusEl) { statusEl.textContent = `已是最新版本 v${currentVersion}`; statusEl.className = 'status-msg'; }
        }
      } catch (err) {
        if (statusEl) { statusEl.textContent = '检查失败：' + (err.message || '网络错误'); statusEl.className = 'status-msg'; }
      }
      checkUpdateBtn.disabled = false;
    });
  }
}

function showSettingsStatus(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  if (type === 'success') setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 3000);
}

function toggleTencentCredVisibility() {
  const provider = document.getElementById('translateProvider')?.value || 'google';
  const group = document.getElementById('tencentCredGroup');
  if (group) group.style.display = (provider === 'tencent') ? '' : 'none';
}

function renderTranslateProgress(data) {
  const area = document.getElementById('translateProgressArea');
  const label = document.getElementById('translateProgressLabel');
  const fill = document.getElementById('translateProgressFill');
  if (!area || !label || !fill) return;
  if (!data) {
    area.hidden = true;
    fill.style.transform = 'scaleX(0)';
    return;
  }
  const running = !!data.running;
  const download = data.download;
  const total = data.total || 0;
  const done = data.done || 0;
  if (!running && !download && total === 0) {
    area.hidden = true;
    fill.style.transform = 'scaleX(0)';
    return;
  }
  area.hidden = false;
  if (download) {
    const loadedMb = ((download.loaded || 0) / (1024 * 1024)).toFixed(1);
    fill.style.transform = 'scaleX(1)';
    label.textContent = '正在下载翻译模型 ' + (download.pair || '') + '（已下载 ' + loadedMb + ' MB）…';
    return;
  }
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  fill.style.transform = 'scaleX(' + (pct / 100) + ')';
  if (running) {
    label.textContent = '翻译中 ' + done + '/' + total + '（' + pct + '%）';
  } else {
    label.textContent = '翻译完成 ' + done + '/' + total;
    setTimeout(() => {
      const a = document.getElementById('translateProgressArea');
      if (a) a.hidden = true;
    }, 1500);
  }
}

async function refreshTranslateProgress() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'TRANSLATE_GET_STATUS' });
    if (resp && resp.success) renderTranslateProgress(resp.data);
  } catch (_) {}
}

// Enter key for library input
document.getElementById('newLibraryInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addLibraryBtn').click();
});

// Enter key for domain input
const domainInp = document.getElementById('newDomainInput');
if (domainInp) domainInp.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addDomainBtn').click();
});

// Chat column width (left rail of panelCollect)
const chatDivider = document.getElementById('chatDivider');

const MIN_CHAT_W = 240;
const DEFAULT_CHAT_W = 380;
const MAX_CHAT_W = 560;
const PAGE_CHAT_MAX = 800;

function collapsedChatWidth(panelW) {
  const w = panelW || window.innerWidth || MAX_CHAT_W;
  if (document.body.classList.contains('surface-page')) return Math.min(PAGE_CHAT_MAX, w);
  return w;
}
const CHANNEL_MENU_W = 280; // 与 .chat-channel-menu width 对齐
const CHANNEL_MENU_GUTTER = 12;

function measureMinChatWidth() {
  const wrap = document.querySelector('.chat-channel-wrap');
  if (chatCol && wrap) {
    const colLeft = chatCol.getBoundingClientRect().left;
    const wrapLeft = wrap.getBoundingClientRect().left;
    const inset = Math.max(0, wrapLeft - colLeft);
    return Math.ceil(inset + CHANNEL_MENU_W + CHANNEL_MENU_GUTTER);
  }
  return 372;
}

function minChatWidth() {
  if (libCollapsed || wsNarrow) return MIN_CHAT_W;
  return Math.max(MIN_CHAT_W, measureMinChatWidth());
}

function maxChatWidth() {
  const panelW = panelCollectEl ? panelCollectEl.clientWidth : 0;
  if (!panelW || libCollapsed || wsNarrow) return MAX_CHAT_W;
  return Math.min(MAX_CHAT_W, Math.max(minChatWidth(), panelW - MIN_WORKSPACE_W - CHAT_DIVIDER_W));
}

function applyChatLayout(w, persist = true) {
  if (!chatCol || !chatDivider) return;
  const clamped = Math.max(minChatWidth(), Math.min(maxChatWidth(), w));
  chatCol.style.width = clamped + 'px';
  chatWidth = clamped;
  if (persist) {
    chrome.storage.local.set({ [`chatWidth_${currentProject}`]: clamped }).catch(() => {});
  }
}

// 工作区折叠/展开 toggle（宽屏）；窄屏由“对话 ↔ 工作区”按钮切换。
const toggleLibBtn = document.getElementById('toggleLibBtn');
function applyLibCollapsed(collapsed, animate = true, persist = true) {
  libCollapsed = collapsed;
  if (panelCollectEl) panelCollectEl.classList.toggle('lib-collapsed', collapsed);
  syncWorkspaceToggleBtn();
  // 折叠：对话占满。展开：对话保持当前像素宽度（有下限，用户可拖分割线改）。
  if (chatCol) {
    if (!animate) chatCol.style.transition = 'none';
    if (collapsed) {
      const w = panelCollectEl ? panelCollectEl.clientWidth : window.innerWidth;
      chatCol.style.width = collapsedChatWidth(w) + 'px';
    } else {
      applyChatLayout(chatWidth, false);
    }
    if (!animate) {
      void chatCol.offsetWidth;
      chatCol.style.transition = '';
    }
  }
  if (persist) {
    chrome.storage.local.set({ [`libOpen_${currentProject}`]: !collapsed }).catch(() => {});
  }
}
if (toggleLibBtn) {
  toggleLibBtn.addEventListener('click', () => {
    if (wsNarrow) {
      setNarrowWorkspaceView(!wsShowWorkspace);
      return;
    }
    const panelW = panelCollectEl ? panelCollectEl.clientWidth : 0;
    if (libCollapsed) {
      if (leftoverAfterChat(panelW) < LIB_OPEN_LEFT) applyChatLayout(minChatWidth(), false);
      const leftover = leftoverAfterChat(panelW);
      applyStage(resolveStage(leftover, 0), { animate: true, persist: true, leftover, panelW });
    } else {
      applyStage(0, { animate: true, persist: true, leftover: leftoverAfterChat(panelW), panelW });
    }
    lastSideRatio = null;
  });
}

if (chatDivider) {
  let resizing = false, startX, startW, chatZoomFactor = 1;

  chatDivider.addEventListener('mousedown', (e) => {
    resizing = true;
    startX = e.clientX;
    chatZoomFactor = getUiZoom();
    startW = chatCol ? chatCol.offsetWidth : chatWidth;
    chatDivider.classList.add('active');
    document.body.style.userSelect = 'none';
    markSideResizing();
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    // chat 在左，向右拖 = 变宽
    const dx = (e.clientX - startX) / chatZoomFactor;
    applyChatLayout(startW + dx);
    markSideResizing();
    applyLayoutFromWidth({ animate: false, persist: false });
  });

  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    chatDragged = true;
    chatDivider.classList.remove('active');
    document.body.style.userSelect = '';
    applyChatLayout(chatWidth);
    applyLayoutFromWidth({ animate: false, persist: false });
  });
}

// Restore persisted width
async function restoreChatWidth() {
  const { [`chatWidth_${currentProject}`]: saved } = await chrome.storage.local.get(`chatWidth_${currentProject}`);
  chatWidth = (typeof saved === 'number' && saved >= MIN_CHAT_W) ? saved : DEFAULT_CHAT_W;
  applyChatLayout(chatWidth, false);
}

// Restore persisted workspace collapsed state
async function restoreLibCollapsed() {
  const { [`libOpen_${currentProject}`]: saved } = await chrome.storage.local.get(`libOpen_${currentProject}`);
  // 默认只开对话：只有用户显式展开过（libOpen=true）才在宽度够时出文库。
  libCollapsed = saved !== true;
  if (panelCollectEl) panelCollectEl.classList.toggle('lib-collapsed', libCollapsed);
  layoutStage = libCollapsed ? 0 : 1;
  setPreviewCollapsed(true);
  sideRatioReady = true;
  applyLayoutFromWidth({ animate: false, persist: false });
}

// loadProjects() 已在 init() 中调用，并在 currentProject 确定后执行上述两个恢复。


/* ---------------------------------------------------------------
   滚轮滚动兜底
   背景：Chrome 的 HitTestOpaqueness 回归 / CSS zoom 非 100% 时，
   部分滚动容器（尤其绝对定位层内的 overflow:auto 子层）会收不到
   原生滚轮滚动 —— wheel 事件被合成器吞掉，文字/链接上滚轮无反应。
   方案：document 级委托监听 wheel（passive，不干预正常滚动）。
   若事件后容器 scrollTop 未变化、且按滚动方向本应可滚，
   则手动补一次滚动。原生滚动正常时两帧内 scrollTop 已变，零干预。
   不改动任何现有滚动逻辑，仅作为兜底。
   --------------------------------------------------------------- */
function attachWheelScrollFallback() {
  document.addEventListener('wheel', (e) => {
    const dy = e.deltaY;
    if (Math.abs(dy) < 1) return;
    // 从事件目标向上找第一个可滚容器
    let el = e.target;
    while (el && el !== document.documentElement) {
      if (el.scrollHeight !== undefined && el.scrollHeight > el.clientHeight + 1) {
        const cs = getComputedStyle(el);
        const oy = cs.overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          const max = el.scrollHeight - el.clientHeight;
          const before = el.scrollTop;
          const shouldScroll = (dy > 0 && before < max - 0.5) || (dy < 0 && before > 0.5);
          if (shouldScroll) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // 两帧后仍未滚动 → 原生被吞，手动补
                if (Math.abs(el.scrollTop - before) < 0.5) {
                  el.scrollTop = Math.max(0, Math.min(max, before + dy));
                }
              });
            });
          }
          break;
        }
      }
      el = el.parentElement;
    }
  }, { passive: true });
}

attachWheelScrollFallback();

