/**
 * Translation backfill engine.
 *
 * Continuously scans items whose translatedTo != current target language and
 * (re)translates them in batches. Triggered on:
 *   - SW startup
 *   - Target language change
 *   - After feed refresh (to catch any items that failed during ingest)
 *
 * Broadcasts progress so the sidepanel can show a bar.
 */

import {
  listItemsNeedingTranslation,
  countItemsNeedingTranslation,
  applyItemTranslation,
} from './feed-db.js';
import {
  translateBatch,
  isTranslatorReady,
  normalizeBcp47,
  onTranslatorProgress,
  sameLanguage as sameLang,
} from './translator.js';
import { translateBatchCloud } from './translator-cloud.js';
import { htmlToText } from './html-utils.js';

const BATCH_SIZE = 100;
const ATTEMPT_CAP = 3;
const IDLE_BETWEEN_BATCHES_MS = 30;
const PARALLEL_BATCHES = 5;

let running = false;
let stopRequested = false;
let lastBroadcast = { running: false, done: 0, total: 0, targetLang: '', download: null };
let downloadState = null;
let providerCfg = { provider: 'local', tencent: null };

/** Called by SW to inject the active translation provider config. */
export function setTranslateProvider(cfg) {
  providerCfg = {
    provider: (cfg && cfg.provider) || 'local',
    tencent: (cfg && cfg.tencent) || null,
  };
}

// Forward translator model-download events so the panel can show a separate bar
onTranslatorProgress((evt) => {
  if (evt.kind === 'model-download') {
    if (evt.stage === 'start' || evt.stage === 'progress') {
      downloadState = { pair: evt.pair, loaded: evt.loaded || 0, stage: evt.stage };
    } else if (evt.stage === 'done' || evt.stage === 'error') {
      downloadState = null;
    }
    broadcast();
  }
});

function broadcast(extra = {}) {
  lastBroadcast = { ...lastBroadcast, ...extra, download: downloadState };
  try {
    chrome.runtime.sendMessage({
      type: 'TRANSLATE_PROGRESS',
      data: lastBroadcast,
    }).catch(() => {});
  } catch (_) {}
}

export function getBackfillStatus() {
  return lastBroadcast;
}

/**
 * Run continuously until no more items need translation (or stop requested).
 * Idempotent — calling while running is a no-op.
 */
export async function runBackfill(targetLang) {
  if (running) return;
  // No early-exit on local availability: the cloud tiers may still work.
  // If everything fails, individual items will record translateError and
  // be retried up to ATTEMPT_CAP.
  const target = normalizeBcp47(targetLang || 'zh-Hans');
  running = true;
  stopRequested = false;

  try {
    const initialTotal = await countItemsNeedingTranslation({ targetLang: target, attemptCap: ATTEMPT_CAP });
    if (initialTotal === 0) {
      broadcast({ running: false, done: 0, total: 0, targetLang: target });
      return;
    }
    let done = 0;
    let total = initialTotal;
    broadcast({ running: true, done, total, targetLang: target });

    while (!stopRequested) {
      // Fetch ONE contiguous slice of items needing translation, then split it
      // into chunks and translate the chunks concurrently.
      // NOTE: do NOT call listItemsNeedingTranslation N times in parallel here —
      // it always starts its cursor from the beginning of the store, so N calls
      // with identical args return the SAME items N times, re-translating the
      // same records (burning provider quota) while inflating the progress count.
      const fetched = await listItemsNeedingTranslation({
        targetLang: target,
        attemptCap: ATTEMPT_CAP,
        limit: BATCH_SIZE * PARALLEL_BATCHES,
      });
      if (fetched.length === 0) break;

      // Split into PARALLEL_BATCHES chunks (disjoint records) and translate in parallel
      const chunks = [];
      for (let i = 0; i < fetched.length; i += BATCH_SIZE) {
        chunks.push(fetched.slice(i, i + BATCH_SIZE));
      }
      await Promise.all(chunks.map((chunk) => translateBatchItems(chunk, target)));

      const allItems = fetched;
      done += allItems.length;
      const remaining = (done % (BATCH_SIZE * 2) === 0)
        ? await countItemsNeedingTranslation({ targetLang: target, attemptCap: ATTEMPT_CAP })
        : Math.max(0, total - done);
      total = done + remaining;
      broadcast({ running: true, done, total, targetLang: target });
      if (!stopRequested && allItems.length >= BATCH_SIZE) {
        await new Promise((r) => setTimeout(r, IDLE_BETWEEN_BATCHES_MS));
      }
    }

    broadcast({ running: false, done, total: done, targetLang: target });
  } finally {
    running = false;
    stopRequested = false;
  }
}

export function stopBackfill() {
  stopRequested = true;
}

/**
 * Translate a batch of item records and persist results.
 * Fields written:
 *   - originalTitle / originalSummary / originalFullText (only on first translation)
 *   - title / summary / fullText (translated)
 *   - translated, translatedTo, sourceLanguage, translatedAt
 *   - translateAttempts, translateError
 */
/**
 * Build the ordered list of translation tiers to try, based on user prefs.
 *   - primary tier: whatever the user picked (tencent / google / local)
 *   - then any remaining cloud tiers (tencent has creds → google → ...)
 *   - local is always the final fallback
 */
function buildTierChain() {
  const tiers = [];
  const picked = providerCfg.provider || 'local';
  const hasTencent = !!(providerCfg.tencent && providerCfg.tencent.secretId && providerCfg.tencent.secretKey);

  const pushTier = (name) => {
    if (name === 'tencent' && !hasTencent) return;
    if (tiers.includes(name)) return;
    tiers.push(name);
  };

  if (picked === 'tencent') { pushTier('tencent'); pushTier('google'); }
  else if (picked === 'google') { pushTier('google'); pushTier('tencent'); }
  else { /* local first */ }
  pushTier('local');
  return tiers;
}

async function runTier(tier, texts, targetLanguage) {
  if (tier === 'local') {
    if (!(await isTranslatorReady())) {
      return texts.map((t) => ({ text: t, sourceLanguage: null, translated: false, error: 'local-unavailable' }));
    }
    return translateBatch(texts, { targetLanguage });
  }
  try {
    const res = await translateBatchCloud(texts, {
      provider: tier,
      targetLanguage,
      tencent: providerCfg.tencent,
      fallback: false,
    });
    const ok = res.filter((r) => r && r.translated).length;
    const errs = res.filter((r) => r && r.error).map((r) => r.error);
    const sample = errs.length > 0 ? ' err=' + JSON.stringify(errs.slice(0, 2)) : '';
    console.log('[backfill] tier=' + tier + ' translated=' + ok + '/' + texts.length + sample);
    return res;
  } catch (err) {
    console.warn('[backfill] tier=' + tier + ' threw:', err.message);
    return texts.map((t) => ({ text: t, sourceLanguage: null, translated: false, error: err.message }));
  }
}

/**
 * Translate `texts` through the configured tier chain. For each text:
 * try tier 1; if it returned `translated:false` with an error, retry on the
 * next tier; carry over already-successful results. Returns one merged array.
 */
async function translateWithChain(texts, targetLanguage) {
  const chain = buildTierChain();
  const results = new Array(texts.length).fill(null);
  let pending = texts.map((t, i) => ({ i, t }));

  for (const tier of chain) {
    if (pending.length === 0) break;
    const sub = await runTier(tier, pending.map((p) => p.t), targetLanguage);
    const stillPending = [];
    for (let k = 0; k < pending.length; k++) {
      const r = sub[k];
      if (r && r.translated) {
        results[pending[k].i] = r;
      } else if (r && !r.error && r.sourceLanguage && sameLang(r.sourceLanguage, targetLanguage)) {
        // source already equals target — accept as-is, no further tier needed
        results[pending[k].i] = r;
      } else {
        // failure → next tier
        stillPending.push(pending[k]);
        // Keep the latest result as a fallback in case all tiers fail
        results[pending[k].i] = r;
      }
    }
    pending = stillPending;
  }

  // Anything not filled (e.g. empty input) gets a neutral entry
  for (let i = 0; i < results.length; i++) {
    if (results[i] == null) {
      results[i] = { text: texts[i] || '', sourceLanguage: null, translated: false };
    }
  }
  return results;
}

async function translateBatchItems(items, targetLanguage) {
  // Pre-filter: items already in target language
  const now = Date.now();
  const todo = [];
  for (const it of items) {
    const src = (it.sourceLanguage || '').trim();
    if (src && sameLang(src, targetLanguage)) {
      await applyItemTranslation(it.id, {
        translatedTo: targetLanguage,
        translatedAt: now,
        sourceLanguage: src,
        translateError: '',
      });
      continue;
    }
    todo.push(it);
  }
  if (todo.length === 0) return;

  const titles = todo.map((it) => (it.title || '').trim());
  const summaries = todo.map((it) => htmlToText(it.summary || ''));
  // fullText intentionally skipped during backfill — translate on-demand
  // when user opens an article instead.

  const [tTitles, tSummaries] = await Promise.all([
    translateWithChain(titles, targetLanguage),
    translateWithChain(summaries, targetLanguage),
  ]);

  for (let i = 0; i < todo.length; i++) {
    const it = todo[i];
    const tt = tTitles[i], ts = tSummaries[i];
    const titleOk = tt && tt.translated;
    const sumOk = ts && ts.translated;
    const anyOk = titleOk || sumOk;

    const patch = {
      translatedAt: Date.now(),
      sourceLanguage:
        (tt && tt.sourceLanguage) ||
        (ts && ts.sourceLanguage) ||
        it.sourceLanguage || '',
    };

    if (anyOk) {
      patch.translated = true;
      patch.translatedTo = targetLanguage;
      patch.translateError = '';
      patch.translateAttempts = 0;
      if (titleOk) {
        if (!it.originalTitle) patch.originalTitle = it.title;
        patch.title = tt.text;
      }
      if (sumOk) {
        if (!it.originalSummary) patch.originalSummary = it.summary;
        patch.summary = ts.text;
      }
    } else {
      // Important: do NOT set translatedTo on failure, otherwise this item
      // is permanently excluded from listItemsNeedingTranslation and can
      // never be retried when the provider changes.
      patch.translateAttempts = (it.translateAttempts || 0) + 1;
      patch.translateError =
        (tt && tt.error) ||
        (ts && ts.error) ||
        'all tiers failed';
    }

    await applyItemTranslation(it.id, patch);
  }
}
