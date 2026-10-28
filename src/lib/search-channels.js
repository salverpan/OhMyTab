/**
 * 搜索渠道存取与执行。档案在 chrome.storage.local（含 API Key，不进 sync）。
 * 交互对齐 AI 渠道：多家并存，activeSearchChannelId 指向当前使用的那一家。
 */

import { getApiConfig, getAiChannels, getActiveChannelId } from './storage.js';
import { nativeWebSearch, deepseekSearch } from './ai-client.js';
import { withNetworkRetry } from './net-retry.js';
import { parseDuckDuckGoHtml, parseBingHtml, formatSearchSnippets } from './search-html.js';
import {
  normalizeSearchChannel, searchPreset, buildSearchRequest, parseSearchPayload, searchErrorMessage,
  isOfficialDeepSeek,
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
  return withNetworkRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'text/html', 'Accept-Language': 'en-US,zh-CN;q=0.9' },
      });
      if (!resp.ok) {
        const e = new Error('HTTP ' + resp.status);
        e.status = resp.status;
        throw e;
      }
      return await resp.text();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const e = new Error('连接超时');
        e.code = 'ETIMEDOUT';
        e.timeout = true;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }, { maxRetries: 5 });
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
 * count / needContent 只有 DeepSeek 原生渠道使用；needContent 默认 true（要求返回正文）。
 */
export async function executeSearchChannel(channel, query, {
  apiConfig, timeoutMs = 20000, count = 10, needContent = true,
} = {}) {
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
    try {
      const text = await deepseekSearch(q, apiConfig, { count, needContent, timeoutMs });
      if (!text) throw new Error('未返回条目');
      return { label: ch.name, text };
    } catch (err) {
      // 新 Search 端点未覆盖时降级旧 Responses web_search；鉴权/计费/限流错误
      // 不降级，否则会用模型代搜掩盖真实原因。
      if (err && (err.status === 404 || err.status === 405)) {
        const text = await nativeWebSearch(q, apiConfig);
        if (!text) throw new Error('未返回条目');
        return { label: `${ch.name}（旧接口）`, text };
      }
      throw err;
    }
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

  const result = await withNetworkRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(req.url, { ...req.init, signal: controller.signal });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (!resp.ok) {
        const e = new Error(searchErrorMessage(data, resp.status));
        e.status = resp.status;
        e.detail = searchErrorMessage(data, resp.status);
        throw e;
      }
      return { resp, data };
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const e = new Error('连接超时');
        e.code = 'ETIMEDOUT';
        e.timeout = true;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }, { maxRetries: 5 });
  const parsed = parseSearchPayload(ch.provider, result.data);
  if (parsed.error && !parsed.items.length) throw new Error(parsed.error);
  if (!parsed.items.length) throw new Error('未返回条目');
  return { label: ch.name, text: formatSearchSnippets(parsed.items) };
}

