/* 多协议适配层共享工具（纯模块，无 chrome.* 依赖，SW 与页面共用） */

/** 带 status/body 的 API 错误：宿主按 e.status/e.body 做细分处理
 * （如 visionChat 对 400+max_tokens 自动减半重试、isContextOverflowError
 * 靠 message 文本匹配——所以 message 里必须带响应体片段）。 */
export class ApiError extends Error {
  constructor(status, body) {
    const text = String(body || '').slice(0, 400);
    super(`API ${status}${text ? ': ' + text : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = String(body || '');
  }
}

/**
 * 读 SSE 流并按完整行回调。三个协议的流式响应都是 "data: {json}" 行格式，
 * 共用这一个读取器；一条 data 行可能跨网络 chunk 到达，必须拼接完整行再交出去
 * （长工具参数必然跨 chunk，半行解析失败会把增量静默吞掉）。
 * @param {Response} response 已 ok 的 fetch 响应
 * @param {(line: string) => void} handleLine 每个完整行回调（含末尾无换行的最后一行）
 */
export async function readSseLines(response, handleLine) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuf = '';
  while (true) {
    let done, value;
    try {
      ({ done, value } = await reader.read());
    } catch (err) {
      if (err && err.name === 'AbortError') return; // 用户中止：返回已累积的部分结果
      throw err;
    }
    if (done) break;
    lineBuf += decoder.decode(value, { stream: true });
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop(); // 末尾若是半行，留到下一次 read 拼接
    for (const line of lines) handleLine(line);
  }
  if (lineBuf) handleLine(lineBuf); // 有的服务最后一行不带换行符
}

/** 提取 SSE 行里的 data JSON 负载；非 data 行（event:/注释/空行）与 [DONE] 返回 null */
export function parseSseData(line) {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data);
  } catch (_) {
    return null; // 半行/脏行由 readSseLines 的拼接机制兜住，这里只防个别服务发的非法行
  }
}

/** 规范消息 content 可能是 string 或内容块数组，取纯文本（system/tool 等纯文本场景用） */
export function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((p) => p.type === 'text').map((p) => p.text).join('');
  }
  return '';
}

/** 解析 data URL 图片为 { mediaType, base64 }；非 data URL（http(s)）返回 null */
export function parseDataImageUrl(url) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(url || ''));
  if (!m) return null;
  return { mediaType: m[1] || 'image/png', base64: m[3] || '' };
}

export function safeJsonParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}
