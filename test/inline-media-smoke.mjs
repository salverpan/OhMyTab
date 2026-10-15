import assert from 'node:assert/strict';
import { timelineParts } from '../src/lib/inline-media.js';

const img = (id, at) => ({ id, at, dataUrl: 'data:image/png;base64,xx', alt: id });

function kinds(parts) {
  return parts
    .filter((p) => p.kind === 'img' || p.text)
    .map((p) => (p.kind === 'img' ? `img:${p.image.id}` : `text:${p.text}`));
}

assert.deepEqual(
  kinds(timelineParts('说明在图下面', [img('shot', 0)])),
  ['img:shot', 'text:说明在图下面'],
  '截图先于正文时，图在上',
);

assert.deepEqual(
  kinds(timelineParts('先看这段', [img('shot', 4)])),
  ['text:先看这段', 'img:shot'],
  '正文写完再截图时，图在下',
);

assert.deepEqual(
  kinds(timelineParts('上文结论', [img('a', 2)])),
  ['text:上文', 'img:a', 'text:结论'],
  '图插在两段文字之间',
);

assert.deepEqual(
  kinds(timelineParts('同时', [img('a', 2), img('b', 2)])),
  ['text:同时', 'img:a', 'img:b'],
  '同一时刻的多张图按调用顺序上下排',
);

assert.deepEqual(
  kinds(timelineParts('旧消息', [{ id: 'old', dataUrl: 'data:image/png;base64,xx' }])),
  ['text:旧消息', 'img:old'],
  '没有锚点的旧图仍在正文后面',
);

console.log('inline-media-smoke ok');
