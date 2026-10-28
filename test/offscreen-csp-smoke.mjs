/* Offscreen DOMParser runs inside an extension page. Inline on* attributes
 * in fetched HTML trip script-src 'self' before selectors ever run. */

import assert from 'node:assert';
import { htmlWithoutInlineHandlers } from '../src/offscreen/sanitize-html.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const stripped = htmlWithoutInlineHandlers(`
<article onclick="track()">
  <h2><a href="/news/alpha" onclick="return true">Alpha headline</a></h2>
  <img src="/images/alpha.jpg" onerror="this.src='fallback.jpg'">
  <img/onerror=alert(1) src="/images/beta.jpg">
  <a href="http://cdn.example/onerror=1">keep</a>
  <div title="a>b" onclick="if(a>b)f()">quoted</div>
  <button ONCLICK='foo()'>Go</button>
</article>
<!-- <div onclick="stay">comment</div> -->
`);

const live = stripped.replace(/<!--[\s\S]*?-->/g, '');
ok(!/\son[a-z]+\s*=/i.test(live), '标签上的 on* 属性被去掉');
ok(!/\/onerror=alert/.test(live), '无空格的 /onerror 也被去掉');
ok(stripped.includes('href="/news/alpha"'), '普通 href 保留');
ok(stripped.includes('Alpha headline'), '文本保留');
ok(stripped.includes('src="/images/alpha.jpg"'), '图片 src 保留');
ok(stripped.includes('src="/images/beta.jpg"'), '斜杠分隔的 src 保留');
ok(stripped.includes('href="http://cdn.example/onerror=1"'), 'URL 里的 onerror= 不是事件属性');
ok(stripped.includes('title="a>b"'), '属性值里的 > 不截断标签');
ok(stripped.includes('quoted'), '带 > 的事件值不影响正文');
ok(stripped.includes("onclick=\"stay\""), '注释里的标记保持原样');
ok(htmlWithoutInlineHandlers('') === '', '空 HTML 原样返回');

console.log(`offscreen csp smoke: ${passed} passed`);
