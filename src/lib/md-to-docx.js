/* Markdown -> DOCX converter for AI-generated documents.
   Uses marked (parse markdown to token AST) + docx (build pure OOXML).
   Separate from export-docx.js (which serves collected-page briefs with
   template support). Produces structured Word documents:
   headings / lists / tables / bold / italic / code / quotes / hr / links.
   Runs in the sidepanel context (has Blob). create_document(format=docx) in SW
   uses create-docx.js (JSZip, no docx/marked) so the SW bundle stays DOM-free. */

import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ExternalHyperlink, LineRuleType, PageBreak, ImageRun,
} from 'docx';
import { htmlToText } from './html-utils.js';
import { findChartRefs, findMediaRefs, chartTokensInLine, fitImagePx } from './create-docx.js';
import { getDocFile } from './doc-store.js';
import { chartBlobKey, loadChartRefs } from './chart-store.js';

const FONT_BODY = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体', cs: 'Times New Roman' };
const FONT_HEADING = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '黑体', cs: 'Times New Roman' };
const FONT_MONO = { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '宋体', cs: 'Consolas' };
const FS = (pt) => Math.round(pt * 2);

/* ---- 图表插图（与 create-docx.js 同一份引用写法 `![说明](chart:<id>)`） ----
 * 图片字节在 doc-store（键 chart:<id>）、题注/来源在 chart-store 登记表。
 * 解析放在 markdownToDocxBlob 顶部的 await 段完成，随后**同步**建块（见那段的注释）。 */
let currentChartImages = null;
let currentFigCount = 0; // 「图 N」按文档内出现顺序编号（多条目合并导出时跨条目连续）

/** 收集 markdown 引用到的图表图片（含题注/来源），尺寸等比压进可打印宽度。 */
async function resolveChartImages(markdown) {
  const media = findMediaRefs(markdown);
  if (!media.length) return null;
  const refs = await loadChartRefs();
  const map = new Map();
  for (const item of media) {
    if (item.kind === 'img') {
      const bytes = await getDocFile(item.id).catch(() => null);
      if (!bytes) continue;
      let width = 800;
      let height = 450;
      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(new Blob([bytes]));
          width = bmp.width;
          height = bmp.height;
          try { bmp.close(); } catch (_) {}
        } catch (_) { /* 用默认尺寸 */ }
      }
      const fitted = fitImagePx(width, height);
      map.set(item.id, {
        bytes, width: fitted.width, height: fitted.height,
        caption: item.caption || '', source: '',
      });
      continue;
    }
    const bytes = await getDocFile(chartBlobKey(item.id)).catch(() => null);
    if (!bytes) continue;
    const meta = refs[item.id] || {};
    const { width, height } = fitImagePx(meta.width, meta.height);
    map.set(item.id, { bytes, width, height, caption: meta.caption || item.caption || '', source: meta.source || '' });
  }
  return map.size ? map : null;
}

/** 整行就是一个图表引用时返回 {id, caption}（两种写法都收），否则 null。 */
function wholeLineChartRef(token) {
  if (!token) return null;
  if (token.type === 'image') {
    const m = /^(?:chart|img):([A-Za-z0-9_:-]+)$/.exec(String(token.href || ''));
    return m ? { id: m[1], caption: String(token.text || '').trim() } : null;
  }
  if (token.type !== 'paragraph' && token.type !== 'text') return null;
  const raw = String(token.raw || token.text || '').trim();
  if (!raw || raw.includes('\n')) return null;
  const hits = chartTokensInLine(raw);
  if (hits.length !== 1) return null;
  const rest = raw.slice(0, hits[0].index) + raw.slice(hits[0].index + hits[0].length);
  return rest.trim() ? null : { id: hits[0].id, caption: hits[0].caption || '' };
}

/** 图表块：居中图片 + 「图 N：说明」+ 8pt 灰字来源（与 create-docx 输出对齐）。 */
function chartParagraphs(ref) {
  const img = currentChartImages && currentChartImages.get(ref.id);
  if (!img) {
    return [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '[图表缺图：' + ref.id + ']', font: FONT_BODY, size: FS(9), italics: true, color: '92929B' })],
    })];
  }
  currentFigCount += 1;
  const cap = img.caption || ref.caption || '';
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: img.bytes, transformation: { width: img.width, height: img.height } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: img.source ? 60 : 240 },
      children: [new TextRun({ text: `图 ${currentFigCount}${cap ? `：${cap}` : ''}`, font: FONT_BODY, size: FS(9), bold: true })],
    }),
  ];
  if (img.source) {
    out.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: img.source, font: FONT_BODY, size: FS(8), color: '6B6B73' })],
    }));
  }
  return out;
}

/* Convert a markdown string to a .docx Blob. options: { title } */
export async function markdownToDocxBlob(markdown, options = {}) {
  // 图表图片在这里一次性解析好（唯一会 await 的地方），随后**同步**建块：
  // 同步段内不可能被另一个并发导出插入，模块级 currentChartImages 因此安全。
  if (!options.images) {
    try { options = { ...options, images: await resolveChartImages(markdown || '') }; } catch (_) {}
  }
  currentChartImages = options.images || null;
  currentFigCount = 0;
  let blocks;
  try {
    blocks = blocksFromMarkdown(markdown || '', options);
  } finally {
    currentChartImages = null;
  }
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT_BODY, size: FS(11) } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(18), bold: true }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(16), bold: true }, paragraph: { spacing: { before: 200, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(14), bold: true }, paragraph: { spacing: { before: 160, after: 80 } } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(12), bold: true }, paragraph: { spacing: { before: 120, after: 60 } } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } } },
      children: blocks,
    }],
  });
  return Packer.toBlob(doc);
}

/* Convert multiple entries (each with markdown fullText) into one combined
   .docx Blob. Each entry: Heading 1 title + parsed body, page-break separated. */
export async function entriesToMarkdownDocxBlob(entries) {
  const blocks = [];
  // 图表图片：一次解析全部条目的引用（唯一 await 段），随后同步建块
  let images = null;
  try {
    images = await resolveChartImages(entries.map((e) => (e && e.fullText) || '').join('\n\n'));
  } catch (_) {}
  currentChartImages = images;
  currentFigCount = 0;
  try {
    entries.forEach((entry, i) => {
      if (i > 0) blocks.push(new Paragraph({ children: [new PageBreak()] }));
      const title = entry.aiTitle || entry.originalTitle || '未命名文档';
      blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, font: FONT_HEADING, size: FS(18), bold: true })] }));
      if (entry.aiSummary && entry.aiSummary !== title) {
        blocks.push(new Paragraph({ children: [new TextRun({ text: entry.aiSummary, font: FONT_BODY, size: FS(10), italics: true, color: '666666' })] }));
      }
      blocks.push(...blocksFromMarkdown(entry.fullText || '', {}));
      const metaParts = [];
      if (entry.source && entry.source !== 'AI 生成') metaParts.push('来源: ' + entry.source);
      if (entry.publishedAt) metaParts.push('日期: ' + entry.publishedAt);
      if (entry.tags && entry.tags.length) metaParts.push('标签: ' + entry.tags.join(', '));
      if (metaParts.length) blocks.push(new Paragraph({ children: [new TextRun({ text: metaParts.join('  |  '), font: FONT_BODY, size: FS(9), color: '888888' })] }));
    });
  } finally {
    currentChartImages = null;
  }
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT_BODY, size: FS(11) } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(18), bold: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(16), bold: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT_HEADING, size: FS(14), bold: true } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } } }, children: blocks }],
  });
  return Packer.toBlob(doc);
}

/* ---- internal: markdown token -> docx blocks ---- */

function blocksFromMarkdown(md, options) {
  let tokens;
  try { tokens = marked.lexer(md); }
  catch (_) { return [new Paragraph({ children: [new TextRun({ text: md, font: FONT_BODY, size: FS(11) })] })]; }
  const out = [];
  if (options.title) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: options.title, font: FONT_HEADING, size: FS(20), bold: true })] }));
  }
  for (const token of tokens) {
    const blocks = blockToDocx(token, { indent: 0 });
    if (Array.isArray(blocks)) out.push(...blocks);
    else if (blocks) out.push(blocks);
  }
  return out;
}

function blockToDocx(token, opts) {
  const indent = opts.indent || 0;
  // 整行就是图表引用 → 图片 + 题注 + 来源（不当作普通段落）
  const chartRef = wholeLineChartRef(token);
  if (chartRef) return chartParagraphs(chartRef);
  switch (token.type) {
    case 'heading':
      return [headingPara(token)];
    case 'paragraph':
      return [new Paragraph({ indent: indent ? { left: indent } : undefined, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, lineRule: LineRuleType.AUTO }, children: inlineToRuns(token.tokens) })];
    case 'list':
      return listToParas(token, opts);
    case 'code':
      return [codePara(token)];
    case 'blockquote':
      return (token.tokens || []).map((t) => blockToDocx(t, { indent: indent + 480 })).flat();
    case 'table':
      return [tableToDocx(token)];
    case 'hr':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } }, children: [] })];
    case 'space':
      return [];
    case 'html':
      return [new Paragraph({ children: [new TextRun({ text: htmlToText(token.text || ''), font: FONT_BODY, size: FS(11) })] })];
    default:
      return token.text ? [new Paragraph({ children: [new TextRun({ text: token.text, font: FONT_BODY, size: FS(11) })] })] : [];
  }
}

function headingPara(token) {
  const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
  return new Paragraph({ heading: levels[token.depth - 1] || HeadingLevel.HEADING_6, children: inlineToRuns(token.tokens) });
}

function listToParas(token, opts) {
  const paras = [];
  const indent = opts.indent || 0;
  token.items.forEach((item, i) => {
    const runs = [];
    if (item.task) runs.push(new TextRun({ text: item.checked ? '☑ ' : '☐ ', font: FONT_BODY, size: FS(11) }));
    for (const t of (item.tokens || [])) {
      if (t.type === 'list') {
        paras.push(...listToParas(t, { indent: indent + 360 }));
      } else if (t.type === 'text' && t.tokens) {
        runs.push(...inlineToRuns(t.tokens));
      } else if (t.type === 'paragraph') {
        runs.push(...inlineToRuns(t.tokens));
      } else if (t.tokens) {
        runs.push(...inlineToRuns(t.tokens));
      } else if (t.text) {
        runs.push(new TextRun({ text: t.text, font: FONT_BODY, size: FS(11) }));
      }
    }
    const num = token.ordered ? ((token.start || 1) + i) + '. ' : '';
    if (num) runs.unshift(new TextRun({ text: num, font: FONT_BODY, size: FS(11) }));
    paras.push(new Paragraph({
      indent: { left: indent + 360, hanging: 360 },
      spacing: { line: 320, lineRule: LineRuleType.AUTO },
      children: runs,
    }));
  });
  return paras;
}

function codePara(token) {
  const lines = (token.text || '').split('\n');
  const runs = [];
  lines.forEach((line, i) => {
    runs.push(new TextRun({ text: line, font: FONT_MONO, size: FS(9) }));
    if (i < lines.length - 1) runs.push(new TextRun({ break: 1 }));
  });
  return new Paragraph({
    shading: { fill: 'F5F5F5' },
    spacing: { line: 260, lineRule: LineRuleType.AUTO },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC', space: 6 } },
    children: runs,
  });
}

function tableToDocx(token) {
  const alignTo = (a) => a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const headerCells = (token.header || []).map((cell, ci) => new TableCell({
    shading: { fill: 'E8E8E8' },
    children: [new Paragraph({ alignment: alignTo(token.align ? token.align[ci] : null), children: inlineToRuns(cell.tokens || [{ type: 'text', text: cell.text || '' }]) })],
  }));
  const rows = [new TableRow({ tableHeader: true, children: headerCells })];
  for (const row of (token.rows || [])) {
    const cells = row.map((cell, ci) => new TableCell({
      children: [new Paragraph({ alignment: alignTo(token.align ? token.align[ci] : null), children: inlineToRuns(cell.tokens || [{ type: 'text', text: cell.text || '' }]) })],
    }));
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/* ---- inline tokens -> TextRun[] ---- */

function inlineToRuns(tokens, base) {
  const runs = [];
  if (!tokens) return runs;
  const style = base || { font: FONT_BODY, size: FS(11) };
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
        if (t.tokens) runs.push(...inlineToRuns(t.tokens, style));
        else runs.push(new TextRun({ text: t.text, ...style }));
        break;
      case 'strong':
        runs.push(...inlineToRuns(t.tokens, { ...style, bold: true }));
        break;
      case 'em':
        runs.push(...inlineToRuns(t.tokens, { ...style, italics: true }));
        break;
      case 'codespan':
        runs.push(new TextRun({ text: t.text, font: FONT_MONO, size: FS(10) }));
        break;
      case 'link':
        runs.push(new ExternalHyperlink({ link: t.href || '', children: inlineToRuns(t.tokens, { ...style, color: '0563C1' }) }));
        break;
      case 'del':
        runs.push(...inlineToRuns(t.tokens, { ...style, strike: true }));
        break;
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;
      case 'escape':
        runs.push(new TextRun({ text: t.text, ...style }));
        break;
      case 'image': {
        // 图表引用（chart:<id>）→ 真图片；其它图片没有可取字节的来源，保持灰字占位
        const chartId = (() => {
          const m = /^chart:([A-Za-z0-9_:-]+)$/.exec(String(t.href || ''));
          return m ? m[1] : '';
        })();
        const img = chartId && currentChartImages ? currentChartImages.get(chartId) : null;
        if (img) {
          runs.push(new ImageRun({ type: 'png', data: img.bytes, transformation: { width: img.width, height: img.height } }));
        } else {
          runs.push(new TextRun({ text: '[图: ' + (t.text || t.href || '') + ']', ...style, italics: true, color: '888888' }));
        }
        break;
      }
      default:
        if (t.text) runs.push(new TextRun({ text: t.text, ...style }));
    }
  }
  return runs;
}
