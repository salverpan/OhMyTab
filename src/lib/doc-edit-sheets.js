/**
 * Excel 编辑（Univer preset 0.25）—— 阅读器编辑模式的可编辑层。
 *
 * 导入/导出用 SheetJS 做桥（Univer OSS 0.25 的 xlsx 导入导出是 Pro
 * exchange-client 功能，OSS 不可用）：
 *   导入：SheetJS 解析 xlsx → 构造 Univer workbook snapshot → createWorkbook
 *   导出：workbook.save()（快照）→ 转回 SheetJS → write → ArrayBuffer
 * 公式以文本进入 Univer（cell.f = '=SUM(A1:A3)'），由 Univer 公式引擎计算；
 * 导出时带缓存结果写回。样式仅支持粗体（符合"(a) 基本编辑"定位）。
 */

import { createUniver } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import '@univerjs/preset-sheets-core/lib/index.css';
import { LocaleType } from '@univerjs/core';
import { defaultTheme } from '@univerjs/themes';
import zhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { read as xlsxRead, write as xlsxWrite, utils as xlsxUtils } from 'xlsx';

let univerAPI = null;
let workbook = null;
let containerEl = null;
let dirty = false;

export function isDirty() { return dirty; }

/* ---------- SheetJS → Univer snapshot ---------- */

function sheetToUniver(ws, id, name) {
  const range = ws && ws['!ref'] ? xlsxUtils.decode_range(ws['!ref']) : null;
  const rowCount = range ? range.e.r + 1 : 0;
  const columnCount = range ? range.e.c + 1 : 0;
  const cellData = {};
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const cell = ws[xlsxUtils.encode_cell({ r, c })];
      if (!cell) continue;
      const uc = {};
      if (cell.f) uc.f = '=' + cell.f; // Univer 公式（导入后重新计算）
      else if (cell.v !== undefined && cell.v !== null) {
        const v = cell.v;
        uc.v = typeof v === 'string' || typeof v === 'boolean' ? v : Number(v);
      } else if (cell.w !== undefined) {
        uc.v = cell.w; // 无值但有显示文本：按字符串处理
      }
      if (Object.keys(uc).length > 0) {
        if (!cellData[r]) cellData[r] = {};
        cellData[r][c] = uc;
      }
    }
  }
  return {
    id,
    name,
    rowCount: Math.max(rowCount, 1),
    columnCount: Math.max(columnCount, 1),
    cellData,
    defaultColumnWidth: 80,
  };
}

/**
 * 初始化 Univer 编辑器并载入 xlsx 内容。
 * @param {HTMLElement} container 编辑器挂载容器（需有确定高度）
 * @param {ArrayBuffer} arrayBuffer 源 xlsx
 * @returns {Promise<string[]>} sheet 名列表
 */
export async function initSheetsEditor(container, arrayBuffer) {
  containerEl = container;
  containerEl.innerHTML = '';
  const wb = xlsxRead(arrayBuffer, { type: 'array' });
  const sheetOrder = [];
  const sheets = {};
  wb.SheetNames.forEach((name, i) => {
    const sid = 'sheet-' + i;
    sheetOrder.push(sid);
    sheets[sid] = sheetToUniver(wb.Sheets[name], sid, name);
  });
  const created = createUniver({
    locale: LocaleType.ZH_CN,
    locales: { [LocaleType.ZH_CN]: zhCN },
    theme: defaultTheme,
    // 注意：container 属于 preset 配置（IUniverSheetsCorePresetConfig），
    // 不是 createUniver 的 options —— 传错位置会挂载不到容器导致空白页
    presets: [UniverSheetsCorePreset({ container: containerEl })],
  });
  univerAPI = created.univerAPI;
  workbook = univerAPI.createWorkbook({
    id: 'edit-workbook',
    name: '编辑工作簿',
    sheetOrder,
    sheets,
  });
  const first = wb.SheetNames[0];
  if (first) {
    const f = workbook.getSheetByName(first);
    if (f) workbook.setActiveSheet(f);
  }
  dirty = false;
  return wb.SheetNames;
}

export function disposeSheetsEditor() {
  if (selectionDisposable) { try { selectionDisposable.dispose(); } catch (_) {} selectionDisposable = null; }
  try { univerAPI && univerAPI.dispose(); } catch (_) {}
  univerAPI = null;
  workbook = null;
  dirty = false;
  if (containerEl) { containerEl.innerHTML = ''; }
  containerEl = null;
}

function sheetOf(name) {
  if (!workbook) return null;
  const s = workbook.getSheetByName(name);
  return s || null;
}

function cellLabel(sheetName) {
  return sheetName ? `工作表「${sheetName}」` : '当前工作表';
}

/* ---------- AI 编辑工具执行 ---------- */

export async function execSheetsTool(tool, args = {}) {
  if (!workbook) return { ok: false, error: '表格编辑器未初始化' };
  try {
    switch (tool) {
      case 'switch_sheet': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        workbook.setActiveSheet(s);
        return { ok: true, summary: `已切换到工作表「${args.sheet}」` };
      }
      case 'set_range': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        const values = Array.isArray(args.values) ? args.values : [[args.values]];
        s.getRange(args.range || 'A1').setValues(values);
        dirty = true;
        return { ok: true, summary: `已写入 ${cellLabel(args.sheet)} ${args.range || 'A1'}（${values.length} 行），公式会由引擎自动计算` };
      }
      case 'set_bold': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        s.getRange(args.range || 'A1').setFontWeight(args.bold === false ? 'normal' : 'bold');
        dirty = true;
        return { ok: true, summary: `已${args.bold === false ? '取消' : '设置'}加粗 ${cellLabel(args.sheet)} ${args.range || 'A1'}` };
      }
      case 'append_row': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        s.insertRowAfter(s.getMaxRows() - 1);
        dirty = true;
        return { ok: true, summary: `已在 ${cellLabel(args.sheet)} 末尾追加一行` };
      }
      case 'append_col': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        s.insertColumnAfter(s.getMaxColumns() - 1);
        dirty = true;
        return { ok: true, summary: `已在 ${cellLabel(args.sheet)} 末尾追加一列` };
      }
      case 'clear_range': {
        const s = sheetOf(args.sheet);
        if (!s) return { ok: false, error: `工作表不存在: ${args.sheet}` };
        s.getRange(args.range || 'A1').clear({ contentsOnly: true });
        dirty = true;
        return { ok: true, summary: `已清空 ${cellLabel(args.sheet)} ${args.range || 'A1'}` };
      }
      case 'undo': {
        const done = await univerAPI.undo();
        return { ok: true, summary: done ? '已撤销上一步' : '没有可撤销的操作' };
      }
      case 'redo': {
        const done = await univerAPI.redo();
        return { ok: true, summary: done ? '已重做' : '没有可重做的操作' };
      }
      default:
        return { ok: false, error: `未知表格工具: ${tool}。可用：set_range / set_bold / append_row / append_col / clear_range / switch_sheet / undo / redo（export 由阅读器保存流程处理）` };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/* ---------- 导出 / 文本提取 ---------- */

/** 编辑器当前内容 → xlsx ArrayBuffer（下载 / 写回库内原件） */
export function exportSheetsXlsx() {
  if (!workbook) throw new Error('表格编辑器未初始化');
  const snapshot = workbook.save();
  const wb = { SheetNames: [], Sheets: {} };
  for (const sid of snapshot.sheetOrder) {
    const us = snapshot.sheets[sid];
    const ws = {};
    for (const r in us.cellData || {}) {
      for (const c in us.cellData[r]) {
        const cell = us.cellData[r][c];
        if (!cell) continue;
        const addr = xlsxUtils.encode_cell({ r: +r, c: +c });
        if (cell.f) {
          ws[addr] = { t: 'n', f: String(cell.f).replace(/^=/, '') };
        } else if (cell.v !== undefined && cell.v !== null) {
          const v = cell.v;
          if (typeof v === 'number') ws[addr] = { t: 'n', v };
          else if (typeof v === 'boolean') ws[addr] = { t: 'b', v };
          else ws[addr] = { t: 's', v: String(v) };
        }
      }
    }
    const name = us.name || sid;
    ws['!ref'] = xlsxUtils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max((us.rowCount || 1) - 1, 0), c: Math.max((us.columnCount || 1) - 1, 0) },
    });
    wb.SheetNames.push(name);
    wb.Sheets[name] = ws;
  }
  return xlsxWrite(wb, { type: 'array', bookType: 'xlsx' });
}

/** 编辑器当前内容 → 全文文本（编辑模式下 EXTRACT_CONTENT 用） */
export function sheetsText() {
  if (!workbook) return '';
  const snapshot = workbook.save();
  const parts = [];
  for (const sid of snapshot.sheetOrder) {
    const us = snapshot.sheets[sid];
    const lines = [];
    const rows = Object.keys(us.cellData || {}).sort((a, b) => +a - +b);
    for (const r of rows) {
      const rowCells = Object.keys(us.cellData[r]).sort((a, b) => +a - +b);
      const cells = [];
      for (const c of rowCells) {
        const cell = us.cellData[r][c];
        if (!cell) continue;
        if (cell.f) cells.push(String(cell.f));
        else if (cell.v !== undefined && cell.v !== null) cells.push(String(cell.v));
      }
      if (cells.length) lines.push(cells.join('\t'));
    }
    parts.push('【工作表：' + (us.name || sid) + '】\n' + lines.join('\n'));
  }
  return parts.join('\n\n');
}

/** 当前活动工作表中**选中区域**的内容（划词工具条 AI 提问用，canvas 无 DOM 选区） */
export function getSelectionText() {
  if (!workbook) return '';
  const sheet = workbook.getActiveSheet();
  if (!sheet) return '';
  const range = sheet.getActiveRange();
  if (!range) return '';
  let a1 = '';
  try { a1 = range.getA1Notation(); } catch (_) {}
  const values = range.getValues();
  if (!values || values.length === 0) return a1 ? `（选中区域 ${a1}，内容为空）` : '';
  const lines = values.map((row) => (row || []).map((v) => (v === null || v === undefined ? '' : String(v))).join('\t')).join('\n');
  return (a1 ? `选中区域 ${a1}：\n` : '') + lines;
}

let selectionDisposable = null;

/** 监听选区变化（聊天窗「引用内容」随选中区域实时更新） */
export function onSheetsSelectionChange(cb) {
  if (selectionDisposable) { try { selectionDisposable.dispose(); } catch (_) {} selectionDisposable = null; }
  if (!workbook || typeof cb !== 'function') return;
  try {
    selectionDisposable = workbook.onSelectionChange(() => cb());
  } catch (_) {}
}
