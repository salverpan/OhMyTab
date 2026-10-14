/**
 * 粗算 token。中日韩字符约 1 token，其余约 4 字符 1 token。
 * 独立成文件：history-compact 会调用对话接口，适配器不能再反向引用它。
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
  for (const m of messages || []) {
    total += estimateTokens(m?.content || '');
    if (m?.tool_calls) total += estimateTokens(JSON.stringify(m.tool_calls));
    total += 4;
  }
  return total;
}

/** 当轮请求占用：消息 + 工具定义。 */
export function estimateRequestTokens(messages, tools) {
  let n = estimateMessagesTokens(messages);
  if (tools != null && tools !== '') {
    n += estimateTokens(typeof tools === 'string' ? tools : JSON.stringify(tools));
  }
  return n;
}
