/**
 * Web-page to feed recipe: pure helpers shared by the side panel, service
 * worker and content script. No DOM access in this module — selectors are
 * evaluated by webfeed.js inside the target page.
 */

export const WEBFEED_RECIPE_VERSION = 1;
export const WEBFEED_FIELDS = ['title', 'link', 'summary', 'date', 'cover', 'author'];
export const WEBFEED_REFRESH_MODES = ['auto', 'http', 'tab'];
export const WEBFEED_FIELD_LABELS = {
  title: '标题',
  link: '链接',
  summary: '摘要',
  date: '日期',
  cover: '封面',
  author: '作者',
};

const ALLOWED_ATTRS = new Set(['text', 'href', 'image', 'datetime', 'src', 'content', 'title']);
const MAX_SELECTOR_LEN = 1200;
const MAX_PARTS = 12;

export function normalizeWebpageRefreshMode(value) {
  return WEBFEED_REFRESH_MODES.includes(value) ? value : 'auto';
}

export function cleanWebFeedText(value, max = 2000) {
  if (value == null) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max);
}

function badSelectorReason(selector) {
  if (!selector) return '为空';
  if (selector.length > MAX_SELECTOR_LEN) return '过长';
  if (/[\u0000-\u001f\u007f]/.test(selector)) return '包含控制字符';
  if (/[{};]/.test(selector)) return '包含不支持的字符';
  if (/javascript\s*:|expression\s*\(/i.test(selector)) return '包含不安全语法';
  return '';
}

export function isSafeWebFeedSelector(selector) {
  return !badSelectorReason(cleanWebFeedText(selector, MAX_SELECTOR_LEN + 1));
}

export function absoluteWebFeedUrl(value, baseUrl) {
  const raw = cleanWebFeedText(value, 4096);
  if (!raw) return '';
  try {
    const url = new URL(raw, baseUrl || undefined);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

/**
 * Parse common feed dates. Relative dates are resolved against `now`, which
 * keeps a date-less webpage feed usable without inventing a fake calendar date
 * when the page truly has no timestamp.
 */
export function parseWebFeedDate(value, now = Date.now()) {
  const raw = cleanWebFeedText(value, 200);
  if (!raw) return 0;

  if (/^\d{13}$/.test(raw)) {
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  }
  if (/^\d{10}$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  }

  const normalized = raw
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();

  const relative = raw.match(/^(\d+)\s*(秒|分钟|小时|天|周)前$/);
  if (relative) {
    const n = Number(relative[1]);
    const unitMs = { 秒: 1000, 分钟: 60000, 小时: 3600000, 天: 86400000, 周: 604800000 }[relative[2]];
    if (Number.isFinite(n) && unitMs) return now - n * unitMs;
  }
  if (/^刚刚$/.test(raw)) return now;
  if (/^昨天(?:\s|$)/.test(raw)) return now - 86400000;
  if (/^前天(?:\s|$)/.test(raw)) return now - 2 * 86400000;

  const todayTime = raw.match(/^今天\s*(\d{1,2}):(\d{2})/);
  if (todayTime) {
    const d = new Date(now);
    d.setHours(Number(todayTime[1]), Number(todayTime[2]), 0, 0);
    return d.getTime();
  }

  // MM-DD / M月D日 without a year: assume current year. If that lands in the
  // future, use the previous year (common for year-round archive pages).
  const md = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  if (md) {
    const d = new Date(now);
    d.setMonth(Number(md[1]) - 1, Number(md[2]));
    d.setHours(0, 0, 0, 0);
    if (d.getTime() > now + 86400000) d.setFullYear(d.getFullYear() - 1);
    return d.getTime();
  }

  return 0;
}

export function normalizeWebFeedPart(part) {
  if (!part || typeof part !== 'object') return null;
  const selector = cleanWebFeedText(part.selector, MAX_SELECTOR_LEN + 1);
  if (badSelectorReason(selector)) return null;
  const attr = ALLOWED_ATTRS.has(part.attr) ? part.attr : 'text';
  return { selector, attr };
}

/**
 * Persistable recipe shape. It intentionally contains only CSS selectors and
 * extraction metadata — never JavaScript or page-provided code.
 */
export function normalizeWebFeedRecipe(input) {
  if (!input || typeof input !== 'object') throw new Error('抓取规则为空');
  const pageUrl = absoluteWebFeedUrl(input.pageUrl, input.pageUrl);
  if (!pageUrl) throw new Error('网页源 URL 无效（仅支持 http/https）');

  const itemSelector = cleanWebFeedText(input.itemSelector, MAX_SELECTOR_LEN + 1);
  const itemReason = badSelectorReason(itemSelector);
  if (itemReason) throw new Error('条目选择器无效：' + itemReason);

  const fields = {};
  const rawFields = input.fields && typeof input.fields === 'object' ? input.fields : {};
  for (const key of WEBFEED_FIELDS) {
    const def = rawFields[key];
    if (!def || typeof def !== 'object') continue;
    const rawParts = Array.isArray(def.parts)
      ? def.parts
      : (Array.isArray(def) ? def : []);
    const parts = rawParts
      .slice(0, MAX_PARTS)
      .map(normalizeWebFeedPart)
      .filter(Boolean);
    if (parts.length === 0) continue;
    const separator = def.separator == null || def.separator === ''
      ? ' '
      : String(def.separator).slice(0, 20);
    fields[key] = { parts, separator };
  }

  return {
    version: WEBFEED_RECIPE_VERSION,
    pageUrl,
    itemSelector,
    fields,
    createdAt: Number.isFinite(Number(input.createdAt)) && Number(input.createdAt) > 0
      ? Number(input.createdAt)
      : Date.now(),
  };
}

/** Sanitize one extracted item before it reaches IndexedDB. */
export function normalizeWebFeedItem(input, baseUrl = '') {
  if (!input || typeof input !== 'object') return null;
  const title = cleanWebFeedText(input.title, 500);
  const link = absoluteWebFeedUrl(input.link, baseUrl);
  if (!title && !link) return null;
  const summary = cleanWebFeedText(input.summary, 2000);
  const author = cleanWebFeedText(input.author, 200);
  const publishedAt = Number.isFinite(Number(input.publishedAt)) && Number(input.publishedAt) > 0
    ? Number(input.publishedAt)
    : 0;
  const guid = cleanWebFeedText(input.guid || link || title, 1200);
  if (!guid && !link) return null;
  const coverUrl = absoluteWebFeedUrl(input.coverUrl, baseUrl);
  return {
    guid,
    link,
    title,
    author,
    summary,
    coverUrl,
    contentHtml: '',
    publishedAt,
    // With no page timestamp, keep the first-seen fallback time stable instead
    // of moving every existing item to "now" on every refresh.
    preservePublishedAt: !publishedAt,
  };
}

export function normalizeWebFeedItems(items, baseUrl = '', max = 500) {
  if (!Array.isArray(items)) return [];
  const out = [];
  const seen = new Set();
  for (const item of items.slice(0, max)) {
    const normalized = normalizeWebFeedItem(item, baseUrl);
    if (!normalized) continue;
    const key = normalized.link || normalized.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}
