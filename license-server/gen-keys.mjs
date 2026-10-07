/**
 * 生成 Ed25519 密钥对。
 * 公钥写入 src/lib/license-pubkey.js（打进扩展）。
 * 私钥写入 license-server/keys/private.pem（只放 VPS，不要打进 CRX）。
 *
 *   node license-server/gen-keys.mjs
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = resolve(here, 'keys');
const pemPath = resolve(keysDir, 'private.pem');
const pubPath = resolve(here, '../src/lib/license-pubkey.js');

mkdirSync(keysDir, { recursive: true });

let publicKey;
if (existsSync(pemPath) && process.argv[2] !== '--force') {
  const priv = createPrivateKey(readFileSync(pemPath));
  publicKey = createPublicKey(priv);
  console.log('reusing', pemPath);
} else {
  const pair = generateKeyPairSync('ed25519');
  writeFileSync(pemPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  publicKey = pair.publicKey;
  console.log('wrote', pemPath);
}

const spkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
writeFileSync(
  pubPath,
  `/** 由 license-server/gen-keys.mjs 生成。必须与 VPS 上 private.pem 配对。 */\nexport const LICENSE_PUBLIC_KEY_SPKI_B64 = '${spkiB64}';\n`,
);
console.log('wrote', pubPath);
console.log('SPKI', spkiB64);
