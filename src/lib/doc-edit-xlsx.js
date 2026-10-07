/**
 * Excel OOXML 定点手术引擎（SW 无头，对齐 doc-edit-word）。
 * 解压后改 worksheet / styles / sharedStrings，其余 zip 条目原样保留。
 * 不把 SheetJS / Univer 打进 SW。无 DOM（xmldom）。
 *
 * 公式以文本写入，不在无头路径求值；Excel/WPS 或阅读器「编辑」（Univer）打开后计算。
 */
import JSZip from 'jszip';
import { DOMParser as XmldomParser, XMLSerializer as XmldomSerializer } from '@xmldom/xmldom';
import { colName, parseA1Range, colFromName } from './create-xlsx.js';

const XmlParser = typeof DOMParser !== 'undefined' ? DOMParser : XmldomParser;
const XmlSerializer = typeof XMLSerializer !== 'undefined' ? XMLSerializer : XmldomSerializer;

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OD_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const UNDO_CAP = 30;
const MAX_CELL = 32767;

let zip = null;
let sheets = []; // { name, path, xml }
let sstXml = null;
let sstPath = '';
let stylesXml = null;
let stylesPath = 'xl/styles.xml';
let contentTypesXml = null;
let workbookXml = null;
let workbookRelsXml = null;
let activeIndex = 0;
let dirty = false;
let undoStack = [];
let redoStack = [];
let boldXfId = null;

function serialize(doc) {
  return XML_DECL + new XmlSerializer().serializeToString(doc.documentElement);
}

function parseXml(text, label) {
  const doc = new XmlParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error(`${label} 解析失败`);
  }
  return doc;
}

function removeNode(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function kids(node, name) {
  return Array.from(node.childNodes || []).filter((c) => c.nodeType === 1 && c.localName === name);
}

function child(node, name) {
  for (const c of node.childNodes || []) {
    if (c.nodeType === 1 && c.localName === name) return c;
  }
  return null;
}

function el(doc, name) {
  return doc.createElementNS(NS, name);
}

function textOf(node) {
  if (!node) return '';
  let s = '';
  const walk = (n) => {
    if (!n) return;
    if (n.nodeType === 3) { s += n.data || ''; return; }
    for (const c of n.childNodes || []) walk(c);
  };
  walk(node);
  return s;
}

function joinPath(baseDir, target) {
  const t = String(target || '').replace(/\\/g, '/');
  if (t.startsWith('/')) return t.replace(/^\//, '');
  const parts = (baseDir + '/' + t).split('/');
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function zipFile(path) {
  if (!zip) return null;
  return zip.file(path) || zip.file(path.replace(/^\//, ''));
}

async function readZipXml(path) {
  const f = zipFile(path);
  if (!f) return null;
  return parseXml(await f.async('string'), path);
}

function relsOf(relsDoc, typeContains) {
  const out = [];
  if (!relsDoc) return out;
  const root = relsDoc.documentElement;
  for (const n of Array.from(root.childNodes || [])) {
    if (n.nodeType !== 1 || n.localName !== 'Relationship') continue;
    const type = n.getAttribute('Type') || '';
    if (typeContains && !type.includes(typeContains)) continue;
    out.push({
      id: n.getAttribute('Id') || '',
      type,
      target: n.getAttribute('Target') || '',
    });
  }
  return out;
}

function snapshot() {
  return JSON.stringify({
    activeIndex,
    sheets: sheets.map((s) => ({ name: s.name, path: s.path, xml: serialize(s.xml) })),
    sst: sstXml ? serialize(sstXml) : null,
    sstPath,
    styles: stylesXml ? serialize(stylesXml) : null,
    stylesPath,
    contentTypes: contentTypesXml ? serialize(contentTypesXml) : null,
    workbook: workbookXml ? serialize(workbookXml) : null,
  });
}

function restore(raw) {
  const s = JSON.parse(raw);
  activeIndex = s.activeIndex || 0;
  sheets = (s.sheets || []).map((x) => ({ name: x.name, path: x.path, xml: parseXml(x.xml, x.path) }));
  sstPath = s.sstPath || '';
  sstXml = s.sst ? parseXml(s.sst, 'sst') : null;
  stylesPath = s.stylesPath || 'xl/styles.xml';
  stylesXml = s.styles ? parseXml(s.styles, 'styles') : null;
  contentTypesXml = s.contentTypes ? parseXml(s.contentTypes, 'ct') : null;
  workbookXml = s.workbook ? parseXml(s.workbook, 'wb') : null;
  boldXfId = null;
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_CAP) undoStack.shift();
  redoStack = [];
}

/* ---------- 修改痕迹（对话里的修改卡 + 回喂模型的自证材料） ----------
 * 见 lib/doc-edits.js：每次写操作记录 {op, location, before, after, note}。
 * 逐格上限 12 条，超出的合成一条汇总（表格批量写入不该刷屏）。 */

const editBuf = [];
const CELL_RECORD_CAP = 12;

function recordEdit(op, location, before, after, note) {
  editBuf.push({ op, location, before, after, note });
}

function attachEdits(r) {
  if (r && r.ok && editBuf.length) r.edits = editBuf.splice(0, editBuf.length);
  else editBuf.length = 0;
  return r;
}

function cellRef(r0, c0) {
  return colName(c0) + String(r0 + 1);
}

function sheetData(xml) {
  const root = xml.documentElement;
  let sd = child(root, 'sheetData');
  if (!sd) {
    sd = el(xml, 'sheetData');
    root.appendChild(sd);
  }
  return sd;
}

function rowEl(xml, r1) {
  const sd = sheetData(xml);
  const rows = kids(sd, 'row');
  for (const row of rows) {
    if (Number(row.getAttribute('r')) === r1) return row;
  }
  const row = el(xml, 'row');
  row.setAttribute('r', String(r1));
  let inserted = false;
  for (const exist of rows) {
    if (Number(exist.getAttribute('r')) > r1) {
      sd.insertBefore(row, exist);
      inserted = true;
      break;
    }
  }
  if (!inserted) sd.appendChild(row);
  return row;
}

function cellEl(xml, r0, c0) {
  const ref = colName(c0) + String(r0 + 1);
  const row = rowEl(xml, r0 + 1);
  const cells = kids(row, 'c');
  for (const c of cells) {
    if ((c.getAttribute('r') || '') === ref) return c;
  }
  const cell = el(xml, 'c');
  cell.setAttribute('r', ref);
  let inserted = false;
  for (const exist of cells) {
    const addr = exist.getAttribute('r') || '';
    const em = addr.match(/^([A-Z]+)(\d+)$/);
    if (em && colFromName(em[1]) > c0) {
      row.insertBefore(cell, exist);
      inserted = true;
      break;
    }
  }
  if (!inserted) row.appendChild(cell);
  return cell;
}

function findCell(xml, r0, c0) {
  const ref = colName(c0) + String(r0 + 1);
  const sd = child(xml.documentElement, 'sheetData');
  if (!sd) return null;
  for (const row of kids(sd, 'row')) {
    if (Number(row.getAttribute('r')) !== r0 + 1) continue;
    for (const c of kids(row, 'c')) {
      if ((c.getAttribute('r') || '') === ref) return c;
    }
  }
  return null;
}

function sstItemText(idx) {
  if (!sstXml) return '';
  const sis = kids(sstXml.documentElement, 'si');
  const si = sis[idx];
  if (!si) return '';
  const t = child(si, 't');
  if (t) return textOf(t);
  const parts = [];
  for (const r of kids(si, 'r')) parts.push(textOf(child(r, 't') || r));
  return parts.join('');
}

function cellDisplay(cell) {
  if (!cell) return '';
  const t = cell.getAttribute('t') || '';
  const f = child(cell, 'f');
  if (f) {
    const formula = textOf(f);
    return formula ? '=' + formula : '';
  }
  if (t === 's') {
    const v = child(cell, 'v');
    const idx = Number(textOf(v) || 0);
    return sstItemText(idx);
  }
  if (t === 'inlineStr') {
    const is = child(cell, 'is');
    return is ? textOf(child(is, 't') || is) : '';
  }
  if (t === 'str' || t === 'e') return textOf(child(cell, 'v'));
  if (t === 'b') return textOf(child(cell, 'v')) === '1' ? 'TRUE' : 'FALSE';
  const v = child(cell, 'v');
  return v ? textOf(v) : '';
}

function clearChildren(node) {
  while (node.firstChild) removeNode(node.firstChild);
}

function needsXmlSpace(s) {
  return /^\s|\s$/.test(s);
}

function setCellValue(xml, r0, c0, value) {
  const cell = cellEl(xml, r0, c0);
  cell.removeAttribute('t');
  clearChildren(cell);
  if (value == null || value === '') return cell;
  if (typeof value === 'boolean') {
    cell.setAttribute('t', 'b');
    const v = el(xml, 'v');
    v.appendChild(xml.createTextNode(value ? '1' : '0'));
    cell.appendChild(v);
    return cell;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const v = el(xml, 'v');
    v.appendChild(xml.createTextNode(String(value)));
    cell.appendChild(v);
    return cell;
  }
  const str = String(value);
  if (str.startsWith('=') && str.length > 1 && !str.startsWith('==')) {
    const f = el(xml, 'f');
    f.appendChild(xml.createTextNode(str.slice(1).slice(0, MAX_CELL)));
    cell.appendChild(f);
    return cell;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(str.trim()) && str.trim().length < 20) {
    const n = Number(str.trim());
    if (Number.isFinite(n)) {
      const v = el(xml, 'v');
      v.appendChild(xml.createTextNode(String(n)));
      cell.appendChild(v);
      return cell;
    }
  }
  cell.setAttribute('t', 'inlineStr');
  const is = el(xml, 'is');
  const t = el(xml, 't');
  const clipped = str.slice(0, MAX_CELL);
  if (needsXmlSpace(clipped)) t.setAttribute('xml:space', 'preserve');
  t.appendChild(xml.createTextNode(clipped));
  is.appendChild(t);
  cell.appendChild(is);
  return cell;
}

function expandDimension(xml, r0, c0) {
  const root = xml.documentElement;
  let dim = child(root, 'dimension');
  if (!dim) {
    dim = el(xml, 'dimension');
    const sd = child(root, 'sheetData');
    if (sd) root.insertBefore(dim, sd);
    else root.appendChild(dim);
    dim.setAttribute('ref', 'A1:' + colName(c0) + String(r0 + 1));
    return;
  }
  const cur = parseA1Range(dim.getAttribute('ref') || 'A1');
  if (!cur) {
    dim.setAttribute('ref', 'A1:' + colName(c0) + String(r0 + 1));
    return;
  }
  const r1 = Math.min(cur.r1, r0);
  const r2 = Math.max(cur.r2, r0);
  const c1 = Math.min(cur.c1, c0);
  const c2 = Math.max(cur.c2, c0);
  dim.setAttribute('ref', colName(c1) + String(r1 + 1) + ':' + colName(c2) + String(r2 + 1));
}

function usedBounds(xml) {
  const sd = child(xml.documentElement, 'sheetData');
  let maxR = 0;
  let maxC = 0;
  if (sd) {
    for (const row of kids(sd, 'row')) {
      const r = Number(row.getAttribute('r') || 1);
      if (r > maxR) maxR = r;
      for (const c of kids(row, 'c')) {
        const addr = c.getAttribute('r') || '';
        const m = addr.match(/^([A-Z]+)/);
        if (!m) continue;
        const n = colFromName(m[1]) + 1;
        if (n > maxC) maxC = n;
      }
    }
  }
  const dim = child(xml.documentElement, 'dimension');
  if (dim) {
    const cur = parseA1Range(dim.getAttribute('ref') || '');
    if (cur) {
      maxR = Math.max(maxR, cur.r2 + 1);
      maxC = Math.max(maxC, cur.c2 + 1);
    }
  }
  return { maxR: Math.max(maxR, 1), maxC: Math.max(maxC, 1) };
}

function ensureStyles() {
  if (stylesXml) return;
  stylesXml = parseXml(
    XML_DECL + `<styleSheet xmlns="${NS}">`
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border/></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '</cellXfs></styleSheet>',
    'styles',
  );
  boldXfId = 1;
  if (contentTypesXml) {
    const root = contentTypesXml.documentElement;
    const has = Array.from(root.childNodes || []).some((n) =>
      n.nodeType === 1 && (n.getAttribute('PartName') || '') === '/xl/styles.xml');
    if (!has) {
      const ov = contentTypesXml.createElementNS(CT_NS, 'Override');
      ov.setAttribute('PartName', '/xl/styles.xml');
      ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml');
      root.appendChild(ov);
    }
  }
  if (workbookRelsXml) {
    const has = relsOf(workbookRelsXml, '/styles').length > 0;
    if (!has) {
      const root = workbookRelsXml.documentElement;
      let max = 1;
      for (const n of Array.from(root.childNodes || [])) {
        if (n.nodeType !== 1) continue;
        const m = /rId(\d+)/i.exec(n.getAttribute('Id') || '');
        if (m) max = Math.max(max, Number(m[1]));
      }
      const rel = workbookRelsXml.createElementNS(REL_NS, 'Relationship');
      rel.setAttribute('Id', 'rId' + (max + 1));
      rel.setAttribute('Type', OD_NS + '/styles');
      rel.setAttribute('Target', 'styles.xml');
      root.appendChild(rel);
    }
  }
}

function ensureBoldXf() {
  ensureStyles();
  if (boldXfId != null) return boldXfId;
  const root = stylesXml.documentElement;
  const fonts = child(root, 'fonts') || (() => {
    const n = el(stylesXml, 'fonts');
    root.insertBefore(n, root.firstChild);
    return n;
  })();
  let boldFontId = -1;
  const fontList = kids(fonts, 'font');
  fontList.forEach((f, i) => {
    if (boldFontId >= 0) return;
    const b = child(f, 'b');
    if (b && b.getAttribute('val') !== '0') boldFontId = i;
  });
  if (boldFontId < 0) {
    const font = el(stylesXml, 'font');
    font.appendChild(el(stylesXml, 'b'));
    const sz = el(stylesXml, 'sz');
    sz.setAttribute('val', '11');
    font.appendChild(sz);
    const name = el(stylesXml, 'name');
    name.setAttribute('val', 'Calibri');
    font.appendChild(name);
    fonts.appendChild(font);
    boldFontId = fontList.length;
    fonts.setAttribute('count', String(boldFontId + 1));
  }
  let xfs = child(root, 'cellXfs');
  if (!xfs) {
    xfs = el(stylesXml, 'cellXfs');
    root.appendChild(xfs);
  }
  const xfList = kids(xfs, 'xf');
  let found = -1;
  xfList.forEach((xf, i) => {
    if (found >= 0) return;
    if (xf.getAttribute('fontId') === String(boldFontId) && xf.getAttribute('applyFont') === '1') found = i;
  });
  if (found < 0) {
    const xf = el(stylesXml, 'xf');
    xf.setAttribute('numFmtId', '0');
    xf.setAttribute('fontId', String(boldFontId));
    xf.setAttribute('fillId', '0');
    xf.setAttribute('borderId', '0');
    xf.setAttribute('xfId', '0');
    xf.setAttribute('applyFont', '1');
    xfs.appendChild(xf);
    found = xfList.length;
    xfs.setAttribute('count', String(found + 1));
  }
  boldXfId = found;
  return boldXfId;
}

function activeSheet() {
  return sheets[activeIndex] || sheets[0] || null;
}

function sheetByName(name) {
  if (!name) return activeSheet();
  const hit = sheets.find((s) => s.name === name);
  return hit || null;
}

export async function initXlsxEditor(arrayBuffer) {
  zip = await JSZip.loadAsync(arrayBuffer);
  const wbFile = zipFile('xl/workbook.xml');
  if (!wbFile) throw new Error('不是有效的 .xlsx（缺少 workbook）。旧版 .xls 请另存为 xlsx 后再编辑');
  workbookXml = parseXml(await wbFile.async('string'), 'workbook');
  workbookRelsXml = await readZipXml('xl/_rels/workbook.xml.rels');
  contentTypesXml = await readZipXml('[Content_Types].xml');
  const rels = relsOf(workbookRelsXml, '/worksheet');
  const ridToPath = {};
  for (const r of rels) ridToPath[r.id] = joinPath('xl', r.target);
  const sstRel = relsOf(workbookRelsXml, 'sharedStrings')[0];
  sstPath = sstRel ? joinPath('xl', sstRel.target) : 'xl/sharedStrings.xml';
  sstXml = await readZipXml(sstPath);
  const stRel = relsOf(workbookRelsXml, '/styles')[0];
  stylesPath = stRel ? joinPath('xl', stRel.target) : 'xl/styles.xml';
  stylesXml = await readZipXml(stylesPath);
  boldXfId = null;
  sheets = [];
  const sheetsEl = child(workbookXml.documentElement, 'sheets');
  for (const sh of (sheetsEl ? kids(sheetsEl, 'sheet') : [])) {
    const name = sh.getAttribute('name') || 'Sheet';
    const rid = sh.getAttributeNS(OD_NS, 'id') || sh.getAttribute('r:id') || '';
    const path = ridToPath[rid];
    if (!path) continue;
    const xml = await readZipXml(path);
    if (!xml) continue;
    sheets.push({ name, path, xml });
  }
  if (!sheets.length) throw new Error('工作簿没有可编辑的工作表');
  activeIndex = 0;
  dirty = false;
  undoStack = [];
  redoStack = [];
}

export function isXlsxDirty() { return dirty; }

export function xlsxSheetNames() {
  return sheets.map((s) => s.name);
}

export function xlsxText() {
  const parts = [];
  for (const sh of sheets) {
    const lines = [];
    const sd = child(sh.xml.documentElement, 'sheetData');
    const rows = sd ? kids(sd, 'row') : [];
    rows.sort((a, b) => Number(a.getAttribute('r')) - Number(b.getAttribute('r')));
    for (const row of rows) {
      const cells = kids(row, 'c');
      cells.sort((a, b) => String(a.getAttribute('r')).localeCompare(String(b.getAttribute('r')), 'en', { numeric: true }));
      const vals = cells.map((c) => cellDisplay(c)).filter((v) => v !== '');
      if (vals.length) lines.push(vals.join('\t'));
    }
    parts.push('【工作表：' + sh.name + '】\n' + lines.join('\n'));
  }
  return parts.join('\n\n');
}

export function xlsxDigest() {
  const text = xlsxText();
  return {
    sheets: sheets.map((s) => s.name),
    chars: text.length,
    head: text.slice(0, 400).replace(/\s+/g, ' ').trim(),
  };
}

export async function exportXlsx() {
  if (!zip) throw new Error('表格引擎未初始化');
  for (const sh of sheets) zip.file(sh.path, serialize(sh.xml));
  if (sstXml && sstPath) zip.file(sstPath, serialize(sstXml));
  if (stylesXml) zip.file(stylesPath, serialize(stylesXml));
  if (contentTypesXml) zip.file('[Content_Types].xml', serialize(contentTypesXml));
  if (workbookXml) zip.file('xl/workbook.xml', serialize(workbookXml));
  if (workbookRelsXml) zip.file('xl/_rels/workbook.xml.rels', serialize(workbookRelsXml));
  return zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}

export async function execXlsxTool(tool, args = {}) {
  if (!sheets.length) return { ok: false, error: '表格引擎未初始化' };
  editBuf.length = 0;
  return attachEdits(await execXlsxToolInner(tool, args));
}

async function execXlsxToolInner(tool, args = {}) {
  try {
    switch (tool) {
      case 'switch_sheet': {
        const s = sheetByName(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}。可用：${xlsxSheetNames().join('、')}` };
        activeIndex = sheets.indexOf(s);
        return { ok: true, summary: `已切换到工作表「${s.name}」` };
      }
      case 'set_range': {
        const sh = sheetByName(args.sheet);
        if (!sh) return { ok: false, error: `工作表不存在: ${args.sheet || '(当前)'}。可用：${xlsxSheetNames().join('、')}` };
        const range = parseA1Range(args.range || 'A1');
        if (!range) return { ok: false, error: `无效单元格区域: ${args.range}` };
        const values = Array.isArray(args.values) ? args.values : [[args.values]];
        pushUndo();
        let spilled = 0;
        for (let i = 0; i < values.length; i++) {
          const row = Array.isArray(values[i]) ? values[i] : [values[i]];
          for (let j = 0; j < row.length; j++) {
            const oldCell = findCell(sh.xml, range.r1 + i, range.c1 + j);
            const before = oldCell ? cellDisplay(oldCell) : '';
            setCellValue(sh.xml, range.r1 + i, range.c1 + j, row[j]);
            expandDimension(sh.xml, range.r1 + i, range.c1 + j);
            if (editBuf.length < CELL_RECORD_CAP) {
              recordEdit('cell', `${sh.name}!${cellRef(range.r1 + i, range.c1 + j)}`, before, String(row[j] ?? ''));
            } else {
              spilled += 1;
            }
          }
        }
        if (spilled) recordEdit('sheet', `${sh.name}!${args.range || 'A1'}`, '', '', `另有 ${spilled} 格写入（未逐格列出）`);
        dirty = true;
        return { ok: true, summary: `已写入工作表「${sh.name}」 ${args.range || 'A1'}（${values.length} 行）。公式以文本保存，Excel/WPS 打开后计算` };
      }
      case 'clear_range': {
        const sh = sheetByName(args.sheet);
        if (!sh) return { ok: false, error: `工作表不存在: ${args.sheet || '(当前)'}` };
        const range = parseA1Range(args.range || 'A1');
        if (!range) return { ok: false, error: `无效单元格区域: ${args.range}` };
        pushUndo();
        let spilled = 0;
        for (let r = range.r1; r <= range.r2; r++) {
          for (let c = range.c1; c <= range.c2; c++) {
            const cell = findCell(sh.xml, r, c);
            if (!cell) continue;
            const before = cellDisplay(cell);
            cell.removeAttribute('t');
            clearChildren(cell);
            if (before) {
              if (editBuf.length < CELL_RECORD_CAP) recordEdit('cell', `${sh.name}!${cellRef(r, c)}`, before, '');
              else spilled += 1;
            }
          }
        }
        if (spilled) recordEdit('sheet', `${sh.name}!${args.range || 'A1'}`, '', '', `另有 ${spilled} 格被清空（未逐格列出）`);
        dirty = true;
        return { ok: true, summary: `已清空工作表「${sh.name}」 ${args.range || 'A1'}` };
      }
      case 'set_bold': {
        const sh = sheetByName(args.sheet);
        if (!sh) return { ok: false, error: `工作表不存在: ${args.sheet || '(当前)'}` };
        const range = parseA1Range(args.range || 'A1');
        if (!range) return { ok: false, error: `无效单元格区域: ${args.range}` };
        pushUndo();
        const xf = ensureBoldXf();
        const on = args.bold !== false;
        for (let r = range.r1; r <= range.r2; r++) {
          for (let c = range.c1; c <= range.c2; c++) {
            const cell = on ? cellEl(sh.xml, r, c) : findCell(sh.xml, r, c);
            if (!cell) continue;
            if (on) cell.setAttribute('s', String(xf));
            else cell.removeAttribute('s');
            expandDimension(sh.xml, r, c);
          }
        }
        recordEdit('format', `${sh.name}!${args.range || 'A1'}`, '', '', `${on ? '设置' : '取消'}加粗`);
        dirty = true;
        return { ok: true, summary: `已${on ? '设置' : '取消'}加粗 工作表「${sh.name}」 ${args.range || 'A1'}` };
      }
      case 'append_row': {
        const sh = sheetByName(args.sheet);
        if (!sh) return { ok: false, error: `工作表不存在: ${args.sheet || '(当前)'}` };
        pushUndo();
        const { maxR, maxC } = usedBounds(sh.xml);
        expandDimension(sh.xml, maxR, Math.max(maxC - 1, 0));
        rowEl(sh.xml, maxR + 1);
        recordEdit('append', `${sh.name}!第 ${maxR + 1} 行`, '', '', `末尾追加一行（空行，第 ${maxR + 1} 行）`);
        dirty = true;
        return { ok: true, summary: `已在工作表「${sh.name}」末尾追加一行（第 ${maxR + 1} 行）` };
      }
      case 'append_col': {
        const sh = sheetByName(args.sheet);
        if (!sh) return { ok: false, error: `工作表不存在: ${args.sheet || '(当前)'}` };
        pushUndo();
        const { maxR, maxC } = usedBounds(sh.xml);
        expandDimension(sh.xml, Math.max(maxR - 1, 0), maxC);
        recordEdit('append', `${sh.name}!${colName(maxC)} 列`, '', '', `末尾追加一列（${colName(maxC)}）`);
        dirty = true;
        return { ok: true, summary: `已在工作表「${sh.name}」末尾追加一列（${colName(maxC)}）` };
      }
      case 'undo': {
        if (!undoStack.length) return { ok: true, summary: '没有可撤销的操作' };
        redoStack.push(snapshot());
        restore(undoStack.pop());
        dirty = true;
        return { ok: true, summary: '已撤销上一步' };
      }
      case 'redo': {
        if (!redoStack.length) return { ok: true, summary: '没有可重做的操作' };
        undoStack.push(snapshot());
        restore(redoStack.pop());
        dirty = true;
        return { ok: true, summary: '已重做' };
      }
      case 'export':
        return { ok: true, summary: '请由服务层执行导出' };
      default:
        return { ok: false, error: `未知表格工具: ${tool}。可用：set_range / set_bold / append_row / append_col / clear_range / switch_sheet / undo / redo / export` };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
