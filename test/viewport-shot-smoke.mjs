import assert from 'node:assert/strict';
import {
  appendViewportShots,
  isViewportShotMessage,
  stripViewportShotsForStorage,
  VIEWPORT_SHOT_PREFIX,
} from '../src/lib/tool-round-messages.js';
import { convertMessages as antConvert } from '../src/lib/providers/anthropic-messages.js';
import { convertMessages as gemConvert } from '../src/lib/providers/gemini.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const shot = (n) => `data:image/jpeg;base64,${n}`;

const api = [{ role: 'tool', tool_call_id: 'c1', content: '编号表' }];
const hist = [{ role: 'tool', tool_call_id: 'c1', content: '编号表' }];
appendViewportShots(api, hist, [shot('a'), '', 'not-an-image']);
ok(api.length === 2 && isViewportShotMessage(api[1]), '截图接在工具结果之后');
ok(api[1].content.some((p) => p.type === 'image_url' && p.image_url.url === shot('a')), '像素只在 api');
ok(hist.length === 1, '分开的历史不写截图');
ok(!isViewportShotMessage({ role: 'user', content: [{ type: 'text', text: '看这张图' }, { type: 'image_url', image_url: { url: shot('u') } }] }), '用户自己贴的图不算视口截图');

const shared = [];
appendViewportShots(shared, shared, [shot('s')]);
ok(shared.length === 1 && isViewportShotMessage(shared[0]), '同一数组只追加一条');
const stored = stripViewportShotsForStorage(shared);
ok(stored[0].content === `${VIEWPORT_SHOT_PREFIX}较早的视口截图已省略，以最新一张和编号表为准。`, '落盘去掉像素');
ok(isViewportShotMessage(shared[0]), '落盘副本不改内存里的图');

const live = [];
appendViewportShots(live, live, [shot(1), shot(2), shot(3)]);
appendViewportShots(live, live, [shot(4)]);
const still = live.filter(isViewportShotMessage);
ok(still.length === 3, '最多留三张');
ok(live[0].content.startsWith(VIEWPORT_SHOT_PREFIX) && typeof live[0].content === 'string', '最早一张改成省略说明');
ok(still[2].content.some((p) => p.image_url?.url === shot(4)), '最新一张还在');

const burst = [];
appendViewportShots(burst, burst, [shot(1), shot(2), shot(3), shot(4), shot(5)]);
ok(burst.filter(isViewportShotMessage).length === 3, '一轮多张只留最后三张');

const round = [
  { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'browser_act', arguments: '{}' } }] },
  { role: 'tool', tool_call_id: 'c1', content: '编号表' },
];
appendViewportShots(round, round, [shot('p')]);
const ant = antConvert(round);
const antUsers = ant.messages.filter((m) => m.role === 'user');
ok(antUsers.length === 1, 'Anthropic 截图并进 tool_result 那条 user');
ok(antUsers[0].content.some((b) => b.type === 'tool_result') && antUsers[0].content.some((b) => b.type === 'image'), 'Anthropic 同时有结果和图片');
const gem = gemConvert(round);
const gemUsers = gem.contents.filter((m) => m.role === 'user');
ok(gemUsers.length === 1, 'Gemini 截图并进 functionResponse 那条 user');
ok(gemUsers[0].parts.some((p) => p.functionResponse) && gemUsers[0].parts.some((p) => p.inline_data), 'Gemini 同时有结果和图片');

const noted = [];
appendViewportShots(noted, noted, [{ url: shot('n'), text: '【视口截图】刚截的当前页。' }]);
ok(noted[0].content.some((p) => p.type === 'text' && p.text.includes('刚截的当前页')), '可带自定义说明');

console.log(`viewport-shot-smoke: ${passed} passed`);
