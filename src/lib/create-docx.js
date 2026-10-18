/**
 * AI 生成 docx：markdown → 最小合法 Word OOXML。
 * 用 JSZip 写，不把 docx/marked 打进 SW。无 DOM。
 * 侧栏高质量导出仍走 md-to-docx.js（marked + docx 库）。
 */
import JSZip from 'jszip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAX_CHARS = 400000;

/* ---------- 图表图片（G2 光栅化后的 PNG 嵌进 docx） ----------
 * 正文里的图片引用是一行 markdown 图片语法 `![说明](chart:ID)`，ID 指向 doc-store 里
 * 光栅化时存下的 PNG（plot_chart deliver=docx）。渲染成「居中图片 + 图 N 题注 + 来源行」。 */

/** 1 逻辑像素的 EMU（96 DPI）。 */
export const PX_TO_EMU = 9525;
/** 可打印宽度上限（A4 减去 create-docx 的左右页边距 1800/1440 twips ≈ 577px，留 17px 余量）。 */
export const PRINT_IMAGE_MAX_PX = 560;

const DRAW_NS = ` xmlns:r="${OD}"`
  + ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
  + ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
  + ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

/** `![说明](chart:ID)` / `![说明](img:ID)`，以及 `![chart:ID]` / `[[img:ID]]`。 */
const MEDIA_TOKEN_RES = [
  /!\[([^\]]*)\]\((chart|img):([A-Za-z0-9_:-]+)\)/g,
  /!?\[{1,2}(chart|img):([A-Za-z0-9_:-]+)\]{1,2}/g,
];

/** 一行里所有图片引用（图表或来源图）。 */
function mediaTokensIn(line) {
  const s = String(line || '');
  const hits = [];
  for (const re of MEDIA_TOKEN_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      hits.push(m.length > 3
        ? { index: m.index, length: m[0].length, kind: m[2], id: m[3], caption: String(m[1] || '').trim() }
        : { index: m.index, length: m[0].length, kind: m[1], id: m[2], caption: '' });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function chartTokensIn(line) {
  return mediaTokensIn(line);
}

/** 供其它转换器（md-to-docx）复用的同一份引用解析 */
export function chartTokensInLine(line) {
  return chartTokensIn(line);
}

/** markdown 里引用到的全部媒体（chart / img），按首次出现去重。 */
export function findMediaRefs(markdown) {
  const out = [];
  const seen = new Set();
  for (const line of String(markdown || '').split('\n')) {
    for (const t of mediaTokensIn(line)) {
      const key = `${t.kind}:${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: t.kind, id: t.id, caption: t.caption });
    }
  }
  return out;
}

/** markdown 里引用到的全部图表 id（按首次出现顺序去重）；执行器用它判断缺图。 */
export function findChartRefs(markdown) {
  return findMediaRefs(markdown).filter((t) => t.kind === 'chart').map((t) => t.id);
}

/** 等比缩到可打印宽度内（图片按逻辑像素给尺寸，超宽按比例压缩）。 */
export function fitImagePx(width, height, cap = PRINT_IMAGE_MAX_PX) {
  const w = Math.max(1, Math.round(Number(width) || 0) || 640);
  const h = Math.max(1, Math.round(Number(height) || 0) || 360);
  if (w <= cap) return { width: w, height: h };
  const k = cap / w;
  return { width: cap, height: Math.max(1, Math.round(h * k)) };
}

function drawingXml(plan) {
  const cx = plan.width * PX_TO_EMU;
  const cy = plan.height * PX_TO_EMU;
  const name = xmlEscape(plan.name || '图表');
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/><w:keepNext/></w:pPr>'
    + '<w:r><w:drawing>'
    + '<wp:inline distT="0" distB="0" distL="0" distR="0">'
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>`
    + `<wp:docPr id="${plan.docPrId}" name="${name}"/>`
    + '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic>'
    + `<pic:nvPicPr><pic:cNvPr id="${plan.docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${plan.relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
    + `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
    + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

/** 题注（图 N：说明）：图片段落的 keepNext 保证它不跟图分页撕开。 */
function captionXml(text) {
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>'
    + `<w:r><w:rPr><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>${tXml(text)}</w:r></w:p>`;
}

/** 数据来源行（8pt 灰字）：跟题注一起，给读者核对口径用。 */
function sourceXml(text) {
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>'
    + `<w:r><w:rPr><w:color w:val="6B6B73"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>${tXml(text)}</w:r></w:p>`;
}

/** 引用存在但没取到字节（图已被回收/换机器）：留一行可见的占位，不静默吞掉。 */
function missingChartXml(id) {
  return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
    + `<w:r><w:rPr><w:i/><w:color w:val="92929B"/></w:rPr>${tXml('[图表缺图：' + id + ']')}</w:r></w:p>`;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function needsPreserve(text) {
  return /^\s|\s$|\n/.test(text);
}

function tXml(text) {
  const s = String(text ?? '').slice(0, MAX_CHARS);
  const space = needsPreserve(s) ? ' xml:space="preserve"' : '';
  return `<w:t${space}>${xmlEscape(s)}</w:t>`;
}

function runXml(text, { bold, italic, mono } = {}) {
  const pr = [];
  if (bold) pr.push('<w:b/>');
  if (italic) pr.push('<w:i/>');
  if (mono) pr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="宋体"/>');
  const rPr = pr.length ? `<w:rPr>${pr.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}${tXml(text)}</w:r>`;
}

function runsFromInline(raw) {
  const s = String(raw || '');
  if (!s) return runXml('');
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(runXml(s.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(runXml(tok.slice(2, -2), { bold: true }));
    else if (tok.startsWith('`')) out.push(runXml(tok.slice(1, -1), { mono: true }));
    else out.push(runXml(tok.slice(1, -1), { italic: true }));
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(runXml(s.slice(last)));
  return out.join('') || runXml('');
}

function stripMdLink(s) {
  return String(s || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function pXml(inner, pPr = '') {
  return `<w:p>${pPr}${inner}</w:p>`;
}

function headingXml(level, text) {
  const style = 'Heading' + Math.min(6, Math.max(1, level));
  return pXml(runsFromInline(stripMdLink(text)), `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`);
}

function paraXml(text, extraPr = '') {
  return pXml(runsFromInline(stripMdLink(text)), extraPr ? `<w:pPr>${extraPr}</w:pPr>` : '');
}

function listXml(text, ordered, idx) {
  const mark = ordered ? `${idx}. ` : '• ';
  const ind = '<w:ind w:left="360"/>';
  return pXml(runXml(mark) + runsFromInline(stripMdLink(text)), `<w:pPr>${ind}</w:pPr>`);
}

function quoteXml(text) {
  return paraXml(text, '<w:ind w:left="360"/><w:rPr><w:i/></w:rPr>');
}

function codeBlockXml(lines) {
  return lines.map((line) => pXml(runXml(line || ' ', { mono: true }),
    '<w:pPr><w:shd w:val="clear" w:fill="F4F4F5"/></w:pPr>')).join('');
}

function isSepRow(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim()) || /^\|\s*:?-{3,}/.test(line.trim());
}

function tableXml(rows) {
  const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const grid = rows.filter((l) => !isSepRow(l)).map(cellsOf);
  if (!grid.length) return '';
  const cols = Math.max(...grid.map((r) => r.length), 1);
  const trs = grid.map((row, ri) => {
    const tcs = [];
    for (let c = 0; c < cols; c++) {
      const inner = ri === 0
        ? runXml(row[c] || '', { bold: true })
        : runsFromInline(stripMdLink(row[c] || ''));
      tcs.push(`<w:tc><w:tcPr><w:tcW w:w="${Math.round(9000 / cols)}" w:type="dxa"/></w:tcPr>${pXml(inner)}</w:tc>`);
    }
    return `<w:tr>${tcs.join('')}</w:tr>`;
  }).join('');
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="D4D4D8"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${trs}</w:tbl>`;
}

/**
 * 按引用首次出现顺序给图片分配 relId / docPrId，并把尺寸压进可打印宽度。
 * 正文构建器与 zip 构建器共用这一份分配结果（否则正文里的 r:embed 与 rels 会对不上）。
 * @returns {{plans: Map<string, object>, media: Array<{path:string, bytes:any, relId:string}>}}
 */
export function planChartImages(markdown, imageSrc) {
  const plans = new Map();
  const media = [];
  if (!imageSrc) return { plans, media };
  let n = 0;
  for (const ref of findMediaRefs(markdown)) {
    const id = ref.id;
    const src = typeof imageSrc.get === 'function' ? imageSrc.get(id) : imageSrc[id];
    if (!src || !src.bytes) continue;
    n += 1;
    const { width, height } = fitImagePx(src.width, src.height);
    const relId = `rIdImg${n}`;
    plans.set(id, {
      relId,
      docPrId: 100 + n,
      width,
      height,
      name: `图表${n}`,
      caption: String(src.caption || '').slice(0, 120),
      source: String(src.source || '').slice(0, 160),
    });
    media.push({ path: `media/image${n}.png`, bytes: src.bytes, relId });
  }
  return { plans, media };
}

/**
 * markdown → 正文 XML。
 * @param {string} markdown
 * @param {object} [opts]
 * @param {Map} [opts.plans] 已分配好 relId 的图片计划（zip 构建器传入）
 * @param {Map|object} [opts.images] 原始图片表（独立调用时用；内部自行分配计划）
 */
export function markdownToBodyXml(markdown, { images, plans } = {}) {
  const src = String(markdown || '').replace(/\r\n/g, '\n').slice(0, MAX_CHARS);
  const resolved = plans || planChartImages(markdown, images).plans;
  const lines = src.split('\n');
  const body = [];
  let i = 0;
  let figCount = 0; // 「图 N」按出现顺序编号（同一张图被引用两次就是两张图）
  let paraBuf = [];
  const flushPara = () => {
    if (!paraBuf.length) return;
    body.push(paraXml(paraBuf.join(' ')));
    paraBuf = [];
  };
  const lookupImage = (id) => (resolved ? resolved.get(id) : null);
  while (i < lines.length) {
    const line = lines[i];
    const trim = line.trim();
    if (trim.startsWith('```')) {
      flushPara();
      i += 1;
      const code = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      body.push(codeBlockXml(code.length ? code : ['']));
      continue;
    }
    const tokens = chartTokensIn(trim); // 代码块之外才认图表引用
    if (tokens.length) {
      flushPara();
      let cursor = 0;
      for (const tk of tokens) {
        const before = trim.slice(cursor, tk.index).trim();
        if (before) body.push(paraXml(before));
        const plan = lookupImage(tk.id);
        if (plan) {
          figCount += 1;
          const cap = plan.caption || tk.caption || '';
          body.push(drawingXml(plan));
          body.push(captionXml(`图 ${figCount}${cap ? `：${cap}` : ''}`));
          if (plan.source) body.push(sourceXml(plan.source));
        } else {
          body.push(missingChartXml(tk.id));
        }
        cursor = tk.index + tk.length;
      }
      const after = trim.slice(cursor).trim();
      if (after) body.push(paraXml(after));
      i += 1;
      continue;
    }
    if (/^\|.*\|$/.test(trim)) {
      flushPara();
      const table = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        table.push(lines[i]);
        i += 1;
      }
      const xml = tableXml(table);
      if (xml) body.push(xml);
      continue;
    }
    if (!trim) {
      flushPara();
      i += 1;
      continue;
    }
    const hm = /^(#{1,6})\s+(.*)$/.exec(trim);
    if (hm) {
      flushPara();
      body.push(headingXml(hm[1].length, hm[2]));
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trim)) {
      flushPara();
      body.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D4D4D8"/></w:pBdr></w:pPr></w:p>');
      i += 1;
      continue;
    }
    const ul = /^[-*+]\s+(.*)$/.exec(trim);
    if (ul) {
      flushPara();
      body.push(listXml(ul[1], false, 0));
      i += 1;
      continue;
    }
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(trim);
    if (ol) {
      flushPara();
      body.push(listXml(ol[2], true, Number(ol[1])));
      i += 1;
      continue;
    }
    if (trim.startsWith('>')) {
      flushPara();
      body.push(quoteXml(trim.replace(/^>\s?/, '')));
      i += 1;
      continue;
    }
    paraBuf.push(trim);
    i += 1;
  }
  flushPara();
  if (!body.length) body.push(paraXml(''));
  body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/></w:sectPr>');
  return body.join('');
}

function stylesXml() {
  const heading = (id, name, sz) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>`
    + `<w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>`
    + `<w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>`
    + `<w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`
    + `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="黑体"/></w:rPr></w:style>`;
  return XML_DECL
    + `<w:styles xmlns:w="${W}">`
    + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>`
    + `<w:qFormat/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/>`
    + `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/></w:rPr></w:style>`
    + heading('Heading1', 'heading 1', 36)
    + heading('Heading2', 'heading 2', 32)
    + heading('Heading3', 'heading 3', 28)
    + heading('Heading4', 'heading 4', 24)
    + `</w:styles>`;
}

/**
 * markdown → docx 字节。
 * @param {string} markdown
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {Map<string,{bytes:Uint8Array|ArrayBuffer,width:number,height:number,caption?:string,source?:string}>} [options.images]
 *   图表图片表：key = markdown 里 `chart:ID` 的 ID，bytes 为 PNG 字节。取不到的引用渲染成占位行。
 * @returns {Promise<ArrayBuffer>}
 */
export async function markdownToDocxBuffer(markdown, options = {}) {
  const title = String(options.title || '').trim();
  let md = String(markdown || '');
  if (title && !/^\s*#\s/.test(md)) md = '# ' + title + '\n\n' + md;

  // 图片计划：按引用首次出现顺序分配 relId / docPrId，尺寸等比压进可打印宽度
  const { plans, media } = planChartImages(md, options.images);
  const hasImages = media.length > 0;

  const body = markdownToBodyXml(md, { plans });
  const zip = new JSZip();
  zip.file('[Content_Types].xml', XML_DECL
    + `<Types xmlns="${CT}">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + (hasImages ? '<Default Extension="png" ContentType="image/png"/>' : '')
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '</Types>');
  zip.folder('_rels').file('.rels', XML_DECL
    + `<Relationships xmlns="${REL}">`
    + `<Relationship Id="rId1" Type="${OD}/officeDocument" Target="word/document.xml"/>`
    + '</Relationships>');
  const word = zip.folder('word');
  word.folder('_rels').file('document.xml.rels', XML_DECL
    + `<Relationships xmlns="${REL}">`
    + `<Relationship Id="rId1" Type="${OD}/styles" Target="styles.xml"/>`
    + media.map((m) => `<Relationship Id="${m.relId}" Type="${OD}/image" Target="${m.path}"/>`).join('')
    + '</Relationships>');
  for (const m of media) word.file(m.path, m.bytes);
  word.file('styles.xml', stylesXml());
  word.file('document.xml', XML_DECL
    + `<w:document xmlns:w="${W}"${hasImages ? DRAW_NS : ''}><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

export function encodeUtf8(text) {
  return new TextEncoder().encode(String(text ?? '')).buffer;
}
