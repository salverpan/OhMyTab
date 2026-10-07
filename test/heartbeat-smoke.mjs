/* 心跳调度引擎冒烟（node test/heartbeat-smoke.mjs）。不碰 chrome.*。 */

import assert from 'node:assert';
import {
  parseScheduleFields, normalizeSchedule, normalizeWeekdays, normalizeTime,
  parseLocalDateTime, parseCron, cronNext, computeNextRunAt, formatCadence,
  cadenceToEvery,
} from '../src/lib/heartbeat.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}
function throws(fn, re, label) {
  let msg = '';
  try { fn(); } catch (e) { msg = e.message || String(e); }
  assert.ok(re.test(msg), `${label}（实际：${msg || '没抛错'}）`);
  passed += 1;
}

// —— 解析：五种类型 ——
ok(parseScheduleFields({ time: '09:00' }).type === 'daily', 'time → daily');
ok(parseScheduleFields({ time: '9:5' }) === null, '非法时间不误判');
ok(parseScheduleFields({ time: '9:05' }).time === '09:05', 'HH:MM 归一化补零');
const weekly = parseScheduleFields({ time: '09:00', weekdays: [1, 3, 5] });
ok(weekly.type === 'weekly' && weekly.weekdays.join(',') === '1,3,5', 'time+weekdays → weekly');
ok(parseScheduleFields({ weekdays: ['mon', 'wed'] }) === null, '无 time 时 weekdays 单独不成调度');
ok(parseScheduleFields({ every: '3h' }).everyMin === 180, 'every=3h → 180 分钟');
ok(parseScheduleFields({ every: '2m' }).everyMin === 5, '低于 5 分钟被抬到 5');
ok(parseScheduleFields({ cron: '0 9 * * 1-5' }).type === 'cron', 'cron → cron 类型');
ok(parseScheduleFields({}) === null, '空字段返回 null 不抛错');

// —— 一次性：未来可建、过去报错 ——
const pad = (n) => String(n).padStart(2, '0');
const future = Date.now() + 3600 * 1000;
const f = new Date(future);
const atLocal = `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}T${pad(f.getHours())}:${pad(f.getMinutes())}`;
const once = parseScheduleFields({ at: atLocal });
ok(once.type === 'once' && Math.abs(once.at - future) < 60 * 1000, 'at → once（分钟精度）');
ok(parseScheduleFields({ at: new Date(future).toISOString() }).at === future, '带 Z 的 ISO 按绝对时刻解析');
throws(() => parseScheduleFields({ at: '2020-01-01T09:00' }), /已经过去/, '过去的 at 被拒');
throws(() => parseScheduleFields({ at: '2026-02-31T09:00' }), /at 用本地时间/, '不存在的日期被拒');

// —— 解析辅助 ——
ok(normalizeWeekdays([0, 7, 'sun']).join(',') === '0', '周日 0/7/sun 归一到 0');
ok(normalizeWeekdays('1,3,5').join(',') === '1,3,5', '字符串星期');
ok(normalizeTime('23:59') === '23:59' && normalizeTime('24:00') === '', '时间边界');
ok(parseLocalDateTime('2026-09-15') === new Date(2026, 8, 15, 9, 0, 0, 0).getTime(), '只写日期默认 09:00');

// —— cron ——
throws(() => parseCron('0 9 * *'), /5 个字段/, '字段数不足被拒');
throws(() => parseCron('0 25 * * *'), /越界/, '小时越界被拒');
const from = new Date(2026, 8, 14, 10, 0, 0, 0).getTime();
const next15 = cronNext('*/15 * * * *', from);
ok(next15 - from <= 15 * 60 * 1000 && new Date(next15).getMinutes() % 15 === 0, '*/15 下一个刻度');
const nextMon = cronNext('0 9 * * 1', from);
ok(new Date(nextMon).getDay() === 1 && new Date(nextMon).getHours() === 9, '周一 9 点');
ok(cronNext('0 9 30 2 *', from) === null, '2 月 30 日一年内无解 → null');

// —— computeNextRunAt ——
const dailyTask = { schedule: { type: 'daily', time: '09:00' } };
const d1 = computeNextRunAt(dailyTask, from);
ok(new Date(d1).getHours() === 9 && d1 > from && d1 - from <= 24 * 3600 * 1000, '每天定点下一个时刻');

const wkTask = { schedule: { type: 'weekly', time: '09:00', weekdays: [1, 3, 5] } };
const w1 = computeNextRunAt(wkTask, from);
ok([1, 3, 5].includes(new Date(w1).getDay()) && new Date(w1).getHours() === 9, '每周命中的星期');

const ivTask = { schedule: { type: 'interval', everyMin: 30 }, nextRunAt: from };
ok(computeNextRunAt(ivTask, from + 10 * 60 * 1000) === from + 30 * 60 * 1000, '间隔对齐不漂移（未到点）');
ok(computeNextRunAt(ivTask, from + 65 * 60 * 1000) === from + 90 * 60 * 1000, '间隔对齐不漂移（已过点）');

const onceTask = { schedule: { type: 'once', at: from } };
ok(computeNextRunAt(onceTask, from) === null, '一次性任务过期后无下次');

// —— 旧字段兼容 ——
ok(normalizeSchedule({ everyMin: 45 }).everyMin === 45, '旧 everyMin 兼容');
ok(normalizeSchedule({ dailyAt: '07:30' }).type === 'daily', '旧 dailyAt 兼容');

// —— 展示与回读 ——
ok(formatCadence({ schedule: { type: 'interval', everyMin: 30 } }) === '每 30 分钟', '间隔文案');
ok(formatCadence({ schedule: { type: 'weekly', time: '09:00', weekdays: [1, 3, 5] } }) === '每周一、三、五 09:00', '每周文案');
ok(formatCadence({ schedule: { type: 'once', at: from } }).startsWith('仅一次'), '一次性文案');
ok(cadenceToEvery({ schedule: { type: 'cron', cron: '0 9 * * 1' } }) === 'cron:0 9 * * 1', 'cron 回读串');

// —— until（盯一段时间后自动停） ——
const untilDay = new Date(Date.now() + 5 * 24 * 3600 * 1000);
const untilStr = `${untilDay.getFullYear()}-${pad(untilDay.getMonth() + 1)}-${pad(untilDay.getDate())}`;
const watch = parseScheduleFields({ time: '09:00', until: untilStr });
ok(watch.type === 'daily' && watch.until > Date.now(), '周期 + until 叠加');
ok(new Date(watch.until).getDate() === untilDay.getDate() && new Date(watch.until).getHours() === 23, 'until 含当天到 23:59');
const capped = { schedule: { type: 'daily', time: '09:00', until: Date.now() + 60 * 1000 } };
ok(computeNextRunAt(capped, Date.now()) === null, '超出 until 不再有下次');
ok(formatCadence({ schedule: watch }).includes('至 '), '文案带截止');
throws(() => parseScheduleFields({ time: '09:00', until: '2020-01-01' }), /已经过去/, '过去的 until 被拒');

console.log(`heartbeat-smoke: ${passed} ok`);
