/**
 * 文档上传提取 —— 把上传的 PDF / Word / Excel / CSV / Markdown / 纯文本解析成全文。
 *
 * pdfjs / mammoth / xlsx 全部动态 import()：只在用户实际上传文档时才加载
 * 对应 chunk，不拖累侧边栏面板的常驻 bundle 体积。
 * 旧版 .doc（OLE2）走零依赖的 legacy-doc.js，可同步提取。
 */

import { extOf, kindOfName, resolveKind, sniffOfficeBuffer } from './doc-kind.js';
import { extractLegacyDocText } from './legacy-doc.js';
import { openPdfJsDocument } from './pdf-repair.js';

export { kindOfName as kindOf };

export function decodeTextBuffer(arrayBuffer) {
  const ab = arrayBuffer instanceof ArrayBuffer
    ? arrayBuffer
    : arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(ab);
  } catch (_) {
    return new TextDecoder('gbk').decode(ab);
  }
}

/**
 * 从 ArrayBuffer 提取全文（上传 / 远程抓取共用）。
 * @returns {Promise<{ format: string, fullText: string, pageCount?: number }>}
 */
export async function extractDocTextFromBuffer(name, arrayBuffer) {
  const ab = arrayBuffer instanceof ArrayBuffer
    ? arrayBuffer
    : arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
  const format = resolveKind(name, ab);
  if (!format) return { format: '', fullText: '' };

  if (format === 'csv' || format === 'md' || format === 'txt') {
    return { format, fullText: decodeTextBuffer(ab).replace(/^\uFEFF/, '').trim() };
  }

  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(ab, { type: 'array' });
    const parts = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const csv = (XLSX.utils.sheet_to_csv(ws, { blankrows: false }) || '').trim();
      parts.push('【工作表：' + sheetName + '】\n' + csv);
    }
    return { format, fullText: parts.join('\n\n') };
  }

  if (format === 'doc') {
    const fullText = extractLegacyDocText(ab);
    return { format, fullText: (fullText || '').replace(/\n{3,}/g, '\n\n').trim() };
  }

  if (format === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: ab });
    return { format, fullText: (result.value || '').replace(/\n{3,}/g, '\n\n').trim() };
  }

  if (format === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    const { default: pdfWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(pdfWorkerUrl.replace(/^\.\//, ''));
    const { pdf } = await openPdfJsDocument(pdfjsLib, ab);
    const parts = [];
    const pageOffsets = [];
    let cursor = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const lines = [];
      let line = '';
      for (const item of tc.items) {
        if (typeof item.str !== 'string') continue;
        line += item.str;
        if (item.hasEOL) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
      const text = lines.join('\n');
      parts.push(text);
      // 页偏移：让 fullText 能按页切片（read_section(page=N) 的锚点）。
      // +2 是下面 join('\n\n') 的分隔符宽度，保证 start/end 与 fullText 对得上。
      pageOffsets.push({ page: p, start: cursor, end: cursor + text.length });
      cursor += text.length + 2;
    }
    return { format, fullText: parts.join('\n\n'), pageCount: pdf.numPages, pageOffsets };
  }

  return { format, fullText: '' };
}

/**
 * 提取文档全文文本。
 * @param {File} file
 * @returns {Promise<{ format: string, fullText: string, pageCount?: number }>}
 */
/**
 * 旧版 .xls（OLE）转成 xlsx 字节再入库，后台表格引擎才能改。
 * 扩展名是 .xls 但内容已是 zip 的，只改名。
 * @returns {Promise<{ fileName: string, arrayBuffer: ArrayBuffer, converted: boolean }>}
 */
export async function normalizeSpreadsheetUpload(name, arrayBuffer) {
  const ab = arrayBuffer instanceof ArrayBuffer
    ? arrayBuffer
    : arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
  if (extOf(name) !== 'xls') return { fileName: name, arrayBuffer: ab, converted: false };
  const nextName = String(name || 'workbook.xls').replace(/\.xls$/i, '.xlsx');
  if (sniffOfficeBuffer(ab) === 'zip') {
    return { fileName: nextName, arrayBuffer: ab, converted: true };
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(ab, { type: 'array' });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const bytes = out instanceof ArrayBuffer ? new Uint8Array(out) : out;
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { fileName: nextName, arrayBuffer: buf, converted: true };
}

export async function extractDocText(file) {
  if (!file) return { format: '', fullText: '' };
  const formatGuess = kindOfName(file.name);
  if (!formatGuess && !(file.type || '').match(/pdf|word|excel|spreadsheet|csv|msword|text\/plain|text\/markdown|text\/x-markdown/i)) {
    return { format: '', fullText: '' };
  }
  return extractDocTextFromBuffer(file.name, await file.arrayBuffer());
}
