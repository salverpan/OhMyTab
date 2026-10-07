/**
 * 搜索结果页 HTML 解析（无 chrome）。DuckDuckGo / Bing SERP 结构变化时只改这里。
 */

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&ensp;/g, ' ').replace(/&#0183;/g, '·').replace(/\s+/g, ' ').trim();
}

export function formatSearchSnippets(items) {
  return (items || []).map((it) => `- ${it.title}\n  ${it.snippet || '(无摘要)'}\n  ${it.url}`).join('\n\n');
}

export function parseDuckDuckGoHtml(html) {
  const items = [];
  const re = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && items.length < 10) {
    let url = m[1];
    const uddg = /[?&]uddg=([^&]+)/.exec(url);
    if (uddg) {
      try { url = decodeURIComponent(uddg[1]); } catch (_) {}
    }
    if (url.startsWith('//')) url = 'https:' + url;
    const title = stripTags(m[2]);
    const snippet = stripTags(m[3]);
    if (title && url) items.push({ title, snippet, url });
  }
  return items;
}

export function parseBingHtml(html) {
  const items = [];
  const blockRe = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  let block;
  while ((block = blockRe.exec(html)) && items.length < 10) {
    const chunk = block[0];
    const a = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
    if (!a) continue;
    const url = a[1].replace(/&amp;/g, '&');
    if (!/^https?:\/\//i.test(url)) continue;
    if (/bing\.com\/ck\//i.test(url) || /microsoftonline\.com/i.test(url)) continue;
    const title = stripTags(a[2]);
    const cap = /<p class="b_lineclamp2"[^>]*>([\s\S]*?)<\/p>/i.exec(chunk)
      || /<div class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i.exec(chunk);
    const snippet = cap ? stripTags(cap[1]) : '';
    if (title && url) items.push({ title, snippet, url });
  }
  return items;
}
