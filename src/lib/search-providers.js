/**
 * 搜索渠道的纯逻辑（无 chrome、无 fetch）。
 * 一家渠道 = 一个已保存的搜索 API。设置页可以存很多家，search_web 只用当前选中的那家。
 */

export const SEARCH_PRESETS = [
  {
    id: 'tavily',
    label: 'Tavily',
    provider: 'tavily',
    needsKey: true,
    needsBase: false,
    keyPlaceholder: 'tvly-...',
    hint: '给 Agent 用的搜索。免费档每月约 1000 次，Key 在 tavily.com。',
  },
  {
    id: 'brave',
    label: 'Brave',
    provider: 'brave',
    needsKey: true,
    needsBase: false,
    keyPlaceholder: 'BSA...',
    hint: 'Brave Search API。请求头用 X-Subscription-Token。',
  },
  {
    id: 'serper',
    label: 'Serper',
    provider: 'serper',
    needsKey: true,
    needsBase: false,
    keyPlaceholder: 'Serper Key',
    hint: 'Google 结果。请求头用 X-API-KEY。',
  },
  {
    id: 'exa',
    label: 'Exa',
    provider: 'exa',
    needsKey: true,
    needsBase: false,
    keyPlaceholder: 'Exa Key',
    hint: '语义搜索。请求头用 x-api-key。',
  },
  {
    id: 'bocha',
    label: '博查',
    provider: 'bocha',
    needsKey: true,
    needsBase: false,
    keyPlaceholder: '博查 API Key',
    hint: '国内搜索。开放平台 open.bochaai.com，Bearer Key。',
  },
  {
    id: 'searxng',
    label: 'SearXNG',
    provider: 'searxng',
    needsKey: false,
    needsBase: true,
    keyPlaceholder: '',
    hint: '自建实例的根地址，例如 https://searx.example。实例需开启 format=json。',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek 原生',
    provider: 'deepseek',
    needsKey: false,
    needsBase: false,
    keyPlaceholder: '',
    hint: '用当前 AI 渠道里的官方 DeepSeek Key，走 Search API 并默认返回正文。按成功搜索计费（¥5/1000 次）；不是 api.deepseek.com 时会改用网页抓取。',
  },
  {
    id: 'html',
    label: '网页抓取',
    provider: 'html',
    needsKey: false,
    needsBase: false,
    keyPlaceholder: '',
    hint: '不需要 Key。抓 DuckDuckGo，失败再抓 Bing。国内经常超时。',
  },
];

const PROVIDERS = new Set(SEARCH_PRESETS.map((p) => p.provider));

export function searchPreset(provider) {
  return SEARCH_PRESETS.find((p) => p.provider === provider) || SEARCH_PRESETS[0];
}

/**
 * 当前 AI 渠道是否官方 DeepSeek（用于复用它的 Key 调 Search API）。
 * 必须按 hostname 精确匹配：https://api.deepseek.com/... 是官方，
 * evilapi.deepseek.com、api.deepseek.com.evil.com、proxy.com/api.deepseek.com 都不是。
 */
export function isOfficialDeepSeek(apiConfig) {
  if (!apiConfig || !apiConfig.apiKey) return false;
  const raw = String(apiConfig.baseUrl || '').trim();
  if (!raw) return false;
  try {
    const host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
    return host === 'api.deepseek.com';
  } catch (_) {
    return false;
  }
}

export function normalizeSearchChannel(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const provider = PROVIDERS.has(c.provider) ? c.provider : 'tavily';
  const preset = searchPreset(provider);
  const id = String(c.id || '').trim()
    || ('sch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return {
    id,
    name: String(c.name || '').trim() || preset.label,
    provider,
    apiKey: preset.needsKey ? String(c.apiKey || '') : '',
    baseUrl: preset.needsBase ? String(c.baseUrl || '').trim().replace(/\/+$/, '') : '',
  };
}

function clip(s, n = 280) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + '…';
}

function pushItem(items, raw) {
  if (items.length >= 8) return;
  const url = String((raw && raw.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) return;
  if (items.some((it) => it.url === url)) return;
  const title = String((raw && raw.title) || '').trim() || url;
  items.push({ title, snippet: clip(raw && raw.snippet), url });
}

export function searchErrorMessage(data, status) {
  if (data && typeof data === 'object') {
    const nested = data.error && typeof data.error === 'object'
      ? (data.error.message || data.error.detail)
      : '';
    const msg = nested || data.message || data.msg || data.detail
      || (typeof data.error === 'string' ? data.error : '');
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return `HTTP ${status}`;
}

/** 把各家 JSON 收成 { title, snippet, url }。error 非空表示业务错误。 */
export function parseSearchPayload(provider, data) {
  const items = [];
  if (!data || typeof data !== 'object') return { items, error: '响应不是 JSON' };

  if (provider === 'bocha') {
    if (data.code != null && Number(data.code) !== 200) {
      return { items, error: String(data.msg || data.message || `错误 ${data.code}`) };
    }
    const pages = data.data && data.data.webPages && data.data.webPages.value;
    (Array.isArray(pages) ? pages : []).forEach((p) => {
      pushItem(items, { title: p.name, url: p.url, snippet: p.summary || p.snippet });
    });
    return { items, error: '' };
  }

  if (provider === 'tavily') {
    (Array.isArray(data.results) ? data.results : []).forEach((p) => {
      pushItem(items, { title: p.title, url: p.url, snippet: p.content });
    });
    return { items, error: items.length ? '' : (typeof data.error === 'string' ? data.error : '') };
  }

  if (provider === 'brave') {
    const web = data.web && data.web.results;
    (Array.isArray(web) ? web : []).forEach((p) => {
      pushItem(items, { title: p.title, url: p.url, snippet: p.description });
    });
    const msg = data.error && typeof data.error === 'object' ? (data.error.detail || data.error.message) : '';
    return { items, error: items.length ? '' : (msg || '') };
  }

  if (provider === 'serper') {
    (Array.isArray(data.organic) ? data.organic : []).forEach((p) => {
      pushItem(items, { title: p.title, url: p.link, snippet: p.snippet });
    });
    return { items, error: items.length ? '' : (typeof data.message === 'string' ? data.message : '') };
  }

  if (provider === 'exa') {
    (Array.isArray(data.results) ? data.results : []).forEach((p) => {
      const hl = Array.isArray(p.highlights) ? p.highlights.filter(Boolean).join(' ') : '';
      pushItem(items, { title: p.title, url: p.url, snippet: hl || p.text });
    });
    return { items, error: items.length ? '' : (typeof data.error === 'string' ? data.error : '') };
  }

  if (provider === 'searxng') {
    (Array.isArray(data.results) ? data.results : []).forEach((p) => {
      pushItem(items, { title: p.title, url: p.url, snippet: p.content });
    });
    return { items, error: '' };
  }

  return { items, error: '未知搜索类型' };
}

/** 需要 Key 的几家。html / deepseek 不走这里。 */
export function buildSearchRequest(channel, query) {
  const ch = normalizeSearchChannel(channel);
  const q = String(query || '').trim();
  const key = ch.apiKey;
  switch (ch.provider) {
    case 'tavily':
      return {
        url: 'https://api.tavily.com/search',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ query: q, search_depth: 'basic', max_results: 8, include_answer: false }),
        },
      };
    case 'brave': {
      const u = new URL('https://api.search.brave.com/res/v1/web/search');
      u.searchParams.set('q', q);
      u.searchParams.set('count', '8');
      return {
        url: u.toString(),
        init: {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        },
      };
    }
    case 'serper':
      return {
        url: 'https://google.serper.dev/search',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
          body: JSON.stringify({ q, num: 8 }),
        },
      };
    case 'exa':
      return {
        url: 'https://api.exa.ai/search',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key },
          body: JSON.stringify({
            query: q,
            numResults: 8,
            contents: { highlights: { maxCharacters: 400 } },
          }),
        },
      };
    case 'bocha':
      return {
        url: 'https://api.bochaai.com/v1/web-search',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ query: q, summary: true, freshness: 'noLimit', count: 8 }),
        },
      };
    case 'searxng': {
      const u = new URL(ch.baseUrl.replace(/\/+$/, '') + '/search');
      u.searchParams.set('q', q);
      u.searchParams.set('format', 'json');
      return { url: u.toString(), init: { method: 'GET', headers: { Accept: 'application/json' } } };
    }
    default:
      return null;
  }
}
