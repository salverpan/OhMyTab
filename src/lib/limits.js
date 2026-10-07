/* AI 上下文与截断口径总表（单一事实来源）。
 * 这些数字曾在 panel / SW / 工具实现多处各自硬编码，靠人肉同步——出过
 * "侧栏 Infinity vs SW 100"不一致事故。现在统一声明于此，改口径只改本文件。
 * 每个常量注明口径与来历；增删前先读注释确认消费方。 */

/** exec_js / 图表等超长输出：短于此时直接回模型；超过则全文写入工作区，
 * 模型只拿 doc_id + 短预览（见 workspace-tools.spillOversizedOutput）。 */
export const EXEC_OUTPUT_CAP_CHARS = 30000;

/** 网络抓包单条响应正文上限（字符）。chat-executor 与 tab-session 共用。 */
export const NET_BODY_LIMIT = 80000;

/** 历史压缩保留尾部的近似 token 数：压缩后最近这段原文原样保留，
 * 更早的内容折叠成摘要。按窗口推导的触发预算见 chat-executor.contextCompactBudget。 */
export const HISTORY_KEEP_TAIL_TOKENS = 32000;

/** read 系工具单次返回的最大字符数（正文超此值自动 offset 分页，AI 续拉读完；
 * 不是截断——完整内容可通过分页拿全）。 */
export const READ_SINGLE_MAX_CHARS = 200000;

/** agent 工具循环轮数上限：防止模型陷在工具循环不收敛。侧栏与 SW 浮动聊天共用。 */
export const AGENT_MAX_ROUNDS = 100;

/** 接近轮数上限时注入 system 收尾提示，引导模型停止调工具给最终回答（软着陆非硬切）。 */
export const AGENT_WRAP_HINT_ROUND = 95;

/* 子代理轮数**不设上限**（2026-09-10 用户拍板）。旧口径是 24 轮 + 第 20 轮注入
 * 收尾提示；实测一次麦捷科技调研打满 24 轮仍在调工具，循环按预算退出时把
 * `lastText`（模型唯一说过的开场白）当报告交回，父代理收到的是 completed + 一句话。
 *
 * 2026-10-07 改为**资源预算 + 强制交回**：按累计 token 与耗时计，不按轮数。
 * 到 SUBAGENT_BUDGET_WARN_RATIO 注入收尾提示；耗尽时只给模型 submit_report 一个工具，
 * 逼它把已核实的写进 claims、没查完的写进 unresolved——旧问题是退出时丢弃了工作，
 * 不是预算本身。0 = 不限。用户可在设置「子代理」里改。 */
export const SUBAGENT_BUDGET_TOKENS = 2_000_000;
export const SUBAGENT_BUDGET_TOKENS_MAX = 50_000_000;
export const SUBAGENT_BUDGET_MINUTES = 20;
export const SUBAGENT_BUDGET_MINUTES_MAX = 240;
export const SUBAGENT_BUDGET_WARN_RATIO = 0.85;
/** 预算耗尽后的强制交回最多尝试几轮（模型仍不调 submit_report 则判 incomplete）。 */
export const SUBAGENT_FORCED_SUBMIT_ROUNDS = 2;

export function clampSubagentBudgetTokens(raw) {
  return clampInt(raw, 0, SUBAGENT_BUDGET_TOKENS_MAX, SUBAGENT_BUDGET_TOKENS);
}

export function clampSubagentBudgetMinutes(raw) {
  return clampInt(raw, 0, SUBAGENT_BUDGET_MINUTES_MAX, SUBAGENT_BUDGET_MINUTES);
}

/** 同一轮并行子代理上限（默认）。用户可在设置「子代理」里改；覆盖不全时再补一波（只补缺口）。
 * 浏览器是共享资源：配合 SUBAGENT_MAX_TABS 最坏默认 3×6=18 个后台标签。 */
export const SUBAGENT_MAX_PARALLEL = 3;
export const SUBAGENT_MAX_PARALLEL_MIN = 1;
export const SUBAGENT_MAX_PARALLEL_MAX = 12;

/** 单个子代理同时打开的标签页上限（默认）。滚动窗口而非一生配额——关旧的可以再开新的；
 * 读过的内容仍在子上下文里，关标签不等于丢内容（跨代理回放要靠 artifact 层）。 */
export const SUBAGENT_MAX_TABS = 6;
export const SUBAGENT_MAX_TABS_MIN = 1;
export const SUBAGENT_MAX_TABS_MAX = 20;

function clampInt(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function clampSubagentMaxParallel(raw) {
  return clampInt(raw, SUBAGENT_MAX_PARALLEL_MIN, SUBAGENT_MAX_PARALLEL_MAX, SUBAGENT_MAX_PARALLEL);
}

export function clampSubagentMaxTabs(raw) {
  return clampInt(raw, SUBAGENT_MAX_TABS_MIN, SUBAGENT_MAX_TABS_MAX, SUBAGENT_MAX_TABS);
}

/** 同一轮 Sub 可并行的无状态章节作业；只读已落库正文，不占浏览器标签。 */
export const SECTION_WORKER_MAX_PARALLEL = 4;
export const SECTION_WORKER_MAX_CHARS = 20000;
export const SECTION_WORKER_MAX_ROUNDS = 3;
export const SECTION_WORKER_TIMEOUT_MS = 45000;

/** Check 窄模型只处理 citation 已通过的 claims。 */
export const CHECK_BATCH_SIZE = 8;
export const CHECK_MAX_CLAIMS = 80;
export const CHECK_TIMEOUT_MS = 30000;

/** CDP debugger.attach / Page.captureScreenshot / Accessibility.getFullAXTree
 * 以及前台 captureVisibleTab 的硬超时。窗口不在前台或标签冻结时这些 Promise
 * 可能永不 settle；超时必须抛错并让 acquireBrowserLock 释放，禁止无限等。 */
export const CDP_TIMEOUT_MS = 20000;

/** 通用 call_api：单次超时与请求体上限。响应**不在源头截断**——全量文本交给
 * 执行器的溢出入库（EXEC_OUTPUT_CAP_CHARS，全文进工作区、模型拿预览 + doc_id）。
 * 密钥不进这些数字。 */
export const CALL_API_TIMEOUT_MS = 30000;
export const CALL_API_MAX_BODY = 256 * 1024;

/* 子代理交回父代理的自然语言正文不再是真相通道。
 * 长度由 TaskReport 的 summary/claims/actions/unresolved schema 约束；长来源只回
 * doc_id#anchor 与逐字 quote（见 task-report.js）。
 * 卡片显示与 chatSession 落盘不另砍工具结果：4MB 会话上限（panel.js#saveChatSession）
 * 是既有兜底。 */

/** 子代理嵌套深度。1 = 父可派子，子不能再派（OpenCode 默认 subagent_depth）。 */
export const SUBAGENT_MAX_DEPTH = 1;

/** RSS 聚合扫描（count / group_by_feed / by_day）：单页条数与单次工具调用硬顶。
 * 顶满时 truncated=true 并给 next_cursor，不把 扫描上限 当成库总量。 */
export const RSS_SCAN_PAGE = 1000;
export const RSS_SCAN_MAX = 50000;
