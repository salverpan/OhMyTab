/**
 * In-page webpage-feed scanner, picker and extractor.
 *
 * The module is bundled into the content script. It only stores CSS selectors
 * in recipes; it never evaluates page-provided JavaScript.
 */

import {
  WEBFEED_FIELDS,
  WEBFEED_FIELD_LABELS,
  cleanWebFeedText,
  absoluteWebFeedUrl,
  parseWebFeedDate,
  normalizeWebFeedRecipe,
  normalizeWebFeedItem,
} from './webfeed-recipe.js';

export const WEBFEED_COLORS = ['#4e75df', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];
const CANDIDATE_MIN_ITEMS = 2;
const CANDIDATE_SCAN_NODES = 4500;
const CANDIDATE_LIMIT = 8;
const WEBFEED_STYLE_ID = 'citecat-webfeed-picker-style';
const WEBFEED_HOST_ID = 'citecat-webfeed-picker-host';

function docOf(doc) {
  return doc || (typeof document !== 'undefined' ? document : null);
}

function cssEscape(value) {
  const s = String(value == null ? '' : value);
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(s);
  return s.replace(/([^a-zA-Z0-9_ -￿-])/g, (m) => String.fromCharCode(92) + m).replace(/^(\d)/, (_, d) => String.fromCharCode(92) + '3' + d + ' ');
}

function textOf(el) {
  if (!el) return '';
  const raw = el.innerText != null ? el.innerText : el.textContent;
  return cleanWebFeedText(raw, 4000);
}

function attrOf(el, name) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  return el.getAttribute(name) || '';
}

function imageUrlOf(img, baseUrl) {
  if (!img) return '';
  const candidates = [
    img.currentSrc,
    attrOf(img, 'src'),
    attrOf(img, 'data-src'),
    attrOf(img, 'data-original'),
    attrOf(img, 'data-lazy-src'),
  ];
  const srcset = attrOf(img, 'srcset') || attrOf(img, 'data-srcset');
  if (srcset) candidates.push(srcset.split(',')[0].trim().split(/\s+/)[0]);
  for (const candidate of candidates) {
    const abs = absoluteWebFeedUrl(candidate, baseUrl);
    if (abs) return abs;
  }
  return '';
}

function isVisible(el, doc) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hidden) return false;
  if (attrOf(el, 'aria-hidden') === 'true') return false;
  const view = doc && doc.defaultView;
  const style = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(el) : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) return false;
  if (typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) return true;
    if (view && typeof view.innerWidth === 'number') return false;
  }
  return true;
}

function stableClasses(el) {
  if (!el || typeof el.getAttribute !== 'function') return [];
  const raw = attrOf(el, 'class').trim();
  if (!raw) return [];
  const stateLike = /^(active|selected|opened?|closed?|show|shown|hidden|visible|hover|focus|focused|disabled|enabled|dark|light|loading|loaded|first|last|odd|even|current|on|off)$/i;
  return raw.split(/\s+/)
    .filter((c) => c && c.length <= 50 && !stateLike.test(c))
    .filter((c) => !/^css-[a-z0-9]{5,}$/i.test(c))
    // Picker highlight classes are temporary UI state, never page structure.
    .filter((c) => !/^citecat-wf-/i.test(c))
    .slice(0, 3);
}

function safeMatches(el, selector) {
  try { return typeof el.matches === 'function' && el.matches(selector); } catch (_) { return false; }
}

function childIndexAmongType(el) {
  if (!el || !el.parentElement) return 1;
  const sameTag = Array.from(el.parentElement.children).filter((c) => c.tagName === el.tagName);
  return sameTag.indexOf(el) + 1;
}

function elementSelector(el, doc) {
  doc = docOf(doc);
  if (!el || el.nodeType !== 1 || !doc) return '';
  if (el === doc.body) return 'body';
  if (el === doc.documentElement) return 'html';
  const parts = [];
  let node = el;
  let depth = 0;
  while (node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement && depth < 30) {
    const tag = node.tagName.toLowerCase();
    const id = attrOf(node, 'id');
    if (id) {
      const idSel = '#' + cssEscape(id);
      try {
        if (doc.querySelectorAll(idSel).length === 1) {
          parts.unshift(idSel);
          break;
        }
      } catch (_) {}
    }
    let seg = tag;
    const classes = stableClasses(node);
    if (classes.length) seg += '.' + classes.map(cssEscape).join('.');
    const parent = node.parentElement;
    if (parent) {
      let siblingMatches = 0;
      for (const sibling of parent.children) {
        if (safeMatches(sibling, seg)) siblingMatches += 1;
      }
      if (siblingMatches > 1) seg += ':nth-of-type(' + childIndexAmongType(node) + ')';
    }
    parts.unshift(seg);
    node = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

function relativeSelector(itemEl, targetEl) {
  if (!itemEl || !targetEl) return '';
  if (itemEl === targetEl) return ':scope';
  if (!itemEl.contains(targetEl)) return '';
  const parts = [];
  let node = targetEl;
  let depth = 0;
  while (node && node !== itemEl && depth < 20) {
    const tag = node.tagName.toLowerCase();
    let seg = tag;
    const classes = stableClasses(node);
    if (classes.length) seg += '.' + classes.map(cssEscape).join('.');
    const parent = node.parentElement;
    if (parent) {
      let siblingMatches = 0;
      for (const sibling of parent.children) {
        if (safeMatches(sibling, seg)) siblingMatches += 1;
      }
      if (siblingMatches > 1) seg += ':nth-of-type(' + childIndexAmongType(node) + ')';
    }
    parts.unshift(seg);
    node = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

function queryFirst(root, selector) {
  if (!root || !selector) return null;
  if (selector === ':scope') return root;
  try { return root.querySelector(selector); } catch (_) { return null; }
}

function tryQueryAll(root, selector) {
  if (!root || !selector) return [];
  if (selector === ':scope') return [root];
  try { return Array.from(root.querySelectorAll(selector)); } catch (_) { return []; }
}

function nodeDepth(el, root) {
  let depth = 0;
  let node = el;
  while (node && node !== root) { depth += 1; node = node.parentElement; }
  return depth;
}

function classIntersection(elements) {
  if (!elements || elements.length === 0) return [];
  const lists = elements.map(stableClasses);
  if (lists.some((l) => l.length === 0)) return [];
  return lists[0].filter((c) => lists.every((l) => l.includes(c))).slice(0, 3);
}

function selectorForGroup(parent, elements, doc) {
  if (!parent || elements.length === 0) return { selector: '', count: 0 };
  const tag = elements[0].tagName.toLowerCase();
  const parentSel = elementSelector(parent, doc);
  const common = classIntersection(elements);
  const variants = [];
  if (common.length) {
    variants.push(parentSel + ' > ' + tag + '.' + common.map(cssEscape).join('.'));
    variants.push(parentSel + ' > ' + tag + '.' + cssEscape(common[0]));
  }
  variants.push(parentSel + ' > ' + tag);
  let best = null;
  for (const selector of variants) {
    let matches = [];
    try { matches = Array.from(doc.querySelectorAll(selector)); } catch (_) { continue; }
    if (matches.length < elements.length) continue;
    const precision = matches.length - elements.length;
    if (!best || precision < best.precision) best = { selector, count: matches.length, precision };
  }
  return best || { selector: '', count: 0 };
}

function candidateLabel(elements, index) {
  for (const el of elements) {
    const titleEl = el.querySelector && el.querySelector('h1, h2, h3, h4, h5, a[href], [class*="title" i]');
    const title = cleanWebFeedText(titleEl ? textOf(titleEl) : textOf(el), 80);
    if (title) return title;
  }
  return '候选列表 ' + (index + 1);
}

function isNoiseContainer(el) {
  if (!el) return true;
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  if (['nav', 'footer', 'aside', 'head', 'script', 'style', 'noscript', 'template'].includes(tag)) return true;
  const role = (attrOf(el, 'role') || '').toLowerCase();
  if (['navigation', 'banner', 'contentinfo', 'menu', 'menubar', 'toolbar'].includes(role)) return true;
  const cls = (attrOf(el, 'class') + ' ' + attrOf(el, 'id')).toLowerCase();
  return /(^|[\s_-])(cookie|consent|popup|modal|tooltip|toast|breadcrumb|pagination|advert|ads?|share|social|copyright|recommend)([\s_-]|$)/.test(cls);
}
/**
 * Auto-discover repeated item candidates. Returns public metadata only; DOM
 * element references stay inside the content script.
 */
export function scanWebFeedCandidates(doc = docOf(), opts = {}) {
  doc = docOf(doc);
  if (!doc || !doc.body) return [];
  const includeHidden = !!opts.includeHidden;
  const all = Array.from(doc.body.querySelectorAll('*')).slice(0, CANDIDATE_SCAN_NODES);
  const found = [];
  const seenSelectors = new Set();

  for (const parent of all) {
    if (isNoiseContainer(parent)) continue;
    const children = Array.from(parent.children || []);
    if (children.length < CANDIDATE_MIN_ITEMS) continue;
    const groupsBySignature = new Map();
    for (const child of children) {
      if (!includeHidden && !isVisible(child, doc)) continue;
      if (!textOf(child) && !(child.querySelector && child.querySelector('a[href], img'))) continue;
      const classes = stableClasses(child);
      const signature = child.tagName + '|' + (classes[0] || '');
      if (!groupsBySignature.has(signature)) groupsBySignature.set(signature, []);
      groupsBySignature.get(signature).push(child);
    }
    for (const group of groupsBySignature.values()) {
      if (group.length < CANDIDATE_MIN_ITEMS) continue;
      if (isNoiseContainer(group[0])) continue;
      const selectorInfo = selectorForGroup(parent, group, doc);
      if (!selectorInfo.selector || selectorInfo.count < CANDIDATE_MIN_ITEMS) continue;
      if (seenSelectors.has(selectorInfo.selector)) continue;

      const count = group.length;
      const avgText = group.reduce((sum, el) => sum + textOf(el).length, 0) / count;
      if (avgText < 3) continue;
      const withLink = group.filter((el) => el.querySelector && el.querySelector('a[href]')).length / count;
      const withHeading = group.filter((el) => el.querySelector && el.querySelector('h1,h2,h3,h4,h5')).length / count;
      const withImage = group.filter((el) => el.querySelector && el.querySelector('img')).length / count;
      let score = Math.min(count, 40) * 2;
      score += withLink * 32 + withHeading * 25 + withImage * 8;
      score += Math.min(avgText / 40, 22);
      if (parent.closest && parent.closest('nav,footer,aside,header')) score -= 90;
      if (avgText > 3500) score -= 30;
      if (count === 2) score -= 8;
      if (score < 25) continue;

      seenSelectors.add(selectorInfo.selector);
      found.push({
        id: 'wf-candidate-' + (found.length + 1),
        selector: selectorInfo.selector,
        actualCount: selectorInfo.count,
        count,
        elements: group,
        parent,
        score,
        tag: group[0].tagName.toLowerCase(),
        sampleTitle: candidateLabel(group, found.length),
        color: WEBFEED_COLORS[found.length % WEBFEED_COLORS.length],
      });
    }
  }

  found.sort((a, b) => b.score - a.score || b.count - a.count);
  const limited = [];
  for (const candidate of found) {
    const duplicateNesting = limited.some((other) => {
      const a = candidate.elements[0];
      const b = other.elements[0];
      return (a && b && (a.contains(b) || b.contains(a)));
    });
    if (!duplicateNesting) limited.push(candidate);
    if (limited.length >= CANDIDATE_LIMIT) break;
  }
  return limited;
}

function publicCandidates(candidates) {
  return candidates.map((c) => ({
    id: c.id,
    selector: c.selector,
    count: c.count,
    actualCount: c.actualCount,
    sampleTitle: c.sampleTitle,
    tag: c.tag,
    color: c.color,
    score: Math.round(c.score),
  }));
}

function findGroupForTarget(target, candidates, doc) {
  let best = null;
  let bestDepth = Infinity;
  for (const candidate of candidates) {
    for (const item of candidate.elements) {
      if (item === target || (item.contains && item.contains(target))) {
        const depth = nodeDepth(target, item);
        if (depth < bestDepth) { best = candidate; bestDepth = depth; }
      }
    }
  }
  if (best) return best;

  let node = target;
  if (node && node.closest) {
    node = node.closest('article, li, [role="article"], [role="listitem"], [class*="card" i], [class*="item" i], [class*="post" i], [class*="entry" i]') || node;
  }
  for (let level = 0; node && level < 7; level += 1) {
    const parent = node.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((child) => {
      if (child.tagName !== node.tagName) return false;
      if (!isVisible(child, doc)) return false;
      return textOf(child).length >= 2 || (child.querySelector && child.querySelector('a[href], img'));
    });
    if (siblings.length >= 2) {
      const selectorInfo = selectorForGroup(parent, siblings, doc);
      if (selectorInfo.selector && selectorInfo.count >= 2) {
        return {
          id: 'wf-manual',
          selector: selectorInfo.selector,
          actualCount: selectorInfo.count,
          count: siblings.length,
          elements: siblings,
          parent,
          score: 1,
          tag: siblings[0].tagName.toLowerCase(),
          sampleTitle: candidateLabel(siblings, 0),
          color: WEBFEED_COLORS[0],
        };
      }
    }
    node = parent;
  }
  return null;
}

function fieldPart(itemEl, key, targetEl, pageUrl) {
  if (!itemEl || !targetEl) return null;
  const rel = relativeSelector(itemEl, targetEl);
  if (!rel) return null;
  let attr = 'text';
  if (key === 'link') {
    attr = 'href';
    if (!attrOf(targetEl, 'href') && targetEl.querySelector) {
      const anchor = targetEl.querySelector('a[href]');
      if (anchor) return fieldPart(itemEl, key, anchor, pageUrl);
    }
  } else if (key === 'cover') {
    attr = 'image';
  } else if (key === 'date' && (targetEl.tagName === 'TIME' || attrOf(targetEl, 'datetime'))) {
    attr = 'datetime';
  }
  const part = { selector: rel, attr };
  part.sample = extractPartValue(itemEl, part, key, pageUrl);
  return part;
}

function extractPartValue(itemEl, part, key, pageUrl) {
  const target = queryFirst(itemEl, part.selector);
  if (!target) return '';
  let value = '';
  switch (part.attr) {
    case 'href':
      value = absoluteWebFeedUrl(attrOf(target, 'href'), pageUrl);
      break;
    case 'image':
      value = imageUrlOf(target, pageUrl);
      break;
    case 'datetime':
      value = attrOf(target, 'datetime') || attrOf(target, 'content') || textOf(target);
      break;
    case 'src':
      value = absoluteWebFeedUrl(attrOf(target, 'src'), pageUrl);
      break;
    case 'content':
    case 'title':
      value = attrOf(target, part.attr) || textOf(target);
      break;
    default:
      value = textOf(target);
  }
  return cleanWebFeedText(value, key === 'summary' ? 2000 : 1200);
}

function extractFieldValue(itemEl, def, key, pageUrl) {
  if (!def || !Array.isArray(def.parts)) return '';
  const values = def.parts
    .map((part) => extractPartValue(itemEl, part, key, pageUrl))
    .filter(Boolean);
  if (values.length === 0) return '';
  if (key === 'link' || key === 'cover') return values[0];
  return cleanWebFeedText(values.join(def.separator || ' '), key === 'summary' ? 2000 : 1000);
}

function chooseElement(itemEl, selectors, predicate) {
  if (!itemEl) return null;
  for (const selector of selectors) {
    const els = tryQueryAll(itemEl, selector);
    for (const el of els) {
      const text = textOf(el);
      if (!predicate || predicate(el, text)) return el;
    }
  }
  return null;
}
/** Detect likely field elements inside one selected item container. */
export function detectWebFeedFields(itemEl, pageUrl) {
  const fields = {};
  const samples = {};
  if (!itemEl) return { fields, samples };

  const titleEl = chooseElement(itemEl, [
    'h1', 'h2', 'h3', 'h4', 'h5',
    '[itemprop="name"]', '[class*="title" i]', '[class*="headline" i]',
  ], (_el, text) => text.length >= 2 && text.length <= 400)
    || chooseElement(itemEl, ['a[href]'], (_el, text) => text.length >= 2 && text.length <= 400);

  let linkEl = null;
  if (itemEl.tagName === 'A' && attrOf(itemEl, 'href')) linkEl = itemEl;
  if (!linkEl && titleEl && typeof titleEl.closest === 'function') linkEl = titleEl.closest('a[href]');
  if (!linkEl) {
    const anchors = tryQueryAll(itemEl, 'a[href]').filter((a) => absoluteWebFeedUrl(attrOf(a, 'href'), pageUrl));
    anchors.sort((a, b) => textOf(b).length - textOf(a).length);
    linkEl = anchors[0] || null;
  }

  const summaryEl = chooseElement(itemEl, [
    'p', '[class*="summary" i]', '[class*="excerpt" i]', '[class*="description" i]', '[class*="abstract" i]', '[class*="desc" i]',
  ], (_el, text) => text.length >= 12 && text.length <= 1400 && (!titleEl || !titleEl.contains(_el)));

  const dateEl = chooseElement(itemEl, [
    'time', '[itemprop="datePublished"]', '[datetime]', '[class*="date" i]', '[class*="time" i]', '[class*="published" i]', '[class*="updated" i]',
  ], (_el, text) => !!attrOf(_el, 'datetime') || !!text);

  const coverEl = chooseElement(itemEl, ['img'], (el) => !!imageUrlOf(el, pageUrl));
  const authorEl = chooseElement(itemEl, [
    '[rel="author"]', '[itemprop="author"]', '[class*="author" i]', '[class*="byline" i]', '[class*="writer" i]',
  ], (_el, text) => !!text);

  const add = (key, el) => {
    if (!el) return;
    const part = fieldPart(itemEl, key, el, pageUrl);
    if (!part) return;
    fields[key] = { parts: [part], separator: ' ' };
    samples[key] = part.sample || '';
  };
  add('title', titleEl);
  add('link', linkEl);
  add('summary', summaryEl);
  add('date', dateEl);
  add('cover', coverEl);
  add('author', authorEl);

  return { fields, samples };
}

function buildRecipeForSelector(selector, doc, pageUrl) {
  const matches = tryQueryAll(doc, selector).filter((el) => isVisible(el, doc));
  if (matches.length === 0) throw new Error('没有找到可识别的条目');
  const template = matches[0];
  const { fields, samples } = detectWebFeedFields(template, pageUrl);
  if (!fields.title && !fields.link) throw new Error('这一组条目里没有识别到标题或链接，请重新框选');
  const recipe = normalizeWebFeedRecipe({
    version: 1,
    pageUrl,
    itemSelector: selector,
    fields,
    createdAt: Date.now(),
  });
  const warnings = [];
  if (matches.length < 2) warnings.push('只识别到 1 条内容，请确认选择范围是否正确');
  if (!fields.title) warnings.push('未识别到标题字段，建议手动改选');
  if (!fields.link) warnings.push('未识别到链接字段，建议手动改选');
  if (!fields.date) warnings.push('未识别到日期，条目将按首次抓到时间排序');
  return { recipe, count: matches.length, samples, warnings };
}

/**
 * Extract items from the current rendered document using a saved recipe.
 * This is the same implementation used by preview and background refresh.
 */
export function extractWebFeedItems(recipeInput, doc = docOf(), opts = {}) {
  const started = Date.now();
  doc = docOf(doc);
  if (!doc) return { ok: false, error: '页面不可用', items: [], matched: 0, warnings: [] };
  let recipe;
  try {
    recipe = normalizeWebFeedRecipe(recipeInput);
  } catch (err) {
    return { ok: false, error: err.message, items: [], matched: 0, warnings: [] };
  }
  let matches;
  try {
    matches = Array.from(doc.querySelectorAll(recipe.itemSelector));
  } catch (_) {
    return { ok: false, error: '条目选择器在当前页面不可用', items: [], matched: 0, warnings: [] };
  }
  const visible = opts.includeHidden ? matches : matches.filter((el) => isVisible(el, doc));
  const maxItems = Math.max(1, Math.min(Number(opts.maxItems) || 200, 500));
  const pageUrl = recipe.pageUrl || (doc.baseURI || '');
  const items = [];
  const seen = new Set();
  let withoutLink = 0;
  let withoutDate = 0;

  for (const itemEl of visible.slice(0, Math.max(maxItems * 3, 300))) {
    if (items.length >= maxItems) break;
    const values = {};
    for (const key of WEBFEED_FIELDS) values[key] = extractFieldValue(itemEl, recipe.fields[key], key, pageUrl);
    let title = cleanWebFeedText(values.title, 500);
    const link = absoluteWebFeedUrl(values.link, pageUrl);
    if (!title && !link) continue;
    if (!title && link) {
      try { title = decodeURIComponent(new URL(link).pathname.split('/').filter(Boolean).pop() || link); } catch (_) { title = link; }
    }
    const publishedAt = parseWebFeedDate(values.date || '');
    const normalized = normalizeWebFeedItem({
      guid: link || title,
      link,
      title,
      summary: values.summary || '',
      author: values.author || '',
      coverUrl: values.cover || '',
      publishedAt,
    }, pageUrl);
    if (!normalized) continue;
    const dedupeKey = normalized.link || normalized.title;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (!normalized.link) withoutLink += 1;
    if (!normalized.publishedAt) withoutDate += 1;
    items.push(normalized);
  }

  const warnings = [];
  if (matches.length === 0) warnings.push('当前页面没有匹配到条目，网页结构可能已变化');
  else if (visible.length === 0) warnings.push('条目存在但当前不可见');
  if (items.length > 0 && withoutLink > items.length / 2) warnings.push('超过一半条目没有有效链接');
  if (items.length > 0 && withoutDate === items.length) warnings.push('所有条目都没有日期，将按首次抓到时间排序');
  if (items.length < visible.length && visible.length > 0) warnings.push(`已抓取 ${items.length} / ${visible.length} 条，部分条目缺少标题和链接`);

  return {
    ok: items.length > 0 || matches.length === 0,
    items,
    matched: matches.length,
    visible: visible.length,
    warnings,
    pageTitle: cleanWebFeedText(doc.title, 300),
    pageUrl,
    elapsedMs: Date.now() - started,
  };
}

/* ======================================================================
 * Visual picker (content script only)
 * ====================================================================== */

let pickerSession = null;

function pickerCss() {
  return `
    html.citecat-wf-active, html.citecat-wf-active * { cursor: crosshair !important; }
    .citecat-wf-candidate {
      outline: 2px dashed var(--citecat-wf-color, #4e75df) !important;
      outline-offset: -3px !important;
      transition: outline-color .12s ease, outline-width .12s ease, box-shadow .12s ease !important;
    }
    .citecat-wf-candidate.citecat-wf-hot {
      outline-width: 4px !important;
      box-shadow: inset 0 0 0 9999px rgba(78,117,223,.06) !important;
    }
    .citecat-wf-target-hot {
      outline: 3px solid #4e75df !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(78,117,223,.20) !important;
    }
    .citecat-wf-active-target {
      outline: 3px solid #f97316 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 6px rgba(249,115,22,.22) !important;
    }
    .citecat-wf-field-selected {
      outline: 2px dashed #10b981 !important;
      outline-offset: 2px !important;
    }
  `;
}

function pickerHostHtml(mode) {
  const isField = mode === 'field';
  const arrow = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return `
    <style>
      :host { all: initial; }
      .wf-toolbar {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; gap: 8px;
        width: min(560px, calc(100vw - 32px));
        padding: 8px 8px 8px 10px;
        border: 1px solid rgba(0,0,0,.08); border-radius: 16px;
        background: #fff; color: #18181b;
        box-shadow: 0 8px 28px rgba(16,24,40,.12);
        font: 12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
        pointer-events: auto; user-select: none;
      }
      .wf-top-row, .wf-nav-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .wf-nav-row { padding-top: 8px; border-top: 1px solid rgba(0,0,0,.06); }
      .wf-dot { width: 8px; height: 8px; border-radius: 50%; background: #4e75df; flex: 0 0 auto; }
      .wf-status {
        flex: 1; min-width: 0; font-size: 11px; color: #6b6b73;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .wf-status:empty, .wf-status[hidden] { display: none; }
      .wf-status.error { color: #dc2626; }
      button {
        appearance: none; border: 1px solid rgba(0,0,0,.08); border-radius: 9999px;
        background: #f4f4f5; color: #18181b; padding: 0 10px; height: 28px;
        font: inherit; cursor: pointer; white-space: nowrap;
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
      }
      button.primary { background: #4e75df; border-color: #4e75df; color: #fff; }
      button:hover:not(:disabled) { background: #e9e9ec; }
      button.primary:hover:not(:disabled) { background: #4267c4; }
      button:disabled { opacity: .35; cursor: not-allowed; }
      .wf-icon-btn { width: 28px; padding: 0; flex: 0 0 auto; }
      .wf-icon-btn svg { display: block; }
      .wf-crumbs {
        flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px;
        overflow-x: auto; white-space: nowrap; scrollbar-width: none;
      }
      .wf-crumbs::-webkit-scrollbar { display: none; }
      .wf-crumb {
        border: none; background: #f4f4f5; color: #52525b;
        height: 22px; padding: 0 8px; font-size: 11px;
      }
      .wf-crumb:hover:not(:disabled) { background: rgba(78,117,223,.12); color: #4e75df; }
      .wf-crumb.current { color: #4e75df; background: rgba(78,117,223,.08); }
      .wf-crumb-sep { color: #d4d4d8; font-size: 11px; flex: 0 0 auto; }
      .wf-empty-crumb { color: #a1a1aa; font-size: 11px; padding: 0 4px; }
      .wf-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
      .wf-badges { position: fixed; inset: 0; pointer-events: none; }
      .wf-badge {
        position: fixed; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center; border-radius: 9px;
        background: var(--citecat-wf-color, #4e75df); color: #fff; font: 700 10px/1 sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,.2); white-space: nowrap;
      }
    </style>
    <div class="wf-toolbar">
      <div class="wf-top-row">
        <span class="wf-dot"></span>
        <div id="wf-crumbs" class="wf-crumbs"><span class="wf-empty-crumb">${isField ? '点选字段' : '点选一条内容'}</span></div>
        <button id="wf-quick-toggle" class="primary" aria-pressed="true" title="单击即确认">即时</button>
        <button id="wf-cancel">取消</button>
      </div>
      <div class="wf-nav-row">
        <button id="wf-parent" class="wf-icon-btn" title="上一级" aria-label="上一级">${arrow('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>')}</button>
        <button id="wf-child" class="wf-icon-btn" title="下一级" aria-label="下一级">${arrow('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>')}</button>
        <button id="wf-prev" class="wf-icon-btn" title="上一项" aria-label="上一项">${arrow('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>')}</button>
        <button id="wf-next" class="wf-icon-btn" title="下一项" aria-label="下一项">${arrow('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>')}</button>
        <button id="wf-child-group" title="把子元素识别为列表"${isField ? ' style="display:none"' : ''}>子级</button>
        <button id="wf-sibling-group" title="把同级元素识别为列表"${isField ? ' style="display:none"' : ''}>同级</button>
        <span id="wf-text" class="wf-status" hidden></span>
        <span class="wf-actions">
          <button id="wf-undo" style="display:none">撤销</button>
          <button id="wf-done" style="display:none">完成</button>
          <button id="wf-confirm" class="primary" disabled>确认</button>
        </span>
      </div>
    </div>
    <div class="wf-badges" id="wf-badges"></div>
  `;
}

function emitPickerEvent(payload) {
  try {
    const promise = chrome.runtime.sendMessage({ type: 'WEBFEED_EVENT', data: payload });
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch (_) {}
}

function removePickerClasses(session) {
  if (!session) return;
  for (const el of session.markedEls) {
    el.classList.remove('citecat-wf-candidate', 'citecat-wf-hot', 'citecat-wf-target-hot', 'citecat-wf-active-target', 'citecat-wf-field-selected');
    el.style.removeProperty('--citecat-wf-color');
  }
  session.doc.documentElement?.classList.remove('citecat-wf-active');
}

function cleanupPicker() {
  const session = pickerSession;
  if (!session) return;
  pickerSession = null;
  removePickerClasses(session);
  try { session.doc.removeEventListener('mouseover', session.onMouseOver, true); } catch (_) {}
  try { session.doc.removeEventListener('click', session.onClick, true); } catch (_) {}
  try { session.doc.removeEventListener('keydown', session.onKeyDown, true); } catch (_) {}
  try { session.doc.removeEventListener('scroll', session.updateBadges, true); } catch (_) {}
  try { window.removeEventListener('resize', session.updateBadges, true); } catch (_) {}
  try { session.styleEl.remove(); } catch (_) {}
  try { session.host.remove(); } catch (_) {}
}

/** Stop the active picker without reporting a selection. */
export function stopWebFeedPicker() {
  cleanupPicker();
}

function addBadge(session, el, text, color) {
  if (!el) return null;
  const badge = session.doc.createElement('div');
  badge.className = 'wf-badge';
  badge.textContent = text;
  badge.style.setProperty('--citecat-wf-color', color || WEBFEED_COLORS[0]);
  session.badgeLayer.appendChild(badge);
  const update = () => {
    if (!el.isConnected) { badge.style.display = 'none'; return; }
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
    if (!rect || (!rect.width && !rect.height)) { badge.style.display = 'none'; return; }
    badge.style.display = 'flex';
    badge.style.left = Math.max(2, rect.left + 4) + 'px';
    badge.style.top = Math.max(2, rect.top + 4) + 'px';
  };
  session.badgeUpdaters.push(update);
  update();
  return badge;
}

function inferFieldMarker(target, candidates) {
  for (const c of candidates) {
    for (const item of c.elements) {
      if (item === target || (item.contains && item.contains(target))) return c;
    }
  }
  return null;
}

function setHover(session, group) {
  for (const el of session.hotEls) el.classList.remove('citecat-wf-hot', 'citecat-wf-target-hot');
  session.hotEls = [];
  if (!group) return;
  const useEls = group.elements || [group];
  for (const el of useEls) {
    if (group.elements) el.classList.add('citecat-wf-hot');
    else el.classList.add('citecat-wf-target-hot');
    session.hotEls.push(el);
  }
}

function fieldPartFromTarget(session, target) {
  if (!session || !session.lockedItem) return null;
  if (!(target === session.lockedItem || session.lockedItem.contains(target))) return null;
  return fieldPart(session.lockedItem, session.field, target, session.pageUrl);
}

function showPickerText(session, text, isError) {
  if (!session || !session.textEl) return;
  const value = String(text || '').trim();
  session.textEl.textContent = value;
  session.textEl.hidden = !value;
  session.textEl.classList.toggle('error', !!isError);
}

function publicFieldLabel(field) {
  return WEBFEED_FIELD_LABELS[field] || field || '';
}


function describeElement(el) {
  if (!el || el.nodeType !== 1) return '';
  const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
  const id = attrOf(el, 'id');
  const classes = stableClasses(el).slice(0, 2);
  let label = tag;
  if (id) label += '#' + id;
  if (classes.length) label += '.' + classes.join('.');
  const text = textOf(el);
  if (!el.children?.length && text && text.length <= 18) label += ' "' + text + '"';
  return label;
}

function crumbLabel(el) {
  if (!el || el.nodeType !== 1) return '';
  const id = attrOf(el, 'id');
  if (id) return '#' + id;
  const cls = stableClasses(el)[0];
  if (cls) return '.' + cls;
  return el.tagName ? el.tagName.toLowerCase() : 'node';
}

function visibleChildren(el, doc) {
  if (!el || !el.children) return [];
  return Array.from(el.children).filter((child) => child.nodeType === 1 && child !== pickerSession?.host && isVisible(child, doc));
}

function isSelectableTarget(session, el) {
  if (!session || !el || el.nodeType !== 1) return false;
  if (el === session.host || el === session.doc.documentElement) return false;
  if (session.mode === 'field') {
    return !!session.lockedItem && (el === session.lockedItem || session.lockedItem.contains(el));
  }
  return el !== session.doc.body && !!session.doc.body?.contains(el);
}

function parentTarget(session, el) {
  if (!el || !el.parentElement) return null;
  const parent = el.parentElement;
  if (session.mode === 'field') {
    if (el === session.lockedItem) return null;
    if (parent === session.lockedItem || session.lockedItem?.contains(parent)) return parent;
    return null;
  }
  if (parent === session.doc.body || parent === session.doc.documentElement) return null;
  return parent;
}

function childTarget(session, el) {
  if (!el) return null;
  const children = visibleChildren(el, session.doc);
  if (children.length === 0) return null;
  if (session.activeEl && session.activeEl.parentElement === el) {
    const idx = children.indexOf(session.activeEl);
    return children[(idx + 1) % children.length] || children[0];
  }
  return children[0];
}

function siblingTarget(session, el, direction) {
  if (!el || !el.parentElement) return null;
  const siblings = visibleChildren(el.parentElement, session.doc);
  const idx = siblings.indexOf(el);
  if (idx < 0) return null;
  const next = siblings[idx + direction];
  if (!next) return null;
  if (session.mode === 'field' && session.lockedItem && !session.lockedItem.contains(next)) return null;
  return next;
}


function sameTagVisibleChildren(el, doc) {
  const children = visibleChildren(el, doc);
  if (children.length === 0) return [];
  const tag = children[0].tagName;
  return children.filter((child) => child.tagName === tag);
}

function selectChildrenAsGroup(session) {
  if (!session || session.mode !== 'item' || !session.activeEl) {
    showPickerText(session, '先点选一个容器', true);
    return;
  }
  const children = sameTagVisibleChildren(session.activeEl, session.doc);
  if (children.length < 2) {
    showPickerText(session, '没有重复子元素', true);
    return;
  }
  const selectorInfo = selectorForGroup(session.activeEl, children, session.doc);
  if (!selectorInfo.selector) {
    showPickerText(session, '无法识别子级列表', true);
    return;
  }
  finishItemSelection(session, {
    selector: selectorInfo.selector,
    count: selectorInfo.count,
    elements: children,
    parent: session.activeEl,
    sampleTitle: candidateLabel(children, 0),
    color: WEBFEED_COLORS[0],
  });
}

function selectSiblingsAsGroup(session) {
  if (!session || session.mode !== 'item' || !session.activeEl) {
    showPickerText(session, '先点选一条内容', true);
    return;
  }
  const parent = session.activeEl.parentElement;
  if (!parent) {
    showPickerText(session, '没有同级', true);
    return;
  }
  const siblings = visibleChildren(parent, session.doc).filter((child) => child.tagName === session.activeEl.tagName);
  if (siblings.length < 2) {
    showPickerText(session, '没有同级', true);
    return;
  }
  const selectorInfo = selectorForGroup(parent, siblings, session.doc);
  if (!selectorInfo.selector) {
    showPickerText(session, '无法识别同级列表', true);
    return;
  }
  finishItemSelection(session, {
    selector: selectorInfo.selector,
    count: selectorInfo.count,
    elements: siblings,
    parent,
    sampleTitle: candidateLabel(siblings, 0),
    color: WEBFEED_COLORS[0],
  });
}


function renderBreadcrumb(session) {
  if (!session.crumbsEl) return;
  const doc = session.doc;
  session.crumbsEl.replaceChildren();
  const target = session.activeEl || session.hoveredEl;
  if (!target || target === doc.body || target === doc.documentElement) {
    const empty = doc.createElement('span');
    empty.className = 'wf-empty-crumb';
    empty.textContent = session.mode === 'field' ? '点选字段' : '点选一条内容';
    session.crumbsEl.appendChild(empty);
    session.crumbEls = [];
    return;
  }
  const nodes = [];
  let node = target;
  const stop = session.mode === 'field' && session.lockedItem && session.lockedItem.contains(target)
    ? session.lockedItem
    : doc.body;
  while (node && node.nodeType === 1 && node !== stop && node !== doc.documentElement && node !== doc.body) {
    nodes.unshift(node);
    node = node.parentElement;
  }
  if (stop && stop.nodeType === 1 && stop !== doc.body && stop !== doc.documentElement && !nodes.includes(stop)) {
    nodes.unshift(stop);
  }
  session.crumbEls = nodes;
  const maxVisible = 3;
  const start = Math.max(0, nodes.length - maxVisible);
  const addSep = () => {
    const sep = doc.createElement('span');
    sep.className = 'wf-crumb-sep';
    sep.textContent = '›';
    session.crumbsEl.appendChild(sep);
  };
  const addCrumb = (crumbEl, current) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'wf-crumb' + (current ? ' current' : '');
    btn.textContent = crumbEl === session.lockedItem && session.mode === 'field'
      ? '条目'
      : crumbLabel(crumbEl);
    btn.title = describeElement(crumbEl);
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setActiveElement(session, crumbEl);
    });
    session.crumbsEl.appendChild(btn);
  };
  if (start > 0) {
    const more = doc.createElement('button');
    more.type = 'button';
    more.className = 'wf-crumb';
    more.textContent = '…';
    more.title = crumbLabel(nodes[0]);
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      setActiveElement(session, nodes[0]);
    });
    session.crumbsEl.appendChild(more);
  }
  nodes.slice(start).forEach((crumbEl, index) => {
    if (index > 0 || start > 0) addSep();
    addCrumb(crumbEl, crumbEl === target);
  });
  try { session.crumbsEl.scrollLeft = session.crumbsEl.scrollWidth; } catch (_) {}
}

function updateHierarchyControls(session) {
  if (!session) return;
  const base = session.activeEl || session.hoveredEl || (session.mode === 'field' ? session.lockedItem : null);
  if (session.parentBtn) session.parentBtn.disabled = !parentTarget(session, base);
  if (session.childBtn) session.childBtn.disabled = !childTarget(session, base);
  if (session.prevBtn) session.prevBtn.disabled = !siblingTarget(session, base, -1);
  if (session.nextBtn) session.nextBtn.disabled = !siblingTarget(session, base, 1);
  if (session.childrenGroupBtn) {
    const count = session.mode === 'item' && session.activeEl ? sameTagVisibleChildren(session.activeEl, session.doc).length : 0;
    session.childrenGroupBtn.disabled = count < 2;
  }
  if (session.siblingsGroupBtn) {
    const parent = session.activeEl?.parentElement;
    const count = session.mode === 'item' && parent
      ? visibleChildren(parent, session.doc).filter((child) => child.tagName === session.activeEl.tagName).length
      : 0;
    session.siblingsGroupBtn.disabled = count < 2;
  }
  if (session.confirmBtn) {
    let canConfirm = !!session.activeEl;
    if (session.mode === 'field') canConfirm = !!(session.activeEl && fieldPartFromTarget(session, session.activeEl));
    session.confirmBtn.disabled = !canConfirm;
    session.confirmBtn.textContent = session.mode === 'item'
      ? '确认'
      : (session.multi ? '加入' : '确认');
  }
  if (session.undoBtn) session.undoBtn.style.display = session.selectedParts.length > 0 ? '' : 'none';
  if (session.doneBtn) session.doneBtn.style.display = session.selectedParts.length > 0 ? '' : 'none';
}


function setActiveElement(session, el, message) {
  if (!session || !isSelectableTarget(session, el)) {
    showPickerText(session, session.mode === 'field'
      ? `请点选「${publicFieldLabel(session.field)}」`
      : '请点选有效内容', true);
    return;
  }
  if (session.activeEl) session.activeEl.classList.remove('citecat-wf-active-target');
  session.activeEl = el;
  el.classList.add('citecat-wf-active-target');
  if (!session.markedEls.includes(el)) session.markedEls.push(el);
  session.activeGroup = session.mode === 'item' ? inferFieldMarker(el, session.candidates) : null;
  setHover(session, session.activeGroup || { elements: [el] });
  renderBreadcrumb(session);
  updateHierarchyControls(session);
  showPickerText(session, message || '');
}

function navigateHierarchy(session, direction) {
  const base = session.activeEl || session.hoveredEl || (session.mode === 'field' ? session.lockedItem : null);
  if (!base) {
    if (session.mode === 'item' && session.candidates.length > 0) {
      setActiveElement(session, session.candidates[0].elements[0]);
    } else {
      showPickerText(session, '先点选一个元素', true);
    }
    return;
  }
  let next = null;
  if (direction === 'parent') next = parentTarget(session, base);
  else if (direction === 'child') next = childTarget(session, base);
  else if (direction === 'prev') next = siblingTarget(session, base, -1);
  else if (direction === 'next') next = siblingTarget(session, base, 1);
  if (!next) {
    showPickerText(session, direction === 'parent' ? '已到顶层' : '没有下一项', true);
    return;
  }
  setActiveElement(session, next);
}

function addActivePartToMulti(session) {
  if (!session || !session.activeEl) {
    showPickerText(session, '先点选一个元素', true);
    return;
  }
  const part = fieldPartFromTarget(session, session.activeEl);
  if (!part) {
    showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
    return;
  }
  if (session.selectedParts.some((p) => p.selector === part.selector && p.attr === part.attr)) {
    showPickerText(session, '已选过');
    return;
  }
  session.selectedParts.push(part);
  session.activeEl.classList.add('citecat-wf-field-selected');
  updateHierarchyControls(session);
  showPickerText(session, `已选 ${session.selectedParts.length} 项`);
}

function updateQuickModeUi(session) {
  if (!session) return;
  if (!session.quickToggleBtn) return;
  session.quickToggleBtn.textContent = session.quickMode ? '即时' : '微调';
  session.quickToggleBtn.classList.toggle('primary', !!session.quickMode);
  session.quickToggleBtn.setAttribute('aria-pressed', session.quickMode ? 'true' : 'false');
  session.quickToggleBtn.title = session.quickMode ? '单击即确认' : '先选中再微调层级';
}

function toggleActivePartInMulti(session) {
  if (!session || !session.activeEl) return;
  const part = fieldPartFromTarget(session, session.activeEl);
  if (!part) {
    showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
    return;
  }
  const index = session.selectedParts.findIndex((p) => p.selector === part.selector && p.attr === part.attr);
  if (index >= 0) {
    session.selectedParts.splice(index, 1);
    session.activeEl.classList.remove('citecat-wf-field-selected');
    updateHierarchyControls(session);
    showPickerText(session, '已移除');
  } else {
    session.selectedParts.push(part);
    session.activeEl.classList.add('citecat-wf-field-selected');
    updateHierarchyControls(session);
    showPickerText(session, `已加入 · ${session.selectedParts.length} 项`);
  }
}

function applyQuickSelection(session) {
  if (!session) return;
  if (session.mode === 'field') {
    if (session.multi) {
      toggleActivePartInMulti(session);
      return;
    }
    const part = fieldPartFromTarget(session, session.activeEl);
    if (!part) {
      showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
      return;
    }
    finalizeField(session, [part]);
    return;
  }
  const children = sameTagVisibleChildren(session.activeEl, session.doc);
  if (children.length >= 2) {
    showPickerText(session, `${children.length} 个子项，可点「子级」`);
    updateHierarchyControls(session);
    return;
  }
  confirmActiveSelection(session);
}


function confirmActiveSelection(session) {
  if (!session) return;
  if (session.mode === 'field') {
    if (!session.activeEl) {
      showPickerText(session, '先点选一个元素', true);
      return;
    }
    if (session.multi) {
      addActivePartToMulti(session);
      return;
    }
    const part = fieldPartFromTarget(session, session.activeEl);
    if (!part) {
      showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
      return;
    }
    finalizeField(session, [part]);
    return;
  }
  if (!session.activeEl) {
    showPickerText(session, '先点选一条内容', true);
    return;
  }
  const group = inferFieldMarker(session.activeEl, session.candidates)
    || findGroupForTarget(session.activeEl, session.candidates, session.doc);
  if (!group) {
    showPickerText(session, '未识别到列表，试试上一级', true);
    return;
  }
  finishItemSelection(session, group);
}


function finishItemSelection(session, group) {
  let built;
  try {
    built = buildRecipeForSelector(group.selector, session.doc, session.pageUrl);
  } catch (err) {
    showPickerText(session, err.message || '选择失败', true);
    return;
  }
  showPickerText(session, `已识别 ${built.count} 条`);
  for (const el of session.markedEls) el.classList.remove('citecat-wf-candidate', 'citecat-wf-hot');
  session.badgeLayer.replaceChildren();
  session.badgeUpdaters = [];
  group.elements.slice(0, 50).forEach((el, i) => {
    el.classList.add('citecat-wf-candidate');
    el.style.setProperty('--citecat-wf-color', '#10b981');
    session.markedEls.push(el);
    addBadge(session, el, String(i + 1), '#10b981');
  });
  session.updateBadges();
  setTimeout(() => {
    cleanupPicker();
    emitPickerEvent({
      event: 'item-selected',
      ...built,
      pageTitle: cleanWebFeedText(session.doc.title, 300),
      pageUrl: session.pageUrl,
    });
  }, 420);
}

function createPickerSession(mode, opts) {
  cleanupPicker();
  const doc = docOf();
  if (!doc || !doc.body) throw new Error('当前页面不可用');
  const host = doc.createElement('div');
  host.id = WEBFEED_HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  shadow.innerHTML = pickerHostHtml(mode);
  (doc.body || doc.documentElement).appendChild(host);

  let styleEl = doc.getElementById(WEBFEED_STYLE_ID);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = WEBFEED_STYLE_ID;
    styleEl.textContent = pickerCss();
    (doc.head || doc.documentElement).appendChild(styleEl);
  }
  doc.documentElement?.classList.add('citecat-wf-active');

  const session = {
    doc,
    mode,
    field: opts.field || '',
    multi: !!opts.multi,
    quickMode: true,
    pageUrl: opts.pageUrl || doc.location?.href || doc.baseURI || '',
    recipe: opts.recipe || null,
    lockedItem: null,
    candidates: [],
    activeEl: null,
    activeGroup: null,
    hoveredEl: null,
    crumbEls: [],
    markedEls: [],
    hotEls: [],
    selectedParts: [],
    badgeUpdaters: [],
    host,
    shadow,
    styleEl,
    textEl: shadow.querySelector('#wf-text'),
    badgeLayer: shadow.querySelector('#wf-badges'),
    crumbsEl: shadow.querySelector('#wf-crumbs'),
    undoBtn: shadow.querySelector('#wf-undo'),
    doneBtn: shadow.querySelector('#wf-done'),
    confirmBtn: shadow.querySelector('#wf-confirm'),
    quickToggleBtn: shadow.querySelector('#wf-quick-toggle'),
    parentBtn: shadow.querySelector('#wf-parent'),
    childBtn: shadow.querySelector('#wf-child'),
    prevBtn: shadow.querySelector('#wf-prev'),
    nextBtn: shadow.querySelector('#wf-next'),
    childrenGroupBtn: shadow.querySelector('#wf-child-group'),
    siblingsGroupBtn: shadow.querySelector('#wf-sibling-group'),
  };
  if (session.confirmBtn) {
    session.confirmBtn.textContent = mode === 'item' ? '确认' : (opts.multi ? '加入' : '确认');
  }
  session.updateBadges = () => {
    for (const fn of session.badgeUpdaters) fn();
  };
  return session;
}

function bindPickerEvents(session) {
  const doc = session.doc;
  const onMouseOver = (event) => {
    if (pickerSession !== session) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.includes(session.host)) return;
    const target = event.target;
    if (!target || target.nodeType !== 1) return;
    session.hoveredEl = target;
    if (session.mode === 'field') {
      if (session.lockedItem && (target === session.lockedItem || session.lockedItem.contains(target))) {
        setHover(session, { elements: [target] });
        showPickerText(session, '');
      } else {
        showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
      }
      renderBreadcrumb(session);
      updateHierarchyControls(session);
      return;
    }
    const group = inferFieldMarker(target, session.candidates);
    setHover(session, group || { elements: [target] });
    showPickerText(session, group && group.count ? `${group.count} 条` : '');
    renderBreadcrumb(session);
    updateHierarchyControls(session);
  };

  const onClick = (event) => {
    if (pickerSession !== session) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.includes(session.host) || event.target === session.host) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (!target || target.nodeType !== 1) return;
    if (session.mode === 'field' && !(target === session.lockedItem || session.lockedItem?.contains(target))) {
      showPickerText(session, `请点选「${publicFieldLabel(session.field)}」`, true);
      return;
    }
    setActiveElement(session, target);
    if (event.altKey) {
      // Alt+click stages an exact element for hierarchy inspection instead of
      // immediately applying it.
      if (session.quickMode) {
        session.quickMode = false;
        updateQuickModeUi(session);
      }
      showPickerText(session, '');
      return;
    }
    if (session.quickMode) {
      // A real double-click would otherwise toggle a multi-select item twice.
      if (Number(event.detail) >= 2) return;
      applyQuickSelection(session);
      return;
    }
    if (Number(event.detail) >= 2) confirmActiveSelection(session);
  };

  const onKeyDown = (event) => {
    if (pickerSession !== session) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelPicker(session);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      navigateHierarchy(session, event.key === 'ArrowUp' ? 'parent'
        : event.key === 'ArrowDown' ? 'child'
          : event.key === 'ArrowLeft' ? 'prev' : 'next');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      confirmActiveSelection(session);
    }
  };

  session.onMouseOver = onMouseOver;
  session.onClick = onClick;
  session.onKeyDown = onKeyDown;
  doc.addEventListener('mouseover', onMouseOver, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('scroll', session.updateBadges, true);
  if (typeof window !== 'undefined') window.addEventListener('resize', session.updateBadges, true);

  session.shadow.querySelector('#wf-cancel')?.addEventListener('click', () => cancelPicker(session));
  session.quickToggleBtn?.addEventListener('click', () => {
    session.quickMode = !session.quickMode;
    updateQuickModeUi(session);
    showPickerText(session, '');
  });
  session.parentBtn?.addEventListener('click', () => navigateHierarchy(session, 'parent'));
  session.childBtn?.addEventListener('click', () => navigateHierarchy(session, 'child'));
  session.prevBtn?.addEventListener('click', () => navigateHierarchy(session, 'prev'));
  session.nextBtn?.addEventListener('click', () => navigateHierarchy(session, 'next'));
  session.childrenGroupBtn?.addEventListener('click', () => selectChildrenAsGroup(session));
  session.siblingsGroupBtn?.addEventListener('click', () => selectSiblingsAsGroup(session));
  session.confirmBtn?.addEventListener('click', () => confirmActiveSelection(session));
  session.undoBtn?.addEventListener('click', () => {
    const part = session.selectedParts.pop();
    if (part) {
      const target = queryFirst(session.lockedItem, part.selector);
      if (target) target.classList.remove('citecat-wf-field-selected');
    }
    updateHierarchyControls(session);
    showPickerText(session, `已选 ${session.selectedParts.length} 项`);
  });
  session.doneBtn?.addEventListener('click', () => {
    if (session.selectedParts.length > 0) finalizeField(session, session.selectedParts);
  });

  updateQuickModeUi(session);
  renderBreadcrumb(session);
  updateHierarchyControls(session);
}

function finalizeField(session, parts) {
  const payload = {
    event: 'field-selected',
    field: session.field,
    multi: !!session.multi,
    parts: parts || [],
    cancelled: false,
  };
  cleanupPicker();
  emitPickerEvent(payload);
}

function cancelPicker(session) {
  if (!session) return;
  const payload = session.mode === 'field'
    ? { event: 'field-selected', field: session.field, multi: !!session.multi, parts: [], cancelled: true }
    : { event: 'cancelled' };
  cleanupPicker();
  emitPickerEvent(payload);
}

function markCandidates(session, candidates) {
  for (const candidate of candidates) {
    for (const el of candidate.elements.slice(0, 80)) {
      el.classList.add('citecat-wf-candidate');
      el.style.setProperty('--citecat-wf-color', candidate.color);
      session.markedEls.push(el);
    }
    if (candidate.elements[0]) addBadge(session, candidate.elements[0], candidate.count + ' 条', candidate.color);
  }
  session.updateBadges();
}

function markLockedItems(session, elements) {
  for (const el of elements.slice(0, 80)) {
    if (!isVisible(el, session.doc)) continue;
    el.classList.add('citecat-wf-candidate');
    el.style.setProperty('--citecat-wf-color', '#4e75df');
    session.markedEls.push(el);
  }
  session.updateBadges();
}

/**
 * Start selecting an item template from the current rendered page. Returns
 * immediately with auto-detected candidates; the user's click is delivered
 * later through chrome.runtime message WEBFEED_EVENT.
 */
export function startWebFeedPicker(doc = docOf()) {
  doc = docOf(doc);
  const pageUrl = doc?.location?.href || doc?.baseURI || '';
  const candidates = scanWebFeedCandidates(doc);
  const session = createPickerSession('item', { pageUrl });
  session.candidates = candidates;
  pickerSession = session;
  bindPickerEvents(session);
  markCandidates(session, candidates);
  showPickerText(session, candidates.length ? `${candidates.length} 组候选` : '');
  updateQuickModeUi(session);
  return { ok: true, candidates: publicCandidates(candidates), pageTitle: cleanWebFeedText(doc?.title, 300), pageUrl };
}

/** Select one of the auto-discovered groups (used by the side-panel list). */
export function selectWebFeedCandidate(candidateId) {
  const session = pickerSession;
  if (!session || session.mode !== 'item') return { ok: false, error: '选择器已结束，请重新开始' };
  const candidate = session.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: '候选已失效，请重新识别' };
  finishItemSelection(session, candidate);
  return { ok: true };
}

/** Start field mapping for an existing recipe. */
export function startWebFeedFieldPicker(opts = {}) {
  const doc = docOf();
  if (!doc) return { ok: false, error: '页面不可用' };
  const field = opts.field;
  if (!WEBFEED_FIELDS.includes(field)) return { ok: false, error: '未知字段' };
  let recipe;
  try { recipe = normalizeWebFeedRecipe(opts.recipe); } catch (err) { return { ok: false, error: err.message }; }
  const items = tryQueryAll(doc, recipe.itemSelector).filter((el) => isVisible(el, doc));
  if (items.length === 0) return { ok: false, error: '当前页面已找不到条目，请重新框选条目模板' };
  const session = createPickerSession('field', {
    field,
    multi: !!opts.multi,
    recipe,
    pageUrl: recipe.pageUrl,
  });
  session.lockedItem = items[0];
  pickerSession = session;
  bindPickerEvents(session);
  markLockedItems(session, items.slice(0, 20));
  setActiveElement(session, items[0], opts.multi
    ? `已高亮条目模板。直接点击多个「${publicFieldLabel(field)}」元素即可合并`
    : `已高亮条目模板。直接点击「${publicFieldLabel(field)}」元素完成选择`);
  updateQuickModeUi(session);
  return { ok: true, matched: items.length, field };
}
