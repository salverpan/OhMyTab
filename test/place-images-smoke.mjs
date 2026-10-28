/* 图片交货冒烟（node test/place-images-smoke.mjs）。不碰 chrome.* / IndexedDB。 */

import assert from 'node:assert/strict';
import {
  imageFormatFrom, mimeForFormat, dataUrlToBytes, bytesToDataUrl,
  PLACE_IMAGES_MAX, PLACE_IMAGE_SOURCE, runPlaceImages,
} from '../src/lib/place-images.js';
import { findMediaRefs, markdownToBodyXml } from '../src/lib/create-docx.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { PARENT_ONLY_TOOLS } from '../src/lib/subagent-policy.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(PLACE_IMAGES_MAX === 8, '一次最多 8 张');
ok(PLACE_IMAGE_SOURCE === 'place', '中转来源标记为 place');
ok(imageFormatFrom('image/png', '') === 'png', 'mime png');
ok(imageFormatFrom('image/webp', '') === 'webp', 'mime webp');
ok(imageFormatFrom('image/gif', '') === 'gif', 'mime gif');
ok(imageFormatFrom('image/jpeg', '') === 'jpg', 'mime jpeg → jpg');
ok(imageFormatFrom('', 'https://x.test/a.PNG?w=1') === 'png', 'url 扩展名');
ok(mimeForFormat('png') === 'image/png' && mimeForFormat('jpg') === 'image/jpeg', 'format → mime');

const raw = new Uint8Array([1, 2, 3, 250, 255]);
const dataUrl = bytesToDataUrl(raw.buffer, 'image/jpeg');
const back = dataUrlToBytes(dataUrl);
ok(back && back.mime === 'image/jpeg', 'dataUrl 解析 mime');
ok(Buffer.from(back.bytes).equals(Buffer.from(raw)), 'dataUrl 往返字节一致');

const tool = CHAT_TOOLS.find((t) => t.function.name === 'place_images');
ok(!!tool, 'CHAT_TOOLS 含 place_images');
ok(tool.function.parameters.properties.to.enum.join(',') === 'chat,editor,document', 'to 三终点');
ok(/screenshot=true/.test(tool.function.description) && /region_selector/.test(tool.function.description), '截屏支持视口/区域且不兜底扒 img');
ok(tool.function.parameters.properties.persist?.enum?.join(',') === 'transient,source', '图片保存语义 persist');
ok(PARENT_ONLY_TOOLS.has('place_images'), 'place_images 父级专属');

const bad = JSON.parse(await runPlaceImages({ to: 'clipboard' }, { projectId: 'p' }));
ok(bad.ok === false && /chat/.test(bad.error), '非法 to 被拒且不碰 chrome');

const refs = findMediaRefs('先看图\n\n![封面](img:abc-1)\n\n![chart:cht_9]');
ok(refs[0].kind === 'img' && refs[0].id === 'abc-1' && refs[0].caption === '封面', '标准 img 引用');
ok(refs[1].kind === 'chart' && refs[1].id === 'cht_9', '同文 chart 简写仍可解析');

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const body = markdownToBodyXml('![封面](img:abc-1)', {
  images: new Map([['abc-1', { bytes: png, width: 200, height: 100, caption: '封面', source: '' }]]),
});
ok(body.includes('<wp:inline') && body.includes('图 1：封面'), 'img 引用能嵌进 docx 正文');

console.log(`place-images-smoke: ${passed} passed`);
