/* 图片工作流冒烟：截图裁剪 / 临时清理 / 图片随来源主干清空。node test/image-workflow-smoke.mjs */
import assert from 'node:assert/strict';
import {
  bytesToDataUrl, cropViewportShot, filterDiscardablePlaceImages,
  normalizeViewportRect, runPlaceImages, shouldDiscardPlaceImages,
} from '../src/lib/place-images.js';
import {
  inferEntryType, normalizeEntryRecord, selectEntriesForTrunkClear,
} from '../src/lib/source-model.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const tool = CHAT_TOOLS.find((t) => t.function.name === 'place_images');
ok(!!tool, 'place_images 存在');
const props = tool.function.parameters.properties;
ok(props.persist?.enum?.join(',') === 'transient,source', 'persist 只有 transient/source');
ok(!Object.prototype.hasOwnProperty.call(props, 'keep'), '旧 keep 参数已移除');
ok(props.region_selector?.type === 'string', '支持 region_selector');
ok(props.region?.type === 'object' && props.region.required.join(',') === 'x,y,w,h', '支持 region={x,y,w,h}');

// 1) 截图裁剪：CSS 视口区域按截图位图缩放后裁切，并输出 PNG。
const box = normalizeViewportRect({ x: -20, y: 30, w: 300, h: 200, vw: 1000, vh: 500 });
ok(box && box.x === 0 && box.y === 30 && box.w === 280 && box.h === 200, '截图区域夹到视口内');
ok(normalizeViewportRect({ x: 10, y: 10, w: 2, h: 2, vw: 1000, vh: 500 }) === null, '过小截图区域被拒');

const oldCreateImageBitmap = globalThis.createImageBitmap;
const oldOffscreenCanvas = globalThis.OffscreenCanvas;
const drawCalls = [];
let cropCanvas = null;
globalThis.createImageBitmap = async () => ({ width: 2000, height: 1000, close() {} });
globalThis.OffscreenCanvas = class {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    cropCanvas = this;
  }
  getContext() {
    return { drawImage: (...args) => drawCalls.push(args) };
  }
  async convertToBlob() {
    return { arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer };
  }
};
try {
  const src = bytesToDataUrl(new Uint8Array([1, 2, 3]).buffer, 'image/png');
  const out = await cropViewportShot(src, { x: 100, y: 50, w: 200, h: 100, vw: 1000, vh: 500 });
  ok(out?.mime === 'image/png' && Buffer.from(out.bytes).equals(Buffer.from([7, 8, 9])), '裁剪结果输出 PNG');
  ok(cropCanvas?.width === 400 && cropCanvas?.height === 200, '裁剪目标尺寸按 device scale 计算');
  ok(drawCalls.length === 1 && drawCalls[0].slice(1).join(',') === '200,100,400,200,0,0,400,200', 'drawImage 使用正确源区域');
  ok(await cropViewportShot(src, { x: 999, y: 999, w: 10, h: 10, vw: 1000, vh: 500 }) === null, '不可用区域不静默回退整图');
} finally {
  if (oldCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = oldCreateImageBitmap;
  if (oldOffscreenCanvas === undefined) delete globalThis.OffscreenCanvas;
  else globalThis.OffscreenCanvas = oldOffscreenCanvas;
}

const badPersist = JSON.parse(await runPlaceImages({ to: 'chat', persist: 'keep' }, { projectId: 'p' }));
ok(badPersist.ok === false && /transient/.test(badPersist.error), '非法 persist 被拒绝');
const oldKeep = JSON.parse(await runPlaceImages({ to: 'chat', keep: true }, { projectId: 'p' }));
ok(oldKeep.ok === false && /keep 已移除/.test(oldKeep.error), '旧 keep 参数明确报错而不是静默降级');

// 2) 临时清理：只清本次创建且仍为 place 的图片，persist=source 的图片保留。
const entries = [
  { id: 'temp', kind: 'image', source: 'place' },
  { id: 'saved', kind: 'image', source: 'collect' },
  { id: 'doc', kind: 'document', source: 'place' },
  { id: 'untouched', kind: 'image', source: 'place' },
];
const discardable = filterDiscardablePlaceImages(entries, ['temp', 'saved', 'doc']);
ok(discardable.length === 1 && discardable[0].id === 'temp', '临时清理只选中 place 中转图');
ok(shouldDiscardPlaceImages('transient', 'chat') === true, 'transient 交付到聊天后清理');
ok(shouldDiscardPlaceImages('transient', 'document') === false, '文档嵌入由写文档阶段清理');
ok(shouldDiscardPlaceImages('source', 'chat') === false, 'persist=source 永不自动清理');

// 3) 图片直接作为来源：清空来源主干必须一并清空图片，产出不受影响。
const imageSource = normalizeEntryRecord({
  id: 'img-1', kind: 'image', source: 'collect', createdAt: 1,
});
const pageSource = normalizeEntryRecord({
  id: 'page-1', kind: 'page', source: 'Reuters', url: 'https://example.com/a', createdAt: 2,
});
const output = normalizeEntryRecord({
  id: 'out-1', kind: 'document', source: 'AI 生成', createdAt: 3,
});
ok(inferEntryType(imageSource) === 'source', 'persist=source 图片直接归入来源');
ok(imageSource.provenance.type === 'upload' && imageSource.provenance.trustClass === 'source', '图片条目的来源 provenance 保留');
const clearSources = selectEntriesForTrunkClear([imageSource, pageSource, output], 'sources').map((e) => e.id).sort();
ok(clearSources.join(',') === 'img-1,page-1', '清空来源主干会清空图片');
const clearAll = selectEntriesForTrunkClear([imageSource, pageSource, output], 'all').map((e) => e.id).sort();
ok(clearAll.join(',') === 'img-1,out-1,page-1', '清空全部包含图片与产出');

console.log(`image-workflow-smoke: ${passed} passed`);
