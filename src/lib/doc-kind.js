/**
 * 文档格式判定（SW / sidepanel / reader 共用，无 DOM）。
 * kind: pdf | docx | doc | xlsx | csv | md | txt
 * 侧栏上传认 pdf/docx/doc/xlsx/xls/csv/md/txt（另加 json 文库、png/jpeg/webp 配图）。
 * .xls 入库时转成 xlsx；.doc 可读，AI 编辑时转成 docx。
 */

const DOC_EXT_RE = /\.(pdf|docx|doc|xlsx|xls|csv|txt|md|markdown)(?:$|[?#])/i;

export function extOf(nameOrUrl) {
  const raw = String(nameOrUrl || '').split('?')[0].split('#')[0];
  const base = raw.split(/[/\\]/).pop() || raw;
  const dot = base.lastIndexOf('.');
  if (dot < 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function kindOfName(name) {
  const ext = extOf(name);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'txt') return 'txt';
  return '';
}

/** 侧栏上传白名单（.markdown 不单列，走 kindOfName 的 md）。 */
export const UPLOAD_DOC_EXTS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'md', 'txt'];

export function isUploadDocName(name) {
  return UPLOAD_DOC_EXTS.includes(extOf(name));
}

export function fileNameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').pop() || '');
    return last || 'document';
  } catch (_) {
    const path = String(url || '').split('?')[0].split('#')[0];
    return decodeURIComponent(path.split('/').pop() || '') || 'document';
  }
}

export function isDocumentFileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^chrome-extension:/i.test(url)) return false;
  const path = url.split('?')[0].split('#')[0];
  return DOC_EXT_RE.test(path);
}

export function readerUrlForRemote(url) {
  if (!isDocumentFileUrl(url)) return url;
  const base = chrome.runtime.getURL('src/reader/index.html');
  return base + '?url=' + encodeURIComponent(url);
}

/** 魔数嗅探：扩展名撒谎时（.doc 实为 docx zip、.doc 实为 RTF）用来纠偏。 */
export function sniffOfficeBuffer(ab) {
  const u8 = ab instanceof Uint8Array ? ab : new Uint8Array(ab);
  if (u8.length >= 5 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return 'pdf';
  if (u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07) && (u8[3] === 0x04 || u8[3] === 0x06 || u8[3] === 0x08)) {
    return 'zip';
  }
  if (u8.length >= 8 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) return 'ole';
  const n = Math.min(u8.length, 16);
  let ascii = '';
  for (let i = 0; i < n; i++) ascii += String.fromCharCode(u8[i]);
  if (ascii.startsWith('{\\rtf')) return 'rtf';
  return '';
}

export function resolveKind(name, ab) {
  let kind = kindOfName(name);
  const sniff = ab ? sniffOfficeBuffer(ab) : '';
  if (kind === 'doc' && sniff === 'zip') return 'docx';
  if (kind === 'docx' && sniff === 'ole') return 'doc';
  if (!kind && sniff === 'pdf') return 'pdf';
  if (!kind && sniff === 'zip') {
    const ext = extOf(name);
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    return 'docx';
  }
  if (!kind && sniff === 'ole') {
    const ext = extOf(name);
    if (ext === 'xls' || ext === 'xlsx') return 'xlsx';
    return 'doc';
  }
  if (kind === 'doc' && sniff === 'rtf') return 'doc';
  return kind;
}
