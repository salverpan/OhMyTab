/**
 * Chrome built-in Translator API wrapper.
 *
 * Uses the on-device Translator API (Chrome 138+ stable, available in
 * extension service-workers and pages). Free, local, no API key, no network.
 *
 * Docs: https://developer.chrome.com/docs/ai/translator-api
 *
 * Behaviour:
 *   - Detects source language via LanguageDetector (when available)
 *   - Caches Translator instances per source|target pair
 *   - Triggers model download for "downloadable"/"downloading" availability
 *   - Blacklists permanently-unsupported language pairs (in-memory) to avoid
 *     re-probing every item
 */

const TARGET_DEFAULT = 'zh-Hans';

const translatorCache = new Map();    // key: "src|tgt" → Promise<Translator>
const unsupportedPairs = new Set();   // key: "src|tgt" known unavailable
let detectorPromise = null;
const progressListeners = new Set();

export function onTranslatorProgress(fn) {
  if (typeof fn !== 'function') return () => {};
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}
function emitProgress(evt) {
  for (const fn of progressListeners) {
    try { fn(evt); } catch (_) {}
  }
}

function isApiAvailable() {
  return typeof self !== 'undefined' && typeof self.Translator !== 'undefined';
}

function isDetectorAvailable() {
  return typeof self !== 'undefined' && typeof self.LanguageDetector !== 'undefined';
}

async function getDetector() {
  if (!isDetectorAvailable()) return null;
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    try {
      const avail = await LanguageDetector.availability();
      if (avail === 'unavailable') return null;
      if (avail === 'downloadable' || avail === 'downloading') {
        // Trigger model download; will resolve once ready
        return await LanguageDetector.create();
      }
      return await LanguageDetector.create();
    } catch (err) {
      console.warn('[translator] LanguageDetector create failed:', err.message);
      return null;
    }
  })();
  return detectorPromise;
}

async function getTranslator(sourceLanguage, targetLanguage) {
  const key = `${sourceLanguage}|${targetLanguage}`;
  if (unsupportedPairs.has(key)) {
    throw new Error(`不支持 ${sourceLanguage} → ${targetLanguage}（已缓存）`);
  }
  if (translatorCache.has(key)) return translatorCache.get(key);

  const promise = (async () => {
    if (!isApiAvailable()) throw new Error('Translator API 不可用 (需要 Chrome 138+)');
    let avail;
    try {
      avail = await Translator.availability({ sourceLanguage, targetLanguage });
    } catch (err) {
      unsupportedPairs.add(key);
      throw new Error(`Translator.availability 失败: ${err.message}`);
    }
    if (avail === 'unavailable') {
      unsupportedPairs.add(key);
      throw new Error(`不支持 ${sourceLanguage} → ${targetLanguage}`);
    }
    // For 'downloadable' / 'downloading': create() will trigger / wait on the
    // model download. Use monitor() to surface progress.
    const opts = { sourceLanguage, targetLanguage };
    if (avail === 'downloadable' || avail === 'downloading') {
      emitProgress({ kind: 'model-download', stage: 'start', pair: key, loaded: 0 });
      opts.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          emitProgress({
            kind: 'model-download',
            stage: 'progress',
            pair: key,
            loaded: e.loaded || 0,
            total: e.total || 0,
          });
        });
      };
    }
    try {
      const t = await Translator.create(opts);
      emitProgress({ kind: 'model-download', stage: 'done', pair: key });
      return t;
    } catch (err) {
      emitProgress({ kind: 'model-download', stage: 'error', pair: key, error: err.message });
      throw err;
    }
  })();

  translatorCache.set(key, promise);
  promise.catch(() => translatorCache.delete(key));
  return promise;
}

/**
 * Cheap pre-check: identify source language from Unicode script ratios.
 * Returns BCP-47 code when ≥80% of letter characters are in a single
 * unambiguous script (Hans/Hant, Hiragana/Katakana, Hangul, Cyrillic, Arabic,
 * Thai, Devanagari, Hebrew, Greek). Returns 'en' for predominantly ASCII text.
 *
 * This avoids spinning up the LanguageDetector model for the common cases,
 * which alone costs ~30-80ms + a few MB of model load.
 *
 * Returns null when ambiguous (caller should fall back to LanguageDetector).
 */
function fastDetectLang(text) {
  if (!text) return null;
  const s = String(text).slice(0, 400);
  let han = 0, hiraKata = 0, hangul = 0, cyr = 0, arab = 0, thai = 0,
      deva = 0, hebrew = 0, greek = 0, latin = 0, letters = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // ASCII letters
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) { latin++; letters++; continue; }
    if (c < 0x80) continue;
    // CJK Unified Ideographs (Han)
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0xf900 && c <= 0xfaff)) { han++; letters++; continue; }
    // Hiragana / Katakana
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff)) { hiraKata++; letters++; continue; }
    // Hangul
    if ((c >= 0xac00 && c <= 0xd7af) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) { hangul++; letters++; continue; }
    // Cyrillic
    if ((c >= 0x0400 && c <= 0x04ff) || (c >= 0x0500 && c <= 0x052f)) { cyr++; letters++; continue; }
    // Arabic
    if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f) || (c >= 0xfb50 && c <= 0xfdff)) { arab++; letters++; continue; }
    // Thai
    if (c >= 0x0e00 && c <= 0x0e7f) { thai++; letters++; continue; }
    // Devanagari (Hindi)
    if (c >= 0x0900 && c <= 0x097f) { deva++; letters++; continue; }
    // Hebrew
    if (c >= 0x0590 && c <= 0x05ff) { hebrew++; letters++; continue; }
    // Greek
    if (c >= 0x0370 && c <= 0x03ff) { greek++; letters++; continue; }
    // Latin extended (Latin-1 Supplement, Latin Extended A/B/C)
    if ((c >= 0x00c0 && c <= 0x024f) || (c >= 0x1e00 && c <= 0x1eff)) { latin++; letters++; continue; }
  }
  if (letters < 4) return null; // not enough signal
  const threshold = letters * 0.8;
  // Japanese: any Hiragana/Katakana strongly implies Japanese (even mixed with Han)
  if (hiraKata >= letters * 0.1) return 'ja';
  if (han >= threshold) return 'zh-Hans'; // can't easily distinguish Hans vs Hant from script alone
  if (hangul >= threshold) return 'ko';
  if (cyr >= threshold) return 'ru';
  if (arab >= threshold) return 'ar';
  if (thai >= threshold) return 'th';
  if (deva >= threshold) return 'hi';
  if (hebrew >= threshold) return 'he';
  if (greek >= threshold) return 'el';
  if (latin >= threshold) return 'en'; // predominantly latin → assume English (best effort)
  return null;
}
export async function detectLanguage(text) {
  if (!text) return null;
  // Try cheap script-based detection first; it handles 90% of feed traffic
  // (predominantly single-script titles + summaries) without loading models.
  const fast = fastDetectLang(text);
  if (fast) return fast;
  const detector = await getDetector();
  if (!detector) return null;
  try {
    const sample = String(text).slice(0, 500);
    const results = await detector.detect(sample);
    if (!results || results.length === 0) return null;
    const top = results[0];
    if (top.confidence < 0.4) return null;
    return top.detectedLanguage;
  } catch (err) {
    console.warn('[translator] detect failed:', err.message);
    return null;
  }
}

/**
 * Translate many strings. Groups by detected source language so that each
 * Translator instance is used serially (the API is stateful), but different
 * language pairs may run concurrently up to `concurrency`.
 *
 * @param {string[]} texts
 * @returns {Promise<Array<{text, sourceLanguage, translated, error?, unsupported?}>>}
 */
export async function translateBatch(texts, opts = {}) {
  const concurrency = opts.concurrency || 3;
  const targetLanguage = normalizeBcp47(opts.targetLanguage || TARGET_DEFAULT);
  const results = new Array(texts.length);

  // Phase 1: detect each text's source language (cheap, parallel)
  const detected = await Promise.all(
    texts.map(async (t, i) => {
      if (!t || !String(t).trim()) {
        results[i] = { text: t || '', sourceLanguage: null, translated: false };
        return null;
      }
      const src = await detectLanguage(t);
      return { i, src };
    })
  );

  // Phase 2: bucket by source language
  const buckets = new Map();   // sourceLang → [{i, text}]
  for (const d of detected) {
    if (!d) continue;
    const { i, src } = d;
    if (!src) {
      results[i] = { text: texts[i], sourceLanguage: null, translated: false, error: 'detect-failed' };
      continue;
    }
    const normSrc = normalizeBcp47(src);
    if (sameLanguage(normSrc, targetLanguage)) {
      results[i] = { text: texts[i], sourceLanguage: normSrc, translated: false };
      continue;
    }
    if (!buckets.has(normSrc)) buckets.set(normSrc, []);
    buckets.get(normSrc).push({ i, text: texts[i] });
  }

  // Phase 3: process buckets concurrently; within each bucket strictly serial
  const bucketList = Array.from(buckets.entries());
  let cursor = 0;
  const workers = new Array(Math.min(concurrency, bucketList.length)).fill(null).map(async () => {
    while (cursor < bucketList.length) {
      const idx = cursor++;
      const [src, entries] = bucketList[idx];
      let translator;
      try {
        translator = await getTranslator(src, targetLanguage);
      } catch (err) {
        const unsupported = unsupportedPairs.has(`${src}|${targetLanguage}`);
        for (const { i, text } of entries) {
          results[i] = { text, sourceLanguage: src, translated: false, error: err.message, unsupported };
        }
        continue;
      }
      for (const { i, text } of entries) {
        try {
          const out = await translator.translate(String(text));
          results[i] = { text: out, sourceLanguage: src, translated: true };
        } catch (err) {
          results[i] = { text, sourceLanguage: src, translated: false, error: err.message };
        }
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export function sameLanguage(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // 'zh' loosely matches zh-Hans/zh-Hant
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al.startsWith('zh') && bl.startsWith('zh')) return al === bl;
  // 'en' matches 'en-US' etc.
  const aBase = al.split('-')[0];
  const bBase = bl.split('-')[0];
  return aBase === bBase;
}

function normalizeBcp47(code) {
  if (!code) return code;
  const s = String(code).trim();
  if (s === 'zh') return 'zh-Hans';
  if (s.toLowerCase() === 'zh-cn') return 'zh-Hans';
  if (s.toLowerCase() === 'zh-tw') return 'zh-Hant';
  if (s.toLowerCase() === 'zh-hk') return 'zh-Hant';
  return s;
}

export { normalizeBcp47 };

/**
 * Strip HTML tags + decode common entities so the translator sees plain text.
 * Keeps line breaks for block-level elements.
 */
/** Is the Chrome Translator API exposed at all? */
export async function isTranslatorReady() {
  return isApiAvailable();
}
