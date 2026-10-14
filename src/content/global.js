/* ---- Citecat content script ---- */

import { Readability } from '@mozilla/readability';
import {
  MAX_TEXT_LENGTH, TEXT_BLOCK_SELECTOR, openAllDetails,
  extractByScoredBlocks, extractPublishedDateFromDoc,
} from '../lib/extract-common.js';
import {
  normalizeUrl, getAnnotationsForUrl, saveAnnotation,
  setAnnotationEntryId, deleteAnnotation,
} from '../lib/annotations.js';
// 共享标注逻辑（与文档阅读器同一实现）：
// mark 包裹 / TextQuoteSelector 锚点定位 / 标注重放 / snippet 收藏
import {
  makeAnnId, quoteContext, wrapRangeWithMark, unwrapMarks, cssPath,
  injectAnnotationStyles, createTextAnnotation as createTextAnnotationCore,
  collectTextSnippet as collectTextSnippetCore,
  collectAnnotationAsSnippet as collectAnnotationAsSnippetCore,
  replayAnnotations as replayAnnotationsCore,
  findAnnotationRange,
  insertAnnotationNoteBlock, removeAnnotationNoteBlock,
} from '../lib/doc-marks.js';
import { FLOAT_UI_CSS } from '../lib/float-css.js';
import { bindChatResize, isChatResizeEdge } from '../lib/chat-win-resize.js';
import { THEME_KEY, loadThemeMode, normalizeThemeMode, resolveTheme } from '../lib/theme.js';
// thinking-orbs / react-dom 含 `'animation' in div.style`，XML/RSS 页 style 为 undefined 会直接抛。
// 改为打开浮动聊天时再动态 import（build 侧 inlineDynamicImports，仍打成单文件）。
import { ORB_STATE_BY_TOOL } from '../lib/orb-state.js';
import { upsertSubagentCardEl, syncLiveTurnOrder } from '../lib/subagent-ui.js';
import { attachScopeQuiz } from '../lib/scope-quiz.js';
import { appendChartsTo, disposeChatCharts, rasterizeChartOption } from '../lib/chat-charts.js';
import { upsertPlanCardEl } from '../lib/plan.js';
import { upsertDocEditsCardEl } from '../lib/doc-edits.js';

// Alias for backwards compatibility within this file
const extractPublishedDate = extractPublishedDateFromDoc;

function safeSendMessage(msg) {
  if (!chrome.runtime?.id) {
    return Promise.reject(new Error('Extension context invalidated'));
  }
  return chrome.runtime.sendMessage(msg);
}

async function requireLicense() {
  try {
    const r = await safeSendMessage({ type: 'GET_LICENSE_STATE' });
    if (r && r.ok) return true;
    showMiniToast((r && r.error) || '未激活许可证，请在侧栏输入授权码');
  } catch (_) {
    showMiniToast('未激活许可证，请在侧栏输入授权码');
  }
  return false;
}


function extractPageContent() {
  try {
    const doc = document.cloneNode(true);
    try { doc.querySelectorAll('details').forEach((d) => { d.open = true; }); } catch (_) {}

    // Readability + scored blocks
    const article = new Readability(doc).parse();
    if (article && article.textContent && article.textContent.trim().length >= 20) {
      const publishedAt = extractPublishedDate(document);
      const text = article.textContent.trim();
      const scored = extractByScoredBlocks(document, publishedAt);
      if (scored && scored.content.length >= 80 && scored.content.length < text.length * 0.85) return scored;
      return {
        title: article.title || document.title || '',
        content: text.slice(0, MAX_TEXT_LENGTH),
        publishedAt,
      };
    }
  } catch (_) { /* fall through */ }

  // Scored blocks fallback
  const scored = extractByScoredBlocks(document, extractPublishedDate(document));
  if (scored && scored.content.length >= 80) return scored;

  // Last resort: grab full page innerText (includes dynamically loaded SPA content)
  const bodyText = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  if (bodyText.length >= 50) {
    return {
      title: document.title || '',
      content: bodyText.slice(0, MAX_TEXT_LENGTH),
      publishedAt: extractPublishedDate(document),
    };
  }

  return null;
}

/* ======================================================================
 * Structured Markdown extraction — for data-dense pages (dashboards,
 * tables, charts, card layouts) where Readability's flat text loses all
 * structure (column headers, card boundaries, axis labels).
 *
 * Two modes are supported by EXTRACT_CONTENT:
 *   format: 'text'      -> legacy extractPageContent() (default)
 *   format: 'markdown'  -> this structured extractor
 *   format: 'auto'      -> pick markdown when the page looks data-heavy
 * ====================================================================== */

// CJK/西文之间自动加空格，避免 "去设置¥8.66CNY" 粘连成无分隔文本。
// 只处理紧邻边界（已有空格的不会重复加）。
function addCjkSpacing(text) {
  const CJK = '\\u4e00-\\u9fff\\u3040-\\u30ff';
  const LATIN = 'A-Za-z0-9\\u00a5\\uffe5$\\u20ac\\u00a3';
  return text
    .replace(new RegExp(`([${CJK}])([${LATIN}])`, 'g'), '$1 $2')
    .replace(new RegExp(`([${LATIN}])([${CJK}])`, 'g'), '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/[ \t]{2,}/g, ' ');
}

const INLINE_ELEMENT_TAGS = new Set([
  'a', 'span', 'strong', 'em', 'b', 'i', 'u', 'code', 'small', 'label', 'time',
  'sub', 'sup', 'mark', 'del', 'ins', 'abbr', 'cite', 'q', 'kbd', 'samp', 'var',
]);

function isNoiseElement(el) {
  const tag = el.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed', 'link', 'meta', 'svg'].includes(tag)) return true;
  if (tag === 'nav') return true;
  if (tag === 'footer') return true;
  // 页面级 header（不在 article/main 里）当作导航噪音；卡片内部 header 保留
  if (tag === 'header' && !el.closest('article, main')) return true;
  if (el.hasAttribute('hidden')) return true;
  if (el.getAttribute('aria-hidden') === 'true') return true;
  const role = (el.getAttribute('role') || '').toLowerCase();
  if (['navigation', 'banner', 'contentinfo', 'dialog', 'tooltip', 'menu', 'menubar', 'alert', 'status'].includes(role)) return true;
  const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const hay = `${cls} ${id}`;
  if (/(cookie|consent|popup|modal|tooltip|toast|notification|drawer|sidebar|side-bar|breadcrumb|pagination|advert|ads?[\s_-]|share|social|copyright|related|recommend)/i.test(hay)) return true;
  // 页面级 header/footer class（排除 card/panel 内的区块标题，如 card-header）
  if (/(^|[\s_-])header([\s_-]|$)/i.test(hay) && !/(card|panel|section)/i.test(hay)) return true;
  if (/(^|[\s_-])footer([\s_-]|$)/i.test(hay) && !/(card|panel|section)/i.test(hay)) return true;
  return false;
}

function isVisibleElement(el) {
  try {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  } catch (_) {
    return false;
  }
  return true;
}

// 检测图表容器：ECharts 在容器上挂 _echarts_instance_ 属性；Chart.js 用 canvas。
function detectChartInfo(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'canvas') {
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    if (/(chart|echart|chartjs|dashboard|graph|plot|sparkline)/i.test(cls)) return 'canvas 图表';
    return null;
  }
  if (el.hasAttribute('_echarts_instance_')) return 'ECharts';
  if ((typeof el.className === 'string') && /(^|[\s_-])(echart|echarts|chart|charts)([\s_-]|$)/i.test(el.className) && el.querySelector('canvas, svg')) {
    return '图表';
  }
  return null;
}

// ---- 页面类型检测（article | list | dashboard | form）----
// 供 read_current_page 结构化路由：dashboard/list 页返回 KV/数组结构化数据，
// article 才走正文提取。判定为启发式，AI 拿不准时仍可读全文再判断。
// 判定顺序：dashboard 强信号 → form → **正文特征（标题+段落）优先于 li 密度**
// （MDN 等文章页的正文列表 li 密集，但 h1/p 特征显著，必须判 article 而非 list）。
function detectPageType() {
  const hasVisible = (els) => {
    for (const el of els) {
      if (el && isVisibleElement(el)) return true;
    }
    return false;
  };
  // dashboard：可见表格 / 图表容器 / 3+ 个指标卡片（强信号，优先）
  if (hasVisible(document.querySelectorAll('table'))) return 'dashboard';
  if (hasVisible(document.querySelectorAll('[_echarts_instance_], [class*="echarts" i], canvas[class*="chart" i], canvas[class*="dashboard" i]'))) return 'dashboard';
  const cards = document.querySelectorAll('[class*="card" i], [class*="stat" i], [class*="metric" i], [class*="dashboard" i]');
  let visibleCards = 0;
  for (const c of cards) { if (isVisibleElement(c)) visibleCards++; }
  if (visibleCards >= 3) return 'dashboard';
  // form：可见表单控件密集（登录/搜索/筛选页）
  let visibleControls = 0;
  for (const c of document.querySelectorAll('form input, form select, form textarea')) {
    if (isVisibleElement(c)) visibleControls++;
  }
  if (visibleControls >= 4) return 'form';
  // 正文特征：h1/h2 标题 + 多个可见段落 → article（优先于 li 密度，防文章页误判 list）
  let headings = 0;
  for (const h of document.querySelectorAll('h1, h2')) {
    if (isVisibleElement(h) && (h.textContent || '').trim().length >= 4) headings++;
  }
  let paras = 0;
  for (const p of document.querySelectorAll('p')) {
    if (isVisibleElement(p) && (p.textContent || '').trim().length >= 40) paras++;
    if (paras >= 3) break;
  }
  if (headings >= 1 && paras >= 3) return 'article';
  // list：可见 li 密集（排除导航/页脚），或重复卡片网格 class
  let visibleLis = 0;
  for (const li of document.querySelectorAll('ul li, ol li')) {
    if (isVisibleElement(li) && !li.closest('nav, footer, aside, header')) visibleLis++;
  }
  if (visibleLis >= 8) return 'list';
  if (findRepeatedCardClass(5)) return 'list';
  return 'article';
}

// 统计可见 div 的重复首 class，用于识别卡片网格 / 重复条目结构。
function findRepeatedCardClass(minCount) {
  const freq = new Map();
  const divs = document.getElementsByTagName('div');
  const n = Math.min(divs.length, 3000);
  for (let i = 0; i < n; i++) {
    const el = divs[i];
    if (!isVisibleElement(el)) continue;
    const cls = typeof el.className === 'string' ? el.className.trim() : '';
    if (!cls) continue;
    const key = cls.split(/\s+/)[0];
    if (!key || key.length > 40) continue;
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  for (const [, count] of freq) {
    if (count >= minCount) return true;
  }
  return false;
}

// ---- 结构化数据提取（dashboard / list 页）----
// 原则：返回「给模型的数据」——表格/卡片/列表转 KV 与数组，禁止拍平成散文。
function parseCellValue(text) {
  const t = (text || '').trim();
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function tableToArray(table) {
  const trs = [...table.querySelectorAll('tr')].slice(0, 200);
  if (!trs.length) return null;
  const grid = [];
  for (const tr of trs) {
    const cells = [...tr.querySelectorAll('th, td')].map((c) => addCjkSpacing(inlineTextOf(c)));
    if (cells.some((c) => c)) grid.push(cells);
  }
  if (!grid.length) return null;
  const maxCols = Math.max(...grid.map((r) => r.length));
  const pad = (r) => { const out = r.slice(); while (out.length < maxCols) out.push(''); return out; };
  const hasHeader = trs[0] && trs[0].querySelector('th') != null;
  const header = hasHeader ? pad(grid[0]) : null;
  const rows = (hasHeader ? grid.slice(1) : grid).slice(0, 200);
  return rows.map((r) => {
    const p = pad(r);
    const obj = {};
    for (let i = 0; i < maxCols; i++) {
      const key = header && header[i] ? header[i] : `col${i + 1}`;
      obj[key] = parseCellValue(p[i]);
    }
    return obj;
  });
}

// 卡片 KV 启发式：label 元素（短文本，非数字）+ 数字/金额/百分比 value 配对。
function extractKvPairs() {
  const out = {};
  const containers = document.querySelectorAll('[class*="card" i], [class*="stat" i], [class*="metric" i], [class*="widget" i], [class*="panel" i], [class*="summary" i], [class*="overview" i]');
  for (const el of containers) {
    if (!isVisibleElement(el)) continue;
    for (const labelEl of el.querySelectorAll('[class*="label" i], [class*="title" i], [class*="name" i], [class*="key" i], [class*="caption" i], dt, label')) {
      if (Object.keys(out).length >= 60) return out;
      const label = addCjkSpacing(inlineTextOf(labelEl));
      if (!label || label.length > 14 || /[\d%¥$￥]/.test(label)) continue;
      if (out[label] !== undefined) continue;
      // value 候选：label 自身含数字 → 自身；否则下一兄弟；再否则父容器内 value 类元素
      let valueEl = /[\d%¥$￥]/.test(addCjkSpacing(inlineTextOf(labelEl))) ? labelEl : null;
      if (!valueEl && labelEl.nextElementSibling) valueEl = labelEl.nextElementSibling;
      if (!valueEl && labelEl.parentElement) {
        valueEl = labelEl.parentElement.querySelector('[class*="value" i], [class*="number" i], [class*="amount" i], [class*="count" i]');
      }
      if (!valueEl || valueEl === labelEl) continue;
      const valueText = addCjkSpacing(inlineTextOf(valueEl));
      if (!valueText || valueText.length > 40 || !/[\d%¥$￥]/.test(valueText)) continue;
      out[label] = parseCellValue(valueText);
    }
  }
  return out;
}

// 列表条目：可见 li / 重复卡片结构 → 短文本数组（去重、限长）。
function extractListItems() {
  const items = [];
  const pushItem = (t) => {
    const s = (t || '').replace(/\s+/g, ' ').trim();
    if (s && s.length >= 2 && s.length <= 200 && !items.includes(s) && items.length < 60) items.push(s);
  };
  for (const ul of document.querySelectorAll('ul, ol')) {
    if (items.length >= 60) break;
    if (!isVisibleElement(ul)) continue;
    if (ul.closest('nav, footer, aside, header')) continue;
    const lis = [...ul.children].filter((c) => c.tagName.toLowerCase() === 'li' && isVisibleElement(c));
    if (lis.length >= 3) for (const li of lis) pushItem(inlineTextOf(li));
  }
  // 重复卡片网格（class 首词频率 ≥5 且带卡片/条目特征）
  if (items.length < 20) {
    const freq = new Map();
    const divs = document.getElementsByTagName('div');
    const n = Math.min(divs.length, 3000);
    for (let i = 0; i < n; i++) {
      const el = divs[i];
      if (!isVisibleElement(el)) continue;
      const cls = typeof el.className === 'string' ? el.className.trim() : '';
      if (!cls) continue;
      const key = cls.split(/\s+/)[0];
      if (!key || key.length > 40) continue;
      if (!freq.has(key)) freq.set(key, []);
      const arr = freq.get(key);
      if (arr.length < 60) arr.push(el);
    }
    for (const [key, els] of freq) {
      if (items.length >= 60) break;
      if (els.length >= 5 && /(card|item|tile|entry|grid|list|result|feed|post|news)/i.test(key)) {
        for (const el of els) pushItem(inlineTextOf(el));
      }
    }
  }
  return items;
}

// dashboard / list 页的 DOM 层结构化数据（tables / kv / items）。
function extractStructuredData() {
  const out = {};
  const tables = [];
  for (const t of document.querySelectorAll('table')) {
    if (!isVisibleElement(t)) continue;
    const arr = tableToArray(t);
    if (arr && arr.length) {
      const caption = t.caption ? addCjkSpacing(inlineTextOf(t.caption)) : '';
      tables.push(caption ? { caption, rows: arr } : { rows: arr });
    }
    if (tables.length >= 20) break;
  }
  if (tables.length) out.tables = tables;
  const kv = extractKvPairs();
  if (kv && Object.keys(kv).length) out.kv = kv;
  const items = extractListItems();
  if (items.length) out.items = items;
  return Object.keys(out).length ? out : null;
}

// 渲染一个元素内部的纯文本（合并子节点、跳过 svg/脚本），用于段落/标题/单元格。
function inlineTextOf(el, depth = 0) {
  if (depth > 12) return '';
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += ' ' + (node.textContent || '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const t = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'template', 'svg'].includes(t)) continue;
      if (t === 'br') { out += ' '; continue; }
      if (t === 'img') { const alt = (node.getAttribute('alt') || '').trim(); if (alt) out += ' ' + alt; continue; }
      out += ' ' + inlineTextOf(node, depth + 1);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

function tableToMarkdown(table) {
  const rows = [...table.querySelectorAll('tr')].slice(0, 100);
  if (rows.length === 0) return null;
  const grid = [];
  for (const tr of rows) {
    const cells = [...tr.querySelectorAll('th, td')];
    if (cells.length === 0) continue;
    grid.push(cells.map((c) => addCjkSpacing(inlineTextOf(c)).replace(/\|/g, '\\|')));
  }
  if (grid.length === 0) return null;
  const maxCols = Math.max(...grid.map((r) => r.length));
  const pad = (r) => { const out = r.slice(); while (out.length < maxCols) out.push(''); return out; };
  const fmtRow = (r) => `| ${pad(r).join(' | ')} |`;
  const hasHeader = rows[0] ? rows[0].querySelector('th') != null : false;
  const lines = [];
  const caption = table.caption ? addCjkSpacing(inlineTextOf(table.caption)) : '';
  if (caption) lines.push(`**${caption}**`);
  lines.push(fmtRow(grid[0]));
  lines.push(`| ${pad(grid[0]).map(() => '---').join(' | ')} |`);
  for (const r of grid.slice(1)) lines.push(fmtRow(r));
  return lines.join('\n');
}

// 核心：把元素渲染为 markdown 块数组（每个元素是一行或一段，块之间由调用方用空行分隔）。
function renderMarkdownBlock(el, depth = 0) {
  if (depth > 40) return [];
  if (isNoiseElement(el)) return [];
  if (!isVisibleElement(el)) return [];

  const tag = el.tagName.toLowerCase();

  const chart = detectChartInfo(el);
  if (chart) return ['> 图表（' + chart + '，数据由 JS 渲染未能提取；如需真实数据可尝试 exec_js_main 读取图表实例的 option）'];

  if (tag === 'table') {
    const md = tableToMarkdown(el);
    return md ? [md] : [];
  }
  if (/^h[1-6]$/.test(tag)) {
    const text = addCjkSpacing(inlineTextOf(el));
    if (!text) return [];
    return [`${'#'.repeat(Number(tag[1]))} ${text}`];
  }
  if (tag === 'pre') {
    const code = (el.textContent || '').replace(/^\n+|\n+$/g, '').trim();
    return code ? ['```\n' + code + '\n```'] : [];
  }
  if (tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'input' && ['submit', 'button'].includes(el.type))) {
    const text = addCjkSpacing(inlineTextOf(el)) || (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('title') || '').trim();
    return text ? [`按钮：${text}`] : [];
  }
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return [];
  if (tag === 'img') {
    const alt = (el.getAttribute('alt') || '').trim();
    return alt ? [`[图片: ${alt}]`] : [];
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = [...el.children].filter((c) => c.tagName.toLowerCase() === 'li');
    return items.map((li, i) => {
      const text = addCjkSpacing(inlineTextOf(li));
      return text ? `${tag === 'ul' ? '-' : `${i + 1}.`} ${text}` : '';
    }).filter(Boolean);
  }

  // 卡片标题 / 区块标题（div.card-header / .card-title / .panel-title 等）→ 提升为 h3 标题标记
  {
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const isCardHeader =
      (/(^|[\s_-])(card|panel|block|widget|section|module|stat|metric|box)([\s_-])(header|title|heading|label)([\s_-]|$)/i.test(cls)) ||
      /(^|[\s_-])(subtitle|section-title|block-title|module-title|widget-title)([\s_-]|$)/i.test(cls);
    if (isCardHeader && !el.querySelector('h1, h2, h3, h4, h5, h6, button, a, table')) {
      const text = addCjkSpacing(inlineTextOf(el));
      if (text && text.length <= 60) return [`### ${text}`];
    }
  }
  if (tag === 'p' || tag === 'li' || tag === 'blockquote' || tag === 'td' || tag === 'th' || tag === 'dt' || tag === 'dd' || tag === 'figcaption' || tag === 'caption') {
    const text = addCjkSpacing(inlineTextOf(el));
    return text ? [tag === 'blockquote' ? `> ${text}` : text] : [];
  }

  // 通用块容器：把连续文本 + 行内元素累积成一个段落，遇到块级子元素则递归并分隔。
  const blocks = [];
  let buf = '';
  const flush = () => {
    const t = addCjkSpacing(buf.replace(/\s+/g, ' ').trim());
    if (t) blocks.push(t);
    buf = '';
  };
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      buf += ' ' + (node.textContent || '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const t = node.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'template', 'svg'].includes(t)) continue;
      if (t === 'br') { buf += ' '; continue; }
      if (t === 'img') { const alt = (node.getAttribute('alt') || '').trim(); if (alt) buf += ' [图片: ' + alt + ']'; continue; }
      if (INLINE_ELEMENT_TAGS.has(t)) {
        if (t === 'a') {
          const cls = typeof node.className === 'string' ? node.className : '';
          const txt = addCjkSpacing(inlineTextOf(node));
          if (!txt) continue;
          buf += (/btn|button|action/i.test(cls) && txt.length <= 15) ? ' 按钮：' + txt : ' ' + txt;
        } else {
          buf += ' ' + inlineTextOf(node);
        }
      } else {
        flush();
        blocks.push(...renderMarkdownBlock(node, depth + 1));
      }
    }
  }
  flush();
  return blocks;
}

// manage_tabs(list) 用的廉价类型判定：禁止 getComputedStyle / 遍历数千节点，
// 否则重型 SPA 会把 EXTRACT_SNAPSHOT 拖成「Managing tabs…」卡死。
function detectPageTypeCheap() {
  try {
    if (document.querySelector('[_echarts_instance_], canvas[class*="chart" i], canvas[class*="echart" i]')) {
      return 'dashboard';
    }
    if (document.querySelector('table tr:nth-child(4)')) return 'dashboard';
    const formControls = document.querySelectorAll('form input, form select, form textarea');
    if (formControls.length >= 4) return 'form';
    if (document.querySelector('ul li:nth-child(12), ol li:nth-child(12)')) return 'list';
    return 'article';
  } catch (_) {
    return 'article';
  }
}

function snapshotTextSnippet(root, maxChars = 160) {
  if (!root) return '';
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let out = '';
    let n = 0;
    while (walker.nextNode() && out.length < maxChars && n < 80) {
      n++;
      const t = (walker.currentNode.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      out += (out ? ' ' : '') + t;
    }
    return out.slice(0, maxChars);
  } catch (_) {
    return '';
  }
}

function buildExtractSnapshot() {
  const title = document.title || '';
  let snippet = '';
  try {
    const meta = document.querySelector('meta[name="description"]');
    const desc = ((meta && meta.getAttribute('content')) || '').replace(/\s+/g, ' ').trim();
    if (desc.length >= 20) snippet = desc.slice(0, 160);
  } catch (_) { /* ignore */ }
  if (!snippet) {
    const root = document.querySelector('article, main, [role="main"]') || document.body;
    snippet = snapshotTextSnippet(root, 160);
  }
  return { title, pageType: detectPageTypeCheap(), snippet };
}

function extractStructuredMarkdown() {
  try {
    const body = document.body;
    if (!body) return null;
    const blocks = [];
    for (const child of body.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = addCjkSpacing((child.textContent || '').replace(/\s+/g, ' ').trim());
        if (t) blocks.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        blocks.push(...renderMarkdownBlock(child));
      }
    }
    const content = blocks.filter((b) => b && b.trim()).join('\n\n').slice(0, MAX_TEXT_LENGTH);
    if (content.trim().length < 20) return null;
    return {
      title: document.title || '',
      content,
      publishedAt: extractPublishedDate(document),
      mode: 'markdown',
    };
  } catch (err) {
    console.warn('[Citecat] structured extraction failed:', err);
    return null;
  }
}

const CB_CLASS = 'tsc-cb';
const LOADING_CLASS = 'tsc-loading';
const DONE_CLASS = 'tsc-done';
const FAIL_CLASS = 'tsc-fail';

let blacklist = [];
let processedResults = new WeakSet();
let pageCollectUrl = location.href;
let pageCollectTitle = document.title || location.href;

const RESULT_SELECTORS = [
  /* DuckDuckGo */
  'article[data-testid="result"]',
  '.result__body',
  /* Google */
  'div.g', 'div[data-sokoban-container]', 'div.MjjYud', 'div.tF2Cxc',
  /* Bing */
  'li.b_algo', 'li.b_ans',
  /* Baidu */
  'div.c-container', 'div.result.c-container',
  /* Yahoo */
  'div.dd.algo',
  /* Yandex */
  'li.serp-item',
];

const LINK_SELECTORS = [
  /* DDG */
  'a[data-testid="result-title-a"]', 'h2 a', 'a.result__a',
  /* Google */
  'h3 a', 'a[jsname]', 'a[data-ved]', 'div.yuRUbf a',
  /* Bing */
  'h2 a', 'a.tilk',
  /* Baidu */
  'h3 a', 'div.c-title a', 'h3.c-title a',
  /* Yahoo */
  'h3 a', 'a.ac-algo',
  /* Yandex */
  'h2 a', 'a.link',
  /* Generic fallback (last resort) */
  'a[href^="http"]',
];

function isSearchEngine(hostname) {
  const h = hostname.toLowerCase();

  // DuckDuckGo — search page only
  if (h === 'duckduckgo.com' || h === 'www.duckduckgo.com') return true;
  if (h.endsWith('.duckduckgo.com')) return true; // html.duckduckgo.com etc.

  // Google — all regional variants
  if (h.startsWith('www.google.')) return true;

  // Bing — regional search entry points
  if (h === 'www.bing.com' || h === 'cn.bing.com' || h === 'www2.bing.com' || h === 'bing.com') return true;

  // Baidu — search only, exclude baike / tieba / zhidao / wenku etc.
  if (h === 'www.baidu.com' || h === 'm.baidu.com') return true;

  // Yahoo Search
  if (h === 'search.yahoo.com' || h.endsWith('.search.yahoo.com')) return true;

  // Yandex — search subdomains
  if (h === 'yandex.com' || h === 'yandex.ru') return true;
  if (h.endsWith('.yandex.com') || h.endsWith('.yandex.ru')) return true;

  return false;
}

function isHtmlPage() {
  try {
    if (typeof HTMLDocument !== 'undefined' && document instanceof HTMLDocument) return true;
    if (document.contentType && /html/i.test(document.contentType)) return true;
    return !!(document.body && typeof HTMLElement !== 'undefined' && document.body instanceof HTMLElement);
  } catch (_) {
    return false;
  }
}

init();

async function init() {
  if (!isHtmlPage()) return;
  try {
    const result = await chrome.storage.sync.get('blacklist');
    blacklist = result.blacklist ?? [];
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.blacklist) {
        blacklist = changes.blacklist.newValue ?? [];
        reprocessAll();
      }
    });
  } catch (_) {}

  const isSearch = isSearchEngine(location.hostname);

  if (isSearch) {
    injectSearchStyles();
    processResults();
    new MutationObserver((mutations) => {
      let hasNew = false;
      for (const m of mutations) { if (m.addedNodes.length > 0) { hasNew = true; break; } }
      if (hasNew) processResults();
    }).observe(document.body, { childList: true, subtree: true });
  } else {
    try {
      if (!document.body) return;
      await createPageCheckbox();
      injectAnnotationStyles();
    } catch (err) {
      console.warn('[Citecat] 页面按钮初始化失败:', err.message);
    }
  }
}

/* ======== URL change detection (SPA) — driven by SW webNavigation API ======== */

let lastUrl = location.href;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'LICENSE_STATE_CHANGED' && msg.data && !msg.data.ok) {
    if (INSPECT.chatWin) INSPECT.chatWin.classList.remove('show');
    return false;
  }
  // manage_tabs(list) 轻量快照：禁止走 Readability / 结构化全文，必须同步秒回。
  if (msg.type === 'EXTRACT_SNAPSHOT') {
    try {
      sendResponse(buildExtractSnapshot());
    } catch (err) {
      sendResponse({ title: document.title || '', pageType: 'article', snippet: '', error: (err && err.message) || String(err) });
    }
    return false;
  }

  // SW 代跑图表光栅化（浮动聊天在 SW 侧，没有 DOM）：本页渲一张 PNG 回传 base64
  if (msg.type === 'RASTERIZE_CHART') {
    rasterizeChartOption(msg.option, { width: msg.width, height: msg.height }).then((r) => {
      if (r && r.ok) sendResponse({ ok: true, dataUrl: r.dataUrl, width: r.width, height: r.height });
      else sendResponse({ ok: false, error: (r && r.error) || '光栅化失败' });
    }).catch((err) => sendResponse({ ok: false, error: (err && err.message) || String(err) }));
    return true; // 异步回包
  }

  // SW asks us to extract content via Readability (background-tab path)
  if (msg.type === 'EXTRACT_CONTENT') {
    // format: 'text' (默认) | 'markdown' | 'auto'
    // read_current_page 显式指定；后台采集(extractor.js)不带参数保持纯文本。
    // 响应统一带 pageType（article|list|dashboard|form）；dashboard/list 附带 structured（KV/数组）。
    try {
      const format = msg.format || 'text';
      // 仅 read_current_page（带 format）需要页面类型检测；后台采集保持纯文本零开销。
      const pageType = msg.format ? detectPageType() : null;
      let extracted = null;
      if (format === 'markdown') {
        extracted = extractStructuredMarkdown();
      } else if (format === 'auto') {
        extracted = (pageType === 'dashboard' || pageType === 'list')
          ? extractStructuredMarkdown()
          : extractPageContent();
      } else {
        extracted = extractPageContent();
      }
      if (!extracted) extracted = extractPageContent();
      const resp = { ...(extracted || { title: document.title || '', content: '' }), pageType };
      resp.structured = (pageType === 'dashboard' || pageType === 'list') ? extractStructuredData() : null;
      sendResponse(resp);
    } catch (err) {
      // 不 sendResponse 时 chrome.tabs.sendMessage 永不 settle，AI 会卡在工具状态行。
      sendResponse({
        title: document.title || '',
        content: '',
        pageType: 'article',
        error: (err && err.message) || String(err),
      });
    }
    return false;
  }

  // SW asks us to scroll-load lazy content then extract (handles SPA / lazy-load / virtual scroll)
  if (msg.type === 'SCROLL_COLLECT') {
    scrollAndCollect(msg.maxTimeMs || 25000).then((result) => {
      sendResponse(result || { title: document.title || location.href, content: '' });
    }).catch(() => {
      sendResponse({ title: document.title || location.href, content: '' });
    });
    return true;
  }

  if (msg.type === 'INTERACT_PAGE') {
    handleInteractPage(msg.action, msg).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      sendResponse({ ok: false, error: (err && err.message) || 'interact_page 执行失败' });
    });
    return true;
  }

  if (msg.type === 'COLLECTION_STATUS_CHANGED') {
    refreshCollectionState(msg.refreshAll ? [] : msg.urls);
    return false;
  }

  if (msg.type === 'URL_CHANGED') {
    exitInspectMode(); // SPA 导航后清理检视状态
    handleUrlChange(msg);
    return false;
  }

  // 从库内 snippet 卡片跳回网页并定位到对应高亮
  if (msg.type === 'SCROLL_TO_ANNOTATION') {
    const id = msg.annotationId;
    let found = false;
    if (id) {
      const el = document.querySelector(`mark[data-ann-id="${CSS.escape(id)}"]`) ||
                 document.querySelector(`[data-ann-el="${CSS.escape(id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('citecat-pulse');
        setTimeout(() => el.classList.remove('citecat-pulse'), 2400);
        found = true;
      }
    }
    sendResponse({ ok: found });
    return false;
  }

  // 侧栏删除 snippet 条目时联动：解包该标注的 mark（保留原文）
  if (msg.type === 'DELETE_ANNOTATION_MARK') {
    const id = msg.data && msg.data.id;
    if (id) {
      unwrapMarks(`mark[data-ann-id="${CSS.escape(id)}"]`);
      removeAnnotationNoteBlock(id);
      document.querySelectorAll(`[data-ann-el="${CSS.escape(id)}"]`)
        .forEach((m) => m.classList.remove('citecat-el-hl', 'citecat-el-ul'));
    }
    sendResponse({ ok: true });
    return false;
  }

  // 撤销删除后：重新回放该页标注（恢复高亮）——标注功能已下线，忽略
  if (msg.type === 'REPLAY_ANNOTATIONS' || msg.type === 'ANNOTATE_QUOTE') {
    sendResponse({ ok: false, error: '标注功能已移除' });
    return false;
  }

  return false;
});

/* Parse subtitle body (VTT/SRT/JSON) into plain text. */
function parseSubBody(body) {
  if (!body) return '';
  const s = body.trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const data = JSON.parse(s);
      if (data.body && Array.isArray(data.body)) {
        return data.body.map((i) => i.content || '').filter(Boolean).join('\n');
      }
      if (data.events && Array.isArray(data.events)) {
        return data.events.map((ev) => (ev.segs || []).map((seg) => seg.utf8 || '').join('')).filter((t) => t.trim()).join('\n');
      }
    } catch (_) {}
  }
  const lines = s.split('\n').filter((line) => {
    const t = line.trim();
    if (!t || /^WEBVTT/.test(t) || /^\d+$/.test(t) || /-->/.test(t) || /^[A-Z]+:/.test(t)) return false;
    return true;
  });
  return lines.join('\n');
}

async function handleInteractPage(action, params) {
  params = params || {};
  const origAlert = window.alert;
  const origConfirm = window.confirm;
  const origPrompt = window.prompt;
  let dialogsSuppressed = [];
  window.alert = (msg) => { dialogsSuppressed.push({ type: 'alert', msg: String(msg || '') }); };
  window.confirm = (msg) => { dialogsSuppressed.push({ type: 'confirm', msg: String(msg || ''), autoReplied: true }); return true; };
  window.prompt = (msg, def) => { dialogsSuppressed.push({ type: 'prompt', msg: String(msg || ''), autoReplied: def || '' }); return def || ''; };
  try {
    if (action === 'loop_observe') return loopObservePage();
    if (action === 'loop_act') return loopActPage(params);
    if (action === 'number_elements') {
      const items = numberInteractiveElements();
      return { ok: true, action, items, count: items.length };
    }
    if (action === 'click_number') {
      const n = parseInt(params.text, 10);
      if (isNaN(n)) return { ok: false, error: 'click_number 需要 text 参数（元素编号）' };
      const el = numberedElementMap.get(n);
      if (!el) return { ok: false, error: `编号 ${n} 不存在，请先调 number_elements`, hint: 'renumber' };
      // Check if element is still in the DOM
      if (!el.isConnected) {
        clearNumberedBadges();
        return { ok: false, error: `编号 ${n} 的元素已从页面移除，请重新调 number_elements`, hint: 'renumber' };
      }
      // Scroll into view, then wait for position to stabilise (Playwright-style)
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      await waitForStable(el, 1200);
      // Dispatch full pointer+mouse event sequence with coordinates
      const clickInfo = dispatchRealClick(el);
      clearNumberedBadges();
      await waitForQuiet(300, Math.max(params.wait_ms || 2500, 800));
      return { ok: true, action, clickedAt: clickInfo.cx != null ? [clickInfo.cx, clickInfo.cy] : null };
    } else if (action === 'get_coords') {
      // Return center coordinates of a numbered element (for cdp_click).
      // Scrolls the element into view first so CDP clicks land on-screen.
      const n = parseInt(params.text, 10);
      if (isNaN(n)) return { ok: false, error: 'get_coords 需要 text 参数（元素编号）' };
      const el = numberedElementMap.get(n);
      if (!el) return { ok: false, error: `编号 ${n} 不存在，请先调 number_elements` };
      if (!el.isConnected) return { ok: false, error: `编号 ${n} 已从页面移除` };
      try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_) {}
      await new Promise((r) => setTimeout(r, 350)); // let scroll + lazy render settle
      const rect = getAbsoluteRect(el);
      if (rect.width === 0 && rect.height === 0) return { ok: false, error: `编号 ${n} 的元素不可见` };
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      const vw = window.innerWidth, vh = window.innerHeight;
      const inViewport = cx >= 0 && cx <= vw && cy >= 0 && cy <= vh;
      return { ok: true, x: cx, y: cy, width: Math.round(rect.width), height: Math.round(rect.height), inViewport, viewport: { w: vw, h: vh } };
    } else if (action === 'clear_numbers') {
      clearNumberedBadges();
      return { ok: true, action };
    } else if (action === 'scroll_down') {
      const before = capturePageState();
      window.scrollBy(0, window.innerHeight * 0.8);
      const changed = await waitForNewContent(params.wait_ms || 2000, before);
      const after = capturePageState();
      if (changed || after.height > before.height) {
        const newItems = numberNewElements();
        return { ok: true, action, newContent: true,
          heightBefore: before.height, heightAfter: after.height,
          elementCountBefore: before.count, elementCountAfter: after.count,
          newNumberedItems: newItems.length > 0 ? newItems : undefined,
          summary: after.summary };
      }
      return { ok: true, action, newContent: false, atBottom: after.atBottom,
        summary: after.summary };
    } else if (action === 'scroll_up') {
      window.scrollBy(0, -window.innerHeight * 0.8);
      await new Promise((r) => setTimeout(r, params.wait_ms || 500));
    } else if (action === 'scroll_to_bottom') {
      const before = capturePageState();
      window.scrollTo(0, document.body.scrollHeight);
      const changed = await waitForNewContent(params.wait_ms || 2500, before);
      const after = capturePageState();
      if (changed || after.height > before.height) {
        const newItems = numberNewElements();
        return { ok: true, action, newContent: true,
          heightBefore: before.height, heightAfter: after.height,
          newNumberedItems: newItems.length > 0 ? newItems : undefined,
          summary: after.summary };
      }
      return { ok: true, action, newContent: false, atBottom: true,
        summary: after.summary };
    } else if (action === 'click_text') {
      const target = (params.text || '').trim();
      if (!target) return { ok: false, error: 'click_text 需要 text 参数' };
      const candidates = findElementsByText(target);
      if (candidates.length === 0) return { ok: false, error: `未找到文字包含「${target}」的可点击元素` };
      const el = candidates[0].el;
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      await waitForStable(el, 1000);
      dispatchRealClick(el);
      await waitForQuiet(300, Math.max(params.wait_ms || 2500, 800));
    } else if (action === 'click') {
      const el = deepQuerySelector(params.selector);
      if (!el) return { ok: false, error: `未找到元素: ${params.selector}` };
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      await waitForStable(el, 1000);
      dispatchRealClick(el);
      await waitForQuiet(300, Math.max(params.wait_ms || 2500, 800));
    } else if (action === 'hover') {
      const target = (params.text || '').trim();
      const el = target ? findElementsByText(target)[0]?.el : document.querySelector(params.selector);
      if (!el) return { ok: false, error: '未找到悬停目标' };
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await new Promise((r) => setTimeout(r, params.wait_ms || 500));
    } else if (action === 'type') {
      const target = (params.text_match || '').trim().toLowerCase();
      let el = null;
      if (params.selector) {
        el = deepQuerySelector(params.selector);
        if (!el) return { ok: false, error: `未找到输入框: ${params.selector}` };
      }
      if (!el && target) {
        const inputSelectors = 'input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="spinbutton"]';
        const allInputs = deepQuerySelectorAll(inputSelectors);
        const candidates = [];
        for (const inp of allInputs) {
          const rect = getAbsoluteRect(inp);
          if (rect.width === 0 || rect.height === 0) continue;
          const label = findLabelForElementSync(inp).toLowerCase();
          const id = (inp.id || '').toLowerCase();
          const name = (inp.getAttribute('name') || '').toLowerCase();
          const placeholder = (inp.placeholder || '').toLowerCase();
          let score = 0;
          if (label === target) score = 100;
          else if (label.includes(target)) score = 85;
          else if (target.includes(label) && label.length > 0) score = 70;
          else if (id === target || name === target) score = 60;
          else if (id.includes(target) || name.includes(target)) score = 50;
          else if (placeholder.includes(target)) score = 40;
          if (score > 0) {
            const sel = inp.id ? `#${CSS.escape(inp.id)}` : (inp.getAttribute('name') ? `[name="${inp.getAttribute('name')}"]` : '');
            candidates.push({ el: inp, score, label: label || placeholder || id || name, selector: sel || undefined });
          }
        }
        candidates.sort((a, b) => b.score - a.score);
        if (candidates.length === 0) {
          return { ok: false, error: `未找到标签匹配"${params.text_match}"的输入框。建议先调 describe_form 查看可用控件。` };
        }
        if (candidates.length > 1 && candidates[0].score < 90) {
          const list = candidates.slice(0, 5).map((c, i) =>
            `${i + 1}. label="${c.label}" ${c.selector ? '| selector="' + c.selector + '"' : ''}`
          ).join('\n');
          return { ok: false, error: `找到 ${candidates.length} 个匹配"${params.text_match}"的输入框，请用 selector 指定:\n${list}` };
        }
        el = candidates[0].el;
      }
      if (!el && !target) {
        el = deepQuerySelector('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]');
      }
      if (!el) return { ok: false, error: '未找到输入框' };
      // char_by_char mode: per-character key events for search/autocomplete/
      // tag inputs / rich editors that listen to keydown/keyup.
      if (params.char_by_char) {
        await typeCharByChar(el, params.text || '', { delay: 20 });
      } else {
        const ownerDoc = el.ownerDocument || document;
        const isContentEditable = el.getAttribute('contenteditable') === 'true' || el.isContentEditable;
        el.focus();
        el.click();
        try {
          if (isContentEditable) {
            el.textContent = params.text || '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (ownerDoc.execCommand) {
            ownerDoc.execCommand('selectAll', false);
            ownerDoc.execCommand('insertText', false, params.text || '');
          } else {
            el.value = params.text || '';
          }
        } catch (_) {
          const proto = Object.getPrototypeOf(el);
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, params.text || '');
          else if (isContentEditable) el.textContent = params.text || '';
          else el.value = params.text || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (params.press_enter) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        if (el.form) el.form.submit();
      }
      await new Promise((r) => setTimeout(r, params.wait_ms || 1000));
    } else if (action === 'press_key') {
      const key = (params.text || '').trim();
      if (!key) return { ok: false, error: 'press_key 需要 text 参数（如 Enter Escape Tab）' };
      const lower = key.toLowerCase();
      const keyCodeMap = { enter: 13, escape: 27, tab: 9, backspace: 8, space: 32 };
      const code = keyCodeMap[lower] || 0;
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode: code, bubbles: true }));
      document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, keyCode: code, bubbles: true }));
      await new Promise((r) => setTimeout(r, params.wait_ms || 500));
    } else if (action === 'select_option') {
      let el = null;
      if (params.selector) {
        el = deepQuerySelector(params.selector);
        if (!el || el.tagName !== 'SELECT') {
          return { ok: false, error: `selector "${params.selector}" 未找到 <select> 元素` };
        }
      }
      if (!el) {
        const target = (params.text_match || '').trim().toLowerCase();
        if (target) {
          const allSelects = deepQuerySelectorAll('select');
          for (const s of allSelects) {
            const rect = s.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const label = (await findLabelForElement(s)).toLowerCase();
            if (label.includes(target) || target.includes(label)) { el = s; break; }
          }
          if (!el) {
            for (const s of allSelects) {
              const rect = s.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;
              const id = (s.id || '').toLowerCase();
              const name = (s.getAttribute('name') || '').toLowerCase();
              if (id.includes(target) || name.includes(target)) { el = s; break; }
            }
          }
          if (!el) {
            for (const s of allSelects) {
              const rect = s.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;
              const hasOpt = [...s.options].some((o) =>
                o.textContent.trim().toLowerCase().includes(target)
              );
              if (hasOpt) { el = s; break; }
            }
          }
        }
      }
      if (!el) return { ok: false, error: '未找到下拉选择框，建议先调 describe_form 查看可用控件' };
      const optionText = (params.text || '').trim().toLowerCase();
      const opt = [...el.options].find((o) => o.textContent.trim().toLowerCase().includes(optionText));
      if (!opt) {
        const avail = [...el.options].map((o) => o.textContent.trim()).join(', ');
        return { ok: false, error: `未找到选项: ${params.text}。可用选项: ${avail}` };
      }
      el.focus();
      el.value = opt.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, params.wait_ms || 500));
    } else if (action === 'open_dropdown') {
      const target = (params.text_match || params.text || '').trim();
      let trigger = target ? findElementsByText(target)[0]?.el : null;
      if (!trigger && params.selector) trigger = document.querySelector(params.selector);
      if (!trigger) {
        trigger = findDropdownTrigger(target);
      }
      if (!trigger) return { ok: false, error: '未找到下拉控件' };
      trigger.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await new Promise((r) => setTimeout(r, 200));
      trigger.click();
      const options = await waitForDropdownOptions(params.wait_ms || 2500);
      if (options.length === 0) {
        return { ok: false, error: '点击后未检测到下拉选项弹出，可能需要滚动或该控件不是下拉选择器' };
      }
      return {
        ok: true, action, count: options.length,
        options: options.map((o, i) => ({
          n: i + 1,
          text: (o.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        })),
      };
    } else if (action === 'select_from_dropdown') {
      const optionText = (params.text || '').trim().toLowerCase();
      if (!optionText) return { ok: false, error: 'select_from_dropdown 需要 text 参数（选项文字）' };
      const candidates = deepQuerySelectorAll(
        '[role="option"], [class*="option"], [class*="Option"], ' +
        '.ant-select-item-option, .el-select-dropdown__item, ' +
        'li[class*="select-item"], div[class*="select-item"], ' +
        '[class*="dropdown-item"], [class*="Dropdown-item"]'
      );
      let bestMatch = null;
      let bestScore = 0;
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const text = (el.textContent || '').trim().toLowerCase();
        if (!text) continue;
        let score = 0;
        if (text === optionText) score = 100;
        else if (text.includes(optionText)) score = 80;
        else if (optionText.includes(text)) score = 60;
        if (score > bestScore) { bestScore = score; bestMatch = el; }
      }
      if (!bestMatch) return { ok: false, error: `未找到匹配「${params.text}」的下拉选项` };
      bestMatch.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 200));
      bestMatch.click();
      await new Promise((r) => setTimeout(r, params.wait_ms || 800));
    } else if (action === 'describe_form') {
      const controls = scanFormControls();
      return { ok: true, action, controls, count: controls.length };
    } else if (action === 'wait_for') {
      const condition = (params.text_match || 'appear').trim().toLowerCase();
      const target = (params.text || '').trim();
      const maxWait = params.wait_ms || 10000;
      const start = Date.now();
      if (condition === 'network_idle') {
        let lastResourceCount = performance.getEntriesByType('resource').length;
        let stableTime = 0;
        while (Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, 500));
          const currentCount = performance.getEntriesByType('resource').length;
          if (currentCount === lastResourceCount) {
            stableTime += 500;
            if (stableTime >= 1000) break;
          } else {
            stableTime = 0;
            lastResourceCount = currentCount;
          }
        }
      } else if (condition === 'popup') {
        const initialFrameCount = document.querySelectorAll('iframe').length;
        const popupSelectors = '.layui-layer, .layui-m-layer, .layer-anim, [class*="layui-layer"], ' +
          '.ant-modal, .el-dialog, .modal, [role="dialog"], [class*="modal"]:not([class*="modal-"])';
        const initialPopupCount = document.querySelectorAll(popupSelectors).length;
        while (Date.now() - start < maxWait) {
          const frameNow = document.querySelectorAll('iframe').length;
          const popupNow = document.querySelectorAll(popupSelectors).length;
          if (frameNow > initialFrameCount || popupNow > initialPopupCount) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      } else if (condition === 'disappear') {
        while (Date.now() - start < maxWait) {
          const found = target ? findElementsByText(target).length > 0 : false;
          const selFound = params.selector ? !!deepQuerySelector(params.selector) : false;
          if (!found && !selFound) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      } else if (condition === 'text') {
        while (Date.now() - start < maxWait) {
          const bodyText = (document.body?.innerText || '').toLowerCase();
          if (bodyText.includes(target.toLowerCase())) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      } else {
        while (Date.now() - start < maxWait) {
          if (target && findElementsByText(target).length > 0) break;
          if (params.selector && deepQuerySelector(params.selector)) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      const elapsed = Date.now() - start;
      const timedOut = elapsed >= maxWait;
      return { ok: true, action, condition, elapsed, timedOut };
    } else if (action === 'click_at') {
      const x = parseFloat(params.selector || '0');
      const y = parseFloat(params.text || '0');
      if (isNaN(x) || isNaN(y)) return { ok: false, error: 'click_at 需要 selector=x,text=y 坐标参数' };
      let targetEl = deepElementFromPoint(x, y);
      if (!targetEl) {
        return { ok: false, error: `坐标 (${x},${y}) 处未找到元素` };
      }
      const interactiveTags = ['A','BUTTON','INPUT','SELECT','TEXTAREA','LABEL'];
      if (!interactiveTags.includes(targetEl.tagName) && !targetEl.hasAttribute('onclick') && !targetEl.getAttribute('role')) {
        const stack = deepElementsFromPoint(x, y);
        for (const el of stack) {
          if (interactiveTags.includes(el.tagName) || el.hasAttribute('onclick') || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'option') {
            targetEl = el;
            break;
          }
        }
      }
      targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await waitForStable(targetEl, 1000);
      const absRect = getAbsoluteRect(targetEl);
      const centerX = absRect.left + absRect.width / 2;
      const centerY = absRect.top + absRect.height / 2;
      const recheck = deepElementFromPoint(centerX, centerY);
      if (recheck) targetEl = recheck;
      dispatchRealClick(targetEl);
      await waitForQuiet(300, Math.max(params.wait_ms || 2000, 800));
    } else if (action === 'get_element') {
      const target = (params.text || '').trim();
      if (target) {
        const matches = findElementsByText(target);
        if (matches.length === 0) return { ok: false, error: `未找到包含「${target}」的元素` };
        const el = matches[0].el;
        return { ok: true, action, text: (el.textContent || '').trim().slice(0, 2000), html: el.outerHTML.slice(0, 500) };
      }
      if (params.selector) {
        const el = deepQuerySelector(params.selector);
        if (!el) return { ok: false, error: `未找到元素: ${params.selector}` };
        return { ok: true, action, text: (el.textContent || '').trim().slice(0, 2000), html: el.outerHTML.slice(0, 500) };
      }
      return { ok: false, error: 'get_element 需要 text 或 selector 参数' };
    } else if (action === 'get_links') {
      const links = deepQuerySelectorAll('a[href]').map((a) => ({
        text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        href: a.href,
      })).filter((l) => l.text && l.href);
      return { ok: true, action, links: links.slice(0, 50), count: links.length };
    } else if (action === 'get_table') {
      const tables = extractTables();
      if (tables.length === 0) return { ok: false, error: '页面上没有找到表格' };
      return { ok: true, action, tables, count: tables.length };
    } else if (action === 'list_clickable') {
      const items = listClickableElements();
      return { ok: true, action, items, summary: (document.body?.innerText || '').slice(0, 200) };
    } else if (action === 'extract_subtitles') {
      // Universal subtitle extraction - 3 layers
      const title = document.title || '';
      // Layer 1: <video>.textTracks (works for ~10-20% of sites with native <track>)
      try {
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
          for (const track of v.textTracks || []) {
            if (track.mode === 'disabled') track.mode = 'hidden';
            if (track.cues && track.cues.length > 0) {
              const lines = [];
              for (let i = 0; i < track.cues.length; i++) {
                const t = (track.cues[i].text || '').trim();
                if (t) lines.push(t);
              }
              if (lines.length > 0 && lines.join('').length >= 20) {
                return { ok: true, action, title, content: lines.join('\n'), method: 'textTracks' };
              }
            }
          }
        }
      } catch (_) {}
      // Layer 1.5: DOM scraping for rendered subtitle overlays
      const subtitleSelectors = [
        '.ytp-caption-segment',           // YouTube
        '.bpx-player-subtitle-panel-text', // Bilibili
        '.vjs-text-track-display',         // Video.js
        '.jw-text-track-cue',              // JW Player
        '.shaka-text-cue',                 // Shaka Player
        '[class*="caption-text"]', '[class*="subtitle-text"]',
      ];
      const overlayEls = document.querySelectorAll(subtitleSelectors.join(','));
      if (overlayEls.length > 0) {
        const lines = Array.from(overlayEls).map((el) => (el.textContent || '').trim()).filter(Boolean);
        if (lines.length > 0 && lines.join('').length >= 20) {
          return { ok: true, action, title, content: lines.join('\n'), method: 'dom-scraping' };
        }
      }
      // Layer 2: Find subtitle URLs from PerformanceResourceTiming
      // The extension context (panel.js) can fetch these URLs bypassing CORS.
      const subtitleUrlPattern = /\.vtt|\.srt|\.ass|timedtext|aisubtitle|\/subtitle\/|\/caption\/|api.*subtitle|transcript/i;
      const urls = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((url) => subtitleUrlPattern.test(url));
      const uniqueUrls = [...new Set(urls)].slice(0, 10);
      if (uniqueUrls.length > 0) {
        // Try fetching from content script (may fail due to CORS)
        for (const url of uniqueUrls) {
          try {
            const resp = await fetch(url, { credentials: 'include' });
            if (resp.ok) {
              const body = await resp.text();
              const text = parseSubBody(body);
              if (text && text.length >= 20) {
                return { ok: true, action, title, content: text, method: 'perf-fetch' };
              }
            }
          } catch (_) { /* CORS - panel.js will retry */ }
        }
        // Return URLs for panel.js to fetch (extension context bypasses CORS)
        return { ok: true, action, title, content: '', urls: uniqueUrls, method: 'perf-urls' };
      }
      return { ok: false, error: '未找到字幕。请先播放视频并开启字幕后再试。' };
    } else if (action === 'wait') {
      await new Promise((r) => setTimeout(r, params.wait_ms || 1000));
    } else if (action === 'exec_js') {
      const code = (params.text || '').trim();
      if (!code) return { ok: false, error: 'exec_js 需要 text 参数（JavaScript 代码）' };
      let result = eval(code);
      if (result && typeof result.then === 'function') result = await result;
      const str = typeof result === 'string' ? result : JSON.stringify(result);
      const out = str || '';
      return { ok: true, action, result: out };
    } else {
      return { ok: false, error: `未知动作: ${action}` };
    }
    const summary = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500);
    const result = { ok: true, action, summary: summary || '(页面无可见文本)' };
    if (dialogsSuppressed.length > 0) result.suppressedDialogs = dialogsSuppressed;
    return result;
  } catch (err) {
    const errorResult = { ok: false, error: err.message || String(err) };
    if (dialogsSuppressed.length > 0) errorResult.suppressedDialogs = dialogsSuppressed;
    return errorResult;
  } finally {
    window.alert = origAlert;
    window.confirm = origConfirm;
    window.prompt = origPrompt;
  }
}

let numberedBadgeContainer = null;
let numberedElementMap = new Map();

/* ======== Interaction helpers (inspired by Playwright actionability model) ======== */

/**
 * Wait for DOM mutations to settle (quiet period). Resolves when no
 * DOM mutations have occurred for `quietMs` consecutive milliseconds.
 * Times out after `maxMs`. Falls back to fixed delay if MutationObserver
 * is unavailable.
 *
 * Use after clicks/scrolls/navigation that trigger async DOM changes
 * (SPA route transitions, lazy-load, dropdown expansion, modal open).
 */
function waitForQuiet(quietMs = 300, maxMs = 3000) {
  return new Promise((resolve) => {
    if (typeof MutationObserver === 'undefined') {
      setTimeout(resolve, quietMs);
      return;
    }
    const start = Date.now();
    let lastMutation = Date.now();
    let timer = null;
    const observer = new MutationObserver(() => {
      lastMutation = Date.now();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, quietMs);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'disabled'] });
    // Initial timer in case no mutations happen at all
    timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, quietMs);
    // Hard timeout
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, maxMs);
  });
}

const LOOP_MAX_ELEMENTS = 220;
const LOOP_TEXT_CAP = 2500;
const LOOP_ROLES = [
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemradio',
  'option', 'gridcell', 'combobox', 'textbox', 'searchbox', 'spinbutton',
];

function loopCache() {
  const g = globalThis;
  if (!g.__citecatLoop) g.__citecatLoop = { ids: new WeakMap(), nodes: new Map(), next: 1, fingerprint: '', actions: [] };
  return g.__citecatLoop;
}

function loopIdentity(el) {
  const cache = loopCache();
  if (!cache.ids.has(el)) cache.ids.set(el, cache.next++);
  const id = cache.ids.get(el);
  cache.nodes.set(id, el);
  return id;
}

function loopQueryAll(selector, root) {
  root = root || document;
  let results = [...root.querySelectorAll(selector)];
  try {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) results = results.concat(loopQueryAll(selector, el.shadowRoot));
    }
  } catch (_) {}
  return results;
}

function loopVisible(el) {
  if (!el || !el.isConnected) return false;
  try {
    if (el.closest('[aria-hidden="true"],[inert]')) return false;
  } catch (_) {}
  try {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      return false;
    }
  } catch (_) {}
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
  return true;
}

function loopName(e, seen = new Set()) {
  if (!e || seen.has(e)) return '';
  seen.add(e);
  const referenced = (e.getAttribute('aria-labelledby') || '').split(/\s+/)
    .map((id) => loopName(document.getElementById(id), seen)).filter(Boolean).join(' ');
  if (referenced) return referenced.replace(/\s+/g, ' ').trim();
  const aria = (e.getAttribute('aria-label') || '').trim();
  if (aria) return aria;
  try {
    const labels = [...(e.labels || [])].map((l) => loopName(l, seen)).filter(Boolean).join(' ');
    if (labels) return labels;
  } catch (_) {}
  if (['button', 'submit', 'reset'].includes(e.type) && e.value) return String(e.value).trim();
  const alt = (e.getAttribute('alt') || '').trim();
  if (alt) return alt;
  if (e.tagName !== 'INPUT') {
    const text = [...e.childNodes].map((n) => {
      if (n.nodeType === 3) return n.textContent || '';
      if (n.nodeType === 1 && n.getAttribute && n.getAttribute('aria-hidden') !== 'true') return loopName(n, seen);
      return '';
    }).join(' ').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 80);
  }
  return (e.getAttribute('title') || e.getAttribute('placeholder') || '').trim();
}

function loopRole(e) {
  const explicit = e.getAttribute('role');
  if (LOOP_ROLES.includes(explicit)) return explicit;
  if (e.tagName === 'BUTTON' || e.tagName === 'SUMMARY') return 'button';
  if (e.tagName === 'A') return 'link';
  if (e.tagName === 'SELECT') return 'combobox';
  if (e.tagName === 'TEXTAREA' || e.isContentEditable) return 'textbox';
  if (e.tagName === 'INPUT') {
    if (['checkbox', 'radio'].includes(e.type)) return e.type;
    if (['button', 'submit', 'reset', 'image'].includes(e.type)) return 'button';
    if (e.type === 'search') return 'searchbox';
    if (e.type === 'number') return 'spinbutton';
    if (['text', 'email', 'url', 'tel', 'password'].includes(e.type)) return 'textbox';
  }
  return null;
}

function loopHash(value) {
  let h = 2166136261;
  const s = String(value || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function loopVisibleText() {
  const words = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let length = 0;
  let node;
  while ((node = walker.nextNode()) && length < LOOP_TEXT_CAP) {
    const value = (node.textContent || '').trim();
    const parent = node.parentElement;
    if (!value || !parent || parent.closest('script,style,noscript,template')) continue;
    if (!loopVisible(parent)) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) {
      words.push(value);
      length += value.length;
    }
  }
  return words.join('\n').slice(0, LOOP_TEXT_CAP);
}

function loopSerializeSnapshot() {
  const cache = loopCache();
  for (const [id, e] of cache.nodes) {
    if (!e.isConnected) cache.nodes.delete(id);
  }
  const selector = 'a[href],button,input,textarea,select,summary,[contenteditable="true"],'
    + LOOP_ROLES.map((role) => `[role="${role}"]`).join(',');
  const rawActions = [];
  for (const e of loopQueryAll(selector)) {
    if (['password', 'file', 'hidden'].includes(e.type)) continue;
    if (!loopVisible(e) || e.matches(':disabled') || e.closest('[aria-disabled="true"]')) continue;
    const rname = loopRole(e);
    if (!rname) continue;
    if (rname === 'gridcell' && e.querySelector('button,[role="button"]')) continue;
    const nodeId = loopIdentity(e);
    const base = { node: nodeId, role: rname, label: loopName(e) || rname };
    for (const key of ['checked', 'selected', 'expanded']) {
      const value = e.getAttribute('aria-' + key);
      if (value !== null) base[key] = value;
    }
    if (['checkbox', 'radio'].includes(e.type)) base.checked = String(e.checked);
    if (e.tagName === 'SELECT') {
      const current = [...e.selectedOptions].map((o) => o.label || o.textContent).join(', ');
      for (const o of e.options) {
        if (o.disabled || o.closest('optgroup[disabled]')) continue;
        rawActions.push({
          ...base,
          kind: 'select',
          value: o.value,
          current_value: current,
          label: `${base.label} → ${(o.label || o.textContent || '').trim()}`,
          optionEl: o,
        });
      }
    } else {
      const editable = !e.readOnly && e.getAttribute('aria-readonly') !== 'true' && (
        ['textbox', 'searchbox', 'spinbutton'].includes(rname)
        || (rname === 'combobox' && ['INPUT', 'TEXTAREA'].includes(e.tagName))
      );
      const value = 'value' in e ? String(e.value) : (e.isContentEditable || rname === 'combobox' ? (e.innerText || '').trim() : '');
      rawActions.push({ ...base, kind: editable ? 'fill' : 'click', value });
      if (editable) rawActions.push({ ...base, kind: 'click', value, label: 'Open ' + base.label });
    }
  }
  const omitted = Math.max(0, rawActions.length - LOOP_MAX_ELEMENTS);
  const actions = rawActions.slice(0, LOOP_MAX_ELEMENTS);
  actions.forEach((a, i) => { a.id = 'e' + (i + 1); });
  const height = document.documentElement.scrollHeight;
  const canDown = scrollY + innerHeight < height - 2;
  const canUp = scrollY > 0;
  const text = loopVisibleText();
  const semantics = actions.map((a) => ({
    id: a.id, kind: a.kind, node: a.node, role: a.role, label: a.label, value: a.value,
    checked: a.checked, expanded: a.expanded, current_value: a.current_value,
  }));
  const fingerprint = loopHash([
    location.href, Math.round(scrollX), Math.round(scrollY), innerWidth, innerHeight,
    document.title, text, JSON.stringify(semantics),
  ].join('|'));
  cache.fingerprint = fingerprint;
  cache.actions = actions;
  const elements = [];
  const byNode = new Map();
  for (const a of actions) {
    if (a.kind === 'select') {
      let el = byNode.get(a.node);
      if (!el) {
        el = {
          index: String(elements.length + 1),
          role: a.role,
          label: (a.label || '').split(' → ')[0],
          value: a.current_value || '',
          checked: a.checked,
          expanded: a.expanded,
          operations: ['select'],
          options: [],
        };
        byNode.set(a.node, el);
        elements.push(el);
      }
      const optIndex = `${el.index}:${el.options.length + 1}`;
      a.index = optIndex;
      el.options.push({ index: optIndex, label: a.label, value: a.value });
      continue;
    }
    let el = byNode.get(a.node);
    if (!el) {
      el = {
        index: String(elements.length + 1),
        role: a.role,
        label: a.kind === 'click' && a.label.startsWith('Open ') ? a.label.slice(5) : a.label,
        value: a.value || '',
        checked: a.checked,
        expanded: a.expanded,
        operations: [],
      };
      byNode.set(a.node, el);
      elements.push(el);
    }
    const op = a.kind === 'fill' ? 'type' : 'click';
    if (!el.operations.includes(op)) el.operations.push(op);
    a.index = el.index;
  }
  return {
    ok: true,
    action: 'loop_observe',
    url: location.href,
    title: document.title,
    fingerprint,
    text,
    elements,
    can_scroll_down: canDown,
    can_scroll_up: canUp,
    omitted,
  };
}

function loopObservePage() {
  return loopSerializeSnapshot();
}

function loopTwoFrames() {
  const win = window;
  return new Promise((r) => win.requestAnimationFrame(() => win.requestAnimationFrame(r)));
}

async function loopSettle(kind, el) {
  await loopTwoFrames();
  const combo = el && (
    el.getAttribute('role') === 'combobox'
    || el.tagName === 'SELECT'
    || (el.tagName === 'INPUT' && (el.getAttribute('list') || el.getAttribute('aria-autocomplete')))
  );
  if (kind === 'fill' && combo) await waitForQuiet(50, 250);
  else await waitForQuiet(40, 80);
}

function loopOccluded(el) {
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const hit = deepElementFromPoint(x, y);
  if (!hit) return true;
  return hit !== el && !el.contains(hit) && !hit.contains(el);
}

function loopFindAction(op, index) {
  const cache = loopCache();
  const idx = String(index || '').trim();
  if (!idx) return null;
  if (op === 'select') {
    return (cache.actions || []).find((a) => a.kind === 'select' && a.index === idx) || null;
  }
  const kind = op === 'type' ? 'fill' : 'click';
  return (cache.actions || []).find((a) => a.kind === kind && a.index === idx) || null;
}

async function loopFill(el, text) {
  const ownerDoc = el.ownerDocument || document;
  el.focus();
  const isContentEditable = el.getAttribute('contenteditable') === 'true' || el.isContentEditable;
  try {
    if (isContentEditable) {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (ownerDoc.execCommand) {
      ownerDoc.execCommand('selectAll', false);
      ownerDoc.execCommand('insertText', false, text);
    } else {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (_) {
    const proto = Object.getPrototypeOf(el);
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, text);
    else if (isContentEditable) el.textContent = text;
    else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function loopActPage(params) {
  params = params || {};
  const op = String(params.op || '').trim();
  const cache = loopCache();
  const givenFp = String(params.fingerprint || '');
  if (givenFp && cache.fingerprint && givenFp !== cache.fingerprint) {
    return { ok: false, stale: true, error: '页面已变化', snapshot: loopSerializeSnapshot() };
  }
  if (op === 'wait') {
    await waitForQuiet(50, 200);
    return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
  }
  if (op === 'scroll_down') {
    window.scrollBy(0, Math.round(innerHeight * 0.7) || 560);
    await loopSettle('scroll');
    return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
  }
  if (op === 'scroll_up') {
    window.scrollBy(0, -Math.round(innerHeight * 0.7) || -560);
    await loopSettle('scroll');
    return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
  }
  if (!['click', 'type', 'select'].includes(op)) {
    return { ok: false, error: `不支持的 op: ${op}` };
  }
  if (!cache.actions || !cache.actions.length) {
    loopSerializeSnapshot();
  }
  let action = loopFindAction(op, params.index);
  if (op === 'select' && !action && params.text) {
    const want = String(params.text).trim().toLowerCase();
    action = (cache.actions || []).find((a) => a.kind === 'select' && String(a.label || '').toLowerCase().includes(want));
  }
  if (!action) {
    return {
      ok: false,
      error: `编号 ${params.index || ''} 对 ${op} 无效，请按当前表重选。`,
      snapshot: loopSerializeSnapshot(),
    };
  }
  const el = cache.nodes.get(action.node);
  if (!el || !el.isConnected) {
    return { ok: false, stale: true, error: '目标节点已从页面移除', snapshot: loopSerializeSnapshot() };
  }
  if (!loopVisible(el)) {
    try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (_) {}
    await loopTwoFrames();
  }
  if (!loopVisible(el)) {
    return { ok: false, error: '目标不在视口内（可能被挡住）。可 scroll 或 wait。', snapshot: loopSerializeSnapshot() };
  }
  if (loopOccluded(el)) {
    return { ok: false, error: '目标被其它层挡住，未点击。可 wait 或先关掉遮罩。', snapshot: loopSerializeSnapshot() };
  }
  if (op === 'select') {
    if (el.tagName === 'SELECT') {
      el.value = action.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      dispatchRealClick(el);
    }
    await loopSettle('select', el);
    return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
  }
  if (op === 'type') {
    const text = params.text == null ? '' : String(params.text);
    if (!text) return { ok: false, error: 'type 需要 text' };
    dispatchRealClick(el);
    await loopTwoFrames();
    await loopFill(el, text);
    await loopSettle('fill', el);
    return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
  }
  dispatchRealClick(el);
  await loopSettle('click', el);
  return { ok: true, action: 'loop_act', snapshot: loopSerializeSnapshot() };
}

/**
 * Wait for element's bounding box to stay stable across 2 consecutive
 * animation frames (Playwright-style stability check). Resolves with the
 * settled rect. Times out after maxMs (default 1500).
 */
async function waitForStable(el, maxMs = 1500) {
  const ownerDoc = el.ownerDocument || document;
  const win = (ownerDoc.defaultView || window);
  const start = Date.now();

  let prevRect = null;
  while (Date.now() - start < maxMs) {
    const rect = getAbsoluteRect(el);
    if (rect.width === 0 || rect.height === 0) return rect; // hidden, nothing to wait for
    if (prevRect &&
        Math.abs(rect.left - prevRect.left) < 2 &&
        Math.abs(rect.top - prevRect.top) < 2 &&
        Math.abs(rect.width - prevRect.width) < 2 &&
        Math.abs(rect.height - prevRect.height) < 2) {
      return rect; // stable
    }
    prevRect = rect;
    await new Promise((r) => win.requestAnimationFrame(() => r()));
    await new Promise((r) => win.requestAnimationFrame(() => r()));
  }
  return getAbsoluteRect(el);
}

/**
 * Dispatch a full pointer + mouse event sequence at the element's center,
 * simulating a real user click. Falls back to el.click() if coordinates
 * can't be computed.
 *
 * Sequence: pointerdown -> mousedown -> pointerup -> mouseup -> click
 * (same as browser-generated trusted events, minus isTrusted flag).
 *
 * If the element at the center point is NOT our target (or a descendant),
 * tries the covering element instead (overlay handling).
 */
function dispatchRealClick(el) {
  const ownerDoc = el.ownerDocument || document;
  const win = (ownerDoc.defaultView || window);
  const rect = getAbsoluteRect(el);

  // Compute center coordinates in viewport space
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hasCoords = rect.width > 0 && rect.height > 0 &&
    cx >= 0 && cy >= 0 && cx <= win.innerWidth && cy <= win.innerHeight;

  // Overlay detection: if another element is on top at center point,
  // and it's not our target or a descendant, click the covering element.
  let target = el;
  if (hasCoords) {
    try {
      const hitEl = deepElementFromPoint(cx, cy);
      if (hitEl && hitEl !== el && !el.contains(hitEl) && !hitEl.contains(el)) {
        target = hitEl;
      } else if (hitEl && hitEl !== el && hitEl.contains(el)) {
        // hitEl is an ancestor that wraps el - click el directly
        target = el;
      }
    } catch (_) {}
  }

  // Common event options
  const evtOpts = (x, y) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    view: win,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    button: 0,
    buttons: 1,
  });

  if (hasCoords) {
    const x = cx, y = cy;
    try { target.dispatchEvent(new PointerEvent('pointerdown', evtOpts(x, y))); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('mousedown', evtOpts(x, y))); } catch (_) {}
    try { target.dispatchEvent(new PointerEvent('pointerup', evtOpts(x, y))); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('mouseup', evtOpts(x, y))); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('click', evtOpts(x, y))); } catch (_) {}
  } else {
    // Zero-size or off-screen: bare .click() as last resort
    target.click();
  }
  return { target, cx: hasCoords ? cx : null, cy: hasCoords ? cy : null };
}

/* Type text character-by-character with full key event sequence
   (keydown -> keypress -> insertText -> keyup per char). Needed for
   components that listen to key events: search autocomplete, tag inputs,
   rich text editors, React controlled components. Mirrors Playwright's
   page.type() approach (sans CDP trusted events). */
async function typeCharByChar(el, text, opts = {}) {
  const ownerDoc = el.ownerDocument || document;
  const win = (ownerDoc.defaultView || window);
  const isContentEditable = el.getAttribute('contenteditable') === 'true' || el.isContentEditable;
  const delay = opts.delay || 20;

  el.focus();
  // Clear existing value first
  if (isContentEditable) {
    try { ownerDoc.execCommand('selectAll', false); } catch (_) {}
    try { ownerDoc.execCommand('delete', false); } catch (_) {}
  } else {
    const proto = Object.getPrototypeOf(el);
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, '');
    else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  for (const ch of String(text)) {
    const keyCode = ch.charCodeAt(0);
    const code = ch === ' ' ? 'Space'
      : /[a-z]/.test(ch) ? 'Key' + ch.toUpperCase()
      : /[A-Z]/.test(ch) ? 'Key' + ch
      : /[0-9]/.test(ch) ? 'Digit' + ch
      : '';
    const keyOpts = { key: ch, code, keyCode, charCode: keyCode, bubbles: true, cancelable: true, view: win };
    try { el.dispatchEvent(new KeyboardEvent('keydown', keyOpts)); } catch (_) {}
    try { el.dispatchEvent(new KeyboardEvent('keypress', keyOpts)); } catch (_) {}
    // Insert the character
    let inserted = false;
    try { inserted = ownerDoc.execCommand('insertText', false, ch); } catch (_) {}
    if (!inserted && !isContentEditable) {
      const proto2 = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto2, 'value')?.set;
      if (setter) setter.call(el, el.value + ch);
      else el.value += ch;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    try { el.dispatchEvent(new KeyboardEvent('keyup', keyOpts)); } catch (_) {}
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
}

/* For visually-hidden form controls (input/select/textarea with opacity:0
   or zero size -- a common accessible-checkbox pattern), find the visual
   element that represents them on screen (associated <label>, wrapping
   label, or sibling with role=checkbox/switch). Returns the input itself
   if no visual target is found (it can still be .click()'d).
   General: works for any site that hides native inputs for accessibility. */
function resolveVisualTarget(el) {
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return el;
  try {
    const style = (el.ownerDocument || document).defaultView.getComputedStyle(el);
    const isVisuallyHidden = el.offsetWidth === 0 || el.offsetHeight === 0 || style.opacity === '0';
    if (!isVisuallyHidden) return el;
  } catch (_) { return el; }
  if (el.id) {
    try {
      const label = (el.ownerDocument || document).querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (label && label.offsetWidth > 0) return label;
    } catch (_) {}
  }
  let parent = el.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    if (parent.tagName === 'LABEL' && parent.offsetWidth > 0) return parent;
    parent = parent.parentElement;
  }
  const sib = el.nextElementSibling || el.previousElementSibling;
  if (sib) {
    const r = sib.getAttribute('role');
    if (r === 'checkbox' || r === 'switch' || r === 'radio') return sib;
  }
  return el;
}

function numberInteractiveElements() {
  clearNumberedBadges();
  numberedElementMap = new Map();
  const selectors = [
    'a[href]', 'button', '[role="button"]', '[onclick]',
    'input', 'textarea', 'select',
    '[class*="btn"]', '[class*="button"]', '[class*="close"]',
    '[contenteditable="true"]',
    '[role="combobox"]', '[role="listbox"]', '[role="option"]',
    '[role="slider"]', '[role="spinbutton"]', '[role="switch"]', '[role="tab"]',
    '[aria-haspopup]', '[aria-expanded]',
    '[class*="select"]', '[class*="dropdown"]', '[class*="picker"]',
    '[class*="Select"]', '[class*="Dropdown"]', '[class*="Picker"]',
    '[class*="ant-select"]', '[class*="el-select"]',
    '[class*="pagination"]', '[class*="pagenation"]', '[class*="pager"]',
    '[class*="page-next"]', '[class*="page-prev"]', '[class*="next-page"]',
    '[aria-label*="next"]', '[aria-label*="上一页"]', '[aria-label*="下一页"]',
    'a[rel="next"]', 'a[rel="prev"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const allEls = deepQuerySelectorAll(selectors);
  // Deduplicate: if element A contains element B, keep only A
  const els = allEls.filter((el) => {
    return !allEls.some((other) => other !== el && other.contains(el));
  });
  // Resolve visual targets (for hidden inputs, find their label/wrapper)
  // and deduplicate by visual target (input + its label shouldn't both appear)
  const seen = new Set();
  const resolved = [];
  for (const el of els) {
    const visualEl = resolveVisualTarget(el);
    if (seen.has(visualEl)) continue;
    seen.add(visualEl);
    resolved.push({ el, visualEl });
  }
  // Filter to visible -- based on VISUAL target. Form controls with
  // opacity:0 are NOT excluded (accessible hidden pattern). Only
  // display:none / visibility:hidden / disabled / type=hidden are excluded.
  const visible = resolved.filter(({ el, visualEl }) => {
    const tag = el.tagName;
    const isFormControl = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (isFormControl && el.disabled) return false;
    if (tag === 'INPUT' && el.type === 'hidden') return false;
    const rect = getAbsoluteRect(visualEl);
    if (rect.width === 0 && rect.height === 0 && !isFormControl) return false;
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return false;
    try {
      const style = (visualEl.ownerDocument || document).defaultView.getComputedStyle(visualEl);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.opacity === '0' && !isFormControl) return false;
    } catch (_) {}
    return true;
  });
  // Sort by position (top to bottom, left to right) for natural numbering
  visible.sort((a, b) => {
    const ra = getAbsoluteRect(a.visualEl);
    const rb = getAbsoluteRect(b.visualEl);
    if (Math.abs(ra.top - rb.top) > 10) return ra.top - rb.top;
    return ra.left - rb.left;
  });
  const items = [];
  let n = 1;
  for (const { el, visualEl } of visible) {
    if (n > 500) break;
    const rect = visualEl.getBoundingClientRect();
    let text, label;
    if (el.tagName === 'SELECT' && el.options && el.options.length > 0) {
      const optPreview = [...el.options].slice(0, 4).map((o) => o.textContent.trim()).join('/');
      text = `select(${el.options.length}个选项: ${optPreview}${el.options.length > 4 ? '...' : ''})`;
      const lbl = findLabelForElementSync(el);
      label = lbl || text;
    } else {
      text = (visualEl.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const ariaLabel = (el.getAttribute('aria-label') || visualEl.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      label = text || ariaLabel || (el.getAttribute('role') || el.tagName.toLowerCase());
    }
    // Find parent heading for context
    let context = '';
    let parent = visualEl.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const heading = parent.querySelector('h1, h2, h3, h4, [role="heading"]');
      if (heading && heading.textContent.trim()) {
        context = heading.textContent.trim().slice(0, 30);
        break;
      }
      parent = parent.parentElement;
    }
    // Store the VISUAL target for clicking/badging -- clicking a <label>
    // that wraps a hidden <input> will toggle the checkbox natively.
    numberedElementMap.set(n, visualEl);
    items.push({
      n,
      label,
      role: el.getAttribute('role') || undefined,
      type: el.type || undefined,
      checked: el.checked !== undefined ? el.checked : undefined,
      placeholder: el.placeholder || undefined,
      context: context || undefined,
      position: Math.round(rect.top),
    });
    createNumberedBadge(visualEl, n);
    n++;
  }
  return items;
}

/* Number only newly-appeared interactive elements (not already in the map).
   Used after scroll_down / scroll_to_bottom to auto-number lazy-loaded content.
   Returns the new items list, or [] if number_elements wasn't called. */
function numberNewElements() {
  if (numberedElementMap.size === 0) return [];
  const existingEls = new Set(numberedElementMap.values());
  const selectors = [
    'a[href]', 'button', '[role="button"]', '[onclick]',
    'input', 'textarea', 'select',
    '[class*="btn"]', '[class*="button"]', '[class*="close"]',
    '[contenteditable="true"]',
    '[role="combobox"]', '[role="listbox"]', '[role="option"]',
    '[role="slider"]', '[role="spinbutton"]', '[role="switch"]', '[role="tab"]',
    '[aria-haspopup]', '[aria-expanded]',
    '[class*="select"]', '[class*="dropdown"]', '[class*="picker"]',
    '[class*="Select"]', '[class*="Dropdown"]', '[class*="Picker"]',
    '[class*="ant-select"]', '[class*="el-select"]',
    '[class*="pagination"]', '[class*="pagenation"]', '[class*="pager"]',
    '[class*="page-next"]', '[class*="page-prev"]', '[class*="next-page"]',
    '[aria-label*="next"]', '[aria-label*="上一页"]', '[aria-label*="下一页"]',
    'a[rel="next"]', 'a[rel="prev"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const allEls = deepQuerySelectorAll(selectors);
  const els = allEls.filter((el) => !allEls.some((other) => other !== el && other.contains(el)));
  const seen = new Set();
  const resolved = [];
  for (const el of els) {
    const visualEl = resolveVisualTarget(el);
    if (existingEls.has(visualEl) || seen.has(visualEl)) continue;
    seen.add(visualEl);
    const tag = el.tagName;
    const isFormControl = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (isFormControl && el.disabled) continue;
    if (tag === 'INPUT' && el.type === 'hidden') continue;
    const rect = getAbsoluteRect(visualEl);
    if (rect.width === 0 && rect.height === 0 && !isFormControl) continue;
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
    try {
      const style = (visualEl.ownerDocument || document).defaultView.getComputedStyle(visualEl);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.opacity === '0' && !isFormControl) continue;
    } catch (_) {}
    resolved.push({ el, visualEl, top: rect.top, left: rect.left });
  }
  resolved.sort((a, b) => {
    if (Math.abs(a.top - b.top) > 10) return a.top - b.top;
    return a.left - b.left;
  });
  let n = numberedElementMap.size + 1;
  const newItems = [];
  for (const { el, visualEl } of resolved) {
    if (n > 500) break;
    const rect = visualEl.getBoundingClientRect();
    let text, label;
    if (el.tagName === 'SELECT' && el.options && el.options.length > 0) {
      text = `select(${el.options.length}个选项)`;
      label = findLabelForElementSync(el) || text;
    } else {
      text = (visualEl.textContent || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      const ariaLabel = (el.getAttribute('aria-label') || visualEl.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      label = text || ariaLabel || (el.getAttribute('role') || el.tagName.toLowerCase());
    }
    let context = '';
    let parent = visualEl.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const heading = parent.querySelector('h1, h2, h3, h4, [role="heading"]');
      if (heading && heading.textContent.trim()) { context = heading.textContent.trim().slice(0, 30); break; }
      parent = parent.parentElement;
    }
    numberedElementMap.set(n, visualEl);
    newItems.push({ n, label, role: el.getAttribute('role') || undefined, type: el.type || undefined, checked: el.checked !== undefined ? el.checked : undefined, context: context || undefined, position: Math.round(rect.top) });
    createNumberedBadge(visualEl, n);
    n++;
  }
  return newItems;
}

function createNumberedBadge(el, n) {
  if (!numberedBadgeContainer) {
    numberedBadgeContainer = document.createElement('div');
    numberedBadgeContainer.id = 'citecat-number-badges';
    numberedBadgeContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;';
    document.body.appendChild(numberedBadgeContainer);
    // Reposition badges on scroll/resize
    window.addEventListener('scroll', repositionBadges, { passive: true });
    window.addEventListener('resize', repositionBadges, { passive: true });
  }
  const badge = document.createElement('div');
  badge.textContent = String(n);
  badge.dataset.targetN = String(n);
  badge.style.cssText = 'position:absolute;min-width:18px;height:18px;background:#4e75df;color:#fff;font-size:10px;font-weight:700;line-height:18px;text-align:center;border-radius:4px;padding:0 4px;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-family:monospace;pointer-events:none;';
  numberedBadgeContainer.appendChild(badge);
  positionBadge(badge, el);
  // 聚焦模糊弹出（WAAPI，自包含不依赖页面样式表；尊重减少动效设置）
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    badge.animate(
      [
        { opacity: 0, transform: 'scale(.7) translateY(3px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)', filter: 'none' },
      ],
      { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'both' }
    );
  }
}

function positionBadge(badge, el) {
  const rect = el.getBoundingClientRect();
  badge.style.left = (rect.left - 6) + 'px';
  badge.style.top = (rect.top - 6) + 'px';
  badge.style.display = (rect.top < 0 || rect.top > window.innerHeight || rect.width === 0) ? 'none' : 'block';
}

function repositionBadges() {
  if (!numberedBadgeContainer) return;
  const badges = numberedBadgeContainer.querySelectorAll('[data-target-n]');
  badges.forEach((badge) => {
    const n = parseInt(badge.dataset.targetN, 10);
    const el = numberedElementMap.get(n);
    if (el) positionBadge(badge, el);
  });
}

function clearNumberedBadges() {
  if (numberedBadgeContainer) {
    window.removeEventListener('scroll', repositionBadges);
    window.removeEventListener('resize', repositionBadges);
    numberedBadgeContainer.remove();
    numberedBadgeContainer = null;
  }
  numberedElementMap = new Map();
}

function findElementsByText(text) {
  const lower = text.toLowerCase().trim();
  const clickableSelectors = 'a, button, select, [role="button"], [role="combobox"], [role="option"], [role="tab"], [onclick], input[type="submit"], input[type="button"], [class*="btn"], [class*="button"], [class*="click"], [class*="close"], [class*="dismiss"], [class*="select"], [class*="Select"], [class*="dropdown"], [class*="Dropdown"], [aria-label], [title], [tabindex]:not([tabindex="-1"])';  const all = deepQuerySelectorAll(clickableSelectors);
  const matches = [];
  for (const el of all) {
    const elText = (el.textContent || el.value || '').trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
    const title = (el.getAttribute('title') || '').trim().toLowerCase();
    const combined = [elText, ariaLabel, title].filter(Boolean);
    const matched = combined.some((c) => c === lower || c.includes(lower));
    if (matched) {
      const rect = getAbsoluteRect(el);
      if (rect.width > 0 && rect.height > 0) {
        const bestLen = combined.reduce((min, c) => c.length < min ? c.length : min, Infinity);
        matches.push({ el, text: combined[0], score: combined.some((c) => c === lower) ? 100 : (lower.length / bestLen) * 80 });
      }
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function extractTables() {
  const tableEls = deepQuerySelectorAll('table');
  const results = [];
  for (const table of tableEls) {
    const rect = table.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const rows = [...table.querySelectorAll('tr')];
    if (rows.length === 0) continue;
    const data = [];
    for (const row of rows.slice(0, 100)) {
      const cells = [...row.querySelectorAll('th, td')];
      if (cells.length === 0) continue;
      data.push(cells.map((c) => (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200)));
    }
    if (data.length > 0) {
      results.push({
        caption: table.caption?.textContent?.trim() || table.previousElementSibling?.textContent?.trim()?.slice(0, 60) || undefined,
        rows: data.length,
        cols: data[0].length,
        data: data.slice(0, 50),
      });
    }
  }
  return results;
}

function listClickableElements() {
  const selectors = 'a, button, [role="button"], input[type="submit"], input[type="button"], [class*="close"], [class*="dismiss"], [aria-label]';
  const els = deepQuerySelectorAll(selectors);
  const items = [];
  for (const el of els) {
    const text = (el.textContent || el.value || '').trim().replace(/\s+/g, ' ');
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const title = (el.getAttribute('title') || '').trim();
    const label = text || ariaLabel || title;
    if (!label || label.length > 60) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    items.push({
      text: label,
      tag: el.tagName.toLowerCase(),
      href: el.href || '',
      aria_label: ariaLabel || undefined,
    });
  }
  return items.slice(0, 30);
}

function deepQuerySelectorAll(selector, root) {
  root = root || document;
  let results = [...root.querySelectorAll(selector)];
  try {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        results = results.concat(deepQuerySelectorAll(selector, el.shadowRoot));
      }
    }
  } catch (_) {}
  try {
    for (const iframe of root.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body) {
          results = results.concat(deepQuerySelectorAll(selector, doc));
        }
      } catch (_) {}
    }
  } catch (_) {}
  return results;
}

function deepQuerySelector(selector) {
  const all = deepQuerySelectorAll(selector);
  return all.length > 0 ? all[0] : null;
}

function deepElementFromPoint(x, y, doc) {
  doc = doc || document;
  let el = doc.elementFromPoint(x, y);
  if (el && el.tagName === 'IFRAME') {
    try {
      const rect = el.getBoundingClientRect();
      const iframeX = x - rect.left;
      const iframeY = y - rect.top;
      const iframeDoc = el.contentDocument;
      if (iframeDoc && iframeDoc.body) {
        const inner = deepElementFromPoint(iframeX, iframeY, iframeDoc);
        if (inner) return inner;
      }
    } catch (_) {}
  }
  return el;
}

function deepElementsFromPoint(x, y, doc) {
  doc = doc || document;
  let els = [...doc.elementsFromPoint(x, y)];
  for (let i = 0; i < els.length; i++) {
    if (els[i].tagName === 'IFRAME') {
      try {
        const rect = els[i].getBoundingClientRect();
        const iframeX = x - rect.left;
        const iframeY = y - rect.top;
        const iframeDoc = els[i].contentDocument;
        if (iframeDoc && iframeDoc.body) {
          const inner = [...iframeDoc.elementsFromPoint(iframeX, iframeY)];
          els.splice(i, 1, ...inner);
          i += inner.length - 1;
        }
      } catch (_) {}
    }
  }
  return els;
}

function getAbsoluteRect(el) {
  const rect = el.getBoundingClientRect();
  if (el.ownerDocument === document) return rect;
  let left = rect.left, top = rect.top, width = rect.width, height = rect.height;
  let doc = el.ownerDocument;
  while (doc && doc !== document) {
    const iframe = doc.defaultView?.frameElement;
    if (!iframe) break;
    const iframeRect = iframe.getBoundingClientRect();
    left += iframeRect.left;
    top += iframeRect.top;
    doc = iframe.ownerDocument;
  }
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
}

function capturePageState() {
  return {
    height: document.body.scrollHeight,
    count: document.querySelectorAll('*').length,
    scrollY: window.scrollY,
    atBottom: window.scrollY + window.innerHeight >= document.body.scrollHeight - 50,
    summary: (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 500),
  };
}

function waitForNewContent(timeout, beforeState) {
  return new Promise((resolve) => {
    let resolved = false;
    const check = () => {
      if (resolved) return;
      const now = capturePageState();
      if (now.height > beforeState.height || now.count > beforeState.count + 5) {
        resolved = true;
        observer.disconnect();
        clearTimeout(timer);
        setTimeout(() => resolve(true), 200);
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; observer.disconnect(); resolve(false); }
    }, timeout);
  });
}

/* Force lazy-loaded resources to load immediately:
   - <img loading="lazy"> -> eager
   - data-src / data-original / data-lazy-src -> src
   Cheap, generic, handles the most common lazy-load patterns before scrolling. */
function forceLazyLoad() {
  try {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.setAttribute('loading', 'eager'));
    document.querySelectorAll('img[data-src],img[data-original],img[data-lazy-src]').forEach((img) => {
      if (img.src && !img.src.endsWith('data:')) return;
      const ds = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');
      if (ds) img.src = ds;
    });
    document.querySelectorAll('source[data-srcset]').forEach((s) => {
      const ds = s.getAttribute('data-srcset');
      if (ds) s.setAttribute('srcset', ds);
    });
  } catch (_) { /* noop */ }
}

/* Wait until network activity settles (no new resource entries for quietMs).
   Uses performance.getEntriesByType('resource') like the network_idle action. */
function waitForNetworkIdle(maxMs = 1500, quietMs = 600) {
  return new Promise((resolve) => {
    const start = Date.now();
    let lastCount = performance.getEntriesByType('resource').length;
    let stable = 0;
    const tick = () => {
      const now = performance.getEntriesByType('resource').length;
      if (now === lastCount) {
        stable += 200;
        if (stable >= quietMs) return resolve(true);
      } else {
        stable = 0;
        lastCount = now;
      }
      if (Date.now() - start >= maxMs) return resolve(false);
      setTimeout(tick, 200);
    };
    setTimeout(tick, 200);
  });
}

/* Scroll-load lazy/SPA content then extract. Strategy:
   1. forceLazyLoad() - trigger common lazy patterns without scrolling
   2. Progressive scroll loop: scroll one viewport -> wait for new content +
      network idle -> accumulate unique text blocks (dedup, for virtual-scroll
      fallback where DOM recycles nodes) -> repeat until bottom + stable + idle
   3. Scroll back to top, run extractPageContent() once on the now-fully-loaded DOM
   4. If final Readability result is suspiciously short vs accumulated (virtual
      scroll recycled content out of DOM), return accumulated text instead */
async function scrollAndCollect(maxTimeMs = 25000) {
  const deadline = Date.now() + maxTimeMs;

  forceLazyLoad();

  const seen = new Set();
  const orderedBlocks = [];
  const accumulate = () => {
    const text = (document.body?.innerText || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n');
    for (const block of text.split('\n')) {
      const b = block.replace(/\s+/g, ' ').trim();
      if (b.length >= 8 && !seen.has(b)) { seen.add(b); orderedBlocks.push(b); }
    }
  };

  let prevHeight = 0;
  let stableRounds = 0;
  const MAX_ROUNDS = 60;

  accumulate();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() > deadline) break;

    const before = capturePageState();
    if (before.atBottom && stableRounds >= 2) break;

    window.scrollBy(0, Math.round(window.innerHeight * 0.85));

    const remaining = () => Math.min(2500, Math.max(200, deadline - Date.now()));
    await waitForNewContent(remaining(), before);
    await waitForNetworkIdle(Math.min(1200, Math.max(200, deadline - Date.now())));

    accumulate();

    const after = capturePageState();
    if (after.height > prevHeight) stableRounds = 0;
    else stableRounds++;
    prevHeight = after.height;
  }

  try { window.scrollTo(0, 0); } catch (_) {}
  await new Promise((r) => setTimeout(r, 400));

  const extracted = extractPageContent();
  const finalLen = extracted?.content?.length || 0;
  const accumText = orderedBlocks.join('\n');
  const accumLen = accumText.length;
  const pageHeight = document.body?.scrollHeight || 0;

  let result;
  if (finalLen >= 200 && finalLen >= accumLen * 0.5) result = extracted;
  else if (accumLen > finalLen) {
    result = {
      title: extracted?.title || document.title || '',
      content: accumText.slice(0, MAX_TEXT_LENGTH),
      publishedAt: extracted?.publishedAt || null,
    };
  } else result = extracted || { title: document.title || location.href, content: '' };

  // Flag garbled/anti-scraped content so the SW can fall back to Vision OCR.
  result.pageHeight = pageHeight;
  result.garbled = looksGarbled(result.content || '', pageHeight);
  return result;
}

/* Detect anti-scraping garble: high ratio of replacement chars (U+FFFD) or
   other junk, or content suspiciously short vs page height. Conservative --
   only flags clear cases to avoid wasting Vision calls. */
function looksGarbled(text, pageHeight = 0) {
  if (!text) return pageHeight > 1500; // empty but tall page -> likely blocked
  const len = text.length;
  let bad = 0;
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c === 0xFFFD) bad++; // replacement char (font obfuscation / decode fail)
    else if (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D) bad++; // control chars
  }
  if (len > 100 && bad / len > 0.03) return true; // >3% junk
  // Very short vs a tall page suggests content is hidden/obfuscated
  if (pageHeight > 3000 && len < 200) return true;
  return false;
}

function findDropdownTrigger(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  const selectors = [
    '[role="combobox"]', '[aria-haspopup="listbox"]', '[aria-haspopup="dialog"]',
    '[class*="select"]:not(select)', '[class*="Select"]:not(select)',
    '[class*="dropdown-trigger"]', '[class*="Dropdown-trigger"]',
    '.ant-select-selector', '.ant-select', '.el-select', '.el-select__wrapper',
    '[class*="picker"]', '[class*="Picker"]',
  ];
  const all = deepQuerySelectorAll(selectors.join(', '));
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const elText = (el.textContent || '').trim().toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').trim().toLowerCase();
    const combined = [elText, ariaLabel, placeholder].filter(Boolean);
    if (combined.some((c) => c.includes(lower) || lower.includes(c))) {
      return el;
    }
  }
  return null;
}

function waitForDropdownOptions(timeout) {
  return new Promise((resolve) => {
    const optionSelectors = [
      '[role="option"]', '[class*="option"]', '[class*="Option"]',
      '.ant-select-item-option', '.el-select-dropdown__item',
      'li[class*="select-item"]', 'div[class*="select-item"]',
      '[class*="dropdown-item"]', '[class*="Dropdown-item"]',
      '[class*="list-item"][class*="select"]',
    ].join(', ');
    function collectVisible() {
      const els = deepQuerySelectorAll(optionSelectors);
      return els.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    }
    const existing = collectVisible();
    if (existing.length > 0) { resolve(existing); return; }
    const observer = new MutationObserver(() => {
      const found = collectVisible();
      if (found.length > 0) {
        observer.disconnect();
        clearTimeout(timer);
        setTimeout(() => resolve(collectVisible()), 100);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(collectVisible());
    }, timeout);
  });
}

async function findLabelForElement(el) {
  const cached = elementLabelCache.get(el);
  if (cached !== undefined) return cached;

  try {
    if (el.computedAccessibleNode) {
      const node = await el.computedAccessibleNode();
      if (node?.name) {
        const name = node.name.trim().slice(0, 80);
        elementLabelCache.set(el, name);
        return name;
      }
    }
  } catch (_) {}

  const label = findLabelForElementSync(el);
  elementLabelCache.set(el, label);
  return label;
}

const elementLabelCache = new WeakMap();

function findLabelForElementSync(el) {
  if (!el || el.nodeType !== 1) return '';

  const labelledBy = (el.getAttribute('aria-labelledby') || '').trim();
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const parts = [];
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target) parts.push(extractTextContent(target));
    }
    const text = parts.filter(Boolean).join(' ');
    if (text) return text.slice(0, 80);
  }

  const ariaLabel = (el.getAttribute('aria-label') || '').trim();
  if (ariaLabel) return ariaLabel.slice(0, 80);

  if (el.id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (labelEl) {
      const text = extractTextContent(labelEl);
      if (text) return text.slice(0, 80);
    }
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const ownText = extractTextContent(el);
    const fullText = extractTextContent(parentLabel);
    const label = ownText ? fullText.replace(ownText, '').trim() : fullText;
    if (label) return label.slice(0, 80);
  }

  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector(':scope > legend');
    if (legend) {
      const text = extractTextContent(legend);
      if (text) return text.slice(0, 80);
    }
  }

  const role = el.getAttribute('role') || el.tagName.toLowerCase();
  if (role === 'figure' || el.tagName === 'FIGURE') {
    const caption = el.querySelector('figcaption');
    if (caption) {
      const text = extractTextContent(caption);
      if (text) return text.slice(0, 80);
    }
  }
  if (role === 'table' || el.tagName === 'TABLE') {
    const caption = el.querySelector('caption');
    if (caption) {
      const text = extractTextContent(caption);
      if (text) return text.slice(0, 80);
    }
  }

  if (el.tagName === 'INPUT' && el.type === 'submit') return '提交';
  if (el.tagName === 'INPUT' && el.type === 'reset') return '重置';
  if (el.tagName === 'INPUT' && el.type === 'button') {
    const val = (el.value || '').trim();
    if (val) return val.slice(0, 80);
  }

  const placeholder = (el.getAttribute('placeholder') || '').trim();
  if (placeholder) return placeholder.slice(0, 80);

  const title = (el.getAttribute('title') || '').trim();
  if (title) return title.slice(0, 80);

  const prev = el.previousElementSibling;
  if (prev) {
    const t = extractTextContent(prev);
    if (t && t.length < 80) return t;
  }

  return '';
}

function extractTextContent(el) {
  if (!el) return '';
  if (el.nodeType === 3) return el.textContent || '';
  if (el.nodeType !== 1) return '';
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
  } catch (_) {}
  const alt = el.getAttribute('alt');
  if (el.tagName === 'IMG' && alt) return alt;
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  let text = '';
  for (const child of el.childNodes) {
    text += extractTextContent(child);
  }
  return text.replace(/\s+/g, ' ').trim();
}

function scanFormControls() {
  const formSelectors = [
    'input', 'textarea', 'select',
    'a[href]', 'button', '[role="button"]', '[role="tab"]',
    '[role="combobox"]', '[role="slider"]', '[role="spinbutton"]',
    '[role="switch"]', '[role="textbox"]', '[role="checkbox"]', '[role="radio"]',
    '[contenteditable="true"]',
    '[onclick]', '[class*="btn"]:not(input)', '[class*="button"]:not(input)',
    '[class*="select"]:not(select)', '[class*="Select"]:not(select)',
    '[class*="dropdown"]:not(select)', '[class*="Dropdown"]:not(select)',
    '[class*="datepicker"]', '[class*="DatePicker"]',
    '[class*="picker"]', '[class*="Picker"]',
    '[aria-haspopup]', '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  const els = deepQuerySelectorAll(formSelectors);
  const seen = new Set();
  const controls = [];
  for (const el of els) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (seen.size > 120) break;
    // Resolve visual target for hidden inputs (find label/wrapper)
    const visualEl = resolveVisualTarget(el);
    const rect = getAbsoluteRect(visualEl);
    const tag = el.tagName.toLowerCase();
    const isFormControl = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (isFormControl && el.disabled) continue;
    if (tag === 'input' && el.type === 'hidden') continue;
    if (rect.width === 0 && rect.height === 0 && !isFormControl) continue;
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;
    try {
      const style = (visualEl.ownerDocument || document).defaultView.getComputedStyle(visualEl);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.opacity === '0' && !isFormControl) continue;
    } catch (_) {}
    const type = el.type || el.getAttribute('role') || '';
    const label = findLabelForElementSync(el);
    const ariaLabel = (el.getAttribute('aria-label') || visualEl.getAttribute('aria-label') || '').trim();
    const isCustomSelect = tag !== 'select' && (
      el.getAttribute('role') === 'combobox' ||
      /select|dropdown|picker/i.test(visualEl.className || '') ||
      el.getAttribute('aria-haspopup') === 'listbox'
    );
    const isClickable = tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button' || el.hasAttribute('onclick');
    const selector = el.id ? '#' + CSS.escape(el.id) : (el.getAttribute('name') ? '[name="' + el.getAttribute('name') + '"]' : undefined);
    const control = {
      tag,
      type: type || undefined,
      id: el.id || undefined,
      name: el.getAttribute('name') || undefined,
      label: label || undefined,
      ariaLabel: ariaLabel || undefined,
      selector: selector,
      placeholder: el.placeholder || undefined,
      value: (el.value || '').slice(0, 60) || undefined,
      disabled: el.disabled || undefined,
      required: el.required || undefined,
      href: el.href || undefined,
      isCustomSelect: isCustomSelect || undefined,
      isClickable: isClickable || undefined,
      position: { x: Math.round(rect.x), y: Math.round(rect.y) },
    };
    if (tag === 'select' && el.options) {
      control.options = [...el.options].slice(0, 20).map((o) => o.textContent.trim().slice(0, 40));
      control.hint = 'use select_option';
    }
    if (isCustomSelect) {
      control.hint = 'use open_dropdown -> select_from_dropdown';
    }
    if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
      control.checked = el.checked;
      control.hint = 'use click_number or click_text to toggle';
    }
    controls.push(control);
  }
  return controls;
}

async function handleUrlChange(msg) {
  if (msg.url === lastUrl) return;
  lastUrl = msg.url;

  let host = document.getElementById('tsc-global-container');
  if (!host?.shadowRoot) {
    try { await createPageCheckbox(); } catch (_) {}
    host = document.getElementById('tsc-global-container');
  }
  if (!host?.shadowRoot) return;
  const cb = host.shadowRoot.querySelector('.cb');
  if (!cb) return;

  cb.checked = false;
  cb.classList.remove(LOADING_CLASS, DONE_CLASS, FAIL_CLASS);
  cb.title = '勾选以采集此页面';
  const label = host.shadowRoot.querySelector('.label');
  if (label) label.textContent = '采集此页';

  try {
    const resp = await safeSendMessage({ type: 'CHECK_URL', data: { url: msg.url } });
    if (resp?.collected) {
      cb.checked = true;
      cb.classList.add(DONE_CLASS);
      cb.title = '已采集';
      if (label) label.textContent = '已采集';
    }
  } catch (_) {}

  pageCollectUrl = msg.url;
  pageCollectTitle = document.title || msg.url;
}

async function refreshPageCollectState() {
  const host = document.getElementById('tsc-global-container');
  const shadow = host?.shadowRoot;
  if (!shadow) return;

  const cb = shadow.querySelector('.cb');
  if (!cb) return;

  const label = shadow.querySelector('.label');
  const isVideo = /(youtube\.com|youtu\.be|bilibili\.com|b23\.tv)/i.test(location.hostname);
  cb.checked = false;
  cb.classList.remove(LOADING_CLASS, DONE_CLASS, FAIL_CLASS);
  cb.title = '勾选以采集此页面';
  if (label) label.textContent = isVideo ? '采集视频' : '采集此页';

  try {
    const resp = await safeSendMessage({ type: 'CHECK_URL', data: { url: pageCollectUrl || location.href } });
    if (resp?.collected) {
      cb.checked = true;
      cb.classList.add(DONE_CLASS);
      cb.title = '已采集';
      if (label) label.textContent = '已采集';
    }
  } catch (_) {}
}

async function refreshSearchCollectState(urls = []) {
  const filter = new Set((urls || []).filter(Boolean));
  const boxes = [...document.querySelectorAll(`.${CB_CLASS}[data-url]`)]
    .filter((cb) => filter.size === 0 || filter.has(cb.dataset.url));

  await Promise.all(boxes.map(async (cb) => {
    const url = cb.dataset.url;
    if (!url) return;
    try {
      const resp = await safeSendMessage({ type: 'CHECK_URL', data: { url } });
      cb.checked = !!resp?.collected;
      cb.classList.remove(LOADING_CLASS, DONE_CLASS, FAIL_CLASS);
      cb.title = resp?.collected ? '已采集' : '勾选以采集并总结此页面';
      if (resp?.collected) cb.classList.add(DONE_CLASS);
    } catch (_) {}
  }));
}

async function refreshCollectionState(urls = []) {
  await refreshPageCollectState();
  await refreshSearchCollectState(urls);
}

/* ======== Search page: per-result checkboxes ======== */

function injectSearchStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .tsc-result-wrapper {
      position: relative;
      padding-left: 28px !important;
    }
    .${CB_CLASS} {
      position: absolute;
      left: 0; top: 2px;
      width: 20px; height: 20px;
      min-width: 20px; max-width: 20px;
      min-height: 20px; max-height: 20px;
      cursor: pointer;
      z-index: 10;
      appearance: none;
      -webkit-appearance: none;
      border: 2px solid rgba(0,0,0,0.16);
      border-radius: 50%;
      background: #fff;
      box-sizing: content-box;
      flex-shrink: 0;
      transition: border-color .2s cubic-bezier(.25,.1,.25,1),
                  background .2s cubic-bezier(.25,.1,.25,1),
                  transform .15s cubic-bezier(.34,1.56,.64,1);
      animation: tsc-cb-in .34s cubic-bezier(.34,1.25,.64,1) both;
    }
    @keyframes tsc-cb-in {
      from { opacity: 0; transform: scale(.6); filter: blur(4px) saturate(1.3); }
      to   { opacity: 1; transform: scale(1); filter: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .${CB_CLASS} { animation: none !important; }
    }
    .${CB_CLASS}:hover { border-color: #6b6b73; }
    .${CB_CLASS}:checked { background: #4e75df; border-color: #4e75df; }
    .${CB_CLASS}:checked::after {
      content: '';
      position: absolute;
      left: 6px; top: 3px;
      width: 4px; height: 10px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      animation: tsc-check-draw .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .${CB_CLASS}.${LOADING_CLASS} {
      border-radius: 50%;
      border-color: rgba(78,117,223,0.15);
      border-top-color: #4e75df;
      background: transparent;
      animation: tsc-spin .7s linear infinite;
    }
    .${CB_CLASS}.${LOADING_CLASS}:checked::after { display: none; }
    .${CB_CLASS}.${DONE_CLASS} {
      background: #15803d; border-color: #15803d;
      animation: tsc-done-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    }
    .${CB_CLASS}.${DONE_CLASS}::after {
      content: '';
      position: absolute;
      left: 6px; top: 3px;
      width: 4px; height: 10px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      animation: tsc-check-draw .35s cubic-bezier(.34,1.56,.64,1) .05s both;
    }
    .${CB_CLASS}.${FAIL_CLASS} {
      background: #dc2626; border-color: #dc2626;
      animation: tsc-done-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    }

    .${CB_CLASS}.${FAIL_CLASS}::before {
      content: '\\00d7';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      animation: tsc-fail-x .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .tsc-filtered { display: none !important; }
    .tsc-block-btn {
      position: absolute;
      right: 0; top: 2px;
      width: 22px; height: 22px;
      cursor: pointer;
      background: none;
      border: none;
      color: #6b6b73;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      z-index: 10;
      opacity: 0.7;
      transition: opacity .15s;
    }
    .tsc-block-btn:hover { opacity: 1; }
    @keyframes tsc-spin { to { transform: rotate(360deg); } }
    @keyframes tsc-check-draw {
      0%   { opacity: 0; transform: rotate(45deg) scale(0); }
      60%  { opacity: 1; transform: rotate(45deg) scale(1.3); }
      100% { opacity: 1; transform: rotate(45deg) scale(1); }
    }
    @keyframes tsc-done-pop {
      0%   { transform: scale(.85); }
      50%  { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    @keyframes tsc-fail-x {
      0%   { opacity: 0; transform: scale(0); }
      60%  { opacity: 1; transform: scale(1.25); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

async function processResults() {
  for (const selector of RESULT_SELECTORS) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      if (processedResults.has(el)) continue;
      processedResults.add(el);

      let link = null; let url = null;
      for (const ls of LINK_SELECTORS) {
        link = el.querySelector(ls);
        if (link?.href) { url = link.href; break; }
      }
      if (!url) continue;
      try {
        const h = new URL(url).hostname;
        if (h === 'www.google.com' || h.endsWith('.google.com') ||
            h === 'www.bing.com' || h === 'www.baidu.com' ||
            h.includes('duckduckgo.com') || h.includes('search.yahoo.com') ||
            h.includes('yandex.com') || h.includes('yandex.ru')) continue;
      } catch { continue; }

      if (isUrlBlacklisted(url)) {
        console.log('[Citecat] 黑名单隐藏:', url);
        el.classList.add('tsc-filtered');
        continue;
      }

      await addSearchCheckbox(el, url, link.textContent?.trim() || '');
    }
  }
}

async function addSearchCheckbox(container, url, title) {
  if (!container.classList.contains('tsc-result-wrapper')) {
    container.classList.add('tsc-result-wrapper');
  }
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = CB_CLASS;
  cb.title = '勾选以采集并总结此页面';
  cb.dataset.url = url;
  container.insertBefore(cb, container.firstChild);
  bindCollectEvent(cb, url, title);

  // Block button
  const blockBtn = document.createElement('button');
  blockBtn.className = 'tsc-block-btn';
  blockBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  blockBtn.title = '拉黑此域名';
  blockBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const domain = new URL(url).hostname;
      const result = await chrome.storage.sync.get('blacklist');
      const list = result.blacklist || [];
      if (!list.includes(domain)) {
        list.push(domain);
        await chrome.storage.sync.set({ blacklist: list });
      }
      container.classList.add('tsc-filtered');
    } catch (_) {}
  });
  container.appendChild(blockBtn);

  try {
    const resp = await safeSendMessage({
      type: 'CHECK_URL',
      data: { url },
    });
    if (resp?.collected) {
      cb.checked = true;
      cb.classList.add(DONE_CLASS);
      cb.title = '已采集';
    }
  } catch (_) {}
}

function isUrlBlacklisted(url) {
  if (!blacklist.length) return false;
  try {
    const hn = new URL(url).hostname.toLowerCase();
    return blacklist.some((p) => {
      const lp = p.toLowerCase();
      if (lp.startsWith('*.')) { const b = lp.slice(2); return hn === b || hn.endsWith('.' + b); }
      return hn === lp || hn.endsWith('.' + lp);
    });
  } catch { return false; }
}

function reprocessAll() {
  processedResults = new WeakSet();
  document.querySelectorAll(`.${CB_CLASS}`).forEach((c) => c.remove());
  document.querySelectorAll('.tsc-filtered').forEach((e) => e.classList.remove('tsc-filtered'));
  document.querySelectorAll('.tsc-result-wrapper').forEach((e) => e.classList.remove('tsc-result-wrapper'));
  processResults();
}

/* ======== 外观：跟随扩展设置（白天 / 黑夜 / 自动） ======== */
const themeHosts = [];
let pageThemeMode = 'auto';

function paintCitecatTheme(mode) {
  pageThemeMode = normalizeThemeMode(mode);
  const resolved = resolveTheme(pageThemeMode);
  document.documentElement.dataset.citecatTheme = resolved;
  for (const el of themeHosts) {
    if (el) el.dataset.theme = resolved;
  }
}

function registerThemeHost(el) {
  if (el && !themeHosts.includes(el)) themeHosts.push(el);
  paintCitecatTheme(pageThemeMode);
}

function initCitecatTheme() {
  loadThemeMode().then((mode) => paintCitecatTheme(mode)).catch(() => {});
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (pageThemeMode === 'auto') paintCitecatTheme('auto');
    });
  } catch (_) {}
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[THEME_KEY]) return;
      paintCitecatTheme(changes[THEME_KEY].newValue);
    });
  } catch (_) {}
}
initCitecatTheme();

/* ======== Regular page: floating button ======== */

async function createPageCheckbox() {
  // Skip non-HTML documents (XML/SVG/raw RSS/Atom feeds opened directly in the
  // browser, PDF viewers, etc.). In those cases createElement('div') doesn't
  // yield an HTMLElement and lacks a .style property, causing
  // "Cannot set properties of undefined (setting 'cssText')".
  if (!document.body || !(document.body instanceof HTMLElement)) return;
  if (document.contentType && !/html/i.test(document.contentType)) return;

  const host = document.createElement('div');
  if (!(host instanceof HTMLElement) || !host.style) return;
  host.id = 'tsc-global-container';
  host.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;align-items:center;gap:6px;' +
    'background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
    'border:1px solid rgba(0,0,0,0.08);border-radius:9999px;' +
    'box-shadow:0 1px 3px rgba(16,24,40,0.06),0 4px 12px rgba(16,24,40,0.05);' +
    'padding:6px 8px 6px 12px;' +
    'font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;font-size:13px;';

  const shadow = host.attachShadow({ mode: 'open' });
  registerThemeHost(host);
  const style = document.createElement('style');
  style.textContent = `
    /* 与 2026 设计系统一致：白色 + 蓝 accent + 细边框轻阴影 + 克制动效 */
    :host { transition: background 150ms cubic-bezier(0.16,1,0.3,1), border-color 150ms cubic-bezier(0.16,1,0.3,1); animation: panel-enter .5s cubic-bezier(0.34,1.25,0.64,1) both; }
    :host(:hover) { background: rgba(255,255,255,0.98); border-color: rgba(78,117,223,0.35); }

    .cb {
      width: 18px; height: 18px;
      min-width: 18px; max-width: 18px;
      min-height: 18px; max-height: 18px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      border: 2px solid rgba(0,0,0,0.14);
      border-radius: 50%;
      background: transparent;
      box-sizing: border-box; /* 18px 含边框，与 divider/按钮垂直居中对齐 */
      flex-shrink: 0;
      margin: 0; padding: 0;
      position: relative;
      transition: border-color 150ms cubic-bezier(0.16,1,0.3,1), background 150ms cubic-bezier(0.16,1,0.3,1);
    }
    .cb:hover { border-color: rgba(78,117,223,0.35); }
    .cb:checked { background: #4e75df; border-color: #4e75df; }
    .cb:checked::after {
      content: '';
      position: absolute;
      left: 4px; top: 2px;
      width: 4px; height: 8px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      animation: check-draw .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .cb.${LOADING_CLASS} {
      border-radius: 50%;
      border-color: rgba(78,117,223,0.15);
      border-top-color: #4e75df;
      background: transparent;
      animation: spin .7s linear infinite;
    }
    .cb.${LOADING_CLASS}:checked::after { display: none; }
    .cb.${DONE_CLASS} {
      background: #15803d; border-color: #15803d;
      animation: done-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    }
    .cb.${DONE_CLASS}::after {
      content: '';
      position: absolute;
      left: 4px; top: 2px;
      width: 4px; height: 8px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      animation: check-draw .35s cubic-bezier(.34,1.56,.64,1) .05s both;
    }
    .cb.${FAIL_CLASS} {
      background: #dc2626; border-color: #dc2626;
      animation: done-pop .4s cubic-bezier(.34,1.56,.64,1) both;
    }
    .cb.${FAIL_CLASS}::before {
      content: '\\00d7';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      animation: fail-x .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .divider { width: 1px; align-self: stretch; margin: 2px 0; background: rgba(0,0,0,0.08); flex-shrink: 0; }

    /* 检视模式开关 */
    .inspect-btn {
      width: 30px; height: 30px;
      border: none; border-radius: 50%;
      background: transparent; color: #6b6b73;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0; margin: 0;
      transition: background 150ms cubic-bezier(0.16,1,0.3,1),
                  color 150ms cubic-bezier(0.16,1,0.3,1),
                  transform 120ms cubic-bezier(0.34,1.15,0.64,1);
    }
    .inspect-btn:hover { background: rgba(78,117,223,0.08); color: #4e75df; }
    .inspect-btn:active { transform: scale(0.92); }
    .inspect-btn.active { background: #4e75df; color: #fff; }
    .inspect-btn.active:hover { background: #4267c4; color: #fff; }

    /* 浮动 UI（信息条/工具条/聊天窗）样式在 FLOAT_UI_CSS —— 独立 shadow，
       避免主 host 的 backdrop-filter 破坏 position:fixed 视口定位 */

    /* 深色页面适配 */
    
:host([data-theme="dark"]) {
        background: rgba(30,30,34,0.92) !important;
        border-color: rgba(255,255,255,0.10) !important;
        box-shadow: 0 8px 28px rgba(0,0,0,0.55) !important;
      }
:host([data-theme="dark"]):hover {
        background: rgba(38,38,43,0.98) !important;
        border-color: rgba(138,167,242,0.40) !important;
      }
:host([data-theme="dark"]) .cb { border-color: rgba(255,255,255,0.20); }
:host([data-theme="dark"]) .cb:hover { border-color: rgba(138,167,242,0.50); }
:host([data-theme="dark"]) .divider { background: rgba(255,255,255,0.10); }
:host([data-theme="dark"]) .inspect-btn { color: #9d9da6; }
:host([data-theme="dark"]) .inspect-btn:hover { background: rgba(138,167,242,0.14); color: #aac0f7; }
    

    @keyframes panel-enter {
      0%   { opacity: 0; transform: translateX(16px) scale(.92); filter: blur(8px) saturate(1.25); }
      100% { opacity: 1; transform: translateX(0) scale(1); filter: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none !important; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes check-draw {
      0%   { opacity: 0; transform: rotate(45deg) scale(0); }
      60%  { opacity: 1; transform: rotate(45deg) scale(1.3); }
      100% { opacity: 1; transform: rotate(45deg) scale(1); }
    }
    @keyframes done-pop {
      0%   { transform: scale(.85); }
      50%  { transform: scale(1.15); }
      100% { transform: scale(1); }
    }
    @keyframes fail-x {
      0%   { opacity: 0; transform: scale(0); }
      60%  { opacity: 1; transform: scale(1.25); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;

  shadow.appendChild(style);

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'cb';
  const isVideo = /(youtube\.com|youtu\.be|bilibili\.com|b23\.tv)/i.test(location.hostname);
  cb.title = isVideo ? '勾选以采集视频' : '勾选以采集此页面';

  const divider = document.createElement('span');
  divider.className = 'divider';

  const inspectBtn = document.createElement('button');
  inspectBtn.type = 'button';
  inspectBtn.className = 'inspect-btn';
  inspectBtn.title = '选择页面元素（检视模式）';
  inspectBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>';

  shadow.appendChild(cb);
  shadow.appendChild(divider);
  shadow.appendChild(inspectBtn);
  document.body.appendChild(host);

  initInspectUI(host, shadow, inspectBtn);

  bindCollectEvent(cb, null, null); // page mode: uses pageCollectUrl/Title

  // Check if this URL was already collected
  try {
    const resp = await safeSendMessage({
      type: 'CHECK_URL',
      data: { url: location.href },
    });
    if (resp?.collected) {
      cb.checked = true;
      cb.classList.add(DONE_CLASS);
      cb.title = '已采集';
    }
  } catch (_) {}

  /* drag to move（整颗胶囊可拖动；checkbox / 检视按钮上的按下不触发） */
  let dragging = false, sx, sy, il, it;
  host.addEventListener('mousedown', (e) => {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (t && t.classList && (t.classList.contains('cb') || t.classList.contains('inspect-btn'))) return;
    if (cb.checked && !cb.classList.contains(LOADING_CLASS)) return;
    dragging = true;
    const r = host.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY;
    il = r.left; it = r.top;
    host.style.right = 'auto';
    host.style.left = il + 'px';
    host.style.top = it + 'px';
    host.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    let l = il + (e.clientX - sx);
    let t = it + (e.clientY - sy);
    l = Math.max(0, Math.min(l, innerWidth - host.offsetWidth));
    t = Math.max(0, Math.min(t, innerHeight - host.offsetHeight));
    host.style.left = l + 'px';
    host.style.top = t + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    host.style.transition = '';
  });

  /* 视口尺寸变化（如拖动浏览器侧边栏改变网页宽度）：拖拽锚定（left/top）后
     重新夹取到可视区内 —— 否则多次缩放后按钮会跑到屏幕外被裁切，看起来"变形" */
  window.addEventListener('resize', () => {
    if (host.style.right !== 'auto') return; // right 锚定（未拖动过）：自动跟随右缘，无需处理
    const maxL = Math.max(0, window.innerWidth - host.offsetWidth);
    const maxT = Math.max(0, window.innerHeight - host.offsetHeight);
    const l = Math.max(0, Math.min(parseFloat(host.style.left) || 0, maxL));
    const t = Math.max(0, Math.min(parseFloat(host.style.top) || 0, maxT));
    host.style.left = l + 'px';
    host.style.top = t + 'px';
  });
}

/* ================================================================
 * 检视模式（inspect mode）：hover 描边 + 信息条，点击选中页面元素。
 * 第一阶段：仅提供选区交互（描边 + 标注工具条 UI），
 * 提问/荧光笔/下划线/收藏等能力后续接入（按钮先展示）。
 * ================================================================ */
const INSPECT = {
  host: null,
  shadow: null,
  floatShadow: null,
  btn: null,
  tipEl: null,
  barEl: null,
  popEl: null,
  toastEl: null,
  chatWin: null,
  toastTimer: null,
  enabled: false,
  lastTarget: null,
  prevOutline: null,
  prevOutlineOffset: null,
  // 标注工具条模式：'element'（检视选中元素）| 'text'（划词）
  barMode: 'element',
  lastSelectedEl: null,
  lastTextRange: null,
  // Ctrl 多选：已累计选中的元素（退出检视后仍可批量操作，clearMultiSelect 清空）
  multiEls: [],
  multiBarEl: null,
  multiFrameHost: null,
  replayAttempts: 0,
};

/* ---- 浮动 AI 聊天窗（划词/元素提问） ---- */
let chatPort = null;
let chatHistory = [];
let chatContext = null; // { label, text, system } —— 随时可被新的划选/元素选中重定向
let chatBusy = false;
let liveScopeQuiz = null;
let chatStreamText = '';
// 最近一次选区手势。划词不要被之前的检视多选抢走，反过来也一样。
let chatAskMode = ''; // 'text' | 'element' | 'multi'
let selPointer = null;
let selPointerAt = 0;
INSPECT.selRectIndex = 0;

function textChatContext() {
  if (!INSPECT.lastTextRange) return null;
  let raw = '';
  try { raw = INSPECT.lastTextRange.toString(); } catch (_) { return null; }
  const text = raw.trim().slice(0, 4000);
  if (!text) return null;
  return {
    kind: 'text',
    label: '选中文本',
    text,
    title: document.title,
    url: location.href,
    extra: '',
    system: '### 当前选区（页面划选/元素，本次提问的对象）\n选区类型：选中文本\n' + text,
  };
}

function multiChatContext() {
  const els = (INSPECT.multiEls || []).filter((el) => el && el.isConnected);
  if (!els.length) return null;
  const parts = els.map((el, i) => {
    const inner = (el.innerText || el.textContent || '').trim().slice(0, 800);
    let html = '';
    try { html = el.outerHTML.slice(0, 500); } catch (_) {}
    return `元素 ${i + 1}：标签 ${el.tagName.toLowerCase()}\n结构：${html}\n内容：\n"""\n${inner}\n"""`;
  });
  const text = parts.join('\n\n').slice(0, 6000);
  if (!text) return null;
  return {
    kind: 'multi',
    label: `已选 ${els.length} 个元素`,
    text,
    title: document.title,
    url: location.href,
    extra: '',
    system:
      '### 当前选区（页面划选/元素，本次提问的对象）\n选区类型：多个页面元素（Ctrl 多选）\n' + text,
  };
}

function elementChatContext() {
  const el = INSPECT.lastSelectedEl;
  if (!el || !el.isConnected) return null;
  const inner = (el.innerText || el.textContent || '').trim().slice(0, 3000);
  let html = '';
  try { html = el.outerHTML.slice(0, 1500); } catch (_) {}
  const cls = (typeof el.className === 'string' && el.className.trim())
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  const base =
    '### 当前选区（页面划选/元素，本次提问的对象）\n选区类型：页面元素\n' +
    `标签：${el.tagName.toLowerCase()}\n结构：${html}\n内容：\n"""\n${inner}\n"""\n页面标题：${document.title}\n页面地址：${location.href}`;
  return {
    kind: 'element',
    label: el.tagName.toLowerCase() + cls,
    text: inner,
    title: document.title,
    url: location.href,
    extra: chatChartData
      ? `\n\n该元素内图表的真实数据（已从图表实例读取）：\n"""\n${chatChartData}\n"""`
      : '',
    system: base + (chatChartData
      ? `\n\n该元素内图表的真实数据（已从图表实例读取）：\n"""\n${chatChartData}\n"""`
      : ''),
  };
}

function buildChatContext() {
  const order = chatAskMode === 'text'
    ? [textChatContext, elementChatContext, multiChatContext]
    : chatAskMode === 'element'
      ? [elementChatContext, textChatContext, multiChatContext]
      : chatAskMode === 'multi'
        ? [multiChatContext, elementChatContext, textChatContext]
        : [textChatContext, multiChatContext, elementChatContext];
  for (const read of order) {
    const ctx = read();
    if (ctx) return ctx;
  }
  return null;
}

/** 多行选区取离松开鼠标最近的那一行，工具条才跟得上划词终点 */
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

/** 选区/元素变化时刷新引用上下文；聊天窗打开时同步渲染 */
function updateChatContext() {
  const ctx = buildChatContext();
  if (!ctx) return;
  chatContext = ctx;
  chatChartData = null; // 新选区/新元素：旧的图表数据失效
  if (INSPECT.chatWin && INSPECT.chatWin.classList.contains('show')) {
    renderChatContext();
    renderElementData();
  }
}

let chatChartData = null; // 主世界读取的图表真实数据（读取后注入 AI 上下文）

function escHtmlText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 元素数据视图：DOM 树 / HTML 源码 / 图表 / 表格 / AI 将收到的提示词 */
function buildElementData(el) {
  const d = { dom: '', html: '', chart: null, table: null, tableSize: '', prompt: '' };
  try { d.dom = cssPath(el); } catch (_) {}
  try { d.html = el.outerHTML.slice(0, 4000); } catch (_) {}
  // 图表检测（自身 + 内部）
  let chart = detectChartInfo(el);
  if (!chart && el.querySelector) {
    const inner = el.querySelector('[_echarts_instance_], canvas[class*="chart" i], canvas[class*="dashboard" i], canvas[class*="graph" i]');
    if (inner) chart = inner.tagName.toLowerCase() === 'canvas' ? 'canvas 图表' : 'ECharts（内部）';
  }
  d.chart = chart;
  // 表格
  const table = (el.matches && el.matches('table')) ? el : (el.querySelector ? el.querySelector('table') : null);
  if (table) {
    try {
      const md = tableToMarkdown(table);
      d.table = md;
      const rows = table.rows ? table.rows.length : 0;
      const cols = table.rows && table.rows[0] ? table.rows[0].cells.length : 0;
      d.tableSize = rows + '×' + cols;
    } catch (_) {}
  }
  return d;
}

function renderElementData() {
  const win = INSPECT.chatWin;
  if (!win) return;
  const dataEl = win.querySelector('.cw-data');
  const el = INSPECT.lastSelectedEl;
  if (!el) {
    dataEl.innerHTML = '<div class="cw-data-empty">选中页面元素后可查看其 DOM 路径 / HTML 源码 / 图表与表格数据。</div>';
    return;
  }
  const d = buildElementData(el);
  let html = '';

  if (d.chart) {
    html +=
      '<div class="cw-ds"><div class="cw-ds-head">' +
        '<span class="cw-ds-title">图表</span><span class="cw-ds-badge">' + escHtmlText(d.chart) + '</span>' +
        '<button class="cw-ds-btn" data-act="chart">读取数据</button>' +
      '</div><pre class="cw-ds-pre collapsed" data-chart-out></pre></div>';
  }
  if (d.table) {
    html +=
      '<div class="cw-ds"><div class="cw-ds-head">' +
        '<span class="cw-ds-title">表格</span><span class="cw-ds-badge">' + escHtmlText(d.tableSize) + '</span>' +
        '<button class="cw-ds-btn" data-act="toggle">展开</button>' +
      '</div><pre class="cw-ds-pre collapsed">' + escHtmlText(d.table) + '</pre></div>';
  }
  html +=
    '<div class="cw-ds"><div class="cw-ds-head"><span class="cw-ds-title">DOM 路径</span></div>' +
    '<div class="cw-ds-dom">' + escHtmlText(d.dom) + '</div></div>';
  html +=
    '<div class="cw-ds"><div class="cw-ds-head">' +
      '<span class="cw-ds-title">HTML 源码</span><button class="cw-ds-btn" data-act="toggle">展开</button>' +
    '</div><pre class="cw-ds-pre collapsed">' + escHtmlText(d.html) + '</pre></div>';
  html +=
    '<div class="cw-ds"><div class="cw-ds-head">' +
      '<span class="cw-ds-title">AI 将收到</span><button class="cw-ds-btn" data-act="toggle">展开</button>' +
    '</div><pre class="cw-ds-pre collapsed">' + escHtmlText(chatContext && chatContext.system ? chatContext.system : '') + '</pre></div>';

  dataEl.innerHTML = html;

  dataEl.querySelectorAll('[data-act="toggle"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pre = btn.parentElement.nextElementSibling;
      // 与引用块同款 WAAPI 高度动画（spring 非线性）
      const from = pre.getBoundingClientRect().height;
      pre.classList.toggle('collapsed');
      const to = pre.getBoundingClientRect().height;
      if (from !== to) {
        pre.animate(
          [{ height: from + 'px' }, { height: to + 'px' }],
          { duration: 280, easing: 'cubic-bezier(0.34, 1.25, 0.64, 1)' },
        );
      }
      btn.textContent = pre.classList.contains('collapsed') ? '展开' : '收起';
    });
  });
  const chartBtn = dataEl.querySelector('[data-act="chart"]');
  if (chartBtn) {
    chartBtn.addEventListener('click', () => extractChartData(el, dataEl.querySelector('[data-chart-out]')));
  }
}

/** 主世界读取图表实例（ECharts option / Chart.js data），并注入 AI 上下文 */
async function extractChartData(el, outEl) {
  if (!outEl) return;
  outEl.textContent = '读取中…';
  outEl.classList.remove('collapsed');
  const resp = await chrome.runtime.sendMessage({
    type: 'EXTRACT_CHART_DATA',
    data: { selector: cssPath(el) },
  }).catch(() => null);
  if (resp && resp.success && resp.result && resp.result.ok) {
    const d = String(resp.result.data || '');
    outEl.textContent = d.length > 30000 ? d.slice(0, 30000) + '\n…（已截断）' : d;
    chatChartData = d;
  } else {
    outEl.textContent = '读取失败：' + ((resp && (resp.result ? resp.result.error : resp.error)) || '未知错误');
    outEl.classList.add('collapsed');
  }
}

/** 引用内容块：让用户确认 AI 正在看什么 */
function renderChatContext() {
  const win = INSPECT.chatWin;
  if (!win || !chatContext) return;
  win.querySelector('.cw-label').textContent = 'AI 对象：' + chatContext.label;
  const body = win.querySelector('.cw-ctx-body');
  const text = chatContext.text || '';
  body.textContent = text;
  body.classList.remove('expanded');
  const toggle = win.querySelector('.cw-ctx-toggle');
  toggle.textContent = text.length > 120 ? '展开' : '';
}

async function openChatWindow() {
  if (!(await requireLicense())) return;
  updateChatContext();
  if (!chatContext || !INSPECT.chatWin) return;
  hideSelectionBar();
  const win = INSPECT.chatWin;

  // 已打开：仅重定向引用（对话历史保留）
  if (win.classList.contains('show')) {
    renderChatContext();
    win.querySelector('.cw-input input').focus();
    return;
  }

  let rect = null;
  if (chatAskMode === 'text' && INSPECT.lastTextRange) {
    rect = pickSelectionRect(INSPECT.lastTextRange, null, INSPECT.selRectIndex).rect;
  } else if (chatAskMode === 'multi' && INSPECT.multiEls.length > 0) {
    rect = multiUnionRect();
  } else if (chatAskMode === 'element' && INSPECT.lastSelectedEl) {
    rect = INSPECT.lastSelectedEl.getBoundingClientRect();
  } else if (INSPECT.lastTextRange) {
    rect = pickSelectionRect(INSPECT.lastTextRange, null, INSPECT.selRectIndex).rect;
  } else if (INSPECT.multiEls.length > 0) {
    rect = multiUnionRect();
  } else if (INSPECT.lastSelectedEl) {
    rect = INSPECT.lastSelectedEl.getBoundingClientRect();
  }
  if (!rect) {
    rect = { left: 16, top: 72, bottom: 96, width: 24 };
  }
  const w = 380, h = 420;
  let left = Math.min(Math.max(8, rect.left), window.innerWidth - w - 8);
  let top = rect.bottom + 10;
  if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 10);
  win.style.left = left + 'px';
  win.style.top = top + 'px';
  win.classList.remove('cw-min');
  win.classList.add('show');

  // 重置会话
  chatHistory = [];
  chatBusy = false;
  chatStreamText = '';
  chatChartData = null;
  // 重置 tab 到「引用内容」
  win.querySelectorAll('.cw-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'ctx'));
  win.querySelector('.cw-ctx').style.display = '';
  win.querySelector('.cw-data').style.display = 'none';
  renderChatContext();
  const body = win.querySelector('.cw-body');
  body.innerHTML = '';
  win.querySelector('.cw-input input').value = '';
  updateSendBtn();

  // 建立 SW 长连接（流式回传；SW 侧与侧栏 AI 完全平价：同提示词/工具/上下文）
  if (chatPort) { try { chatPort.disconnect(); } catch (_) {} }
  chatPort = chrome.runtime.connect({ name: 'ann-chat' });
  chatPort.onMessage.addListener(handleChatPortMessage);
  chatPort.onDisconnect.addListener(handleChatPortDisconnect);
  setTimeout(() => win.querySelector('.cw-input input').focus(), 60);
}

/* SW 端口消息统一处理（openChatWindow 注册 + 断线后 sendChatMessage 自动重连共用） */
function handleChatPortMessage(m) {
  if (m.type === 'chunk') appendAiChunk(m.text);
  else if (m.type === 'done') {
    if (m.aborted && chatStreamText && !/\(已中断\)\s*$/.test(chatStreamText)) {
      chatStreamText += '\n\n(已中断)';
    }
    try { finishAiChunk(); }
    catch (err) {
      console.warn('[Citecat] finish float chat failed', err);
      chatBusy = false;
      updateSendBtn();
    }
    // SW 维护的权威历史（含 assistant + tool 消息）回传覆盖本地，保证跨轮一致
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

/* 断线兜底：SW 重启/崩溃后端口失效，清空引用让下次发送自动重连（否则
   postMessage 抛 "disconnected port" 异常，消息丢失且无任何反馈） */
function handleChatPortDisconnect() {
  chatPort = null;
  chatBusy = false;
  updateSendBtn();
}

function closeChatWindow() {
  if (!INSPECT.chatWin) return;
  INSPECT.chatWin.classList.remove('show');
  if (chatPort) { try { chatPort.disconnect(); } catch (_) {} chatPort = null; }
  chatBusy = false;
  updateSendBtn();
}

function dragChatWin(e) {
  const win = INSPECT.chatWin;
  if (!win) return;
  const sx = e.clientX, sy = e.clientY;
  const il = win.offsetLeft, it = win.offsetTop;
  const onMove = (ev) => {
    const maxL = Math.max(8, window.innerWidth - win.offsetWidth - 8);
    win.style.left = Math.min(Math.max(8, il + ev.clientX - sx), maxL) + 'px';
    win.style.top = Math.min(Math.max(8, it + ev.clientY - sy), window.innerHeight - 60) + 'px';
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

/** 发送 ↔ 停止按钮切换（chatBusy 时点击发送 = 中止本次回答） */
function updateSendBtn() {
  const win = INSPECT.chatWin;
  if (!win) return;
  const btn = win.querySelector('.cw-send');
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
  const win = INSPECT.chatWin;
  if (!win || chatBusy) return;
  // 断线自动重连（SW 重启后旧端口已失效；handleChatPortDisconnect 置 null）
  if (!chatPort) {
    try {
      chatPort = chrome.runtime.connect({ name: 'ann-chat' });
      chatPort.onMessage.addListener(handleChatPortMessage);
      chatPort.onDisconnect.addListener(handleChatPortDisconnect);
    } catch (_) { return; }
  }
  const input = win.querySelector('.cw-input input');
  const text = input.value.trim();
  if (!text) return;
  skipLiveScopeQuiz(text);
  input.value = '';
  chatHistory.push({ role: 'user', content: text });
  const body = win.querySelector('.cw-body');
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
  ai.innerHTML = '<div class="cw-msg-label">Citecat</div>' +
    '<div class="cw-subagents"></div>' +
    '<p class="cw-stream"></p>' +
    '<div class="cw-thinking-row"><span class="cw-thinking-orb"></span><span class="cw-thinking-text">Thinking</span></div>';
  body.appendChild(ai);
  INSPECT.chatStreamEl = ai.querySelector('.cw-stream');
  mountChatOrb(ai.querySelector('.cw-thinking-orb'), 'working');
  body.scrollTop = body.scrollHeight;
  chatBusy = true;
  chatStreamText = '';
  updateSendBtn();
  armChatWatchdog();
  // 不再本地拼 system：SW 侧注入完整静态提示词 + 动态前言；这里只附选区上下文
  chatPort.postMessage({
    type: 'CHAT',
    messages: chatHistory,
    context: chatContext ? {
      kind: chatContext.kind,
      text: chatContext.text,
      extra: chatContext.extra,
      system: chatContext.system,
    } : null,
  });
}

/* ---- 思考 orb（与侧边栏同一套 thinking-orbs 动画）---- */
let chatOrbRoot = null; // ThinkingOrb 的 React root
let chatOrbApi = null; // { createElement, createRoot, ThinkingOrb }
let chatOrbApiPromise = null;
let chatOrbState = 'working';
let chatWatchdogTimer = 0;
const CHAT_WATCHDOG_MS = 120000; // 静默超过这个时间先提示，再静默一轮才判定卡死

function loadChatOrbApi() {
  if (!chatOrbApiPromise) {
    chatOrbApiPromise = Promise.all([
      import('react'),
      import('react-dom/client'),
      import('thinking-orbs'),
    ]).then(([react, rdom, orbs]) => {
      chatOrbApi = {
        createElement: react.createElement,
        createRoot: rdom.createRoot,
        ThinkingOrb: orbs.ThinkingOrb,
      };
      return chatOrbApi;
    });
  }
  return chatOrbApiPromise;
}

function renderChatOrb(state) {
  if (!chatOrbRoot || !chatOrbApi) return;
  chatOrbRoot.render(chatOrbApi.createElement(chatOrbApi.ThinkingOrb, {
    state,
    size: 20,
    theme: 'auto',
    'aria-label': 'AI 思考中',
  }));
}

function mountChatOrb(el, state) {
  unmountChatOrb();
  if (!el) return;
  chatOrbState = state || 'working';
  loadChatOrbApi().then((api) => {
    if (!el.isConnected) return;
    try {
      chatOrbRoot = api.createRoot(el);
      renderChatOrb(chatOrbState);
    } catch (_) {
      chatOrbRoot = null;
    }
  }).catch(() => {});
}

function setChatOrbState(state) {
  chatOrbState = state;
  if (!chatOrbRoot) return;
  try { renderChatOrb(state); } catch (_) {}
}

/* orb 右侧的 shimmer 文字（Thinking / 工具状态 label / 工具错误） */
function setChatThinkingText(text, isError) {
  const stream = INSPECT.chatStreamEl;
  const root = (stream && stream.closest('.cw-msg.ai')) || INSPECT.chatWin;
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

/** 推理模型首 token 经常超过 1 分钟。先改提示，再静默一轮才拆掉本轮，避免误杀正在思考的回答。 */
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

function handleSubagentEvent(card) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
  if (!body || !card) return;
  armChatWatchdog();
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (ai) upsertSubagentCardEl(ai, card, 'cw');
  body.scrollTop = body.scrollHeight;
}

function handleToolEvent(status, label, toolName) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
  if (!body) return;
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

/* 建议按钮（suggest_actions 工具）：点击 = 把该动作当作一条用户消息发送 */
function renderSuggestionChips(suggestions) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
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
      const input = win.querySelector('.cw-input input');
      input.value = label;
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
  const win = INSPECT.chatWin;
  const host = win && win.querySelector('.scope-quiz-host');
  if (host) attachScopeQuiz(host, liveScopeQuiz, { compact: true });
}

function renderScopeQuiz(quiz) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
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
    const input = win.querySelector('.cw-input input');
    if (!input) return;
    input.value = text;
    sendChatMessage();
  };
  attachScopeQuiz(host, quiz, { compact: true, onComplete: send });
  body.scrollTop = body.scrollHeight;
}

function appendFloatImage(image) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
  if (!body || !image || !image.dataUrl) return;
  armChatWatchdog();
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  let stack = ai.querySelector('.chat-placed-images');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'chat-placed-images';
    const before = ai.querySelector('.chat-live-charts')
      || ai.querySelector('.cw-thinking-row')
      || ai.querySelector('.scope-quiz-host');
    if (before) ai.insertBefore(stack, before);
    else ai.appendChild(stack);
  }
  if (stack.querySelector(`[data-placed-id="${image.id}"]`)) return;
  const img = document.createElement('img');
  img.dataset.placedId = image.id;
  img.src = image.dataUrl;
  img.alt = image.alt || '';
  stack.appendChild(img);
  body.scrollTop = body.scrollHeight;
}

function appendFloatChart(chart) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
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

/* 任务清单卡：整窗一张，来新状态就地替换（与侧栏同款单实例语义）；plan=null 表示清空 */
function upsertFloatPlan(plan) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
  if (!body) return;
  if (!plan || !plan.items || !plan.items.length) {
    body.querySelectorAll('.cw-plan[data-plan-card]').forEach((el) => el.remove());
    return;
  }
  body.querySelectorAll('.cw-plan[data-plan-card]').forEach((el) => el.remove());
  const ai = body.querySelector('.cw-msg.ai:last-of-type');
  if (!ai) return;
  upsertPlanCardEl(ai, plan, 'cw');
  body.scrollTop = body.scrollHeight;
}

/* 文档修改卡：同一文档一张，多次编辑就地累加 */
function upsertFloatDocEdit(card) {
  const win = INSPECT.chatWin;
  const body = win && win.querySelector('.cw-body');
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

/* clear_context 工具后：清空消息区并回到欢迎语 */
function resetChatBody() {
  liveScopeQuiz = null;
  const win = INSPECT.chatWin;
  if (!win) return;
  // 先卸 React root，再 innerHTML 拆掉 orb 容器，否则 removeChild 抛 NotFoundError
  unmountChatOrb();
  INSPECT.chatStreamEl = null;
  chatStreamText = '';
  const body = win.querySelector('.cw-body');
  disposeChatCharts(body);
  body.innerHTML =
    '<div class="cw-msg ai"><div class="cw-msg-label">Citecat</div><p>对话上下文已清空。可以继续追问这段内容。</p></div>';
}

function appendAiChunk(t) {
  const el = INSPECT.chatStreamEl;
  if (!el) return;
  // 首 chunk 到达：orb 全程常驻（切回 working、清空右侧状态文字），正文填下方容器
  if (chatOrbRoot) {
    setChatOrbState('working');
    setChatThinkingText('');
  }
  armChatWatchdog();
  chatStreamText += t;
  el.textContent = chatStreamText;
  const ai = el.closest('.cw-msg.ai');
  if (ai) syncLiveTurnOrder(ai, 'cw');
  const body = INSPECT.chatWin?.querySelector('.cw-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function removeThinkingRow(fromEl) {
  const root = (fromEl && fromEl.closest && fromEl.closest('.cw-msg.ai'))
    || (INSPECT.chatWin && INSPECT.chatWin.querySelector('.cw-msg.ai:last-of-type'));
  const row = root && root.querySelector('.cw-thinking-row');
  if (row) row.remove();
}

function finishAiChunk() {
  const el = INSPECT.chatStreamEl;
  if (el) el.textContent = chatStreamText;
  // 先卸 React root 再移除 .cw-thinking-row（里面是 orb 容器），否则 removeChild 抛 NotFoundError，
  // chatBusy 永远停在 true，发送按钮卡在停止。
  unmountChatOrb();
  removeThinkingRow(el);
  clearChatWatchdog();
  // 不在这里 push assistant：SW 的 done 会回传权威历史（含工具消息），
  // done 分支用 m.messages 覆盖 chatHistory。
  chatBusy = false;
  INSPECT.chatStreamEl = null;
  updateSendBtn();
}

function failAiChunk(err) {
  const el = INSPECT.chatStreamEl;
  if (el) {
    const e = document.createElement('div');
    e.className = 'cw-err';
    e.textContent = '出错了：' + (err || '未知错误');
    el.parentElement.appendChild(e);
  }
  unmountChatOrb();
  removeThinkingRow(el);
  clearChatWatchdog();
  // 出错路径若 SW 没带回历史，本地补一条保证连续性；带回时由调用方覆盖
  if (chatStreamText) chatHistory.push({ role: 'assistant', content: chatStreamText });
  chatBusy = false;
  INSPECT.chatStreamEl = null;
  updateSendBtn();
}

/* 浮动 UI 样式：独立 shadow 内使用。注意：不能放进带 backdrop-filter 的
   主 host 的 shadow —— backdrop-filter 会让 position:fixed 子元素以 host
   为包含块而非视口（工具条/信息条/聊天窗会定位到胶囊上，用户看不见）。 */

function initInspectUI(host, shadow, btn) {
  INSPECT.host = host;
  INSPECT.shadow = shadow;
  INSPECT.btn = btn;

  // 浮动 UI 独立 host（无 backdrop-filter / transform，fixed 子元素以视口定位）
  const floatHost = document.createElement('div');
  floatHost.id = 'tsc-float-container';
  document.body.appendChild(floatHost);
  const floatShadow = floatHost.attachShadow({ mode: 'open' });
  INSPECT.floatShadow = floatShadow;
  const floatStyle = document.createElement('style');
  floatStyle.textContent = FLOAT_UI_CSS;
  floatShadow.appendChild(floatStyle);
  registerThemeHost(floatHost);

  // 检视信息条（悬停时显示 tag/class/尺寸）
  const tip = document.createElement('div');
  tip.className = 'inspect-tip';
  floatShadow.appendChild(tip);
  INSPECT.tipEl = tip;

  // 标注工具条（检视选中元素 / 划词共用）
  const bar = document.createElement('div');
  bar.className = 'sel-bar';
  bar.style.display = 'none';
  bar.innerHTML =
    '<button class="sel-btn primary" data-act="ask">AI</button>' +
    '<button class="sel-btn" data-act="collect">收藏</button>';
  // 关键：mousedown preventDefault 防止点击工具条导致选区丢失
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  bar.addEventListener('click', (e) => {
    const act = e.target.closest('.sel-btn')?.dataset.act;
    if (!act) return;
    if (act === 'ask') {
      chatAskMode = INSPECT.barMode === 'text' ? 'text' : 'element';
      openChatWindow();
      return;
    }
    hideSelectionBar();
    if (act === 'collect') {
      if (INSPECT.barMode === 'text') collectTextSnippet();
      else collectElementSnippet();
    }
  });
  floatShadow.appendChild(bar);
  INSPECT.barEl = bar;

  // 标注（mark）点击浮层：收藏 / 删除
  const pop = document.createElement('div');
  pop.className = 'sel-bar';
  pop.style.display = 'none';
  pop.innerHTML =
    '<div class="ann-note" hidden></div>' +
    '<button class="sel-btn primary" data-act="collect">收藏</button>' +
    '<button class="sel-btn" data-act="del">删除</button>';
  pop.addEventListener('mousedown', (e) => e.preventDefault());
  pop.addEventListener('click', (e) => {
    const act = e.target.closest('.sel-btn')?.dataset.act;
    const id = pop.dataset.annId;
    const url = pop.dataset.url;
    if (!act || !id) return;
    hideAnnPopover();
    if (act === 'del') {
      deleteAnnotation(url, id).then(() => {
        unwrapMarks(`mark[data-ann-id="${CSS.escape(id)}"]`); // 解包，保留原文
        removeAnnotationNoteBlock(id); // 段后批注块联动移除
        document.querySelectorAll(`[data-ann-el="${CSS.escape(id)}"]`).forEach((m) => m.classList.remove('citecat-el-hl', 'citecat-el-ul'));
        // 联动：侧栏里关联的 snippet 条目同步删除（SW 幂等处理）
        safeSendMessage({ type: 'DELETE_SNIPPET_BY_ANNOTATION', data: { annotationId: id } }).catch(() => {});
      });
    } else if (act === 'collect') {
      getAnnotationsForUrl(url).then((list) => {
        const ann = list.find((a) => a.id === id);
        if (!ann) return;
        if (ann.entryId) return;
        collectAnnotationAsSnippet(ann, url);
      });
    }
  });
  floatShadow.appendChild(pop);
  INSPECT.popEl = pop;

  // 轻提示
  const toast = document.createElement('div');
  toast.className = 'mini-toast';
  floatShadow.appendChild(toast);
  INSPECT.toastEl = toast;

  // 检视多选框层（Ctrl+点击 累计选中元素；fixed 框随滚动重绘）
  const frameHost = document.createElement('div');
  frameHost.id = 'tsc-multi-frames';
  floatShadow.appendChild(frameHost);
  INSPECT.multiFrameHost = frameHost;

  // 多选操作条（元素级批量操作：AI / 收藏 / 清除）
  const multiBar = document.createElement('div');
  multiBar.className = 'multi-bar';
  multiBar.style.display = 'none';
  multiBar.innerHTML =
    '<span class="mb-count"></span>' +
    '<button class="mb-btn primary" data-act="ask">AI</button>' +
    '<button class="mb-btn" data-act="collect">收藏</button>' +
    '<button class="mb-btn danger" data-act="clear" title="清除多选">&times;</button>';
  multiBar.addEventListener('mousedown', (e) => e.preventDefault());
  multiBar.addEventListener('click', (e) => {
    const act = e.target.closest('.mb-btn')?.dataset.act;
    if (!act) return;
    if (act === 'clear') { clearMultiSelect(); return; }
    if (act === 'ask') {
      chatAskMode = 'multi';
      hideMultiBar();
      openChatWindow();
      return;
    }
    if (act !== 'collect') return;
    const els = [...INSPECT.multiEls];
    INSPECT.lastSelectedEl = els[0] || null;
    const run = async () => {
      try {
        for (const el of els) {
          INSPECT.lastSelectedEl = el;
          await collectElementSnippet();
        }
      } catch (err) {
        showMiniToast('批量收藏失败：' + (err.message || '未知错误'));
      }
    };
    run();
  });
  floatShadow.appendChild(multiBar);
  INSPECT.multiBarEl = multiBar;

  // ---- 浮动 AI 聊天窗 ----
  const chatWin = document.createElement('div');
  chatWin.className = 'chat-win';
  chatWin.innerHTML =
    '<div class="cw-head">' +
      '<span class="cw-dot"></span>' +
      '<span class="cw-label">AI 对象</span>' +
      '<div class="cw-actions">' +
        '<button class="cw-btn" data-act="min" title="最小化">&minus;</button>' +
        '<button class="cw-btn" data-act="close" title="关闭">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div class="cw-tabs">' +
      '<button class="cw-tab active" data-tab="ctx">引用内容</button>' +
      '<button class="cw-tab" data-tab="data">元素数据</button>' +
    '</div>' +
    '<div class="cw-ctx">' +
      '<div class="cw-ctx-head"><button class="cw-ctx-toggle" title="展开/收起">展开</button></div>' +
      '<div class="cw-ctx-body"></div>' +
    '</div>' +
    '<div class="cw-data"></div>' +
    '<div class="cw-body"></div>' +
    '<div class="cw-input">' +
      '<div class="ci-wrap"><input type="text" placeholder="继续追问这段内容…（Enter 发送）"></div>' +
      '<button class="cw-send" title="发送">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>' +
      '</button>' +
    '</div>';
  chatWin.querySelector('.cw-head').addEventListener('mousedown', (e) => {
    if (e.target.closest('.cw-btn')) return;
    if (isChatResizeEdge(chatWin, e)) return;
    dragChatWin(e);
  });
  chatWin.querySelector('[data-act="min"]').addEventListener('click', () => {
    const min = chatWin.classList.toggle('cw-min');
    // 最小化用 40px 压过拖边框时写下的 max-height:none；恢复时把拖出来的高度还回去
    if (min) chatWin.style.maxHeight = '40px';
    else if (chatWin._resized) chatWin.style.maxHeight = 'none';
    else chatWin.style.maxHeight = '';
    if (!min) {
      // 恢复时确保 body/input 可见（防御性：万一 inline display 残留）
      const body = chatWin.querySelector('.cw-body');
      const input = chatWin.querySelector('.cw-input');
      if (body) body.style.display = '';
      if (input) input.style.display = '';
    }
  });
  chatWin.querySelector('[data-act="close"]').addEventListener('click', () => closeChatWindow());
  chatWin.querySelector('.cw-send').addEventListener('click', () => {
    if (chatBusy) stopChat();
    else sendChatMessage();
  });
  chatWin.querySelector('.cw-input input').addEventListener('keydown', (e) => {
    // 中文输入法选词的 Enter 不是发送
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  bindChatResize(chatWin);
  chatWin.querySelector('.cw-ctx-toggle').addEventListener('click', (e) => {
    const body = chatWin.querySelector('.cw-ctx-body');
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
  chatWin.querySelectorAll('.cw-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      chatWin.querySelectorAll('.cw-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isData = tab.dataset.tab === 'data';
      chatWin.querySelector('.cw-ctx').style.display = isData ? 'none' : '';
      chatWin.querySelector('.cw-data').style.display = isData ? '' : 'none';
      if (isData) renderElementData();
    });
  });
  floatShadow.appendChild(chatWin);
  INSPECT.chatWin = chatWin;

  btn.addEventListener('click', () => {
    
    if (INSPECT.enabled) exitInspectMode();
    else enterInspectMode();
  });

  // ---- 划词工具条（文本选择：selectionchange 驱动，鼠标/键盘选区都覆盖）----
  document.addEventListener('selectionchange', onTextSelectChange);
  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    selPointer = { x: e.clientX, y: e.clientY };
    selPointerAt = Date.now();
  }, true);
  document.addEventListener('scroll', repositionSelectionBar, true);
  window.addEventListener('resize', repositionSelectionBar);
  // 标注（mark）点击
  document.addEventListener('click', onMarkClick, true);
}

let selBarTimer = null;

function onTextSelectChange() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    if (INSPECT.barMode === 'text') hideSelectionBar();
    return;
  }
  clearTimeout(selBarTimer);
  selBarTimer = setTimeout(tryShowSelectionBar, 250); // debounce：拖选过程中不重复弹
}

function tryShowSelectionBar() {
  if (INSPECT.enabled) return; // 检视模式优先
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.toString().trim()) return;
  const anchor = sel.anchorNode;
  if (!anchor || (anchor.nodeType === 3 && anchor.parentElement && isOwnUi(anchor.parentElement)) ||
      (anchor.nodeType === 1 && isOwnUi(anchor))) {
    return;
  }
  const range = sel.getRangeAt(0);
  const pointer = (Date.now() - selPointerAt < 1500) ? selPointer : null;
  const picked = pickSelectionRect(range, pointer);
  if (!picked.rect || (picked.rect.width === 0 && picked.rect.height === 0)) return;
  INSPECT.barMode = 'text';
  chatAskMode = 'text';
  INSPECT.selRectIndex = picked.index;
  INSPECT.lastTextRange = range.cloneRange();
  INSPECT.lastSelectedEl = null;
  showSelectionBarAtRect(picked.rect);
  updateChatContext(); // 聊天窗打开时：随时划新内容，引用同步更新
}

function repositionSelectionBar(e) {
  const t = e && e.target;
  const host = document.getElementById('tsc-float-container');
  if (host && t && (t === host || host.contains(t))) return;
  const bar = INSPECT.barEl;
  if (!bar || bar.style.display === 'none') return;
  if (INSPECT.barMode === 'text' && INSPECT.lastTextRange) {
    const picked = pickSelectionRect(INSPECT.lastTextRange, null, INSPECT.selRectIndex);
    if (!picked.rect || (picked.rect.width === 0 && picked.rect.height === 0)) return;
    showSelectionBarAtRect(picked.rect);
    return;
  }
  const el = INSPECT.lastSelectedEl;
  if (el && el.isConnected) showSelectionBarAtRect(el.getBoundingClientRect());
}

function onMarkClick(e) {
  if (!e.target || !e.target.closest) return;
  const pop = INSPECT.popEl;
  // 浮层/自有 UI 内的点击交给它们自己的监听；其余非标注点击收起浮层
  const floatHost = document.getElementById('tsc-float-container');
  const inFloatUi = (floatHost && (e.target === floatHost || floatHost.contains(e.target))) || isOwnUi(e.target);
  // 文本标注 mark 与元素标注（citecat-el-hl/ul，图表等元素）都可点开浮层
  const mark = e.target.closest('mark.citecat-hl, mark.citecat-ul, .citecat-el-hl, .citecat-el-ul, [data-ann-el]');
  if (!mark) {
    if (!inFloatUi) hideAnnPopover(); // 点击页面其他位置：关闭浮层
    return;
  }
  if (isOwnUi(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  const id = mark.dataset.annId || mark.dataset.annEl;
  // 再次点击同一标注：收起浮层（toggle）
  if (pop && pop.style.display !== 'none' && pop.dataset.annId === id) {
    hideAnnPopover();
    return;
  }
  showAnnPopover(mark, e);
}

function showAnnPopover(mark, e) {
  const pop = INSPECT.popEl;
  // 文本标注存 data-ann-id；元素标注（图表等）存 data-ann-el
  const id = mark.dataset.annId || mark.dataset.annEl;
  const url = normalizeUrl(location.href);
  pop.dataset.annId = id;
  pop.dataset.url = url;
  getAnnotationsForUrl(url).then((list) => {
    const ann = list.find((a) => a.id === id);
    const collectBtn = pop.querySelector('[data-act="collect"]');
    if (ann && ann.entryId) collectBtn.textContent = '已入库';
    else collectBtn.textContent = '收藏';
    // 批注说明（note）：正文里已有内嵌批注块时不重复显示（PDF/异常情况才在浮层补显）
    const noteEl = pop.querySelector('.ann-note');
    const inlineBlock = document.querySelector(`[data-note-for="${CSS.escape(id)}"]`);
    const hasNote = !!(ann && ann.note && !inlineBlock);
    if (noteEl) {
      noteEl.textContent = ann && ann.note && !inlineBlock ? ann.note : '';
      noteEl.hidden = !hasNote;
    }
    pop.classList.toggle('has-note', hasNote);
    const r = mark.getBoundingClientRect();
    const w = hasNote ? 220 : 148;
    const h = hasNote ? 86 : 40;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight) top = r.top - h;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.display = 'flex';
  });
}

function hideAnnPopover() {
  if (INSPECT.popEl) INSPECT.popEl.style.display = 'none';
}

function enterInspectMode() {
  
  INSPECT.enabled = true;
  INSPECT.btn.classList.add('active');
  INSPECT.btn.title = '退出检视';
  clearMultiSelect();
  document.addEventListener('mouseover', onInspectHover, true);
  document.addEventListener('mouseout', onInspectOut, true);
  document.addEventListener('click', onInspectClick, true);
  document.addEventListener('contextmenu', onInspectContextmenu, true);
  document.addEventListener('keydown', onInspectKey, true);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
}

function exitInspectMode() {
  if (!INSPECT.enabled) return;
  INSPECT.enabled = false;
  INSPECT.btn.classList.remove('active');
  INSPECT.btn.title = '选择元素';
  clearInspectOutline();
  document.removeEventListener('mouseover', onInspectHover, true);
  document.removeEventListener('mouseout', onInspectOut, true);
  document.removeEventListener('click', onInspectClick, true);
  document.removeEventListener('contextmenu', onInspectContextmenu, true);
  document.removeEventListener('keydown', onInspectKey, true);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
}

// 滚动/缩放时重绘多选框（保持与元素实际位置同步）
function onViewportChange() {
  if (INSPECT.multiEls.length > 0) renderMultiFrames();
}

function isOwnUi(el) {
  return el === INSPECT.host || (INSPECT.host && INSPECT.host.contains(el));
}

function onInspectHover(e) {
  if (!INSPECT.enabled) return;
  const el = e.target;
  if (!el || el === document.documentElement || el === document.body ||
      el.tagName === 'IFRAME' || isOwnUi(el)) {
    clearInspectOutline();
    return;
  }
  if (el === INSPECT.lastTarget) return;
  setInspectOutline(el, e.ctrlKey || e.metaKey);
}

function onInspectOut(e) {
  if (!INSPECT.enabled) return;
  const rt = e.relatedTarget;
  if (!rt || rt === document.documentElement || rt === document.body || isOwnUi(rt)) {
    clearInspectOutline();
  }
}

function onInspectClick(e) {
  if (!INSPECT.enabled) return;
  if (isOwnUi(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const el = e.target;
  // Ctrl/⌘ + 点击：加入/移出多选集合（不退出检视，可继续加选）
  if (e.ctrlKey || e.metaKey) {
    toggleMultiSelect(el);
    return;
  }
  // 已有多选集合：普通点击 = 完成多选，退出检视并打开批量操作条
  if (INSPECT.multiEls.length > 0) {
    exitInspectMode();
    showMultiBar();
    updateChatContext();
    return;
  }
  exitInspectMode();
  showSelectionBar(el);
}

/* 从标题元素提取干净文本：跳过 svg/symbol/use/img 等图标/非文字节点，
   避免 <h1><svg/><use href="#i-brand"/></svg>CiteCat</h1> 取出噪声。
   textContent 会吞进 SVG 内部文本，必须手动遍历子节点。 */
function cleanHeadingText(heading) {
  if (!heading) return '';
  let text = '';
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue || '';
      if (t) text += t;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    // 跳过图标/媒体节点：svg 及其内部、img、canvas、video、object
    const tag = node.tagName;
    if (tag === 'SVG' || tag === 'IMG' || tag === 'CANVAS' ||
        tag === 'VIDEO' || tag === 'OBJECT' || tag === 'SYMBOL' ||
        tag === 'USE') return;
    // 跳过不可见节点
    try {
      const st = window.getComputedStyle(node);
      if (st.display === 'none' || st.visibility === 'hidden') return;
    } catch (_) {}
    for (const child of node.childNodes) walk(child);
  };
  walk(heading);
  return text.replace(/\s+/g, ' ').trim();
}

/* 向上最多 maxUp 层祖先找最近的标题元素（h1-h6 / [role=heading]），返回干净文本。
   只看祖先的直接子标题（:scope >），避免抓到远层后代标题造成误命中。 */
function findNearestHeading(el, maxUp = 5) {
  if (!el || el.nodeType !== 1) return '';
  let parent = el.parentElement;
  for (let i = 0; i < maxUp && parent; i++) {
    // 自身是标题
    if (parent.matches && parent.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')) {
      const t = cleanHeadingText(parent);
      if (t) return t.slice(0, 60);
    }
    // 直接子标题（不深入后代）
    const heading = parent.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [role="heading"]');
    if (heading) {
      const t = cleanHeadingText(heading);
      if (t) return t.slice(0, 60);
    }
    parent = parent.parentElement;
  }
  return '';
}

/* 某层元素的语义名称：heading 优先，其次卡片/区块标题 class，
   再次 aria-label/legend/caption，最后语义化 class 名。
   只取"该层自身标识"，不抓后代，避免误抓子区块标题。 */
function sectionLayerName(el) {
  if (!el || el.nodeType !== 1) return '';
  // 1. 自身是标题元素
  if (el.matches && el.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')) {
    return cleanHeadingText(el).slice(0, 50);
  }
  // 2. 直接子标题（:scope >，不深入后代）
  if (el.querySelector) {
    const h = el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > [role="heading"]');
    if (h) return cleanHeadingText(h).slice(0, 50);
  }
  // 3. 卡片/区块标题 class（card-header / panel-title / section-title 等）
  const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
  if (/(^|[\s_-])(card|panel|block|widget|section|module|stat|metric|box)([\s_-])(header|title|heading|label)([\s_-]|$)/i.test(cls) ||
      /(^|[\s_-])(subtitle|section-title|block-title|module-title|widget-title)([\s_-]|$)/i.test(cls)) {
    const t = cleanHeadingText(el).slice(0, 50);
    if (t) return t;
  }
  // 4. aria-label / aria-labelledby
  const ariaLabel = (el.getAttribute('aria-label') || '').trim();
  if (ariaLabel) return ariaLabel.slice(0, 50);
  const labelledBy = (el.getAttribute('aria-labelledby') || '').trim();
  if (labelledBy) {
    const parts = labelledBy.split(/\s+/).map((id) => {
      const t = document.getElementById(id);
      return t ? cleanHeadingText(t) : '';
    }).filter(Boolean);
    if (parts.length) return parts.join(' ').slice(0, 50);
  }
  // 5. table caption / figure figcaption / fieldset legend
  if (el.tagName === 'TABLE') {
    const cap = el.querySelector(':scope > caption');
    if (cap) return cleanHeadingText(cap).slice(0, 50);
  }
  if (el.tagName === 'FIGURE' || el.tagName === 'FIELDSET') {
    const cap = el.querySelector(':scope > figcaption, :scope > legend');
    if (cap) return cleanHeadingText(cap).slice(0, 50);
  }
  // 6. 语义化 class 名（section/dashboard/stats/nav/sidebar 等有意义的关键词）
  if (cls) {
    const m = cls.match(/\b(section|dashboard|stats|metrics|sidebar|navbar|header|footer|article|main|content|panel|card|widget|module|overview|summary|detail|tab-pane|tab-panel)\b/);
    if (m) return m[1];
  }
  return '';
}

/* 语义路径（面包屑）：从元素出发向上遍历，收集每层的语义名称，
   拼成 "主体 > 数据概览 > 营收" 形式。
   heading 命中即取；无 heading 的层用 class/aria 等标识，避免全退化成顶层标题。 */
function buildSectionPath(el) {
  if (!el || el.nodeType !== 1) return '';
  const parts = [];
  const seen = new Set();
  let node = el;
  for (let i = 0; i < 12 && node && node !== document.body && node !== document.documentElement; i++) {
    const name = sectionLayerName(node);
    if (name && !seen.has(name)) {
      seen.add(name);
      parts.unshift(name.slice(0, 40));
    }
    node = node.parentElement;
    if (parts.length >= 5) break;
  }
  return parts.join(' > ');
}

/* 选区/元素 -> 区块名称（语义路径优先，heading/label 兜底，最后回退到元素文本）
 * 复制此名称给 AI 用：路径化的区块定位比单层标题更有上下文价值。
 * @param {Element} [fallbackEl] 检视模式下右键时，鼠标指向的元素（hover 未点击，
 *   lastSelectedEl 仍为空，用事件目标兜底） */
function resolveSectionName(fallbackEl) {
  // 多选：取首个元素的路径，附"等 N 个元素"
  if (INSPECT.multiEls && INSPECT.multiEls.length > 0) {
    const first = INSPECT.multiEls[0];
    const name = buildSectionPath(first) ||
      findNearestHeading(first) ||
      findLabelForElementSync(first) ||
      first.tagName.toLowerCase();
    return name + (INSPECT.multiEls.length > 1 ? ` 等 ${INSPECT.multiEls.length} 个元素` : '');
  }
  // 元素模式：已点击选中 > 右键指向的 hover 元素
  const el = INSPECT.lastSelectedEl || fallbackEl || INSPECT.lastTarget;
  if (el && el.nodeType === 1) {
    // 语义路径（面包屑）优先：给出区块在文档中的层级位置
    const path = buildSectionPath(el);
    if (path) return path;
    const heading = findNearestHeading(el);
    if (heading) return heading;
    const label = findLabelForElementSync(el);
    if (label) return label;
    // 元素自身可见文本兜底（取前 20 字，比裸标签名更有意义）
    const ownText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (ownText) return ownText.slice(0, 20);
    return el.tagName.toLowerCase();
  }
  // 文本模式：从选区公共容器向上找路径，兜底用选区文本前 20 字
  if (INSPECT.lastTextRange) {
    const r = INSPECT.lastTextRange;
    let anc = r.commonAncestorContainer;
    if (anc.nodeType === Node.TEXT_NODE) anc = anc.parentElement;
    const path = buildSectionPath(anc);
    if (path) return path;
    const heading = findNearestHeading(anc);
    if (heading) return heading;
    const text = r.toString().trim().replace(/\s+/g, ' ');
    return text.slice(0, 20) || '选中文本';
  }
  return '';
}

/* 检视模式右键：阻止原生菜单，复制区块名称到剪贴板 */
function onInspectContextmenu(e) {
  if (!INSPECT.enabled) return;
  if (isOwnUi(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  // 检视模式 hover 未点击时 lastSelectedEl 为空，用右键事件目标兜底
  const name = resolveSectionName(e.target);
  if (!name) {
    showMiniToast('未识别到区块名称');
    return;
  }
  try {
    navigator.clipboard?.writeText(name).then(
      () => {},
      () => showMiniToast('复制失败，区块名：' + name),
    );
  } catch (_) {
    showMiniToast('区块名：' + name);
  }
}

function onInspectKey(e) {
  if (e.key !== 'Escape') return;
  if (INSPECT.enabled) {
    exitInspectMode();
    // 有多选集合：Esc = 完成多选（批量操作条接续）；否则无事发生
    if (INSPECT.multiEls.length > 0) {
      showMultiBar();
      updateChatContext();
    }
  } else {
    hideSelectionBar();
  }
}

function setInspectOutline(el, isMulti = false) {
  if (INSPECT.lastTarget) clearInspectOutline();
  INSPECT.prevOutline = el.style.getPropertyValue('outline');
  INSPECT.prevOutlineOffset = el.style.getPropertyValue('outline-offset');
  el.style.outline = isMulti ? '2px dashed #4e75df' : '2px solid #4e75df';
  el.style.outlineOffset = '2px';
  INSPECT.lastTarget = el;

  // 信息条：textContent 构建，避免注入
  const r = el.getBoundingClientRect();
  const tip = INSPECT.tipEl;
  const cls = (typeof el.className === 'string' && el.className.trim())
    ? (' .' + el.className.trim().split(/\s+/).slice(0, 2).join('.'))
    : '';
  const tag = (el.tagName || '').toLowerCase();
  tip.textContent = '';
  const code = document.createElement('code');
  code.textContent = tag + cls;
  tip.appendChild(code);
  const dim = document.createElement('span');
  dim.className = 'dim';
  dim.textContent = ' ' + Math.round(r.width) + '×' + Math.round(r.height);
  tip.appendChild(dim);
  tip.style.left = Math.max(8, r.right - 6) + 'px';
  tip.style.top = Math.max(8, r.top - 30) + 'px';
  tip.style.display = 'block';
}

function clearInspectOutline() {
  if (!INSPECT.lastTarget) {
    if (INSPECT.tipEl) INSPECT.tipEl.style.display = 'none';
    return;
  }
  const el = INSPECT.lastTarget;
  if (INSPECT.prevOutline) el.style.outline = INSPECT.prevOutline;
  else el.style.removeProperty('outline');
  if (INSPECT.prevOutlineOffset) el.style.outlineOffset = INSPECT.prevOutlineOffset;
  else el.style.removeProperty('outline-offset');
  INSPECT.lastTarget = null;
  INSPECT.prevOutline = null;
  INSPECT.prevOutlineOffset = null;
  if (INSPECT.tipEl) INSPECT.tipEl.style.display = 'none';
}

/* ---- 检视模式 Ctrl 多选 ---- */

function toggleMultiSelect(el) {
  const idx = INSPECT.multiEls.indexOf(el);
  if (idx >= 0) {
    INSPECT.multiEls.splice(idx, 1);
    renderMultiFrames();
    if (INSPECT.multiEls.length === 0) hideMultiBar();
  } else {
    INSPECT.multiEls.push(el);
    renderMultiFrames();
    showMultiBar();
  }
  chatAskMode = 'multi';
  updateChatContext(); // 聊天窗打开时引用同步（多元素汇总）
}

// 重绘全部多选框（scroll/resize/增删时调用；脱离文档的元素自动剔除）
function renderMultiFrames() {
  const host = INSPECT.multiFrameHost;
  if (!host) return;
  host.innerHTML = '';
  INSPECT.multiEls = INSPECT.multiEls.filter((el) => el && el.isConnected);
  for (const el of INSPECT.multiEls) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const f = document.createElement('div');
    f.className = 'multi-frame';
    f.style.left = r.left + 'px';
    f.style.top = r.top + 'px';
    f.style.width = r.width + 'px';
    f.style.height = r.height + 'px';
    host.appendChild(f);
  }
}

function showMultiBar() {
  if (!INSPECT.multiBarEl) return;
  updateMultiBar();
  INSPECT.multiBarEl.style.display = 'flex';
  renderMultiFrames();
}

function hideMultiBar() {
  if (INSPECT.multiBarEl) INSPECT.multiBarEl.style.display = 'none';
}

function updateMultiBar() {
  const bar = INSPECT.multiBarEl;
  if (!bar) return;
  const count = bar.querySelector('.mb-count');
  if (count) count.textContent = `已选 ${INSPECT.multiEls.length} 个元素`;
}

// 清除多选集合（重新进入检视 / 多选条 ×）
function clearMultiSelect() {
  INSPECT.multiEls = [];
  if (INSPECT.multiFrameHost) INSPECT.multiFrameHost.innerHTML = '';
  hideMultiBar();
}

// 多选包围盒（聊天窗定位用）
function multiUnionRect() {
  const rects = INSPECT.multiEls.map((el) => el.getBoundingClientRect());
  if (rects.length === 0) return null;
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

function showSelectionBar(el) {
  if (!el || !INSPECT.barEl) return;
  INSPECT.barMode = 'element';
  chatAskMode = 'element';
  INSPECT.lastSelectedEl = el;
  INSPECT.lastTextRange = null;
  showSelectionBarAtRect(el.getBoundingClientRect());
  updateChatContext(); // 聊天窗打开时：新选元素，引用同步更新
}

function hideSelectionBar() {
  if (INSPECT.barEl) INSPECT.barEl.style.display = 'none';
}

function showMiniToast(msg) {
  const t = INSPECT.toastEl;
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(INSPECT.toastTimer);
  INSPECT.toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ================================================================
 * 标注：荧光笔 / 下划线 / 元素标注 + snippet 收藏
 * 锚点：TextQuoteSelector（text + prefix/suffix 上下文）
 * 渲染：<mark> DOM 包裹（成熟产品主流做法，支持点击交互）
 * ================================================================ */

function showSelectionBarAtRect(rect) {
  const bar = INSPECT.barEl;
  if (!bar || !rect) return;
  bar.style.display = 'flex';
  const barW = bar.offsetWidth || 128;
  const barH = bar.offsetHeight || 40;
  let left = rect.left + rect.width / 2 - barW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - barW - 8));
  let top = rect.top - barH - 8;
  if (top < 8) top = rect.bottom + 8;
  bar.style.left = left + 'px';
  bar.style.top = top + 'px';
}
async function createTextAnnotation(kind) {
  const range = INSPECT.lastTextRange;
  if (!range) return;
  const ann = await createTextAnnotationCore(range, kind, location.href, document.title);
  if (!ann) return;
  hideSelectionBar();
  window.getSelection()?.removeAllRanges();
}

async function createElementAnnotation(kind) {
  const el = INSPECT.lastSelectedEl;
  if (!el) return;
  const ann = {
    id: makeAnnId(),
    kind: kind === 'hl' ? 'el-hl' : 'el-ul',
    selector: cssPath(el),
    text: (el.innerText || el.textContent || '').trim().slice(0, 200),
    pageTitle: document.title || '',
    createdAt: Date.now(),
    entryId: null,
    note: '',
  };
  await saveAnnotation(location.href, ann);
  el.classList.add(kind === 'hl' ? 'citecat-el-hl' : 'citecat-el-ul');
  el.dataset.annEl = ann.id;
}
async function collectTextSnippet() {
  if (!(await requireLicense())) return;
  const range = INSPECT.lastTextRange;
  if (!range) return;
  const result = await collectTextSnippetCore(range, location.href, document.title);
  hideSelectionBar();
  window.getSelection()?.removeAllRanges();
  if (result && result.ok) return;
  showMiniToast('收藏失败: ' + ((result && result.error) || '未知错误'));
}

function collectableImages(el) {
  if (!el) return [];
  const tag = el.tagName;
  if (tag === 'IMG' && (el.currentSrc || el.src)) return [el];
  if (tag === 'PICTURE' || tag === 'FIGURE' || tag === 'A') {
    return [...el.querySelectorAll('img')].filter((img) => img.currentSrc || img.src).slice(0, 4);
  }
  return [];
}

async function imgToDataUrl(img) {
  try {
    if (!img.naturalWidth) {
      await new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth) return resolve();
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', reject, { once: true });
      }).catch(() => {});
    }
    if (!img.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (_) {
    return null;
  }
}

async function collectPageImage(img) {
  const imageUrl = img.currentSrc || img.src || '';
  const alt = (img.getAttribute('alt') || '').trim();
  const dataUrl = await imgToDataUrl(img);
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'COLLECT_IMAGE',
      data: {
        url: normalizeUrl(location.href),
        title: document.title,
        imageUrl,
        dataUrl,
        alt,
      },
    });
    if (resp && resp.success) return { ok: true, id: resp.id };
    return { ok: false, error: (resp && resp.error) || '未知错误' };
  } catch (err) {
    return { ok: false, error: err.message || '无法连接后台' };
  }
}

async function collectElementSnippet() {
  if (!(await requireLicense())) return;
  const el = INSPECT.lastSelectedEl;
  if (!el) return;
  const imgs = collectableImages(el);
  if (imgs.length) {
    let n = 0;
    let lastErr = '';
    for (const img of imgs) {
      const r = await collectPageImage(img);
      if (r && r.ok) n += 1;
      else lastErr = (r && r.error) || lastErr;
    }
    const caption = (el.innerText || '').trim();
    if (caption && el.tagName !== 'IMG') {
      await chrome.runtime.sendMessage({
        type: 'COLLECT_SNIPPET',
        data: { url: normalizeUrl(location.href), title: document.title, text: caption.slice(0, 5000) },
      }).catch(() => {});
    }
    if (n) return;
    showMiniToast('图片收藏失败: ' + (lastErr || '未知错误'));
    return;
  }
  const text = (el.innerText || el.textContent || '').trim().slice(0, 5000);
  if (!text) {
    showMiniToast('没有可收藏的文字或图片');
    return;
  }
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'COLLECT_SNIPPET',
      data: { url: normalizeUrl(location.href), title: document.title, text },
    });
    if (resp && resp.success) return;
    showMiniToast('收藏失败: ' + ((resp && resp.error) || '未知错误'));
  } catch (err) {
    showMiniToast('收藏失败: ' + (err.message || '未知错误'));
  }
}

async function collectAnnotationAsSnippet(ann, url) {
  const result = await collectAnnotationAsSnippetCore(ann, url, document.title);
  if (result.ok) return;
  showMiniToast('收藏失败: ' + result.error);
}

function scheduleAnnotationReplay() {}

/* ======== Shared: collect event binding ======== */

function bindCollectEvent(cb, url, title) {
  // page mode: use module-level variables (updated on SPA navigation)
  const getUrl = () => url || pageCollectUrl;
  const getTitle = () => title || pageCollectTitle;

  let locked = false;

  function setState(el, cls) {
    el.classList.remove(LOADING_CLASS, DONE_CLASS, FAIL_CLASS);
    if (cls) el.classList.add(cls);
  }

  cb.addEventListener('change', async () => {
    if (locked) return;

    if (!cb.checked) {
      const wasFail = cb.classList.contains(FAIL_CLASS);
      setState(cb, null);
      if (wasFail) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
        return;
      }
      cb.classList.add('tsc-unchecking');
      cb.addEventListener('animationend', () => cb.classList.remove('tsc-unchecking'), { once: true });
      cb.title = '勾选以采集并总结此页面';
      safeSendMessage({ type: 'DELETE_ENTRY', data: { url: getUrl() } }).catch(() => {});
      return;
    }

    locked = true;
    setState(cb, LOADING_CLASS);
    cb.title = '采集中...';
    try {
      const data = { url: getUrl(), originalTitle: getTitle() };
      // Page mode (user is ON this page): extract from live DOM via Readability
      if (!url) {
        const extracted = extractPageContent();
        if (extracted) {
          data.content = extracted.content;
          data.originalTitle = extracted.title || getTitle();
          data.publishedAt = extracted.publishedAt || null;
        }
      }
      const resp = await safeSendMessage({
        type: 'COLLECT',
        data,
      });
      if (!resp) {
        markFail('采集失败: 未收到响应');
        return;
      }
      if (resp.success) {
        setState(cb, DONE_CLASS);
        cb.title = '采集完成';
      } else if (resp.error === '该 URL 已采集过') {
        setState(cb, DONE_CLASS);
        cb.title = '已在库中';
      } else {
        markFail(`采集失败: ${resp.error || '未知错误'}`);
        if (resp.needsVerification) {
          alert('Citecat 检测到人机验证。请在当前页面完成 Cloudflare / 验证码后，再重新勾选采集。');
        }
      }
    } catch (err) {
      markFail(`通信失败: ${err.message}`);
    } finally {
      locked = false;
    }
  });

  function markFail(msg) {
    locked = true;
    cb.checked = false;
    locked = false;
    setState(cb, FAIL_CLASS);
    cb.title = msg;
  }
}
