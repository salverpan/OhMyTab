/**
 * Fetch a feed URL, parse it, and merge new items into IndexedDB.
 *
 * Responsibilities:
 *   - HTTP GET with conditional headers (If-None-Match / If-Modified-Since)
 *   - Handle 304 Not Modified gracefully (no parse, no upsert)
 *   - Parse XML via feed-parser
 *   - Hash each item to a stable id (sha1 of feedId + guid/link)
 *   - Bulk upsert into IDB
 *   - Update feed metadata (lastFetchedAt, etag, lastModified, lastError, counts)
 *   - Auto-discover feed URL from a site page if user pasted a homepage URL
 */

import { parseFeed } from './feed-parser.js';
import {
  addFeed as dbAddFeed,
  updateFeed,
  getFeed,
  upsertItems,
  makeItemId,
  countFeedItems,
} from './feed-db.js';
import { isRsshubUrl, buildRsshubFallbacks } from './rsshub-fallback.js';
import { normalizeWebFeedRecipe, normalizeWebFeedItems, normalizeWebpageRefreshMode } from './webfeed-recipe.js';
import { extractWebpageItemsViaTab } from './webfeed-tab.js';
import { extractWebpageItemsViaHttp } from './webfeed-http.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 20000;
const MAX_CONCURRENT = 6;

/**
 * Provides global default filtering values (maxItems, fetchFrom, fetchTo, autoTranslate).
 * Injected by SW from chrome.storage feedPrefs.
 */
let _getDefaults = async () => ({ defaultMaxItems: 0, defaultFetchFrom: null, defaultFetchTo: null, defaultAutoTranslate: false, defaultTargetLanguage: 'zh-Hans' });
export function setDefaultsProvider(fn) {
  if (typeof fn === 'function') _getDefaults = fn;
}

/** Merge feed-level config with globals; feed-level wins when set. */
async function effectiveFilters(feed) {
  const d = await _getDefaults();
  return {
    maxItems: (feed.maxItems != null && feed.maxItems !== '') ? feed.maxItems : (d.defaultMaxItems || 0),
    fetchFrom: feed.fetchFrom || d.defaultFetchFrom || null,
    fetchTo: feed.fetchTo || d.defaultFetchTo || null,
    autoTranslate: feed.autoTranslate != null ? feed.autoTranslate : !!d.defaultAutoTranslate,
    targetLanguage: feed.targetLanguage || d.defaultTargetLanguage || 'zh-Hans',
  };
}

/* ---------- HTTP ---------- */

async function httpGet(url, conditionalHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
    };
    if (conditionalHeaders.etag) headers['If-None-Match'] = conditionalHeaders.etag;
    if (conditionalHeaders.lastModified) headers['If-Modified-Since'] = conditionalHeaders.lastModified;

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });

    return {
      status: response.status,
      etag: response.headers.get('etag') || '',
      lastModified: response.headers.get('last-modified') || '',
      contentType: response.headers.get('content-type') || '',
      body: response.status === 304 ? '' : await response.text(),
      finalUrl: response.url,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Feed URL discovery ---------- */

/**
 * Heuristic: does this response look like a usable feed XML payload?
 * Returns null if it does, or a short reason string if it doesn't.
 * Used to decide whether to fall back to another RSSHub instance.
 */
function reasonNotFeed(resp) {
  if (!resp) return 'no-response';
  if (resp.status >= 400) return `http-${resp.status}`;
  if (!resp.body) return 'empty-body';
  const body = resp.body.trimStart();
  const ct = (resp.contentType || '').toLowerCase();
  const looksXml =
    ct.includes('xml') ||
    /^<\?xml/i.test(body) ||
    /^<rss[\s>]/i.test(body) ||
    /^<feed[\s>]/i.test(body) ||
    /^<rdf:rdf[\s>]/i.test(body);
  if (looksXml) return null;
  const lower = body.toLowerCase().slice(0, 4000);
  if (
    lower.includes('cf_chl_opt') ||
    lower.includes('cf-chl-bypass') ||
    lower.includes('challenge-platform') ||
    (lower.includes('just a moment') && lower.includes('cloudflare'))
  ) {
    return 'cloudflare-challenge';
  }
  return 'not-xml';
}

/**
 * Try a URL against several RSSHub instance fallbacks until one returns
 * something that looks like a real feed XML. Returns:
 *   { resp, finalUrl, fallbackUsed }
 * If every instance fails, returns the LAST attempted response so the caller
 * can surface a useful error.
 */
async function httpGetWithRsshubFallback(url, conditionalHeaders = {}) {
  // Non-RSSHub URLs: single fetch, no fallback.
  const prefs = (await _getDefaults().catch(() => ({}))) || {};
  const userInstance = prefs.rsshubInstance || '';
  if (!isRsshubUrl(url, userInstance)) {
    const resp = await httpGet(url, conditionalHeaders);
    return { resp, finalUrl: resp.finalUrl || url, fallbackUsed: false };
  }

  const candidates = buildRsshubFallbacks(url, userInstance);
  let lastResp = null;
  let lastReason = '';
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const resp = await httpGet(candidate, i === 0 ? conditionalHeaders : {});
      lastResp = resp;
      const reason = reasonNotFeed(resp);
      if (!reason) {
        return {
          resp,
          finalUrl: resp.finalUrl || candidate,
          fallbackUsed: candidate !== url,
        };
      }
      lastReason = reason;
      console.warn(`[rsshub-fallback] ${candidate} → ${reason}, trying next...`);
    } catch (err) {
      lastReason = err.message || 'fetch-error';
      console.warn(`[rsshub-fallback] ${candidate} threw: ${lastReason}`);
    }
  }
  return {
    resp: lastResp || { status: 0, body: '', contentType: '', etag: '', lastModified: '', finalUrl: url },
    finalUrl: url,
    fallbackUsed: false,
    allFailed: true,
    lastReason,
  };
}

/**
 * Given a URL, try to detect whether it's a feed XML or an HTML page.
 * If it's HTML, look for <link rel="alternate" type="application/rss+xml">
 * Returns: { feedUrl, isFeed }
 */
export async function discoverFeedUrl(url) {
  const { resp, finalUrl, fallbackUsed, allFailed, lastReason } =
    await httpGetWithRsshubFallback(url);

  if (allFailed) {
    if (lastReason === 'cloudflare-challenge') {
      throw new Error(`所有 RSSHub 实例均被 Cloudflare 拦截。请稍后再试，或在设置中填入自建 RSSHub 实例。`);
    }
    throw new Error(`RSSHub 各实例均不可用（${lastReason}）。请稍后再试或自建实例。`);
  }

  if (!resp.body) {
    throw new Error(`无法访问 ${url}: HTTP ${resp.status}`);
  }

  // Surface HTTP failure status explicitly. Many sites (e.g. apnews.com) return
  // a styled HTML page with a 4xx/5xx — without this check, we'd silently fall
  // through to "alternate link" detection and report a misleading
  // "未声明 RSS/Atom" error.
  if (resp.status >= 400) {
    if (resp.status === 404) {
      throw new Error(`订阅源不存在（HTTP 404）：${url}。该站点可能已下线 RSS，或地址有误。`);
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`无权访问订阅源（HTTP ${resp.status}）：${url}。可能需要订阅、登录、或站点禁止抓取。`);
    }
    throw new Error(`访问订阅源失败：HTTP ${resp.status} (${url})`);
  }

  const body = resp.body.trimStart();
  const ct = (resp.contentType || '').toLowerCase();

  // Looks like XML by content type or by opening with <?xml or <rss/<feed/<rdf
  if (
    ct.includes('xml') ||
    /^<\?xml/i.test(body) ||
    /^<rss[\s>]/i.test(body) ||
    /^<feed[\s>]/i.test(body) ||
    /^<rdf:rdf[\s>]/i.test(body)
  ) {
    return {
      feedUrl: finalUrl || resp.finalUrl || url,
      isFeed: true,
      body,
      etag: resp.etag,
      lastModified: resp.lastModified,
      fallbackUsed,
    };
  }

  // HTML — look for feed autodiscovery links
  const linkRegex = /<link\b[^>]*\brel\s*=\s*["']?alternate["']?[^>]*>/gi;
  const candidates = [];
  let m;
  while ((m = linkRegex.exec(body)) !== null) {
    const tag = m[0];
    const typeMatch = tag.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const hrefMatch = tag.match(/\bhref\s*=\s*["']?([^"'\s>]+)/i);
    const titleMatch = tag.match(/\btitle\s*=\s*["']?([^"']+)/i);
    if (!hrefMatch) continue;
    const type = (typeMatch?.[1] || '').toLowerCase();
    if (type.includes('rss') || type.includes('atom') || type.includes('xml')) {
      candidates.push({
        href: absoluteUrl(hrefMatch[1], resp.finalUrl || url),
        type,
        title: titleMatch?.[1] || '',
      });
    }
  }

  if (candidates.length === 0) {
    // Detect common bot-protection challenge pages so the user knows it's
    // not their RSS URL that's wrong — it's the server blocking us.
    const lower = body.toLowerCase().slice(0, 4000);
    const isCloudflareChallenge =
      lower.includes('cf_chl_opt') ||
      lower.includes('cf-chl-bypass') ||
      lower.includes('challenge-platform') ||
      (lower.includes('just a moment') && lower.includes('cloudflare'));
    if (isCloudflareChallenge) {
      const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
      throw new Error(`${host} 受 Cloudflare 防护拦截。建议：① 换用其它 RSSHub 公共实例（如 rsshub.rssforever.com）② 自建 RSSHub 实例（docker run -d -p 1200:1200 diygod/rsshub）③ 在设置中更新 RSSHub 实例 URL`);
    }
    if (/<title[^>]*>[^<]*(?:403|forbidden|access denied|blocked)/i.test(body)) {
      throw new Error(`${url} 访问被拒绝（403/Forbidden）。可能被站点反爬或地域限制阻断。`);
    }
    throw new Error('该页面未声明 RSS/Atom 订阅源');
  }

  // Prefer atom > rss > xml
  const preferred =
    candidates.find((c) => c.type.includes('atom')) ||
    candidates.find((c) => c.type.includes('rss')) ||
    candidates[0];

  return { feedUrl: preferred.href, isFeed: false, candidates };
}

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/* ---------- Add a new subscription ---------- */

/**
 * Subscribe to a URL. Auto-discovers feed if user pasted a homepage.
 * Performs an initial fetch + populate.
 */
export async function subscribe({ url, scope = 'global' }) {
  // Step 1: discover or confirm the feed URL
  const discovery = await discoverFeedUrl(url);
  const feedUrl = discovery.feedUrl;

  // Step 2: parse a sample (we may have body from discovery, otherwise fetch)
  let xmlBody, etag, lastModified;
  if (discovery.isFeed && discovery.body) {
    xmlBody = discovery.body;
    etag = discovery.etag || '';
    lastModified = discovery.lastModified || '';
  } else {
    const { resp, finalUrl, allFailed, lastReason } =
      await httpGetWithRsshubFallback(feedUrl);
    if (allFailed) {
      throw new Error(`RSSHub 各实例均不可用（${lastReason || 'unknown'}）`);
    }
    if (resp.status >= 400) {
      throw new Error(`访问订阅源失败: HTTP ${resp.status}`);
    }
    xmlBody = resp.body;
    etag = resp.etag;
    lastModified = resp.lastModified;
    // If autodiscovery's feed URL went through fallback, prefer the live one.
    if (finalUrl && finalUrl !== feedUrl) {
      // update local var so feed.url stored below reflects the working URL
      // (small mutation; clearer than threading through)
      // eslint-disable-next-line no-param-reassign
      discovery.feedUrl = finalUrl;
    }
  }

  const parsed = parseFeed(xmlBody);

  // Step 3: create feed record
  const finalFeedUrl = discovery.feedUrl;
  const siteUrl = parsed.siteUrl || parsed.link || '';
  const faviconUrl = computeFaviconUrl(siteUrl || finalFeedUrl);

  const feed = await dbAddFeed({
    url: finalFeedUrl,
    kind: 'rss',
    title: parsed.title || finalFeedUrl,
    siteUrl,
    faviconUrl,
    description: parsed.description || '',
    scope,
  });

  // Step 4: ingest items (apply per-feed and global filters)
  const filters = await effectiveFilters(feed);
  await ingestItems(feed.id, parsed.items, filters);
  const totalCount = await countFeedItems(feed.id);
  await updateFeed(feed.id, {
    etag,
    lastModified,
    lastFetchedAt: Date.now(),
    lastSuccessAt: Date.now(),
    lastError: '',
    totalCount,
  });

  return { feed, inserted: parsed.items.length };
}

function defaultWebpageTitle(pageUrl) {
  try { return new URL(pageUrl).hostname.replace(/^www\./, ''); } catch (_) { return '网页源'; }
}

/**
 * Resolve the webpage refresh transport:
 *   auto -> HTTP first, rendered tab only when the HTML shell has no items
 *   http -> direct fetch + offscreen DOMParser, never a tab
 *   tab  -> always render in an inactive tab (SPA/login compatibility)
 */
async function extractWebpageByMode(recipe, { mode = 'auto', maxItems = 200 } = {}) {
  const refreshMode = normalizeWebpageRefreshMode(mode);
  const opts = { maxItems: maxItems || 200 };

  if (refreshMode === 'http') {
    const result = await extractWebpageItemsViaHttp(recipe, {
      ...opts,
      timeoutMs: 25000,
    });
    if (!result.ok || result.items.length === 0) {
      throw new Error(result.error || 'HTTP 抓取未匹配到条目，请改用“自动”或“兼容渲染”');
    }
    return result;
  }

  if (refreshMode === 'tab') {
    const result = await extractWebpageItemsViaTab(recipe, opts);
    return { ...result, transport: 'tab' };
  }

  let httpError = '';
  try {
    const httpResult = await extractWebpageItemsViaHttp(recipe, {
      ...opts,
      timeoutMs: 12000,
    });
    if (httpResult.ok && httpResult.items.length > 0) return httpResult;
    httpError = httpResult.error || 'HTTP 未匹配到条目';
  } catch (err) {
    httpError = (err && err.message) || String(err);
  }

  try {
    const tabResult = await extractWebpageItemsViaTab(recipe, opts);
    return {
      ...tabResult,
      transport: 'tab',
      fallbackFrom: 'http',
      httpError,
    };
  } catch (err) {
    throw new Error(`HTTP 与渲染抓取均失败（HTTP: ${httpError}；渲染: ${(err && err.message) || err}）`);
  }
}

/**
 * Create a feed backed by a visual webpage recipe. The side panel normally
 * supplies already-previewed items for an immediate first render; if none are
 * available (manual API use / stale preview) we extract once according to the
 * selected refresh mode.
 */
export async function subscribeWebpage({
  recipe: recipeInput,
  title = '',
  scope = 'global',
  intervalMin = 0,
  maxItems = null,
  refreshMode = 'auto',
  initialItems = [],
}) {
  const recipe = normalizeWebFeedRecipe(recipeInput);
  const mode = normalizeWebpageRefreshMode(refreshMode);
  let rawItems = normalizeWebFeedItems(initialItems, recipe.pageUrl, 500);
  let initialTransport = '';

  if (rawItems.length === 0) {
    const extracted = await extractWebpageByMode(recipe, { mode, maxItems: maxItems || 200 });
    rawItems = normalizeWebFeedItems(extracted.items, recipe.pageUrl, 500);
    initialTransport = extracted.transport || '';
  }
  if (rawItems.length === 0) throw new Error('网页中没有抓到可用于订阅的条目');

  const feed = await dbAddFeed({
    url: recipe.pageUrl,
    kind: 'webpage',
    recipe,
    refreshMode: mode,
    title: title || defaultWebpageTitle(recipe.pageUrl),
    siteUrl: recipe.pageUrl,
    faviconUrl: computeFaviconUrl(recipe.pageUrl),
    description: '由网页元素创建的自定义订阅源',
    scope,
    intervalMin,
    maxItems,
  });

  const filters = await effectiveFilters(feed);
  await ingestItems(feed.id, rawItems, filters);
  const totalCount = await countFeedItems(feed.id);
  await updateFeed(feed.id, {
    lastFetchedAt: Date.now(),
    lastSuccessAt: Date.now(),
    lastError: '',
    lastTransport: initialTransport,
    totalCount,
  });

  return { feed: { ...feed, totalCount }, inserted: rawItems.length };
}

function computeFaviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return '';
  }
}

/* ---------- Webpage feed refresh ---------- */

async function refreshWebpageFeed(feed) {
  try {
    const recipe = normalizeWebFeedRecipe(feed.recipe);
    const filters = await effectiveFilters(feed);
    const refreshMode = normalizeWebpageRefreshMode(feed.refreshMode);
    const extracted = await extractWebpageByMode(recipe, {
      mode: refreshMode,
      maxItems: filters.maxItems || 200,
    });
    if (!extracted.ok) throw new Error(extracted.error || '网页抓取失败');
    const rawItems = normalizeWebFeedItems(extracted.items, recipe.pageUrl, 500);
    if (rawItems.length === 0) {
      throw new Error('网页中没有匹配到条目，网站结构可能已变化');
    }
    const { inserted, skipped } = await ingestItems(feed.id, rawItems, filters);
    const totalCount = await countFeedItems(feed.id);
    await updateFeed(feed.id, {
      recipe,
      refreshMode,
      siteUrl: recipe.pageUrl,
      lastFetchedAt: Date.now(),
      lastSuccessAt: Date.now(),
      lastError: '',
      lastTransport: extracted.transport || '',
      lastFallbackReason: extracted.fallbackFrom ? (extracted.httpError || '') : '',
      totalCount,
    });
    return {
      feedId: feed.id,
      inserted,
      skipped,
      notModified: false,
      kind: 'webpage',
      matched: extracted.matched,
      transport: extracted.transport || '',
      fallbackFrom: extracted.fallbackFrom || '',
    };
  } catch (err) {
    await updateFeed(feed.id, {
      lastFetchedAt: Date.now(),
      lastError: err.message || String(err),
    });
    throw err;
  }
}

/* ---------- Refresh one feed ---------- */

export async function refreshFeed(feedId) {
  const feed = await getFeed(feedId);
  if (!feed) throw new Error('订阅源不存在');
  if (feed.kind === 'webpage') return refreshWebpageFeed(feed);

  try {
    const { resp, finalUrl, fallbackUsed, allFailed, lastReason } =
      await httpGetWithRsshubFallback(feed.url, {
        etag: feed.etag,
        lastModified: feed.lastModified,
      });

    if (allFailed) {
      throw new Error(`RSSHub 各实例均不可用（${lastReason || 'unknown'}）`);
    }

    if (resp.status === 304) {
      await updateFeed(feedId, {
        lastFetchedAt: Date.now(),
        lastSuccessAt: Date.now(),
        lastError: '',
      });
      return { feedId, inserted: 0, skipped: 0, notModified: true };
    }

    if (resp.status >= 400) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const parsed = parseFeed(resp.body);
    const filters = await effectiveFilters(feed);
    const { inserted, skipped } = await ingestItems(feedId, parsed.items, filters);
    const totalCount = await countFeedItems(feedId);

    const updates = {
      title: feed.title || parsed.title, // keep user's edits if any
      siteUrl: feed.siteUrl || parsed.siteUrl || parsed.link || '',
      etag: resp.etag,
      lastModified: resp.lastModified,
      lastFetchedAt: Date.now(),
      lastSuccessAt: Date.now(),
      lastError: '',
      totalCount,
    };
    // If we successfully migrated to a different RSSHub instance, persist the
    // new URL so subsequent refreshes go straight there without re-probing.
    if (fallbackUsed && finalUrl && finalUrl !== feed.url) {
      updates.url = finalUrl;
      console.log(`[rsshub-fallback] migrated ${feed.url} → ${finalUrl}`);
    }
    await updateFeed(feedId, updates);

    return { feedId, inserted, skipped, notModified: false, migratedTo: updates.url || null };
  } catch (err) {
    await updateFeed(feedId, {
      lastFetchedAt: Date.now(),
      lastError: err.message || String(err),
    });
    throw err;
  }
}

/* ---------- Refresh many feeds (with concurrency cap) ---------- */

export async function refreshFeeds(feedIds) {
  const results = [];
  const queue = [...feedIds];
  const workers = new Array(Math.min(MAX_CONCURRENT, queue.length)).fill(null).map(async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      try {
        const r = await refreshFeed(id);
        results.push({ feedId: id, ok: true, ...r });
      } catch (err) {
        results.push({ feedId: id, ok: false, error: err.message || String(err) });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* ---------- Item ingestion ---------- */

/**
 * @param {string} feedId
 * @param {Array} rawItems - parsed feed items
 * @param {object} [feed] - feed record; if provided, applies per-feed filters
 *   (maxItems, fetchFrom, fetchTo) before inserting
 */
async function ingestItems(feedId, rawItems, feed = null) {
  let items = (rawItems || []).slice();
  items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  if (feed) {
    if (feed.fetchFrom) {
      const from = dateBoundMs(feed.fetchFrom);
      if (!isNaN(from)) items = items.filter((r) => (r.publishedAt || 0) >= from);
    }
    if (feed.fetchTo) {
      const to = dateBoundMs(feed.fetchTo);
      const toEnd = to + 24 * 60 * 60 * 1000 - 1;
      if (!isNaN(to)) items = items.filter((r) => (r.publishedAt || 0) <= toEnd);
    }
    const max = feed.maxItems;
    if (max > 0) items = items.slice(0, max);
  }

  // NOTE: translation is intentionally NOT done here. The background backfill
  // engine (feed-backfill.js) handles translation idempotently using the
  // `translatedTo` field on each item. This keeps refresh fast (no model
  // calls during fetch) and prevents already-translated items from being
  // re-translated on every refresh.

  const now = Date.now();
  const prepared = [];
  for (const raw of items) {
    if (!raw.guid && !raw.link) continue;
    const id = await makeItemId(feedId, raw.guid, raw.link);
    const hasExplicitDate = Number.isFinite(raw.publishedAt) && raw.publishedAt > 0;
    // No-date sources (common for webpage feeds) need a visible order on first
    // ingest. Future refreshes preserve this first-seen time via
    // preservePublishedAt instead of making all old items look new.
    const publishedAt = hasExplicitDate ? raw.publishedAt : now - prepared.length * 1000;
    prepared.push({
      id, feedId,
      guid: raw.guid || '',
      link: raw.link || '',
      title: (raw.title || '').slice(0, 500),
      originalTitle: raw.originalTitle || '',
      author: (raw.author || '').slice(0, 200),
      publishedAt,
      preservePublishedAt: !!raw.preservePublishedAt || !hasExplicitDate,
      summary: (raw.summary || '').slice(0, 2000),
      originalSummary: raw.originalSummary || '',
      originalFullText: '',
      coverUrl: raw.coverUrl || '',
      sourceLanguage: raw.sourceLanguage || '',
      translated: !!raw.translated,
      translatedTo: raw.translatedTo || '',
      translateAttempts: raw.translateAttempts || 0,
      translateError: raw.translateError || '',
      translatedAt: raw.translatedAt || 0,
      contentHtml: raw.contentHtml || '',
      fullText: '',
      hasFullText: false,
      read: false,
      starred: false,
      collectedEntryId: null,
      createdAt: now,
    });
  }
  return upsertItems(prepared);
}

/**
 * Translate title and summary fields in place. Failures leave originals.
 */
/* translateItems removed — translation moved to feed-backfill.js to keep
 * fetching cheap and avoid retranslating already-translated items on refresh.
 */

function dateBoundMs(dateStr) {
  if (!dateStr) return NaN;
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return new Date(s).getTime();
}
