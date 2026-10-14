/**
 * 一轮 assistant(tool_calls) + tool 结果落账。
 * 子代理把 apiMessages 与 historyMessages 指到同一数组；若各 push 一次，
 * Anthropic 会看到连续两条 tool_use、中间没有 tool_result，下一轮 400。
 */
export function commitRoundToolTranscript(apiMessages, historyMessages, assistantMsg, toolPairs) {
  const same = apiMessages === historyMessages;
  apiMessages.push(assistantMsg);
  if (!same) historyMessages.push(assistantMsg);
  for (const pair of toolPairs || []) {
    apiMessages.push(pair.api);
    if (!same) historyMessages.push(pair.history);
  }
}

/** 前台 browser_act 附在编号表后的视口截图。历史与落盘只留这句话，不留像素。 */
export const VIEWPORT_SHOT_PREFIX = '【视口截图】';
export const VIEWPORT_SHOT_KEEP = 3;
const VIEWPORT_SHOT_OMITTED = `${VIEWPORT_SHOT_PREFIX}较早的视口截图已省略，以最新一张和编号表为准。`;

export function isViewportShotMessage(message) {
  if (!message || message.role !== 'user' || !Array.isArray(message.content)) return false;
  return message.content.some((part) => part
    && part.type === 'text'
    && String(part.text || '').startsWith(VIEWPORT_SHOT_PREFIX));
}

export function viewportShotMessage(dataUrl, text) {
  const caption = String(text || '').trim().startsWith(VIEWPORT_SHOT_PREFIX)
    ? String(text).trim()
    : `${VIEWPORT_SHOT_PREFIX}与上一条 browser_act 编号表是同一视口。点选用表中编号。截图里看得见但表里没有的控件，再用 interact_page(click_at)。`;
  return {
    role: 'user',
    content: [
      { type: 'text', text: caption },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  };
}

function demoteViewportShot() {
  return { role: 'user', content: VIEWPORT_SHOT_OMITTED };
}

/**
 * 把本轮截图接到发给模型的消息末尾（全部 tool 结果之后）。
 * api 与 history 不是同一数组时，像素只进 api，历史不写。
 * 同一数组（子代理）只 push 一次。本轮里最多留 VIEWPORT_SHOT_KEEP 张，更早的改成一句省略说明。
 */
function normalizeShot(item) {
  if (typeof item === 'string' && item.startsWith('data:image')) return { url: item, text: '' };
  if (item && typeof item.url === 'string' && item.url.startsWith('data:image')) {
    return { url: item.url, text: item.text || '' };
  }
  return null;
}

export function appendViewportShots(apiMessages, historyMessages, dataUrls) {
  const incoming = (dataUrls || []).map(normalizeShot).filter(Boolean).slice(-VIEWPORT_SHOT_KEEP);
  if (!incoming.length || !Array.isArray(apiMessages)) return;
  const withImage = [];
  for (let i = 0; i < apiMessages.length; i++) {
    const message = apiMessages[i];
    if (!isViewportShotMessage(message)) continue;
    if (message.content.some((part) => part && part.type === 'image_url')) withImage.push(i);
  }
  const room = Math.max(0, VIEWPORT_SHOT_KEEP - incoming.length);
  const demoteCount = Math.max(0, withImage.length - room);
  for (let n = 0; n < demoteCount; n++) apiMessages[withImage[n]] = demoteViewportShot();
  for (const shot of incoming) apiMessages.push(viewportShotMessage(shot.url, shot.text));
  // historyMessages 与 api 分离时故意不写入像素。同一引用已随 api push 带上。
  void historyMessages;
}

/** 落盘副本：视口截图换成省略说明，不改内存里仍要发给模型的那份。 */
export function stripViewportShotsForStorage(messages) {
  return (messages || []).map((message) => (isViewportShotMessage(message) ? demoteViewportShot() : message));
}
