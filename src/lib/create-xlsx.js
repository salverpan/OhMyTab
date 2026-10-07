/**
 * AI 生成 xlsx：structured_data / CSV / markdown 表 → OOXML 工作簿。
 * 用 JSZip 写最小合法 xlsx，不把 SheetJS 打进 SW。无 DOM。
 */
import JSZip from 'jszip';

const MAX_ROWS = 20000;
const MAX_COLS = 256;
const MAX_CELL = 32767;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r\n|\r|\n/g, '&#10;');
}

export function colName(n) {
  let i = Number(n) + 1;
  let s = '';
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** A → 0, Z → 25, AA → 26 */
export function colFromName(name) {
  let n = 0;
  const s = String(name || '').toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** "B12" → { c, r }（0 起）；非法返回 null */
export function parseA1(ref) {
  const m = String(ref || '').toUpperCase().replace(/\$/g, '').trim().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { c: colFromName(m[1]), r: Number(m[2]) - 1 };
}

/** "A1" / "B2:C5" → { r1, r2, c1, c2 }（含端点，0 起） */
export function parseA1Range(range) {
  const raw = String(range || 'A1').toUpperCase().replace(/\$/g, '').trim();
  const [a, b] = raw.split(':');
  const s = parseA1(a);
  const e = parseA1(b || a);
  if (!s || !e) return null;
  return {
    r1: Math.min(s.r, e.r),
    r2: Math.max(s.r, e.r),
    c1: Math.min(s.c, e.c),
    c2: Math.max(s.c, e.c),
  };
}

function sanitizeSheetName(name) {
  let s = String(name || 'Sheet1').replace(/[\\/*?:[\]]/g, ' ').trim();
  if (!s) s = 'Sheet1';
  return s.slice(0, 31);
}

function cellXml(r, c, value) {
  const ref = colName(c) + String(r + 1);
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const str = String(value);
  if (str.startsWith('=') && str.length > 1 && !str.startsWith('==')) {
    const f = xmlEscape(str.slice(1)).slice(0, MAX_CELL);
    return `<c r="${ref}"><f>${f}</f></c>`;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(str.trim()) && str.trim().length < 20) {
    const n = Number(str.trim());
    if (Number.isFinite(n)) return `<c r="${ref}"><v>${n}</v></c>`;
  }
  const t = xmlEscape(str.slice(0, MAX_CELL));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
}

function sheetXml(aoa) {
  const rows = [];
  const height = Math.min(aoa.length, MAX_ROWS);
  let width = 1;
  for (let r = 0; r < height; r++) {
    const row = Array.isArray(aoa[r]) ? aoa[r] : [aoa[r]];
    if (row.length > width) width = row.length;
  }
  width = Math.min(width, MAX_COLS);
  for (let r = 0; r < height; r++) {
    const row = Array.isArray(aoa[r]) ? aoa[r] : [aoa[r]];
    const cells = [];
    for (let c = 0; c < width; c++) {
      const xml = cellXml(r, c, row[c]);
      if (xml) cells.push(xml);
    }
    if (cells.length) rows.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="${NS}"><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

export async function aoaToXlsxBuffer(aoa, sheetName = 'Sheet1') {
  const zip = new JSZip();
  const name = sanitizeSheetName(sheetName);
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '</Types>');
  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>');
  const xl = zip.folder('xl');
  xl.file('workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheets><sheet name="${xmlEscape(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  xl.folder('_rels').file('workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '</Relationships>');
  xl.folder('worksheets').file('sheet1.xml', sheetXml(Array.isArray(aoa) ? aoa : []));
  return zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}

export function structuredDataToAoa(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (Array.isArray(data[0])) {
    return data.map((row) => (Array.isArray(row) ? row : [row])).slice(0, MAX_ROWS);
  }
  const keys = [];
  const seen = new Set();
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    for (const k of Object.keys(row)) {
      if (seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
      if (keys.length >= MAX_COLS) break;
    }
    if (keys.length >= MAX_COLS) break;
  }
  if (keys.length === 0) return [];
  const aoa = [keys];
  for (const row of data.slice(0, MAX_ROWS - 1)) {
    const obj = row && typeof row === 'object' ? row : {};
    aoa.push(keys.map((k) => obj[k] == null ? '' : obj[k]));
  }
  return aoa;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') out.push(cur), cur = '';
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseTableContent(content) {
  const raw = String(content || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd()).filter((l, i, arr) => {
    if (l.trim()) return true;
    return i > 0 && i < arr.length - 1;
  });
  const md = lines.filter((l) => /^\|.*\|$/.test(l.trim()));
  if (md.length >= 2) {
    const rows = [];
    for (const line of md) {
      if (/^\|\s*:?-{3,}/.test(line.replace(/\|/g, '|').trim()) || /^\|[\s:|-]+\|$/.test(line.trim())) continue;
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      rows.push(cells);
    }
    return rows.slice(0, MAX_ROWS);
  }
  if (raw.includes('\t') && !raw.includes(',')) {
    return lines.map((l) => l.split('\t')).slice(0, MAX_ROWS);
  }
  return lines.map(splitCsvLine).slice(0, MAX_ROWS);
}

export function aoaToCsvText(aoa) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return (aoa || []).map((row) => (Array.isArray(row) ? row : [row]).map(esc).join(',')).join('\n');
}

export function rowsFromCreateDocumentArgs(args) {
  const data = args && args.structured_data;
  let aoa = structuredDataToAoa(data);
  if (aoa.length === 0) aoa = parseTableContent(args && args.content);
  if (aoa.length === 0 && args && args.content) {
    aoa = String(args.content).split(/\r?\n/).map((l) => [l]);
  }
  const fullText = aoaToCsvText(aoa);
  return { aoa, fullText, sheet: 'Sheet1' };
}
