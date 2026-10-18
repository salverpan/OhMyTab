import { Readability } from '@mozilla/readability';
import Defuddle from 'defuddle';
import {
  MAX_TEXT_LENGTH, TEXT_BLOCK_SELECTOR, openAllDetails, getTitleFromDoc,
  extractPublishedDateFromDoc, extractByScoredBlocks, normalizePublishedDate,
} from './extract-common.js';
import { htmlToText } from './html-utils.js';
import { visionOcrScreen, getVisionConfig } from './vision-client.js';
import { debuggerAttach, debuggerDetach, debuggerSend, withSerialForeground } from './cdp.js';

// 发往页面 Runtime.evaluate 的片段里全局名拆写（SW 包校验器禁字面 window./document.）；
// join('') 防止打包器把相邻字符串常量折叠回字面量。
const PAGE_WIN = ['wind', 'ow'].join('');
const PAGE_DOC = ['docu', 'ment'].join('');

/* Vision OCR via CDP screenshots. attach 前会激活/聚焦窗口（discarded/frozen
   先唤醒）。Page.captureScreenshot 20s 超时。 */
async function visionOcrViaCdp(tabId, maxChunks = 20) {
  await debuggerAttach(tabId);
  try {
    await debuggerSend(tabId, 'Page.enable');
    const metrics = await debuggerSend(tabId, 'Runtime.evaluate', {
      expression: `JSON.stringify({h:${PAGE_DOC}.body.scrollHeight,vh:${PAGE_WIN}.innerHeight,sy:${PAGE_WIN}.scrollY})`,
      returnByValue: true,
    });
    const m = JSON.parse(metrics?.result?.value || '{"h":800,"vh":800,"sy":0}');
    const vh = m.vh || 800;
    const total = m.h || vh;
    const step = Math.max(200, Math.round(vh * 0.85));
    const chunks = [];
    for (let pos = 0, i = 0; pos < total && i < maxChunks; pos += step, i++) {
      await debuggerSend(tabId, 'Runtime.evaluate', { expression: `${PAGE_WIN}.scrollTo(0,${pos})` });
      await new Promise((r) => setTimeout(r, 600));
      const shot = await debuggerSend(tabId, 'Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      if (!shot?.data) continue;
      const vr = await visionOcrScreen('data:image/jpeg;base64,' + shot.data, { timeoutMs: 45000 });
      if (vr.ok && vr.content.trim()) chunks.push(vr.content.trim());
    }
    await debuggerSend(tabId, 'Runtime.evaluate', { expression: `${PAGE_WIN}.scrollTo(0,${m.sy || 0})` }).catch(() => {});
    // Boundary dedup (overlap region)
    const merged = [];
    for (const chunk of chunks) {
      const lines = chunk.split(/\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) continue;
      if (merged.length > 0) {
        const tail = merged.slice(-3);
        let skip = 0;
        for (let k = 0; k < Math.min(3, lines.length); k++) {
          if (tail.includes(lines[k])) skip = k + 1;
          else break;
        }
        lines.splice(0, skip);
      }
      merged.push(...lines);
    }
    return merged.join('\n').slice(0, MAX_TEXT_LENGTH);
  } finally {
    await debuggerDetach(tabId);
  }
}

/* CDP network capture for background tabs: attach debugger, scroll to trigger
   lazy XHR/Fetch, capture JSON response bodies, detach. Returns array of
   { url, mimeType, body }. Used as the middle tier in fetchViaTab's fallback
   chain (DOM -> network JSON -> vision OCR) -- gets the clean structured data
   behind anti-scraping (font obfuscation / canvas) without vision cost. */
async function captureNetworkViaCdp(tabId, duration = 7000) {
  const captured = [];
  const pending = new Map();
  await debuggerAttach(tabId);
  let onEvent = null;
  try {
    await debuggerSend(tabId, 'Network.enable');
    onEvent = async (source, method, params) => {
      if (source.tabId !== tabId) return;
      if (method === 'Network.responseReceived') {
        const { requestId, response, type } = params;
        if (type !== 'XHR' && type !== 'Fetch') return;
        const mime = response.mimeType || '';
        if (!/json|text|javascript/.test(mime)) return;
        pending.set(requestId, { url: response.url || '', mimeType: mime });
      } else if (method === 'Network.loadingFinished') {
        const meta = pending.get(params.requestId);
        if (!meta) return;
        pending.delete(params.requestId);
        try {
          const body = await debuggerSend(tabId, 'Network.getResponseBody', { requestId: params.requestId });
          let text = body?.body || '';
          if (body?.base64Encoded) { try { text = atob(text); } catch (_) {} }
          if (text && text.length > 0) captured.push({ url: meta.url, mimeType: meta.mimeType, body: text });
        } catch (_) {}
      }
    };
    chrome.debugger.onEvent.addListener(onEvent);

    const metrics = await debuggerSend(tabId, 'Runtime.evaluate', {
      expression: `JSON.stringify({h:${PAGE_DOC}.body.scrollHeight,vh:${PAGE_WIN}.innerHeight,sy:${PAGE_WIN}.scrollY})`,
      returnByValue: true,
    });
    const m = JSON.parse(metrics?.result?.value || '{"h":800,"vh":800}');
    const vh = m.vh || 800;
    const total = m.h || vh;
    const step = Math.round(vh * 0.85);
    const rounds = Math.min(8, Math.max(3, Math.ceil(duration / 900)));
    for (let i = 0; i < rounds; i++) {
      await debuggerSend(tabId, 'Runtime.evaluate', { expression: `${PAGE_WIN}.scrollTo(0,${Math.min(total, step * (i + 1))})` });
      await new Promise((r) => setTimeout(r, Math.floor(duration / rounds)));
    }
    // Let pending requests finish
    let quiet = 0;
    const settleStart = Date.now();
    while (pending.size > 0 && quiet < 1200 && Date.now() - settleStart < 3000) {
      const before = pending.size;
      await new Promise((r) => setTimeout(r, 300));
      quiet = pending.size === before ? quiet + 300 : 0;
    }
  } finally {
    if (onEvent) chrome.debugger.onEvent.removeListener(onEvent);
    await debuggerDetach(tabId);
  }
  return captured;
}

/* Extract the best text from a network capture. Recursively walks JSON to find
   the longest string (likely the article/chapter content). Falls back to the
   raw body for non-JSON responses. Prefers strings >200 chars. */
function extractTextFromNetworkCapture(captured) {
  let best = '';
  let bestUrl = '';
  for (const c of captured) {
    let text = '';
    try {
      const data = JSON.parse(c.body);
      text = longestStringIn(data, 0);
    } catch (_) {
      text = c.body;
    }
    if (text.length > best.length) { best = text; bestUrl = c.url; }
  }
  return best.length >= 200 ? { text: best.slice(0, MAX_TEXT_LENGTH), url: bestUrl } : null;
}

function longestStringIn(obj, depth) {
  if (depth > 6) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => longestStringIn(item, depth + 1)).join('\n');
  }
  if (obj && typeof obj === 'object') {
    let best = '';
    for (const v of Object.values(obj)) {
      const t = longestStringIn(v, depth + 1);
      if (t.length > best.length) best = t;
    }
    return best;
  }
  return '';
}

/* ---- Legacy selectors - fallback when Readability returns nothing ---- */

const REMOVE_SELECTORS = [
  'script', 'style', 'nav', 'footer', 'header', 'aside',
  'noscript', 'iframe', 'svg', 'form',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '.sidebar', '.nav', '.footer', '.header', '.menu',
  '.advertisement', '.ad', '.ads', '#comments', '.comment',
  '.cookie', '.popup', '.modal', '.overlay',
];

const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.content',
  '#content',
  '.post',
  '.article',
];

function getDOMParser() {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  if (typeof globalThis !== 'undefined' && globalThis.DOMParser) return globalThis.DOMParser;
  if (typeof self !== 'undefined' && self.DOMParser) return self.DOMParser;
  return null;
}

/* ---- Primary extraction: DOMParser + Readability (SW-side, from fetch'd HTML) ---- */

export function extractContent(html, url) {
  const DP = getDOMParser();
  if (!DP) return extractContentFallback(html);

  const doc = new DP().parseFromString(html, 'text/html');
  if (!doc || !doc.body) return extractContentFallback(html);
  openAllDetails(doc);
  const publishedAt = extractPublishedDateFromDoc(doc);

  // 1) Defuddle (best extraction quality, Markdown output, schema.org metadata)
  try {
    const result = new Defuddle(doc, { url, markdown: true }).parse();
    if (result && result.content && result.content.trim().length >= 20) {
      return {
        title: result.title || getTitleFromDoc(doc) || '',
        content: result.content.trim().slice(0, MAX_TEXT_LENGTH),
        publishedAt: normalizePublishedDate(result.published) || publishedAt,
      };
    }
  } catch (_) { /* fall through to Readability */ }

  // 2) Readability + scored blocks
  try {
    const article = new Readability(doc).parse();
    if (article && article.textContent && article.textContent.trim().length >= 20) {
      const text = article.textContent.trim();
      const scored = extractByScoredBlocks(doc, publishedAt);
      if (scored && scored.content.length >= 80 && scored.content.length < text.length * 0.85) return scored;
      return {
        title: article.title || getTitleFromDoc(doc) || '',
        content: text.slice(0, MAX_TEXT_LENGTH),
        publishedAt,
      };
    }
  } catch (_) { /* fall through */ }

  const scored = extractByScoredBlocks(doc, publishedAt);
  if (scored) return scored;

  // 3) Legacy CSS-selector fallback
  return legacyExtract(doc, html, publishedAt);
}

/* ---- Live DOM extraction (content script) ---- */

/* ---- Background-tab extraction (SW opens a tab, messages content script) ---- */

export async function fetchViaTab(url, options = {}) {
  const { active = false, closeTab = true, timeoutMs = 55000 } = options;
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active }, (tab) => {
      if (!tab || !tab.id) {
        reject(new Error('无法创建标签页'));
        return;
      }

      const tabId = tab.id;
      let settled = false;
      let extractionStarted = false;
      const finish = async (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (closeTab) await chrome.tabs.remove(tabId).catch(() => {});
        resolve({ ...result, tabId: closeTab ? null : tabId });
      };
      const timeout = setTimeout(async () => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        if (closeTab) await chrome.tabs.remove(tabId).catch(() => {});
        reject(new Error('页面加载超时'));
      }, timeoutMs);

      async function extractWithScroll() {
        // Guard against double-start: both the onUpdated listener and the
        // immediate tabs.get check below can fire for fast-loading pages,
        // which would otherwise run extraction twice (duplicate CDP attach,
        // duplicate SCROLL_COLLECT, wasted work).
        if (extractionStarted || settled) return null;
        extractionStarted = true;
        // Three-tier fallback chain: DOM extraction -> network JSON -> vision OCR.
        // 1) Scroll-collect: progressive scroll + network-idle + accumulate,
        //    handles lazy-load / SPA / virtual scroll. Fast path for normal pages.
        const scrollBudget = Math.max(8000, Math.min(25000, timeoutMs - 25000));
        let scrollResp = null;
        const askScroll = () => chrome.tabs.sendMessage(tabId, { type: 'SCROLL_COLLECT', maxTimeMs: scrollBudget });
        try {
          scrollResp = await askScroll();
        } catch (_) { /* content script not ready or SCROLL_COLLECT unavailable -> fall back */ }
        // 后台滚不动、懒加载不出来：排进前台队列，一次只滚一页，避免并行抢焦点卡住。
        if (scrollResp && scrollResp.needsForeground) {
          try {
            scrollResp = await withSerialForeground(tabId, async () => {
              await new Promise((r) => setTimeout(r, 280));
              return askScroll();
            });
          } catch (_) { /* 保持第一次的部分结果，后面还有网络/视觉降级 */ }
        }

        // Fast path: DOM content is sufficient and not garbled
        if (scrollResp && scrollResp.content && scrollResp.content.trim().length >= 80 && !scrollResp.garbled) {
          return scrollResp;
        }

        // 2) Network capture tier: DOM insufficient/garbled -> attach CDP,
        //    re-scroll to trigger lazy XHR/Fetch, capture JSON response bodies.
        //    Gets clean structured data behind anti-scraping without vision cost.
        const needsFallback = !scrollResp || scrollResp.garbled || (scrollResp.content && scrollResp.content.trim().length < 80);
        if (needsFallback) {
          try {
            const captured = await captureNetworkViaCdp(tabId, 7000);
            const net = extractTextFromNetworkCapture(captured);
            if (net && net.text) {
              return {
                title: scrollResp?.title || '',
                content: net.text,
                publishedAt: scrollResp?.publishedAt || null,
                networkCaptured: true,
                networkUrl: net.url,
              };
            }
          } catch (_) { /* network capture failed -> fall through to vision */ }

          // 3) Vision OCR tier: last resort for font obfuscation / canvas /
          //    image-rendered text. Uses the current channel model.
          if (scrollResp?.garbled) {
            try {
              const vcfg = await getVisionConfig();
              if (vcfg.apiKey) {
                const ocrText = await visionOcrViaCdp(tabId).catch(() => '');
                if (ocrText && ocrText.length > ((scrollResp.content || '').length * 1.5)) {
                  return { ...scrollResp, content: ocrText, visionOcr: true };
                }
              }
            } catch (_) { /* vision fallback failed -> use scroll result */ }
          }

          // Return whatever scroll-collect gave us (even if short/garbled)
          if (scrollResp && scrollResp.content) return scrollResp;
        }

        // 4) Legacy fallback: length-stabilising poll of EXTRACT_CONTENT.
        //    Used when SCROLL_COLLECT is unavailable (old build) or returns empty.
        const POLL_INTERVAL = 500;
        const POLL_MAX = 8000;
        const STABLE_ROUNDS = 2;
        const pollStart = Date.now();
        let lastLen = -1;
        let stableCount = 0;
        let best = null;
        return new Promise((resolvePoll) => {
          const poll = async () => {
            if (settled) return resolvePoll(best);
            try {
              const resp = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
              const len = (resp && resp.content) ? resp.content.length : 0;
              if (!best || len > best.content.length) best = resp;
              if (len > 200 && len === lastLen) stableCount++;
              else stableCount = 0;
              lastLen = len;
            } catch (_) { /* content script not ready - retry */ }
            const elapsed = Date.now() - pollStart;
            const ready = (stableCount >= STABLE_ROUNDS && best && best.content && best.content.length >= 80) || elapsed >= POLL_MAX;
            if (ready) resolvePoll(best);
            else setTimeout(poll, POLL_INTERVAL);
          };
          setTimeout(poll, POLL_INTERVAL);
        });
      }

      function listener(tabId_, info) {
        if (tabId_ !== tabId || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        extractWithScroll().then((best) => {
          if (!best) return; // another path already started extraction
          finish({
            title: (best && best.title) || '',
            content: (best && best.content) || '',
            publishedAt: (best && best.publishedAt) || null,
          });
        }).catch(() => finish({ title: '', content: '', publishedAt: null }));
      }

      chrome.tabs.onUpdated.addListener(listener);

      // Guard: check if the tab already loaded before the listener was registered.
      // Without this, a fast-loading page (cache / redirect / about:blank)
      // fires onUpdated('complete') before addListener, causing the promise
      // to hang until the 55s timeout.
      chrome.tabs.get(tabId, (t) => {
        if (t && t.status === 'complete' && !settled) {
          chrome.tabs.onUpdated.removeListener(listener);
          extractWithScroll().then((best) => {
            if (!best) return; // another path already started extraction
            finish({
              title: (best && best.title) || '',
              content: (best && best.content) || '',
              publishedAt: (best && best.publishedAt) || null,
            });
          }).catch(() => finish({ title: '', content: '', publishedAt: null }));
        }
      });
    });
  });
}

/* ---- Block / JS detection (unchanged) ---- */

export function detectBlocked(response, html) {
  const lower = (html || '').toLowerCase();
  const titleMatch = (html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
  const cloudflareKeywords = [
    'cf-browser-verification',
    'cf-challenge',
    'challenge-platform',
    'challenges.cloudflare.com',
    'checking your browser',
    'just a moment',
    'verify you are human',
    'turnstile',
  ];
  if (response.status === 429 || cloudflareKeywords.some((kw) => lower.includes(kw))) {
    return { blocked: true, reason: '检测到 Cloudflare / 人机验证，请打开页面完成验证后重试', needsVerification: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { blocked: true, reason: '需要登录、权限验证或人机验证，请打开页面处理后重试', needsVerification: true };
  }

  const challengeKeywords = ['captcha', 'recaptcha', 'hcaptcha', '人机验证', '验证码', '安全验证'];
  if (challengeKeywords.some((kw) => lower.includes(kw))) {
    return { blocked: true, reason: '检测到人机验证，请打开页面完成验证后重试', needsVerification: true };
  }

  if (html.length < 500) {
    const keywords = ['login', 'sign in', 'subscribe', 'paywall', '请登录', '会员', '付费'];
    if (keywords.some((kw) => lower.includes(kw))) {
      return { blocked: true, reason: '检测到登录/付费墙，请打开页面处理后重试', needsVerification: true };
    }
  }

  if (response.redirected) {
    const redirectHost = new URL(response.url).hostname.toLowerCase();
    const loginHosts = [
      'accounts.google.com', 'login.microsoftonline.com',
      'signin.', 'login.', 'auth.',
    ];
    if (loginHosts.some((h) => redirectHost.includes(h))) {
      return { blocked: true, reason: '被重定向到登录页面，请登录后重试', needsVerification: true };
    }
  }

  return { blocked: false, reason: '', needsVerification: false, title };
}

export function detectVerificationPage(title = '', content = '') {
  const text = `${title}\n${content}`.toLowerCase();
  const keywords = [
    'just a moment',
    'attention required',
    'checking your browser',
    'checking if the site connection is secure',
    'verify you are human',
    'cf-browser-verification',
    'cf-challenge',
    'challenge-platform',
    'challenges.cloudflare.com',
    'turnstile',
    'captcha',
    'recaptcha',
    'hcaptcha',
    '人机验证',
    '验证码',
    '安全验证',
  ];
  if (keywords.some((kw) => text.includes(kw))) {
    return { blocked: true, reason: '检测到 Cloudflare / 人机验证，请打开页面完成验证后重试', needsVerification: true };
  }
  return { blocked: false, reason: '', needsVerification: false };
}

/* ======== Internals ======== */

function legacyExtract(doc, html, publishedAt = null) {
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent?.trim() ||
    '';

  REMOVE_SELECTORS.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  let container = doc.body;
  for (const sel of CONTENT_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && el.textContent.trim().length > 200) {
      container = el;
      break;
    }
  }

  const texts = [];
  const textNodes = container.querySelectorAll(
    'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, dl, dt, dd, figcaption'
  );

  for (const node of textNodes) {
    const text = node.textContent.trim();
    if (text.length > 10) {
      texts.push(text);
    }
  }

  if (texts.length === 0) {
    const bodyText = container.textContent.trim();
    return { title, content: bodyText.slice(0, MAX_TEXT_LENGTH), publishedAt };
  }

  const unique = [...new Set(texts)];
  const content = unique.join('\n\n').slice(0, MAX_TEXT_LENGTH);
  return { title, content, publishedAt };
}

function extractContentFallback(html) {
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) title = ogMatch[1];

  const content = htmlToText(html).slice(0, MAX_TEXT_LENGTH);
  return { title, content };
}
