/**
 * Refresh a webpage feed in an inactive tab. The rendered DOM and the user's
 * current Chrome session are available there, which is essential for SPA and
 * logged-in sites that plain fetch() cannot scrape.
 */

import { normalizeWebFeedRecipe } from './webfeed-recipe.js';

const TAB_LOAD_TIMEOUT_MS = 45000;
const CONTENT_READY_RETRIES = 10;
const CONTENT_RETRY_DELAY_MS = 350;

let refreshChain = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withRefreshSlot(task) {
  const next = refreshChain.then(task, task);
  refreshChain = next.then(() => undefined, () => undefined);
  return next;
}

function waitForTabReady(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (_) {}
      resolve(ready);
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info && info.status === 'complete') finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId)
      .then((tab) => { if (tab && tab.status === 'complete') finish(true); })
      .catch(() => finish(false));
  });
}

function closeTab(tabId) {
  try {
    const p = chrome.tabs.remove(tabId);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

async function extractFromTab(tabId, recipe, maxItems) {
  let lastError = '';
  for (let attempt = 0; attempt < CONTENT_READY_RETRIES; attempt += 1) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, {
        type: 'WEBFEED_EXTRACT',
        recipe,
        maxItems,
      });
      if (resp && typeof resp === 'object') return resp;
      lastError = '页面没有返回抓取结果';
    } catch (err) {
      lastError = (err && err.message) || String(err);
    }
    await sleep(CONTENT_RETRY_DELAY_MS);
  }
  throw new Error('无法连接网页内容脚本：' + (lastError || '未知错误'));
}

/**
 * Open recipe.pageUrl in a background tab, wait for the rendered DOM, extract,
 * then always close the tab. Calls are serialized to avoid opening a burst of
 * background tabs when several webpage feeds refresh at once.
 */
export async function extractWebpageItemsViaTab(recipeInput, opts = {}) {
  let recipe;
  try {
    recipe = normalizeWebFeedRecipe(recipeInput);
  } catch (err) {
    throw new Error('网页源配方无效：' + err.message);
  }
  if (!chrome?.tabs?.create) throw new Error('当前环境不支持后台标签页抓取');

  return withRefreshSlot(async () => {
    const maxItems = Math.max(1, Math.min(Number(opts.maxItems) || 200, 500));
    const tab = await chrome.tabs.create({
      url: recipe.pageUrl,
      active: false,
    });
    if (!tab || typeof tab.id !== 'number') throw new Error('无法创建后台抓取标签页');
    try {
      await waitForTabReady(tab.id, Number(opts.timeoutMs) || TAB_LOAD_TIMEOUT_MS);
      // Let client-rendered lists settle after the load event.
      const settleMs = opts.settleMs == null ? 650 : Math.max(0, Number(opts.settleMs) || 0);
      await sleep(settleMs);
      const resp = await extractFromTab(tab.id, recipe, maxItems);
      if (!resp.ok) throw new Error(resp.error || '网页抓取失败');
      return resp;
    } finally {
      closeTab(tab.id);
    }
  });
}
