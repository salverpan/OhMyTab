export function findBestSimilarityMatch(entry, candidates) {
  let best = null;

  for (const candidate of candidates) {
    if (!candidate || candidate.id === entry.id || candidate.status !== 'completed') continue;
    if (sameNormalizedUrl(entry.url, candidate.url)) continue;

    const score = calculateEntrySimilarity(entry, candidate);
    const level = getSimilarityLevel(score);
    if (!level) continue;

    if (!best || score.finalScore > best.finalScore) {
      best = {
        level,
        finalScore: roundScore(score.finalScore),
        titleSimilarity: roundScore(score.titleSimilarity),
        bodySimilarity: roundScore(score.bodySimilarity),
        matchedEntryId: candidate.id,
        matchedTitle: candidate.aiTitle || candidate.originalTitle || '',
        checkedAt: Date.now(),
      };
    }
  }

  return best;
}

export function calculateEntrySimilarity(a, b) {
  const titleSimilarity = textSimilarity(a.aiTitle || a.originalTitle || '', b.aiTitle || b.originalTitle || '');
  const summaryA = `${a.aiSummary || ''} ${normalizeTags(a.tags)}`;
  const summaryB = `${b.aiSummary || ''} ${normalizeTags(b.tags)}`;
  const bodySimilarity = textSimilarity(summaryA, summaryB);
  const finalScore = titleSimilarity * 0.6 + bodySimilarity * 0.4;

  return { finalScore, titleSimilarity, bodySimilarity };
}

export function getSimilarityLevel(score) {
  const { finalScore, titleSimilarity, bodySimilarity } = score;

  if (
    finalScore >= 0.85 ||
    (titleSimilarity >= 0.9 && bodySimilarity >= 0.6) ||
    (bodySimilarity >= 0.88 && titleSimilarity >= 0.45)
  ) {
    return 'high';
  }

  if (
    finalScore >= 0.68 ||
    (finalScore >= 0.25 && titleSimilarity >= 0.2 && bodySimilarity >= 0.25) ||
    titleSimilarity >= 0.78 ||
    bodySimilarity >= 0.3
  ) {
    return 'medium';
  }

  return null;
}

export function similaritySeverity(level) {
  if (level === 'high') return 2;
  if (level === 'medium') return 1;
  return 0;
}

function textSimilarity(a, b) {
  const tokensA = makeFeatures(a);
  const tokensB = makeFeatures(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  return Math.max(jaccard(tokensA, tokensB), containment(tokensA, tokensB));
}

function makeFeatures(text) {
  const normalized = String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\u3400-\u9fffa-z0-9]+/g, ' ')
    .trim();

  const features = new Set();
  const words = normalized.match(/[\u3400-\u9fff]{2,}|[a-z0-9]{2,}/g) || [];

  for (const word of words) {
    features.add(word);
    addCharGrams(features, word, 2);
    if (word.length >= 5) addCharGrams(features, word, 3);
  }

  for (let i = 0; i < words.length - 1; i += 1) {
    features.add(`${words[i]} ${words[i + 1]}`);
  }

  return features;
}

function addCharGrams(features, text, size) {
  const chars = Array.from(text);
  if (chars.length < size) return;
  for (let i = 0; i <= chars.length - size; i += 1) {
    features.add(chars.slice(i, i + size).join(''));
  }
}

function jaccard(a, b) {
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function containment(a, b) {
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  return intersection / Math.min(a.size, b.size);
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.join(' ') : '';
}

function sameNormalizedUrl(a, b) {
  const left = normalizeUrl(a);
  const right = normalizeUrl(b);
  return !!left && left === right;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.searchParams.sort();
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return String(value || '').trim().replace(/\/$/, '');
  }
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}
