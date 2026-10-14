/* 多协议适配层无头冒烟测试（node test/providers-smoke.mjs）。
 * 用桩 fetch 模拟三种协议的线缆格式（含跨 chunk 半行、工具参数分段、错误响应），
 * 断言：端点推导、规范消息互转、流解析累积、usage 归一化、协议分发容错。
 * 不依赖 chrome.*，纯模块直连。 */

import assert from 'node:assert';
import { chatStream, chatComplete } from '../src/lib/providers/index.js';
import { resolveEndpoint as oaiEp } from '../src/lib/providers/openai-chat.js';
import { resolveEndpoint as antEp, convertMessages as antConvert } from '../src/lib/providers/anthropic-messages.js';
import { resolveBase as gemBase, convertMessages as gemConvert } from '../src/lib/providers/gemini.js';
import { inferModelCaps, defaultWorkingContext, contextPresets, catalogSourceLabel, resolveChatMaxTokens, OUTPUT_TOKEN_REQUEST_CAP, OUTPUT_TOKEN_UNKNOWN_FALLBACK, OUTPUT_CONTEXT_SLACK, FALLBACK_CONTEXT_WINDOW, FALLBACK_WORKING_CONTEXT } from '../src/lib/model-limits.js';
import { planEffortRetry, resetEffortProbeForTests, isReasoningParamError } from '../src/lib/effort-probe.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

/* ---- 桩 fetch ---- */
function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function withFetch(handler) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => handler(String(url), init);
  return () => { globalThis.fetch = orig; };
}

/* ---- 1. 端点推导 ---- */
ok(oaiEp('https://api.deepseek.com/chat/completions') === 'https://api.deepseek.com/chat/completions', 'openai 完整端点原样');
ok(oaiEp('https://api.openai.com/v1/') === 'https://api.openai.com/v1/chat/completions', 'openai v1 补全');
ok(oaiEp('https://api.openai.com') === 'https://api.openai.com/v1/chat/completions', 'openai 裸主机补 /v1');
ok(oaiEp('https://generativelanguage.googleapis.com/v1beta/openai') === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini 兼容层补全');
ok(oaiEp('https://open.bigmodel.cn/api/paas/v4') === 'https://open.bigmodel.cn/api/paas/v4/chat/completions', '带路径前缀追加');
ok(antEp('https://api.deepseek.com/anthropic') === 'https://api.deepseek.com/anthropic/v1/messages', 'anthropic 兼容层补 /v1/messages');
ok(antEp('https://api.anthropic.com/v1/messages') === 'https://api.anthropic.com/v1/messages', 'anthropic 完整端点原样');
ok(gemBase('https://generativelanguage.googleapis.com/v1beta/') === 'https://generativelanguage.googleapis.com/v1beta', 'gemini base 归一');

/* ---- 1b. 输出上限：满额、25.6 万封顶、扣掉已占用、未知 32k ---- */
{
  const unknown = resolveChatMaxTokens({ model: 'not-a-real-model-xyz' }, undefined, { usedTokens: 1000 });
  ok(unknown === OUTPUT_TOKEN_UNKNOWN_FALLBACK, '未知模型 32k');
  const capped = resolveChatMaxTokens(
    { model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com/chat/completions', contextTokens: 1_000_000 },
    undefined,
    { usedTokens: 10_000 },
  );
  ok(capped === OUTPUT_TOKEN_REQUEST_CAP, '目录满额超过 25.6 万时封顶');
  const room = resolveChatMaxTokens(
    { model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com/chat/completions', contextTokens: 200_000 },
    undefined,
    { usedTokens: 150_000 },
  );
  ok(room === 200_000 - 150_000 - OUTPUT_CONTEXT_SLACK, '扣掉上下文已占用');
  ok(resolveChatMaxTokens({ model: 'not-a-real-model-xyz' }, 500) === 500, '显式短上限原样保留');
}

/* ---- 2. openai 流式：跨 chunk 半行 + 工具参数分段 ---- */
{
  const restore = withFetch((url, init) => {
    ok(url === 'https://api.deepseek.com/chat/completions', 'openai 流式请求地址');
    const body = JSON.parse(init.body);
    ok(body.stream === true && Array.isArray(body.tools) && body.tools.length > 0, 'openai 请求体带 stream+tools');
    ok(body.max_tokens === OUTPUT_TOKEN_UNKNOWN_FALLBACK && body.temperature === 0.7, '未收录模型输出上限 32k');
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_w"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\": "}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\ndata: [DONE]\n\n',
    ]);
  });
  const seen = [];
  const r = await chatStream(
    { protocol: 'openai', baseUrl: 'https://api.deepseek.com/chat/completions', apiKey: 'k', model: 'm' },
    [{ role: 'user', content: 'hi' }],
    [{ type: 'function', function: { name: 'get_w', parameters: {} } }],
    (t) => seen.push(t),
    undefined,
  );
  restore();
  ok(seen.join('') === '你好', 'openai 文本增量顺序');
  ok(r.content === '你好', 'openai 累积正文');
  ok(r.toolCalls.length === 1 && r.toolCalls[0].id === 'call_1' && r.toolCalls[0].name === 'get_w', 'openai 工具调用累积');
  ok(r.toolCalls[0].arguments.a === 1 && !r.toolCalls[0].parseError, 'openai 分段 arguments 解析');
  ok(r.usage.total_tokens === 15, 'openai usage 透传');
}

/* ---- 3. openai 非法 arguments -> parseError 回喂 ---- */
{
  const restore = withFetch(() => sseResponse([
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c","function":{"name":"t","arguments":"{oops"}}]}}]}\n\n',
  ]));
  const r = await chatStream({ protocol: 'openai', baseUrl: 'https://x/chat/completions', apiKey: 'k', model: 'm' }, [], []);
  restore();
  ok(r.toolCalls[0].parseError && r.toolCalls[0].parseError.includes('{oops'), 'openai parseError 带原始片段');
}

/* ---- 4. openai 推理模型 quirk（gpt-5/o 系）---- */
{
  let captured = null;
  const restore = withFetch((url, init) => { captured = JSON.parse(init.body); return jsonResponse({ choices: [{ message: { content: 'ok' } }] }); });
  await chatComplete({ protocol: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'gpt-5' }, [], { maxTokens: 500 });
  restore();
  ok(captured.max_completion_tokens === 500 && captured.max_tokens === undefined, '推理模型用 max_completion_tokens');
  ok(captured.temperature === undefined, '推理模型不带 temperature');
}

/* ---- 5. openai response_format 400 重试 ---- */
{
  let n = 0;
  const bodies = [];
  const restore = withFetch((url, init) => {
    n += 1;
    bodies.push(JSON.parse(init.body));
    if (n === 1) return jsonResponse({ error: { message: 'response_format unsupported' } }, 400);
    return jsonResponse({ choices: [{ message: { content: '{"a":1}' } }], usage: null });
  });
  const r = await chatComplete(
    { protocol: 'openai', baseUrl: 'https://x/chat/completions', apiKey: 'k', model: 'm' },
    [{ role: 'user', content: 'Output JSON.\ntest' }],
    { temperature: 0.3, responseFormat: { type: 'json_object' }, retryWithoutResponseFormat: true },
  );
  restore();
  ok(n === 2 && bodies[0].response_format && !bodies[1].response_format, '400 后去掉 response_format 重试一次');
  ok(r.content === '{"a":1}', '重试结果返回');
}

/* ---- 6. anthropic 规范消息转换 ---- */
{
  const { system, messages } = antConvert([
    { role: 'system', content: 'sys1' },
    { role: 'system', content: '收尾提示' }, // 中途注入的 system 也并入顶层 system
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', tool_calls: [
      { id: 'tc1', type: 'function', function: { name: 'f1', arguments: '{"x":2}' } },
      { id: 'tc2', type: 'function', function: { name: 'f2', arguments: '{}' } },
    ] },
    { role: 'tool', tool_call_id: 'tc1', content: 'r1' },
    { role: 'tool', tool_call_id: 'tc2', content: 'r2' },
    { role: 'user', content: [{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] },
  ]);
  ok(system === 'sys1\n\n收尾提示', 'anthropic system 合并到顶层');
  ok(messages.length === 4, 'anthropic 连续 tool 结果合并为一条 user');
  ok(messages[1].role === 'assistant' && messages[1].content.some((b) => b.type === 'tool_use' && b.id === 'tc1' && b.input.x === 2), 'assistant tool_calls -> tool_use blocks');
  ok(messages[2].role === 'user' && messages[2].content.length === 2
    && messages[2].content[0].tool_use_id === 'tc1' && messages[2].content[1].content === 'r2', 'tool_result blocks 正确配对');
  const imgBlock = messages[3].content.find((b) => b.type === 'image');
  ok(imgBlock && imgBlock.source.media_type === 'image/png' && imgBlock.source.data === 'AAA', 'data URL 图片转 base64 source');
}

/* ---- 7. anthropic 流式事件解析 ---- */
{
  const restore = withFetch((url, init) => {
    ok(url === 'https://api.deepseek.com/anthropic/v1/messages', 'anthropic 端点推导');
    ok(init.headers['x-api-key'] === 'k' && init.headers['anthropic-version'] === '2023-06-01', 'anthropic 双头鉴权');
    return sseResponse([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12}}}\n\n',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}\n\n',
      'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"search"}}\n\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":"}}\n\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"x\\"}"}}\n\n',
      'data: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ]);
  });
  const seen = [];
  const r = await chatStream(
    { protocol: 'anthropic', baseUrl: 'https://api.deepseek.com/anthropic', apiKey: 'k', model: 'claude-sonnet-4-5' },
    [{ role: 'user', content: 'hi' }],
    [{ type: 'function', function: { name: 'search', description: '', parameters: {} } }],
    (t) => seen.push(t),
    undefined,
  );
  restore();
  ok(seen.join('') === 'Hello' && r.content === 'Hello', 'anthropic 文本增量');
  ok(r.toolCalls.length === 1 && r.toolCalls[0].id === 'tu_1' && r.toolCalls[0].arguments.q === 'x', 'anthropic input_json_delta 拼接');
  ok(r.usage.prompt_tokens === 12 && r.usage.completion_tokens === 8 && r.usage.total_tokens === 20, 'anthropic usage 归一化');
}

/* ---- 8. anthropic 错误 -> ApiError 带 status/body ---- */
{
  const restore = withFetch(() => jsonResponse({ error: { message: 'invalid x-api-key' } }, 401));
  let caught = null;
  try {
    await chatComplete({ protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'bad', model: 'claude-sonnet-4-5' }, [{ role: 'user', content: 'x' }], {});
  } catch (e) { caught = e; }
  restore();
  ok(caught && caught.status === 401 && /invalid x-api-key/.test(caught.message), 'anthropic 401 -> ApiError');
}

/* ---- 9. gemini 规范消息转换 ---- */
{
  const { systemInstruction, contents } = gemConvert([
    { role: 'system', content: 'be brief' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: null, tool_calls: [
      { id: 'g1', type: 'function', function: { name: 'lookup', arguments: '{"k":"v"}' } },
    ] },
    { role: 'tool', tool_call_id: 'g1', content: 'found it' },
  ]);
  ok(systemInstruction.parts[0].text === 'be brief', 'gemini systemInstruction');
  ok(contents.map((c) => c.role).join(',') === 'user,model,user', 'gemini 角色映射与 tool 结果合并');
  const fc = contents[1].parts.find((p) => p.functionCall);
  ok(fc && fc.functionCall.name === 'lookup' && fc.functionCall.args.k === 'v', 'assistant tool_calls -> functionCall');
  const fr = contents[2].parts.find((p) => p.functionResponse);
  ok(fr && fr.functionResponse.name === 'lookup' && fr.functionResponse.response.result === 'found it', 'functionResponse 按 id 回填函数名');
}

/* ---- 10. gemini schema 清洗 ---- */
{
  const { toFunctionDeclarations } = await import('../src/lib/providers/gemini.js').then(() => ({ }));
  // sanitizeSchema 未导出，经 chatStream 的请求体间接验证：
  let body = null;
  const restore = withFetch((url, init) => { body = JSON.parse(init.body); return sseResponse(['data: {"candidates":[{"content":{"parts":[{"text":"ok"}],"role":"model"}}]}']); });
  await chatStream(
    { protocol: 'gemini', baseUrl: '', apiKey: 'gk', model: 'gemini-2.5-flash' },
    [{ role: 'user', content: 'hi' }],
    [{ type: 'function', function: { name: 'f', description: 'd', parameters: { $schema: 'x', additionalProperties: false, type: 'object', properties: { a: { type: 'string' } } } } }],
    null,
    undefined,
  );
  restore();
  const decl = body.tools[0].functionDeclarations[0];
  ok(decl.parameters.$schema === undefined && decl.parameters.additionalProperties === undefined && decl.parameters.properties.a, 'gemini schema 清洗 $schema/additionalProperties');
  void toFunctionDeclarations;
}

/* ---- 11. gemini 流式解析 ---- */
{
  const restore = withFetch((url, init) => {
    ok(url.includes(':streamGenerateContent?alt=sse'), 'gemini 流式端点');
    ok(init.headers['x-goog-api-key'] === 'gk', 'gemini api key 头');
    return sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"Hi "}],"role":"model"}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"functionCall":{"name":"f","args":{"z":1}}}],"role":"model"}}]}\n\n',
      'data: {"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":3,"totalTokenCount":10}}\n\n',
    ]);
  });
  const r = await chatStream({ protocol: 'gemini', baseUrl: '', apiKey: 'gk', model: 'gemini-2.5-flash' }, [{ role: 'user', content: 'q' }], [], null, undefined);
  restore();
  ok(r.content === 'Hi', 'gemini 文本增量（返回前按惯例 trim）');
  ok(r.toolCalls[0].name === 'f' && r.toolCalls[0].arguments.z === 1 && r.toolCalls[0].id, 'gemini functionCall 累积并生成稳定 id');
  ok(r.usage.prompt_tokens === 7 && r.usage.total_tokens === 10, 'gemini usageMetadata 归一化');
}

/* ---- 12. gemini 非流式 + 图片 inline_data ---- */
{
  const restore = withFetch((url) => {
    ok(url.endsWith('/models/gemini-2.5-flash:generateContent'), 'gemini 非流式端点');
    return jsonResponse({ candidates: [{ content: { parts: [{ text: 'done' }], role: 'model' } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } });
  });
  const r = await chatComplete(
    { protocol: 'gemini', baseUrl: '', apiKey: 'gk', model: 'gemini-2.5-flash' },
    [{ role: 'user', content: [{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } }] }],
    {},
  );
  restore();
  ok(r.content === 'done' && r.usage.total_tokens === 2, 'gemini 非流式提取');
}

/* ---- 13. 协议分发容错：未知协议回落 openai ---- */
{
  const restore = withFetch((url) => {
    ok(url === 'https://x.example/chat/completions', '未知协议回落 openai 端点');
    return jsonResponse({ choices: [{ message: { content: 'fb' } }] });
  });
  const r = await chatComplete({ protocol: 'bogus', baseUrl: 'https://x.example/chat/completions', apiKey: 'k', model: 'm' }, [{ role: 'user', content: 'x' }], {});
  restore();
  ok(r.content === 'fb', '未知协议不致命');
}

/* ---- 14. 未收录模型：常用档 + Effort Off 不发字段 / High 发 openai 形态 ---- */
{
  resetEffortProbeForTests();
  const caps = inferModelCaps('citecat-unknown-zz9', { baseUrl: 'https://gateway.example/v1' });
  ok(caps.source === 'fallback' && caps.reasoning === 'effort' && caps.defaultEffort === 'off', '未收录可调 effort，默认 Off');
  ok(caps.contextWindow === FALLBACK_CONTEXT_WINDOW, '未收录滑块上限 2M');
  ok(defaultWorkingContext(caps.contextWindow, caps.source) === FALLBACK_WORKING_CONTEXT, '未收录工作上下文默认 128k');
  ok(contextPresets(caps.contextWindow).includes(1000000), '未收录可用 1M 档');
  ok(catalogSourceLabel(caps.source) === '未知模型，未收录', '来源标签');

  let captured = null;
  const restoreOff = withFetch((url, init) => { captured = JSON.parse(init.body); return jsonResponse({ choices: [{ message: { content: 'ok' } }] }); });
  await chatComplete({ protocol: 'openai', baseUrl: 'https://gateway.example/v1', apiKey: 'k', model: 'citecat-unknown-zz9' }, [{ role: 'user', content: 'x' }], {});
  restoreOff();
  ok(!captured.reasoning_effort && !captured.thinking, '未收录默认 Off 不发思考字段');

  captured = null;
  const restoreHi = withFetch((url, init) => { captured = JSON.parse(init.body); return jsonResponse({ choices: [{ message: { content: 'ok' } }] }); });
  await chatComplete({ protocol: 'openai', baseUrl: 'https://gateway.example/v1', apiKey: 'k', model: 'citecat-unknown-zz9', effort: 'high' }, [{ role: 'user', content: 'x' }], {});
  restoreHi();
  ok(captured.reasoning_effort === 'high' && !captured.thinking, '未收录 High 发 reasoning_effort');
}

/* ---- 15. 思考参数 400：未知字段剥掉；xhigh 先降一档 ---- */
{
  resetEffortProbeForTests();
  let n = 0;
  const bodies = [];
  const restore = withFetch((url, init) => {
    n += 1;
    bodies.push(JSON.parse(init.body));
    if (n === 1) return jsonResponse({ error: { message: 'Unknown parameter: reasoning_effort' } }, 400);
    return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
  });
  const r = await chatComplete({ protocol: 'openai', baseUrl: 'https://gateway.example/v1', apiKey: 'k', model: 'citecat-unknown-strip', effort: 'high' }, [{ role: 'user', content: 'x' }], {});
  restore();
  ok(n === 2 && bodies[0].reasoning_effort === 'high' && !bodies[1].reasoning_effort && !bodies[1].thinking, '未知思考字段则剥掉重试');
  ok(r.content === 'ok', '剥字段后成功');

  resetEffortProbeForTests();
  n = 0;
  bodies.length = 0;
  const restoreDrop = withFetch((url, init) => {
    n += 1;
    bodies.push(JSON.parse(init.body));
    if (n === 1) return jsonResponse({ error: { message: 'invalid reasoning_effort: xhigh' } }, 400);
    return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
  });
  await chatComplete({ protocol: 'openai', baseUrl: 'https://gateway.example/v1', apiKey: 'k', model: 'citecat-unknown-xhigh', effort: 'xhigh' }, [{ role: 'user', content: 'x' }], {});
  restoreDrop();
  ok(n === 2 && bodies[0].reasoning_effort === 'xhigh' && bodies[1].reasoning_effort === 'high', 'xhigh 非法则降到 high');

  const fake401 = { name: 'ApiError', status: 401, body: 'invalid reasoning_effort', message: 'API 401' };
  ok(!isReasoningParamError(fake401), '401 不走思考探测');
  const next = planEffortRetry({ effort: 'high' }, { name: 'ApiError', status: 400, body: 'context length exceeded', message: 'API 400' });
  ok(!next, '超窗不改 effort');
}

console.log(`providers-smoke: ${passed} assertions passed`);
