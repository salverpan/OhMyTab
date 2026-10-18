/* 正文图编号（node test/figure-catalog-smoke.mjs）。不碰 chrome。 */

import assert from 'node:assert/strict';
import {
  absUrl, imageUrlKey, sameImageUrl, largestFromSrcset, resolveImageUrl,
  figureCaption, normalizeFigs, FIGURE_MAX,
} from '../src/lib/figure-catalog.js';
import { runPlaceImages } from '../src/lib/place-images.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const base = 'https://news.example/a/story';
ok(absUrl('/img/a.jpg', base) === 'https://news.example/img/a.jpg', '相对地址补全');
ok(absUrl('blob:https://news.example/x', base) === '', 'blob 不收');
ok(absUrl('data:image/gif;base64,AAAA', base) === '', '过短 data URL 不收');

ok(largestFromSrcset('/s.jpg 320w, /l.jpg 1280w', base).endsWith('/l.jpg'), 'srcset 取最大宽度');
ok(
  resolveImageUrl({ currentSrc: '', src: '/tiny.jpg', dataSrc: '/real.jpg', srcset: '' }, base).endsWith('/real.jpg'),
  '懒加载地址优先于空的 currentSrc',
);
ok(
  resolveImageUrl({ currentSrc: 'https://cdn.example/shown.jpg', src: '/other.jpg', dataSrc: '/lazy.jpg' }, base) === 'https://cdn.example/shown.jpg',
  '已经显示的 currentSrc 定死',
);

ok(figureCaption({ figcaption: '  折线 图 ', alt: 'alt' }) === '折线 图', '图注优先于 alt');
ok(figureCaption({ figcaption: '', alt: '只有说明' }) === '只有说明', '没有图注时用 alt');

const full = 'https://cdn.example/a.jpg?w=1200&utm_source=tw';
const other = 'https://cdn.example/a-thumb.jpg';
ok(sameImageUrl(full, 'https://cdn.example/a.jpg?utm_source=tw&w=1200'), '去掉追踪参数后是同一张');
ok(!sameImageUrl(full, other), '共用目录的另一张图不算同一张');
ok(imageUrlKey(full).includes('w=1200') && !imageUrlKey(full).includes('utm_source'), '保留尺寸参数');

const figs = normalizeFigs([
  { n: 2, tab_id: 7 },
  { n: 0, url: 'https://news.example/a' },
  { n: 99 },
  { n: 'x' },
]);
ok(figs.length === 2 && figs[0].n === 2 && figs[0].tab_id === 7, '编号按给出的顺序保留');
ok(figs[1].n === 0 && figs[1].url.includes('news.example'), '0 是封面');
ok(FIGURE_MAX === 12, '清单上限 12');

const tool = CHAT_TOOLS.find((t) => t.function.name === 'place_images');
ok(!!tool.function.parameters.properties.figs, 'place_images 接收 figs');

const missed = JSON.parse(await runPlaceImages({ to: 'document', figs: [{ n: 1, url: 'https://news.example/a' }] }, { projectId: 'p' }));
ok(missed.ok === false && /编号/.test(missed.error), '没有浏览器时按编号取图会说明原因，不抛错');

console.log(`figure-catalog-smoke: ${passed} passed`);
