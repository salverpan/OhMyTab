/* Shared extraction utilities used by both:
   - src/lib/extractor.js (SW-side, from fetched HTML)
   - src/content/global.js (content-script-side, from live DOM)

   All functions are pure (no side effects on the input doc except
   cloneNode'd copies) and work in both SW and content-script contexts. */

// AI 阅读不截断（2026-08 起）：上限只作极端页（无限滚动/虚拟列表）的失控防御，
// 500000 字符 ≈ 25 万汉字，正常长文/文档即等于不截断。
export const MAX_TEXT_LENGTH = 500000;

export const TEXT_BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, pre, li, td, th, dt, dd, figcaption, blockquote, ' +
  '[class*="text"], [class*="content"], [data-type="text"]';

export function openAllDetails(doc) {
  try {
    doc.querySelectorAll('details').forEach((d) => { d.open = true; });
  } catch (_) { /* noop */ }
}

export function getTitleFromDoc(doc) {
  return (
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent?.trim() ||
    ''
  );
}

/* ======== Date extraction ======== */

export const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

export function normalizePublishedDate(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s) return null;

  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) m = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${Number(m[1])}-${Number(m[2])}-${Number(m[3])}`;

  m = s.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`, 'i'));
  if (m) return `${Number(m[3])}-${MONTHS[m[1].toLowerCase().replace('.', '')]}-${Number(m[2])}`;

  m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\.?[,]?\\s+(\\d{4})\\b`, 'i'));
  if (m) return `${Number(m[3])}-${MONTHS[m[2].toLowerCase().replace('.', '')]}-${Number(m[1])}`;

  m = s.match(/(?:^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const now = new Date();
    return `${now.getFullYear()}-${Number(m[1])}-${Number(m[2])}`;
  }

  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s.length === 13 ? s : `${s}000`);
    const d = new Date(n);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      if (y >= 1995 && y <= 2035) return `${y}-${d.getMonth() + 1}-${d.getDate()}`;
    }
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y >= 1995 && y <= 2035) return `${y}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  return null;
}

export function elementHint(el) {
  return [
    el.tagName,
    el.id,
    el.className,
    el.getAttribute?.('itemprop'),
    el.getAttribute?.('property'),
    el.getAttribute?.('name'),
    el.getAttribute?.('data-testid'),
  ].filter(Boolean).join(' ').toLowerCase();
}

function looksLikeDateContainer(el, text) {
  const hint = elementHint(el);
  if (el.tagName === 'TIME') return true;
  if (/(date|time|timestamp|pub|publish|updated|modified|byline|info|source|meta|掲載|配信|公開|게재|발행|공개|veröffent|aktual|publié|modifié|publicado|actualizado|опубликов|обновлен)/i.test(hint)) return true;
  if (/(发布时间|发布日期|发布于|发表于|发布|来源|更新|编辑|作者|Published|Updated|Last updated|Posted|Veröffentlicht|Aktualisiert|Publié|Mis à jour|Publicado|Actualizado|Опубликовано|Обновлено|掲載日|配信日|公開日|更新日|게재일|발행일|공개일|수정일)/i.test(text)) return true;
  return false;
}

/* Event-date indicators: if the text contains these words, the date is
   likely an event date, NOT the article publication date.
   Covers Chinese + English + major international patterns. */
const EVENT_DATE_RE = new RegExp(
  '(' +
  /* Chinese */
  '举行|召开|举办|将于|定于|开幕式|闭幕式|演唱会|发布会|通报会|新闻发布|举行时间|召开时间' +
  /* English */
  '|held\\s+on|scheduled\\s+for|taking\\s+place|will\\s+be\\s+held|conference|summit|symposium|seminar|webinar|workshop|ceremony' +
  /* Japanese */
  '|開催|予定|実施' +
  /* Korean */
  '|개최|예정|열린' +
  ')',
  'i'
);

/* Check if an element is inside the main article body (where event dates
   appear). We skip body elements during date extraction. */
function isInArticleBody(el) {
  let parent = el.parentElement;
  for (let i = 0; i < 8 && parent; i++) {
    const tag = parent.tagName;
    if (tag === 'ARTICLE' || tag === 'MAIN') return true;
    if (parent.getAttribute('role') === 'main') return true;
    const cls = String(parent.className || '').toLowerCase();
    if (/article-content|post-content|entry-content|markdown-body|content-body|article-body|news-content|TRS_Editor/.test(cls)) return true;
    parent = parent.parentElement;
  }
  return false;
}

function getMetaContent(doc, selectors) {
  for (const selector of selectors) {
    const value = doc.querySelector(selector)?.getAttribute('content');
    const normalized = normalizePublishedDate(value);
    if (normalized) return normalized;
  }
  return null;
}

function collectJsonLdNodes(value, out = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdNodes(item, out));
    return out;
  }
  if (typeof value !== 'object') return out;
  out.push(value);
  if (value['@graph']) collectJsonLdNodes(value['@graph'], out);
  if (value.mainEntity) collectJsonLdNodes(value.mainEntity, out);
  if (value.itemListElement) collectJsonLdNodes(value.itemListElement, out);
  return out;
}

/* Meta tag names that indicate a publication date. Used to filter
   findDateInAttributes: only <meta> tags with these names (case-insensitive)
   are checked for date content. Prevents SiteIDCode/SiteName/etc. from
   being parsed as timestamps. */
const DATE_META_NAMES = new Set([
  'pubdate', 'publishdate', 'publish_date', 'pub_date', 'pubdate',
  'datepublished', 'date', 'dc.date.issued', 'dcterms.created',
  'articletime', 'publish_time', 'publishtime', 'releasedate',
  'websitesubtime', 'pubdate',
]);

function findDateInAttributes(doc) {
  const attrs = [
    'datetime', 'content', 'data-date', 'data-published',
    'data-publish-date', 'data-published-date', 'data-timestamp',
    'data-time', 'data-created', 'data-modified', 'data-updated',
  ];
  const selector = attrs.map((attr) => `[${attr}]`).join(',');
  for (const el of doc.querySelectorAll(selector)) {
    /* Skip elements inside article body -- their date attributes may
       refer to event dates, not publication dates. */
    if (el.tagName !== 'META' && isInArticleBody(el)) continue;
    /* For <meta> tags, only check those with date-related name attributes.
       This prevents SiteIDCode="4501000060" etc. from being parsed as
       Unix timestamps. */
    if (el.tagName === 'META') {
      const metaName = (el.getAttribute('name') || '').toLowerCase();
      const metaProperty = (el.getAttribute('property') || '').toLowerCase();
      const metaItemprop = (el.getAttribute('itemprop') || '').toLowerCase();
      const isDateRelated =
        DATE_META_NAMES.has(metaName) ||
        /date|publish|pub|time|created|modified|issued/.test(metaName) ||
        /published_time|publish_time|date/.test(metaProperty) ||
        /datepublished|datepublished/.test(metaItemprop);
      if (!isDateRelated) continue;
    }
    for (const attr of attrs) {
      const normalized = normalizePublishedDate(el.getAttribute(attr));
      if (normalized) return normalized;
    }
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length <= 220 && !EVENT_DATE_RE.test(text)) {
      const normalized = normalizePublishedDate(text);
      if (normalized) return normalized;
    }
  }
  return null;
}

function findDateInShortText(doc) {
  /* Phase 1: Elements with explicit date-related class/attribute hints.
     These are the most reliable metadata-area indicators. */
  const dateContainerSelectors = [
    'time[datetime]',
    '[itemprop="datePublished"]', '[property="datePublished"]',
    '[class*="date"]', '[class*="publish"]', '[class*="timestamp"]',
    '[class*="pub-time"]', '[class*="pubtime"]', '[class*="post-time"]',
    '[class*="article-time"]', '[class*="news-time"]', '[class*="info-time"]',
    '[id*="date"]', '[id*="publish"]', '[id*="pubtime"]',
  ];
  for (const sel of dateContainerSelectors) {
    for (const el of doc.querySelectorAll(sel)) {
      if (isInArticleBody(el)) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 260) continue;
      if (EVENT_DATE_RE.test(text)) continue;
      const normalized = normalizePublishedDate(text);
      if (normalized) return normalized;
    }
  }

  /* Phase 2: Scan span/li/header/time elements with date labels.
     Do NOT scan <p> or <div> -- they are body content tags where event
     dates appear (e.g. "于2026年3月3日举行新闻发布会"). */
  const labelRe = new RegExp(
    '(' +
    /* Chinese */
    '发布时间|发布日期|发布于|发表于|发布|来源|更新时间|更新|时间|日期|编辑|作者' +
    /* English */
    '|Published|Updated|Posted|Date|Last\\s+modified|Last\\s+updated|Filed|Written' +
    /* Japanese */
    '|掲載日|配信日|公開日|更新日|投稿日' +
    /* Korean */
    '|게재일|발행일|공개일|수정일|작성일' +
    /* German */
    '|Veröffentlicht|Aktualisiert|Geändert' +
    /* French */
    '|Publié|Mis\\s+à\\s+jour|Modifié' +
    /* Spanish */
    '|Publicado|Actualizado|Modificado' +
    /* Russian */
    '|Опубликовано|Обновлено|Изменено' +
    /* Arabic */
    '|نشر|تحديث' +
    ')',
    'i'
  );
  for (const el of doc.querySelectorAll('time, span, li, header')) {
    if (isInArticleBody(el)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 260) continue;
    if (EVENT_DATE_RE.test(text)) continue;
    if (!labelRe.test(text)) continue;
    const normalized = normalizePublishedDate(text);
    if (normalized) return normalized;
  }

  return null;
}

export function extractPublishedDateFromDoc(doc) {
  const fromMeta = getMetaContent(doc, [
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[itemprop="datePublished"]',
    'meta[name="datePublished" i]',
    'meta[name="pubdate" i]',
    'meta[name="publishdate" i]',
    'meta[name="publish_date" i]',
    'meta[name="pub_date" i]',
    'meta[name="PubDate" i]',
    'meta[name="PublishDate" i]',
    'meta[name="date" i]',
    'meta[name="DC.date.issued"]',
    'meta[name="dc.date.issued"]',
    'meta[name="dcterms.created"]',
    'meta[name="websitesubtime" i]',
  ]);
  if (fromMeta) return fromMeta;

  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = collectJsonLdNodes(JSON.parse(script.textContent || ''));
      for (const node of nodes) {
        const normalized = normalizePublishedDate(
          node.datePublished || node.dateCreated || node.uploadDate
        );
        if (normalized) return normalized;
      }
    } catch (_) {}
  }

  const fromAttrs = findDateInAttributes(doc);
  if (fromAttrs) return fromAttrs;

  const timeSelectors = [
    'time[datetime]',
    '[itemprop="datePublished"][datetime]',
    '[property="datePublished"][datetime]',
  ];
  for (const selector of timeSelectors) {
    const value = doc.querySelector(selector)?.getAttribute('datetime');
    const normalized = normalizePublishedDate(value);
    if (normalized) return normalized;
  }

  return findDateInShortText(doc);
}

/* ======== Scored-blocks extraction ======== */

export function extractByScoredBlocks(doc, publishedAt = null) {
  const clone = doc.cloneNode(true);
  openAllDetails(clone);
  clone.querySelectorAll([
    'script', 'style', 'nav', 'footer', 'header', 'aside', 'form', 'iframe', 'svg', 'noscript',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[class*="footer"]', '[class*="header"]', '[class*="menu"]', '[class*="nav"]',
    '[class*="comment"]', '[class*="related"]', '[class*="recommend"]', '[class*="partner"]',
    '[class*="advert"]', '[class*="ad-"]', '[class*="ads"]', '[class*="share"]', '[class*="social"]',
    '[class*="copyright"]', '[class*="contact"]', '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
    '[data-type="article"]', '[data-nosnippet="true"]'
  ].join(',')).forEach((el) => el.remove());

  const candidates = [...clone.querySelectorAll('article, main, [role="main"], section, div')];
  let best = null;

  for (const el of candidates) {
    const hint = elementHint(el);
    if (/(nav|menu|footer|header|comment|related|recommend|advert|share|social|copyright|contact|subscribe|breadcrumb|cookie|popup|modal)/i.test(hint)) continue;

    const textNodes = [...el.querySelectorAll(TEXT_BLOCK_SELECTOR)]
      .filter((node) => !node.querySelector(TEXT_BLOCK_SELECTOR))
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 20);
    if (textNodes.length === 0) continue;

    const unique = [...new Set(textNodes)];
    const text = unique.join('\n\n');
    const length = text.length;
    if (length < 80) continue;

    const linkTextLength = [...el.querySelectorAll('a')].reduce((sum, a) => sum + (a.textContent || '').trim().length, 0);
    const linkDensity = linkTextLength / Math.max(length, 1);
    const paragraphScore = Math.min(unique.length, 12) * 120;
    const punctuationScore = ((text.match(/[。！？.!?。]|[,，;；:：]/g) || []).length) * 8;
    const positiveHint = /(article|post|story|entry|content|body|text|main|news|detail|正文|内容)/i.test(hint) ? 500 : 0;
    const negativeText = /(copyright|©|all rights reserved|privacy policy|terms of use|contact|feedback|advertising|cookies|版权|联系我们|广告|隐私|用户协议|вакансии|редакци|реклама|обратной связи|роскомнадзор|новости партнеров|рекомендуем|поделиться|комментарии)/i.test(text) ? 1800 : 0;
    const sizePenalty = length > 15000 ? (length - 15000) * 0.5 : 0;
    const score = (Math.min(length, 15000) * 1.4) + paragraphScore + punctuationScore + positiveHint - (linkDensity * 1800) - negativeText - sizePenalty;

    if (!best || score > best.score) {
      best = { score, text };
    }
  }

  if (!best || best.score < 120) return null;
  return {
    title: getTitleFromDoc(doc) || doc.title || '',
    content: best.text.slice(0, MAX_TEXT_LENGTH),
    publishedAt,
  };
}
