/**
 * 通用 HTTP API 调用（无 DOM）。侧栏 / SW 共用。
 *
 * 不按数据源发版：模型自己读文档、组 URL。密钥进 chrome.storage.local，
 * 运行时注入，禁止回显到工具结果或对话。
 */

import { CALL_API_TIMEOUT_MS, CALL_API_MAX_BODY } from './limits.js';

export const API_CONNECTORS_KEY = 'apiConnectors';

export const AUTH_TYPES = ['none', 'bearer', 'header', 'query', 'basic', 'hmac_sha256'];
export const HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'];
export const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const API_PRESETS = [
  {
    id: 'public',
    name: '公开 API',
    baseUrl: 'https://',
    authType: 'none',
    allowWrite: false,
    notes: '免费、无需 Key。保存后会出现在「已接入 API」，提醒模型走这条渠道。',
  },
  {
    id: 'fred',
    name: 'FRED',
    baseUrl: 'https://api.stlouisfed.org',
    authType: 'query',
    queryName: 'api_key',
    allowWrite: false,
    notes: '美联储圣路易斯 FRED。例：GET /fred/series/observations?series_id=FEDFUNDS&file_type=json',
  },
  {
    id: 'binance',
    name: 'Binance',
    baseUrl: 'https://api.binance.com',
    authType: 'hmac_sha256',
    headerName: 'X-MBX-APIKEY',
    signatureParam: 'signature',
    allowWrite: false,
    notes: 'HMAC 签 query；行情可匿名 GET。下单等写入须勾选「允许写入」。',
  },
  {
    id: 'rest',
    name: 'REST',
    baseUrl: 'https://',
    authType: 'bearer',
    allowWrite: false,
    notes: '通用 REST / 数据库 HTTP API（Supabase、PostgREST、自建）。',
  },
];

const BLOCKED_HEADER = /^(authorization|cookie|set-cookie|host|content-length|connection)$/i;

export function normalizeConnector(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const authType = AUTH_TYPES.includes(c.authType) ? c.authType : 'none';
  return {
    id: String(c.id || '').trim() || ('api_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    name: String(c.name || '').trim() || 'unnamed',
    baseUrl: String(c.baseUrl || '').trim().replace(/\/+$/, ''),
    authType,
    apiKey: String(c.apiKey || ''),
    apiSecret: String(c.apiSecret || ''),
    headerName: String(c.headerName || (authType === 'hmac_sha256' ? 'X-MBX-APIKEY' : 'X-Api-Key')),
    queryName: String(c.queryName || 'api_key'),
    signatureParam: String(c.signatureParam || 'signature'),
    allowWrite: !!c.allowWrite,
    notes: String(c.notes || '').slice(0, 500),
    createdAt: Number(c.createdAt) || Date.now(),
    updatedAt: Number(c.updatedAt) || Date.now(),
  };
}

export function publicConnector(c) {
  const n = normalizeConnector(c);
  return {
    id: n.id,
    name: n.name,
    baseUrl: n.baseUrl,
    authType: n.authType,
    allowWrite: n.allowWrite,
    hasKey: !!(n.apiKey || n.apiSecret),
    notes: n.notes,
  };
}

export function formatApiCatalog(list) {
  const rows = (Array.isArray(list) ? list : []).map(publicConnector);
  if (!rows.length) {
    return '### 已接入 API（call_api）\n（还没有保存的连接。免费无需 Key 的接口也请 action=save 或让用户在设置里添加，用来提醒你有这条渠道；有密钥的同样保存。未列入的公开 HTTPS 仍可直接传 url。）';
  }
  const lines = rows.map((c) => {
    const rw = c.allowWrite ? '可读可写' : '只读';
    const key = c.hasKey ? `需密钥(${c.authType})` : '免费无需密钥';
    const note = c.notes ? ` — ${c.notes}` : '';
    return `- ${c.name} · ${key} · ${c.baseUrl || '(无 base)'} · ${rw}${note}`;
  });
  return [
    '### 已接入 API（call_api）',
    '下列是用户明确接入的渠道（含免费、无需 Key 的）。相关问题必须优先用 connector=名称调用，不要假装没有、也不要先去爬网页。有密钥的由运行时注入，不要把密钥写进参数。',
    ...lines,
  ].join('\n');
}

export function findConnector(list, idOrName) {
  const q = String(idOrName || '').trim().toLowerCase();
  if (!q) return null;
  const arr = Array.isArray(list) ? list : [];
  return arr.find((c) => String(c.id).toLowerCase() === q)
    || arr.find((c) => String(c.name).toLowerCase() === q)
    || null;
}

export function assertSafeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch {
    return 'URL 无效。';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return '只允许 http/https。';
  }
  if (u.username || u.password) return 'URL 里不要放账号密码，用 connector 存密钥。';
  return null;
}

export function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '');
  if (!p) return b;
  if (/^https?:\/\//i.test(p)) return p;
  if (!b) return p.startsWith('/') ? p : '/' + p;
  return p.startsWith('/') ? b + p : b + '/' + p;
}

export function applyQuery(url, query) {
  const u = new URL(url);
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(String(k), typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  }
  return u.toString();
}

const SECRET_QUERY = /^(api[_-]?key|access[_-]?token|token|secret|signature|password|key)$/i;

export function redactUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (SECRET_QUERY.test(k)) u.searchParams.set(k, '***');
    }
    return u.toString();
  } catch {
    return '';
  }
}

export async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(message || '')));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function mergeHeaders(extra) {
  const out = {};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return out;
  for (const [k, v] of Object.entries(extra)) {
    if (!k || v == null) continue;
    if (BLOCKED_HEADER.test(k)) continue;
    out[String(k)] = String(v);
  }
  return out;
}

export async function applyAuth(url, headers, connector) {
  const c = connector ? normalizeConnector(connector) : null;
  if (!c || c.authType === 'none') return { url, headers };
  const h = { ...headers };
  if (c.authType === 'bearer' && c.apiKey) {
    h.Authorization = 'Bearer ' + c.apiKey;
    return { url, headers: h };
  }
  if (c.authType === 'header' && c.apiKey) {
    h[c.headerName || 'X-Api-Key'] = c.apiKey;
    return { url, headers: h };
  }
  if (c.authType === 'basic' && (c.apiKey || c.apiSecret)) {
    h.Authorization = 'Basic ' + btoa(`${c.apiKey}:${c.apiSecret}`);
    return { url, headers: h };
  }
  if (c.authType === 'query' && c.apiKey) {
    const u = new URL(url);
    u.searchParams.set(c.queryName || 'api_key', c.apiKey);
    return { url: u.toString(), headers: h };
  }
  if (c.authType === 'hmac_sha256') {
    const u = new URL(url);
    if (!u.searchParams.has('timestamp')) u.searchParams.set('timestamp', String(Date.now()));
    const payload = u.searchParams.toString();
    const sig = await hmacSha256Hex(c.apiSecret, payload);
    u.searchParams.set(c.signatureParam || 'signature', sig);
    if (c.apiKey) h[c.headerName || 'X-MBX-APIKEY'] = c.apiKey;
    return { url: u.toString(), headers: h };
  }
  return { url, headers: h };
}

function encodeBody(body, headers) {
  if (body == null || body === '') return { body: undefined, headers };
  if (typeof body === 'string') {
    const h = { ...headers };
    if (!h['Content-Type'] && !h['content-type']) h['Content-Type'] = 'text/plain;charset=utf-8';
    return { body, headers: h };
  }
  const json = JSON.stringify(body);
  const h = { ...headers };
  if (!h['Content-Type'] && !h['content-type']) h['Content-Type'] = 'application/json';
  return { body: json, headers: h };
}

export async function buildApiRequest(args, connector) {
  const method = String(args.method || 'GET').toUpperCase();
  if (!HTTP_METHODS.includes(method)) return { error: `不支持的 method: ${method}` };

  let url = '';
  if (args.url) url = String(args.url).trim();
  else if (connector) url = joinUrl(connector.baseUrl, args.path || '');
  else if (args.path) url = String(args.path).trim();
  if (!url) return { error: '需要 url，或 connector + path。' };

  const bad = assertSafeUrl(url);
  if (bad) return { error: bad };

  if (connector && connector.baseUrl) {
    try {
      const target = new URL(url);
      const origin = new URL(connector.baseUrl).origin;
      if (target.origin !== origin) {
        return { error: `URL 不在连接 ${connector.name} 的源 ${origin} 下。` };
      }
    } catch {
      return { error: 'connector base URL 无效。' };
    }
  }

  url = applyQuery(url, args.query);
  let headers = mergeHeaders(args.headers);
  const enc = encodeBody(args.body, headers);
  headers = enc.headers;
  const byteLen = enc.body ? new TextEncoder().encode(enc.body).length : 0;
  if (byteLen > CALL_API_MAX_BODY) {
    return { error: `请求体超过 ${CALL_API_MAX_BODY} 字节。` };
  }

  const authed = await applyAuth(url, headers, connector);
  return { method, url: authed.url, headers: authed.headers, body: enc.body };
}

function parseMaybeJson(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export async function loadConnectors() {
  try {
    const got = await chrome.storage.local.get(API_CONNECTORS_KEY);
    const list = got[API_CONNECTORS_KEY];
    return (Array.isArray(list) ? list : []).map(normalizeConnector);
  } catch {
    return [];
  }
}

export async function saveConnectors(list) {
  await chrome.storage.local.set({
    [API_CONNECTORS_KEY]: (Array.isArray(list) ? list : []).map(normalizeConnector),
  });
}

export async function executeApiCall(args, opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch.bind(globalThis);
  const load = opts.loadConnectors || loadConnectors;
  const save = opts.saveConnectors || saveConnectors;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : CALL_API_TIMEOUT_MS;
  const a = args && typeof args === 'object' ? args : {};
  const action = String(a.action || 'request').toLowerCase();
  const sub = !!(opts.subagentKind);

  if (sub && action !== 'request' && action !== 'list') {
    return { ok: false, error: '子代理只能 list / 只读请求，不能保存或删除 API 连接。' };
  }

  if (action === 'list') {
    const list = await load();
    return { ok: true, connectors: list.map(publicConnector) };
  }

  if (action === 'delete') {
    const list = await load();
    const hit = findConnector(list, a.connector || a.name || a.id);
    if (!hit) return { ok: false, error: '没有这个连接。' };
    await save(list.filter((c) => c.id !== hit.id));
    return { ok: true, deleted: hit.name };
  }

  if (action === 'save') {
    const name = String(a.name || a.connector || '').trim();
    if (!name) return { ok: false, error: 'save 需要 name。' };
    const list = await load();
    const existing = findConnector(list, a.id) || findConnector(list, name);
    const baseUrl = String(a.base_url || a.baseUrl || existing?.baseUrl || '').trim();
    if (!baseUrl) return { ok: false, error: 'save 需要 base_url（免费无需 Key 的接口也要保存根地址，用来提醒有这条渠道）。' };
    const authType = a.auth_type || a.authType || existing?.authType || 'none';
    const merged = normalizeConnector({
      ...(existing || {}),
      name,
      baseUrl,
      authType,
      apiKey: authType === 'none' ? '' : (a.api_key || a.apiKey || existing?.apiKey || ''),
      apiSecret: (authType === 'hmac_sha256' || authType === 'basic')
        ? (a.api_secret || a.apiSecret || existing?.apiSecret || '')
        : '',
      headerName: a.header_name || a.headerName || existing?.headerName,
      queryName: a.query_name || a.queryName || existing?.queryName,
      signatureParam: a.signature_param || a.signatureParam || existing?.signatureParam,
      allowWrite: a.allow_write != null ? !!a.allow_write : (a.allowWrite != null ? !!a.allowWrite : !!existing?.allowWrite),
      notes: a.notes != null ? a.notes : existing?.notes,
      id: existing?.id,
      createdAt: existing?.createdAt,
      updatedAt: Date.now(),
    });
    const next = existing
      ? list.map((c) => (c.id === existing.id ? merged : c))
      : [...list, merged];
    await save(next);
    const pub = publicConnector(merged);
    const hint = pub.hasKey
      ? '已保存。之后用 connector=' + merged.name + ' 调用，不要再传 api_key。'
      : '已保存为免费渠道（无需 Key）。相关问题优先用 connector=' + merged.name + ' 调用。';
    return { ok: true, saved: pub, hint };
  }

  if (action !== 'request' && action !== 'test') {
    return { ok: false, error: `未知 action: ${action}` };
  }

  const list = await load();
  const connector = findConnector(list, a.connector || a.name);
  if ((a.connector || a.name) && !connector && action !== 'request') {
    return { ok: false, error: '没有这个连接。用 action=list 查看。' };
  }
  if (a.connector && !connector) {
    return { ok: false, error: `没有名为「${a.connector}」的连接。用 action=list 查看，或先 action=save。` };
  }

  const method = String(a.method || (action === 'test' ? 'GET' : 'GET')).toUpperCase();
  if (sub && WRITE_METHODS.has(method)) {
    return { ok: false, error: '子代理只能 GET/HEAD/OPTIONS。写入请让父代理调。' };
  }
  if (WRITE_METHODS.has(method)) {
    if (connector && !connector.allowWrite) {
      return { ok: false, error: `连接「${connector.name}」未开启允许写入。用户需在设置里勾选，或 action=save 时 allow_write=true。` };
    }
    if (!connector) {
      return { ok: false, error: 'POST/PUT/PATCH/DELETE 必须走已保存且允许写入的连接，避免对任意网址改数据。' };
    }
  }

  const reqArgs = action === 'test'
    ? { method: 'GET', url: connector ? joinUrl(connector.baseUrl, a.path || '') : a.url, query: a.query, headers: a.headers }
    : a;
  if (action === 'test' && !reqArgs.url) return { ok: false, error: '测试需要 connector 或 url。' };

  const built = await buildApiRequest(reqArgs, connector);
  if (built.error) return { ok: false, error: built.error };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(built.url, {
      method: built.method,
      headers: built.headers,
      body: built.method === 'GET' || built.method === 'HEAD' ? undefined : built.body,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const rawText = built.method === 'HEAD' ? '' : await resp.text();
    // 不在源头截断：全量文本交给执行器的溢出入库（超 EXEC_OUTPUT_CAP_CHARS 全文进
    // 工作区，模型拿预览 + doc_id 回读）。巨型响应跳过 JSON 解析（慢且必然溢出）。
    const json = rawText.length <= 1000000 ? parseMaybeJson(rawText) : null;
    const out = {
      ok: resp.ok,
      status: resp.status,
      url: redactUrl(built.url),
      contentType: resp.headers.get('content-type') || '',
      chars: rawText.length,
      ...(json != null ? { json } : { text: rawText }),
    };
    if (!resp.ok) out.error = `HTTP ${resp.status}`;
    return out;
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? `超时（${timeoutMs}ms）` : String((err && err.message) || err);
    return { ok: false, error: msg.replace(/Bearer\s+\S+/ig, 'Bearer ***') };
  } finally {
    clearTimeout(timer);
  }
}
