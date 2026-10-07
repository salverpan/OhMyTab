/**
 * Chat history compression, industry pattern.
 *
 * Design references:
 *   - LangChain's SummarizationMiddleware:
 *       trigger by token count / fraction, keep last N messages verbatim,
 *       preserve AI↔Tool pairs, compact older messages via LLM call, inject
 *       result as a synthetic system message.
 *   - LangGraph "manage_conversation_history": token-budget trimming with a
 *       provider-agnostic estimator.
 *   - Claude Code / Cursor: recursive summarization — the prior summary is
 *       fed back into the next compaction so information isn't lost turn
 *       after turn.
 *
 * Contract (this project's chat history is user/assistant only — tool calls
 * are ephemeral and never stored in `chatHistory`, so we don't need the
 * AI↔Tool pairing safeguards; we only need to cut on user boundaries so
 * next request always starts with a `user` message after the summary):
 *
 *   compactHistory({ history, priorSummary, apiCfg, budgetTokens, keepTailTokens })
 *     -> { history, summary, dropped, compacted: boolean, cost: usage }
 *
 * Falls back to a rule-based digest if the LLM call fails, so history
 * compression never blocks the user's message.
 */

import { chatComplete } from '../lib/providers/index.js';

/**
 * Rough token estimator. Chinese CJK chars ≈ 1 token; ASCII ≈ 4 chars/token.
 * Matches 智谱 GLM's stated ~1:1.6 ratio well enough for budgeting.
 */
export function estimateTokens(text) {
  if (!text) return 0;
  if (Array.isArray(text)) {
    text = text.map((p) => p?.text || (p?.type === 'image_url' ? '[image]' : '')).join('\n');
  }
  const s = String(text);
  let cjk = 0;
  let other = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x3000 && c <= 0x9fff) cjk++;
    else if (c >= 0xac00 && c <= 0xd7af) cjk++;
    else if (c >= 0xff00 && c <= 0xffef) cjk++;
    else other++;
  }
  return cjk + Math.ceil(other / 4);
}

export function estimateMessagesTokens(messages) {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m?.content || '');
    // 工具调用参数（tool_calls JSON）也随请求重发，计入估算
    if (m?.tool_calls) total += estimateTokens(JSON.stringify(m.tool_calls));
    total += 4; // per-message overhead (role + delimiters)
  }
  return total;
}

/**
 * Pick a cut index so that:
 *  - The tail (kept) contains at most `keepTailTokens` tokens.
 *  - The tail starts on a `user` message (so the API sees a normal turn).
 *  - Never keep less than 2 messages if history has that many.
 * Returns cut index (messages[0..cut) are dropped, messages[cut..] are kept).
 */
export function findSafeCut(messages, keepTailTokens) {
  if (messages.length <= 2) return 0;
  let tail = 0;
  let cut = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    tail += estimateTokens(messages[i].content || '') + 4;
    if (tail > keepTailTokens && i + 1 < messages.length) {
      cut = i + 1;
      break;
    }
    cut = i;
  }
  // Ensure the tail starts with a user turn
  while (cut < messages.length && messages[cut].role !== 'user') cut++;
  if (cut >= messages.length) cut = messages.length - 2;
  if (cut < 0) cut = 0;
  return cut;
}

const SUMMARY_PROMPT = `你是对话压缩助手。下面是一段较早的用户与 AI 之间的对话（可能已经含有此前的「摘要」段）。
请把它压缩成一段**中文摘要**，用于替代原文继续参与后续对话。硬性要求：

1. 保留：用户明确的意图与偏好、涉及到的关键 id / URL / 标题、AI 已经完成的操作与结果、尚未结束的悬置任务（如「等待用户确认入库」）。
2. 丢弃：寒暄、重复复述、AI 思考过程、失败重试细节、逐条工具输出。
3. 以短句和 bullet 列出，不要写小说，不要加前后套话。
4. 若原文中已有「前情摘要」，把它合并进新摘要，不要保留两份；对已过期/被后续覆盖的内容用最新版本，冲突以最新为准。
5. 严格不超过 400 字。

只输出摘要正文，不要任何说明、解释、Markdown 标题。`;

/**
 * Call the LLM to produce a summary of the dropped messages. Falls back to a
 * rule-based bullet list if the call fails.
 */
async function summarizeWithLLM(dropped, priorSummary, apiCfg) {
  const transcript = dropped.map((m) => {
    const role = m.role === 'user' ? '用户' : (m.role === 'assistant' ? 'AI' : m.role);
    const body = Array.isArray(m.content)
      ? m.content.map((p) => p?.text || (p?.type === 'image_url' ? '[图片]' : '')).join(' ')
      : String(m.content || '');
    return `${role}：${body.replace(/\s+/g, ' ').trim()}`;
  }).join('\n');
  const priorBlock = priorSummary
    ? `此前的摘要：\n${priorSummary}\n\n新增对话：\n`
    : '';
  const userContent = `${priorBlock}${transcript}`;

  // 30s 超时：溢出恢复路径会在工具循环里 await 本函数，无超时会卡死整轮
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const { content, usage } = await chatComplete(apiCfg, [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: userContent },
    ], {
      temperature: 0.2,
      maxTokens: 800,
      signal: controller.signal,
    });
    if (!content) throw new Error('empty summary');
    return { text: content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

function ruleBasedSummary(dropped, priorSummary) {
  const bullets = [];
  for (let i = 0; i < dropped.length; i += 2) {
    const u = dropped[i];
    const a = dropped[i + 1];
    if (!u) continue;
    const userLine = String(u.content || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const aiLine = a ? String(a.content || '').replace(/\s+/g, ' ').trim().slice(0, 140) : '';
    if (!userLine && !aiLine) continue;
    bullets.push(`- 用户：${userLine || '(空)'}${aiLine ? ` → AI：${aiLine}${aiLine.length >= 140 ? '…' : ''}` : ''}`);
  }
  const merged = priorSummary ? `${priorSummary}\n${bullets.join('\n')}` : bullets.join('\n');
  return merged;
}

/**
 * Main entrypoint.
 * @param {object} p
 * @param {Array<{role:string,content:string}>} p.history  Prior turns (user/assistant alternating).
 * @param {string} p.priorSummary                          Existing rolling summary, or ''.
 * @param {{apiKey:string, baseUrl:string, model:string}} p.apiCfg
 * @param {number} p.budgetTokens                          Compact if history+summary > this.
 * @param {number} p.keepTailTokens                        Approx tokens kept verbatim after compaction.
 */
export async function compactHistory({
  history,
  priorSummary,
  apiCfg,
  budgetTokens = 3000,
  keepTailTokens = 1200,
}) {
  const totalTokens = estimateMessagesTokens(history) + estimateTokens(priorSummary);
  if (totalTokens <= budgetTokens) {
    return { history, summary: priorSummary, dropped: [], compacted: false, cost: null };
  }

  const cut = findSafeCut(history, keepTailTokens);
  if (cut <= 0) {
    return { history, summary: priorSummary, dropped: [], compacted: false, cost: null };
  }
  const dropped = history.slice(0, cut);
  const kept = history.slice(cut);

  let summary = priorSummary;
  let cost = null;
  try {
    const r = await summarizeWithLLM(dropped, priorSummary, apiCfg);
    summary = r.text;
    cost = r.usage;
  } catch (err) {
    // Fall back to deterministic rule-based bullet digest.
    summary = ruleBasedSummary(dropped, priorSummary);
  }

  return { history: kept, summary, dropped, compacted: true, cost };
}
