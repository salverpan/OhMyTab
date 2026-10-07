/**
 * 当轮 API 窗口硬顶 + 正文分页切片。
 * 独立成文件以便 Node 冒烟测试（不依赖 chrome / chat-executor）。
 */
import { estimateMessagesTokens } from '../sidepanel/history-compact.js';
import { READ_SINGLE_MAX_CHARS } from './limits.js';

export const DEFAULT_CONTEXT_TOKENS = 1_000_000;

export function getContextTokens(cfg) {
  const n = Number(cfg && cfg.contextTokens);
  return Number.isFinite(n) && n >= 16_000 && n <= 2_000_000 ? Math.floor(n) : DEFAULT_CONTEXT_TOKENS;
}

/** 轮间压缩预算：历史+摘要的触发线 = 窗口×0.7 再扣掉固定开销（提示词+工具定义 ≈ 20k）。 */
export function contextCompactBudget(cfg) {
  return Math.max(20_000, Math.floor(getContextTokens(cfg) * 0.7) - 20_000);
}

/** 当轮发给模型的 messages 硬顶（留给工具定义 + 补全）。1M 窗口 → ~55 万 token。 */
export function apiContextBudget(cfg) {
  return Math.max(24_000, Math.floor(getContextTokens(cfg) * 0.55));
}

export const TOOL_STUB_MARK = '[已从本轮上下文撤下以控制窗口';

function stubToolContent(raw) {
  const n = typeof raw === 'string' ? raw.length : 0;
  return `${TOOL_STUB_MARK}，原约 ${n} 字）。需要细节请再 read/fetch 指定片段，不要重拉全文。`;
}

/**
 * 把当轮 API messages 压到窗口硬顶以内。优先收更早的 tool 正文（先保留最近 2 条全文）；
 * 仍超则收 assistant 长文，再收受保护的 tool。就地修改 messages。
 */
export function trimApiMessagesToBudget(messages, cfg) {
  if (!Array.isArray(messages) || messages.length < 3) {
    return { trimmed: false, tokens: estimateMessagesTokens(messages || []) };
  }
  const budget = apiContextBudget(cfg);
  let tokens = estimateMessagesTokens(messages);
  if (tokens <= budget) return { trimmed: false, tokens };

  const toolIdx = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i] && messages[i].role === 'tool') toolIdx.push(i);
  }
  const protect = new Set(toolIdx.slice(-2));
  let trimmed = false;

  const stubAt = (i) => {
    const m = messages[i];
    const raw = typeof m.content === 'string' ? m.content : '';
    if (!raw || raw.startsWith(TOOL_STUB_MARK)) return false;
    m.content = stubToolContent(raw);
    return true;
  };

  for (const i of toolIdx) {
    if (tokens <= budget) break;
    if (protect.has(i)) continue;
    if (stubAt(i)) {
      trimmed = true;
      tokens = estimateMessagesTokens(messages);
    }
  }
  if (tokens > budget) {
    for (let i = 0; i < messages.length - 1; i++) {
      if (tokens <= budget) break;
      const m = messages[i];
      if (!m || m.role === 'system' || m.role === 'tool') continue;
      if (m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 400) {
        m.content = m.content.slice(0, 400) + '\n…(已压缩本轮早期回复)';
        trimmed = true;
        tokens = estimateMessagesTokens(messages);
      }
    }
  }
  if (tokens > budget) {
    for (const i of toolIdx) {
      if (tokens <= budget) break;
      if (stubAt(i)) {
        trimmed = true;
        tokens = estimateMessagesTokens(messages);
      }
    }
  }
  return { trimmed, tokens };
}

/**
 * 按 offset / max_chars 切一段正文。缺省单次上限 READ_SINGLE_MAX_CHARS。
 * 小文本且 offset=0 时 paging 为 null（与 read_* 小页全文行为一致）。
 */
export function sliceTextWithPaging(full, { offset = 0, maxChars } = {}) {
  const text = String(full ?? '');
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const rawLimit = maxChars != null && maxChars !== '' ? Number(maxChars) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.max(500, Math.floor(rawLimit))
    : READ_SINGLE_MAX_CHARS;
  const needPaging = off > 0 || text.length > limit;
  if (!needPaging) return { text, paging: null };
  const slice = text.slice(off, off + limit);
  const nextOff = off + slice.length;
  const hasMore = nextOff < text.length;
  return {
    text: slice,
    paging: {
      content_total: text.length,
      content_offset: off,
      content_returned: slice.length,
      content_has_more: hasMore,
      content_next_offset: hasMore ? nextOff : null,
    },
  };
}
