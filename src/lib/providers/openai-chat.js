/* OpenAI Chat Completions 协议适配器。
 * 覆盖 OpenAI 官方及一切 OpenAI 兼容端点：DeepSeek / 智谱 GLM / 通义 Qwen
 * (compatible-mode) / Kimi / MiniMax / 豆包 / SiliconFlow / OpenRouter /
 * Groq / xAI / Mistral / 本地 Ollama·vLLM·LM Studio / one-api 中转等。
 * 请求/响应格式与收口前 ai-client.js#streamChatWithTools 完全一致（行为零变化）。 */

import { ApiError, readSseLines, parseSseData, normalizeFinishReason } from './util.js';
import { applyOpenAIReasoning } from './reasoning.js';
import { resolveChatMaxTokens } from '../model-limits.js';
import { estimateRequestTokens } from '../token-estimate.js';

/** 由用户填的 Base URL 推导完整端点。兼容四种填法：
 *  - 完整端点 https://api.deepseek.com/chat/completions → 原样使用
 *  - 带 API 前缀 https://open.bigmodel.cn/api/paas/v4    → 追加 /chat/completions
 *  - 只到版本段 https://api.openai.com/v1               → 追加 /chat/completions
 *  - 只有主机名 https://api.openai.com                   → 追加 /v1/chat/completions */
export function resolveEndpoint(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!u) u = 'https://api.openai.com';
  if (/\/chat\/completions$/i.test(u)) return u;
  if (/\/v1$/i.test(u) || /\/v1beta\/openai$/i.test(u)) return u + '/chat/completions';
  const path = u.replace(/^https?:\/\/[^/]+/i, '');
  if (!path || path === '') return u + '/v1/chat/completions';
  return u + '/chat/completions';
}

/* 思维链字段各家命名不一：DeepSeek / 智谱 / Kimi 用 reasoning_content，
 * OpenRouter 与部分中转发 reasoning。取到哪个用哪个，都没有则空串。 */
function pickReasoning(obj) {
  if (!obj) return '';
  const v = obj.reasoning_content ?? obj.reasoning;
  return typeof v === 'string' ? v : '';
}

/* OpenCode 网关（/zen、/zen/go）要求每会话一个路由头 x-opencode-session，
 * 缺失直接 400 MissingSessionID。其它厂商不需要，故仅对 opencode.ai 附带。
 * Worker 内固定复用同一个值，保留服务端路由亲和性（对前缀缓存友好）。 */
let opencodeSessionId = '';

function isOpenCodeHost(url) {
  try {
    return /(^|\.)opencode\.ai$/i.test(new URL(url).hostname);
  } catch (_) {
    return false;
  }
}

function opencodeSession(url) {
  if (!isOpenCodeHost(url)) return '';
  if (!opencodeSessionId) {
    opencodeSessionId =
      globalThis.crypto?.randomUUID?.() ||
      `oc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  return opencodeSessionId;
}

function headers(cfg, url) {
  const h = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  const sid = cfg.sessionId || opencodeSession(url);
  if (sid) h['x-opencode-session'] = sid;
  // 逃生口：任意自定义头（个别中转要 X-Api-Key、HTTP-Referer 之类）
  if (cfg.extraHeaders && typeof cfg.extraHeaders === 'object') {
    for (const [k, v] of Object.entries(cfg.extraHeaders)) {
      if (v != null) h[k] = String(v);
    }
  }
  return h;
}

/* o 系列与 gpt-5 推理模型：拒收 temperature，且上限参数叫 max_completion_tokens */
function isReasoningModel(model) {
  return /^(o\d|gpt-5)/i.test(String(model || ''));
}

function buildBody(cfg, messages, tools, opts = {}) {
  const body = { model: cfg.model, messages };
  if (Array.isArray(tools) && tools.length > 0) body.tools = tools;
  if (opts.stream) body.stream = true;
  if (!isReasoningModel(cfg.model)) body.temperature = opts.temperature ?? 0.7;
  // 未显式指定时：min(目录满额, 25.6 万, 窗口减去本轮已占用)。未知模型用 3.2 万，避免厂商默认 8K。
  const cap = resolveChatMaxTokens(cfg, opts.maxTokens, {
    usedTokens: estimateRequestTokens(messages, tools),
  });
  if (cap != null) {
    if (isReasoningModel(cfg.model)) body.max_completion_tokens = cap;
    else body.max_tokens = cap;
  }
  if (opts.responseFormat) body.response_format = opts.responseFormat;
  applyOpenAIReasoning(body, cfg);
  return body;
}

async function raiseResponseError(response) {
  let detail = '';
  try {
    const errData = await response.json();
    detail = errData.error?.message || '';
  } catch (_) {}
  throw new ApiError(response.status, detail);
}

/** 非流式对话。返回 { content, usage }。
 * opts.retryWithoutResponseFormat: 带 response_format 的请求遇 400 时去掉该字段重试一次
 * （个别 OpenAI 兼容服务不支持 response_format 会报 400）。 */
export async function chatComplete(cfg, messages, opts = {}) {
  const endpoint = resolveEndpoint(cfg.baseUrl);
  const reqHeaders = headers(cfg, endpoint);
  const doFetch = (body) => fetch(endpoint, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  let body = buildBody(cfg, messages, null, { ...opts, stream: false });
  let response = await doFetch(body);
  if (!response.ok && response.status === 400 && opts.responseFormat && opts.retryWithoutResponseFormat) {
    const noFmt = { ...body };
    delete noFmt.response_format;
    response = await doFetch(noFmt);
  }
  if (!response.ok) await raiseResponseError(response);

  const data = await response.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;
  return {
    content: msg?.content?.trim() || '',
    reasoning: pickReasoning(msg).trim(),
    usage: data.usage || null,
    finishReason: normalizeFinishReason(choice?.finish_reason),
  };
}

/** 流式对话 + 工具调用。onChunk 逐段回调文本增量。
 * 返回 { content, toolCalls: [{id,name,arguments,parseError}], usage }。 */
export async function chatStream(cfg, messages, tools, onChunk, signal, opts = {}) {
  const endpoint = resolveEndpoint(cfg.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers(cfg, endpoint),
    body: JSON.stringify(buildBody(cfg, messages, tools, { ...opts, stream: true })),
    signal,
  });
  if (!response.ok) await raiseResponseError(response);

  let content = '';
  let reasoning = '';
  let usage = null;
  const tcByIndex = {};

  await readSseLines(response, (line) => {
    const json = parseSseData(line);
    if (!json) return;
    if (json.usage) usage = json.usage;

    const delta = json.choices?.[0]?.delta;
    if (!delta) return;

    /* 思维链：与 anthropic-messages.js 的 thinking_delta 约定一致 —— 不进正文，
     * 单独累积；宿主想展示时用 opts.onReasoning 接增量。 */
    const thought = pickReasoning(delta);
    if (thought) {
      reasoning += thought;
      if (opts.onReasoning) opts.onReasoning(thought);
    }

    if (delta.content) {
      content += delta.content;
      if (onChunk) onChunk(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!tcByIndex[idx]) {
          tcByIndex[idx] = { id: tc.id || '', name: '', arguments: '' };
        }
        if (tc.id) tcByIndex[idx].id = tc.id;
        if (tc.function?.name) tcByIndex[idx].name += tc.function.name;
        if (tc.function?.arguments) tcByIndex[idx].arguments += tc.function.arguments;
      }
    }
  });

  return { content: content.trim(), reasoning: reasoning.trim(), toolCalls: finalizeToolCalls(tcByIndex), usage };
}

/* arguments 解析失败不再静默吞成 {}：带原始片段上抛（parseError），
 * 宿主把它作为 tool 结果回喂给模型自纠重发 —— 三协议共用此约定 */
export function finalizeToolCalls(tcList) {
  return Object.values(tcList)
    .filter((tc) => tc.name)
    .map((tc) => {
      let args = {};
      let parseError = null;
      if (tc.arguments) {
        try {
          args = JSON.parse(tc.arguments);
        } catch (e) {
          parseError = `arguments 不是合法 JSON（${e.message}）。原始内容前 300 字符：${tc.arguments.slice(0, 300)}`;
        }
      }
      return { id: tc.id, name: tc.name, arguments: args, parseError };
    });
}
