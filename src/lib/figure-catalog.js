/**
 * 正文图的编号规则。读页面时定死地址和顺序，之后只按编号取，不做子串匹配。
 * 纯函数，content script 与冒烟测试共用。
 */

export const FIGURE_MAX = 12;

const TRACKING = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid',
]);

export function absUrl(raw, base) {
  const s = String(raw || '').trim();
  if (!s || s.startsWith('blob:')) return '';
  if (s.startsWith('data:')) {
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s) && s.length > 256) return s;
    return '';
  }
  try { return new URL(s, base || undefined).href; } catch (_) { return ''; }
}

/** 去掉 hash 和常见追踪参数，用来判断是不是同一张图。 */
export function imageUrlKey(raw, base) {
  const abs = absUrl(raw, base) || String(raw || '').trim();
  if (!abs || abs.startsWith('data:')) return abs;
  try {
    const url = new URL(abs);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch (_) {
    return abs;
  }
}

export function sameImageUrl(a, b, base) {
  const ka = imageUrlKey(a, base);
  const kb = imageUrlKey(b, base);
  return !!(ka && kb && ka === kb);
}

export function largestFromSrcset(srcset, base) {
  let best = '';
  let bestN = -1;
  for (const part of String(srcset || '').split(',')) {
    const bits = part.trim().split(/\s+/);
    if (!bits[0]) continue;
    const desc = bits[1] || '';
    let n = 0;
    if (/^\d+w$/i.test(desc)) n = parseInt(desc, 10);
    else if (/^\d+(?:\.\d+)?x$/i.test(desc)) n = parseFloat(desc) * 10000;
    if (n >= bestN) {
      bestN = n;
      best = bits[0];
    }
  }
  return absUrl(best, base);
}

/**
 * 定死这一张图的地址：已显示的 currentSrc，其次懒加载，其次 srcset 里最大的一档。
 * @param {{ currentSrc?: string, src?: string, srcset?: string, dataSrc?: string }} img
 */
export function resolveImageUrl(img, base) {
  const cur = absUrl(img && img.currentSrc, base);
  if (cur && !/1x1|spacer|pixel\.gif|blank\.gif|transparent\.gif/i.test(cur)) return cur;
  const lazy = absUrl(img && img.dataSrc, base);
  if (lazy) return lazy;
  const fromSet = largestFromSrcset(img && img.srcset, base);
  if (fromSet) return fromSet;
  return absUrl(img && img.src, base);
}

export function figureCaption({ figcaption = '', alt = '' } = {}) {
  const cap = String(figcaption || '').replace(/\s+/g, ' ').trim();
  if (cap) return cap.slice(0, 180);
  return String(alt || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

/** place_images 的 figs 参数。n=0 是封面，其余是正文编号。缺编号的丢掉。 */
export function normalizeFigs(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null) continue;
    const n = Number(typeof item === 'number' ? item : item.n);
    if (!Number.isInteger(n) || n < 0 || n > FIGURE_MAX) continue;
    out.push({
      n,
      tab_id: Number(item && item.tab_id) || 0,
      url: String((item && item.url) || '').trim(),
    });
    if (out.length >= 8) break;
  }
  return out;
}
