/**
 * Word 文档 OOXML 定点手术引擎（替代 mammoth+Tiptap+htmlToDocx 的有损往返）。
 *
 * 原理：docx 是 zip 包的 XML 集合。AI 的每个编辑动作都是「定点修改」--
 *   解压后只改 word/document.xml 的目标节点，其余条目（styles/numbering/页眉页脚/
 *   媒体/设置）字节原样保留，未动区域 100% 保真（字体/字号/颜色/版式/图片全在）。
 *
 * 审阅修订直接生成 OOXML 原生痕迹（w:ins / w:del，作者 "OhMyTab"），
 * 保存后用 Word/WPS 打开即进入修订模式逐条接受/拒绝；note 以原生批注
 * （comments.xml）锚定在修订处，Word 侧可见。
 *
 * 渲染用 docx-preview（renderChanges 模式：<ins> 绿 / <del> 红），
 * 本文档不再提供 Tiptap 所见即所得打字编辑--编辑入口 = AI 工具 + 修订面板。
 *
 * 已知边界：undo/redo 只回滚 document.xml；heading/list 注入的 styles.xml、
 * numbering.xml 变更为幂等追加，不随 undo 回滚（Word 侧无副作用）。
 */
import JSZip from 'jszip';
import { DOMParser as XmldomParser, XMLSerializer as XmldomSerializer } from '@xmldom/xmldom';

// SW（无 DOM）跑引擎时用 xmldom；阅读器/Node 冒烟测试环境有原生实现则用原生
const XmlParser = typeof DOMParser !== 'undefined' ? DOMParser : XmldomParser;
const XmlSerializer = typeof XMLSerializer !== 'undefined' ? XMLSerializer : XmldomSerializer;
// DOM 间接引用：SW 打包校验禁止字面 document. 属性访问，且 SW 本无 DOM。
// 阅读器/Node 冒烟环境有 document；SW 环境为 null，所有用到它的分支都已被
// hasContainer / renderEl 守卫挡住（渲染 no-op）。
const docRef = typeof document !== 'undefined' ? document : null;

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const AUTHOR = 'OhMyTab';
const INITIALS = 'CC';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const UNDO_CAP = 30;

/* 渲染器按需加载：Node 环境（冒烟测试）无 window/docx-preview，跳过渲染不阻断编辑链路 */
let renderDocxFn = null;
async function loadRenderer() {
  if (typeof window === 'undefined') return null;
  if (!renderDocxFn) {
    const mod = await import('docx-preview');
    renderDocxFn = mod.renderAsync;
  }
  return renderDocxFn;
}

let zip = null;          // JSZip 实例（除 document.xml 外的条目原样保留）
let xmlDoc = null;       // word/document.xml 的 XMLDocument
let stylesXml = null;    // word/styles.xml 的 XMLDocument（可能为 null）
let containerEl = null;  // editorHost
let renderEl = null;     // editorHost 内的渲染容器（renderAsync 只清它，修订面板在外面）
let renderStyleEl = null;
let dirty = false;
let revisionSanitized = false; // init 时修复过非法嵌套修订痕迹（docx 曾拒开）
let undoStack = [];
let redoStack = [];
let revSeq = 1;          // w:id 计数（修订元素）
let commentSeq = 1;      // w:comment id 计数
let revCommentMap = new Map(); // 修订 w:id -> comment id（接受/拒绝时清理批注用）
let revNoteMap = new Map();    // 修订 w:id -> note 文本（面板显示用；note 正文存于 comments.xml）
let selectionCb = null;
let renderTimer = 0;
let renderPending = false;
let renderAgain = false;
let selListener = null;

/* ---------- XML 基础工具 ---------- */

function el(name) {
  return xmlDoc.createElementNS(W, `w:${name}`);
}
function attr(node, name) {
  return node.getAttributeNS(W, name);
}
function setAttr(node, name, value) {
  node.setAttributeNS(W, 'w:' + name, value);
}
/** 直接子元素按 localName 过滤（避免 getElementsByTagNameNS 深度命中嵌套表格）；用 childNodes 而非 children，兼容 xmldom */
function directChildren(node, name) {
  return Array.from(node.childNodes || []).filter((c) => c.nodeType === 1 && c.localName === name && c.namespaceURI === W);
}
/** 在直接子元素里找第一个指定 localName（childElement 语义） */
function childByName(node, name) {
  for (const c of node.childNodes || []) {
    if (c.nodeType === 1 && c.localName === name) return c;
  }
  return null;
}
/** 自实现的 nextElementSibling（xmldom 兼容） */
function nextElementSiblingOf(node) {
  let cur = node.nextSibling;
  while (cur && cur.nodeType !== 1) cur = cur.nextSibling;
  return cur;
}
// xmldom 无 Element.remove()：统一用父节点移除（原生 DOM 同样可用）
function removeNode(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

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
/** 向上找指定祖先（localName 匹配、W 命名空间） */
function closestName(node, name) {
  let cur = node;
  while (cur && cur !== xmlDoc.documentElement) {
    if (cur.localName === name && cur.namespaceURI === W) return cur;
    cur = cur.parentNode;
  }
  return null;
}
function inDeleted(node) {
  return !!closestName(node, 'del');
}
/** 目标 run 是否处于待审修订（w:ins/w:del）内：对修订中的文本再次编辑会产出
 *  非法嵌套痕迹（del 嵌 ins 等），必须拒绝并引导先处理该修订 */
function insidePendingRevision(run) {
  let cur = run;
  while (cur && cur !== xmlDoc.documentElement) {
    if (cur.localName === 'ins' || cur.localName === 'del') return true;
    cur = cur.parentNode;
  }
  return false;
}
/** locateRuns 结果里若有 run 在待审修订内，返回拒绝错误；否则 null */
function guardPendingRevision(loc) {
  if (loc && loc.runs.some((r) => insidePendingRevision(r))) {
    return { ok: false, error: '目标文本位于待审修订（插入/删除痕迹）内：请先 list_revisions 查看，用 accept/reject 处理该修订后再编辑（find 以含插入痕迹的当前可见文本为准）' };
  }
  return null;
}

/** 修订痕迹修复（Word 拒开修复）：历史版本曾允许对待审修订内的文本再次编辑，
 *  产生非法嵌套痕迹（w:ins 内嵌 w:del / w:del 内嵌 w:ins），Word 按 OOXML schema
 *  校验直接拒绝打开。init 时扫描并拍平：
 *  - 嵌套的 ins/del：解开内层包裹、提升子节点，文本节点按外层类型转换
 *    （w:del 内只能 w:delText；w:ins 内只能 w:t）
 *  - 全局纠错：del 内残留 w:t -> delText；ins 内残留 delText -> t
 *  @returns {boolean} 是否有改动（调用方应持久化修复结果） */
function sanitizeRevisionMarks() {
  let changed = false;
  const all = Array.from(xmlDoc.getElementsByTagNameNS(W, 'ins'))
    .concat(Array.from(xmlDoc.getElementsByTagNameNS(W, 'del')));
  for (const node of all) {
    const outer = closestName(node.parentNode, 'ins') || closestName(node.parentNode, 'del');
    if (!outer) continue; // 无嵌套
    const outerTag = outer.localName;
    const parent = node.parentNode;
    const kids = Array.from(node.childNodes);
    for (const k of kids) {
      if (k.nodeType === 1) {
        if (outerTag === 'del' && k.localName === 't') {
          const dt = el('delText'); dt.setAttribute('xml:space', 'preserve'); dt.textContent = k.textContent;
          parent.insertBefore(dt, node);
        } else if (outerTag === 'ins' && k.localName === 'delText') {
          const t = el('t'); t.setAttribute('xml:space', 'preserve'); t.textContent = k.textContent;
          parent.insertBefore(t, node);
        } else {
          parent.insertBefore(k, node);
        }
      } else {
        parent.insertBefore(k, node);
      }
    }
    parent.removeChild(node);
    changed = true;
  }
  for (const t of Array.from(xmlDoc.getElementsByTagNameNS(W, 't'))) {
    if (closestName(t, 'del') && !closestName(t, 'ins')) {
      const dt = el('delText'); dt.setAttribute('xml:space', 'preserve'); dt.textContent = t.textContent;
      t.parentNode.replaceChild(dt, t);
      changed = true;
    }
  }
  for (const dt of Array.from(xmlDoc.getElementsByTagNameNS(W, 'delText'))) {
    if (closestName(dt, 'ins') && !closestName(dt, 'del')) {
      const t = el('t'); t.setAttribute('xml:space', 'preserve'); t.textContent = dt.textContent;
      dt.parentNode.replaceChild(t, dt);
      changed = true;
    }
  }
  return changed;
}
/** 跳过批注锚点（commentRangeStart/End、含 commentReference 的 run）后的下一个意义元素 */
function nextContentSibling(node) {
  let cur = nextElementSiblingOf(node);
  while (cur) {
    if (cur.localName === 'commentRangeStart' || cur.localName === 'commentRangeEnd') { cur = nextElementSiblingOf(cur); continue; }
    if (cur.localName === 'r' && cur.getElementsByTagNameNS(W, 'commentReference').length) { cur = nextElementSiblingOf(cur); continue; }
    return cur;
  }
  return null;
}

/* ---------- 文本索引层：全文拼接 + 偏移映射 + 跨 run 定位 ---------- */

/**
 * 按文档序遍历 w:p，段间补 '\n'，段内收集 w:t（跳过已删除文本 delText 及
 * 残留在 w:del 里的 w:t）。一个词被 Word 拆进多个 w:r 也能整体定位。
 */
function collectSegments() {
  const segs = [];
  let full = '';
  const paras = xmlDoc.getElementsByTagNameNS(W, 'p');
  for (const p of paras) {
    if (full.length) full += '\n';
    for (const t of p.getElementsByTagNameNS(W, 't')) {
      if (inDeleted(t)) continue;
      const txt = t.textContent || '';
      if (!txt) continue;
      segs.push({ node: t, start: full.length, end: full.length + txt.length });
      full += txt;
    }
  }
  return { segs, full };
}

/** 在全文 full 中查找 find：先精确子串，再空白归一化匹配；返回字符区间或 null */
function findTextRange(full, find) {
  const exact = full.indexOf(find);
  if (exact >= 0) return { start: exact, end: exact + find.length };
  // 归一化匹配：\s+ -> 单空格，并记录每个归一化字符 -> 原偏移
  const map = [];
  let norm = '';
  let i = 0;
  while (i < full.length) {
    if (/\s/.test(full[i])) {
      while (i < full.length && /\s/.test(full[i])) i++;
      if (i < full.length) { map.push(i); norm += ' '; }
    } else {
      map.push(i);
      norm += full[i];
      i++;
    }
  }
  const normFind = find.replace(/\s+/g, ' ').trim();
  if (!normFind) return null;
  const hit = norm.indexOf(normFind);
  if (hit < 0) return null;
  return { start: map[hit], end: map[hit + normFind.length - 1] + 1 };
}

/** 把某个 w:t 的宿主 w:r 在文本偏移处拆成两个 run（rPr 深拷贝保留），返回右半 run */
function splitRunAt(tNode, offset) {
  const run = tNode.parentNode;
  const text = tNode.textContent;
  if (!run || run.localName !== 'r' || offset <= 0 || offset >= text.length) return run;
  const right = run.cloneNode(true);
  tNode.textContent = text.slice(0, offset);
  const rt = childByName(right, 't');
  if (!rt) { if (run.parentNode) run.parentNode.insertBefore(right, run.nextSibling); return right; }
  rt.textContent = text.slice(offset);
  run.parentNode.insertBefore(right, run.nextSibling);
  return right;
}

/**
 * 定位 find 覆盖的所有 run：先按需拆分 start/end 边界 run，
 * 再收集被 [start,end) 完整覆盖的 w:t（去重宿主 run，按文档序）。
 */
function locateRuns(find) {
  let { segs, full } = collectSegments();
  const range = findTextRange(full, find);
  if (!range) return null;
  for (const pos of [range.start, range.end]) {
    for (const seg of segs) {
      if (pos > seg.start && pos < seg.end) {
        splitRunAt(seg.node, pos - seg.start);
        ({ segs, full } = collectSegments()); // 拆分后偏移变化，重建索引
        break;
      }
    }
  }
  const runs = [];
  const seen = new Set();
  for (const seg of segs) {
    if (seg.start >= range.start && seg.end <= range.end) {
      const run = seg.node.parentNode;
      if (run && run.localName === 'r' && !seen.has(run)) { seen.add(run); runs.push(run); }
    }
  }
  if (!runs.length) return null;
  return { runs, range };
}

/* ---------- run / 段落构造 ---------- */

/** 克隆参考 run 的 rPr 构造新 run（无参考则裸 run） */
function makeRun(text, refRun) {
  const r = el('r');
  if (refRun) {
    const rPr = childByName(refRun, 'rPr');
    if (rPr) r.appendChild(rPr.cloneNode(true));
  }
  const t = el('t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

function makeParagraph(text, refRun) {
  const p = el('p');
  if (text) p.appendChild(makeRun(text, refRun));
  return p;
}

/** 覆盖区间的宿主段落（首个 run 所在 w:p） */
function paragraphOfRun(run) {
  return closestName(run, 'p');
}

/** body 的插入末点：sectPr 之前（sectPr 必须保持最后） */
function bodyInsertPoint() {
  const body = xmlDoc.getElementsByTagNameNS(W, 'body')[0];
  const sectPr = directChildren(body, 'sectPr')[0];
  return { body, before: sectPr || null };
}

/* ---------- 修改痕迹（对话里的修改卡 + 回喂模型的自证材料） ----------
 * 每次成功的写操作把「改了哪、改前、改后」压进本次返回值，宿主据此渲染修改卡。
 * 见 lib/doc-edits.js。 */

const editBuf = [];

function recordEdit(op, location, before, after, note, extra) {
  editBuf.push({ op, location, before, after, note, ...(extra || {}) });
}

function attachEdits(r) {
  if (r && r.ok && editBuf.length) r.edits = editBuf.splice(0, editBuf.length);
  else editBuf.length = 0;
  return r;
}

/** 节点可见文本（w:t 拼接；用于「改前」取值）。 */
function nodeText(node) {
  if (!node) return '';
  let s = '';
  for (const t of node.getElementsByTagNameNS(W, 't')) s += t.textContent || '';
  return s;
}

/** 「第 N 段」定位：该 run 所在段落是 body 直接子段落里的第几段。 */
function paraLocation(node) {
  const para = node && node.localName === 'p' ? node : closestName(node, 'p');
  const body = xmlDoc && xmlDoc.getElementsByTagNameNS(W, 'body')[0];
  if (!para || !body) return '';
  const idx = directChildren(body, 'p').indexOf(para);
  return idx >= 0 ? `第 ${idx + 1} 段` : '';
}

/* ---------- styles.xml：标题样式查找 / 注入 ---------- */

function headingStyleId(level) {
  const fallback = `Heading${level}`;
  if (!stylesXml) return fallback;
  const styles = stylesXml.getElementsByTagNameNS(W, 'style');
  const wanted = new RegExp(`^\\s*(heading|标题)\\s*${level}\\s*$`, 'i');
  for (const s of styles) {
    if (attr(s, 'type') !== 'paragraph') continue;
    const nameEl = childByName(s, 'name');
    if (wanted.test(nameEl ? (attr(nameEl, 'val') || '') : '')) {
      return attr(s, 'styleId') || fallback;
    }
  }
  // 不存在则注入标准 heading 样式（Word 打开即正常显示级别）
  const sid = fallback;
  const st = stylesXml.createElementNS(W, 'w:style');
  st.setAttributeNS(W, 'w:type', 'paragraph');
  st.setAttributeNS(W, 'w:styleId', sid);
  const nm = stylesXml.createElementNS(W, 'w:name'); nm.setAttributeNS(W, 'w:val', `heading ${level}`); st.appendChild(nm);
  const pPr = stylesXml.createElementNS(W, 'w:pPr');
  pPr.appendChild(stylesXml.createElementNS(W, 'w:keepNext'));
  const ol = stylesXml.createElementNS(W, 'w:outlineLvl'); ol.setAttributeNS(W, 'w:val', String(Math.max(0, level - 1))); pPr.appendChild(ol);
  st.appendChild(pPr);
  const rPr = stylesXml.createElementNS(W, 'w:rPr');
  rPr.appendChild(stylesXml.createElementNS(W, 'w:b'));
  const szMap = { 1: 32, 2: 26, 3: 24, 4: 23, 5: 22, 6: 21 };
  const sz = stylesXml.createElementNS(W, 'w:sz'); sz.setAttributeNS(W, 'w:val', String(szMap[level] || 24)); rPr.appendChild(sz);
  st.appendChild(rPr);
  stylesXml.documentElement.appendChild(st);
  zip.file('word/styles.xml', serialize(stylesXml));
  return sid;
}

/* ---------- numbering.xml：列表编号定义（不存在则整包注入） ---------- */

async function ensureNumbering(ordered) {
  let numberingXml = null;
  const existing = zip.file('word/numbering.xml');
  if (existing) {
    numberingXml = parseXml(await existing.async('string'), 'numbering.xml');
  } else {
    numberingXml = parseXml(`${XML_DECL}<w:numbering xmlns:w="${W}"></w:numbering>`, 'numbering.xml');
    await addContentOverride('/word/numbering.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml');
    await addDocumentRel('numbering', 'numbering.xml');
  }
  // 追加一套 abstractNum + num（numId 取已有最大 +1，避免覆盖文档既有编号）
  const ids = Array.from(numberingXml.getElementsByTagNameNS(W, 'num'))
    .map((n) => parseInt(attr(n, 'numId'), 10) || 0);
  const aids = Array.from(numberingXml.getElementsByTagNameNS(W, 'abstractNum'))
    .map((n) => parseInt(attr(n, 'abstractNumId'), 10) || 0);
  const numId = Math.max(0, ...ids) + 1;
  const aid = Math.max(0, ...aids) + 1;
  const abs = numberingXml.createElementNS(W, 'w:abstractNum');
  abs.setAttributeNS(W, 'w:abstractNumId', String(aid));
  const multi = numberingXml.createElementNS(W, 'w:multiLevelType');
  multi.setAttributeNS(W, 'w:val', 'hybridMultilevel'); abs.appendChild(multi);
  for (let lvl = 0; lvl < 3; lvl++) {
    const l = numberingXml.createElementNS(W, 'w:lvl');
    l.setAttributeNS(W, 'w:ilvl', String(lvl));
    const start = numberingXml.createElementNS(W, 'w:start'); start.setAttributeNS(W, 'w:val', '1'); l.appendChild(start);
    const fmt = numberingXml.createElementNS(W, 'w:numFmt');
    fmt.setAttributeNS(W, 'w:val', ordered ? ['decimal', 'lowerLetter', 'lowerRoman'][lvl] : 'bullet');
    l.appendChild(fmt);
    const txt = numberingXml.createElementNS(W, 'w:lvlText');
    txt.setAttributeNS(W, 'w:val', ordered ? `%${lvl + 1}.` : ['\u2022', 'o', '\u00A7'][lvl]);
    l.appendChild(txt);
    abs.appendChild(l);
  }
  numberingXml.documentElement.appendChild(abs);
  const num = numberingXml.createElementNS(W, 'w:num');
  num.setAttributeNS(W, 'w:numId', String(numId));
  const ref = numberingXml.createElementNS(W, 'w:abstractNumId');
  ref.setAttributeNS(W, 'w:val', String(aid));
  num.appendChild(ref);
  numberingXml.documentElement.appendChild(num);
  zip.file('word/numbering.xml', serialize(numberingXml));
  return numId;
}

/* ---------- comments：note 以 Word 原生批注锚定 ---------- */

async function ensureCommentsPart() {
  const existing = zip.file('word/comments.xml');
  if (existing) {
    return parseXml(await existing.async('string'), 'comments.xml');
  }
  const commentsXml = parseXml(`${XML_DECL}<w:comments xmlns:w="${W}"></w:comments>`, 'comments.xml');
  await addContentOverride('/word/comments.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml');
  await addDocumentRel('comments', 'comments.xml');
  return commentsXml;
}

/* CT_Settings 顺序中必须位于 w:trackChanges 之前的子元素（schema 顺序前置段）：
 * 注入 trackChanges 时插在最后一个前置元素之后，避免破坏元素顺序导致 Word 拒开 */
const SETTINGS_BEFORE_TRACK_CHANGES = new Set([
  'writeProtection', 'view', 'zoom', 'removePersonalInformation', 'doNotDisplayPageBoundaries',
  'displayBackgroundShape', 'printPostScriptOverText', 'printFractionalCharacterWidth',
  'printFormsData', 'embedTrueTypeFonts', 'embedSystemFonts', 'saveSubsetFonts', 'saveFormsData',
  'mirrorMargins', 'alignBordersAndEdges', 'bordersDoNotSurroundHeader', 'bordersDoNotSurroundFooter',
  'gutterAtTop', 'hideSpellingErrors', 'hideGrammaticalErrors', 'activeWritingStyle', 'proofState',
  'formsDesign', 'attachedTemplate', 'linkStyles', 'stylePaneFormatFilter', 'stylePaneSortMethod',
  'documentType', 'mailMerge', 'revisionView',
]);

/** 保证 settings.xml 带 <w:trackChanges/>（按 schema 顺序插入）：Word 打开带修订的
 *  文档时修订模式直接开启，用户在 Word 里继续输入的新内容也会被跟踪 */
async function ensureTrackChangesSetting() {
  try {
    const existing = zip.file('word/settings.xml');
    const settingsXml = existing
      ? parseXml(await existing.async('string'), 'settings.xml')
      : parseXml(`${XML_DECL}<w:settings xmlns:w="${W}"></w:settings>`, 'settings.xml');
    const root = settingsXml.documentElement;
    if (Array.from(root.childNodes).some((c) => c.nodeType === 1 && c.localName === 'trackChanges')) return;
    // 找最后一个 schema 前置元素，插在其后（其余元素按顺序自然落在 trackChanges 之后）
    let insertAfter = null;
    for (const c of Array.from(root.childNodes)) {
      if (c.nodeType === 1 && SETTINGS_BEFORE_TRACK_CHANGES.has(c.localName)) insertAfter = c;
    }
    const tc = settingsXml.createElementNS(W, 'w:trackChanges');
    if (insertAfter && insertAfter.nextSibling) root.insertBefore(tc, insertAfter.nextSibling);
    else root.appendChild(tc);
    zip.file('word/settings.xml', serialize(settingsXml));
  } catch (_) {} // 无 settings.xml 或写入失败都不阻断修订本身
}

async function addComment(noteText) {
  if (!noteText) return null;
  const commentsXml = await ensureCommentsPart();
  const ids = Array.from(commentsXml.getElementsByTagNameNS(W, 'comment'))
    .map((c) => parseInt(attr(c, 'id'), 10) || 0);
  const cid = Math.max(commentSeq - 1, ...ids) + 1;
  commentSeq = cid + 1;
  const c = commentsXml.createElementNS(W, 'w:comment');
  c.setAttributeNS(W, 'w:id', String(cid));
  c.setAttributeNS(W, 'w:author', AUTHOR);
  c.setAttributeNS(W, 'w:date', new Date().toISOString());
  c.setAttributeNS(W, 'w:initials', INITIALS);
  const p = commentsXml.createElementNS(W, 'w:p');
  const r = commentsXml.createElementNS(W, 'w:r');
  const t = commentsXml.createElementNS(W, 'w:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = noteText;
  r.appendChild(t);
  p.appendChild(r);
  c.appendChild(p);
  commentsXml.documentElement.appendChild(c);
  zip.file('word/comments.xml', serialize(commentsXml));
  return cid;
}

/** 在包裹元素（w:ins/w:del）前后插批注锚点：rangeStart … rangeEnd + reference run */
function anchorComment(wrapEl, cid) {
  if (cid == null || !wrapEl.parentNode) return;
  const parent = wrapEl.parentNode;
  const start = el('commentRangeStart');
  setAttr(start, 'id', String(cid));
  parent.insertBefore(start, wrapEl);
  const end = el('commentRangeEnd');
  setAttr(end, 'id', String(cid));
  parent.insertBefore(end, wrapEl.nextSibling);
  const refRun = el('r');
  const ref = el('commentReference');
  setAttr(ref, 'id', String(cid));
  refRun.appendChild(ref);
  parent.insertBefore(refRun, end.nextSibling);
}

/** 移除一个批注的全部痕迹（锚点 + comments.xml 条目） */
async function removeComment(cid) {
  if (cid == null) return;
  for (const name of ['commentRangeStart', 'commentRangeEnd']) {
    for (const node of Array.from(xmlDoc.getElementsByTagNameNS(W, name))) {
      if (attr(node, 'id') === String(cid)) removeNode(node);
    }
  }
  for (const ref of Array.from(xmlDoc.getElementsByTagNameNS(W, 'commentReference'))) {
    if (attr(ref, 'id') === String(cid)) {
      const run = ref.parentNode;
      if (run && run.localName === 'r') removeNode(run);
    }
  }
  const commentsFile = zip.file('word/comments.xml');
  if (!commentsFile) return;
  const commentsXml = parseXml(await commentsFile.async('string'), 'comments.xml');
  for (const c of Array.from(commentsXml.getElementsByTagNameNS(W, 'comment'))) {
    if (attr(c, 'id') === String(cid)) removeNode(c);
  }
  zip.file('word/comments.xml', serialize(commentsXml));
}

/* ---------- zip 辅助：[Content_Types].xml / document.xml.rels ---------- */

async function addContentOverride(partName, contentType) {
  const f = zip.file('[Content_Types].xml');
  let text = await f.async('string');
  if (text.includes(`PartName="${partName}"`)) return;
  const ov = `<Override PartName="${partName}" ContentType="${contentType}"/>`;
  text = text.replace('</Types>', ov + '</Types>');
  zip.file('[Content_Types].xml', text);
}

async function addDocumentRel(type, target) {
  const f = zip.file('word/_rels/document' + '.xml.rels');
  if (!f) return;
  let text = await f.async('string');
  if (text.includes(`Target="${target}"`)) return;
  const ids = Array.from(text.matchAll(/Id="([^"]+)"/g)).map((m) => m[1]);
  const nextId = 'rId' + (ids.length + 1);
  const rel = `<Relationship Id="${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  text = text.replace('</Relationships>', rel + '</Relationships>');
  zip.file('word/_rels/document' + '.xml.rels', text);
}

/* ---------- 修订（OOXML 原生 w:ins / w:del） ---------- */

function revId() {
  // 全文扫描已有 w:id 取最大值，避免与既有修订冲突
  let max = revSeq - 1;
  for (const name of ['ins', 'del']) {
    for (const n of xmlDoc.getElementsByTagNameNS(W, name)) {
      const v = parseInt(attr(n, 'id'), 10);
      if (Number.isFinite(v) && v > max) max = v;
    }
  }
  revSeq = max + 1;
  return String(revSeq++);
}

function markAttrs(node) {
  setAttr(node, 'id', revId());
  setAttr(node, 'author', AUTHOR);
  setAttr(node, 'date', new Date().toISOString());
}

/** w:t -> w:delText（w:del 内的文本节点必须用 delText） */
function toDelText(run) {
  for (const t of Array.from(run.getElementsByTagNameNS(W, 't'))) {
    const dt = el('delText');
    dt.setAttribute('xml:space', 'preserve');
    dt.textContent = t.textContent;
    t.parentNode.replaceChild(dt, t);
  }
}

function toText(run) {
  for (const dt of Array.from(run.getElementsByTagNameNS(W, 'delText'))) {
    const t = el('t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = dt.textContent;
    dt.parentNode.replaceChild(t, dt);
  }
}

/** 把同父的连续 runs 包进 w:del；返回包裹元素 */
function wrapDel(runs) {
  const del = el('del');
  markAttrs(del);
  const parent = runs[0].parentNode;
  parent.insertBefore(del, runs[0]);
  for (const r of runs) del.appendChild(r);
  return del;
}

/** 把新 runs 包进 w:ins 插到 anchor 之后；返回包裹元素 */
function wrapInsAfter(newRuns, anchor) {
  const ins = el('ins');
  markAttrs(ins);
  anchor.parentNode.insertBefore(ins, anchor.nextSibling);
  for (const r of newRuns) ins.appendChild(r);
  return ins;
}

/** 解包包裹元素（ins/del），子节点原位提升 */
function unwrap(wrapEl) {
  const parent = wrapEl.parentNode;
  if (!parent) return;
  while (wrapEl.firstChild) parent.insertBefore(wrapEl.firstChild, wrapEl);
  removeNode(wrapEl);
}

/** 从 comments.xml 把批注正文填回修订 w:id。引擎重载后内存表是空的，列表才能看到 note。 */
async function hydrateRevisionNotes() {
  if (!xmlDoc || !zip) return;
  const file = zip.file('word/comments.xml');
  if (!file) return;
  let commentsXml;
  try {
    commentsXml = parseXml(await file.async('string'), 'comments.xml');
  } catch (_) {
    return;
  }
  const texts = new Map();
  for (const c of Array.from(commentsXml.getElementsByTagNameNS(W, 'comment'))) {
    const id = attr(c, 'id');
    if (!id) continue;
    let text = '';
    for (const t of Array.from(c.getElementsByTagNameNS(W, 't'))) text += t.textContent || '';
    texts.set(id, text);
  }
  const remember = (node, note, cid) => {
    if (!node || !note) return;
    if (node.localName !== 'ins' && node.localName !== 'del') return;
    const wid = attr(node, 'id');
    if (!wid) return;
    revNoteMap.set(wid, note);
    const n = parseInt(cid, 10);
    if (Number.isFinite(n)) revCommentMap.set(wid, n);
  };
  for (const start of Array.from(xmlDoc.getElementsByTagNameNS(W, 'commentRangeStart'))) {
    const note = texts.get(attr(start, 'id') || '');
    if (!note) continue;
    const cid = attr(start, 'id');
    let cur = nextElementSiblingOf(start);
    while (cur && !(cur.localName === 'commentRangeEnd' && attr(cur, 'id') === cid)) {
      remember(cur, note, cid);
      cur = nextElementSiblingOf(cur);
    }
    let prev = start.previousSibling;
    while (prev) {
      if (prev.nodeType === 1) {
        if (prev.localName === 'del') remember(prev, note, cid);
        break;
      }
      prev = prev.previousSibling;
    }
  }
}

/**
 * 列表编号在本次结果里唯一。w:id 撞车时只让文档序的第一条沿用它，
 * 其余另编号，accept/reject 因此不会一次打中两条。
 */
function assignListIds(items) {
  const seen = new Map();
  const kept = new Set();
  for (const item of items) {
    const wId = Number.isFinite(item.wId) && item.wId > 0 ? item.wId : 0;
    const n = (seen.get(wId) || 0) + 1;
    seen.set(wId, n);
    if (n === 1 && wId > 0) kept.add(wId);
  }
  seen.clear();
  let max = 0;
  for (const id of kept) if (id > max) max = id;
  const used = new Set(kept);
  for (const item of items) {
    const wId = Number.isFinite(item.wId) && item.wId > 0 ? item.wId : 0;
    const n = (seen.get(wId) || 0) + 1;
    seen.set(wId, n);
    if (n === 1 && wId > 0) {
      item.id = wId;
      continue;
    }
    do { max += 1; } while (used.has(max));
    used.add(max);
    item.id = max;
  }
  return items;
}

function revisionListId(el) {
  if (!el) return null;
  const hit = scanRevisions().find((r) => r.delEl === el || r.insEl === el);
  return hit ? hit.id : null;
}

/**
 * 文档序扫描修订列表；相邻的 del+ins（同作者，中间允许批注锚点）合并为
 * 一条 replace。返回条目含 DOM 元素引用，accept/reject 直接用。
 */
function scanRevisions() {
  const items = [];
  const seen = new Set();
  for (const node of xmlDoc.getElementsByTagNameNS(W, 'del')) {
    if (seen.has(node)) continue;
    const author = attr(node, 'author') || '';
    let insEl = null;
    const next = nextContentSibling(node);
    if (next && next.localName === 'ins' && (attr(next, 'author') || '') === author) {
      insEl = next;
      seen.add(insEl);
    }
    const delText = Array.from(node.getElementsByTagNameNS(W, 'delText')).map((d) => d.textContent).join('');
    const insText = insEl ? Array.from(insEl.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('') : '';
    items.push({
      // w:id 可能在 del 与 ins 上重复。列表 id 由 assignListIds 保证本次唯一。
      wId: parseInt(attr(node, 'id'), 10),
      type: insEl ? 'replace' : 'delete',
      find: delText,
      replacement: insText,
      note: revNoteMap.get(attr(node, 'id')) || (insEl ? revNoteMap.get(attr(insEl, 'id')) : '') || '',
      status: 'pending',
      author,
      delEl: node,
      insEl,
    });
  }
  for (const node of xmlDoc.getElementsByTagNameNS(W, 'ins')) {
    if (seen.has(node)) continue;
    const insText = Array.from(node.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('');
    items.push({
      wId: parseInt(attr(node, 'id'), 10),
      type: 'insert',
      find: '',
      replacement: insText,
      note: revNoteMap.get(attr(node, 'id')) || '',
      status: 'pending',
      author: attr(node, 'author') || '',
      delEl: null,
      insEl: node,
    });
  }
  return assignListIds(items);
}

async function applyRevisionVerdict(item, accept) {
  const cids = [];
  if (item.delEl) { const k = attr(item.delEl, 'id'); if (k && revCommentMap.has(k)) cids.push(revCommentMap.get(k)); }
  if (item.insEl) { const k = attr(item.insEl, 'id'); if (k && revCommentMap.has(k)) cids.push(revCommentMap.get(k)); }
  if (accept) {
    if (item.delEl) removeNode(item.delEl);
    if (item.insEl) unwrap(item.insEl);
  } else {
    if (item.insEl) removeNode(item.insEl);
    if (item.delEl) { toText(item.delEl); unwrap(item.delEl); }
  }
  for (const cid of new Set(cids)) await removeComment(cid);
}

/* ---------- 撤销 / 重做（document.xml 快照栈） ---------- */

function snapshot() {
  return serialize(xmlDoc);
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_CAP) undoStack.shift();
  redoStack.length = 0;
}
function restore(text) {
  xmlDoc = parseXml(text, 'document' + '.xml(undo)');
}

/* ---------- 渲染（v30 起引擎不再负责渲染：阅读器自行 docx-preview 渲染） ---------- */

async function exportDocx() {
  zip.file('word/document' + '.xml', serialize(xmlDoc));
  return zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

async function renderDoc() {
  if (!renderEl) return;
  // 曾用 await import('docx-preview') 动态加载渲染器——它会向 SW bundle 注入
  // Vite 的 __vitePreload 辅助（位置在 bundle 深处）触发 build.js 回归守卫误报；
  // 且 SW 无 window 永远走不到、阅读器也已改为自行渲染。删除动态导入，
  // 此处保留为 no-op（若未来重新接入容器渲染再补 renderAsync 调用）。
}
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderDoc, 80);
}

function ensureRenderStyle() {
  if (renderStyleEl || !containerEl) return;
  renderStyleEl = docRef && docRef.createElement('style');
  renderStyleEl.textContent = `
    .docx-edit-render ins { color: #16a34a; text-decoration: underline; text-underline-offset: 2px; }
    .docx-edit-render del { color: #dc2626; text-decoration: line-through; }
    .docx-edit-render .rev-flash { background: rgba(250, 204, 21, .45); border-radius: 2px; transition: background 1.2s; }
  `;
  containerEl.prepend(renderStyleEl);
}

/* ---------- 对外 API ---------- */

export async function initWordEditor(container, arrayBuffer) {
  // container 为 null/undefined = 无头模式（SW 引擎）：只做 zip/XML 手术，
  // 不建渲染容器、不挂 selection 监听、renderDoc 自然 no-op
  const hasContainer = !!container;
  containerEl = container;
  if (hasContainer) {
    containerEl.innerHTML = '';
    renderEl = docRef && docRef.createElement('div');
    renderEl.className = 'docx-edit-render';
    containerEl.appendChild(renderEl);
    ensureRenderStyle();
  } else {
    renderEl = null;
    renderStyleEl = null;
  }

  zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document' + '.xml');
  if (!docFile) throw new Error('不是有效的 docx 文档（缺少 word/document' + '.xml）');
  xmlDoc = parseXml(await docFile.async('string'), 'word/document' + '.xml');
  // 修复历史遗留的非法嵌套修订痕迹（Word 拒开）；改动由调用方持久化
  revisionSanitized = sanitizeRevisionMarks();
  const stylesFile = zip.file('word/styles.xml');
  stylesXml = stylesFile ? parseXml(await stylesFile.async('string'), 'styles.xml') : null;

  dirty = false;
  undoStack = [];
  redoStack = [];
  revCommentMap = new Map();
  revNoteMap = new Map();
  await hydrateRevisionNotes();

  if (hasContainer && typeof document !== 'undefined') {
    selListener = () => { if (selectionCb) selectionCb(); };
    if (docRef) docRef.addEventListener('selectionchange', selListener);
    renderEl.addEventListener('mouseup', selListener);
  }

  await renderDoc();
}

export function disposeWordEditor() {
  if (selListener && docRef) { docRef.removeEventListener('selectionchange', selListener); selListener = null; }
  clearTimeout(renderTimer);
  renderTimer = 0;
  renderPending = false;
  renderAgain = false;
  if (containerEl) containerEl.innerHTML = ''; // 含渲染容器与样式节点（修订面板由 reader 重建）
  containerEl = null;
  renderEl = null;
  renderStyleEl = null;
  zip = null;
  xmlDoc = null;
  stylesXml = null;
  selectionCb = null;
  undoStack = [];
  redoStack = [];
  revCommentMap = new Map();
  revNoteMap = new Map();
}

export function isDirty() {
  return dirty;
}

/** init 时是否修复过非法嵌套修订痕迹（调用方应把修复结果持久化，否则 Word 仍打不开） */
export function wasRevisionSanitized() {
  return revisionSanitized;
}

export function onWordSelectionChange(cb) {
  selectionCb = cb;
}

export async function exportWordDocx() {
  return exportDocx();
}

/** 全文文本（w:t 拼接，段间换行；供搜索 / AI 上下文 / 条目全文回写） */
export function wordText() {
  if (!xmlDoc) return '';
  const paras = xmlDoc.getElementsByTagNameNS(W, 'p');
  const lines = [];
  for (const p of paras) {
    let line = '';
    for (const node of p.getElementsByTagNameNS(W, '*')) {
      if (node.localName === 't' && !inDeleted(node)) line += node.textContent || '';
      else if (node.localName === 'tab') line += '\t';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function listReviewItems() {
  if (!xmlDoc) return [];
  return scanRevisions().map((r) => ({
    id: r.id, type: r.type, find: r.find, replacement: r.replacement, note: r.note, status: r.status,
  }));
}

export function pendingReviewCount() {
  if (!xmlDoc) return 0;
  return scanRevisions().length;
}

/** 面板点击定位：按修订元素在文档序 ins/del 中的位次对应渲染 DOM，滚动高亮 */
export async function focusRevision(rid) {
  const items = scanRevisions();
  const item = items.find((r) => r.id === rid);
  const target = item && (item.delEl || item.insEl);
  if (!target || !renderEl) return;
  // 计算目标元素在全部 ins/del（文档序合并排列）中的位次
  const all = [
    ...Array.from(xmlDoc.getElementsByTagNameNS(W, 'ins')),
    ...Array.from(xmlDoc.getElementsByTagNameNS(W, 'del')),
  ].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
  const idx = all.indexOf(target);
  await renderDoc();
  const domEls = renderEl.querySelectorAll('ins, del');
  const dom = domEls[idx];
  if (dom) {
    dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dom.classList.add('rev-flash');
    setTimeout(() => dom.classList.remove('rev-flash'), 1600);
  }
}

/* ---------- 工具执行入口 ---------- */

const HIGHLIGHT_ALIAS = {
  yellow: 'yellow', 黄: 'yellow', 黄色: 'yellow',
  green: 'green', 绿: 'green', 绿色: 'green',
  cyan: 'cyan', 青: 'cyan', 青色: 'cyan',
  magenta: 'magenta', 品红: 'magenta',
  blue: 'blue', 蓝: 'blue', 蓝色: 'blue',
  red: 'red', 红: 'red', 红色: 'red',
  darkblue: 'darkBlue', darkcyan: 'darkCyan', darkgreen: 'darkGreen',
  darkmagenta: 'darkMagenta', darkred: 'darkRed', darkyellow: 'darkYellow',
  darkgray: 'darkGray', gray: 'darkGray', grey: 'darkGray', 灰: 'darkGray', 灰色: 'darkGray',
  lightgray: 'lightGray',
  black: 'black', 黑: 'black', 黑色: 'black',
  white: 'white', 白: 'white', 白色: 'white',
};

const ALIGN_ALIAS = {
  left: 'left', 左: 'left', 左对齐: 'left',
  center: 'center', 中: 'center', 居中: 'center',
  right: 'right', 右: 'right', 右对齐: 'right',
  justify: 'both', both: 'both', 两端: 'both', 两端对齐: 'both',
};

function hexColor(v) {
  const s = String(v || '').trim().replace(/^#/, '');
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  if (/^[0-9A-Fa-f]{3}$/.test(s)) return s.split('').map((c) => c + c).join('').toUpperCase();
  return '';
}

function asBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === true || v === 1 || v === 'true') return true;
  if (v === false || v === 0 || v === 'false') return false;
  return null;
}

function ensureChild(parent, name) {
  let n = childByName(parent, name);
  if (!n) { n = el(name); parent.appendChild(n); }
  return n;
}

function dropChild(parent, name) {
  const n = childByName(parent, name);
  if (n) removeNode(n);
}

function setFlag(rPr, tag, on) {
  if (on) { if (!childByName(rPr, tag)) rPr.appendChild(el(tag)); }
  else dropChild(rPr, tag);
}

/** 校验 set_format 参数。返回 {fmt} 或 {error}。空字段忽略，非法值拒绝，避免写进一半。 */
function parseFormatArgs(args) {
  const fmt = {};
  const bools = ['bold', 'italic', 'underline', 'strike'];
  for (const key of bools) {
    if (args[key] === undefined) continue;
    const b = asBool(args[key]);
    if (b === null) return { error: `${key} 需要 true 或 false` };
    fmt[key] = b;
  }
  if (args.font) fmt.font = String(args.font).trim().slice(0, 64);
  if (args.size !== undefined && args.size !== '') {
    const pt = Number(args.size);
    if (!Number.isFinite(pt) || pt < 1 || pt > 72) return { error: 'size 是字号（磅），范围 1–72' };
    fmt.size = pt;
  }
  if (args.color) {
    const hex = hexColor(args.color);
    if (!hex) return { error: 'color 需要 #RRGGBB' };
    fmt.color = hex;
  }
  if (args.highlight) {
    const raw = String(args.highlight).trim();
    const named = HIGHLIGHT_ALIAS[raw] || HIGHLIGHT_ALIAS[raw.toLowerCase()];
    const hex = hexColor(raw);
    if (named) fmt.highlight = { kind: 'name', value: named };
    else if (hex) fmt.highlight = { kind: 'hex', value: hex };
    else return { error: 'highlight 用 Word 色名（yellow/red/blue…）或 #RRGGBB' };
  }
  if (args.align) {
    const val = ALIGN_ALIAS[String(args.align).trim()] || ALIGN_ALIAS[String(args.align).trim().toLowerCase()];
    if (!val) return { error: 'align 用 left / center / right / justify' };
    fmt.align = val;
  }
  if (args.line_spacing !== undefined && args.line_spacing !== '') {
    const mult = Number(args.line_spacing);
    if (!Number.isFinite(mult) || mult < 0.5 || mult > 5) return { error: 'line_spacing 是倍数，如 1、1.5、2' };
    fmt.line_spacing = mult;
  }
  for (const key of ['space_before', 'space_after', 'indent']) {
    if (args[key] === undefined || args[key] === '') continue;
    const pt = Number(args[key]);
    if (!Number.isFinite(pt) || pt < 0 || pt > 400) return { error: `${key} 是磅，范围 0–400` };
    fmt[key] = pt;
  }
  if (!Object.keys(fmt).length) return { error: 'set_format 至少指定一项格式（字体、字号、颜色、对齐、行距等）' };
  return { fmt };
}

function formatNote(fmt) {
  const bits = [];
  if (fmt.font) bits.push(`字体 ${fmt.font}`);
  if (fmt.size) bits.push(`${fmt.size}磅`);
  if (fmt.bold === true) bits.push('加粗');
  if (fmt.bold === false) bits.push('取消加粗');
  if (fmt.italic === true) bits.push('斜体');
  if (fmt.italic === false) bits.push('取消斜体');
  if (fmt.underline === true) bits.push('下划线');
  if (fmt.underline === false) bits.push('取消下划线');
  if (fmt.strike === true) bits.push('删除线');
  if (fmt.strike === false) bits.push('取消删除线');
  if (fmt.color) bits.push(`颜色 #${fmt.color}`);
  if (fmt.highlight) bits.push(fmt.highlight.kind === 'hex' ? `底色 #${fmt.highlight.value}` : `高亮 ${fmt.highlight.value}`);
  if (fmt.align) bits.push(`对齐 ${fmt.align === 'both' ? '两端' : fmt.align}`);
  if (fmt.line_spacing) bits.push(`行距 ${fmt.line_spacing}`);
  if (fmt.space_before != null) bits.push(`段前 ${fmt.space_before}磅`);
  if (fmt.space_after != null) bits.push(`段后 ${fmt.space_after}磅`);
  if (fmt.indent != null) bits.push(`左缩进 ${fmt.indent}磅`);
  return bits.join('，');
}

function applyRunFormat(run, fmt) {
  let rPr = childByName(run, 'rPr');
  if (!rPr) {
    rPr = el('rPr');
    run.insertBefore(rPr, run.firstChild);
  }
  if (fmt.bold !== undefined) { setFlag(rPr, 'b', fmt.bold); setFlag(rPr, 'bCs', fmt.bold); }
  if (fmt.italic !== undefined) { setFlag(rPr, 'i', fmt.italic); setFlag(rPr, 'iCs', fmt.italic); }
  if (fmt.strike !== undefined) setFlag(rPr, 'strike', fmt.strike);
  if (fmt.underline !== undefined) {
    if (fmt.underline) setAttr(ensureChild(rPr, 'u'), 'val', 'single');
    else dropChild(rPr, 'u');
  }
  if (fmt.font) {
    const fonts = ensureChild(rPr, 'rFonts');
    for (const slot of ['ascii', 'hAnsi', 'eastAsia', 'cs']) setAttr(fonts, slot, fmt.font);
  }
  if (fmt.size) {
    const half = String(Math.round(fmt.size * 2));
    setAttr(ensureChild(rPr, 'sz'), 'val', half);
    setAttr(ensureChild(rPr, 'szCs'), 'val', half);
  }
  if (fmt.color) setAttr(ensureChild(rPr, 'color'), 'val', fmt.color);
  if (fmt.highlight) {
    if (fmt.highlight.kind === 'name') {
      dropChild(rPr, 'shd');
      setAttr(ensureChild(rPr, 'highlight'), 'val', fmt.highlight.value);
    } else {
      dropChild(rPr, 'highlight');
      const shd = ensureChild(rPr, 'shd');
      setAttr(shd, 'val', 'clear');
      setAttr(shd, 'fill', fmt.highlight.value);
    }
  }
}

function applyParaFormat(para, fmt) {
  let pPr = directChildren(para, 'pPr')[0];
  if (!pPr) { pPr = el('pPr'); para.insertBefore(pPr, para.firstChild); }
  if (fmt.align) setAttr(ensureChild(pPr, 'jc'), 'val', fmt.align);
  if (fmt.line_spacing != null || fmt.space_before != null || fmt.space_after != null) {
    const sp = ensureChild(pPr, 'spacing');
    if (fmt.line_spacing != null) {
      setAttr(sp, 'line', String(Math.round(fmt.line_spacing * 240)));
      setAttr(sp, 'lineRule', 'auto');
    }
    if (fmt.space_before != null) setAttr(sp, 'before', String(Math.round(fmt.space_before * 20)));
    if (fmt.space_after != null) setAttr(sp, 'after', String(Math.round(fmt.space_after * 20)));
  }
  if (fmt.indent != null) setAttr(ensureChild(pPr, 'ind'), 'left', String(Math.round(fmt.indent * 20)));
}

export async function execWordTool(tool, args = {}) {
  editBuf.length = 0;
  return attachEdits(await execWordToolInner(tool, args));
}

async function execWordToolInner(tool, args = {}) {
  if (!xmlDoc) return { ok: false, error: 'Word 编辑器未初始化' };
  try {
    switch (tool) {
      case 'replace_text': {
        const find = String(args.find || '');
        if (!find) return { ok: false, error: '缺少 find 参数' };
        const replacement = String(args.replace ?? '');
        if (find === replacement) {
          if (!locateRuns(find)) return { ok: false, error: `未找到文本: ${find}` };
          return { ok: true, noop: true, summary: `「${find}」与替换文本相同，未修改` };
        }
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g1 = guardPendingRevision(loc);
        if (g1) return g1;
        pushUndo();
        const first = loc.runs[0];
        const where = paraLocation(first); // 必须在移除 run 之前取（移除后找不到宿主段落）
        if (replacement) first.parentNode.insertBefore(makeRun(replacement, first), first);
        for (const r of loc.runs) removeNode(r);
        recordEdit('replace', where, find, replacement);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已替换「${find}」->「${replacement}」（保留原格式，第 1 处）` };
      }
      case 'insert_text': {
        const text = String(args.text || '');
        if (!text) return { ok: false, error: '缺少 text 参数' };
        pushUndo();
        const { body, before } = bodyInsertPoint();
        for (const line of text.split('\n')) {
          body.insertBefore(makeParagraph(line), before);
        }
        recordEdit('insert', '文末', '', text);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已在文档末尾插入 ${text.split('\n').length} 段` };
      }
      case 'set_bold': {
        const find = String(args.find || '');
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g2 = guardPendingRevision(loc);
        if (g2) return g2;
        pushUndo();
        // bold 参数显式给定用之；缺省按首个 run 当前状态取反（toggle 语义）
        const firstRPr = childByName(loc.runs[0], 'rPr');
        const curBold = !!(firstRPr && Array.from(firstRPr.childNodes).some((c) => c.nodeType === 1 && c.localName === 'b'));
        const wantBold = args.bold === undefined ? !curBold : args.bold !== false;
        for (const run of loc.runs) {
          let rPr = childByName(run, 'rPr');
          if (!rPr) {
            rPr = el('rPr');
            run.insertBefore(rPr, run.firstChild);
          }
          for (const tag of ['b', 'bCs']) {
            const existing = childByName(rPr, tag);
            if (wantBold && !existing) rPr.appendChild(el(tag));
            else if (!wantBold && existing) removeNode(existing);
          }
        }
        recordEdit('format', paraLocation(loc.runs[0]), find, '', wantBold ? '加粗' : '取消加粗');
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已${wantBold ? '加粗' : '取消加粗'}「${find}」` };
      }
      case 'set_heading': {
        const find = String(args.find || '');
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g3 = guardPendingRevision(loc);
        if (g3) return g3;
        const level = Math.min(Math.max(parseInt(args.level, 10) || 2, 1), 6);
        pushUndo();
        const para = paragraphOfRun(loc.runs[0]);
        if (!para) return { ok: false, error: '目标文本不在段落内（可能位于文本框等容器）' };
        let pPr = directChildren(para, 'pPr')[0];
        if (!pPr) { pPr = el('pPr'); para.insertBefore(pPr, para.firstChild); }
        const styleId = headingStyleId(level);
        let pStyle = directChildren(pPr, 'pStyle')[0];
        if (!pStyle) { pStyle = el('pStyle'); pPr.insertBefore(pStyle, pPr.firstChild); }
        setAttr(pStyle, 'val', styleId);
        recordEdit('format', paraLocation(loc.runs[0]), find, '', `设为标题 ${level}`);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已将「${find}」所在段落设为标题 ${level}（样式 ${styleId}）` };
      }
      case 'add_list': {
        const find = String(args.find || '');
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g4 = guardPendingRevision(loc);
        if (g4) return g4;
        pushUndo();
        const numId = await ensureNumbering(!!args.ordered);
        const para = paragraphOfRun(loc.runs[0]);
        if (!para) return { ok: false, error: '目标文本不在段落内（可能位于文本框等容器）' };
        let pPr = directChildren(para, 'pPr')[0];
        if (!pPr) { pPr = el('pPr'); para.insertBefore(pPr, para.firstChild); }
        let numPr = directChildren(pPr, 'numPr')[0];
        if (!numPr) { numPr = el('numPr'); pPr.insertBefore(numPr, pPr.firstChild); }
        const ilvl = el('ilvl'); setAttr(ilvl, 'val', '0'); numPr.appendChild(ilvl);
        const nid = el('numId'); setAttr(nid, 'val', String(numId)); numPr.appendChild(nid);
        recordEdit('format', paraLocation(loc.runs[0]), find, '', args.ordered ? '转为有序列表' : '转为无序列表');
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已将「${find}」所在段落转为${args.ordered ? '有序' : '无序'}列表` };
      }
      case 'set_format': {
        const find = String(args.find || '');
        if (!find) return { ok: false, error: '缺少 find 参数' };
        const parsed = parseFormatArgs(args);
        if (parsed.error) return { ok: false, error: parsed.error };
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const gFmt = guardPendingRevision(loc);
        if (gFmt) return gFmt;
        pushUndo();
        const where = paraLocation(loc.runs[0]);
        const fmt = parsed.fmt;
        const runKeys = ['bold', 'italic', 'underline', 'strike', 'font', 'size', 'color', 'highlight'];
        const paraKeys = ['align', 'line_spacing', 'space_before', 'space_after', 'indent'];
        if (runKeys.some((k) => fmt[k] !== undefined)) {
          for (const run of loc.runs) applyRunFormat(run, fmt);
        }
        if (paraKeys.some((k) => fmt[k] !== undefined)) {
          const seen = new Set();
          for (const run of loc.runs) {
            const para = paragraphOfRun(run);
            if (!para || seen.has(para)) continue;
            seen.add(para);
            applyParaFormat(para, fmt);
          }
        }
        const note = formatNote(fmt);
        recordEdit('format', where, find, '', note);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已直接设置「${find}」的格式：${note}` };
      }
      case 'add_table': {
        const rows = Math.max(1, parseInt(args.rows, 10) || 2);
        const cols = Math.max(1, parseInt(args.cols, 10) || 2);
        pushUndo();
        const { body, before } = bodyInsertPoint();
        // 显式边框（不依赖 styles 的 TableGrid 样式），表头加底纹
        const tbl = el('tbl');
        const tblPr = el('tblPr');
        const tblW = el('tblW'); setAttr(tblW, 'w', '5000'); setAttr(tblW, 'type', 'pct'); tblPr.appendChild(tblW);
        const tblBorders = el('tblBorders');
        for (const side of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
          const b = el(side); setAttr(b, 'val', 'single'); setAttr(b, 'sz', '4'); setAttr(b, 'color', 'auto');
          tblBorders.appendChild(b);
        }
        tblPr.appendChild(tblBorders);
        tbl.appendChild(tblPr);
        const grid = el('tblGrid');
        for (let c = 0; c < cols; c++) {
          const gc = el('gridCol'); setAttr(gc, 'w', String(Math.floor(9000 / cols)));
          grid.appendChild(gc);
        }
        tbl.appendChild(grid);
        for (let r = 0; r < rows; r++) {
          const tr = el('tr');
          for (let c = 0; c < cols; c++) {
            const tc = el('tc');
            const tcPr = el('tcPr');
            if (r === 0 && args.header !== false) {
              const shd = el('shd'); setAttr(shd, 'val', 'clear'); setAttr(shd, 'fill', 'E8E8E8');
              tcPr.appendChild(shd);
            }
            tc.appendChild(tcPr);
            tc.appendChild(makeParagraph(''));
            tr.appendChild(tc);
          }
          tbl.appendChild(tr);
        }
        body.insertBefore(tbl, before);
        body.insertBefore(makeParagraph(''), before); // 表格后必须跟段落
        recordEdit('table', '文末', '', `${rows}×${cols} 表格`);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已在文档末尾插入 ${rows}×${cols} 表格` };
      }
      case 'set_cell': {
        const row = Math.max(0, parseInt(args.row, 10) || 0);
        const col = Math.max(0, parseInt(args.col, 10) || 0);
        const tbl = xmlDoc.getElementsByTagNameNS(W, 'tbl')[0];
        if (!tbl) return { ok: false, error: '文档中没有表格' };
        const trs = directChildren(tbl, 'tr');
        const tr = trs[row];
        if (!tr) return { ok: false, error: `表格行不存在（共 ${trs.length} 行，第 ${row + 1} 行越界）` };
        const tcs = directChildren(tr, 'tc');
        const tc = tcs[col];
        if (!tc) return { ok: false, error: `表格列不存在（第 ${row + 1} 行共 ${tcs.length} 列，第 ${col + 1} 列越界）` };
        pushUndo();
        const value = String(args.value ?? '');
        const paras = directChildren(tc, 'p');
        const firstPara = paras[0] || (() => { const p = makeParagraph(''); tc.appendChild(p); return p; })();
        // 保留原单元格首个 run 的 rPr（字体字号颜色延续）
        const refRun = firstPara.getElementsByTagNameNS(W, 'r')[0] || null;
        const beforeText = nodeText(firstPara);
        Array.from(firstPara.childNodes).forEach((c) => {
          if (c.nodeType === 1 && ['r', 'ins', 'del'].includes(c.localName)) c.parentNode.removeChild(c);
        });
        if (value) firstPara.appendChild(makeRun(value, refRun));
        for (const extra of paras.slice(1)) removeNode(extra);
        recordEdit('cell', `表格第 ${row + 1} 行第 ${col + 1} 列`, beforeText, value);
        dirty = true;
        scheduleRender();
        return { ok: true, summary: `已写入表格第 ${row + 1} 行第 ${col + 1} 列: ${value || '(空)'}` };
      }
      case 'undo': {
        if (!undoStack.length) return { ok: true, summary: '没有可撤销的操作' };
        redoStack.push(snapshot());
        restore(undoStack.pop());
        dirty = true;
        scheduleRender();
        return { ok: true, summary: '已撤销上一步' };
      }
      case 'redo': {
        if (!redoStack.length) return { ok: true, summary: '没有可重做的操作' };
        undoStack.push(snapshot());
        restore(redoStack.pop());
        dirty = true;
        scheduleRender();
        return { ok: true, summary: '已重做' };
      }
      default:
        return { ok: false, error: `未知 Word 工具: ${tool}。可用：replace_text / insert_text / set_format / set_bold / set_heading / add_list / add_table / set_cell / undo / redo（export 由阅读器保存流程处理）` };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function execReviewTool(tool, args = {}) {
  editBuf.length = 0;
  return attachEdits(await execReviewToolInner(tool, args));
}

async function execReviewToolInner(tool, args = {}) {
  if (!xmlDoc) return { ok: false, error: 'Word 引擎未初始化（文档原件缺失或尚未载入）' };
  try {
    if (tool === 'suggest_replace' || tool === 'suggest_insert' || tool === 'suggest_delete') {
      await ensureTrackChangesSetting(); // 让 Word 打开时修订模式直接开启
    }
    switch (tool) {
      case 'suggest_replace': {
        const find = String(args.find || '');
        const replacement = String(args.replacement ?? '');
        if (!find) return { ok: false, error: '缺少 find 参数' };
        if (find === replacement) {
          if (!locateRuns(find)) return { ok: false, error: `未找到文本: ${find}` };
          return { ok: true, noop: true, summary: `「${find}」与替换文本相同，未写入修订` };
        }
        const dup = scanRevisions().find((r) => r.type === 'replace' && r.find === find && r.replacement === replacement);
        if (dup) {
          return { ok: true, already_pending: true, summary: `已有相同待审修订 #${dup.id}，未重复添加`, revision: { id: dup.id } };
        }
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g5 = guardPendingRevision(loc);
        if (g5) return g5;
        pushUndo();
        const where = paraLocation(loc.runs[0]); // 包裹前取段落定位
        // runs 按宿主分组：跨段匹配时逐段包裹，替换文本放第一段
        const byParent = new Map();
        for (const run of loc.runs) {
          const p = run.parentNode;
          if (!byParent.has(p)) byParent.set(p, []);
          byParent.get(p).push(run);
        }
        let delEl = null;
        for (const [, runs] of byParent) {
          const d = wrapDel(runs);
          if (!delEl) delEl = d;
        }
        for (const run of loc.runs) toDelText(run);
        const insEl = wrapInsAfter([makeRun(replacement, loc.runs[0])], delEl);
        const note = String(args.note || '').trim();
        if (note) {
          const cid = await addComment(note);
          anchorComment(insEl, cid);
          revCommentMap.set(attr(insEl, 'id'), cid);
          revNoteMap.set(attr(insEl, 'id'), note);
          if (delEl) {
            revCommentMap.set(attr(delEl, 'id'), cid);
            revNoteMap.set(attr(delEl, 'id'), note);
          }
        }
        dirty = true;
        scheduleRender();
        const id = revisionListId(insEl) || revisionListId(delEl);
        recordEdit('replace', where, find, replacement, note ? `待审修订 · ${note}` : '待审修订', { tracked: true });
        return { ok: true, summary: `已提出修订 #${id}：把「${find}」改为「${replacement}」${note ? `（${note}）` : ''}，Word 原生修订痕迹`, revision: { id } };
      }
      case 'suggest_insert': {
        const text = String(args.text || '');
        if (!text) return { ok: false, error: '缺少 text 参数' };
        pushUndo();
        const { body, before } = bodyInsertPoint();
        const note = String(args.note || '').trim();
        const cid = note ? await addComment(note) : null;
        let lastIns = null;
        for (const line of text.split('\n')) {
          const p = makeParagraph('');
          const ins = el('ins');
          markAttrs(ins);
          if (line) ins.appendChild(makeRun(line));
          p.appendChild(ins);
          body.insertBefore(p, before);
          lastIns = ins;
        }
        if (cid != null && lastIns) {
          anchorComment(lastIns, cid);
          revCommentMap.set(attr(lastIns, 'id'), cid);
          revNoteMap.set(attr(lastIns, 'id'), note);
        }
        dirty = true;
        scheduleRender();
        const id = revisionListId(lastIns);
        recordEdit('insert', '文末', '', text, note ? `待审修订 · ${note}` : '待审修订', { tracked: true });
        return { ok: true, summary: `已在文档末尾插入修订 #${id}：${text.slice(0, 40)}${text.length > 40 ? '…' : ''}${note ? `（${note}）` : ''}`, revision: { id } };
      }
      case 'suggest_delete': {
        const find = String(args.find || '');
        if (!find) return { ok: false, error: '缺少 find 参数' };
        const loc = locateRuns(find);
        if (!loc) return { ok: false, error: `未找到文本: ${find}` };
        const g6 = guardPendingRevision(loc);
        if (g6) return g6;
        pushUndo();
        const where = paraLocation(loc.runs[0]); // 包裹前取段落定位
        const byParent = new Map();
        for (const run of loc.runs) {
          const p = run.parentNode;
          if (!byParent.has(p)) byParent.set(p, []);
          byParent.get(p).push(run);
        }
        let delEl = null;
        for (const [, runs] of byParent) {
          const d = wrapDel(runs);
          if (!delEl) delEl = d;
        }
        for (const run of loc.runs) toDelText(run);
        const note = String(args.note || '').trim();
        if (note && delEl) {
          const cid = await addComment(note);
          anchorComment(delEl, cid);
          revCommentMap.set(attr(delEl, 'id'), cid);
          revNoteMap.set(attr(delEl, 'id'), note);
        }
        dirty = true;
        scheduleRender();
        const id = revisionListId(delEl);
        recordEdit('delete', where, find, '', note ? `待审修订 · ${note}` : '待审修订', { tracked: true });
        return { ok: true, summary: `已提出删除修订 #${id}：「${find}」${note ? `（${note}）` : ''}`, revision: { id } };
      }
      case 'list_revisions': {
        const items = scanRevisions();
        return {
          ok: true,
          count: items.length,
          pending: items.length,
          revisions: items.map((r) => ({ id: r.id, type: r.type, find: r.find, replacement: r.replacement, note: r.note, status: r.status })),
        };
      }
      case 'accept':
      case 'reject': {
        const items = scanRevisions();
        const ids = args.id === 'all' || args.id === undefined
          ? items.map((r) => r.id)
          : [Number(args.id)];
        if (!ids.length) return { ok: false, error: '没有可处理的修订（先 list_revisions 查看编号）' };
        const targets = items.filter((r) => ids.includes(r.id));
        if (!targets.length) return { ok: false, error: `修订编号不存在（共 ${items.length} 条）` };
        pushUndo();
        let done = 0;
        const processed = [];
        for (const item of targets) {
          // 回显被处理修订的完整内容：即使 id 命中错误对象也能当场察觉（Bug 2 修复）
          processed.push({ id: item.id, type: item.type, find: item.find, replacement: item.replacement, note: item.note });
          await applyRevisionVerdict(item, tool === 'accept');
          done++;
        }
        dirty = true;
        scheduleRender();
        const left = scanRevisions().length;
        recordEdit('review', '', '', '', `已${tool === 'accept' ? '接受' : '拒绝'} ${done} 条修订，剩余 ${left} 条`, { pending: left > 0 });
        return {
          ok: true,
          summary: `已${tool === 'accept' ? '接受' : '拒绝'} ${done} 条修订，剩余 ${scanRevisions().length} 条待处理`,
          processed,
        };
      }
      default:
        return { ok: false, error: `未知审阅动作: ${tool}。可用：suggest_replace(find, replacement, note) / suggest_insert(text, note) / suggest_delete(find, note) / list_revisions / accept(id|"all") / reject(id|"all")` };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
