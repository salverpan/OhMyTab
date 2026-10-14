/* docx 图表插图链路冒烟（node test/docx-chart-smoke.mjs）
 * 覆盖：markdown 图表引用解析 → 正文 OOXML（图片/题注/来源/缺图占位）→ zip 结构（media/rels/content-types/命名空间）
 *      → 打印锁定 option（白底/止动画/字号）→ 图表登记表（题注来源 + 上限回收）。
 * 不碰 DOM / indexedDB（光栅化本身由 test 之外的真页面负责）。 */

import assert from 'node:assert';
import JSZip from 'jszip';
import {
  markdownToBodyXml, markdownToDocxBuffer, findChartRefs, findMediaRefs, fitImagePx,
  PX_TO_EMU, PRINT_IMAGE_MAX_PX,
} from '../src/lib/create-docx.js';
import {
  buildPlotOption, printLockOption, PRINT_CHART_WIDTH, PRINT_CHART_HEIGHT, PRINT_FONT_FAMILY,
} from '../src/lib/plot-spec.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

/* ---------- 1) 引用解析：四种写法、去重、代码块不外泄 ---------- */
ok(JSON.stringify(findChartRefs('![图](chart:cht_a)')) === '["cht_a"]', '标准图片语法被识别');
ok(JSON.stringify(findChartRefs('![chart:cht_b]')) === '["cht_b"]', '![chart:id] 被识别');
ok(JSON.stringify(findChartRefs('[[chart:cht_c]]')) === '["cht_c"]', '[[chart:id]] 被识别');
ok(JSON.stringify(findChartRefs('![销量走势](chart:cht_d)\n\n正文\n\n![图](chart:cht_d)')) === '["cht_d"]', '同 id 只算一次');
ok(findChartRefs('正文里提到 chart:cht_x 但没有方括号').length === 0, '裸 chart: 不算引用（避免误吞正文）');
ok(findChartRefs('').length === 0 && findChartRefs(null).length === 0, '空输入安全');
ok(JSON.stringify(findMediaRefs('![现场](img:img_a)').map((x) => `${x.kind}:${x.id}`)) === '["img:img_a"]', 'img: 引用被识别');
ok(JSON.stringify(findMediaRefs('![图](chart:c1)\n![现场](img:i1)').map((x) => `${x.kind}:${x.id}`)) === '["chart:c1","img:i1"]', 'chart 与 img 可同文共存');

/* ---------- 2) 尺寸换算 ---------- */
ok(PX_TO_EMU === 9525, '1 逻辑像素 = 9525 EMU');
const fitted = fitImagePx(1280, 720);
ok(fitted.width === PRINT_IMAGE_MAX_PX && fitted.height === 315, '超宽图等比压到可打印宽度: ' + JSON.stringify(fitted));
ok(fitImagePx(480, 270).width === 480, '未超宽的图不放大');

/* ---------- 3) 正文：图片 / 题注 / 来源 / 缺图占位 ---------- */
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const images = new Map([
  ['cht_1', { bytes: png, width: 480, height: 270, caption: '月度销量', source: '来源：Reuters，2024-08 口径' }],
]);
const md = [
  '# 报告',
  '',
  '正文第一段。',
  '',
  '![月度销量](chart:cht_1)',
  '',
  '正文第二段。',
].join('\n');
const body = markdownToBodyXml(md, { images });
ok(body.includes('<wp:inline'), '图片段落含 wp:inline');
ok(body.includes('r:embed="rIdImg1"'), '图片引用 relId: rIdImg1');
ok(body.includes(`cx="${480 * PX_TO_EMU}"`) && body.includes(`cy="${270 * PX_TO_EMU}"`), 'extent 按 EMU 换算');
ok(body.includes('图 1：月度销量'), '题注带「图 N：说明」');
ok(body.includes('来源：Reuters，2024-08 口径') && body.includes('w:sz w:val="16"'), '来源行 8pt 灰字');
ok(body.includes('<w:keepNext/>'), '图片段落 keepNext（题注不被分页撕开）');
ok(body.includes('正文第一段') && body.includes('正文第二段'), '引用前后正文保留');

const bodyMulti = markdownToBodyXml('![a](chart:cht_1)\n\n![b](chart:cht_1)', { images });
ok(bodyMulti.includes('图 1：') && bodyMulti.includes('图 2：'), '同一张图引用两次按出现顺序各自编号');

const bodyCode = markdownToBodyXml('```\n![a](chart:cht_1)\n```', { images });
ok(!bodyCode.includes('<wp:inline'), '代码块里的引用保持字面文本（不插图）');

const bodyMissing = markdownToBodyXml('![a](chart:cht_gone)', { images });
ok(bodyMissing.includes('图表缺图：cht_gone') && !bodyMissing.includes('<wp:inline'), '取不到字节的引用留可见占位');
const bodyNoImages = markdownToBodyXml('![a](chart:cht_1)');
ok(bodyNoImages.includes('图表缺图：cht_1'), '没传 images 表时同样走占位（不静默丢）');

/* ---------- 4) zip 结构 ---------- */
const ab = await markdownToDocxBuffer(md, { title: '报告', images });
const zip = await JSZip.loadAsync(ab);
const docXml = await zip.file('word/document.xml').async('string');
const ct = await zip.file('[Content_Types].xml').async('string');
const rels = await zip.file('word/_rels/document.xml.rels').async('string');
ok(!!zip.file('word/media/image1.png'), 'zip 里有 word/media/image1.png');
ok((await zip.file('word/media/image1.png').async('uint8array')).length === png.length, 'media 字节与入参一致');
ok(ct.includes('<Default Extension="png" ContentType="image/png"/>'), 'Content_Types 声明 png');
ok(rels.includes('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"')
  && rels.includes('Target="media/image1.png"'), 'rels 里登记 image 关系');
ok(docXml.includes('xmlns:wp=') && docXml.includes('xmlns:a=') && docXml.includes('xmlns:pic=') && docXml.includes('xmlns:r='), '根元素声明 drawing 命名空间');
ok(docXml.includes('<wp:docPr id="101" name="图表1"/>'), 'docPr id 唯一且可预期');

// 命名空间感知解析：像 Word 一样按 ns+localName 取元素，确认 drawing 结构成立、r:embed 能落到真关系上
const { DOMParser: XDP } = await import('@xmldom/xmldom');
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NSW = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const xdoc = new XDP().parseFromString(docXml, 'application/xml');
ok(xdoc.getElementsByTagNameNS(NSW, 'drawing').length === 1, 'w:drawing 按命名空间可见');
ok(xdoc.getElementsByTagNameNS(NS_WP, 'inline').length === 1, 'wp:inline 按命名空间可见');
ok(xdoc.getElementsByTagNameNS(NS_PIC, 'pic').length === 1, 'pic:pic 按命名空间可见');
const blip = xdoc.getElementsByTagNameNS(NS_A, 'blip')[0];
ok(!!blip, 'a:blip 按命名空间可见');
const embedId = blip && blip.getAttributeNS(NS_R, 'embed');
const relIds = [...rels.matchAll(/Id="([^"]+)"[^>]*relationships\/image/g)].map((m) => m[1]);
ok(!!embedId && relIds.includes(embedId), `r:embed 指向真实的 image 关系（${embedId} ∈ [${relIds.join(',')}]）`);
const extent = xdoc.getElementsByTagNameNS(NS_WP, 'extent')[0];
ok(extent && Number(extent.getAttribute('cx')) === 480 * PX_TO_EMU, 'wp:extent 的 cx 是 480px 换算值');

const abPlain = await markdownToDocxBuffer('普通文档，无图。', {});
const zipPlain = await JSZip.loadAsync(abPlain);
ok(!(await zipPlain.file('[Content_Types].xml').async('string')).includes('png'), '无图文档不引入 png 声明');
ok(!(await zipPlain.file('word/document.xml').async('string')).includes('xmlns:wp='), '无图文档不引入 drawing 命名空间（字节兼容）');

/* ---------- 5) 打印锁定 option ---------- */
const args = {
  title: '月度销量', type: 'line',
  data: [{ month: '1月', units: 12 }, { month: '2月', units: 18 }],
  source: '来源：示例',
};
const chatBuilt = buildPlotOption(args);
const printBuilt = buildPlotOption(args, { mode: 'print' });
ok(chatBuilt.ok && printBuilt.ok, '两种模式都能出图');
ok(chatBuilt.chart.option.animationDuration === 280 && !chatBuilt.chart.option.backgroundColor, '聊天模式保持原有动效/透明底');
const po = printBuilt.chart.option;
ok(po.animation === false, '打印锁定关动画');
ok(po.backgroundColor === '#ffffff', '打印锁定白底');
ok(po.tooltip && po.tooltip.show === false, '打印锁定关 tooltip');
ok(po.textStyle.fontFamily === PRINT_FONT_FAMILY && po.textStyle.color === '#18181b', '打印锁定固定字体栈与墨色');
ok(po.xAxis.axisLabel.fontSize === 11 && po.yAxis.axisLabel.fontSize === 11, '打印锁定放大轴标签字号（印到纸上 ≥9pt）');
ok(po.yAxis.splitLine.lineStyle.color === 'rgba(0,0,0,0.10)', '打印锁定网格线改浅灰实线');
ok(PRINT_CHART_WIDTH === 480 && PRINT_CHART_HEIGHT === 270, '打印逻辑尺寸 480×270（16:9）');
ok(printLockOption(null).backgroundColor === '#ffffff' && buildPlotOption(args).chart.option.tooltip.show !== false, 'printLockOption 不改原 option 对象');

/* ---------- 6) 图表登记表：题注/来源 + 上限回收 ---------- */
const store = new Map();
globalThis.chrome = {
  storage: {
    local: {
      async get(k) { const keys = Array.isArray(k) ? k : [k]; const out = {}; for (const key of keys) if (store.has(key)) out[key] = JSON.parse(store.get(key)); return out; },
      async set(obj) { for (const [k, v] of Object.entries(obj)) store.set(k, JSON.stringify(v)); },
      async remove(k) { for (const key of (Array.isArray(k) ? k : [k])) store.delete(key); },
    },
  },
};
const { saveChartRef, getChartRef, dropChartRef, chartBlobKey, loadChartRefs } = await import('../src/lib/chart-store.js');
await saveChartRef('cht_1', { caption: '月度销量', source: '来源：Reuters', width: 480, height: 270 });
const ref1 = await getChartRef('cht_1');
ok(ref1.caption === '月度销量' && ref1.source === '来源：Reuters' && ref1.width === 480, '登记表保存题注/来源/尺寸');
ok(chartBlobKey('cht_1') === 'chart:cht_1', 'PNG 在 doc-store 里的键与 markdown 引用同形');
ok(await dropChartRef('cht_1') === true && (await getChartRef('cht_1')) === null, '删除登记');
ok(await dropChartRef('cht_1') === false, '重复删除返回 false');

const { MAX_REFS } = await import('../src/lib/chart-store.js');
for (let i = 0; i < MAX_REFS + 5; i++) {
  await saveChartRef('cht_old_' + i, { caption: 'c' + i, width: 480, height: 270 });
}
const kept = await loadChartRefs();
ok(Object.keys(kept).length === MAX_REFS, `登记表上限 ${MAX_REFS} 条: ` + Object.keys(kept).length);
ok(!kept.cht_old_0 && kept['cht_old_' + (MAX_REFS + 4)], '超限按时间淘汰最旧的（保留最新）');

/* ---------- 7) 导出路径 markdownToDocxBlob（docx npm 库那条线）----------
 * 图片字节解析要 indexedDB（doc-store），Node 里不可用，所以这里显式传 options.images
 * ——与执行器在浏览器里传的表同形；解析逻辑本身由 chart-store 的用例覆盖。 */
const { markdownToDocxBlob, entriesToMarkdownDocxBlob } = await import('../src/lib/md-to-docx.js');
const mdExport = '# 销量报告\n\n正文。\n\n![月度销量](chart:cht_1)\n\n![趋势](chart:cht_1)\n';
const blob = await markdownToDocxBlob(mdExport, { images: images });
const zipE = await JSZip.loadAsync(await blob.arrayBuffer());
// docx 库按内容 hash 命名媒体文件（不是 image1.png）：只断言「恰好一张 png 且字节一致」
const mediaE = Object.keys(zipE.files).filter((f) => /^word\/media\/.+\.png$/.test(f));
ok(mediaE.length === 1, '导出路径：恰好一张 png 进 media（' + mediaE.join(',') + '）');
ok(mediaE.length === 1 && (await zipE.file(mediaE[0]).async('uint8array')).length === png.length, '导出路径：图片字节一致');
const docE = await zipE.file('word/document.xml').async('string');
ok(docE.includes('<w:drawing>') || docE.includes(':drawing>'), '导出路径：正文含 drawing');
ok(docE.includes('图 1：月度销量') && docE.includes('图 2：月度销量'), '导出路径：两张图按出现顺序各自编号');
ok(docE.includes('来源：Reuters，2024-08 口径'), '导出路径：来源行进正文');
ok(!docE.includes('[图: '), '导出路径：有图时不留灰字占位');
const ctE = await zipE.file('[Content_Types].xml').async('string');
const relsE = await zipE.file('word/_rels/document.xml.rels').async('string');
ok(ctE.toLowerCase().includes('png') && relsE.includes('image'), '导出路径：docx 库自动补 png 声明与 image 关系');
ok(!Object.keys(zipE.files).some((f) => f.endsWith('.undefined')), '导出路径：媒体扩展名必须是 png（缺 type 会生成 .undefined，Word 直接坏）');

const blobNoImg = await markdownToDocxBlob('![x](chart:cht_missing)', { images: null });
const zipN = await JSZip.loadAsync(await blobNoImg.arrayBuffer());
ok(!zipN.file('word/media/image1.png'), '导出路径：无字节时不塞空图片');
ok((await zipN.file('word/document.xml').async('string')).includes('图表缺图：cht_missing'), '导出路径：缺图留可见占位');

const blobMulti = await entriesToMarkdownDocxBlob([
  { aiTitle: '甲', fullText: '正文甲' },
  { aiTitle: '乙', fullText: '正文乙' },
]);
const zipM = await JSZip.loadAsync(await blobMulti.arrayBuffer());
ok(!!zipM.file('word/document.xml'), '多条目合并导出仍产出合法 docx（无图时不炸）');

console.log('docx-chart-smoke: ALL PASS (' + passed + ' assertions)');
