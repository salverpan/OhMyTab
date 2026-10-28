/* 搜索解析冒烟（node test/search-smoke.mjs）。不碰网络、不碰 chrome。 */

import assert from 'node:assert';
import {
  extractWebSearchResults, extractOutputText,
  deriveSearchToolsUrl, buildDeepseekSearchBody,
  parseDeepseekSearchResults, formatDeepseekSearchResults,
  deepseekSearch,
} from '../src/lib/ai-client.js';
import { parseDuckDuckGoHtml, parseBingHtml, formatSearchSnippets } from '../src/lib/search-html.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const documented = {
  output: [
    {
      type: 'web_search_call',
      id: 'ws_1',
      status: 'completed',
      action: { type: 'search', query: 'weather' },
    },
    {
      type: 'web_search_call',
      id: 'ws_2',
      status: 'completed',
      action: { type: 'open_page', url: 'https://weather.com/today' },
    },
    {
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Latest forecast is on [Weather.com](https://weather.com/today).',
        annotations: [{
          type: 'url_citation',
          url: 'https://weather.com/today',
          title: 'Weather.com forecast',
        }],
      }],
    },
  ],
};

const hits = extractWebSearchResults(documented);
ok(hits && hits.some((h) => h.url === 'https://weather.com/today'), '文档形态 web_search_call 无 results 也能抽出 URL');
ok(hits.some((h) => h.title === 'Weather.com forecast' || h.title === 'Weather.com'), 'citation / markdown 标题可取');
ok(extractOutputText(documented).includes('Weather.com'), 'output_text 可取');

const legacy = extractWebSearchResults({
  output: [{
    type: 'web_search_call',
    results: [{ title: 'A', url: 'https://a.example', text: 'sn' }],
  }],
});
ok(legacy && legacy[0].url === 'https://a.example', '旧 results 数组仍可用');

ok(extractWebSearchResults({ output: [{ type: 'web_search_call', action: { type: 'search', query: 'x' } }] }) === null,
  '只有 query、没有任何 URL 时返回 null');

/* ===== DeepSeek Search API（/v1/tools/search） ===== */

ok(deriveSearchToolsUrl('https://api.deepseek.com/chat/completions') === 'https://api.deepseek.com/v1/tools/search',
  'Search URL：chat/completions');
ok(deriveSearchToolsUrl('https://api.deepseek.com/v1/chat/completions') === 'https://api.deepseek.com/v1/tools/search',
  'Search URL：v1/chat/completions 不重复 /v1');
ok(deriveSearchToolsUrl('https://api.deepseek.com/anthropic/') === 'https://api.deepseek.com/v1/tools/search',
  'Search URL：Anthropic 兼容层');
ok(deriveSearchToolsUrl('https://api.deepseek.com/v1') === 'https://api.deepseek.com/v1/tools/search',
  'Search URL：/v1 根地址');

const dsBody = buildDeepseekSearchBody(' 无人机 ', { count: 99, needContent: true });
ok(dsBody.query === '无人机' && dsBody.count === 50 && dsBody.need_content === true,
  'Search 请求体：query 去空白、count 夹到 50、need_content=true');
ok(buildDeepseekSearchBody('x', { count: 0, needContent: false }).count === 1,
  'Search 请求体：count 最小 1');

const dsPayload = {
  results: [
    {
      rerank_score: 2.4,
      title: 'A',
      url: 'https://a.example',
      snippet: 'sn A',
      summary: 'sum A',
      content: '# A\n- item\nbody A',
      date: '2026-06-01T00:00:00+00:00',
      authority: 3,
      site_name: 'Example',
    },
    { rerank_score: 3.1, title: 'C', url: 'https://c.example', snippet: 'sn C', authority: -1 },
    { rerank_score: 9, title: 'bad', url: 'javascript:alert(1)' },
    { rerank_score: 2.0, title: 'dup', url: 'https://a.example' },
  ],
};
const dsHits = parseDeepseekSearchResults(dsPayload, 10);
ok(dsHits.length === 2, 'Search 结果：过滤非 http URL 和重复 URL');
ok(dsHits[0].url === 'https://c.example', 'Search 结果：按 rerank_score 降序');
ok(dsHits[1].summary === 'sum A' && dsHits[1].content.includes('- item'),
  'Search 结果：summary/content 保留');
ok(dsHits[1].date === '2026-06-01T00:00:00+00:00' && dsHits[1].authority === 3,
  'Search 结果：date/authority 保留');
ok(parseDeepseekSearchResults({ results: [] }).length === 0, 'Search 结果：空 results 为空数组');
const dedup = parseDeepseekSearchResults({
  results: [
    { rerank_score: 1, title: 'low', url: 'https://dup.example' },
    { rerank_score: 3, title: 'high', url: 'https://dup.example' },
  ],
});
ok(dedup.length === 1 && dedup[0].title === 'high', 'Search 结果：重复 URL 保留高分一条');

const dsText = formatDeepseekSearchResults(dsHits);
ok(dsText.includes('URL：https://c.example') && dsText.includes('正文：'),
  'Search 格式化：URL 与正文都在');
ok((dsText.match(/^- /gm) || []).length === 2,
  'Search 格式化：正文里的 - 列表不误计条数');
ok(formatDeepseekSearchResults([]) === '', 'Search 格式化：空结果为空串');

/* 桩 fetch：确认真实调用串（地址/鉴权/need_content/正文回传） */
const realFetch = globalThis.fetch;
let dsReq = null;
globalThis.fetch = async (url, init) => {
  dsReq = { url, init, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({
    results: [{
      rerank_score: 2.1,
      title: '端到端',
      url: 'https://e2e.example',
      summary: 'summary',
      content: 'FULL CONTENT',
      authority: 2,
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
try {
  const out = await deepseekSearch('无人机', {
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com/chat/completions',
  }, { count: 3, needContent: true });
  ok(dsReq.url === 'https://api.deepseek.com/v1/tools/search', 'deepseekSearch：请求新 Search 端点');
  ok(dsReq.init.headers.Authorization === 'Bearer test-key', 'deepseekSearch：Bearer Key');
  ok(dsReq.body.query === '无人机' && dsReq.body.count === 3 && dsReq.body.need_content === true,
    'deepseekSearch：请求体带 need_content');
  ok(out.includes('https://e2e.example') && out.includes('FULL CONTENT'), 'deepseekSearch：正文回传');
} finally {
  globalThis.fetch = realFetch;
}

const ddg = parseDuckDuckGoHtml(`
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example Title</a>
  <a class="result__snippet">A short blurb</a>
`);
ok(ddg.length === 1 && ddg[0].url === 'https://example.com/page' && ddg[0].title === 'Example Title', 'DDG 解析 uddg');

const bing = parseBingHtml(`
<ol id="b_results">
<li class="b_algo"><h2><a href="https://nmc.cn/forecast">NMC 预报</a></h2>
<div class="b_caption"><p class="b_lineclamp2">今日晴</p></div></li>
<li class="b_algo"><h2><a href="javascript:void(0)">skip</a></h2></li>
</ol>
`);
ok(bing.length === 1 && bing[0].url === 'https://nmc.cn/forecast' && /晴/.test(bing[0].snippet), 'Bing b_algo 解析');
ok(formatSearchSnippets(bing).includes('https://nmc.cn/forecast'), 'snippet 格式含 URL');

import {
  normalizeSearchChannel, buildSearchRequest, parseSearchPayload, searchPreset, isOfficialDeepSeek,
} from '../src/lib/search-providers.js';

const tavilyCh = normalizeSearchChannel({ name: 'Tavily 主力', provider: 'tavily', apiKey: 'tvly-test' });
ok(tavilyCh.provider === 'tavily' && tavilyCh.apiKey === 'tvly-test', 'Tavily 渠道保留 Key');
ok(normalizeSearchChannel({ provider: 'html', apiKey: 'nope' }).apiKey === '', '网页抓取不存 Key');
ok(searchPreset('bocha').needsKey === true && searchPreset('searxng').needsBase === true, '博查要 Key，SearXNG 要地址');

/* 官方 DeepSeek 判定：必须按 hostname 精确匹配 */
const dsCfg = (baseUrl, apiKey = 'sk-test') => ({ apiKey, baseUrl });
ok(isOfficialDeepSeek(dsCfg('https://api.deepseek.com/chat/completions')), '官方 DeepSeek：默认 https 地址');
ok(isOfficialDeepSeek(dsCfg('https://api.deepseek.com/v1')), '官方 DeepSeek：/v1 根地址');
ok(isOfficialDeepSeek(dsCfg('https://api.deepseek.com/anthropic')), '官方 DeepSeek：Anthropic 兼容层');
ok(isOfficialDeepSeek(dsCfg('api.deepseek.com/chat/completions')), '官方 DeepSeek：无协议地址');
ok(isOfficialDeepSeek(dsCfg('https://API.DEEPSEEK.COM/x')), '官方 DeepSeek：大小写不敏感');
ok(!isOfficialDeepSeek(dsCfg('https://evilapi.deepseek.com/x')), '非官方：子域名伪装');
ok(!isOfficialDeepSeek(dsCfg('https://api.deepseek.com.evil.com/x')), '非官方：域名后缀伪装');
ok(!isOfficialDeepSeek(dsCfg('https://proxy.com/api.deepseek.com/x')), '非官方：路径里出现域名');
ok(!isOfficialDeepSeek(dsCfg('https://api.deepseek.com/chat/completions', '')), '无 Key 不算官方渠道');

const tavilyReq = buildSearchRequest(tavilyCh, 'drone');
ok(tavilyReq.url === 'https://api.tavily.com/search', 'Tavily 地址');
ok(tavilyReq.init.headers.Authorization === 'Bearer tvly-test', 'Tavily 用 Bearer');
ok(!tavilyReq.url.includes('tvly-test'), 'Key 不出现在 URL');

const tavilyHits = parseSearchPayload('tavily', {
  results: [
    { title: 'Reuters', url: 'https://www.reuters.com/a', content: 'A story' },
    { title: 'skip', url: 'javascript:alert(1)', content: 'no' },
  ],
});
ok(tavilyHits.items.length === 1 && tavilyHits.items[0].url.includes('reuters.com'), 'Tavily 只留 http 链接');

const braveHits = parseSearchPayload('brave', {
  web: { results: [{ title: 'BBC', url: 'https://bbc.com/n', description: 'brief' }] },
});
ok(braveHits.items[0].snippet === 'brief', 'Brave 摘要');

const serperHits = parseSearchPayload('serper', {
  organic: [{ title: 'FT', link: 'https://ft.com/x', snippet: 'markets' }],
});
ok(serperHits.items[0].url === 'https://ft.com/x', 'Serper 用 link 字段');

const exaHits = parseSearchPayload('exa', {
  results: [{ title: 'Exa', url: 'https://example.com/e', highlights: ['one', 'two'] }],
});
ok(exaHits.items[0].snippet === 'one two', 'Exa 拼接 highlights');

const bochaHits = parseSearchPayload('bocha', {
  code: 200,
  data: { webPages: { value: [{ name: '财新', url: 'https://caixin.com/a', snippet: '短', summary: '更长的摘要' }] } },
});
ok(bochaHits.items[0].title === '财新' && bochaHits.items[0].snippet === '更长的摘要', '博查优先用 summary');
ok(parseSearchPayload('bocha', { code: 401, msg: 'bad key' }).error === 'bad key', '博查业务错误');

const sx = buildSearchRequest({ provider: 'searxng', baseUrl: 'https://searx.example/' }, 'uav');
ok(sx.url.startsWith('https://searx.example/search?'), 'SearXNG 拼在根地址后');

console.log(`search-smoke: ${passed} ok`);
