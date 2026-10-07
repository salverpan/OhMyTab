/* ---- DOCX Template Engine: parse → detect structure → build ---- */
import JSZip from 'jszip';
import { chatComplete, ApiError } from './providers/index.js';

const WML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export const ROLE_LABELS = {
  'doc-title': '文档标题',
  'doc-subtitle': '文档副标题',
  'doc-date': '文档日期',
  'entry-body': '正文',
  'entry-source': '来源',
  'entry-link': '链接',
  'separator': '分隔符',
  'ignore': '忽略',
};

const ROLE_TO_PLACEHOLDER = {
  'doc-title': '{{DOC_TITLE}}',
  'doc-subtitle': '{{DOC_SUBTITLE}}',
  'doc-date': '{{DOC_DATE}}',
  'entry-body': '{{ENTRY_SUMMARY}}',
  'entry-source': '{{ENTRY_SOURCE}}',
  'entry-link': '{{ENTRY_LINK}}',
};

/* ---- Step 1: Parse uploaded DOCX into paragraph list ---- */

export async function parseDocxSample(file) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('无法读取 document.xml');

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML 解析失败');

  const body = doc.getElementsByTagNameNS(WML_NS, 'body')[0];
  if (!body) throw new Error('文档结构异常: 缺少 body');

  const paragraphs = [];
  let idx = 0;

  for (const child of [...body.childNodes]) {
    if (child.nodeType !== 1) continue;
    if (!isP(child) && !isHL(child) && !isTbl(child)) continue;

    if (isP(child)) {
      const para = paragraphInfo(child, idx);
      if (para) { paragraphs.push(para); idx++; }
    } else if (isHL(child)) {
      const para = hyperlinkInfo(child, idx);
      if (para) { paragraphs.push(para); idx++; }
    } else if (isTbl(child)) {
      const rows = getChildrenNS(child, WML_NS, 'tr');
      for (const row of rows) {
        const cells = getChildrenNS(row, WML_NS, 'tc');
        for (const cell of cells) {
          for (const c of [...cell.childNodes]) {
            if (c.nodeType !== 1) continue;
            if (isP(c)) {
              const para = paragraphInfo(c, idx);
              if (para) { paragraphs.push(para); idx++; }
            } else if (isHL(c)) {
              const para = hyperlinkInfo(c, idx);
              if (para) { paragraphs.push(para); idx++; }
            }
          }
        }
      }
    }
  }

  const docxBase64 = bufferToBase64(buffer);
  return { paragraphs, docxBase64 };
}

/* ---- Step 2: Auto-classify paragraphs ---- */

export function detectStructure(paragraphs) {
  if (paragraphs.length === 0) {
    return { classified: [], docLevel: [], entryBlock: [], separator: -1 };
  }

  const classified = paragraphs.map((p) => ({
    ...p,
    role: classifyParagraph(p, paragraphs),
  }));

  const docLevel = [];
  const entryBlock = [];
  let separator = -1;

  for (const p of classified) {
    if (p.role === 'doc-title' || p.role === 'doc-subtitle' || p.role === 'doc-date') {
      docLevel.push(p.index);
    } else if (p.role === 'separator') {
      if (separator === -1) separator = p.index;
    } else {
      entryBlock.push(p.index);
    }
  }

  // If nothing classified as entry, put everything after doc-level into entry
  if (entryBlock.length === 0) {
    const maxDoc = docLevel.length > 0 ? Math.max(...docLevel) : -1;
    for (const p of classified) {
      if (p.index > maxDoc && p.role !== 'separator') {
        entryBlock.push(p.index);
      }
    }
  }

  return {
    classified: classified.map((p) => ({
      index: p.index,
      role: p.role,
      text: p.text.slice(0, 80),
    })),
    docLevel,
    entryBlock: entryBlock.sort((a, b) => a - b),
    separator,
  };
}

/* ---- Step 2b: AI-assisted structure detection ---- */

const AI_STRUCTURE_PROMPT = `分析以下 DOCX 文档的段落列表，识别文档结构。

每段格式：#编号: "文本" 或 #编号(runs): ["片段1"] ["片段2"] ...
其中 runs 表示该段由多个不同格式的文字片段组成（如加粗编号+正常正文）。

请完成：
1. 标题段落 — 文档大标题，只出现一次
2. 条目模式 — 每个"条目"由哪些段落组成（取第一条目），以及每段内哪个片段是"编号"（如【1】），哪个是"内容"
3. 分隔符段落 — 条目间的分隔段落编号
4. 忽略段落 — 章节小标题、多余空白等

输出格式（严格遵守，中文冒号，每行一条）：
标题段落: 0
条目模式: 4, 5
条目4的编号片段: 0
条目5的编号片段: 0
分隔符段落: 6
忽略段落: 2, 3

编号片段规则：片段从0开始计数。如果某段没有明显的编号片段则写 -1。`;

export async function aiDetectStructure(paragraphs, apiConfig) {
  // Build paragraph list with per-run info for multi-format detection
  const maxParas = Math.min(paragraphs.length, 100);
  const paraList = paragraphs.slice(0, maxParas).map((p) => {
    if (p.runs && p.runs.length > 1) {
      const runDescs = p.runs.map(r => {
        const fmt = [];
        if (r.bold) fmt.push('b');
        if (r.color && r.color !== '000000') fmt.push('#' + r.color);
        const label = fmt.length > 0 ? `[${fmt.join(',')}]` : '';
        return `${label}"${r.text.slice(0, 60)}"`;
      }).join(' ');
      return `#${p.index}(runs): ${runDescs}`;
    }
    return `#${p.index}: "${p.text.slice(0, 120)}"`;
  }).join('\n');

  const prompt = AI_STRUCTURE_PROMPT + '\n\n段落列表：\n' + paraList;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const { content } = await chatComplete(apiConfig, [{ role: 'user', content: prompt }], {
      temperature: 0.1,
      maxTokens: 500,
      signal: controller.signal,
    });
    if (!content) throw new Error('AI 返回为空');
    return parseAiStructure(content, paragraphs);
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(`AI 结构分析失败 (${err.status}): ${(err.body || '').slice(0, 150)}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAiStructure(text, paragraphs) {
  const docLevel = [];
  const entryPattern = [];
  const ignoreSet = new Set();
  let separator = -1;
  // Per-paragraph run index for the "number" fragment: { paraIndex: runIndex }
  const numberRunMap = {};

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match "条目4的编号片段: 0" pattern
    const runMatch = line.match(/^条目(\d+)的编号片段[：:]\s*(-?\d+)/);
    if (runMatch) {
      const paraIdx = parseInt(runMatch[1]);
      const runIdx = parseInt(runMatch[2]);
      if (runIdx >= 0) numberRunMap[paraIdx] = runIdx;
      continue;
    }

    const match = line.match(/(?:标题段落|条目模式|分隔符段落|忽略段落)[：:]\s*(.+)/);
    if (!match) continue;

    const label = line.match(/^(标题段落|条目模式|分隔符段落|忽略段落)/)?.[1] || '';
    const numbers = match[1].split(/[,，、\s]+/).map(s => parseInt(s)).filter(n => !isNaN(n));

    switch (label) {
      case '标题段落':
        docLevel.push(...numbers);
        break;
      case '条目模式':
        entryPattern.push(...numbers);
        break;
      case '分隔符段落':
        if (numbers.length > 0) separator = numbers[0];
        break;
      case '忽略段落':
        numbers.forEach(n => ignoreSet.add(n));
        break;
    }
  }

  // Build classified list for UI
  const classified = paragraphs.map((p) => {
    let role = 'ignore';
    if (docLevel.includes(p.index)) role = 'doc-title';
    else if (entryPattern.includes(p.index)) role = classifyParagraph(p, paragraphs);
    else if (p.index === separator) role = 'separator';
    else if (ignoreSet.has(p.index)) role = 'ignore';
    else role = classifyParagraph(p, paragraphs);
    return { index: p.index, role, text: p.text.slice(0, 80) };
  });

  // Assign roles for entry pattern paragraphs
  const entryRoles = {};
  entryPattern.forEach((idx, i) => {
    const para = paragraphs.find(p => p.index === idx);
    const role = classifyParagraph(para || { text: '', fontInfo: {} }, paragraphs);
    entryRoles[i] = role;
  });

  return {
    classified,
    docLevel: docLevel.sort((a, b) => a - b),
    entryPattern: entryPattern.sort((a, b) => a - b),
    separator,
    entryRoles,
    numberRunMap,  // AI-identified number prefix runs per paragraph
    aiRaw: text,
  };
}

/* ---- Step 3: Build template by inserting placeholders ---- */

export async function buildTemplate(file, structure) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('无法读取 document.xml');

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');
  const body = doc.getElementsByTagNameNS(WML_NS, 'body')[0];

  const paraElements = collectParaElements(body);
  const { docLevel, docRoles, entryRoles, separator } = structure;
  const entryIndices = structure.entryPattern || structure.entryBlock || [];
  const isPattern = !!structure.entryPattern;

  console.log('[模板构建] paraElements:', paraElements.length, 'docLevel:', docLevel, 'entryIndices:', entryIndices, 'pattern:', isPattern);

  // Replace doc-level text with placeholders
  for (const idx of docLevel) {
    const el = paraElements[idx];
    if (!el) { console.warn('[模板构建] docLevel idx', idx, '元素不存在'); continue; }
    const role = (docRoles && docRoles[idx]) || 'doc-title';
    const placeholder = ROLE_TO_PLACEHOLDER[role];
    if (placeholder) replaceTextInElement(el, placeholder);
  }

  // Replace entry paragraphs with placeholders, respecting AI-identified number runs
  const numberRunMap = structure.numberRunMap || {};
  for (let i = 0; i < entryIndices.length; i++) {
    const idx = entryIndices[i];
    const el = paraElements[idx];
    if (!el) { console.warn('[模板构建] entry idx', idx, '元素不存在'); continue; }
    const role = (entryRoles && entryRoles[i]) || inferEntryRole(el);
    const placeholder = ROLE_TO_PLACEHOLDER[role];
    if (placeholder) {
      replaceTextInElement(el, placeholder, numberRunMap[idx]);
    }
  }

  // EntryPattern mode: remove paragraphs NOT in docLevel, entryIndices, or separator
  if (isPattern) {
    const keepSet = new Set([...docLevel, ...entryIndices]);
    if (separator >= 0) keepSet.add(separator);
    const toRemove = [];
    for (let i = 0; i < paraElements.length; i++) {
      if (!keepSet.has(i)) toRemove.push(i);
    }
    console.log('[模板构建] 移除多余段落:', toRemove);
    for (const idx of toRemove.sort((a, b) => b - a)) {
      const el = paraElements[idx];
      if (el?.parentNode) el.parentNode.removeChild(el);
    }
  }

  // Serialize modified document.xml back
  const newDocXml = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', newDocXml);

  const templateBlob = await zip.generateAsync({ type: 'arraybuffer' });
  const docxBase64 = bufferToBase64(templateBlob);

  // After modifications, re-scan to get fresh indices
  const finalElements = collectParaElements(body);
  const oldToNew = new Map();
  paraElements.forEach((el, oldIdx) => {
    const newIdx = finalElements.indexOf(el);
    if (newIdx >= 0) oldToNew.set(oldIdx, newIdx);
  });

  const newDocLevel = docLevel.map(i => oldToNew.get(i)).filter(i => i !== undefined).sort((a, b) => a - b);
  const newEntry = entryIndices.map(i => oldToNew.get(i)).filter(i => i !== undefined).sort((a, b) => a - b);
  const newSep = separator >= 0 ? (oldToNew.get(separator) ?? -1) : -1;

  console.log('[模板构建] 最终索引 — docLevel:', newDocLevel, 'entryBlock:', newEntry, 'separator:', newSep);

  const exportStructure = {
    docLevel: newDocLevel,
    entryBlock: newEntry,
    entryPattern: isPattern ? newEntry : undefined,
    separator: newSep,
    docRoles: docRoles || {},
    entryRoles: entryRoles || {},
  };

  console.log('[模板构建] 完成');
  return { docxBase64, structure: exportStructure };
}

/* ---- Placeholder list for UI reference ---- */

/* ---- Paragraph parsing ---- */

function paragraphInfo(p, index) {
  const text = collectText(p);
  const isEmpty = !text.trim() && !hasDrawing(p);

  const runs = getChildrenNS(p, WML_NS, 'r');
  const fontInfo = extractFontInfo(runs[0]);
  const pPr = getChildrenNS(p, WML_NS, 'pPr')[0];
  const align = pPr ? getAlignment(pPr) : 'left';

  // Extract per-run info for AI multi-format detection
  const runInfo = runs.map(r => {
    const tEls = getChildrenNS(r, WML_NS, 't');
    const runText = tEls.map(t => t.textContent || '').join('');
    const rPr = getChildrenNS(r, WML_NS, 'rPr')[0];
    const fi = extractFontInfo(r);
    return { text: runText, bold: fi.bold, color: fi.color, fontSize: fi.fontSize };
  });

  return { index, text: text.trim(), fontInfo, align, isEmpty, runs: runInfo };
}

function hyperlinkInfo(hl, index) {
  const text = collectText(hl);
  const runs = getChildrenNS(hl, WML_NS, 'r');
  const fontInfo = extractFontInfo(runs[0]);

  return {
    index,
    text: text.trim(),
    fontInfo,
    align: 'left',
    isEmpty: !text.trim(),
    isHyperlink: true,
  };
}

function collectText(el) {
  let text = '';
  const runs = getChildrenNS(el, WML_NS, 'r');
  for (const r of runs) {
    const tEls = getChildrenNS(r, WML_NS, 't');
    for (const t of tEls) text += t.textContent || '';
  }
  return text;
}

function hasDrawing(p) {
  return p.getElementsByTagNameNS(WML_NS, 'drawing').length > 0;
}

function extractFontInfo(run) {
  if (!run) return { fontSize: null, bold: false, eastAsia: null, ascii: null, color: null };
  const rPr = getChildrenNS(run, WML_NS, 'rPr')[0];
  if (!rPr) return { fontSize: null, bold: false, eastAsia: null, ascii: null, color: null };

  const sz = getChildrenNS(rPr, WML_NS, 'sz')[0];
  const bEls = getChildrenNS(rPr, WML_NS, 'b');
  const rFonts = getChildrenNS(rPr, WML_NS, 'rFonts')[0];
  const color = getChildrenNS(rPr, WML_NS, 'color')[0];

  return {
    fontSize: sz ? Math.round(parseInt(sz.getAttribute('w:val')) / 2) : null,
    bold: bEls.length > 0 && bEls[0].getAttribute('w:val') !== '0',
    eastAsia: rFonts?.getAttribute('w:eastAsia') || null,
    ascii: rFonts?.getAttribute('w:ascii') || rFonts?.getAttribute('w:hAnsi') || null,
    color: color?.getAttribute('w:val') || null,
  };
}

function getAlignment(pPr) {
  const jc = getChildrenNS(pPr, WML_NS, 'jc')[0];
  return jc?.getAttribute('w:val') || 'left';
}

/* ---- Classification heuristics ---- */

function classifyParagraph(para, allParas) {
  const text = para.text;
  const fi = para.fontInfo;

  if (para.isEmpty || !text) return 'separator';

  // Date pattern
  if (/^\d{4}[年\-\/\.]\d{1,2}[月\-\/\.]\d{1,2}/.test(text) && text.length < 30) {
    return 'doc-date';
  }

  // URL pattern
  if (/https?:\/\//.test(text)) return 'entry-link';

  // Source pattern
  if (/[（(][\d]{1,2}月[\d]{1,2}日.{1,20}[）)]|^(?:消息|来源|报道|综合)/.test(text) && text.length < 60) {
    return 'entry-source';
  }

  // Link label pattern
  if (/^【?链接】?[：:]|^链接[：:]/.test(text) && text.length < 100) {
    return 'entry-link';
  }

  // Date in the middle of text
  if (/\d{4}[年\-\/\.]\d{1,2}[月\-\/\.]\d{1,2}/.test(text) && text.length < 30) {
    return 'doc-date';
  }

  // Title: largest font + first occurrence
  const maxFont = Math.max(...allParas.map((p) => p.fontInfo.fontSize || 0).filter(Boolean), 0);
  const maxFontParas = allParas.filter((p) => p.fontInfo.fontSize === maxFont && maxFont >= 14);
  if (maxFontParas.length === 1 && para === maxFontParas[0] && maxFont >= 14) {
    return 'doc-title';
  }

  // First paragraph with bold and large font
  if (fi.fontSize && fi.fontSize >= 14 && fi.bold && para.index === 0) {
    return 'doc-title';
  }

  // Long text → body
  if (text.length > 80) return 'entry-body';

  // Medium text that's content-like → body
  if (text.length > 40 && !/[消息来源报道]/.test(text)) return 'entry-body';

  // Default short text → separator
  return 'separator';
}

function inferEntryRole(el) {
  const text = el.textContent || '';
  if (/https?:\/\//.test(text)) return 'entry-link';
  if (/[消息来源报道]/.test(text) && text.length < 60) return 'entry-source';
  if (text.length > 60) return 'entry-body';
  return 'entry-source';
}

/* ---- XML text replacement (preserves multi-run formatting) ---- */

// extract runs from a paragraph or hyperlink element
function getRuns(el) {
  const runs = [];
  // Direct <w:r> children
  for (const r of getChildrenNS(el, WML_NS, 'r')) {
    runs.push(r);
  }
  // Also check <w:hyperlink> children (links are like runs)
  for (const hl of getChildrenNS(el, WML_NS, 'hyperlink')) {
    for (const r of getChildrenNS(hl, WML_NS, 'r')) {
      runs.push(r);
    }
  }
  return runs;
}

function getRunText(run) {
  const tEls = getChildrenNS(run, WML_NS, 't');
  return tEls.map(t => t.textContent || '').join('');
}

function setRunText(run, text) {
  const tEls = getChildrenNS(run, WML_NS, 't');
  if (tEls.length > 0) {
    tEls[0].textContent = text;
    for (let i = 1; i < tEls.length; i++) {
      tEls[i].textContent = '';
    }
  }
}

// Check if text is a short prefix-like run (numbered label, link label, etc.)
const PREFIX_RE = /^【\d*】$|^【链接】[：:]?$|^链接[：:]?$|^\[[\d]+\]$|^\(\d+\)$|^第[一二三四五六七八九十\d]+[条章节]|^\d+[.、．]\s*$/;

function isPrefixRun(text, totalParaText) {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 15) return false;
  if (PREFIX_RE.test(t)) return true;
  // Heuristic: short run (< 15% of paragraph) containing numbering/delimiter
  if (totalParaText && totalParaText.length > 20 && t.length < totalParaText.length * 0.15) {
    if (/[\d【\[\(（第\*•·]/.test(t)) return true;
  }
  return false;
}

export function replaceTextInElement(el, replacements, numberRunIdx) {
  if (typeof replacements === 'string') {
    replaceForTemplate(el, replacements, numberRunIdx);
  } else {
    replaceForExport(el, replacements);
  }
}

// Extract the numbering pattern from prefix text, replacing digits with placeholder
function numberToPlaceholder(text) {
  return text.replace(
    /[\d]+|[一二三四五六七八九十百千万零]+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g,
    '{{ENTRY_NUMBER}}'
  );
}

function replaceForTemplate(el, placeholder, numberRunIdx) {
  const runs = getRuns(el);
  if (runs.length === 0) return;
  if (runs.length === 1) {
    setRunText(runs[0], placeholder);
    return;
  }

  const mainPH = placeholder;

  // Use AI-identified number run if available
  if (numberRunIdx !== undefined && numberRunIdx >= 0 && numberRunIdx < runs.length) {
    const prefixText = getRunText(runs[numberRunIdx]);
    setRunText(runs[numberRunIdx], numberToPlaceholder(prefixText));
    setRunText(runs[0] === runs[numberRunIdx] ? runs[1] : runs[0], mainPH);
    for (let i = 0; i < runs.length; i++) {
      if (i !== numberRunIdx && getRunText(runs[i]).includes(mainPH)) continue;
      if (i !== numberRunIdx) setRunText(runs[i], '');
    }
    // Ensure at least one content run has the placeholder
    let hasContent = false;
    for (const r of runs) {
      if (getRunText(r).includes(mainPH)) { hasContent = true; break; }
    }
    if (!hasContent) {
      for (let i = 0; i < runs.length; i++) {
        if (i !== numberRunIdx) { setRunText(runs[i], mainPH); break; }
      }
    }
    return;
  }

  // Fallback heuristic when AI didn't identify a number run
  const allText = runs.map(r => getRunText(r)).join('');
  let prefixRunIdx = -1;
  for (let i = 0; i < runs.length; i++) {
    const text = getRunText(runs[i]).trim();
    if (isPrefixRun(text, allText) && /[\d一二三四五六七八九十百千万零]+|[①②③④⑤⑥⑦⑧⑨⑩]/.test(text)) {
      prefixRunIdx = i;
      break;
    }
  }

  if (prefixRunIdx >= 0) {
    setRunText(runs[prefixRunIdx], numberToPlaceholder(getRunText(runs[prefixRunIdx])));
    let contentAssigned = false;
    for (let i = 0; i < runs.length; i++) {
      if (i === prefixRunIdx) continue;
      if (!contentAssigned) { setRunText(runs[i], mainPH); contentAssigned = true; }
      else setRunText(runs[i], '');
    }
  } else {
    setRunText(runs[0], mainPH);
    for (let i = 1; i < runs.length; i++) setRunText(runs[i], '');
  }
}

function replaceForExport(el, replacements) {
  const runs = getRuns(el);
  if (runs.length === 0) return;

  // For each run, replace whatever placeholder is in its text
  for (const run of runs) {
    const tEls = getChildrenNS(run, WML_NS, 't');
    if (tEls.length === 0) continue;

    let text = tEls.map(t => t.textContent || '').join('');
    let changed = false;

    for (const [placeholder, value] of Object.entries(replacements)) {
      if (text.includes(placeholder)) {
        text = text.split(placeholder).join(value);
        changed = true;
      }
    }

    if (changed) {
      tEls[0].textContent = text;
      for (let i = 1; i < tEls.length; i++) {
        tEls[i].textContent = '';
      }
    }
  }
}

/* ---- Element collection for index-based access ---- */

export function collectParaElements(body) {
  const elements = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== 1) continue;
      if (isP(child) || isHL(child)) {
        elements.push(child);
      } else if (isTbl(child)) {
        const rows = getChildrenNS(child, WML_NS, 'tr');
        for (const row of rows) {
          const cells = getChildrenNS(row, WML_NS, 'tc');
          for (const cell of cells) {
            walk(cell);
          }
        }
      }
    }
  };
  walk(body);
  return elements;
}

/* ---- Element type checks ---- */

function isP(node) { return node.localName === 'p' && node.namespaceURI === WML_NS; }
function isHL(node) { return node.localName === 'hyperlink' && node.namespaceURI === WML_NS; }
function isTbl(node) { return node.localName === 'tbl' && node.namespaceURI === WML_NS; }

/* ---- XML namespace helper ---- */

function getChildrenNS(parent, ns, localName) {
  if (!parent || !parent.getElementsByTagNameNS) return [];
  return [...parent.getElementsByTagNameNS(ns, localName)];
}

/* ---- Buffer / Base64 conversion ---- */

export function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
