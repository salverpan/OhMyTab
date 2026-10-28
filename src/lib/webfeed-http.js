/**
 * Fast webpage-feed refresh path:
 *   fetch HTML in the service worker -> offscreen DOMParser -> same recipe
 *   extractor used by the visual picker.
 *
 * This never creates a tab. JS-rendered / login-walled pages can return an
 * empty shell; the feed refresher falls back to the hidden-tab renderer in
 * "auto" mode.
 */

import { normalizeWebFeedRecipe } from './webfeed-recipe.js';

const FETCH_TIMEOUT_MS = 25000;
const MAX_HTML_BYTES = 12 * 1024 * 1024;
const OFFSCREEN_URL = 'src/offscreen/index.html';
const PARSE_RETRIES = 6;

let ensureOffscreenPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(buffer, contentType) {
  const candidates = [];
  const headerCharset = String(contentType || '').match(/charset\s*=\s*["']?([^\s;"']+)/i);
  if (headerCharset) candidates.push(headerCharset[1]);
  try {
    const head = new TextDecoder('latin1').decode(buffer.slice(0, 4096)).replace(/\0/g, '');
    const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'/>]+)/i);
    if (metaCharset) candidates.push(metaCharset[1]);
  } catch (_) {}
  candidates.push('utf-8');
  for (const charset of candidates) {
    try {
      return new TextDecoder(charset, { fatal: false }).decode(buffer);
    } catch (_) {}
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

async function hasOffscreenDocument() {
  const fullUrl = chrome.runtime.getURL(OFFSCREEN_URL);
  try {
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
      return contexts.some((ctx) => ctx.documentUrl === fullUrl || String(ctx.documentUrl || '').endsWith(OFFSCREEN_URL));
    }
    if (chrome.offscreen?.hasDocument) return !!(await chrome.offscreen.hasDocument());
  } catch (_) {}
  return false;
}

async function ensureOffscreenDocument() {
  if (!chrome?.offscreen?.createDocument) {
    throw new Error('当前 Chrome 不支持 Offscreen DOMParser');
  }
  if (await hasOffscreenDocument()) return;
  if (ensureOffscreenPromise) return ensureOffscreenPromise;

  ensureOffscreenPromise = (async () => {
    try {
      const reason = chrome.offscreen.Reason?.DOM_PARSER || 'DOM_PARSER';
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [reason],
        justification: 'Parse fetched HTML for webpage RSS feeds without opening a tab',
      });
    } catch (err) {
      // Another caller may have won the creation race.
      if (await hasOffscreenDocument()) return;
      throw err;
    }
  })();
  try {
    await ensureOffscreenPromise;
  } finally {
    ensureOffscreenPromise = null;
  }
}

async function parseHtmlOffscreen(html, recipe, maxItems) {
  await ensureOffscreenDocument();
  let lastError = '';
  for (let attempt = 0; attempt < PARSE_RETRIES; attempt += 1) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'WEBFEED_PARSE_HTML',
        html,
        recipe,
        maxItems,
      });
      if (response && typeof response === 'object') return response;
      lastError = 'Offscreen 页面没有返回解析结果';
    } catch (err) {
      lastError = (err && err.message) || String(err);
    }
    await sleep(250);
  }
  throw new Error('无法调用 Offscreen HTML 解析器：' + (lastError || '未知错误'));
}

/**
 * Fetch HTML directly and extract with the saved recipe. No browser tab is
 * created. Caller decides whether an empty result should fall back to the
 * rendered-page extractor.
 */
export async function extractWebpageItemsViaHttp(recipeInput, opts = {}) {
  let recipe;
  try {
    recipe = normalizeWebFeedRecipe(recipeInput);
  } catch (err) {
    throw new Error('网页源配方无效：' + err.message);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(opts.timeoutMs) || FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(recipe.pageUrl, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'include',
      cache: 'no-cache',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.6',
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error((err && err.name === 'AbortError') ? 'HTTP 抓取超时' : ('HTTP 抓取失败：' + ((err && err.message) || String(err))));
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(`HTTP 抓取失败：HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) throw new Error('HTTP 抓取返回了空页面');
  if (buffer.byteLength > MAX_HTML_BYTES) {
    throw new Error('页面 HTML 超过 12MB，请改用“兼容渲染”刷新方式');
  }
  const html = decodeHtml(buffer, response.headers.get('content-type') || '');
  if (!html.trim()) throw new Error('HTTP 抓取返回了空文本');

  const finalUrl = response.url || recipe.pageUrl;
  const parseRecipe = finalUrl !== recipe.pageUrl
    ? { ...recipe, pageUrl: finalUrl }
    : recipe;
  const maxItems = Math.max(1, Math.min(Number(opts.maxItems) || 200, 500));
  const parsed = await parseHtmlOffscreen(html, parseRecipe, maxItems);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const ok = !!parsed.ok && items.length > 0;
  return {
    ...parsed,
    ok,
    items,
    error: ok ? '' : (parsed.error || 'HTTP 抓取未匹配到条目，页面可能是动态渲染或需要登录'),
    transport: 'http',
    httpStatus: response.status,
    finalUrl,
  };
}
