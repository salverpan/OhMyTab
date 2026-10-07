/**
 * Cloud translator backends (zero local CPU; runs server-side).
 *
 * Providers:
 *   - 'google'   Non-official translate.googleapis.com (no key required)
 *   - 'tencent'  Tencent Cloud TMT TextTranslateBatch (5M chars/month free)
 *
 * Public surface mirrors translator.js for drop-in use by feed-backfill.
 *   translateBatchCloud(texts, { provider, targetLanguage, tencent? })
 *     -> Promise<Array<{ text, sourceLanguage, translated, error? }>>
 */

/* 免费谷歌翻译。主端点用 Chrome 内置翻译同款 dict-chrome-ex（2026-08-27 实测：
 * 无 key、Access-Control-Allow-Origin:*、对会被 gtx 反滥用墙拦截的网络也通）；
 * 老 gtx 端点保留为自动回退，请求顺序内逐端点试错。 */
const GOOGLE_CONCURRENCY = 6;
const GOOGLE_PER_REQUEST_MAX = 2000; // GET 查询串安全上限（CJK 百分号编码最多膨胀 9 倍）
const GOOGLE_RETRY = 1;              // 每个端点的重试次数，耗尽后切换下一个端点

function parseDictChromeEx(data) {
  // 形如 [[ "译文", "en" ], ...]，多段按序拼接；防御性兼容裸字符串与嵌套
  let out = '';
  let src = null;
  const walk = (el) => {
    if (!Array.isArray(el)) return;
    if (typeof el[0] === 'string') {
      out += el[0];
      if (!src && typeof el[1] === 'string') src = el[1];
      return;
    }
    for (const child of el) walk(child);
  };
  walk(data);
  if (!out) throw new Error('bad response');
  return { text: out, src: src ? fromGoogleLang(src) : null };
}

function parseGtxSingle(data) {
  // 形如 [[["译文","Hello",...,10]], null, "en", ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('bad response');
  const out = data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('');
  const src = typeof data[2] === 'string' ? fromGoogleLang(data[2]) : null;
  return { text: out, src };
}

const GOOGLE_ENDPOINTS = [
  {
    build: (tl, q) => 'https://clients5.google.com/translate_a/t'
      + '?client=dict-chrome-ex&sl=auto&tl=' + encodeURIComponent(tl)
      + '&q=' + encodeURIComponent(q),
    parse: parseDictChromeEx,
  },
  {
    build: (tl, q) => 'https://translate.googleapis.com/translate_a/single'
      + '?client=gtx&sl=auto&tl=' + encodeURIComponent(tl)
      + '&dt=t&q=' + encodeURIComponent(q),
    parse: parseGtxSingle,
  },
];

const TENCENT_HOST = 'tmt.tencentcloudapi.com';
const TENCENT_SERVICE = 'tmt';
const TENCENT_VERSION = '2018-03-21';
const TENCENT_ACTION = 'TextTranslateBatch';
const TENCENT_BATCH_SIZE = 50;
const TENCENT_CONCURRENCY = 3;

function googleLang(code) {
  if (!code) return 'en';
  const s = String(code).toLowerCase();
  if (s === 'zh-hans' || s === 'zh-cn' || s === 'zh') return 'zh-CN';
  if (s === 'zh-hant' || s === 'zh-tw' || s === 'zh-hk') return 'zh-TW';
  return s.split('-')[0];
}

function tencentLang(code) {
  if (!code) return 'en';
  const s = String(code).toLowerCase();
  if (s === 'zh-hans' || s === 'zh-cn' || s === 'zh') return 'zh';
  if (s === 'zh-hant' || s === 'zh-tw' || s === 'zh-hk') return 'zh-TW';
  return s.split('-')[0];
}

function fromGoogleLang(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s === 'zh-cn' || s === 'zh') return 'zh-Hans';
  if (s === 'zh-tw') return 'zh-Hant';
  return g;
}

function fromTencentLang(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s === 'zh') return 'zh-Hans';
  if (s === 'zh-tw') return 'zh-Hant';
  return g;
}

function isSameLang(a, b) {
  if (!a || !b) return false;
  const aa = String(a).toLowerCase();
  const bb = String(b).toLowerCase();
  if (aa === bb) return true;
  if (aa.startsWith('zh') && bb.startsWith('zh')) return aa === bb;
  return aa.split('-')[0] === bb.split('-')[0];
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function chunkText(text, maxChars) {
  if (!text) return [];
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf('\n\n', maxChars);
    if (cut < maxChars * 0.5) cut = remaining.lastIndexOf('\n', maxChars);
    if (cut < maxChars * 0.5) cut = remaining.lastIndexOf('. ', maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/* ====================================================================
 * GOOGLE (free, non-official endpoint)
 * ==================================================================== */

async function translateGoogleOne(text, targetLanguage) {
  const tl = googleLang(targetLanguage);
  let lastErr;
  for (const ep of GOOGLE_ENDPOINTS) {
    for (let attempt = 0; attempt <= GOOGLE_RETRY; attempt++) {
      try {
        const resp = await fetch(ep.build(tl, text), { method: 'GET' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const r = ep.parse(await resp.json());
        if (!r.text) throw new Error('empty translation');
        return { text: r.text, sourceLanguage: r.src };
      } catch (err) {
        lastErr = err;
        if (attempt < GOOGLE_RETRY) await sleep(300 * (attempt + 1));
      }
    }
    // 本端点耗尽（含反滥用墙的 HTML 当 invalid json 报错）→ 换下一个端点
  }
  throw lastErr || new Error('google translate failed');
}

async function translateGoogleLong(text, targetLanguage) {
  const parts = chunkText(text, GOOGLE_PER_REQUEST_MAX);
  if (parts.length <= 1) return translateGoogleOne(text, targetLanguage);
  const out = [];
  let detected = null;
  for (const p of parts) {
    const r = await translateGoogleOne(p, targetLanguage);
    out.push(r.text);
    if (!detected) detected = r.sourceLanguage;
  }
  return { text: out.join(''), sourceLanguage: detected };
}

async function translateGoogleBatch(texts, targetLanguage) {
  const results = new Array(texts.length);
  let cursor = 0;
  const workers = new Array(Math.min(GOOGLE_CONCURRENCY, texts.length)).fill(null).map(async () => {
    while (cursor < texts.length) {
      const i = cursor++;
      const t = texts[i];
      if (!t || !String(t).trim()) {
        results[i] = { text: t || '', sourceLanguage: null, translated: false };
        continue;
      }
      try {
        const r = await translateGoogleLong(t, targetLanguage);
        const same = r.sourceLanguage && isSameLang(r.sourceLanguage, targetLanguage);
        results[i] = {
          text: r.text || t,
          sourceLanguage: r.sourceLanguage,
          translated: !same && !!r.text,
        };
      } catch (err) {
        results[i] = { text: t, sourceLanguage: null, translated: false, error: err.message };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* ====================================================================
 * TENCENT  TC3-HMAC-SHA256 signed request
 *   docs:   https://cloud.tencent.com/document/api/551/15619
 *   action: TextTranslateBatch
 * ==================================================================== */

async function sha256Hex(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const enc = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
  const sig = await crypto.subtle.sign('HMAC', key, enc);
  return new Uint8Array(sig);
}

async function tencentSign({ secretId, secretKey, payload }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadStr = JSON.stringify(payload);
  const hashedPayload = await sha256Hex(payloadStr);

  const canonicalHeaders =
    'content-type:application/json; charset=utf-8\n' +
    'host:' + TENCENT_HOST + '\n' +
    'x-tc-action:' + TENCENT_ACTION.toLowerCase() + '\n';
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest =
    'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + hashedPayload;

  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const credentialScope = date + '/' + TENCENT_SERVICE + '/tc3_request';
  const stringToSign =
    'TC3-HMAC-SHA256\n' +
    timestamp + '\n' +
    credentialScope + '\n' +
    hashedCanonicalRequest;

  const kDate = await hmacSha256(new TextEncoder().encode('TC3' + secretKey), date);
  const kService = await hmacSha256(kDate, TENCENT_SERVICE);
  const kSigning = await hmacSha256(kService, 'tc3_request');
  const sigBytes = await hmacSha256(kSigning, stringToSign);
  const signature = [...sigBytes].map((b) => b.toString(16).padStart(2, '0')).join('');

  const authorization =
    'TC3-HMAC-SHA256 ' +
    'Credential=' + secretId + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;

  return { authorization, timestamp, payloadStr };
}

async function tencentCallBatch({ texts, targetLanguage, secretId, secretKey, region, projectId }) {
  const payload = {
    Source: 'auto',
    Target: tencentLang(targetLanguage),
    ProjectId: projectId || 0,
    SourceTextList: texts,
  };
  const { authorization, timestamp, payloadStr } = await tencentSign({ secretId, secretKey, payload });
  const resp = await fetch('https://' + TENCENT_HOST + '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-TC-Action': TENCENT_ACTION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': TENCENT_VERSION,
      'X-TC-Region': region || 'ap-shanghai',
      'Authorization': authorization,
    },
    body: payloadStr,
  });
  if (!resp.ok) {
    let body = '';
    try { body = await resp.text(); } catch (_) {}
    throw new Error('HTTP ' + resp.status + ' ' + body.slice(0, 200));
  }
  const json = await resp.json();
  if (json.Response && json.Response.Error) {
    const e = json.Response.Error;
    const err = new Error('[' + e.Code + '] ' + e.Message);
    err.code = e.Code;
    throw err;
  }
  const r = (json && json.Response) || {};
  const list = Array.isArray(r.TargetTextList) ? r.TargetTextList : [];
  const src = fromTencentLang(r.Source) || null;
  return { list, source: src };
}

async function translateTencentBatch(texts, targetLanguage, tencentCfg) {
  const { secretId, secretKey, region, projectId } = tencentCfg || {};
  if (!secretId || !secretKey) {
    return texts.map((t) => ({
      text: t, sourceLanguage: null, translated: false,
      error: '腾讯翻译未配置 SecretId/SecretKey',
    }));
  }

  const indices = [];
  const payloadTexts = [];
  const results = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || !String(t).trim()) {
      results[i] = { text: t || '', sourceLanguage: null, translated: false };
      continue;
    }
    indices.push(i);
    payloadTexts.push(String(t).slice(0, 6000));
  }
  if (indices.length === 0) return results;

  const chunks = [];
  for (let i = 0; i < indices.length; i += TENCENT_BATCH_SIZE) {
    chunks.push({
      idxs: indices.slice(i, i + TENCENT_BATCH_SIZE),
      texts: payloadTexts.slice(i, i + TENCENT_BATCH_SIZE),
    });
  }

  let cursor = 0;
  const workers = new Array(Math.min(TENCENT_CONCURRENCY, chunks.length)).fill(null).map(async () => {
    while (cursor < chunks.length) {
      const ci = cursor++;
      const c = chunks[ci];
      try {
        const { list, source } = await tencentCallBatch({
          texts: c.texts, targetLanguage,
          secretId, secretKey, region, projectId,
        });
        for (let k = 0; k < c.idxs.length; k++) {
          const i = c.idxs[k];
          const out = list[k];
          const same = source && isSameLang(source, targetLanguage);
          if (out == null || same) {
            results[i] = { text: texts[i], sourceLanguage: source, translated: false };
          } else {
            results[i] = { text: out, sourceLanguage: source, translated: true };
          }
        }
      } catch (err) {
        for (const i of c.idxs) {
          results[i] = { text: texts[i], sourceLanguage: null, translated: false, error: err.message };
        }
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/* ====================================================================
 * Dispatcher
 * ==================================================================== */

/**
 * Translate many strings using the configured cloud provider.
 * Returns one entry per input with { text, sourceLanguage, translated, error? }.
 *
 * opts:
 *   provider:        'google' | 'tencent'
 *   targetLanguage:  BCP-47 e.g. 'zh-Hans'
 *   tencent:         { secretId, secretKey, region?, projectId? }
 *
 * The caller (feed-backfill) is responsible for tier fallback between
 * providers — this dispatcher only handles a single cloud provider.
 */
export async function translateBatchCloud(texts, opts = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const provider = (opts.provider || 'google').toLowerCase();
  const target = opts.targetLanguage || 'zh-Hans';
  if (provider === 'tencent') return translateTencentBatch(texts, target, opts.tencent);
  return translateGoogleBatch(texts, target);
}

/** Probe the configured provider with a tiny request; returns { ok, error? }. */
export async function testCloudProvider(opts = {}) {
  try {
    const res = await translateBatchCloud(['hello'], opts);
    const r = res && res[0];
    if (r && r.translated) return { ok: true, sample: r.text };
    return { ok: false, error: (r && r.error) || 'no translation returned' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
