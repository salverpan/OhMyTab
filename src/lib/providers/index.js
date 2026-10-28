/* 多协议统一入口。所有 AI 对话流量（聊天/工具循环/摘要/模板解析/Vision）
 * 一律从这里走，禁止各调用点自己 fetch —— 新增协议时只改本目录。
 *
 * 规范消息格式（内部统一形状，适配器负责与各家线缆格式互转）：
 *   { role: 'system'|'user'|'assistant'|'tool',
 *     content: string
 *            | [ {type:'text', text} | {type:'image_url', image_url:{url}} ],  // 用户附件、前台视口截图、vision 旁路
 *     tool_calls?: [ {id, type:'function', function:{name, arguments:JSON字符串}} ],
 *     tool_call_id?: string }
 *
 * 统一返回：
 *   chatStream   -> { content, toolCalls: [{id,name,arguments,parseError}], usage }
 *   chatComplete -> { content, usage } 或含 toolCalls（anthropic/gemini）
 * usage 一律归一化为 OpenAI 形状 { prompt_tokens, completion_tokens, total_tokens }。
 */

import * as openaiChat from './openai-chat.js';
import * as anthropicMessages from './anthropic-messages.js';
import * as geminiNative from './gemini.js';
import { planEffortRetry, rememberEffortOutcome } from '../effort-probe.js';
import { withNetworkRetry } from '../net-retry.js';

const ADAPTERS = {
  openai: openaiChat,
  anthropic: anthropicMessages,
  gemini: geminiNative,
};

/** 容错取适配器：未知协议回落 openai（存量配置没有 protocol 字段时也走这里） */
function resolveAdapter(cfg) {
  const proto = String(cfg?.protocol || 'openai').toLowerCase();
  const adapter = ADAPTERS[proto];
  if (!adapter) {
    console.warn(`[providers] 未知协议 "${proto}"，回退 openai 兼容模式`);
    return ADAPTERS.openai;
  }
  return adapter;
}

/** 流式对话 + 工具调用。cfg 需含 { protocol, baseUrl, apiKey, model }。 */
export async function chatStream(cfg, messages, tools, onChunk, signal) {
  let emitted = false;
  const emit = (chunk) => {
    if (chunk) emitted = true;
    if (onChunk) onChunk(chunk);
  };
  return withNetworkRetry(
    () => withEffortRetry(cfg, (next) => resolveAdapter(next).chatStream(next, messages, tools, emit, signal)),
    { signal, canRetry: () => !emitted },
  );
}

/**
 * 非流式对话。opts:
 *   temperature / maxTokens / signal
 *   tools                  -- anthropic/gemini 支持非流式工具调用；openai 忽略（非流式路径无此需求）
 *   responseFormat         -- 仅 openai：{ type:'json_object' } 等
 *   retryWithoutResponseFormat -- 仅 openai：response_format 报 400 时去掉重试一次
 */
export async function chatComplete(cfg, messages, opts = {}) {
  return withNetworkRetry(
    () => withEffortRetry(cfg, (next) => resolveAdapter(next).chatComplete(next, messages, opts)),
    { signal: opts.signal },
  );
}

/** 思考参数 400：最多降一档或剥字段各一次。其它错误原样抛出。 */
async function withEffortRetry(cfg, run) {
  let current = cfg;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const result = await run(current);
      rememberEffortOutcome(current);
      return result;
    } catch (err) {
      lastErr = err;
      if (err?.name === 'AbortError') throw err;
      const next = planEffortRetry(current, err);
      if (!next) throw err;
      current = next;
    }
  }
  throw lastErr;
}

export { ApiError } from './util.js';

