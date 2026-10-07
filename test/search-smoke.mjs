/* 搜索解析冒烟（node test/search-smoke.mjs）。不碰网络、不碰 chrome。 */

import assert from 'node:assert';
import { extractWebSearchResults, extractOutputText } from '../src/lib/ai-client.js';
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
  normalizeSearchChannel, buildSearchRequest, parseSearchPayload, searchPreset,
} from '../src/lib/search-providers.js';

const tavilyCh = normalizeSearchChannel({ name: 'Tavily 主力', provider: 'tavily', apiKey: 'tvly-test' });
ok(tavilyCh.provider === 'tavily' && tavilyCh.apiKey === 'tvly-test', 'Tavily 渠道保留 Key');
ok(normalizeSearchChannel({ provider: 'html', apiKey: 'nope' }).apiKey === '', '网页抓取不存 Key');
ok(searchPreset('bocha').needsKey === true && searchPreset('searxng').needsBase === true, '博查要 Key，SearXNG 要地址');

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
