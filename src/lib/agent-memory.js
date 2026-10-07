/**
 * AI 经验记忆：纯函数（站点前缀匹配 + 检索排序）。
 * 存储 I/O 仍在 chat-executor.js（chrome.storage.local.agentMemories）。
 *
 * 检索优先级（高 → 低）：
 *   1. 当前页 URL 命中记忆的 urlPrefixes，且用户文本命中 domain/tags
 *   2. 仅 URL 命中（人在这个站上，即使消息里没提站名）
 *   3. 仅文本命中 domain/tags/lesson（跨站可迁移的经验）
 *
 * 旧记忆没有 urlPrefixes 时：domain/tags 能对上当前 hostname
 *（bilibili ↔ www.bilibili.com）也算站点命中。
 */

const GENERIC_DOMAINS = new Set([
  'general', 'form-filling', 'form_filling', 'preference',
  'user-preference', 'workflow', '通用',
]);

export function calcRelevance(m) {
  const ageDays = (Date.now() - (m.lastAccessed || m.createdAt || 0)) / 86400000;
  const decay = Math.pow(0.95, ageDays);
  const accessBoost = Math.log2(1 + (m.accessCount || 0));
  return (m.importance || 3) * decay * (1 + accessBoost);
}

export function normalizeSitePrefix(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/\/+$/, '');
}

/** hostname / eTLD+1 / 首段标签，供旧记忆的 domain/tags 对齐当前站。 */
export function siteKeysFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return { href: '', host: '', hostNoWww: '', pathname: '', keys: [] };
  }
  let href = url.trim();
  try {
    const u = new URL(href);
    if (!/^https?:$/i.test(u.protocol)) {
      return { href, host: '', hostNoWww: '', pathname: '', keys: [] };
    }
    const host = u.hostname.toLowerCase();
    const hostNoWww = host.replace(/^www\./, '');
    const pathname = u.pathname || '/';
    const labels = hostNoWww.split('.').filter(Boolean);
    const keys = new Set([host, hostNoWww]);
    if (labels.length >= 2) keys.add(labels.slice(-2).join('.'));
    if (labels[0] && labels[0].length >= 3) keys.add(labels[0]);
    return { href: u.href.toLowerCase(), host, hostNoWww, pathname, keys: [...keys] };
  } catch {
    return { href, host: '', hostNoWww: '', pathname: '', keys: [] };
  }
}

export function urlMatchesPrefix(urlInfo, prefix) {
  const p = normalizeSitePrefix(prefix);
  if (!p || !urlInfo || !urlInfo.href) return false;
  if (urlInfo.href === p || urlInfo.href.startsWith(p + '/') || urlInfo.href.startsWith(p + '?')) return true;
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return urlInfo.href.startsWith(p);
  }
  const slash = p.indexOf('/');
  const prefixHost = (slash >= 0 ? p.slice(0, slash) : p).replace(/^www\./, '');
  const prefixPath = slash >= 0 ? p.slice(slash) : '';
  if (!prefixHost) return false;
  const hostNoWww = urlInfo.hostNoWww || '';
  const hostHit = hostNoWww === prefixHost || hostNoWww.endsWith('.' + prefixHost);
  if (!hostHit) return false;
  if (!prefixPath || prefixPath === '/') return true;
  const path = urlInfo.pathname || '/';
  const pathPrefix = prefixPath.endsWith('/') ? prefixPath : prefixPath;
  return path === pathPrefix || path.startsWith(pathPrefix + '/') || path.startsWith(pathPrefix);
}

export function memorySitePrefixes(m) {
  const raw = [];
  if (Array.isArray(m.urlPrefixes)) raw.push(...m.urlPrefixes);
  const d = (m.domain || '').trim();
  if (d && /[.]/.test(d) && !/\s/.test(d)) raw.push(d);
  return [...new Set(raw.map(normalizeSitePrefix).filter(Boolean))];
}

function labelAlignsHost(label, urlInfo) {
  const h = String(label || '').toLowerCase().trim();
  if (h.length < 3 || !urlInfo || !urlInfo.keys) return false;
  if (GENERIC_DOMAINS.has(h)) return false;
  for (const k of urlInfo.keys) {
    if (k === h) return true;
    if (k.startsWith(h + '.')) return true;
  }
  if (h.includes('.') || /^https?:\/\//.test(h)) {
    return urlMatchesPrefix(urlInfo, h);
  }
  return false;
}

export function memoryMatchesSite(m, urlInfo) {
  if (!urlInfo || !urlInfo.host) return false;
  for (const p of memorySitePrefixes(m)) {
    if (urlMatchesPrefix(urlInfo, p)) return true;
  }
  if (labelAlignsHost(m.domain, urlInfo)) return true;
  for (const t of m.tags || []) {
    if (labelAlignsHost(t, urlInfo)) return true;
  }
  return false;
}

export function textMatchScore(m, text) {
  if (!text) return 0;
  let score = 0;
  const domain = (m.domain || '').toLowerCase();
  const lesson = (m.lesson || '').toLowerCase();
  const tags = (m.tags || []).map((t) => String(t).toLowerCase());
  if (domain && text.includes(domain)) score += 3;
  for (const tag of tags) {
    if (tag && text.includes(tag)) score += 2;
  }
  const lessonWords = lesson.split(/[\s,，。;；]+/).filter((w) => w.length >= 3);
  for (const w of lessonWords) {
    if (text.includes(w)) score += 1;
  }
  return score;
}

/**
 * @param {object[]} memories
 * @param {string} userText
 * @param {string} [currentUrl]
 * @param {number} [limit=5]
 * @returns {Array<object & { siteMatch: boolean }>}
 */
export function rankMemories(memories, userText, currentUrl = '', limit = 5) {
  if (!memories || memories.length === 0) return [];
  const text = (userText || '').toLowerCase();
  const urlInfo = siteKeysFromUrl(currentUrl);
  const scored = memories.map((m) => {
    const siteMatch = memoryMatchesSite(m, urlInfo);
    const textScore = textMatchScore(m, text);
    let score = textScore;
    if (siteMatch) {
      score += 10;
      if (textScore > 0) score += 4;
    }
    score *= (calcRelevance(m) / 5);
    return { mem: m, score, siteMatch, textScore };
  });
  const eligible = scored.filter((s) => s.siteMatch || s.textScore > 0);
  eligible.sort((a, b) => {
    const rank = (s) => (s.siteMatch && s.textScore > 0 ? 2 : s.siteMatch ? 1 : 0);
    const d = rank(b) - rank(a);
    if (d) return d;
    return b.score - a.score;
  });
  return eligible.slice(0, limit).map(({ mem, siteMatch }) => ({ ...mem, siteMatch }));
}

/** 保存时：domain/tags 能对上当前站才自动补 hostname，避免 general 被误绑。 */
export function inferHostPrefix(domain, tags, tabUrl) {
  const info = siteKeysFromUrl(tabUrl);
  if (!info.hostNoWww) return '';
  const hay = [domain, ...(tags || [])].map((s) => String(s).toLowerCase()).filter(Boolean);
  if (hay.length === 0 || hay.every((h) => GENERIC_DOMAINS.has(h))) return '';
  const aligned = hay.some((h) => labelAlignsHost(h, info));
  return aligned ? info.hostNoWww : '';
}

/** 注入提示词用的记忆列表文本。空则返回空串。 */
export function formatMemoriesBlock(memories) {
  if (!memories || !memories.length) return '';
  const lines = ['### 相关经验记忆（自动检索，来自过往任务的成功/失败经验）'];
  for (const m of memories) {
    const siteMark = m.siteMatch ? ' [当前站]' : '';
    lines.push(`- [${m.domain || 'general'}]${siteMark} ${m.lesson || ''}`);
  }
  return lines.join('\n');
}

export function mergeUrlPrefixes(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const p = normalizeSitePrefix(raw);
      if (!p || seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
