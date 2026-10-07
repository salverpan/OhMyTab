import assert from 'node:assert/strict';
import { interpretVisionProbeReply, isImageUnsupportedError } from '../src/lib/vision-client.js';
import { modelSupportsVision } from '../src/lib/model-capabilities.js';
import { ApiError } from '../src/lib/providers/util.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

ok(interpretVisionProbeReply('红色') === 'ok', '答红为 ok');
ok(interpretVisionProbeReply('red') === 'ok', '英文 red 为 ok');
ok(interpretVisionProbeReply('看不到') === '', '小图说看不到不标 no');
ok(interpretVisionProbeReply('I cannot see the image') === '', 'cannot see 不标 no');
ok(interpretVisionProbeReply('这是一只猫') === '', '含糊不写缓存');
ok(interpretVisionProbeReply('红色但我看不到') === '', '同时含红和看不到则保守');

ok(isImageUnsupportedError(new ApiError(400, 'this model does not support image_url')), '400+image_url 算拒图');
ok(!isImageUnsupportedError(new ApiError(500, 'image pipeline down')), '500 不算模态拒绝');
ok(!isImageUnsupportedError(new Error('no image')), '非 ApiError 不算');

ok(modelSupportsVision('gpt-4o-mini'), 'gpt-4o-mini 静态表');
ok(modelSupportsVision('kimi-vl-a3b-thinking'), 'kimi-vl 静态表');
ok(!modelSupportsVision('deepseek-chat'), '纯文本不在静态表');

console.log(`vision-probe-smoke: ${passed} passed`);
