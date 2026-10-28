/**
 * SuperCat 文档阅读器 —— PDF / Word (.docx / .doc) / Excel (.xlsx / .csv) 在网页中的
 * 划词 / 荧光笔 / 下划线 / 片段收藏 / AI 提问。
 *
 * 浏览器内置 PDF viewer 是受保护扩展页面，content script 无法注入，
 * 因此文档统一在这里渲染（pdfjs-dist / docx-preview / SheetJS），
 * 渲染成 DOM 后复用共享标注逻辑（doc-marks.js）与浮动 UI（FLOAT_UI_CSS）。
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfViewerCss from 'pdfjs-dist/web/pdf_viewer.css?inline';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx';
import { renderAsync as renderDocx } from 'docx-preview';
import { FLOAT_UI_CSS } from '../lib/float-css.js';
import { bindChatResize, isChatResizeEdge } from '../lib/chat-win-resize.js';
// AI 思考指示器：与侧边栏同一套 thinking-orbs 动画（加载/工具调用/处理/思考状态一致）
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingOrb } from 'thinking-orbs';
import { ORB_STATE_BY_TOOL } from '../lib/orb-state.js';
import { upsertSubagentCardEl, syncLiveTurnOrder } from '../lib/subagent-ui.js';
import { syncInlineMedia } from '../lib/inline-media.js';
import { attachScopeQuiz } from '../lib/scope-quiz.js';
import { appendChartsTo, disposeChatCharts } from '../lib/chat-charts.js';
import { upsertPlanCardEl } from '../lib/plan.js';
import { upsertDocEditsCardEl } from '../lib/doc-edits.js';
import {
  wrapRangeWithMark, unwrapMarks, cssPath,
  injectAnnotationStyles, createTextAnnotation,
  collectTextSnippet, collectAnnotationAsSnippet,
  replayAnnotations, findAnnotationRange,
  insertAnnotationNoteBlock, removeAnnotationNoteBlock,
} from '../lib/doc-marks.js';
import { normalizeUrl, getAnnotationsForUrl, deleteAnnotation } from '../lib/annotations.js';
import { getDocFile, saveDocFile } from '../lib/doc-store.js';
import { updateEntry, getEntries } from '../lib/storage.js';
import { resolveKind, sniffOfficeBuffer } from '../lib/doc-kind.js';
import { THEME_KEY, applyDocumentTheme, loadThemeMode, normalizeThemeMode, watchSystemTheme } from '../lib/theme.js';
import { extractLegacyDocText } from '../lib/legacy-doc.js';
import { openPdfJsDocument } from '../lib/pdf-repair.js';

// worker 的 ?url 导入在构建后是相对路径（assets/...），相对 reader 页面
// （src/reader/）解析会错位，必须用扩展绝对 URL。
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(pdfWorkerUrl.replace(/^\.\//, ''));

let readerThemeMode = 'auto';
loadThemeMode().then((mode) => {
  readerThemeMode = mode;
  applyDocumentTheme(mode);
});
watchSystemTheme(() => readerThemeMode, () => applyDocumentTheme('auto'));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[THEME_KEY]) return;
  readerThemeMode = normalizeThemeMode(changes[THEME_KEY].newValue);
  applyDocumentTheme(readerThemeMode);
});

/* ---------- 注入共享样式 ---------- */
injectAnnotationStyles();
const style = document.createElement('style');
style.textContent = pdfViewerCss + '\n' + FLOAT_UI_CSS;
(document.head || document.documentElement).appendChild(style);

/* ---------- DOM refs ---------- */
const viewerEl = document.getElementById('viewer');
const emptyState = document.getElementById('emptyState');
const fileMeta = document.getElementById('fileMeta');
const fileNameEl = document.getElementById('fileName');
const formatBadge = document.getElementById('formatBadge');
const docMetaEl = document.getElementById('docMeta');
const statusBar = document.getElementById('statusBar');

/* ---------- 状态 ---------- */
let docUrl = '';    // 标注分组 URL（远程原 URL / doc://local/<name> / doc://lib/<docId>）
let docTitle = '';
let docKind = '';   // 'pdf' | 'xlsx' | 'csv' | 'docx' | 'doc'
let pdfDoc = null;
let sheetWb = null; // 当前工作簿（多 sheet 切换 / 全文提取用）
let lastRange = null; // 当前文本选区
let currentAb = null; // 当前文档原始二进制（编辑模式初始化用）
let libDocId = '';   // 库内文档条目 id（?doc= 打开；保存时写回 IDB）
let editMode = false; // 编辑模式（xlsx/docx）
let editKind = '';    // 编辑模式下的文档类型
let sheetsEditorMod = null; // 动态 import 的 doc-edit-sheets 模块
let wordEditorMod = null;   // 动态 import 的 doc-edit-word 模块（docx 引擎已迁 SW，仅 xlsx 用 sheetsEditorMod）
let docxEditRenderEl = null; // 编辑视图的 docx 渲染容器（引擎在 SW，阅读器只渲染）

/* ---------- 阅读器会话上报 ----------
   SW 维护全局 readerSession：侧栏聊天 / 浮动窗口聊天 / 阅读器页聊天
   都能据此定位"当前打开的文档编辑页"，让 doc_edit 在任何聊天入口都可用。
   state: 'open'（已打开文档，只读）| 'editing'（编辑模式已开启）| 'closed' */
/** SW 重启后 readerSession 内存态丢失（MV3 SW 常被杀），doc_edit/doc_review 会报
 *  "没有打开的文档阅读器"。阅读器打开/编辑期间每 45s 重报一次会话，SW 重启后
 *  任意聊天入口都能自愈定位；closed 或 pagehide 时停掉心跳。 */
let sessionHeartbeat = null;
let lastAnnouncedState = null;

function announceReaderSession(state) {
  lastAnnouncedState = state;
  try {
    chrome.runtime.sendMessage({
      type: 'READER_SESSION',
      data: {
        state,
        docId: libDocId || null,
        docKind: docKind || '',
        docTitle: docTitle || '',
      },
    }).catch(() => {});
  } catch (_) {}
  if (sessionHeartbeat) { clearInterval(sessionHeartbeat); sessionHeartbeat = null; }
  if (state !== 'closed') {
    sessionHeartbeat = setInterval(() => {
      if (lastAnnouncedState === 'closed') {
        clearInterval(sessionHeartbeat);
        sessionHeartbeat = null;
        return;
      }
      try {
        chrome.runtime.sendMessage({
          type: 'READER_SESSION',
          data: {
            state: lastAnnouncedState,
            docId: libDocId || null,
            docKind: docKind || '',
            docTitle: docTitle || '',
          },
        }).catch(() => {});
      } catch (_) {}
    }, 45000);
  }
}
window.addEventListener('pagehide', () => announceReaderSession('closed'));

/* ---------- 工具函数 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let statusTimer = null;
function showStatus(msg, durationMs = 2600) {
  statusBar.hidden = false;
  statusBar.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusBar.hidden = true; }, durationMs);
}

function detectKind(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'txt') return 'txt';
  return '';
}

const KIND_LABEL = { pdf: 'PDF', xlsx: 'XLSX', csv: 'CSV', docx: 'DOCX', doc: 'DOC', md: 'MD', txt: 'TXT' };

/* ---------- 文件加载 ---------- */
async function loadArrayBuffer(name, ab, urlForAnnotations) {
  beginDocLoad();
  try {
    return await loadArrayBufferInner(name, ab, urlForAnnotations);
  } finally {
    endDocLoad();
  }
}

async function loadArrayBufferInner(name, ab, urlForAnnotations) {
  const kind = resolveKind(name, ab) || detectKind(name);
  if (!kind) {
    showStatus('不支持的文件格式：' + name + '（支持 PDF / docx / doc / xlsx / csv / md / txt）', 5000);
    return false;
  }
  // 载入新文档前退出编辑模式（未保存修改按放弃处理，进入编辑时有确认）
  if (editMode) exitEditMode(false);
  docUrl = urlForAnnotations || (name ? 'doc://local/' + encodeURIComponent(name) : '');
  docTitle = name || '';
  docKind = kind;
  currentAb = ab;
  fileNameEl.textContent = name;
  formatBadge.textContent = KIND_LABEL[kind];
  docMetaEl.textContent = '';
  fileMeta.hidden = false;
  emptyState.hidden = true;
  viewerEl.hidden = false;
  viewerEl.innerHTML = '';
  hideSelectionBar();
  closeChatWindow();
  // 编辑按钮：xlsx / docx。旧版 .xls（OLE）只读，入库时会转成 xlsx 再编辑。
  const oleSheet = kind === 'xlsx' && sniffOfficeBuffer(ab) === 'ole';
  editBtn.hidden = !(kind === 'docx' || (kind === 'xlsx' && !oleSheet));
  showStatus('正在渲染 ' + name + ' …');
  try {
    if (kind === 'pdf') await renderPdf(ab);
    else if (kind === 'docx') await renderDocxDoc(ab);
    else if (kind === 'doc') await renderLegacyDoc(ab);
    else if (kind === 'md' || kind === 'txt') await renderPlainText(ab, kind);
    else await renderSheet(ab, kind);
    showStatus('已加载');
    announceReaderSession(editMode ? 'editing' : 'open');
    updateRevBadge(); // 只读/编辑都显示待审修订数
    return true;
  } catch (err) {
    viewerEl.innerHTML = '';
    showStatus('渲染失败：' + (err.message || String(err)), 6000);
    console.error('[SuperCat reader] render failed:', err);
    return false;
  }
}

async function loadRemote(url) {
  beginDocLoad(); // 覆盖网络下载阶段：期间 read_tab 也应等而不是拿到空正文
  showStatus('正在加载文档…');
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const ab = await resp.arrayBuffer();
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'document';
    // 只在渲染成功时覆盖提示（loadArrayBuffer 失败时保留错误信息）
    const ok = await loadArrayBuffer(name, ab, url);
    if (ok) showStatus('已加载');
  } catch (err) {
    showStatus('加载失败：' + (err.message || String(err)), 6000);
  }
}

/* ---------- PDF 渲染（canvas 高分屏 + 文字层，小并发流水线） ----------
   成熟做法：
   - 渲染分辨率乘 devicePixelRatio，CSS 尺寸回缩 —— 高 DPI 屏文字不糊
   - 2 路并发渲染（串行太慢，全并发会占满 CPU）
   - canvas 与 textLayer 共用同一 CSS viewport，保证划词选区与画面逐像素对齐 */
async function renderPdf(ab) {
  // 文字识别层 PDF 常把扫描图增量写坏 xref。pdf.js 直接抛 Invalid PDF structure，
  // 这里重建交叉引用表后再渲染；原件字节仍留在 currentAb。
  const opened = await openPdfJsDocument(pdfjsLib, ab, {
    onRepair() { showStatus('文档结构损坏，正在重建交叉引用表…', 8000); },
  });
  pdfDoc = opened.pdf;
  docMetaEl.textContent = `${pdfDoc.numPages} 页`;
  const SCALE = 1.5;
  const dpr = window.devicePixelRatio || 1;
  const CONCURRENCY = 2;

  let cursor = 1;
  const renderOne = async () => {
    while (true) {
      const p = cursor++;
      if (p > pdfDoc.numPages) break;
      if (p % 3 === 1) showStatus(`正在渲染第 ${Math.min(p + CONCURRENCY, pdfDoc.numPages)}/${pdfDoc.numPages} 页…`, 8000);
      const page = await pdfDoc.getPage(p);
      // CSS 视口（文字层定位用）+ 渲染视口（高分屏乘 dpr）
      const cssViewport = page.getViewport({ scale: SCALE });
      const renderViewport = dpr !== 1 ? page.getViewport({ scale: SCALE * dpr }) : cssViewport;

      const pageEl = document.createElement('div');
      pageEl.className = 'pdf-page';
      pageEl.dataset.pdfPage = p;
      pageEl.style.width = cssViewport.width + 'px';
      pageEl.style.height = cssViewport.height + 'px';

      const canvas = document.createElement('canvas');
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = cssViewport.width + 'px';
      canvas.style.height = cssViewport.height + 'px';
      pageEl.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;

      const textDiv = document.createElement('div');
      textDiv.className = 'textLayer';
      textDiv.style.width = cssViewport.width + 'px';
      textDiv.style.height = cssViewport.height + 'px';
      // 关键：pdfjs v6 的 textLayer span 字号依赖 CSS 变量 --total-scale-factor
      // （官方 viewer 组件会设置它，自渲染必须显式给出），否则字号为 0：
      // 文字层不可见、划词选不中/选区与画面错位。
      textDiv.style.setProperty('--total-scale-factor', String(cssViewport.scale));
      pageEl.appendChild(textDiv);
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport: cssViewport,
      });
      await textLayer.render();

      viewerEl.appendChild(pageEl);
      await sleep(0); // 让出主线程（流水线天然分摊，无需固定计数）
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => renderOne()));
}

/* ---------- XLSX / CSV 渲染（SheetJS → HTML 表格，支持多 sheet 切换） ---------- */

/** 可见 sheet 列表（跳过隐藏工作表；SheetJS 的 Hidden 标记在 wb.Workbook.Sheets） */
function visibleSheetNames(wb) {
  const hidden = {};
  const meta = wb.Workbook && wb.Workbook.Sheets;
  if (Array.isArray(meta)) {
    meta.forEach((m, i) => { if (m && m.Hidden) hidden[wb.SheetNames[i]] = true; });
  }
  return wb.SheetNames.filter((n) => !hidden[n]);
}

/**
 * 无缓存值的公式单元格（v 为空，部分程序生成的 xlsx 不带 <v>）：
 * 把公式文本补成显示文本，避免整格空白/提取丢失。
 * 有缓存值的公式（Excel/WPS 常规）v 存在，照常显示计算结果。
 */
function patchFormulaDisplay(ws) {
  if (!ws || !ws['!ref']) return;
  const range = xlsxUtils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[xlsxUtils.encode_cell({ r, c })];
      if (cell && cell.f && cell.v === undefined && cell.w === undefined) {
        cell.w = '=' + cell.f;
      }
    }
  }
}

function renderSheetHtml(wrap, ws) {
  patchFormulaDisplay(ws);
  wrap.querySelector('.sheet-table')?.remove();
  const div = document.createElement('div');
  div.className = 'sheet-table';
  div.innerHTML = xlsxUtils.sheet_to_html(ws, { id: 'citecat-sheet' });
  wrap.appendChild(div);
}

async function renderSheet(ab, kind) {
  // SheetJS 的 type:'array' 会把字节按 Latin-1 逐字节转成字符串，
  // UTF-8 中文 CSV 会整表乱码。CSV 先按文本解码（UTF-8 优先，失败回退 GBK），
  // 再以 type:'string' 交给 SheetJS；xlsx 是 zip 二进制，保持 type:'array'。
  let wb;
  if (kind === 'csv') {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(ab);
    } catch (_) {
      text = new TextDecoder('gbk').decode(ab);
    }
    wb = xlsxRead(text, { type: 'string' });
  } else {
    wb = xlsxRead(ab, { type: 'array' });
  }
  sheetWb = wb;
  const names = visibleSheetNames(wb);
  if (names.length === 0) throw new Error('工作簿为空');
  docMetaEl.textContent = `${names.length} 个工作表`;

  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  viewerEl.appendChild(wrap);

  // 多 sheet 切换条（CSV 只有 1 个 sheet，条子自然只剩一个按钮）
  const bar = document.createElement('div');
  bar.className = 'sheet-tabs';
  wrap.appendChild(bar);
  names.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sheet-tab' + (i === 0 ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.sheet-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderSheetHtml(wrap, wb.Sheets[name]);
    });
    bar.appendChild(btn);
  });
  renderSheetHtml(wrap, wb.Sheets[names[0]]);
}

/* ---------- DOCX 渲染（docx-preview，高保真 DOM） ---------- */
async function renderDocxDoc(ab) {
  const wrap = document.createElement('div');
  wrap.className = 'docx-wrap';
  viewerEl.appendChild(wrap);
  await renderDocx(ab, wrap);
}

async function renderLegacyDoc(ab) {
  const wrap = document.createElement('div');
  wrap.className = 'docx-wrap doc-text-wrap';
  const text = extractLegacyDocText(ab) || '';
  docMetaEl.textContent = text ? (text.length + ' 字 · 旧版 Word 只读') : '未提取到文本';
  wrap.textContent = text || '（未能从该 .doc 提取文本。可在文库点「转可编辑」试试，或另存为 .docx 后再打开。）';
  viewerEl.appendChild(wrap);
}

async function renderPlainText(ab, kind) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(ab);
  } catch (_) {
    text = new TextDecoder('gbk').decode(ab);
  }
  text = String(text || '').replace(/^\uFEFF/, '');
  const wrap = document.createElement('div');
  wrap.className = 'docx-wrap doc-text-wrap';
  wrap.textContent = text || '（空文件）';
  docMetaEl.textContent = (text ? text.length + ' 字' : '空') + (kind === 'md' ? ' · Markdown' : ' · 纯文本');
  viewerEl.appendChild(wrap);
}

/* ---------- 标注重放 ---------- */
async function replayAll() {
  if (!docUrl) return;
  if (docKind === 'pdf') {
    // PDF：文字层 span 绝对定位，mark 包裹会打乱布局 → span 级高亮
    await replayPdfAnnotations();
  } else {
    await replayAnnotations(docUrl, viewerEl);
  }
}

async function replayPdfAnnotations() {
  const list = await getAnnotationsForUrl(docUrl);
  if (!list || list.length === 0) return;
  for (const ann of list) {
    const range = findAnnotationRange(ann, viewerEl);
    if (!range) continue;
    highlightPdfSpans(range, ann.id, ann.kind);
  }
}

/** PDF 高亮：给选区覆盖到的 textLayer span 加 class（不动绝对定位布局） */
function highlightPdfSpans(range, id, kind) {
  try {
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!range.intersectsNode(n)) continue;
      const span = n.parentElement && n.parentElement.closest('.textLayer span');
      if (!span || seen.has(span)) continue;
      seen.add(span);
      span.classList.add(kind === 'hl' ? 'citecat-pdf-hl' : 'citecat-pdf-ul');
      span.dataset.annId = id;
    }
    if (seen.size === 0) {
      // 选区可能全在单个文本节点内（walk 起点在 range 内时兜底）
      const root = range.startContainer;
      const s = root.parentElement && root.parentElement.closest('.textLayer span');
      if (s) {
        s.classList.add(kind === 'hl' ? 'citecat-pdf-hl' : 'citecat-pdf-ul');
        s.dataset.annId = id;
      }
    }
  } catch (_) {}
}

/** 移除某标注的高亮（PDF span class / 普通 mark 解包 / 元素标注 class） */
function removeAnnotationHighlight(id) {
  if (docKind === 'pdf') {
    document.querySelectorAll(`.textLayer span[data-ann-id="${CSS.escape(id)}"]`)
      .forEach((s) => { s.classList.remove('citecat-pdf-hl', 'citecat-pdf-ul'); delete s.dataset.annId; });
  } else {
    unwrapMarks(`mark[data-ann-id="${CSS.escape(id)}"]`); // 解包，保留原文
    removeAnnotationNoteBlock(id); // 段后批注块联动移除
    document.querySelectorAll(`[data-ann-el="${CSS.escape(id)}"]`)
      .forEach((m) => m.classList.remove('citecat-el-hl', 'citecat-el-ul'));
  }
}

/* 侧栏删除/恢复 snippet 的联动消息（panel 会同时通知 content 页面与本标签页） */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'DELETE_ANNOTATION_MARK' && msg.data && msg.data.id) {
    removeAnnotationHighlight(msg.data.id);
    return { ok: true };
  }
  if (msg && msg.type === 'REPLAY_ANNOTATIONS') {
    return { ok: false };
  }
  return false;
});

/* ================= 划词工具条（与内容页同一套交互） ================= */

let barEl = null, popEl = null, toastEl = null, chatWin = null;
let selectionTimer = null;

function createFloatUi() {
  // 工具条
  barEl = document.createElement('div');
  barEl.className = 'sel-bar';
  barEl.style.display = 'none';
  barEl.innerHTML =
    '<button class="sel-btn primary" data-act="ask">AI</button>' +
    '<button class="sel-btn" data-act="collect">收藏</button>';
  barEl.addEventListener('mousedown', (e) => e.preventDefault());
  barEl.addEventListener('click', (e) => {
    const act = e.target.closest('.sel-btn')?.dataset.act;
    if (!act) return;
    if (act === 'ask') { openChatWindow({ preferRange: true }); return; }
    hideSelectionBar();
    if (editMode && act !== 'ask') return;
    const range = lastRange;
    if (!range) return;
    if (act === 'collect') {
      collectTextSnippet(range, docUrl, docTitle).then((r) => {
        if (r && r.ok) showStatus('已加入来源');
        else showStatus('收藏失败: ' + ((r && r.error) || '未知错误'));
      });
    }
    window.getSelection()?.removeAllRanges();
  });
  document.body.appendChild(barEl);


  // 标注浮层（点击 mark / PDF 高亮 span）
  popEl = document.createElement('div');
  popEl.className = 'sel-bar';
  popEl.style.display = 'none';
  popEl.innerHTML =
    '<div class="ann-note" hidden></div>' +
    '<button class="sel-btn primary" data-act="collect">收藏</button>' +
    '<button class="sel-btn" data-act="del">删除</button>';
  popEl.addEventListener('mousedown', (e) => e.preventDefault());
  popEl.addEventListener('click', async (e) => {
    const act = e.target.closest('.sel-btn')?.dataset.act;
    const id = popEl.dataset.annId;
    if (!act || !id) return;
    hideAnnPopover();
    if (act === 'del') {
      await deleteAnnotation(docUrl, id);
      removeAnnotationHighlight(id);
      // 联动：侧栏里关联的 snippet 条目同步删除（SW 幂等处理）
      chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET_BY_ANNOTATION', data: { annotationId: id } }).catch(() => {});
      showStatus('已删除标注');
    } else if (act === 'collect') {
      const list = await getAnnotationsForUrl(docUrl);
      const ann = list.find((a) => a.id === id);
      if (ann) {
        if (ann.entryId) { showStatus('已在库中'); return; }
        const r = await collectAnnotationAsSnippet(ann, docUrl, docTitle);
        showStatus(r.ok ? '已收藏为片段' : '收藏失败: ' + r.error);
      }
    }
  });
  document.body.appendChild(popEl);

  // 轻提示（复用 mini-toast 样式，改固定位置）
  toastEl = document.createElement('div');
  toastEl.className = 'mini-toast';
  toastEl.style.position = 'fixed';
  document.body.appendChild(toastEl);
}

function showMiniToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function showSelectionBarAtRect(r) {
  if (!barEl || !r) return;
  barEl.style.display = 'flex';
  const w = barEl.offsetWidth || 128;
  const h = barEl.offsetHeight || 40;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.top - h - 8;
  if (top < 8) top = r.bottom + 8;
  barEl.style.left = left + 'px';
  barEl.style.top = top + 'px';
}

function hideSelectionBar() {
  if (barEl) barEl.style.display = 'none';
}

/** 编辑模式下划词工具条只留「AI」：标注/收藏锚定只读 DOM，编辑器里无意义 */
function updateBarForMode() {
  if (!barEl) return;
  barEl.querySelectorAll('[data-act="collect"]').forEach((b) => {
    b.style.display = editMode ? 'none' : '';
  });
}

async function showAnnPopover(el, e) {
  if (!popEl) return;
  popEl.dataset.annId = el.dataset.annId;
  // 批注说明（note）：正文里已有内嵌批注块时不重复显示（PDF 文字层无法插块，浮层补显）
  const noteEl = popEl.querySelector('.ann-note');
  let hasNote = false;
  if (docUrl && el.dataset.annId) {
    try {
      const list = await getAnnotationsForUrl(docUrl);
      const ann = list.find((a) => a.id === el.dataset.annId);
      const inlineBlock = document.querySelector(`[data-note-for="${CSS.escape(el.dataset.annId)}"]`);
      if (ann && ann.note && !inlineBlock) {
        hasNote = true;
        if (noteEl) { noteEl.textContent = ann.note; noteEl.hidden = false; }
      }
    } catch (_) {}
  }
  if (noteEl && !hasNote) { noteEl.textContent = ''; noteEl.hidden = true; }
  popEl.classList.toggle('has-note', hasNote);
  const r = el.getBoundingClientRect();
  const w = hasNote ? 220 : 150;
  const h = hasNote ? 86 : 40;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = r.top - h - 10;
  if (top < 8) top = r.bottom + 10;
  if (top + h > window.innerHeight) top = Math.max(8, r.top - h - 10);
  popEl.style.left = left + 'px';
  popEl.style.top = top + 'px';
  popEl.style.display = 'flex';
}

function hideAnnPopover() {
  if (popEl) popEl.style.display = 'none';
}

let selPointer = null;
let selPointerAt = 0;
let selRectIndex = 0;

function pickSelectionRect(range, pointer, index) {
  let list = [];
  try {
    list = [...range.getClientRects()].filter((r) => r.width > 1 || r.height > 1);
  } catch (_) {
    return { rect: null, index: 0 };
  }
  if (!list.length) {
    try { return { rect: range.getBoundingClientRect(), index: 0 }; }
    catch (_) { return { rect: null, index: 0 }; }
  }
  if (Number.isInteger(index) && list[index]) return { rect: list[index], index };
  if (!pointer) return { rect: list[list.length - 1], index: list.length - 1 };
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const cx = Math.max(r.left, Math.min(pointer.x, r.right));
    const cy = Math.max(r.top, Math.min(pointer.y, r.bottom));
    const d = (cx - pointer.x) ** 2 + (cy - pointer.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return { rect: list[best], index: best };
}

function repositionReaderBar(e) {
  const t = e && e.target;
  const node = t && typeof t.nodeType === 'number' ? t : null;
  if (node && chatWin && (node === chatWin || chatWin.contains(node))) return;
  if (node && barEl && (node === barEl || barEl.contains(node))) return;
  if (!barEl || barEl.style.display === 'none' || !lastRange) return;
  const picked = pickSelectionRect(lastRange, null, selRectIndex);
  if (!picked.rect || (picked.rect.width === 0 && picked.rect.height === 0)) return;
  showSelectionBarAtRect(picked.rect);
}

/** 选区变化 → 工具条（250ms debounce，覆盖鼠标/键盘选择） */
function onTextSelectChange() {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text || sel.rangeCount === 0) { hideSelectionBar(); return; }
    const anchor = sel.anchorNode;
    // 编辑模式的选区在 editorHost 里，也放行
    if (!anchor || !(viewerEl.contains(anchor) || (editMode && editorHost.contains(anchor)))) { hideSelectionBar(); return; }
    const range = sel.getRangeAt(0).cloneRange();
    lastRange = range;
    const pointer = (Date.now() - selPointerAt < 1500) ? selPointer : null;
    const picked = pickSelectionRect(range, pointer);
    selRectIndex = picked.index;
    hideAnnPopover();
    if (picked.rect) showSelectionBarAtRect(picked.rect);
    if (chatWin && chatWin.classList.contains('show')) refreshChatContext();
  }, 250);
}

document.addEventListener('selectionchange', onTextSelectChange);
document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  selPointer = { x: e.clientX, y: e.clientY };
  selPointerAt = Date.now();
}, true);
document.addEventListener('scroll', repositionReaderBar, true);
window.addEventListener('resize', repositionReaderBar);

/* mark / PDF 高亮 span 点击 → 浮层（批注块为纯展示，不弹浮层） */
document.addEventListener('click', (e) => {
  const mark = e.target.closest('mark.citecat-hl, mark.citecat-ul, .textLayer span.citecat-pdf-hl, .textLayer span.citecat-pdf-ul');
  if (mark) {
    e.preventDefault();
    e.stopPropagation();
    // 再次点击同一标注：收起浮层（toggle）
    if (popEl && popEl.style.display !== 'none' && popEl.dataset.annId === mark.dataset.annId) {
      hideAnnPopover();
      return;
    }
    showAnnPopover(mark, e);
    return;
  }
  if (!e.target.closest('.sel-bar')) hideAnnPopover();
});

/* ================= 浮动 AI 聊天窗（与内容页同一套 port 协议） ================= */

let chatPort = null;
let chatHistory = [];
let chatContext = null;
let chatBusy = false;
let liveScopeQuiz = null;
let chatStreamText = '';
let floatPlacedImages = [];
let chatStreamEl = null;

function buildChatContext(opts) {
  const preferRange = !!(opts && opts.preferRange);
  // 编辑模式：xlsx 是 canvas 渲染，浏览器没有 DOM 选区 —— 用 Univer 的
  // 活动选区（选中区域内容）作为提问上下文；docx 有真实 DOM 选区走下面。
  if (editMode && editKind === 'xlsx' && sheetsEditorMod) {
    const selText = sheetsEditorMod.getSelectionText();
    if (!selText) return null;
    return {
      kind: 'text',
      label: '表格选中区域',
      text: selText.slice(0, 4000),
      title: docTitle,
      url: docUrl,
      system: '### 当前选区（表格编辑器中选中的区域，本次提问的对象）\n' + selText.slice(0, 4000),
    };
  }
  const sel = window.getSelection();
  let text = sel && !sel.isCollapsed ? sel.toString().trim() : '';
  // 划词入口记录的是点击工具条前的 range，优先保留用户当时的选区
  if (!text && preferRange && lastRange) {
    try { text = lastRange.toString().trim(); } catch (_) { text = ''; }
  }
  if (!text) return null;
  return {
    kind: 'text',
    label: '文档选区',
    text: text.slice(0, 4000),
    title: docTitle,
    url: docUrl,
    system: '### 当前选区（文档阅读器划选，本次提问的对象）\n选区类型：文档文本\n' + text.slice(0, 4000),
  };
}

async function openChatWindow(opts) {
  chatContext = buildChatContext(opts);
  // 编辑模式允许无选区打开：xlsx 是 canvas 没有 DOM 选区，用户直接在
  // 输入框描述需求即可（有选中区域时会自动带上区域内容）
  if (!chatContext && !editMode) return;
  hideSelectionBar();
  if (!chatWin) return;
  if (chatWin.classList.contains('show')) {
    renderChatContext();
    chatWin.querySelector('.cw-input input').focus();
    return;
  }
  let r = null;
  if (lastRange) r = pickSelectionRect(lastRange, null, selRectIndex).rect;
  if (!r || (r.width === 0 && r.height === 0)) {
    const sel = window.getSelection();
    r = sel && sel.rangeCount > 0 && !sel.isCollapsed ? sel.getRangeAt(0).getBoundingClientRect() : null;
  }
  const w = 380, h = 420;
  let left = r ? Math.min(Math.max(8, r.left), window.innerWidth - w - 8) : (window.innerWidth - w - 16);
  let top = r ? r.bottom + 10 : Math.max(8, window.innerHeight - h - 70);
  if (top + h > window.innerHeight - 8) top = Math.max(8, (r ? r.top : window.innerHeight) - h - 10);
  chatWin.style.left = left + 'px';
  chatWin.style.top = top + 'px';
  chatWin.classList.remove('cw-min');
  chatWin.classList.add('show');

  chatHistory = [];
  chatBusy = false;
  chatStreamText = '';
  floatPlacedImages = [];
  const body = chatWin.querySelector('.cw-body');
  body.innerHTML = '';
  chatWin.querySelector('.cw-input input').value = '';
  updateSendBtn();
  renderChatContext();

  if (chatPort) { try { chatPort.disconnect(); } catch (_) {} }
  chatPort = chrome.runtime.connect({ name: 'ann-chat' });
  chatPort.onMessage.addListener(handleChatPortMessage);
  chatPort.onDisconnect.addListener(handleChatPortDisconnect);
  setTimeout(() => chatWin.querySelector('.cw-input input').focus(), 60);
}

/* SW 端口消息统一处理（openChatWindow 注册 + 断线后 sendChatMessage 自动重连共用） */
function handleChatPortMessage(m) {
  if (m.type === 'stream-reset') {
    chatStreamText = '';
    if (chatStreamEl) chatStreamEl.textContent = '';
  } else if (m.type === 'chunk') appendAiChunk(m.text);
  else if (m.type === 'done') {
    if (m.aborted && chatStreamText && !/\(已中断\)\s*$/.test(chatStreamText)) {
      chatStreamText += '\n\n(已中断)';
    }
    try { finishAiChunk(); }
    catch (err) {
      console.warn('[SuperCat] finish float chat failed', err);
      chatBusy = false;
      updateSendBtn();
    }
    if (Array.isArray(m.messages)) chatHistory = m.messages;
  }
  else if (m.type === 'error') {
    failAiChunk(m.error);
    if (Array.isArray(m.messages)) chatHistory = m.messages;
  }
  else if (m.type === 'tool') handleToolEvent(m.status, m.label, m.tool);
  else if (m.type === 'subagent') handleSubagentEvent(m.card);
  else if (m.type === 'ui') {
    if (m.clearHistory) { chatHistory = []; resetChatBody(); }
    if (m.toast) showMiniToast(m.toast);
    if (m.suggestions && m.suggestions.actions && m.suggestions.actions.length > 0) {
      renderSuggestionChips(m.suggestions);
    }
    if (m.scopeQuiz) renderScopeQuiz(m.scopeQuiz);
    if (m.chart) appendFloatChart(m.chart);
    if (m.image) appendFloatImage(m.image);
    if (m.plan !== undefined) upsertFloatPlan(m.plan);
    if (m.docEdit) upsertFloatDocEdit(m.docEdit);
  }
}

/* 断线兜底：SW 重启/崩溃后端口失效，清空引用让下次发送自动重连 */
function handleChatPortDisconnect() {
  chatPort = null;
  chatBusy = false;
  updateSendBtn();
}

function closeChatWindow() {
  if (!chatWin) return;
  chatWin.classList.remove('show');
  if (chatPort) { try { chatPort.disconnect(); } catch (_) {} chatPort = null; }
  chatBusy = false;
  updateSendBtn();
}

function renderChatContext() {
  if (!chatWin || !chatContext) return;
  chatWin.querySelector('.cw-label').textContent = 'AI 对象：' + chatContext.label;
  const body = chatWin.querySelector('.cw-ctx-body');
  body.textContent = chatContext.text;
  body.classList.remove('expanded');
  const toggle = chatWin.querySelector('.cw-ctx-toggle');
  toggle.textContent = chatContext.text.length > 120 ? '展开' : '';
}

/** 编辑模式下选区变化 → 重新生成聊天上下文并刷新「引用内容」显示 */
function refreshChatContext() {
  const next = buildChatContext({ preferRange: true });
  if (!next) return; // 当前没有有效选区：保留上一次上下文，不闪空
  const prev = chatContext ? chatContext.text : '';
  chatContext = next;
  if (chatWin && chatWin.classList.contains('show') && next.text !== prev) {
    renderChatContext();
  }
}

/** 发送 ↔ 停止按钮切换（chatBusy 时点击发送 = 中止本次回答） */
function updateSendBtn() {
  if (!chatWin) return;
  const btn = chatWin.querySelector('.cw-send');
  if (!btn) return;
  if (chatBusy) {
    btn.classList.add('stop');
    btn.title = '停止';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  } else {
    btn.classList.remove('stop');
    btn.title = '发送';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  }
}

function stopChat() {
  if (chatPort) { try { chatPort.postMessage({ type: 'ABORT' }); } catch (_) {} }
  // SW 收到 ABORT 后会中断并回 done；兜底：3 秒后强制复位按钮（防止 done 丢失卡死）
  setTimeout(() => {
    if (chatBusy) { chatBusy = false; updateSendBtn(); }
  }, 3000);
}

function sendChatMessage() {
  if (!chatWin || chatBusy) return;
  // 断线自动重连（SW 重启后旧端口已失效；handleChatPortDisconnect 置 null）
  if (!chatPort) {
    try {
      chatPort = chrome.runtime.connect({ name: 'ann-chat' });
      chatPort.onMessage.addListener(handleChatPortMessage);
      chatPort.onDisconnect.addListener(handleChatPortDisconnect);
    } catch (_) { return; }
  }
  const input = chatWin.querySelector('.cw-input input');
  const text = input.value.trim();
  if (!text) return;
  skipLiveScopeQuiz(text);
  input.value = '';
  chatHistory.push({ role: 'user', content: text });
  const body = chatWin.querySelector('.cw-body');
  const u = document.createElement('div');
  u.className = 'cw-msg user';
  const uLabel = document.createElement('div');
  uLabel.className = 'cw-msg-label';
  uLabel.textContent = '你';
  const uText = document.createElement('p');
  uText.textContent = text;
  u.append(uLabel, uText);
  body.appendChild(u);
  const ai = document.createElement('div');
  ai.className = 'cw-msg ai';
  // 全程常驻：orb + 右侧 shimmer 文字一行，流式正文在下方独立容器填充（不再用竖杠光标）
  ai.innerHTML = '<div class="cw-msg-label">SuperCat</div>' +
    '<div class="cw-subagents"></div>' +
    '<p class="cw-stream"></p>' +
    '<div class="cw-thinking-row"><span class="cw-thinking-orb"></span><span class="cw-thinking-text">Thinking</span></div>';
  body.appendChild(ai);
  chatStreamEl = ai.querySelector('.cw-stream');
  mountChatOrb(ai.querySelector('.cw-thinking-orb'), 'working');
  body.scrollTop = body.scrollHeight;
  chatBusy = true;
  chatStreamText = '';
  floatPlacedImages = [];
  updateSendBtn();
  // 无响应看门狗：SW 无任何回传（chunk/tool/done/error）超时则解锁，避免按钮卡死
  armChatWatchdog();
  chatPort.postMessage({
    type: 'CHAT',
    messages: chatHistory,
    context: chatContext ? { kind: chatContext.kind, text: chatContext.text, extra: '', system: chatContext.system } : null,
  });
}

/* ---- 思考 orb（与侧边栏同一套 thinking-orbs 动画）---- */
let chatOrbRoot = null; // 当前 AI 消息的 ThinkingOrb React root
let chatWatchdogTimer = 0;
const CHAT_WATCHDOG_MS = 120000;

function mountChatOrb(el, state) {
  unmountChatOrb();
  if (!el) return;
  try {
    chatOrbRoot = createRoot(el);
    chatOrbRoot.render(createElement(ThinkingOrb, {
      state,
      size: 20,
      theme: 'auto',
      'aria-label': 'AI 思考中',
    }));
  } catch (_) {
    chatOrbRoot = null;
  }
}

function setChatOrbState(state) {
  if (!chatOrbRoot) return;
  try {
    chatOrbRoot.render(createElement(ThinkingOrb, {
      state,
      size: 20,
      theme: 'auto',
      'aria-label': 'AI 思考中',
    }));
  } catch (_) {}
}

/* orb 右侧的 shimmer 文字（Thinking / 工具状态 label / 工具错误） */
function setChatThinkingText(text, isError) {
  const root = (chatStreamEl && chatStreamEl.closest('.cw-msg.ai')) || chatWin;
  const el = root && root.querySelector('.cw-thinking-text');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

function unmountChatOrb() {
  if (chatOrbRoot) {
    try { chatOrbRoot.unmount(); } catch (_) {}
    chatOrbRoot = null;
  }
}

function clearChatWatchdog() {
  if (chatWatchdogTimer) { clearTimeout(chatWatchdogTimer); chatWatchdogTimer = 0; }
}

function armChatWatchdog() {
  clearChatWatchdog();
  const kick = (quiet) => {
    chatWatchdogTimer = setTimeout(() => {
      chatWatchdogTimer = 0;
      if (!chatBusy) return;
      if (!quiet) {
        setChatThinkingText('仍在等待…');
        kick(true);
        return;
      }
      failAiChunk('AI 长时间无响应，请重试');
    }, CHAT_WATCHDOG_MS);
  };
  kick(false);
}

function appendAiChunk(t) {
  if (!chatStreamEl) return;
  // 首 chunk 到达：orb 全程常驻（切回 working、清空右侧状态文字），正文填下方容器
  if (chatOrbRoot) {
    setChatOrbState('working');
    setChatThinkingText('');
  }
  armChatWatchdog();
  chatStreamText += t;
  const ai = chatStreamEl.closest('.cw-msg.ai');
  if (ai && floatPlacedImages.length) paintFloatStream(ai);
  else {
    chatStreamEl.textContent = chatStreamText;
    if (ai) syncLiveTurnOrder(ai, 'cw');
  }
  const body = chatWin?.querySelector('.cw-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function removeThinkingRow() {
  const root = (chatStreamEl && chatStreamEl.closest('.cw-msg.ai'))
    || (chatWin && chatWin.querySelector('.cw-msg.ai:last-of-type'));
  const row = root && root.querySelector('.cw-thinking-row');
  if (row) row.remove();
}

function finishAiChunk() {
  const ai = chatStreamEl && chatStreamEl.closest('.cw-msg.ai');
  if (ai && floatPlacedImages.length) paintFloatStream(ai);
  else if (chatStreamEl) chatStreamEl.textContent = chatStreamText;
  // 先卸 React root 再移除它的容器行（.cw-thinking-row 含 .cw-thinking-orb），
  // 否则 removeChild 抛 NotFoundError
  unmountChatOrb();
  removeThinkingRow();
  clearChatWatchdog();
  chatBusy = false;
  chatStreamEl = null;
  updateSendBtn();
}

function failAiChunk(err) {
  const el = chatStreamEl;
  if (el) {
    const e = document.createElement('div');
    e.className = 'cw-err';
    e.textContent = '出错了：' + (err || '未知错误');
    el.parentElement.appendChild(e);
  }
  unmountChatOrb();
  removeThinkingRow();
  clearChatWatchdog();
  if (chatStreamText) chatHistory.push({ role: 'assistant', content: chatStreamText });
  chatBusy = false;
  chatStreamEl = null;
  updateSendBtn();
}

function handleSubagentEvent(card) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body || !card) return;
  armChatWatchdog();
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (ai) upsertSubagentCardEl(ai, card, 'cw');
  body.scrollTop = body.scrollHeight;
}

function handleToolEvent(status, label, toolName) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body) return;
  // 工具事件也算 SW 活跃：重置看门狗
  armChatWatchdog();
  if (status === 'start') {
    // 工具状态显示在 orb 右侧的 shimmer 文字行（与 orb 同行走位）
    setChatThinkingText(`${label}…`);
    // 与侧边栏同逻辑：工具执行期间 orb 切换到对应状态
    setChatOrbState(ORB_STATE_BY_TOOL[toolName] || 'working');
  } else if (status === 'done') {
    // 工具完成 → 模型重新思考：恢复 working orb + Thinking 文字（与侧边栏 setOrbState('working') 一致）
    setChatThinkingText('Thinking');
    setChatOrbState('working');
  } else if (status === 'error') {
    setChatThinkingText(`✗ ${label}`, true);
  }
  body.scrollTop = body.scrollHeight;
}

function renderSuggestionChips(suggestions) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body) return;
  const wrap = document.createElement('div');
  wrap.className = 'cw-suggests';
  // 兜底归一化：模型偶发传对象数组（{label/title/text/action}），渲染为字符串
  (suggestions.actions || []).slice(0, 5).forEach((act) => {
    const label = typeof act === 'string' ? act.trim()
      : (act && typeof act === 'object' ? String(act.label || act.title || act.text || act.action || '').trim() : String(act));
    if (!label) return;
    const btn = document.createElement('button');
    btn.className = 'cw-suggest';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (chatBusy) return;
      chatWin.querySelector('.cw-input input').value = label;
      sendChatMessage();
    });
    wrap.appendChild(btn);
  });
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}

function skipLiveScopeQuiz(text) {
  if (!liveScopeQuiz || liveScopeQuiz.locked) return;
  if (String(text || '').startsWith('【调研简报】')) return;
  liveScopeQuiz.skipped = true;
  liveScopeQuiz.locked = true;
  const host = chatWin && chatWin.querySelector('.scope-quiz-host');
  if (host) attachScopeQuiz(host, liveScopeQuiz, { compact: true });
}

function renderScopeQuiz(quiz) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body || !quiz) return;
  liveScopeQuiz = quiz;
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  let host = ai.querySelector('.scope-quiz-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'scope-quiz-host';
    ai.appendChild(host);
  }
  const send = (text) => {
    if (chatBusy) {
      setTimeout(() => send(text), 60);
      return;
    }
    const input = chatWin.querySelector('.cw-input input');
    if (!input) return;
    input.value = text;
    sendChatMessage();
  };
  attachScopeQuiz(host, quiz, { compact: true, onComplete: send });
  body.scrollTop = body.scrollHeight;
}

function paintFloatStream(ai) {
  if (!ai) return;
  const stream = syncInlineMedia(ai, chatStreamText, floatPlacedImages, {
    streamClass: 'cw-stream',
    streamTag: 'p',
    pinSelector: ':scope > .cw-thinking-row',
    renderSlice: (el, slice) => { el.textContent = slice; },
  });
  if (stream) chatStreamEl = stream;
  syncLiveTurnOrder(ai, 'cw');
}

function appendFloatImage(image) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body || !image || !image.dataUrl) return;
  armChatWatchdog();
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  const at = Number.isFinite(image.at) ? image.at : chatStreamText.length;
  const next = { ...image, at };
  const idx = floatPlacedImages.findIndex((x) => x.id === next.id);
  if (idx >= 0) floatPlacedImages[idx] = next;
  else floatPlacedImages.push(next);
  paintFloatStream(ai);
  body.scrollTop = body.scrollHeight;
}

function appendFloatChart(chart) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body || !chart) return;
  armChatWatchdog();
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  let stack = ai.querySelector('.chat-live-charts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'chat-live-charts';
    const before = ai.querySelector('.cw-thinking-row') || ai.querySelector('.scope-quiz-host');
    if (before) ai.insertBefore(stack, before);
    else ai.appendChild(stack);
  }
  appendChartsTo(stack, [chart]);
  body.scrollTop = body.scrollHeight;
}

/* 任务清单卡：整窗一张，来新状态就地替换（plan=null 表示清空） */
function upsertFloatPlan(plan) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body) return;
  body.querySelectorAll('.cw-plan[data-plan-card]').forEach((el) => el.remove());
  if (!plan || !plan.items || !plan.items.length) return;
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  upsertPlanCardEl(ai, plan, 'cw');
  body.scrollTop = body.scrollHeight;
}

/* 文档修改卡：同一文档一张，多次编辑就地累加 */
function upsertFloatDocEdit(card) {
  const body = chatWin && chatWin.querySelector('.cw-body');
  if (!body || !card || !card.edits || !card.edits.length) return;
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  let stack = ai.querySelector(':scope > .cw-diffs');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'cw-diffs';
    ai.appendChild(stack);
  }
  upsertDocEditsCardEl(stack, card, 'cw');
  body.scrollTop = body.scrollHeight;
}

function resetChatBody() {
  if (!chatWin) return;
  liveScopeQuiz = null;
  // 先卸 React ThinkingOrb root，再用 innerHTML 整体替换 .cw-body：
  // 否则 orb 容器（.cw-thinking-orb）随父节点被销毁，React 后续 unmount/commit
  // 的 removeChild 会抛 NotFoundError（"node to be removed is not a child"）
  unmountChatOrb();
  chatStreamEl = null;
  chatStreamText = '';
  floatPlacedImages = [];
  const body = chatWin.querySelector('.cw-body');
  disposeChatCharts(body);
  body.innerHTML =
    '<div class="cw-msg ai"><div class="cw-msg-label">SuperCat</div><p>对话上下文已清空。可以继续追问这段内容。</p></div>';
}

/* ================= 聊天窗 DOM ================= */

function buildChatWin() {
  const win = document.createElement('div');
  win.className = 'chat-win';
  win.innerHTML =
    '<div class="cw-head">' +
      '<span class="cw-dot"></span>' +
      '<span class="cw-label">AI 对象</span>' +
      '<div class="cw-actions">' +
        '<button class="cw-btn" data-act="min" title="最小化">&minus;</button>' +
        '<button class="cw-btn" data-act="close" title="关闭">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div class="cw-ctx">' +
      '<div class="cw-ctx-head"><button class="cw-ctx-toggle" title="展开/收起">展开</button></div>' +
      '<div class="cw-ctx-body"></div>' +
    '</div>' +
    '<div class="cw-body"></div>' +
    '<div class="cw-input">' +
      '<div class="ci-wrap"><input type="text" placeholder="继续追问这段内容…（Enter 发送）"></div>' +
      '<button class="cw-send" title="发送">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>' +
      '</button>' +
    '</div>';
  win.querySelector('.cw-head').addEventListener('mousedown', (e) => {
    if (e.target.closest('.cw-btn')) return;
    if (isChatResizeEdge(win, e)) return;
    dragChatWin(e);
  });
  win.querySelector('[data-act="min"]').addEventListener('click', () => {
    const min = win.classList.toggle('cw-min');
    // 兼容手动 resize：最小化时强制 40px，恢复时还原用户拖出的尺寸
    if (min) win.style.maxHeight = '40px';
    else if (win._resized) win.style.maxHeight = 'none';
  });
  win.querySelector('[data-act="close"]').addEventListener('click', () => closeChatWindow());
  win.querySelector('.cw-send').addEventListener('click', () => {
    if (chatBusy) stopChat();
    else sendChatMessage();
  });
  win.querySelector('.cw-input input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  bindChatResize(win);
  win.querySelector('.cw-ctx-toggle').addEventListener('click', (e) => {
    const body = win.querySelector('.cw-ctx-body');
    // 成熟方案：WAAPI 高度动画（原生 API，任意 easing，无测量库依赖）——
    // 先量当前高 → 切换 clamp → 量目标高 → spring 非线性过渡
    const from = body.getBoundingClientRect().height;
    body.classList.toggle('expanded');
    const to = body.getBoundingClientRect().height;
    if (from !== to) {
      body.animate(
        [{ height: from + 'px' }, { height: to + 'px' }],
        { duration: 280, easing: 'cubic-bezier(0.34, 1.25, 0.64, 1)' },
      );
    }
    e.currentTarget.textContent = body.classList.contains('expanded') ? '收起' : '展开';
  });
  document.body.appendChild(win);
  return win;
}

function dragChatWin(e) {
  const sx = e.clientX, sy = e.clientY;
  const il = chatWin.offsetLeft, it = chatWin.offsetTop;
  const onMove = (ev) => {
    const maxL = Math.max(8, window.innerWidth - chatWin.offsetWidth - 8);
    chatWin.style.left = Math.min(Math.max(8, il + ev.clientX - sx), maxL) + 'px';
    chatWin.style.top = Math.min(Math.max(8, it + ev.clientY - sy), window.innerHeight - 60) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

/* ================= 全文提取（EXTRACT_CONTENT / SCROLL_COLLECT 用） =================
   让「采集本页」/ AI read_current_page / collect_content 在阅读器页可用：
   content script 不会注入 chrome-extension:// 页面，但阅读器自己知道当前文档，
   直接把全文吐给 SW 的提取管线（走 AI 摘要入库）。 */

let cachedFullText = '';     // 懒缓存：同一文档只提取一次（大 PDF 逐页取字较慢）
let cachedDocSignature = ''; // docUrl|docTitle|docKind，文档变化即失效
let cachedPageOffsets = null; // PDF 页偏移，随 EXTRACT_CONTENT 回给 page-data（给工作区当锚点）
let cachedPageCount = 0;

// 文档就绪信号：AI 常在 manage_tabs(open) 后立刻 read_tab，此时 PDF 可能还没解析完
// （pdfDoc 为 null → extractPdfText 返回空 → 调用方看到「无法提取内容」）。
// EXTRACT_CONTENT 先等这个 promise，再抽全文。
let docReady = null;
let resolveDocReady = null;

function beginDocLoad() {
  if (docReady && resolveDocReady) return; // 已有一次加载在进行
  docReady = new Promise((r) => { resolveDocReady = r; });
}

function endDocLoad() {
  if (resolveDocReady) { resolveDocReady(); resolveDocReady = null; }
}

async function extractPdfText() {
  if (!pdfDoc) return '';
  const parts = [];
  const pageOffsets = [];
  let cursor = 0;
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
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
    // 与 doc-import.js 同口径：+2 是 join('\n\n') 的分隔符宽度，偏移必须能切回全文
    pageOffsets.push({ page: p, start: cursor, end: cursor + text.length });
    cursor += text.length + 2;
  }
  cachedPageOffsets = pageOffsets;
  cachedPageCount = pdfDoc.numPages;
  return parts.join('\n\n');
}

async function extractSheetText() {
  if (!sheetWb) return '';
  const names = visibleSheetNames(sheetWb);
  const parts = [];
  for (const name of names) {
    const ws = sheetWb.Sheets[name];
    if (!ws) continue;
    patchFormulaDisplay(ws);
    const csv = (xlsxUtils.sheet_to_csv(ws, { blankrows: false }) || '').trim();
    parts.push('【工作表：' + name + '】\n' + csv);
  }
  return parts.join('\n\n');
}

async function extractDocxText() {
  const wrap = viewerEl.querySelector('.docx-wrap');
  if (!wrap) return '';
  return (wrap.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractDocFullText() {
  // 编辑模式：直接返回编辑器当前内容（AI 上下文与实际编辑状态一致）
  if (editMode) {
    if (editKind === 'xlsx' && sheetsEditorMod) return sheetsEditorMod.sheetsText();
    if (editKind === 'docx' && docxEditRenderEl) return docxEditRenderEl.innerText || '';
  }
  const sig = docUrl + '|' + docTitle + '|' + docKind;
  if (cachedFullText && cachedDocSignature === sig) return cachedFullText;
  cachedPageOffsets = null; // 换文档时清掉上一份 PDF 的页偏移，避免张冠李戴
  cachedPageCount = 0;
  let text = '';
  if (docKind === 'pdf') text = await extractPdfText();
  else if (docKind === 'docx' || docKind === 'doc' || docKind === 'md' || docKind === 'txt') text = await extractDocxText();
  else text = await extractSheetText(); // xlsx / csv
  cachedFullText = text;
  cachedDocSignature = sig;
  return text;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;
  // manage_tabs(list) 绝不能触发 PDF 全文提取，否则大文档会把「Managing tabs…」卡死。
  if (message.type === 'EXTRACT_SNAPSHOT') {
    try {
      const snippet = (cachedFullText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      sendResponse({
        title: docTitle || document.title || '',
        pageType: 'article',
        snippet: snippet || `[阅读器 ${docKind || 'doc'}] ${docTitle || ''}`.trim(),
      });
    } catch (err) {
      sendResponse({ title: docTitle || document.title || '', pageType: 'article', snippet: '', error: err.message || String(err) });
    }
    return false;
  }
  if (message.type !== 'EXTRACT_CONTENT' && message.type !== 'SCROLL_COLLECT' && message.type !== 'RASTERIZE_CHART') return false;
  // SW 代跑图表光栅化（浮动聊天在 SW 侧，没有 DOM）
  if (message.type === 'RASTERIZE_CHART') {
    rasterizeChartOption(message.option, { width: message.width, height: message.height }).then((r) => {
      if (r && r.ok) sendResponse({ ok: true, dataUrl: r.dataUrl, width: r.width, height: r.height });
      else sendResponse({ ok: false, error: (r && r.error) || '光栅化失败' });
    }).catch((err) => sendResponse({ ok: false, error: (err && err.message) || String(err) }));
    return true; // 异步回包
  }
  // 等文档就绪（上限 15s，留出抽取时间给调用方的 TAB_READ_MS=20s）：
  // 大 PDF 解析期间调用方不该拿到空正文
  const ready = docReady
    ? Promise.race([docReady, new Promise((r) => setTimeout(r, 15000))])
    : Promise.resolve();
  ready.then(() => extractDocFullText()).then((text) => {
    sendResponse({
      title: docTitle || document.title || '',
      content: text || '',
      pageType: 'article',
      mode: 'text',
      // PDF 页偏移：page-data 透传给工作区，read_section(page=N) 靠它
      pageOffsets: cachedPageOffsets || undefined,
      pageCount: cachedPageCount || undefined,
    });
  }).catch((err) => {
    sendResponse({ title: docTitle || '', content: '', error: err.message || String(err) });
  });
  return true; // 异步响应
});

/* ================= 编辑模式（xlsx / docx，仅用户手动改表时用） =================
   侧边栏入库文档「预览」打开本页（?doc=<docId>）。AI 的 doc_edit / doc_review
   由 SW 无头引擎改库内原件，**不必点「编辑」**；本页「编辑」只给用户自己改 xlsx。
   「保存」下载回本地并写回库内原件。 */

const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const doneBtn = document.getElementById('doneBtn');
const chatBtn = document.getElementById('chatBtn');
const editorHost = document.getElementById('editorHost');

async function enterEditMode() {
  if (editMode) return;
  if (docKind !== 'xlsx' && docKind !== 'docx') return;
  // 编辑容器准备
  editorHost.hidden = false;
  viewerEl.hidden = true;
  hideSelectionBar();
  showStatus('正在打开编辑器…');
  try {
    if (docKind === 'xlsx') {
      sheetsEditorMod = await import('../lib/doc-edit-sheets.js');
      await sheetsEditorMod.initSheetsEditor(editorHost, currentAb);
      sheetsEditorMod.onSheetsSelectionChange(() => refreshChatContext());
    } else {
      // docx：引擎在 SW（doc-edit-service），阅读器只负责渲染 + 修订面板 + 保存。
      // 进入编辑视图前取库内最新原件（AI 可能在后台已改过）
      if (libDocId) {
        try {
          const fresh = await getDocFile(libDocId);
          if (fresh) currentAb = fresh;
        } catch (_) {}
      }
      docxEditRenderEl = document.createElement('div');
      docxEditRenderEl.className = 'docx-edit-render';
      editorHost.appendChild(docxEditRenderEl);
      await renderDocx(currentAb, docxEditRenderEl, null, { renderChanges: true, ignoreLastRenderedPageBreak: true });
      ensureReviewPanel();
      await renderReviewPanel();
    }
    editMode = true;
    editKind = docKind;
    editBtn.hidden = true;
    saveBtn.hidden = false;
    doneBtn.hidden = false;
    chatBtn.hidden = false;
    updateBarForMode();
    announceReaderSession('editing');
    showStatus(docKind === 'docx' ? '编辑模式：修改直接写入文档；要求留痕时，修订可在此逐条接受或拒绝' : '编辑模式：可直接编辑，或选中后让 AI 帮你改');
  } catch (err) {
    editorHost.hidden = true;
    viewerEl.hidden = false;
    console.error('[SuperCat reader] 编辑器初始化失败:', err);
    showStatus('编辑器打开失败: ' + (err.message || String(err)), 6000);
  }
}

async function exitEditMode(confirmIfDirty = true) {
  // docx 的每次 AI 编辑已由 SW 引擎即时持久化，无本地未保存状态；只有 xlsx（Univer 本地引擎）需要确认
  const dirty = editMode && !!(sheetsEditorMod && sheetsEditorMod.isDirty());
  if (confirmIfDirty && dirty) {
    // 不用 window.confirm：扩展页面环境下可能弹不出导致主线程卡死（保存/完成全部失灵）
    const keep = await confirmDialog('有未保存的修改，放弃并退出编辑吗？');
    if (!keep) return false;
  }
  if (sheetsEditorMod) { sheetsEditorMod.disposeSheetsEditor(); sheetsEditorMod = null; }
  if (docxEditRenderEl) { docxEditRenderEl.remove(); docxEditRenderEl = null; }
  reviewPanel = null; // 编辑视图容器已清空（含修订面板 DOM）
  editMode = false;
  editKind = '';
  editorHost.hidden = true;
  viewerEl.hidden = false;
  editBtn.hidden = !(docKind === 'xlsx' || docKind === 'docx');
  saveBtn.hidden = true;
  doneBtn.hidden = true;
  chatBtn.hidden = true;
  updateBarForMode();
  // 重新渲染只读视图（用编辑器导出的最新内容；无修改则原样重渲染）
  if (currentAb) {
    try {
      await loadArrayBuffer(docTitle, currentAb, docUrl);
    } catch (err) {
      console.error('[SuperCat reader] 退出编辑后重渲染失败:', err);
    }
  }
  return true;
}

/** 自定义确认弹层（替代 window.confirm：扩展页面环境更可控，风格统一） */
function confirmDialog(message, { okLabel = '确定', cancelLabel = '取消' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'rd-confirm-overlay';
    overlay.innerHTML =
      '<div class="rd-confirm">' +
        '<div class="rd-confirm-msg">' + String(message).replace(/</g, '&lt;') + '</div>' +
        '<div class="rd-confirm-actions">' +
          '<button class="rd-btn" data-act="cancel">' + cancelLabel + '</button>' +
          '<button class="rd-btn rd-btn-primary" data-act="ok">' + okLabel + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="ok"]').focus();
    const done = (val) => { overlay.remove(); resolve(val); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(false);
      else if (e.target.closest('[data-act="cancel"]')) done(false);
      else if (e.target.closest('[data-act="ok"]')) done(true);
    });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(false); });
  });
}

/** 保存：导出当前内容 -> 下载回本地 + 写回库内原件（?doc= 打开时）。返回是否成功 */
async function saveEdit() {
  if (!editMode) return false;
  saveBtn.disabled = true;
  try {
    let ab;
    if (editKind === 'xlsx') {
      if (!sheetsEditorMod) throw new Error('编辑器未初始化');
      ab = sheetsEditorMod.exportSheetsXlsx();
    } else {
      // docx：引擎在 SW。先确认未处理修订（Word 原生痕迹可带痕迹保存，不强制落定）
      const revs = await fetchRevList();
      const pending = revs.filter((r) => r.status === 'pending').length;
      if (pending > 0) {
        const ok = await confirmDialog(`还有 ${pending} 条 AI 修订未处理。\n「确定」= 带修订痕迹保存（Word 中可继续审阅）\n「取消」= 返回逐条处理后再保存`);
        if (!ok) return false;
      }
      if (!libDocId) {
        // 远程打开的 docx（无库内原件）：只能下载当前渲染的原件
        ab = currentAb;
      } else {
        const r = await chrome.runtime.sendMessage({ type: 'DOC_EXPORT', data: { docId: libDocId } }).catch(() => null);
        if (!r || !r.ok) throw new Error((r && r.error) || '导出失败');
        // SW 已写回 doc-store；字节不能走 sendMessage 响应（JSON 序列化会把
        // ArrayBuffer 变 {}），这里从共享 IDB 直读最新版本
        ab = await getDocFile(libDocId);
        if (!ab) throw new Error('库内原件读取失败');
      }
    }
    // 下载回本地
    const base = (docTitle || 'document').replace(/\.(xlsx|docx)$/i, '');
    const blob = new Blob([ab], { type: editKind === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = base + '_编辑版.' + editKind;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    // 同步内存原件：退出编辑重渲染时用的是编辑后的内容，而不是旧文件
    currentAb = ab;
    // 写回库内原件（?doc= 打开时；docx 的 IDB 写回与全文更新已由 SW 完成，这里幂等）
    if (libDocId && editKind === 'xlsx') {
      await saveDocFile(libDocId, ab);
      try {
        const text = sheetsEditorMod.sheetsText();
        const { currentProject = 'default' } = await chrome.storage.sync.get('currentProject');
        const entries = await getEntries(currentProject);
        const entry = entries.find((e) => e.id === libDocId);
        if (entry) {
          await updateEntry(libDocId, { fullText: text || entry.fullText }, currentProject);
        }
      } catch (_) {}
    }
    showStatus('已保存：下载回本地' + (libDocId ? '，并已更新库内副本' : ''));
    return true;
  } catch (err) {
    console.error('[SuperCat reader] 保存失败:', err);
    showStatus('保存失败: ' + (err.message || String(err)), 6000);
    return false;
  } finally {
    saveBtn.disabled = false;
  }
}

/** 编辑工具执行入口（仅 xlsx 到达阅读器：docx 由 SW 引擎直接执行，见 doc-edit-service） */
async function execDocEdit(tool, args) {
  if (!editMode) {
    return {
      ok: false,
      error: 'xlsx/docx 请在聊天中调用 doc_edit（传 doc_id），后台直接改库内原件，无需在阅读器点「编辑」',
    };
  }
  // export：走与用户点「保存」相同的完整流程（含未定修订确认弹窗、下载、写回库内）
  if (tool === 'export') {
    const saved = await saveEdit();
    return saved
      ? { ok: true, summary: '已保存：下载回本地' + (libDocId ? '，并已更新库内副本' : '') }
      : { ok: false, error: '保存未完成（可能取消了修订确认弹窗或导出失败，详情见阅读器页状态栏）' };
  }
  if (editKind === 'xlsx' && sheetsEditorMod) {
    return sheetsEditorMod.execSheetsTool(tool, args || {});
  }
  return { ok: false, error: 'docx 编辑由后台引擎执行：直接在聊天中调用 doc_edit 即可，无需阅读器编辑模式' };
}

/* ---------- 审阅修订（doc_review）：修订面板 UI（引擎在 SW，操作走消息） ---------- */

let reviewPanel = null;

function escRv(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** 从 SW 引擎拉修订清单（doc_review list_revisions） */
async function fetchRevList() {
  if (!libDocId) return [];
  const r = await chrome.runtime.sendMessage({ type: 'DOC_REVIEW', data: { tool: 'list_revisions', args: { doc_id: libDocId } } }).catch(() => null);
  return (r && r.ok && Array.isArray(r.revisions)) ? r.revisions : [];
}

/** 工具栏「待审 N」徽标（建议 A）：docx 打开时与 DOC_UPDATED 后刷新，只读/编辑模式都显示 */
const revBadgeEl = document.getElementById('revBadge');
async function updateRevBadge() {
  if (!revBadgeEl) return;
  if (!libDocId || docKind !== 'docx') { revBadgeEl.hidden = true; return; }
  try {
    const revs = await fetchRevList();
    const pending = revs.filter((r) => r.status === 'pending').length;
    revBadgeEl.hidden = pending === 0;
    revBadgeEl.textContent = pending > 0 ? `待审 ${pending}` : '';
  } catch (_) {
    revBadgeEl.hidden = true;
  }
}

async function applyReviewAction(act, args) {
  const r = await chrome.runtime.sendMessage({ type: 'DOC_REVIEW', data: { tool: act, args: { ...(args || {}), doc_id: libDocId } } }).catch(() => null);
  await renderReviewPanel();
  if (r && r.ok) showStatus('修订：' + (r.summary || act));
  else if (r && !r.ok) showStatus('修订操作失败: ' + (r.error || String(act)), 4000);
}

/** 面板点击定位：引擎在 SW 无法直接滚动，按修订在列表中的位次对应渲染 DOM 的 ins/del 序 */
async function focusRevisionDom(rid) {
  if (!docxEditRenderEl) return;
  const items = await fetchRevList();
  const idx = items.findIndex((r) => r.id === rid); // 修订 id 已是稳定 w:id，位次需按列表算
  if (idx < 0) return;
  const domEls = docxEditRenderEl.querySelectorAll('ins, del');
  const dom = domEls[idx];
  if (dom) {
    dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dom.classList.add('rev-flash');
    setTimeout(() => dom.classList.remove('rev-flash'), 1600);
  }
}

async function renderReviewPanel() {
  if (!reviewPanel) return;
  const items = await fetchRevList();
  const pending = items.filter((r) => r.status === 'pending').length;
  reviewPanel.querySelector('.rp-count').textContent = pending > 0 ? `${pending}/${items.length} 待处理` : `${items.length} 条（无待处理）`;
  reviewPanel.querySelector('.rp-accept-all').disabled = pending === 0;
  reviewPanel.querySelector('.rp-reject-all').disabled = pending === 0;
  const listEl = reviewPanel.querySelector('.rp-list');
  if (!items.length) {
    listEl.innerHTML = '<div class="rp-empty">暂无待审修订。普通修改已直接写入文档，对话里能看到改了什么。只有要求留痕时，修订才会出现在这里。</div>';
    return;
  }
  listEl.innerHTML = items.map((r) => {
    const label = r.type === 'replace' ? '替换' : (r.type === 'insert' ? '插入' : '删除');
    const desc = r.type === 'insert'
      ? `<div class="rp-ins">${escRv(r.replacement)}</div>`
      : (r.type === 'replace'
        ? `<div class="rp-del">${escRv(r.find)}</div><div class="rp-arrow">→</div><div class="rp-ins">${escRv(r.replacement)}</div>`
        : `<div class="rp-del">${escRv(r.find)}</div>`);
    const statusHtml = r.status === 'pending'
      ? `<span class="rp-actions"><button class="rp-ok" data-act="accept">接受</button><button class="rp-no" data-act="reject">拒绝</button></span>`
      : `<span class="rp-status">${r.status === 'accepted' ? '已接受' : '已拒绝'}</span>`;
    return `
      <div class="rp-item rp-${r.status}" data-rid="${r.id}">
        <div class="rp-item-head">
          <span class="rp-badge">#${r.id} ${label}</span>
          ${statusHtml}
        </div>
        <div class="rp-desc">${desc}</div>
        ${r.note ? `<div class="rp-note">${escRv(r.note)}</div>` : ''}
      </div>`;
  }).join('');
  listEl.querySelectorAll('.rp-item').forEach((el) => {
    const rid = Number(el.dataset.rid);
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) { e.stopPropagation(); applyReviewAction(act, { id: rid }); return; }
      focusRevisionDom(rid);
    });
  });
}

function ensureReviewPanel() {
  if (reviewPanel) return;
  // 修订痕迹样式：引擎的 ensureRenderStyle 已随引擎迁到 SW，阅读器侧自带一份
  if (!document.getElementById('citecat-rev-style')) {
    const st = document.createElement('style');
    st.id = 'citecat-rev-style';
    st.textContent = `
      .docx-edit-render ins { color: #16a34a; text-decoration: underline; text-underline-offset: 2px; }
      .docx-edit-render del { color: #dc2626; text-decoration: line-through; }
      .docx-edit-render .rev-flash { background: rgba(250, 204, 21, .45); border-radius: 2px; transition: background 1.2s; }
    `;
    document.head.appendChild(st);
  }
  reviewPanel = document.createElement('div');
  reviewPanel.className = 'review-panel';
  reviewPanel.innerHTML = `
    <div class="rp-head">
      <span class="rp-title">修订</span>
      <span class="rp-count"></span>
      <span class="rp-spacer"></span>
      <button class="rp-btn rp-accept-all" title="接受全部修订">全部接受</button>
      <button class="rp-btn rp-reject-all" title="拒绝全部修订">全部拒绝</button>
      <button class="rp-btn rp-toggle" title="收起/展开">▾</button>
    </div>
    <div class="rp-list"></div>`;
  reviewPanel.querySelector('.rp-accept-all').addEventListener('click', () => applyReviewAction('accept', { id: 'all' }));
  reviewPanel.querySelector('.rp-reject-all').addEventListener('click', () => applyReviewAction('reject', { id: 'all' }));
  reviewPanel.querySelector('.rp-toggle').addEventListener('click', () => {
    reviewPanel.classList.toggle('collapsed');
    reviewPanel.querySelector('.rp-toggle').textContent = reviewPanel.classList.contains('collapsed') ? '▸' : '▾';
  });
  editorHost.appendChild(reviewPanel);
  renderReviewPanel();
}

/** SW 引擎编辑后内容变化：重新渲染（修订痕迹随之可见），编辑模式顺带刷新修订面板 */
let docRefreshTimer = 0;
function scheduleDocRefresh() {
  clearTimeout(docRefreshTimer);
  docRefreshTimer = setTimeout(async () => {
    if (!libDocId || (docKind !== 'docx' && docKind !== 'xlsx' && docKind !== 'txt' && docKind !== 'doc')) return;
    try {
      const ab = await getDocFile(libDocId);
      if (!ab) return;
      currentAb = ab;
      const sniffed = resolveKind(docTitle, ab);
      if (docKind === 'doc' && sniffed === 'docx') {
        docKind = 'docx';
        docTitle = String(docTitle || 'document').replace(/\.doc$/i, '.docx');
        fileNameEl.textContent = docTitle;
        formatBadge.textContent = KIND_LABEL.docx;
        editBtn.hidden = false;
        viewerEl.innerHTML = '';
        await renderDocxDoc(ab);
        updateRevBadge();
        return;
      }
      if (docKind === 'txt') {
        viewerEl.innerHTML = '';
        await renderPlainText(ab, 'txt');
        return;
      }
      if (docKind === 'xlsx') {
        if (editMode && sheetsEditorMod) {
          sheetsEditorMod.disposeSheetsEditor();
          await sheetsEditorMod.initSheetsEditor(editorHost, ab);
        } else {
          viewerEl.innerHTML = '';
          await renderSheet(ab, 'xlsx');
        }
        return;
      }
      if (editMode && docxEditRenderEl) {
        await renderDocx(ab, docxEditRenderEl, null, { renderChanges: true, ignoreLastRenderedPageBreak: true });
        await renderReviewPanel();
      } else {
        viewerEl.innerHTML = '';
        await renderDocxDoc(ab);
      }
      updateRevBadge();
    } catch (_) {}
  }, 250);
}

/** SW 触发下载（AI doc_edit(tool=export) 后）：下载库内最新原件 */
async function downloadCurrentDocx() {
  const ab = await getDocFile(libDocId);
  if (!ab) throw new Error('库内原件不存在');
  currentAb = ab;
  const isXlsx = docKind === 'xlsx';
  const base = (docTitle || 'document').replace(/\.(docx|xlsx)$/i, '');
  const blob = new Blob([ab], {
    type: isXlsx
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = base + (isXlsx ? '_编辑版.xlsx' : '_编辑版.docx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showStatus(isXlsx ? '已下载最新版表格' : '已下载最新版（含修订痕迹）');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;
  if (message.type === 'DOC_UPDATED') {
    // docx 内容变化（SW 引擎编辑后广播）：正在看该文档就刷新
    if (message.docId && libDocId === message.docId && (docKind === 'docx' || docKind === 'xlsx' || docKind === 'txt' || docKind === 'doc')) scheduleDocRefresh();
    return false;
  }
  if (message.type === 'DOC_EXPORT_DOWNLOAD') {
    // AI 触发导出后，SW 让阅读器完成下载动作
    downloadCurrentDocx()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
  if (message.type === 'DOC_EDIT') {
    // 侧栏用 chrome.runtime.sendMessage 发 DOC_EDIT，扩展里每个页面都会收到。
    // 阅读器若在这里 sendResponse，会抢在后台写入完成之前把
    // 「请在聊天里调用 doc_edit」送回去：文件已经改了，调用方却拿到失败。
    // doc_edit 只由 service worker 回执。
    return false;
  }
  return false;
});

/* ================= 初始化 ================= */

function init() {
  createFloatUi();
  chatWin = buildChatWin();

  // 编辑模式按钮
  editBtn.addEventListener('click', enterEditMode);
  saveBtn.addEventListener('click', saveEdit);
  doneBtn.addEventListener('click', () => exitEditMode(true));
  chatBtn.addEventListener('click', () => openChatWindow());
  editBtn.hidden = true;
  saveBtn.hidden = true;
  doneBtn.hidden = true;
  chatBtn.hidden = true;

  const params = new URLSearchParams(location.search);
  const remote = params.get('url');
  if (remote) {
    // 网页 PDF 自动接管：远程文档
    loadRemote(remote);
    return;
  }
  const docId = params.get('doc');
  if (docId) {
    // 库内文档：从 IndexedDB 取原件渲染
    libDocId = docId;
    const name = params.get('name') || 'document';
    getDocFile(docId).then((ab) => {
      if (!ab) {
        showStatus('库中未找到文档原件（可能已被删除）', 6000);
        return;
      }
      loadArrayBuffer(name, ab, 'doc://lib/' + docId);
    }).catch((err) => showStatus('读取库内文档失败: ' + (err.message || String(err)), 6000));
  }
}

init();
