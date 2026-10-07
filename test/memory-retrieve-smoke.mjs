/**
 * agent-memory.js 站点前缀检索回归。
 * 跑：node test/memory-retrieve-smoke.mjs
 */
import {
  rankMemories, inferHostPrefix, urlMatchesPrefix, siteKeysFromUrl, memoryMatchesSite,
  formatMemoriesBlock,
} from '../src/lib/agent-memory.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  }
}

const bili = {
  id: 'mem-bili', domain: 'bilibili', lesson: '列表页用 exec_js 抽 .vui_card__title',
  tags: ['B站', 'bilibili'], importance: 5, accessCount: 1, createdAt: Date.now(),
};
const biliPrefixed = {
  ...bili, id: 'mem-bili-p',
  urlPrefixes: ['bilibili.com'],
  lesson: '带前缀的 B 站经验',
};
const biliVideo = {
  id: 'mem-video', domain: 'bilibili-video', lesson: '视频页走字幕接口',
  tags: ['字幕'], urlPrefixes: ['https://www.bilibili.com/video'],
  importance: 4, accessCount: 0, createdAt: Date.now(),
};
const general = {
  id: 'mem-gen', domain: 'general', lesson: '用户偏好简洁回复',
  tags: ['偏好'], importance: 3, accessCount: 0, createdAt: Date.now(),
};
const gov = {
  id: 'mem-gov', domain: 'government-site', lesson: '政务站先点同意再抓',
  tags: ['政务'], urlPrefixes: ['www.mof.gov.cn'],
  importance: 4, accessCount: 0, createdAt: Date.now(),
};

const biliUrl = 'https://www.bilibili.com/video/BV1xx411c7mD';
const biliHome = 'https://www.bilibili.com/';
const otherUrl = 'https://example.com/foo';

// 1. 人在 B 站但消息不提站名 → 仍注入（旧记忆靠 domain 对齐 hostname）
{
  const r = rankMemories([bili, general], '帮我提取标题', biliUrl);
  assert(r.some((m) => m.id === 'mem-bili' && m.siteMatch), 'on-site without saying site name should inject bili');
  assert(!r.some((m) => m.id === 'mem-gen'), 'general must not bind just because we are on a site');
}

// 2. 离开站点、消息也不提 → 不注入
{
  const r = rankMemories([bili], '帮我提取标题', otherUrl);
  assert(r.length === 0, 'off-site generic query should not inject bili');
}

// 3. 离站但用户提到 B站 tag → 仍注入
{
  const r = rankMemories([bili], 'B站怎么抽列表', otherUrl);
  assert(r.some((m) => m.id === 'mem-bili'), 'tag hit off-site should still inject');
  assert(!r[0].siteMatch, 'off-site tag hit is not siteMatch');
}

// 4. url_prefixes 路径：视频页命中，首页不命中路径前缀
{
  const infoVideo = siteKeysFromUrl(biliUrl);
  const infoHome = siteKeysFromUrl(biliHome);
  assert(urlMatchesPrefix(infoVideo, 'https://www.bilibili.com/video'), 'video path should match');
  assert(!urlMatchesPrefix(infoHome, 'https://www.bilibili.com/video'), 'home should not match /video prefix');
  const onVideo = rankMemories([biliVideo], '提取字幕', biliUrl);
  const onHome = rankMemories([biliVideo], '提取字幕', biliHome);
  assert(onVideo.some((m) => m.id === 'mem-video' && m.siteMatch), 'video page injects path-prefix memory');
  assert(!onHome.some((m) => m.id === 'mem-video' && m.siteMatch), 'home does not site-match /video prefix');
}

// 5. 站点+tag 排在仅站点命中之前
{
  const siteOnly = { ...biliPrefixed, id: 'mem-site-only', lesson: '随便一条站内经验', tags: [] };
  const siteAndTag = { ...biliPrefixed, id: 'mem-site-tag', tags: ['标题'] };
  const r = rankMemories([siteOnly, siteAndTag], '提取标题', biliUrl);
  assert(r[0].id === 'mem-site-tag', 'site+tag should rank first');
  assert(r[1].id === 'mem-site-only', 'site-only second');
}

// 6. 子域 / 去 www
{
  const info = siteKeysFromUrl('https://m.bilibili.com/video/123');
  assert(memoryMatchesSite(biliPrefixed, info), 'm.bilibili.com matches prefix bilibili.com');
  assert(memoryMatchesSite(bili, info), 'm.bilibili.com aligns domain=bilibili');
}

// 7. inferHostPrefix：站点 domain 才绑，general 不绑
{
  assert(inferHostPrefix('bilibili', ['B站'], biliUrl) === 'bilibili.com', 'infer host for bili domain');
  assert(inferHostPrefix('general', ['偏好'], biliUrl) === '', 'do not infer host for general');
  assert(inferHostPrefix('government-site', ['政务'], 'https://www.mof.gov.cn/xxgk/') === '', 'unaligned generic domain does not infer');
}

// 8. 显式前缀的政务站命中
{
  const r = rankMemories([gov, general], '把表格抓下来', 'https://www.mof.gov.cn/xxgk/list.html');
  assert(r.some((m) => m.id === 'mem-gov' && m.siteMatch), 'gov prefix should inject on that host');
}

// 9. 注入文本格式（主助手与子代理共用）
{
  const block = formatMemoriesBlock([{ domain: 'bilibili', lesson: '抽标题', siteMatch: true }]);
  assert(block.includes('### 相关经验记忆'), 'heading present');
  assert(block.includes('[bilibili]') && block.includes('[当前站]') && block.includes('抽标题'), 'site-marked lesson');
  assert(formatMemoriesBlock([]) === '' && formatMemoriesBlock(null) === '', 'empty memories yield empty block');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('memory-retrieve-smoke: ok');
