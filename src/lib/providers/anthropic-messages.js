/* Anthropic Messages 协议适配器（Claude 原生 /v1/messages）。
 * 覆盖：Anthropic 官方，以及因 Claude Code 生态而加挂 Anthropic 兼容层的厂商
 * （DeepSeek https://api.deepseek.com/anthropic、智谱 GLM
 * https://open.bigmodel.cn/api/anthropic 等）。
 * 与 OpenAI 格式的核心差异：
 *  - 鉴权 x-api-key + anthropic-version 双头；system 是顶层参数不是消息
 *  - 工具调用是 content blocks（assistant 的 tool_use / user 消息里的 tool_result）
 *  - SSE 是 message_start/content_block_delta/message_delta 事件流 */

import { ApiError, readSseLines, parseSseData, contentToText, parseDataImageUrl, safeJsonParse, normalizeFinishReason } from './util.js';
import { isViewportShotMessage } from '../tool-round-messages.js';
import { finalizeToolCalls } from './openai-chat.js';
import { applyAnthropicThinking } from './reasoning.js';
import { resolveChatMaxTokens } from '../model-limits.js';
import { estimateRequestTokens } from '../token-estimate.js';

const ANTHROPIC_VERSION = '2023-06-01';

/** 由 Base URL 推导 /v1/messages 端点。兼容填法：
 *  - 完整端点 .../v1/messages → 原样使用
 *  - 只到主机 https://api.anthropic.com → +/v1/messages
 *  - 兼容层前缀 https://api.deepseek.com/anthropic、https://open.bigmodel.cn/api/anthropic → +/v1/messages */
export function resolveEndpoint(baseUrl) {
  let u = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!u) u = 'https://api.anthropic.com';
  if (/\/v1\/messages$/i.test(u)) return u;
  if (/\/messages$/i.test(u)) u = u.replace(/\/messages$/i, '');
  return u + '/v1/messages';
}

function headers(cfg) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': cfg.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

/* 规范内容块（text | image_url）→ Anthropic 内容块。
 * data URL 转 base64 source；http(s) 图链走 Anthropic 的 url source。 */
function toAnthropicContent(content) {
  if (!Array.isArray(content)) return contentToText(content);
  return content.map((part) => {
    if (part.type === 'image_url') {
      const url = part.image_url?.url || '';
      const parsed = parseDataImageUrl(url);
      if (parsed) {
        return { type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 } };
      }
      return { type: 'image', source: { type: 'url', url } };
    }
    return { type: 'text', text: contentToText(part.text) };
  });
}

/** OpenAI tools 定义 → Anthropic tools 定义 */
export function toAnthropicTools(tools) {
  return (tools || [])
    .filter((t) => t?.function?.name)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters || { type: 'object' },
    }));
}

/**
 * 规范消息 → Anthropic 请求参数 { system, messages }。
 * 规则：system 消息（含对话中途注入的收尾提示）合并进顶层 system；
 * assistant.tool_calls → tool_use blocks；tool 消息 → 连续合并进同一条
 * user 消息的 tool_result blocks（tool_use_id 对应，名字无需回传）。
 */
export function convertMessages(messages) {
  const systemParts = [];
  const out = [];
  let pendingResults = [];

  const flushResults = () => {
    if (pendingResults.length > 0) {
      out.push({ role: 'user', content: pendingResults });
      pendingResults = [];
    }
  };

  for (const m of messages || []) {
    if (m.role === 'system') {
      const t = contentToText(m.content).trim();
      if (t) systemParts.push(t);
      continue;
    }
    if (m.role === 'tool') {
      // 连续 tool 消息只累积，遇到下一条非 tool 消息时才合并 flush
      pendingResults.push({
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: contentToText(m.content),
      });
      continue;
    }
    flushResults();
    if (m.role === 'user') {
      const blocks = toAnthropicContent(m.content);
      const prev = out[out.length - 1];
      const list = Array.isArray(blocks) ? blocks : [{ type: 'text', text: String(blocks || '') }];
      if (isViewportShotMessage(m) && prev?.role === 'user' && Array.isArray(prev.content)) {
        prev.content.push(...list);
      } else {
        out.push({ role: 'user', content: blocks });
      }
    } else if (m.role === 'assistant') {
      const blocks = [];
      const text = contentToText(m.content);
      if (text) blocks.push({ type: 'text', text });
      for (const tc of m.tool_calls || []) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name,
          input: safeJsonParse(tc.function?.arguments, {}),
        });
      }
      // 空消息 Anthropic 会拒：至少给一个空文本块占位
      out.push({ role: 'assistant', content: blocks.length > 0 ? blocks : [{ type: 'text', text: '' }] });
    }
  }
  flushResults();
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: out,
  };
}

async function raiseResponseError(response) {
  let detail = '';
  try {
    const errData = await response.json();
    detail = errData.error?.message || '';
  } catch (_) {}
  throw new ApiError(response.status, detail);
}

function buildBody(cfg, messages, tools, opts) {
  const { system, messages: converted } = convertMessages(messages);
  const body = {
    model: cfg.model,
    max_tokens: resolveChatMaxTokens(cfg, opts?.maxTokens, {
      usedTokens: estimateRequestTokens(messages, tools),
    }),
    messages: converted,
  };
  if (system) body.system = system;
  const anthropicTools = toAnthropicTools(tools);
  if (anthropicTools.length > 0 && !opts?.noTools) body.tools = anthropicTools;
  if (opts?.temperature != null) body.temperature = opts.temperature;
  if (opts?.stream) body.stream = true;
  applyAnthropicThinking(body, cfg);
  return body;
}

/* usage 归一化为 OpenAI 形状（宿主 usageTotalTokens 按 prompt_tokens/completion_tokens 求和） */
function normalizeUsage(input, output) {
  const p = Number(input) || 0;
  const c = Number(output) || 0;
  return p + c > 0 ? { prompt_tokens: p, completion_tokens: c, total_tokens: p + c } : null;
}

/** 从非流式响应 content blocks 提取文本与工具调用 */
function extractBlocks(contentBlocks) {
  let text = '';
  const tcList = {};
  for (const block of contentBlocks || []) {
    if (block.type === 'text') text += block.text || '';
    if (block.type === 'tool_use' && block.name) {
      tcList[block.index ?? tcList.length] = {
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input || {}),
      };
    }
  }
  return { text, toolCalls: finalizeToolCalls(tcList) };
}

/** 非流式对话。返回 { content, toolCalls, usage } */
export async function chatComplete(cfg, messages, opts = {}) {
  const response = await fetch(resolveEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(buildBody(cfg, messages, opts.tools, { ...opts })),
    signal: opts.signal,
  });
  if (!response.ok) await raiseResponseError(response);
  const data = await response.json();
  const { text, toolCalls } = extractBlocks(data.content);
  return {
    content: text.trim(),
    toolCalls,
    usage: normalizeUsage(data.usage?.input_tokens, data.usage?.output_tokens),
    finishReason: normalizeFinishReason(data.stop_reason),
  };
}

/** 流式对话 + 工具调用。返回 { content, toolCalls, usage } */
export async function chatStream(cfg, messages, tools, onChunk, signal, opts = {}) {
  const response = await fetch(resolveEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(buildBody(cfg, messages, tools, { ...opts, stream: true })),
    signal,
  });
  if (!response.ok) await raiseResponseError(response);

  let content = '';
  let inTokens = 0;
  let outTokens = 0;
  // index -> {type:'text'|'tool_use', id, name, args}
  const blocks = new Map();

  await readSseLines(response, (line) => {
    const json = parseSseData(line);
    if (!json) return;
    switch (json.type) {
      case 'message_start':
        inTokens = json.message?.usage?.input_tokens || 0;
        break;
      case 'content_block_start': {
        const b = json.content_block || {};
        blocks.set(json.index, {
          type: b.type,
          id: b.id,
          name: b.name,
          args: '',
          text: '',
        });
        break;
      }
      case 'content_block_delta': {
        const block = blocks.get(json.index);
        if (!block) break;
        const d = json.delta || {};
        if (d.type === 'text_delta') {
          block.text += d.text || '';
          content += d.text || '';
          if (onChunk) onChunk(d.text || '');
        } else if (d.type === 'input_json_delta') {
          block.args += d.partial_json || '';
        }
        // thinking_delta（扩展思考）：不进正文，静默跳过
        break;
      }
      case 'message_delta':
        outTokens = json.usage?.output_tokens || outTokens;
        break;
      default:
        break;
    }
  });

  const tcList = {};
  for (const [index, block] of blocks) {
    if (block.type === 'tool_use' && block.name) {
      tcList[index] = { id: block.id, name: block.name, arguments: block.args };
    }
  }

  return {
    content: content.trim(),
    toolCalls: finalizeToolCalls(tcList),
    usage: normalizeUsage(inTokens, outTokens),
  };
}
