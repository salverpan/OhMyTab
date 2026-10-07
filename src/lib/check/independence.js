/**
 * 独立信源计数。
 *
 * 只按网站域名计数会把转载算成交叉印证：雅虎转路透、五家媒体引同一份国防部声明，
 * 在情报上都只算一个来源（循环报道）。这里做两步归并：
 *   1. 身份：发布方名称优先，其次可注册主域名（news.bbc.co.uk 与 bbc.co.uk 同源）。
 *   2. 文本：不同身份但引文几乎一样（通稿 / 转载），视为同一原始来源。
 */

import { normalizeQuoteText } from './quote-match.js';

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'mil', 'or', 'ne', 'go']);
const SYNDICATION_JACCARD = 0.6;
const MIN_QUOTE_CHARS = 24;

export function registrableDomain(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!host || /^\d+(\.\d+){3}$/.test(host)) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld.length === 2 && SECOND_LEVEL.has(sld)) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export function normalizePublisher(name) {
  return String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·・.,，。"'“”‘’()（）-]+/g, '')
    .trim();
}

/** 证据的来源身份：`pub:<发布方>` 或 `dom:<主域名>`，都取不到时回落 doc 级 id。 */
export function sourceIdentityOf({ publisher = '', url = '', fallback = '' } = {}) {
  const pub = normalizePublisher(publisher);
  if (pub) return `pub:${pub}`;
  try {
    if (url) return `dom:${registrableDomain(new URL(url).hostname)}`;
  } catch (_) { /* ignore */ }
  return fallback ? `doc:${fallback}` : '';
}

function shingles(text, n = 3) {
  const t = normalizeQuoteText(text).toLowerCase().replace(/\s+/g, '');
  const out = new Set();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n));
  return out;
}

export function quoteSimilarity(a, b) {
  const na = normalizeQuoteText(a).toLowerCase();
  const nb = normalizeQuoteText(b).toLowerCase();
  if (!na || !nb) return 0;
  if (na.length >= MIN_QUOTE_CHARS && nb.length >= MIN_QUOTE_CHARS && (na.includes(nb) || nb.includes(na))) return 1;
  const sa = shingles(na);
  const sb = shingles(nb);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

/**
 * @param {Array<{sourceIdentity?: string, evidence?: {quote?: string}}>} passed 已通过引文核验的证据
 * @returns {{count: number, groups: string[][]}} 独立来源数与每组包含的身份
 */
export function independentSources(passed = []) {
  const items = (passed || []).filter((e) => e && e.sourceIdentity);
  const ids = [...new Set(items.map((e) => e.sourceIdentity))];
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.sourceIdentity === b.sourceIdentity) continue;
      const qa = a.evidence && a.evidence.quote;
      const qb = b.evidence && b.evidence.quote;
      if (qa && qb && quoteSimilarity(qa, qb) >= SYNDICATION_JACCARD) union(a.sourceIdentity, b.sourceIdentity);
    }
  }
  const groups = new Map();
  for (const id of ids) {
    const r = find(id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(id);
  }
  return { count: groups.size, groups: [...groups.values()] };
}
