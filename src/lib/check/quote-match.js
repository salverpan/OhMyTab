/** 纯文本 TextQuote 匹配：精确优先，随后做 Unicode/空白归一化。 */

export function normalizeQuoteText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contextScore(text, index, quoteLength, prefix, suffix) {
  let score = 0;
  const p = normalizeQuoteText(prefix);
  const s = normalizeQuoteText(suffix);
  if (p) {
    const before = normalizeQuoteText(text.slice(Math.max(0, index - p.length - 20), index));
    if (before.endsWith(p)) score += 1;
  }
  if (s) {
    const after = normalizeQuoteText(text.slice(index + quoteLength, index + quoteLength + s.length + 20));
    if (after.startsWith(s)) score += 1;
  }
  return score;
}

export function findQuoteInText(source, quote, { prefix = '', suffix = '' } = {}) {
  const text = String(source || '');
  const rawQuote = String(quote || '').trim();
  if (!text || !rawQuote) return { matched: false, matchType: 'not-found', index: -1 };

  const matches = [];
  let at = text.indexOf(rawQuote);
  while (at >= 0) {
    matches.push({ index: at, score: contextScore(text, at, rawQuote.length, prefix, suffix) });
    at = text.indexOf(rawQuote, at + Math.max(1, rawQuote.length));
  }
  if (matches.length) {
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    return { matched: true, matchType: 'exact', index: matches[0].index, length: rawQuote.length };
  }

  const normalizedText = normalizeQuoteText(text);
  const normalizedQuote = normalizeQuoteText(rawQuote);
  const normalizedIndex = normalizedText.indexOf(normalizedQuote);
  if (normalizedIndex >= 0) {
    return { matched: true, matchType: 'normalized', index: normalizedIndex, length: normalizedQuote.length };
  }
  return { matched: false, matchType: 'not-found', index: -1 };
}

export function evidenceExcerpt(text, maxChars = 500) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars)}…` : clean;
}
