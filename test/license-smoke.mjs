/* 许可证验签 / 有效期冒烟（node test/license-smoke.mjs）。不碰 chrome.*。 */

import assert from 'node:assert';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  isLicenseOk, verifyToken, importLicensePublicKey,
} from '../src/lib/license.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function mintToken(privateKey, payload) {
  const headerB64 = b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }));
  const payloadB64 = b64url(JSON.stringify(payload));
  const input = `${headerB64}.${payloadB64}`;
  const sig = sign(null, Buffer.from(input, 'utf8'), privateKey);
  return `${input}.${b64url(sig)}`;
}

const nowSec = Math.floor(Date.now() / 1000);
const future = { v: 1, keyId: 'k1', installId: 'dev-1', note: '测', maxDevices: 1, iat: nowSec, exp: nowSec + 3600 };
const past = { ...future, exp: nowSec - 10 };

ok(!isLicenseOk(null), '空状态锁定');
ok(!isLicenseOk({ installId: 'dev-1' }), '无 payload 锁定');
ok(isLicenseOk({ installId: 'dev-1', payload: future }), '未过期且设备匹配 → 通过');
ok(!isLicenseOk({ installId: 'other', payload: future }), '设备不匹配锁定');
ok(!isLicenseOk({ installId: 'dev-1', payload: past }), '已过期锁定');

const pair = generateKeyPairSync('ed25519');
const spkiB64 = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const token = mintToken(pair.privateKey, future);
const key = await importLicensePublicKey(spkiB64);
const parsed = await verifyToken(token, key);
ok(parsed && parsed.installId === 'dev-1' && parsed.note === '测', 'Ed25519 JWT 验签通过');

const other = generateKeyPairSync('ed25519');
const otherKey = await importLicensePublicKey(other.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
ok(!(await verifyToken(token, otherKey)), '错公钥验签失败');
ok(!(await verifyToken('not.a.jwt', key)), '垃圾 token 失败');
ok(!(await verifyToken(mintToken(pair.privateKey, { ...future, v: 2 }), key)), 'v≠1 失败');

console.log(`license-smoke: ${passed} ok`);
