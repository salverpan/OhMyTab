/**
 * 许可证客户端。fail-closed：无有效签名 token 即锁定。
 *
 * 服务端对照（把旧 license 服务改成这两条即可）：
 *
 *   POST {LICENSE_ENDPOINT}/activate
 *     req:  { "key": "CC-xxxx", "installId": "<uuid>", "extVersion": "0.3.0" }
 *     200:  { "ok": true, "token": "<EdDSA JWT>" }
 *     4xx:  { "ok": false, "error": "许可证无效|已吊销|已达设备上限（N 台）" }
 *
 *   POST {LICENSE_ENDPOINT}/heartbeat
 *     req:  { "token": "<jwt>", "installId": "<uuid>" }
 *     200:  { "ok": true, "token": "<新 jwt>" }   // 续期，exp = now+7d
 *     401/403: 吊销或无效 → 清 token 并锁定
 *     5xx / 断网: 不锁。本地 token 未过期仍能用。
 *
 * 扩展收不到服务器推送，用 chrome.alarms 每小时问一次 /heartbeat。
 * 注销后最多约 1 小时内锁定。
 *
 * JWT：
 *   header  {"alg":"EdDSA","typ":"JWT"}
 *   payload {"v":1,"keyId":"...","installId":"...","note":"...","maxDevices":1,"iat":<unix>,"exp":<unix>}
 *   签名    Ed25519(UTF-8(headerB64 + "." + payloadB64))
 *   公钥    SPKI DER 的标准 Base64，见 license-pubkey.js（与 VPS private.pem 配对）
 *
 * 消息名：GET_LICENSE_STATE / ACTIVATE_LICENSE / LICENSE_STATE_CHANGED
 * 不要用旧符号 contentLocked / LOCK_STATE_CHANGED。
 */

import { LICENSE_PUBLIC_KEY_SPKI_B64 } from './license-pubkey.js';

export const LICENSE_ALARM = 'citecat-license-heartbeat';
export const LICENSE_ALARM_MINUTES = 60;
export const LICENSE_ENDPOINT_DEFAULT = 'http://47.104.128.124/citecat/license';
export const LICENSE_STORAGE_KEY = 'citecatLicense';
export const LICENSE_DENIED = {
  success: false,
  ok: false,
  code: 'LICENSE_REQUIRED',
  error: '未激活许可证，请在侧栏输入授权码',
};

const CACHE_MS = 15 * 1000;
let cache = { at: 0, ok: false };
let publicKeyPromise = null;

export function invalidateLicenseCache() {
  cache = { at: 0, ok: false };
}

export function b64urlToBytes(s) {
  const str = String(s || '');
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function spkiDerFromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function importLicensePublicKey(spkiB64 = LICENSE_PUBLIC_KEY_SPKI_B64) {
  return crypto.subtle.importKey('spki', spkiDerFromB64(spkiB64), { name: 'Ed25519' }, false, ['verify']);
}

function getPublicKey() {
  if (!publicKeyPromise) publicKeyPromise = importLicensePublicKey();
  return publicKeyPromise;
}

/**
 * 验签并解析 payload。失败返回 null。
 * @param {string} token
 * @param {CryptoKey} [key]
 */
export async function verifyToken(token, key) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1 || !payload.installId || !payload.exp) return null;
  try {
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key || await getPublicKey(),
      b64urlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!ok) return null;
  } catch {
    return null;
  }
  return payload;
}

/** 纯函数：签名已通过后判断是否仍在有效期内。 */
export function isLicenseOk(state, now = Date.now()) {
  if (!state || !state.payload || !state.installId) return false;
  if (state.payload.installId !== state.installId) return false;
  const expMs = Number(state.payload.exp) * 1000;
  if (!Number.isFinite(expMs) || now > expMs) return false;
  return true;
}

async function loadState() {
  try {
    const { [LICENSE_STORAGE_KEY]: cur } = await chrome.storage.local.get(LICENSE_STORAGE_KEY);
    return cur && typeof cur === 'object' ? cur : {};
  } catch {
    return {};
  }
}

async function saveState(state) {
  await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: state });
}

export async function getInstallId() {
  const cur = await loadState();
  if (cur.installId) return cur.installId;
  const installId = crypto.randomUUID();
  await saveState({ ...cur, installId });
  return installId;
}

export async function resolveLicenseEndpoint() {
  try {
    const { citecatLicenseEndpoint: override } = await chrome.storage.local.get('citecatLicenseEndpoint');
    if (typeof override === 'string' && override.trim()) return override.replace(/\/+$/, '');
  } catch (_) {}
  return LICENSE_ENDPOINT_DEFAULT;
}

async function postLicense(path, body) {
  const endpoint = await resolveLicenseEndpoint();
  const resp = await fetch(`${endpoint}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data = {};
  try { data = await resp.json(); } catch (_) {}
  return { resp, data };
}

async function persistToken(token) {
  const installId = await getInstallId();
  const payload = await verifyToken(token);
  if (!payload) throw new Error('服务器返回的许可无法验签（公钥与 VPS 私钥不配对，或 token 格式不对）');
  if (payload.installId !== installId) throw new Error('许可与本机不匹配');
  await saveState({ installId, token, payload });
  invalidateLicenseCache();
  return payload;
}

async function clearToken(reason) {
  const installId = await getInstallId();
  await saveState({ installId, token: '', payload: null, clearedReason: reason || '' });
  invalidateLicenseCache();
}

export async function getLicenseView(state) {
  const cur = state || await loadState();
  const ok = await evaluateState(cur);
  const payload = cur.payload || {};
  return {
    ok,
    installId: cur.installId || '',
    note: payload.note || '',
    maxDevices: payload.maxDevices || 0,
    exp: payload.exp || 0,
    error: ok ? '' : (cur.token ? (cur.clearedReason || '许可已过期或无效，请重新激活') : '未激活'),
  };
}

async function evaluateState(state) {
  if (!state || !state.token) return false;
  const payload = await verifyToken(state.token);
  if (!payload) return false;
  return isLicenseOk({ installId: state.installId, payload }, Date.now());
}

export async function isRuntimeLicensed() {
  const now = Date.now();
  if (now - cache.at < CACHE_MS) return cache.ok;
  const ok = await evaluateState(await loadState());
  cache = { at: now, ok };
  return ok;
}

export async function activateLicense(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) throw new Error('请输入授权码');
  const installId = await getInstallId();
  const extVersion = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
    ? chrome.runtime.getManifest().version
    : '';
  const { resp, data } = await postLicense('/activate', { key, installId, extVersion });
  if (!resp.ok || !data.ok || !data.token) {
    throw new Error(data.error || `激活失败（HTTP ${resp.status}）`);
  }
  await persistToken(data.token);
  const view = await getLicenseView();
  await broadcastLicenseState(view);
  return view;
}

export async function heartbeatLicense() {
  const state = await loadState();
  if (!state.token) return getLicenseView(state);
  try {
    const { resp, data } = await postLicense('/heartbeat', {
      token: state.token,
      installId: state.installId,
    });
    if (resp.status === 401 || resp.status === 403) {
      await clearToken(data.error || '许可证已吊销');
      const view = await getLicenseView();
      await broadcastLicenseState(view);
      return view;
    }
    if (resp.ok && data.ok && data.token) {
      await persistToken(data.token);
    }
    // 网络/5xx：不改本地。token 未过期则继续能用（最多 7 天）。
  } catch (err) {
    console.warn('[license] heartbeat failed:', err);
  }
  const view = await getLicenseView();
  await broadcastLicenseState(view);
  return view;
}

export async function ensureLicenseAlarm() {
  try {
    await chrome.alarms.clear(LICENSE_ALARM);
    chrome.alarms.create(LICENSE_ALARM, { periodInMinutes: LICENSE_ALARM_MINUTES });
  } catch (err) {
    console.warn('[license] alarm failed:', err);
  }
}

export async function broadcastLicenseState(view) {
  const data = view || await getLicenseView();
  try {
    await chrome.runtime.sendMessage({ type: 'LICENSE_STATE_CHANGED', data });
  } catch (_) {}
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.map((t) => (
      t.id
        ? chrome.tabs.sendMessage(t.id, { type: 'LICENSE_STATE_CHANGED', data }).catch(() => {})
        : Promise.resolve()
    )));
  } catch (_) {}
  return data;
}
