/**
 * 对话里的图按出现时刻插进正文，而不是整段文字写完再堆在底部。
 * image.at = 插入时已经写完的正文字数。没有 at 的旧图仍排在正文后面。
 */

export function timelineParts(text, images) {
  const src = text || '';
  const groups = new Map();
  const legacy = [];
  for (const image of images || []) {
    if (!image || !image.dataUrl) continue;
    if (!Number.isFinite(image.at)) {
      legacy.push(image);
      continue;
    }
    const at = Math.max(0, Math.min(src.length, image.at));
    if (!groups.has(at)) groups.set(at, []);
    groups.get(at).push(image);
  }
  const parts = [];
  let cursor = 0;
  for (const at of [...groups.keys()].sort((a, b) => a - b)) {
    if (at > cursor) parts.push({ kind: 'text', text: src.slice(cursor, at) });
    for (const image of groups.get(at)) parts.push({ kind: 'img', image });
    cursor = at;
  }
  if (cursor < src.length) parts.push({ kind: 'text', text: src.slice(cursor) });
  for (const image of legacy) parts.push({ kind: 'img', image });
  if (!parts.some((p) => p.kind === 'text')) parts.push({ kind: 'text', text: '' });
  else if (parts[parts.length - 1].kind !== 'text') parts.push({ kind: 'text', text: '' });
  return parts;
}

/**
 * 就地重排气泡里的正文段和图片。返回最后一段正文节点，后续流式文字写在它上面。
 * 已有节点按 id / 顺序复用，避免每字重建图片。
 */
export function syncInlineMedia(bubble, fullText, images, {
  streamClass = 'chat-stream-body',
  streamTag = 'div',
  pinSelector = ':scope > .chat-ai-row',
  renderSlice,
} = {}) {
  if (!bubble) return null;
  const doc = bubble.ownerDocument;
  const parts = timelineParts(fullText, images);
  const pin = pinSelector ? bubble.querySelector(pinSelector) : null;
  bubble.querySelectorAll(':scope > .chat-placed-images').forEach((el) => el.remove());

  const streamPool = [...bubble.querySelectorAll(`:scope > .${streamClass}`)];
  const existingImgs = new Map(
    [...bubble.querySelectorAll(':scope > .chat-placed-image')].map((el) => [el.dataset.placedId, el]),
  );
  const ordered = [];
  let lastStream = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (part.kind === 'text') {
      if (!part.text && !isLast) continue;
      let el = streamPool.shift();
      if (!el) {
        el = doc.createElement(streamTag);
        el.className = streamClass;
      }
      const range = isLast ? `tail:${part.text.length}` : `mid:${i}:${part.text.length}`;
      if (el.dataset.range !== range) {
        el.dataset.range = range;
        if (typeof renderSlice === 'function') renderSlice(el, part.text);
        else el.textContent = part.text;
      }
      el.hidden = !part.text;
      lastStream = el;
      ordered.push(el);
      continue;
    }
    const image = part.image;
    let el = existingImgs.get(String(image.id));
    if (!el) {
      el = doc.createElement('img');
      el.className = 'chat-placed-image';
      el.dataset.placedId = image.id;
      el.alt = image.alt || '';
    }
    if (el.getAttribute('src') !== image.dataUrl) el.src = image.dataUrl;
    if ((el.alt || '') !== (image.alt || '')) el.alt = image.alt || '';
    existingImgs.delete(String(image.id));
    ordered.push(el);
  }

  const firstManaged = bubble.querySelector(`:scope > .${streamClass}, :scope > .chat-placed-image`);
  const marker = doc.createComment('inline-media');
  if (firstManaged && firstManaged.parentNode === bubble) bubble.insertBefore(marker, firstManaged);
  else if (pin && pin.parentNode === bubble) bubble.insertBefore(marker, pin);
  else bubble.appendChild(marker);
  let cursor = marker;
  for (const el of ordered) {
    cursor.after(el);
    cursor = el;
  }
  marker.remove();
  for (const el of streamPool) el.remove();
  for (const el of existingImgs.values()) el.remove();
  return lastStream;
}
