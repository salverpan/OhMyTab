/* Google Gemini 原生协议适配器（generativelanguage.googleapis.com generateContent）。
 * 与 OpenAI 格式的核心差异：
 *  - 消息是 contents[]（role 只有 user/model）+ parts 结构；system 走 systemInstruction
 *  - 工具是 functionDeclarations，调用/结果以 functionCall / functionResponse parts 表达
 *    （functionResponse 必须带函数名，需用前文 assistant.tool_calls 的 id→name 映射回填）
 *  - 流式走 :streamGenerateContent?alt=sse，每条 data 是一个完整 GenerateContentResponse
 *  - 鉴权 x-goog-api-key 头（也支持 ?key= 参数，这里统一用头） */

import { ApiError, readSseLines, parseSseData, contentToText, parseDataImageUrl, safeJsonParse } from './util.js';
import { finalizeToolCalls } from './openai-chat.js';
import { applyGeminiThinking } from './reasoning.js';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** 由 Base URL 推导 API 根（统一带 /v1beta）。容错：裸主机、已带版本段、末尾斜杠。 */
export function resolveBase(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!u) return DEFAULT_BASE;
  u = u.replace(/\/(v1|v1beta)$/i, '');
  // 已是完整 models 端点的少见填法不处理；其余一律归一到 …/v1beta
  return `${u}/v1beta`;
}

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': cfg.apiKey,
  };
}

/* 规范内容块 → Gemini parts */
function toParts(content) {
  if (!Array.isArray(content)) {
    const t = contentToText(content);
    return t ? [{ text: t }] : [];
  }
  const parts = [];
  for (const part of content) {
    if (part.type === 'image_url') {
      const url = part.image_url?.url || '';
      const parsed = parseDataImageUrl(url);
      if (parsed) {
        parts.push({ inline_data: { mime_type: parsed.mediaType, data: parsed.base64 } });
      } else if (/^https?:\/\//i.test(url)) {
        parts.push({ file_data: { mime_type: 'image/png', file_uri: url } });
      }
    } else {
      const t = contentToText(part.text);
      if (t) parts.push({ text: t });
    }
  }
  return parts;
}

/* Gemini 的 function parameters 不接受 OpenAPI 子集之外的字段 */
function sanitizeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === '$schema' || k === 'additionalProperties' || k === 'default') continue;
    out[k] = sanitizeSchema(v);
  }
  return out;
}

export function toFunctionDeclarations(tools) {
  return (tools || [])
    .filter((t) => t?.function?.name)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      parameters: sanitizeSchema(t.function.parameters || { type: 'object', properties: {} }),
    }));
}

/**
 * 规范消息 → { systemInstruction, contents }。
 * 连续的 tool 结果消息合并成一条 user 消息的多个 functionResponse parts；
 * 函数名由最近一条 assistant 消息的 tool_calls（id→name）回填。
 */
export function convertMessages(messages) {
  const sysTexts = [];
  const contents = [];
  let pendingResponses = [];
  const fnNameById = new Map();

  const flush = () => {
    if (pendingResponses.length > 0) {
      contents.push({ role: 'user', parts: pendingResponses });
      pendingResponses = [];
    }
  };

  for (const m of messages || []) {
    if (m.role === 'system') {
      const t = contentToText(m.content).trim();
      if (t) sysTexts.push(t);
      continue;
    }
    flush();
    if (m.role === 'user') {
      const parts = toParts(m.content);
      if (parts.length > 0) contents.push({ role: 'user', parts });
    } else if (m.role === 'assistant') {
      const parts = toParts(m.content);
      for (const tc of m.tool_calls || []) {
        const args = safeJsonParse(tc.function?.arguments, {});
        parts.push({ functionCall: { name: tc.function?.name, args } });
        if (tc.id && tc.function?.name) fnNameById.set(tc.id, tc.function.name);
      }
      if (parts.length > 0) contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      pendingResponses.push({
        functionResponse: {
          name: fnNameById.get(m.tool_call_id) || 'unknown_tool',
          response: { result: contentToText(m.content) },
        },
      });
    }
  }
  flush();

  return {
    systemInstruction: sysTexts.length > 0
      ? { parts: [{ text: sysTexts.join('\n\n') }] }
      : undefined,
    contents,
  };
}

function buildBody(cfg, messages, tools, opts = {}) {
  const { systemInstruction, contents } = convertMessages(messages);
  const generationConfig = {};
  if (opts.temperature != null) generationConfig.temperature = opts.temperature;
  if (opts.maxTokens != null) generationConfig.maxOutputTokens = opts.maxTokens;
  applyGeminiThinking(generationConfig, cfg);

  const body = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  const decls = toFunctionDeclarations(tools);
  if (decls.length > 0 && !opts.noTools) body.tools = [{ functionDeclarations: decls }];
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
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

/* usageMetadata 归一化为 OpenAI 形状 */
function normalizeUsage(meta) {
  if (!meta) return null;
  const p = Number(meta.promptTokenCount) || 0;
  const c = Number(meta.candidatesTokenCount) || 0;
  const total = Number(meta.totalTokenCount) || p + c;
  return total > 0 || p + c > 0
    ? { prompt_tokens: p, completion_tokens: c, total_tokens: total }
    : null;
}

/** 非流式对话。返回 { content, toolCalls, usage } */
export async function chatComplete(cfg, messages, opts = {}) {
  const url = `${resolveBase(cfg.baseUrl)}/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(buildBody(cfg, messages, opts.tools, opts)),
    signal: opts.signal,
  });
  if (!response.ok) await raiseResponseError(response);
  const data = await response.json();

  let content = '';
  const tcList = {};
  let idx = 0;
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (typeof part.text === 'string' && part.text) content += part.text;
    if (part.functionCall?.name) {
      tcList[idx++] = {
        id: `${part.functionCall.name}_${idx}`,
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args || {}),
      };
    }
  }
  return {
    content: content.trim(),
    toolCalls: finalizeToolCalls(tcList),
    usage: normalizeUsage(data.usageMetadata),
  };
}

/** 流式对话 + 工具调用。返回 { content, toolCalls, usage } */
export async function chatStream(cfg, messages, tools, onChunk, signal, opts = {}) {
  const url = `${resolveBase(cfg.baseUrl)}/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(buildBody(cfg, messages, tools, { ...opts })),
    signal,
  });
  if (!response.ok) await raiseResponseError(response);

  let content = '';
  let usage = null;
  const tcList = {};
  let idx = 0;

  await readSseLines(response, (line) => {
    const json = parseSseData(line);
    if (!json) return;
    if (json.usageMetadata) usage = normalizeUsage(json.usageMetadata);

    for (const part of json.candidates?.[0]?.content?.parts || []) {
      if (typeof part.text === 'string' && part.text) {
        content += part.text;
        if (onChunk) onChunk(part.text);
      }
      if (part.functionCall?.name) {
        // Gemini 无工具调用 id：用序号生成稳定 id，tool 结果回传时按 name 匹配
        idx += 1;
        tcList[`gc${idx}`] = {
          id: `${part.functionCall.name}__gemini_${idx}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        };
      }
    }
  });

  return { content: content.trim(), toolCalls: finalizeToolCalls(tcList), usage };
}
