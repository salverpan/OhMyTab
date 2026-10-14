import assert from 'node:assert/strict';
import { isImageUnsupportedError } from '../src/lib/vision-client.js';
import { ApiError } from '../src/lib/providers/util.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(isImageUnsupportedError(new ApiError(400, 'this model does not support image_url')), '400+image_url 算拒图');
ok(!isImageUnsupportedError(new ApiError(500, 'image pipeline down')), '500 不算模态拒绝');
ok(!isImageUnsupportedError(new Error('no image')), '非 ApiError 不算');

console.log(`vision-probe-smoke: ${passed} passed`);
