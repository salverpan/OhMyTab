import assert from 'node:assert/strict';
import {
  assertSafeUrl, joinUrl, applyQuery, redactUrl, hmacSha256Hex,
  applyAuth, buildApiRequest, executeApiCall, formatApiCatalog,
  findConnector, normalizeConnector, publicConnector, WRITE_METHODS,
} from '../src/lib/api-call.js';
import { CHAT_TOOLS } from '../src/lib/tools.js';
import { CALL_API_MAX_BODY } from '../src/lib/limits.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(CHAT_TOOLS.some((t) => t.function.name === 'call_api'), 'CHAT_TOOLS 含 call_api');

ok(assertSafeUrl('https://api.stlouisfed.org/fred') == null, 'https 允许');
ok(!!assertSafeUrl('file:///etc/passwd'), 'file 拒绝');
ok(!!assertSafeUrl('https://user:pass@host/x'), 'URL 内嵌密码拒绝');

ok(joinUrl('https://api.example.com', '/v1/x') === 'https://api.example.com/v1/x', 'join 斜杠');
ok(joinUrl('https://api.example.com/', 'v1/x') === 'https://api.example.com/v1/x', 'join 无斜杠');

const q = applyQuery('https://x.test/a', { series_id: 'FEDFUNDS', file_type: 'json' });
ok(q.includes('series_id=FEDFUNDS') && q.includes('file_type=json'), 'query 合并');

ok(redactUrl('https://x.test/a?api_key=secret&q=1').includes('api_key=***'), 'query 密钥打码');
ok(!redactUrl('https://x.test/a?api_key=secret').includes('secret'), '打码后无明文');

const fox = await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog');
ok(fox === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'HMAC-SHA256 向量');

const bearer = await applyAuth('https://x.test/v1', {}, {
  authType: 'bearer', apiKey: 'sk-test',
});
ok(bearer.headers.Authorization === 'Bearer sk-test', 'Bearer 注入');

const queryAuth = await applyAuth('https://api.stlouisfed.org/fred/series', {}, {
  authType: 'query', apiKey: 'fredkey', queryName: 'api_key',
});
ok(queryAuth.url.includes('api_key=fredkey'), 'FRED query key');

const hmac = await applyAuth('https://api.binance.com/api/v3/account', {}, {
  authType: 'hmac_sha256', apiKey: 'mk', apiSecret: 'ms', headerName: 'X-MBX-APIKEY',
});
ok(hmac.headers['X-MBX-APIKEY'] === 'mk' && /signature=/.test(hmac.url) && /timestamp=/.test(hmac.url), 'Binance HMAC');

const conn = normalizeConnector({
  name: 'FRED',
  baseUrl: 'https://api.stlouisfed.org',
  authType: 'query',
  apiKey: 'k',
  queryName: 'api_key',
});
const built = await buildApiRequest({
  path: '/fred/series/observations',
  query: { series_id: 'FEDFUNDS', file_type: 'json' },
}, conn);
ok(built.url.startsWith('https://api.stlouisfed.org/fred/series/observations'), 'connector+path');
ok(built.url.includes('api_key=k') && built.method === 'GET', '请求带 key');

const cross = await buildApiRequest({ url: 'https://evil.test/steal' }, conn);
ok(!!cross.error, '禁止跳出连接 origin');

ok(WRITE_METHODS.has('POST') && !WRITE_METHODS.has('GET'), '写入方法集合');

ok(!publicConnector(conn).apiKey, '对外目录不含密钥');
ok(formatApiCatalog([conn]).includes('FRED') && formatApiCatalog([conn]).includes('需密钥') && !formatApiCatalog([conn]).includes('k'), '目录有名无明文密钥');
ok(formatApiCatalog([]).includes('免费无需 Key'), '空目录也提示可保存免费接口');
ok(findConnector([conn], 'fred').id === conn.id, '按名查找不区分大小写');

function mem() {
  let list = [];
  return {
    loadConnectors: async () => list.map((c) => ({ ...c })),
    saveConnectors: async (n) => { list = (n || []).map((c) => ({ ...c })); },
  };
}

const store = mem();
const saved = await executeApiCall({
  action: 'save',
  name: 'FRED',
  base_url: 'https://api.stlouisfed.org',
  auth_type: 'query',
  api_key: 'SECRETKEY',
  notes: 'observations',
}, store);
ok(saved.ok && saved.saved.hasKey && !JSON.stringify(saved).includes('SECRETKEY'), 'save 不回显密钥');

const freeSaved = await executeApiCall({
  action: 'save',
  name: 'CoinGecko',
  base_url: 'https://api.coingecko.com/api/v3',
  auth_type: 'none',
  notes: 'GET /simple/price',
}, store);
ok(freeSaved.ok && !freeSaved.saved.hasKey && /免费/.test(freeSaved.hint), '免费无需 Key 可保存');
const cat = formatApiCatalog([...(await store.loadConnectors())]);
ok(cat.includes('CoinGecko') && cat.includes('免费无需密钥') && cat.includes('优先用 connector'), '目录把免费接口列为渠道');

const noBase = await executeApiCall({ action: 'save', name: 'x' }, store);
ok(!noBase.ok && /base_url/.test(noBase.error), 'save 必须有 base_url');

const listed = await executeApiCall({ action: 'list' }, store);
ok(listed.connectors[0].name === 'FRED' && !listed.connectors[0].apiKey, 'list 无密钥字段');

const subSave = await executeApiCall({ action: 'save', name: 'x' }, { ...store, subagentKind: 'explore' });
ok(!subSave.ok, '子代理不能 save');

const writeDenied = await executeApiCall({
  action: 'request', connector: 'FRED', method: 'POST', path: '/x', body: { a: 1 },
}, store);
ok(!writeDenied.ok && /允许写入/.test(writeDenied.error), '未开写入不能 POST');

const adHocWrite = await executeApiCall({
  action: 'request', method: 'POST', url: 'https://example.com/x', body: { a: 1 },
}, store);
ok(!adHocWrite.ok, '无连接不能 POST');

let seenUrl = '';
const fakeFetch = async (url) => {
  seenUrl = url;
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ observations: [{ date: '2024-01-01', value: '5.33' }] }),
  };
};
const got = await executeApiCall({
  connector: 'FRED',
  path: '/fred/series/observations',
  query: { series_id: 'FEDFUNDS', file_type: 'json' },
}, { ...store, fetch: fakeFetch });
ok(got.ok && got.json.observations[0].value === '5.33', 'GET JSON');
ok(got.url.includes('api_key=***') && !got.url.includes('SECRETKEY'), '结果 URL 打码');
ok(seenUrl.includes('SECRETKEY'), '真实请求注入密钥');

const subPost = await executeApiCall({
  connector: 'FRED', method: 'POST', path: '/x',
}, { ...store, subagentKind: 'explore', fetch: fakeFetch });
ok(!subPost.ok, '子代理不能 POST');

ok(CALL_API_MAX_BODY >= 256 * 1024, '请求体上限');

console.log(`api-call-smoke: ${passed} passed`);
