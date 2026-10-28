/* Webpage -> feed recipe smoke: repeated-list discovery, field detection,
 * selector-based extraction, normalization and date/URL safety. */

import assert from 'node:assert';
import { parseHTML } from 'linkedom';
import {
  normalizeWebFeedRecipe,
  normalizeWebFeedItem,
  parseWebFeedDate,
  absoluteWebFeedUrl,
  normalizeWebpageRefreshMode,
} from '../src/lib/webfeed-recipe.js';
import {
  scanWebFeedCandidates,
  detectWebFeedFields,
  extractWebFeedItems,
  startWebFeedPicker,
  selectWebFeedCandidate,
  startWebFeedFieldPicker,
} from '../src/lib/webfeed.js';
import { extractWebpageItemsViaTab } from '../src/lib/webfeed-tab.js';
import { extractWebpageItemsViaHttp } from '../src/lib/webfeed-http.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const { document, window } = parseHTML(`<!doctype html><html><head><title>Example News</title></head><body>
  <nav><a href="/">Home</a><a href="/hot">Hot</a></nav>
  <main>
    <section class="news-list">
      <article class="news-card">
        <h2 class="card-title"><a href="/news/alpha">Alpha headline</a></h2>
        <div class="subtitle">Alpha subtitle</div>
        <p class="summary">Alpha summary is long enough to be picked up.</p>
        <time datetime="2026-01-02T08:30:00+08:00">Jan 2</time>
        <img src="/images/alpha.jpg" alt="alpha">
        <span class="author">Alice</span>
      </article>
      <article class="news-card">
        <h2 class="card-title"><a href="/news/beta">Beta headline</a></h2>
        <div class="subtitle">Beta subtitle</div>
        <p class="summary">Beta summary is also long enough to be picked up.</p>
        <time datetime="2026-01-03T09:00:00+08:00">Jan 3</time>
        <img src="https://cdn.example.com/beta.jpg" alt="beta">
        <span class="author">Bob</span>
      </article>
      <article class="news-card">
        <h2 class="card-title"><a href="/news/gamma">Gamma headline</a></h2>
        <div class="subtitle">Gamma subtitle</div>
        <p class="summary">Gamma summary is long enough for extraction.</p>
        <span class="author">Carol</span>
      </article>
    </section>
  </main>
</body></html>`);

const candidates = scanWebFeedCandidates(document);
ok(candidates.length >= 1, '自动发现至少一组重复条目');
const listCandidate = candidates.find((c) => c.selector.includes('article'));
ok(!!listCandidate && listCandidate.count === 3, '候选组包含 3 个 article 条目');
ok(listCandidate.selector.includes('.news-card'), '候选选择器保留稳定类名');

const fields = detectWebFeedFields(document.querySelector('article.news-card'), 'https://example.com/section');
ok(!!fields.fields.title && fields.samples.title === 'Alpha headline', '自动识别标题');
ok(fields.fields.link?.parts?.[0]?.attr === 'href' && fields.samples.link === 'https://example.com/news/alpha', '自动识别并绝对化链接');
ok(!!fields.fields.summary && fields.fields.summary.parts.length === 1, '自动识别摘要');
ok(fields.fields.date?.parts?.[0]?.attr === 'datetime', '自动识别 time[datetime] 日期');
ok(fields.samples.cover === 'https://example.com/images/alpha.jpg', '自动识别封面并绝对化');
ok(fields.samples.author === 'Alice', '自动识别作者');

const recipe = normalizeWebFeedRecipe({
  pageUrl: 'https://example.com/section',
  itemSelector: 'section.news-list > article.news-card',
  fields: {
    title: {
      parts: [
        { selector: 'h2.card-title a', attr: 'text', sample: 'not persisted' },
        { selector: 'div.subtitle', attr: 'text' },
      ],
      separator: ' / ',
    },
    link: { parts: [{ selector: 'h2.card-title a', attr: 'href' }] },
    summary: { parts: [{ selector: 'p.summary', attr: 'text' }] },
    date: { parts: [{ selector: 'time', attr: 'datetime' }] },
    cover: { parts: [{ selector: 'img', attr: 'image' }] },
    author: { parts: [{ selector: '.author', attr: 'text' }] },
  },
});
ok(recipe.fields.title.parts.length === 2, '多选字段保留两个合并片段');
ok(recipe.fields.title.parts[0].sample === undefined, 'sample 不进入持久化配方');

const result = extractWebFeedItems(recipe, document, { maxItems: 10, includeHidden: true });
ok(result.ok && result.items.length === 3, '按配方提取 3 条');
ok(result.items[0].title === 'Alpha headline / Alpha subtitle', '多选字段按分隔符合并');
ok(result.items[0].link === 'https://example.com/news/alpha', '相对链接绝对化');
ok(result.items[1].publishedAt === Date.parse('2026-01-03T09:00:00+08:00'), '日期解析正确');
ok(result.items[2].coverUrl === '' && result.items[2].preservePublishedAt === true, '无日期/封面条目安全降级');
ok(result.items[2].link === 'https://example.com/news/gamma', '无日期条目仍保留链接');

const noDateRecipe = {
  pageUrl: 'https://example.com/section',
  itemSelector: 'section.news-list > article.news-card',
  fields: {
    title: { parts: [{ selector: 'h2', attr: 'text' }] },
    link: { parts: [{ selector: 'h2 a', attr: 'href' }] },
  },
};
const noDate = extractWebFeedItems(noDateRecipe, document, { maxItems: 3, includeHidden: true });
ok(noDate.items.every((it) => it.publishedAt === 0), '没有日期字段时 publishedAt 为 0');
ok(noDate.warnings.some((w) => w.includes('没有日期')), '无日期时给出预览警告');

ok(parseWebFeedDate('2026-05-06') > 0, 'ISO 日期可解析');
ok(parseWebFeedDate('2026年5月6日') > 0, '中文日期可解析');
ok(parseWebFeedDate('2小时前') < Date.now(), '相对时间可解析');
ok(absoluteWebFeedUrl('/x', 'https://example.com/a') === 'https://example.com/x', 'URL 绝对化');
ok(absoluteWebFeedUrl('javascript:alert(1)', 'https://example.com') === '', '拒绝 javascript URL');

let badSelector = false;
try {
  normalizeWebFeedRecipe({ pageUrl: 'https://example.com', itemSelector: 'div; script', fields: {} });
} catch (_) { badSelector = true; }
ok(badSelector, '拒绝包含分号的非法选择器');

let badUrl = false;
try {
  normalizeWebFeedRecipe({ pageUrl: 'javascript:alert(1)', itemSelector: 'article', fields: {} });
} catch (_) { badUrl = true; }
ok(badUrl, '拒绝非 http(s) 网页地址');
ok(normalizeWebpageRefreshMode('http') === 'http' && normalizeWebpageRefreshMode('tab') === 'tab', '刷新方式 http/tab 可持久化');
ok(normalizeWebpageRefreshMode('unknown') === 'auto', '未知刷新方式回退 auto');

const item = normalizeWebFeedItem({
  title: '  Test  ', link: '/test', summary: 'hello\nworld', coverUrl: '/cover.png',
}, 'https://example.com');
ok(item.title === 'Test' && item.summary === 'hello world', '条目文本规范化');
ok(item.link === 'https://example.com/test' && item.coverUrl === 'https://example.com/cover.png', '条目链接/封面绝对化');


// Visual picker hand-off: side panel receives a persistable recipe after a
// candidate is chosen. Use linkedom + a tiny chrome.runtime mock.
Object.defineProperty(document, 'baseURI', { value: 'https://example.com/section', configurable: true });
globalThis.document = document;
const emitted = [];
globalThis.chrome = {
  runtime: {
    sendMessage: async (message) => { emitted.push(message); return { ok: true }; },
  },
};
const picker = startWebFeedPicker(document);
ok(picker.ok && picker.candidates.length >= 1, '页面选择器启动并返回候选');
const selected = selectWebFeedCandidate(picker.candidates[0].id);
ok(selected.ok, '可从侧栏选择候选组');
await new Promise((resolve) => setTimeout(resolve, 520));
const itemEvent = emitted.find((m) => m.type === 'WEBFEED_EVENT' && m.data?.event === 'item-selected');
ok(!!itemEvent, '选择候选后异步回传 item-selected');
ok(itemEvent.data.count === 3 && itemEvent.data.recipe.itemSelector.includes('article'), '回传条目数与可持久化配方');
ok(itemEvent.data.recipe.fields.title?.parts?.length > 0, '回传自动字段映射');


// Hidden-tab refresh path: background tab is created, extraction message is
// sent, result returned and tab always closed.
let created = 0;
let removed = 0;
let tabMessage = null;
globalThis.chrome = {
  tabs: {
    create: async () => { created += 1; return { id: 77 }; },
    get: async () => ({ id: 77, status: 'complete' }),
    sendMessage: async (_id, message) => {
      tabMessage = message;
      return { ok: true, items: [{ title: 'From tab', link: 'https://example.com/from-tab' }], matched: 1 };
    },
    remove: async () => { removed += 1; },
    onUpdated: { addListener() {}, removeListener() {} },
  },
};
const tabResult = await extractWebpageItemsViaTab(noDateRecipe, { settleMs: 0, maxItems: 5 });
ok(created === 1 && removed === 1, '隐藏标签页刷新后必定关闭');
ok(tabMessage?.type === 'WEBFEED_EXTRACT' && tabMessage.recipe.itemSelector.includes('article'), '后台标签页接收持久化配方');
ok(tabResult.items[0].title === 'From tab' && tabResult.matched === 1, '后台标签页返回抓取结果');


// Hierarchy navigation: click picks the leaf, ArrowUp climbs to its card,
// Enter confirms the item group instead of auto-committing on the first click.
const picker2 = startWebFeedPicker(document);
ok(picker2.ok, '第二次启动层级选择器');
const h2 = document.querySelector('article.news-card h2');
const host2 = document.querySelector('#citecat-webfeed-picker-host');
host2?.shadowRoot?.querySelector('#wf-quick-toggle')?.click();
h2.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
const currentCrumb = () => host2?.shadowRoot?.querySelector('#wf-crumbs .wf-crumb.current')?.textContent || '';
ok(h2.classList.contains('citecat-wf-active-target'), '单击后进入选中态而不立即提交');
ok(currentCrumb().includes('card-title') || currentCrumb().includes('h2'), '面包屑显示当前叶子节点');
const up = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(up, 'key', { value: 'ArrowUp' });
document.dispatchEvent(up);
const article = document.querySelector('article.news-card');
ok(article.classList.contains('citecat-wf-active-target'), 'ArrowUp 上钻到父级卡片');
ok(currentCrumb().includes('news-card') || currentCrumb().includes('article'), '面包屑随层级上钻更新');
const enter = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(enter, 'key', { value: 'Enter' });
document.dispatchEvent(enter);
await new Promise((resolve) => setTimeout(resolve, 520));
const hierarchyEvent = emitted.filter((m) => m.type === 'WEBFEED_EVENT' && m.data?.event === 'item-selected').pop();
ok(hierarchyEvent?.data?.count === 3 && hierarchyEvent.data.recipe.itemSelector.includes('article'), 'Enter 后才确认条目模板');


// EasySpider-style "child elements as a list": click the list container,
// then let the picker turn its repeated children into the item group.
const picker3 = startWebFeedPicker(document);
const container = document.querySelector('section.news-list');
container.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
const host3 = document.querySelector('#citecat-webfeed-picker-host');
host3?.shadowRoot?.querySelector('#wf-child-group')?.click();
await new Promise((resolve) => setTimeout(resolve, 520));
const childGroupEvent = emitted.filter((m) => m.type === 'WEBFEED_EVENT' && m.data?.event === 'item-selected').pop();
ok(childGroupEvent?.data?.count === 3 && childGroupEvent.data.recipe.itemSelector.includes('article.news-card'), '子元素组可直接把容器转成列表');
ok(!childGroupEvent?.data?.recipe?.itemSelector?.includes('citecat-wf-'), '临时高亮 class 不会污染最终选择器');


// Field hierarchy: start from the item template, ArrowDown to the first
// child, ArrowRight to its sibling summary, then Enter to confirm.
globalThis.chrome = { runtime: { sendMessage: async (message) => { emitted.push(message); return { ok: true }; } } };
const fieldPicker = startWebFeedFieldPicker({
  field: 'summary',
  multi: false,
  recipe: childGroupEvent.data.recipe,
});
ok(fieldPicker.ok && fieldPicker.matched === 3, '字段选择器从条目模板开始');
const down = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(down, 'key', { value: 'ArrowDown' });
document.dispatchEvent(down);
const right = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(right, 'key', { value: 'ArrowRight' });
document.dispatchEvent(right);
const fieldHost = document.querySelector('#citecat-webfeed-picker-host');
const fieldCrumb = fieldHost?.shadowRoot?.querySelector('#wf-crumbs .wf-crumb.current')?.textContent || '';
ok(fieldCrumb.includes('subtitle') || fieldCrumb.includes('p'), '字段模式可用 ↓/→ 定位到摘要子元素');
const fieldEnter = new window.Event('keydown', { bubbles: true, cancelable: true });
Object.defineProperty(fieldEnter, 'key', { value: 'Enter' });
document.dispatchEvent(fieldEnter);
const fieldEvent = emitted.filter((m) => m.type === 'WEBFEED_EVENT' && m.data?.event === 'field-selected').pop();
ok(fieldEvent?.data?.field === 'summary' && fieldEvent.data.parts?.[0]?.selector, 'Enter 后回传摘要字段选择器');

// Direct multi-select: in quick mode each click adds the exact element; a
// second click on the same element removes it; Done returns all fragments.
const multiFieldPicker = startWebFeedFieldPicker({
  field: 'title',
  multi: true,
  recipe: childGroupEvent.data.recipe,
});
ok(multiFieldPicker.ok, '启动多选字段点选模式');
const multiH2 = document.querySelector('article.news-card h2');
const multiSubtitle = document.querySelector('article.news-card div.subtitle');
multiH2.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
ok(multiH2.classList.contains('citecat-wf-field-selected'), '第一次点击加入多选片段');
multiH2.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
ok(!multiH2.classList.contains('citecat-wf-field-selected'), '再次点击移除多选片段');
multiH2.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
multiSubtitle.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
const multiHost = document.querySelector('#citecat-webfeed-picker-host');
ok(!!multiHost && multiHost.shadowRoot?.querySelector('#wf-done')?.style.display !== 'none', '多选点击后保持选择器并显示完成');
multiHost?.shadowRoot?.querySelector('#wf-done')?.click();
const multiEvent = emitted.filter((m) => m.type === 'WEBFEED_EVENT' && m.data?.event === 'field-selected').pop();
ok(multiEvent?.data?.multi === true && multiEvent.data.parts?.length === 2, '直接点击可合并多个元素');


// HTTP transport: fetch runs in the worker, HTML is handed to the offscreen
// parser, and the same recipe is used without creating any tab.
let offscreenMessage = null;
let fetchCall = null;
const realFetch = globalThis.fetch;
globalThis.chrome = {
  runtime: {
    getURL: (path) => 'chrome-extension://test/' + path,
    getContexts: async () => [{ documentUrl: 'chrome-extension://test/src/offscreen/index.html' }],
    sendMessage: async (message) => {
      offscreenMessage = message;
      return {
        ok: true,
        items: [{ title: 'HTTP item', link: 'https://example.com/http-item' }],
        matched: 1,
        warnings: [],
      };
    },
  },
  offscreen: { createDocument: async () => {} },
};
globalThis.fetch = async (url, opts) => {
  fetchCall = { url, opts };
  return new Response('<!doctype html><html><body><article class="card"></article></body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};
const httpResult = await extractWebpageItemsViaHttp(noDateRecipe, { maxItems: 5 });
ok(httpResult.transport === 'http' && httpResult.items[0].title === 'HTTP item', 'HTTP 模式通过 offscreen 解析 HTML');
ok(offscreenMessage?.type === 'WEBFEED_PARSE_HTML' && offscreenMessage.recipe.itemSelector.includes('article'), 'HTTP 模式复用网页源配方');
ok(fetchCall?.opts?.credentials === 'include', 'HTTP 抓取携带登录 Cookie');
globalThis.fetch = realFetch;

console.log(`webfeed-smoke: ${passed} passed`);
