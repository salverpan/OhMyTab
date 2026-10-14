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

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
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
  const doFetch = (body) => fetch(resolveEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: headers(cfg),
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
  return {
    content: choice?.message?.content?.trim() || '',
    usage: data.usage || null,
    finishReason: normalizeFinishReason(choice?.finish_reason),
  };
}

/** 流式对话 + 工具调用。onChunk 逐段回调文本增量。
 * 返回 { content, toolCalls: [{id,name,arguments,parseError}], usage }。 */
export async function chatStream(cfg, messages, tools, onChunk, signal, opts = {}) {
  const response = await fetch(resolveEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(buildBody(cfg, messages, tools, { ...opts, stream: true })),
    signal,
  });
  if (!response.ok) await raiseResponseError(response);

  let content = '';
  let usage = null;
  const tcByIndex = {};

  await readSseLines(response, (line) => {
    const json = parseSseData(line);
    if (!json) return;
    if (json.usage) usage = json.usage;

    const delta = json.choices?.[0]?.delta;
    if (!delta) return;

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

  return { content: content.trim(), toolCalls: finalizeToolCalls(tcByIndex), usage };
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
