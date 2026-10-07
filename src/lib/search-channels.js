/**
 * 搜索渠道存取与执行。档案在 chrome.storage.local（含 API Key，不进 sync）。
 * 交互对齐 AI 渠道：多家并存，activeSearchChannelId 指向当前使用的那一家。
 */

import { getApiConfig, getAiChannels, getActiveChannelId } from './storage.js';
import { nativeWebSearch } from './ai-client.js';
import { parseDuckDuckGoHtml, parseBingHtml, formatSearchSnippets } from './search-html.js';
import {
  normalizeSearchChannel, searchPreset, buildSearchRequest, parseSearchPayload, searchErrorMessage,
} from './search-providers.js';

const SEARCH_CHANNELS_KEY = 'searchChannels';
const ACTIVE_SEARCH_KEY = 'activeSearchChannelId';

export async function getSearchChannels() {
  const { [SEARCH_CHANNELS_KEY]: list } = await chrome.storage.local.get(SEARCH_CHANNELS_KEY);
  return (Array.isArray(list) ? list : []).map(normalizeSearchChannel);
}

export async function saveSearchChannels(list) {
  const next = (Array.isArray(list) ? list : []).map(normalizeSearchChannel);
  await chrome.storage.local.set({ [SEARCH_CHANNELS_KEY]: next });
  return next;
}

export async function getActiveSearchChannelId() {
  const { [ACTIVE_SEARCH_KEY]: id } = await chrome.storage.local.get(ACTIVE_SEARCH_KEY);
  return typeof id === 'string' ? id : '';
}

export async function setActiveSearchChannelId(id) {
  await chrome.storage.local.set({ [ACTIVE_SEARCH_KEY]: id });
}

function isOfficialDeepSeek(apiConfig) {
  return !!(apiConfig && apiConfig.apiKey && /(^|\.)api\.deepseek\.com($|\/)/i.test(apiConfig.baseUrl || ''));
}

/** 第一次打开：从旧的 searchProvider 下拉迁成两条内置渠道，并选中原先那一种。 */
export async function ensureDefaultSearchChannels() {
  const existing = await getSearchChannels();
  if (existing.length) {
    const id = await getActiveSearchChannelId();
    if (!id || !existing.some((c) => c.id === id)) await setActiveSearchChannelId(existing[0].id);
    return existing;
  }

  let pref = 'auto';
  try {
    const cfg = await getApiConfig();
    pref = cfg.searchProvider || 'auto';
  } catch (_) {}

  let official = false;
  if (pref === 'auto') {
    try {
      const chans = await getAiChannels();
      const activeId = await getActiveChannelId();
      const cur = chans.find((c) => c.id === activeId) || chans[0];
      official = isOfficialDeepSeek(cur);
    } catch (_) {}
  }

  const html = normalizeSearchChannel({ id: 'search_html', name: '网页抓取', provider: 'html' });
  const deepseek = normalizeSearchChannel({ id: 'search_deepseek', name: 'DeepSeek 原生', provider: 'deepseek' });
  const list = [html, deepseek];
  const active = (pref === 'deepseek' || (pref === 'auto' && official)) ? deepseek.id : html.id;
  await saveSearchChannels(list);
  await setActiveSearchChannelId(active);
  return list;
}

export async function getActiveSearchChannel() {
  const list = await ensureDefaultSearchChannels();
  const id = await getActiveSearchChannelId();
  return list.find((c) => c.id === id) || list[0];
}

async function fetchHtmlWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/html', 'Accept-Language': 'en-US,zh-CN;q=0.9' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('连接超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlSearch(query) {
  const errors = [];
  const q = encodeURIComponent(query);
  const tasks = [
    (async () => {
      const html = await fetchHtmlWithTimeout(`https://html.duckduckgo.com/html/?q=${q}`, 8000);
      const items = parseDuckDuckGoHtml(html);
      if (!items.length) throw new Error('返回空页');
      return { engine: 'DuckDuckGo', text: formatSearchSnippets(items) };
    })(),
    (async () => {
      const urls = [
        `https://cn.bing.com/search?q=${q}&setlang=en`,
        `https://www.bing.com/search?q=${q}&setlang=en`,
      ];
      let last = new Error('Bing 无结果');
      for (const url of urls) {
        try {
          const html = await fetchHtmlWithTimeout(url, 10000);
          const items = parseBingHtml(html);
          if (items.length) return { engine: 'Bing', text: formatSearchSnippets(items) };
          last = new Error('页面无可解析结果');
        } catch (err) {
          last = err;
        }
      }
      throw last;
    })(),
  ];
  try {
    return await Promise.any(tasks);
  } catch (agg) {
    const parts = (agg && agg.errors) ? agg.errors.map((e) => e.message || String(e)) : [String(agg)];
    errors.push(...parts);
    throw new Error(`DuckDuckGo / Bing 均失败：${errors.join('；')}`);
  }
}

/**
 * 执行一家搜索渠道。
 * 返回 { label, text }。配置缺失（没 Key / 没 Base URL）抛 err.config = true，调用方不要偷偷换引擎。
 */
export async function executeSearchChannel(channel, query, { apiConfig, timeoutMs = 15000 } = {}) {
  const ch = normalizeSearchChannel(channel);
  const q = String(query || '').trim();
  if (!q) throw new Error('需要搜索关键词');

  if (ch.provider === 'html') {
    const hit = await fetchHtmlSearch(q);
    const engine = hit.engine === 'Bing' ? 'Bing' : 'DuckDuckGo';
    return { label: `${ch.name} · ${engine}`, text: hit.text };
  }

  if (ch.provider === 'deepseek') {
    if (!isOfficialDeepSeek(apiConfig)) {
      throw new Error('当前 AI 渠道不是官方 DeepSeek');
    }
    const text = await nativeWebSearch(q, apiConfig);
    if (!text) throw new Error('未返回条目');
    return { label: ch.name, text };
  }

  const preset = searchPreset(ch.provider);
  if (preset.needsKey && !ch.apiKey) {
    const err = new Error(`${ch.name} 还没有 API Key`);
    err.config = true;
    throw err;
  }
  if (preset.needsBase && !ch.baseUrl) {
    const err = new Error(`${ch.name} 还没有 Base URL`);
    err.config = true;
    throw err;
  }

  const req = buildSearchRequest(ch, q);
  if (!req) throw new Error('未知搜索类型');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(req.url, { ...req.init, signal: controller.signal });
    let data = null;
    try { data = await resp.json(); } catch (_) {}
    if (!resp.ok) throw new Error(searchErrorMessage(data, resp.status));
    const parsed = parseSearchPayload(ch.provider, data);
    if (parsed.error && !parsed.items.length) throw new Error(parsed.error);
    if (!parsed.items.length) throw new Error('未返回条目');
    return { label: ch.name, text: formatSearchSnippets(parsed.items) };
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('连接超时');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
