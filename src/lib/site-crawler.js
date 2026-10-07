// 会话内站点爬取：带用户 Cookie 的 BFS，不是无头农场。
import { buildPageData } from './page-data.js';
import { detectVerificationPage } from './extractor.js';
import { withTimeout } from './page-data.js';

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
function matchesAny(url, patterns) {
  const list = Array.isArray(patterns) ? patterns : String(patterns || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return false;
  return list.some((p) => url.includes(p));
}

async function waitTabComplete(tabId, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t && t.status === 'complete') return t;
    await new Promise((r) => setTimeout(r, 250));
  }
  return chrome.tabs.get(tabId).catch(() => null);
}

async function collectLinks(tabId) {
  const resp = await withTimeout(
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE_LINKS' }).catch(() => null),
    4000,
    null,
  );
  return Array.isArray(resp?.links) ? resp.links : [];
}

export async function crawlSite({
  startUrl,
  tabId,
  allow = [],
  deny = [],
  maxPages = 20,
  mode = 'auto',
} = {}) {
  const max = Math.max(1, Math.min(40, Number(maxPages) || 20));
  let tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  if (!tab) {
    tab = await chrome.tabs.create({ url: startUrl, active: false });
  } else if (startUrl && tab.url !== startUrl) {
    await chrome.tabs.update(tab.id, { url: startUrl });
    tab = await waitTabComplete(tab.id);
  }
  if (!tab || !tab.id) return { error: '无法打开起始页', pages: [] };

  const originHost = hostOf(startUrl || tab.url || '');
  const visited = new Set();
  const queue = [startUrl || tab.url];
  const pages = [];
  let openedExtra = !tabId;

  while (queue.length && pages.length < max) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    const uHost = hostOf(url);
    if (originHost && uHost && uHost !== originHost) continue;
    if (deny && matchesAny(url, deny)) continue;
    if (allow && (Array.isArray(allow) ? allow.length : String(allow).trim()) && !matchesAny(url, allow)) continue;
    visited.add(url);

    await chrome.tabs.update(tab.id, { url });
    tab = await waitTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 400));

    const data = await buildPageData(tab.id, { format: mode === 'list' || mode === 'article' ? 'auto' : (mode || 'auto') });
    const title = data.title || tab.title || '';
    const content = (data.data && data.data.content) || '';
    const blocked = detectVerificationPage(title, content);
    if (blocked.needsVerification) {
      if (openedExtra) { /* 留给用户看验证页，不关 */ }
      return {
        pages,
        stopped: 'needsVerification',
        reason: blocked.reason,
        url,
        hint: '请在该标签页完成人机验证后重试 crawl_site，不要换 URL。',
      };
    }
    pages.push({
      url: tab.url || url,
      title,
      pageType: data.pageType,
      data: data.data,
      untrusted: true,
    });

    if (pages.length >= max) break;
    const links = await collectLinks(tab.id);
    for (const l of links) {
      const href = (l && l.url) || l;
      if (href && !visited.has(href)) queue.push(href);
    }
  }

  return { pages, count: pages.length, visited: visited.size };
}
