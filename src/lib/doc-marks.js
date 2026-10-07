/**
 * 共享标注逻辑 —— 内容页（content script）与文档阅读器（reader）共用。
 *
 * 荧光笔/下划线标注的完整链路：
 *   选区 → TextQuoteSelector 锚点（text + prefix/suffix）落库（annotations.js）
 *        → <mark> DOM 包裹（unwrap 而不是 remove，删除时保留原文）
 *   重放 → 按 URL 取标注 → buildTextIndex/findAnnotationRange 锚点定位 → 包裹。
 *
 * 纯逻辑 + 参数化根节点，宿主差异（URL 来源、toast、消息通道）由调用方注入。
 */

import { saveAnnotation, getAnnotationsForUrl, setAnnotationEntryId, normalizeUrl } from './annotations.js';

/* 防御式 mark 样式：保证 mark 永远不改变页面布局（PDF textLayer 的绝对定位
   span 也不会被包进 mark 后打乱定位 —— mark 是 static，absolute 后代仍相对
   textLayer 容器定位）。 */
export const ANNOTATION_CSS = `
  mark.citecat-hl, mark.citecat-ul {
    display: inline !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    vertical-align: baseline !important;
    background-clip: border-box !important;
  }
  mark.citecat-hl {
    background: rgba(217,119,6,0.28) !important;
    color: inherit !important;
    border-radius: 2px;
    cursor: pointer;
  }
  mark.citecat-ul {
    background: transparent !important;
    color: inherit !important;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    text-decoration-color: rgba(78,117,223,0.55);
    cursor: pointer;
  }
  mark.citecat-hl:hover, mark.citecat-ul:hover {
    outline: 1px dashed rgba(78,117,223,0.55); outline-offset: 1px;
  }
  /* 带批注说明（note）的高亮：右上角小图标角标，提示点击可读批注 */
  mark.citecat-has-note::after {
    content: '';
    display: inline-block;
    width: 0.62em;
    height: 0.62em;
    margin-left: 3px;
    vertical-align: super;
    background: currentColor;
    opacity: 0.55;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E") center / contain no-repeat;
    pointer-events: none;
  }
  /* 融入正文的批注块：段后独立一行，字号/颜色与正文区分（编辑旁批样式） */
  .citecat-note-block {
    display: block !important;
    font-size: 12.5px !important;
    line-height: 1.7 !important;
    color: #4267c4 !important;
    background: rgba(78, 117, 223, 0.05) !important;
    border-left: 2px solid rgba(78, 117, 223, 0.45) !important;
    border-radius: 0 4px 4px 0;
    padding: 3px 10px !important;
    margin: 4px 0 6px !important;
    text-align: left !important;
    cursor: pointer;
  }
  .citecat-note-block .cnb-label {
    display: inline-flex;
    align-items: center;
    margin-right: 6px;
    opacity: 0.75;
    vertical-align: -2px;
  }
  .citecat-note-block .cnb-text { word-break: break-word; }
  
html[data-theme="dark"] .citecat-note-block,
html[data-citecat-theme="dark"] .citecat-note-block { color: #aac0f7 !important; background: rgba(138, 167, 242, 0.10) !important; }
  
  .citecat-el-hl { outline: 2px solid rgba(217,119,6,0.55) !important; outline-offset: 2px; }
  .citecat-el-ul { outline: 2px solid rgba(78,117,223,0.45) !important; outline-offset: 2px; }
  mark.citecat-pulse { outline: 3px solid rgba(78,117,223,0.8) !important; outline-offset: 3px; }
`;

export function injectAnnotationStyles() {
  if (document.getElementById('citecat-ann-styles')) return;
  const s = document.createElement('style');
  s.id = 'citecat-ann-styles';
  s.textContent = ANNOTATION_CSS;
  (document.head || document.documentElement).appendChild(s);
}

export function makeAnnId() {
  return 'ann_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 选区上下文（TextQuoteSelector 的 prefix/suffix）：就近容器文本中截取 */
export function quoteContext(range, beforeChars, afterChars) {
  const text = range.toString().trim();
  let el = range.commonAncestorContainer;
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  if (!el || !el.textContent) return { prefix: '', suffix: '' };
  const full = el.textContent.replace(/\s+/g, ' ');
  const q = text.replace(/\s+/g, ' ');
  const at = full.indexOf(q);
  if (at < 0) return { prefix: '', suffix: '' };
  return {
    prefix: full.slice(Math.max(0, at - beforeChars), at).trimEnd(),
    suffix: full.slice(at + q.length, at + q.length + afterChars).trimStart(),
  };
}

/* 受限父元素：只允许特定子元素，往里插 inline mark 会触发 HTML 解析器
   foster parenting（节点被移到 table 之前），表格布局彻底错乱。
   注：flex/grid 容器不在此列 —— mark 包裹的是文本节点，文本节点的父通常是
   p/span/td 等，而非 flex 容器本身；即便文本直接挂在 flex 容器下，mark 作为
   inline 包裹也只会多一层 inline box，不会破坏 flex item 划分。把 flex/grid
   判为受限会导致大量现代布局页面高亮完全失效（父元素全是 flex）。 */
const RESTRICTED_TAGS = new Set([
  'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'COLGROUP', 'COL',
  'UL', 'OL', 'DL', 'SELECT', 'OPTGROUP', 'OPTION',
]);

function isRestrictedParent(el) {
  if (!el || el.nodeType !== 1) return false;
  return RESTRICTED_TAGS.has(el.tagName);
}

/**
 * Hypothesis 式逐文本节点包裹（根治跨 block 布局破坏）。
 * 选区内每个文本节点各自包裹进 mark，同父相邻的合并为一个 mark；
 * 受限位置（table 结构 / flex / grid / contents）与纯空白分组跳过，
 * 数据已落库，放弃 DOM 包裹也不丢内容。
 * 保留 <mark> + citecat-hl/ul class，兼容所有现有选择器与删除/解包逻辑。
 */
export function wrapRangeWithMark(range, kind, id) {
  if (!range || range.collapsed) return;
  const cls = kind === 'hl' ? 'citecat-hl' : 'citecat-ul';
  try {
    // TreeWalker 的 root 若是文本节点（选区在单个文本节点内时常见），
    // walker 遍历不到它自身 -> 改用其父元素作为 root，靠 intersectsNode 过滤。
    let walkerRoot = range.commonAncestorContainer;
    if (walkerRoot.nodeType === Node.TEXT_NODE) {
      walkerRoot = walkerRoot.parentElement || walkerRoot;
    }
    // 1. 收集选区内所有文本节点
    const walker = document.createTreeWalker(
      walkerRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          return (node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
    const textNodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      // 精确裁剪：只取与选区重叠的部分
      let startOff = 0, endOff = n.nodeValue.length;
      if (n === range.startContainer) startOff = range.startOffset;
      if (n === range.endContainer) endOff = range.endOffset;
      if (startOff >= endOff) continue;
      const seg = n.nodeValue.slice(startOff, endOff);
      if (!seg || !seg.trim()) continue;
      textNodes.push({ node: n, startOff, endOff, text: seg });
    }
    if (textNodes.length === 0) return;

    // 2. 首尾节点 splitText 切出选区内的独立文本节点
    //    （必须先切，否则 replaceChild 会带走节点未被选中的部分）
    for (const t of textNodes) {
      try {
        if (t.endOff < t.node.nodeValue.length) {
          t.node.splitText(t.endOff);
        }
        if (t.startOff > 0) {
          const after = t.node.splitText(t.startOff);
          t.node = after; // 切后 t.node 指向选区内那段
        }
      } catch (_) { /* 跨容器边界：跳过这个节点 */ }
    }

    // 3. 同父相邻分组：相邻 sibling 合成一个 mark，block 边界天然分隔
    const groups = [];
    let cur = null;
    for (const t of textNodes) {
      const parent = t.node.parentElement;
      if (!parent || isRestrictedParent(parent)) {
        cur = null; // 受限位置：中断当前组，跳过此节点
        continue;
      }
      if (cur && cur.parent === parent && cur.last.nextSibling === t.node) {
        cur.nodes.push(t.node);
        cur.last = t.node;
      } else {
        cur = { parent, nodes: [t.node], last: t.node };
        groups.push(cur);
      }
    }

    // 4. 每组生成一个 mark，替换首节点位置
    for (const g of groups) {
      try {
        const mark = document.createElement('mark');
        mark.className = cls;
        mark.dataset.annId = id;
        const first = g.nodes[0];
        g.parent.insertBefore(mark, first);
        for (const n of g.nodes) mark.appendChild(n);
      } catch (_) { /* 单组失败不影响其他组 */ }
    }
  } catch (_) {
    /* 整体异常：放弃 DOM 包裹，数据已落库（与原静默策略一致） */
  }
}

/** 解包 mark：把内容移回原位后再移除（删除标注时保留原文） */
export function unwrapMarks(selector) {
  document.querySelectorAll(selector).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
}

/* ---------- 融入正文的批注块（段后插入，字号/颜色区分） ---------- */

/**
 * 在高亮所在段落之后插入一条批注块（📝 批注 + note 文本）。
 * 纯文本写入（textContent），防注入；按 annId 去重。
 * @returns {HTMLElement|null}
 */
export function insertAnnotationNoteBlock(ann, markEl) {
  if (!ann || !ann.note || !markEl || !markEl.isConnected) return null;
  removeAnnotationNoteBlock(ann.id);
  // 锚定到 mark 所在的块级段落（段后插入，不打断行内文字流）
  const block = markEl.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd, pre')
    || markEl.parentElement;
  if (!block) return null;
  const note = document.createElement('div');
  note.className = 'citecat-note-block';
  note.setAttribute('data-note-for', ann.id);
  const label = document.createElement('span');
  label.className = 'cnb-label';
  // 注释气泡图标（与项目统一的内联 SVG 描边风格），无文字标签
  label.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg>';
  const text = document.createElement('span');
  text.className = 'cnb-text';
  text.textContent = ann.note;
  note.appendChild(label);
  note.appendChild(text);
  block.insertAdjacentElement('afterend', note);
  return note;
}

/** 移除某条标注的批注块（删除标注联动用；按 id 全局清理） */
export function removeAnnotationNoteBlock(annId) {
  if (!annId) return;
  document.querySelectorAll(`[data-note-for="${CSS.escape(annId)}"]`).forEach((el) => el.remove());
}

/** 元素标注的 CSS 路径（id > 类名 > nth-of-type 兜底） */
export function cssPath(el) {
  if (!el || el.nodeType !== 1 || el === document.body) return '';
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    let sel = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(sel + '#' + node.id);
      break;
    }
    if (node.classList && node.classList.length > 0) {
      sel += '.' + Array.from(node.classList).slice(0, 2).join('.');
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (siblings.length > 1) {
        sel += ':nth-of-type(' + (Array.from(parent.children).indexOf(node) + 1) + ')';
      }
    }
    parts.unshift(sel);
    node = parent;
  }
  return parts.join(' > ');
}

/**
 * 文本选区 → 标注落库 + mark 包裹（宿主通用版本）。
 * 落库时同时记录 TextPositionSelector（绝对偏移）—— 页面未变时重放可
 * O(1) 精确定位，内容变化后自动退回 TextQuoteSelector 锚点。
 * @param {Range} range
 * @param {string} kind 'hl' | 'ul'
 * @param {string} url 标注分组 URL
 * @param {string} [pageTitle]
 * @param {Node} [root] 文本索引根（默认 body；阅读器传渲染容器）
 * @param {boolean} [noWrap] 跳过 mark 包裹（PDF 文字层绝对定位，mark 包裹
 *   会破坏布局，宿主改用 span 级高亮）
 * @returns {object|null} 落库后的标注
 */
export async function createTextAnnotation(range, kind, url, pageTitle, root, noWrap = false) {
  if (!range) return null;
  const text = range.toString().trim();
  if (!text) return null;
  const ctx = quoteContext(range, 40, 40);
  // TextPositionSelector：range 起点在文本索引中的绝对偏移
  let posStart = -1, posEnd = -1;
  try {
    const { text: full, nodes } = buildTextIndex(root);
    const off = offsetOfNode(nodes, range.startContainer, range.startOffset);
    if (off >= 0 && text.length <= full.length) {
      posStart = off;
      posEnd = off + range.toString().length;
    }
  } catch (_) {}
  const ann = {
    id: makeAnnId(),
    kind, // 'hl' | 'ul'
    text,
    prefix: ctx.prefix,
    suffix: ctx.suffix,
    posStart,
    posEnd,
    pageTitle: pageTitle || '',
    createdAt: Date.now(),
    entryId: null,
    note: '',
  };
  await saveAnnotation(url, ann);
  if (!noWrap) wrapRangeWithMark(range, kind, ann.id);
  return ann;
}

/**
 * 文本选区 → 材料 snippet（原文入库，不走 AI 总结，不在页面留高亮）。
 */
export async function collectTextSnippet(range, url, pageTitle) {
  if (!range) return null;
  const text = range.toString().trim();
  if (!text) return null;
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'COLLECT_SNIPPET',
      data: {
        url: normalizeUrl(url),
        title: pageTitle || '',
        text,
      },
    });
    if (resp && resp.success) return { ok: true, id: resp.id };
    return { ok: false, error: (resp && resp.error) || '未知错误' };
  } catch (err) {
    return { ok: false, error: err.message || '无法连接后台' };
  }
}

/** 标注 → snippet 条目入库（SW 侧写入，状态直接 completed，不走 AI 总结） */
export async function collectAnnotationAsSnippet(ann, url, pageTitle) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'COLLECT_SNIPPET',
      data: {
        url: normalizeUrl(url),
        title: ann.pageTitle || pageTitle || '',
        text: ann.text,
        kind: ann.kind,
        annotationId: ann.id,
      },
    });
    if (resp && resp.success) {
      await setAnnotationEntryId(url, ann.id, resp.id);
      return { ok: true };
    }
    return { ok: false, error: (resp && resp.error) || '未知错误' };
  } catch (err) {
    return { ok: false, error: err.message || '无法连接后台' };
  }
}

/** 构建纯文本索引（root 默认 body；PDF textLayer / 阅读器容器均可） */
export function buildTextIndex(root) {
  const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return (node.nodeValue || '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  let text = '';
  while (walker.nextNode()) {
    const n = walker.currentNode;
    nodes.push({ node: n, start: text.length });
    text += n.nodeValue || '';
  }
  return { text, nodes };
}

export function findNodeAt(nodes, pos) {
  for (const e of nodes) {
    if (pos >= e.start && pos <= e.start + (e.node.nodeValue || '').length) return e;
  }
  return null;
}

/* 节点内空白压缩映射：norm（压缩后）每字符 → 原文本中的字符偏移 */
function normToRawMap(v) {
  const map = [];
  const norm = v.replace(/\s+/g, ' ');
  let raw = 0;
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === ' ') {
      while (raw < v.length && !/\s/.test(v[raw])) raw++;
      map.push(raw); raw++;
    } else {
      while (raw < v.length && /\s/.test(v[raw])) raw++; // 安全跳过（压缩已处理）
      map.push(raw); raw++;
    }
  }
  return { norm, map };
}

/**
 * 归一化文本索引：空白压缩后的全文 + 每字符到原文的偏移映射。
 * 页面渲染压缩空白（textLayer / CSS white-space）时原文精确匹配失效，
 * 用这个索引把归一化命中映射回真实节点。
 */
export function buildNormIndex(root) {
  const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return (node.nodeValue || '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  let normText = '';
  const raws = [];
  let rawPos = 0;
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const v = n.nodeValue || '';
    nodes.push({ node: n, start: rawPos });
    const { norm, map } = normToRawMap(v);
    normText += norm;
    for (const off of map) raws.push(rawPos + off);
    rawPos += v.length;
  }
  return { normText, rawIndex: Int32Array.from(raws), nodes };
}

function makeRangeAt(nodes, rawStart, rawLen) {
  const startNode = findNodeAt(nodes, rawStart);
  const endNode = findNodeAt(nodes, rawStart + rawLen);
  if (!startNode || !endNode) return null;
  try {
    const range = document.createRange();
    range.setStart(startNode.node, rawStart - startNode.start);
    range.setEnd(endNode.node, rawStart + rawLen - endNode.start);
    return range;
  } catch (_) {
    return null;
  }
}

/* prefix/suffix 消歧：候选命中附近的上下文应包含存过的前后文（防止内容
   变化后 quote 错配到别处）。各取 40 字符窗口。 */
function contextMatches(text, pos, len, ann) {
  const prefix = (ann.prefix || '').replace(/\s+/g, ' ').trim();
  const suffix = (ann.suffix || '').replace(/\s+/g, ' ').trim();
  if (!prefix && !suffix) return true;
  const before = text.slice(Math.max(0, pos - 40), pos);
  const after = text.slice(pos + len, pos + len + 40);
  if (prefix && !before.includes(prefix.slice(-40))) return false;
  if (suffix && !after.includes(suffix.slice(0, 40))) return false;
  return true;
}

/**
 * TextQuoteSelector 匹配（W3C 实践）：原文精确 → 归一化映射 → prefix/suffix 消歧。
 * @param {object} ann { text, prefix, suffix }
 * @param {Node} [root] 搜索根（默认 body）
 */
export function findAnnotationRange(ann, root) {
  const q = (ann.text || '').trim();
  if (!q) return null;
  const { text, nodes } = buildTextIndex(root);

  // 通道 1：原文精确匹配（带上下文消歧）
  let idx = text.indexOf(q);
  while (idx !== -1) {
    if (contextMatches(text, idx, q.length, ann)) {
      const r = makeRangeAt(nodes, idx, q.length);
      if (r) return r;
    }
    idx = text.indexOf(q, idx + 1);
  }

  // 通道 2：归一化匹配（空白压缩），映射回原文节点
  const { normText, rawIndex } = buildNormIndex(root);
  const normQ = q.replace(/\s+/g, ' ');
  let pos = normText.indexOf(normQ);
  while (pos !== -1) {
    const rawStart = rawIndex[pos];
    const rawEnd = rawIndex[pos + normQ.length - 1];
    if (rawStart !== undefined && rawEnd !== undefined &&
        contextMatches(normText, pos, normQ.length, ann)) {
      const r = makeRangeAt(nodes, rawStart, rawEnd - rawStart + 1);
      if (r) return r;
    }
    pos = normText.indexOf(normQ, pos + 1);
  }
  return null;
}

/* range 起点在文本索引中的绝对偏移（TextPositionSelector 落库用） */
function offsetOfNode(nodes, node, offset) {
  if (node.nodeType === Node.TEXT_NODE) {
    const e = nodes.find((n) => n.node === node);
    return e ? e.start + offset : -1;
  }
  // 元素节点：取元素内第一个索引文本节点
  const first = nodes.find((n) => node.contains(n.node));
  return first ? first.start : -1;
}

/* 位置选择器快速通道：页面未变时 O(1) 精确定位；文本变化则退回 quote */
function positionRange(ann, nodes, text) {
  if (typeof ann.posStart !== 'number' || typeof ann.posEnd !== 'number') return null;
  if (ann.posStart < 0 || ann.posEnd <= ann.posStart) return null;
  const q = (ann.text || '').trim();
  if (!q) return null;
  const at = text.slice(ann.posStart, ann.posEnd);
  if (!at || at.replace(/\s+/g, ' ') !== q.replace(/\s+/g, ' ')) return null;
  return makeRangeAt(nodes, ann.posStart, ann.posEnd - ann.posStart);
}

/**
 * 按 URL 重放标注到指定容器（元素标注走 CSS 选择器；文本标注先按
 * TextPositionSelector 快速定位，失败再走 TextQuoteSelector 锚点）。
 * @returns {number} 本次成功重放的标注数
 */
export async function replayAnnotations(url, root) {
  if (!document.body || !root) return 0;
  const list = await getAnnotationsForUrl(url);
  if (!list || list.length === 0) return 0;
  // 批注块重建：先清旧块，避免原文漂移后残留孤儿批注
  root.querySelectorAll('.citecat-note-block').forEach((el) => el.remove());
  const { text, nodes } = buildTextIndex(root);
  let count = 0;
  for (const ann of list) {
    if (ann.kind === 'el-hl' || ann.kind === 'el-ul') {
      // 元素标注：CSS 选择器重放
      if (ann.selector) {
        try {
          const el = root.querySelector(ann.selector);
          if (el && !el.dataset.annEl) {
            el.classList.add(ann.kind === 'el-hl' ? 'citecat-el-hl' : 'citecat-el-ul');
            el.dataset.annEl = ann.id;
            count++;
          }
        } catch (_) {}
      }
      continue;
    }
    // 文本标注：防重复 + 位置优先，quote 兜底
    if (root.querySelector(`mark[data-ann-id="${CSS.escape(ann.id)}"]`)) continue;
    const range = positionRange(ann, nodes, text) || findAnnotationRange(ann, root);
    if (range) {
      wrapRangeWithMark(range, ann.kind, ann.id);
      // 带批注说明的高亮：加角标类 + 段后插入融入正文的批注块
      const m = root.querySelector(`mark[data-ann-id="${CSS.escape(ann.id)}"]`);
      if (m && ann.note) {
        m.classList.add('citecat-has-note');
        insertAnnotationNoteBlock(ann, m);
      }
      count++;
    }
  }
  return count;
}
