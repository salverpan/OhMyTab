/**
 * 心跳定时任务（ChatGPT Tasks / agent heartbeat 模式）。
 *
 * 调度走 chrome.alarms 分钟 tick（MV3 最小粒度）。到期后本质是一次定时发送：
 * 侧栏开着就交给它走同一条对话发送（看得见、点停止就能停）；侧栏没开才由
 * Service Worker 后台执行。后台结果写入 heartbeatInbox_<pid>，侧栏只读合并。
 * 同一 tick 多个到期任务可并行领取，再按宿主串行或并行跑。任务按项目隔离。
 *
 * 时间模型见下方「调度模型」：once / interval / daily / weekly / cron，
 * 全部按用户本地时区解释；旧的 everyMin / dailyAt 字段仍可读。
 *
 * 纯模块：SW / sidepanel / chat-executor 共用，不碰 DOM。
 */

export const HEARTBEAT_ALARM = 'citecat-heartbeat-tick';
export const HEARTBEAT_STORAGE_KEY = 'heartbeatTasks';
export const HEARTBEAT_MAX_TASKS = 20;
export const HEARTBEAT_MIN_INTERVAL_MIN = 5;
export const HEARTBEAT_MAX_RUNS = 50;
/** SW 在心跳执行中途被杀时 lastStatus 会停在 running；超过此时长视为过期，允许再次调度 */
export const HEARTBEAT_STALE_RUNNING_MS = 10 * 60 * 1000;

/** 每个项目一份「任务线程」映射：{ [taskId]: { history, summary, updatedAt } }。
 *  心跳在 SW 后台独立执行，不能和侧栏项目会话共用历史，否则并行任务会互相覆盖。 */
export function heartbeatSessionsKey(projectId) {
  return `heartbeatSessions_${projectId || 'default'}`;
}

/** 后台心跳写回侧栏项目聊天的 UI 气泡；sidepanel 只读并合并，不参与写。 */
export function heartbeatInboxKey(projectId) {
  return `heartbeatInbox_${projectId || 'default'}`;
}

const PRESETS = [
  { every: '5m', everyMin: 5, label: '每 5 分钟' },
  { every: '15m', everyMin: 15, label: '每 15 分钟' },
  { every: '30m', everyMin: 30, label: '每 30 分钟' },
  { every: '1h', everyMin: 60, label: '每小时' },
  { every: '2h', everyMin: 120, label: '每 2 小时' },
  { every: '6h', everyMin: 360, label: '每 6 小时' },
  { every: '12h', everyMin: 720, label: '每 12 小时' },
  { every: '1d', everyMin: 1440, label: '每天' },
];

export function heartbeatPresets() {
  return PRESETS.slice();
}

/** "30m" / "2h" / "1d" / "09:00"（每天本地时间） */
export function parseEvery(every) {
  const s = String(every || '').trim();
  const hm = s.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (hm) return { dailyAt: `${hm[1].padStart(2, '0')}:${hm[2]}`, everyMin: null };
  const m = s.match(/^(\d+)\s*(m|min|h|d)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  let everyMin = n;
  if (unit === 'h') everyMin = n * 60;
  if (unit === 'd') everyMin = n * 1440;
  if (everyMin < HEARTBEAT_MIN_INTERVAL_MIN) everyMin = HEARTBEAT_MIN_INTERVAL_MIN;
  return { everyMin, dailyAt: null };
}

/* ---------- 调度模型 ----------
 * 成熟做法（Google Calendar RRULE / Apple UNCalendarNotificationTrigger /
 * systemd OnCalendar / ZCode CronCreate 的共性）：**类型显式化 + 精确表达式兜底**，
 * 而不是让模型拼一个自由字符串。task.schedule = {type, ...}：
 *   once     {at}              绝对本地时刻，跑一次后自动停用
 *   interval {everyMin}        固定间隔（对齐上次计划时间，不随执行耗时漂移）
 *   daily    {time}            HH:MM
 *   weekly   {time, weekdays}  weekdays 0=周日 … 6=周六
 *   cron     {cron}            5 字段（分 时 日 月 周），本地时区
 * 旧字段 everyMin / dailyAt 仍可读（normalizeSchedule 兜底），新写入一律落 schedule。
 */

export const HEARTBEAT_SCHEDULE_TYPES = ['once', 'interval', 'daily', 'weekly', 'cron'];
export const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

const WD_EN = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export function normalizeTime(v) {
  const m = String(v || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** 接受 [1,3,5] / ['mon','wed'] / '1,3,5' / 0-7（7 视作周日） */
export function normalizeWeekdays(v) {
  const arr = Array.isArray(v) ? v : (v == null || v === '' ? [] : String(v).split(/[,，\s]+/));
  const out = [];
  for (const raw of arr) {
    let n = NaN;
    if (typeof raw === 'number') n = raw;
    else {
      const s = String(raw).trim().toLowerCase();
      if (WD_EN[s] !== undefined) n = WD_EN[s];
      else if (/^[0-7]$/.test(s)) n = Number(s) % 7;
      else if (s === '日' || s === '天') n = 0;
    }
    if (Number.isInteger(n) && n >= 0 && n <= 6 && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** "2026-09-15T09:00" / "2026-09-15 09:00" / "2026-09-15"（默认 09:00）→ 本地时间戳 */
export function parseLocalDateTime(v) {
  const s = String(v || '').trim();
  let y; let mo; let d; let h = 9; let mi = 0;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/);
  if (m) {
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]); h = Number(m[4]); mi = Number(m[5]);
  } else {
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
  }
  if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  // 溢出校验：2026-02-31 会被 Date 静默滚到 3 月
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.getTime();
}

/* ---------- cron（5 字段：分 时 日 月 周） ---------- */
const CRON_BOUNDS = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];

function parseCronField(part, [min, max]) {
  const set = new Set();
  for (const chunk of String(part).split(',')) {
    const [range, stepRaw] = chunk.split('/');
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) throw new Error(`cron 步长无效：${chunk}`);
    let lo; let hi;
    if (range === '*') { lo = min; hi = max; }
    else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      lo = a; hi = b;
    } else { lo = Number(range); hi = lo; }
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`cron 字段越界：${chunk}（允许 ${min}-${max}）`);
    }
    for (let i = lo; i <= hi; i += step) set.add(i);
  }
  return set;
}

export function parseCron(expr) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('cron 需要 5 个字段：分 时 日 月 周（例：0 9 * * 1-5）');
  const sets = parts.map((p, i) => parseCronField(p, CRON_BOUNDS[i]));
  if (parts[4].includes('7')) sets[4].add(0); // 周日写 0 或 7 都收
  return { sets, domRestricted: parts[2] !== '*', dowRestricted: parts[4] !== '*' };
}

/** 下一个命中时刻（本地时区）；一年内没有就返回 null。 */
export function cronNext(expr, from = Date.now()) {
  const { sets, domRestricted, dowRestricted } = parseCron(expr);
  const [mins, hours, doms, months, dows] = sets;
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = from + 366 * 24 * 3600 * 1000;
  while (d.getTime() <= limit) {
    if (!months.has(d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue; }
    // cron 经典语义：日与周都被限制时取「或」，否则取「与」
    const dayOk = (domRestricted && dowRestricted)
      ? (doms.has(d.getDate()) || dows.has(d.getDay()))
      : (doms.has(d.getDate()) && dows.has(d.getDay()));
    if (!dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
    if (!hours.has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
    if (!mins.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0, 0); continue; }
    return d.getTime();
  }
  return null;
}

/* ---------- schedule 归一化 / 解析 ---------- */

export function normalizeSchedule(task) {
  const s = task && task.schedule;
  if (s && HEARTBEAT_SCHEDULE_TYPES.includes(s.type)) return s;
  if (task && task.dailyAt) return { type: 'daily', time: task.dailyAt };
  return {
    type: 'interval',
    everyMin: Math.max(HEARTBEAT_MIN_INTERVAL_MIN, Number(task && task.everyMin) || 30),
  };
}

/** at 取值：带 Z / 时区偏移的按绝对时刻（AI 常给 ISO），否则按本地时间。 */
function parseAtValue(v) {
  const s = String(v || '').trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
  }
  return parseLocalDateTime(s);
}

/** until：日期（含当天 23:59:59）或本地时刻；非法抛错。 */
function parseUntilDate(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const d = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (d) {
    const y = Number(d[1]); const mo = Number(d[2]); const day = Number(d[3]);
    const dt = new Date(y, mo - 1, day, 23, 59, 59, 999);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) {
      throw new Error('until 日期不存在');
    }
    return dt.getTime();
  }
  const ms = parseAtValue(s);
  if (ms == null) throw new Error('until 用日期 2026-01-31（含当天）或本地时间');
  return ms;
}

/**
 * 从工具参数 / UI 表单字段解析 schedule；无调度信息返回 null，非法抛错。
 * `until` 可叠加在任意周期上（「1 月每天查一次」），到点后自动停用。
 */
export function parseScheduleFields(fields = {}) {
  const sched = parseScheduleBase(fields);
  if (!sched) return null;
  if (sched.type !== 'once') {
    const until = parseUntilDate(fields.until);
    if (until != null) {
      if (until <= Date.now()) throw new Error('until 指定的截止日期已经过去');
      sched.until = until;
    }
  }
  return sched;
}

function parseScheduleBase(fields = {}) {
  const cron = String(fields.cron || '').trim();
  if (cron) { parseCron(cron); return { type: 'cron', cron }; }

  const at = String(fields.at || '').trim();
  if (at) {
    const ms = parseAtValue(at);
    if (!ms) throw new Error('at 用本地时间 2026-09-15T09:00（只写日期则默认 09:00，也可给带时区的 ISO）');
    if (ms <= Date.now()) throw new Error('at 指定的时间已经过去，请确认日期；要立刻执行就别用定时任务');
    return { type: 'once', at: ms };
  }

  const time = normalizeTime(fields.time);
  if (time) {
    const weekdays = normalizeWeekdays(fields.weekdays);
    return weekdays.length ? { type: 'weekly', time, weekdays } : { type: 'daily', time };
  }

  const every = String(fields.every || '').trim();
  if (every) {
    const parsed = parseEvery(every);
    if (!parsed) throw new Error('every 用 30m / 3h / 1d（最短 5 分钟），或每天时间 09:00');
    return parsed.dailyAt
      ? { type: 'daily', time: parsed.dailyAt }
      : { type: 'interval', everyMin: parsed.everyMin };
  }

  const everyMin = Number(fields.everyMin);
  if (Number.isFinite(everyMin) && everyMin > 0) {
    return { type: 'interval', everyMin: Math.max(HEARTBEAT_MIN_INTERVAL_MIN, Math.floor(everyMin)) };
  }
  return null;
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 下一个 HH:MM（可选限定星期几）。 */
function nextTimeOfDay(time, from, weekdays) {
  const [h, m] = String(time).split(':').map(Number);
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(h || 0, m || 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (d.getTime() > from && (!weekdays || !weekdays.length || weekdays.includes(d.getDay()))) {
      return d.getTime();
    }
    d.setDate(d.getDate() + 1);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return null;
}

export function formatCadence(task) {
  const s = normalizeSchedule(task);
  let base;
  if (s.type === 'once') {
    const d = new Date(Number(s.at));
    base = `仅一次 ${d.getMonth() + 1}/${d.getDate()} ${hhmm(d)}`;
  } else if (s.type === 'cron') {
    base = `cron「${s.cron}」`;
  } else if (s.type === 'weekly') {
    base = `每周${(s.weekdays || []).map((n) => WEEKDAY_LABEL[n]).join('、')} ${s.time}`;
  } else if (s.type === 'daily') {
    base = `每天 ${s.time}`;
  } else {
    const min = Number(s.everyMin) || 0;
    const hit = PRESETS.find((p) => p.everyMin === min);
    if (hit) base = hit.label;
    else if (min >= 1440 && min % 1440 === 0) base = `每 ${min / 1440} 天`;
    else if (min >= 60 && min % 60 === 0) base = `每 ${min / 60} 小时`;
    else base = min ? `每 ${min} 分钟` : '未设置';
  }
  if (s.until) {
    const u = new Date(Number(s.until));
    base += `，至 ${u.getMonth() + 1}/${u.getDate()}`;
  }
  return base;
}

export function computeNextRunAt(task, from = Date.now()) {
  const s = normalizeSchedule(task);
  const next = computeNextRaw(s, task, from);
  if (next == null) return null;
  const until = Number(s.until) || 0;
  return (until && next > until) ? null : next; // 超出截止范围就停
}

/** 两个时间戳是否落在用户本地的同一天。 */
export function sameLocalDay(a, b = Date.now()) {
  const x = new Date(Number(a));
  const y = new Date(Number(b));
  if (!Number.isFinite(x.getTime()) || !Number.isFinite(y.getTime())) return false;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * 错过的计划只在当天补跑。隔日的那一轮丢掉：把 nextRunAt 推到今天或未来，
 * 跨夜卡住的 running 也清掉，不再把昨天的任务拿出来重试。
 * 直接改传入的 task（claim 落盘 / 调用方可先拷一份做预览）。
 */
export function skipExpiredRun(task, now = Date.now()) {
  if (!task) return false;
  let changed = false;
  const started = Number(task.runStartedAt || task.updatedAt || 0);
  if (task.lastStatus === 'running' && started && !sameLocalDay(started, now)) {
    task.lastStatus = 'ok';
    task.lastError = '';
    task.runner = null;
    task.runStartedAt = null;
    task.queued = false;
    changed = true;
  }
  const due = Number(task.nextRunAt) || 0;
  if (!due || due > now || sameLocalDay(due, now)) {
    if (changed) task.updatedAt = now;
    return changed;
  }
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const next = computeNextRunAt(task, startToday.getTime() - 1);
  if (next == null) {
    task.enabled = false;
    task.nextRunAt = null;
  } else {
    task.nextRunAt = next;
  }
  task.updatedAt = now;
  return true;
}

/** 展示用：隔日过期时预览跳过后的下次，不改存储。 */
export function effectiveNextRunAt(task, now = Date.now()) {
  if (!task) return null;
  const due = Number(task.nextRunAt) || 0;
  if (!due) return null;
  if (due > now || sameLocalDay(due, now)) return due;
  const probe = { ...task, nextRunAt: due };
  skipExpiredRun(probe, now);
  return probe.nextRunAt || null;
}

function computeNextRaw(s, task, from) {
  if (s.type === 'once') return Number(s.at) > from ? Number(s.at) : null;
  if (s.type === 'cron') return cronNext(s.cron, from);
  if (s.type === 'weekly') return nextTimeOfDay(s.time, from, s.weekdays);
  if (s.type === 'daily') return nextTimeOfDay(s.time, from, null);

  // interval：从「上次计划时刻」往后推整倍数，避免每跑一次就往后漂一段
  const step = Math.max(HEARTBEAT_MIN_INTERVAL_MIN, Number(s.everyMin) || 30) * 60000;
  const prev = Number(task && task.nextRunAt) || 0;
  if (prev > from) return prev;
  if (!prev) return from + step;
  return prev + (Math.floor((from - prev) / step) + 1) * step;
}

/** AI list 输出用：把 schedule 折回一个可读/可再传入的紧凑字符串。 */
export function cadenceToEvery(task) {
  const s = normalizeSchedule(task);
  if (s.type === 'once') return `at:${new Date(Number(s.at)).toISOString()}`;
  if (s.type === 'cron') return `cron:${s.cron}`;
  if (s.type === 'weekly') return `${s.time}@${(s.weekdays || []).join(',')}`;
  if (s.type === 'daily') return s.time;
  const min = Number(s.everyMin) || 30;
  const hit = PRESETS.find((p) => p.everyMin === min);
  return hit ? hit.every : `${min}m`;
}

async function readAll() {
  const { [HEARTBEAT_STORAGE_KEY]: tasks } = await chrome.storage.local.get(HEARTBEAT_STORAGE_KEY);
  return Array.isArray(tasks) ? tasks : [];
}

async function writeAll(tasks) {
  await chrome.storage.local.set({ [HEARTBEAT_STORAGE_KEY]: tasks });
  await ensureHeartbeatAlarm(tasks);
}

/** 跨 SW / 侧栏串行化任务表读改写，避免收尾把刚删的任务写回去。 */
let heartbeatTasksLockTail = Promise.resolve();
export async function withHeartbeatTasksLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request('citecat-heartbeat-tasks', fn);
  }
  const run = heartbeatTasksLockTail.then(() => fn(), () => fn());
  heartbeatTasksLockTail = run.then(() => undefined, () => undefined);
  return run;
}

/** 缺省 / 旧数据一律归 default，避免切项目时漏网或串库。 */
export function heartbeatProjectId(task) {
  return String((task && task.projectId) || 'default');
}

export function taskBelongsToProject(task, projectId) {
  if (!projectId) return true;
  return heartbeatProjectId(task) === String(projectId);
}

/** 正在跑、且还没被当成 SW 被杀后的过期 running。 */
export function isHeartbeatTaskRunning(task, now = Date.now()) {
  if (!task || task.lastStatus !== 'running') return false;
  const started = Number(task.updatedAt || task.runStartedAt || 0);
  if (!started) return true;
  return now - started <= HEARTBEAT_STALE_RUNNING_MS;
}

/** 项目页呼吸灯：所有仍在跑的心跳所属项目。 */
export function runningHeartbeatProjectIds(tasks, now = Date.now()) {
  const ids = new Set();
  for (const t of tasks || []) {
    if (isHeartbeatTaskRunning(t, now)) ids.add(heartbeatProjectId(t));
  }
  return ids;
}

export async function listHeartbeatTasks(projectId) {
  const all = await readAll();
  if (!projectId) return all;
  return all.filter((t) => taskBelongsToProject(t, projectId));
}

export async function getHeartbeatTask(id) {
  return (await readAll()).find((t) => t.id === id) || null;
}

/** 删掉全部心跳（含无主项目的孤儿）。设置页「删除所有项目」用。撤销走 restoreHeartbeatTasks。 */
export async function purgeAllHeartbeatTasks() {
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const pids = new Set(all.map((t) => heartbeatProjectId(t)));
    await writeAll([]);
    const keys = [];
    for (const pid of pids) {
      keys.push(heartbeatSessionsKey(pid), heartbeatInboxKey(pid));
    }
    if (keys.length) {
      try { await chrome.storage.local.remove(keys); } catch (_) {}
    }
    return all;
  });
}

/** 删库时抽走该项目的心跳任务；撤销用 restoreHeartbeatTasks 写回。 */
export async function purgeHeartbeatTasks(projectId) {
  const pid = String(projectId || 'default');
  const removed = await withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const keep = [];
    const gone = [];
    for (const t of all) {
      if (taskBelongsToProject(t, pid)) gone.push(t);
      else keep.push(t);
    }
    if (gone.length) await writeAll(keep);
    return gone;
  });
  // 心跳线程与后台结果气泡跟项目一起删；否则删库后仍留孤儿历史。
  try {
    await chrome.storage.local.remove([heartbeatSessionsKey(pid), heartbeatInboxKey(pid)]);
  } catch (_) {}
  return removed;
}

export async function restoreHeartbeatTasks(tasks) {
  if (!tasks || !tasks.length) return;
  await withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const ids = new Set(all.map((t) => t.id));
    let changed = false;
    for (const t of tasks) {
      if (!t || !t.id || ids.has(t.id)) continue;
      all.push(t);
      ids.add(t.id);
      changed = true;
    }
    if (changed) await writeAll(all);
  });
}

export async function upsertHeartbeatTask(fields, { projectId, createdBy = 'user' } = {}) {
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const now = Date.now();
    if (fields.id) {
      const idx = all.findIndex((t) => t.id === fields.id);
      if (idx < 0) throw new Error('找不到该心跳任务');
      const { projectId: _ignorePid, ...patch } = fields;
      const next = { ...all[idx], ...patch, updatedAt: now, projectId: heartbeatProjectId(all[idx]) };
      for (const k of SCHEDULE_FIELD_KEYS) delete next[k]; // 原始字段不落库，只留 schedule
      if (applyCadence(next, fields) && next.enabled !== false) {
        next.nextRunAt = null; // 改了周期就重排，不继承旧时刻
        next.nextRunAt = computeNextRunAt(next, now);
      }
      all[idx] = next;
      if (fields.enabled === true) next.nextRunAt = computeNextRunAt(next, now);
      await writeAll(all);
      return next;
    }
    const pid = String(projectId || 'default');
    const mine = all.filter((t) => taskBelongsToProject(t, pid));
    if (mine.length >= HEARTBEAT_MAX_TASKS) {
      throw new Error(`该项目心跳任务最多 ${HEARTBEAT_MAX_TASKS} 条，请先删掉不用的`);
    }
    const task = {
      id: 'hb_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      projectId: pid,
      name: String(fields.name || '').trim() || '未命名任务',
      prompt: String(fields.prompt || '').trim(),
      enabled: fields.enabled !== false,
      schedule: { type: 'interval', everyMin: 30 },
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      nextRunAt: null,
      lastStatus: null,
      lastError: '',
      queued: false,
      runner: null,
      createdBy,
    };
    applyCadence(task, fields);
    if (!task.prompt) throw new Error('心跳任务需要 prompt（到期后 AI 要做的事）');
    task.nextRunAt = computeNextRunAt(task, now);
    all.push(task);
    await writeAll(all);
    return task;
  });
}

const SCHEDULE_FIELD_KEYS = ['every', 'everyMin', 'dailyAt', 'time', 'weekdays', 'at', 'cron', 'until'];

function applyCadence(task, fields) {
  const sched = parseScheduleFields(fields);
  if (!sched) return false;
  task.schedule = sched;
  // 旧字段不再写入；normalizeSchedule 对历史数据仍兼容读取
  task.everyMin = null;
  task.dailyAt = null;
  return true;
}

async function clearHeartbeatTaskData(task) {
  if (!task || !task.id) return;
  const pid = heartbeatProjectId(task);
  const sessionsKey = heartbeatSessionsKey(pid);
  const inboxKey = heartbeatInboxKey(pid);
  try {
    const data = await chrome.storage.local.get([sessionsKey, inboxKey]);
    const sessions = data[sessionsKey] && typeof data[sessionsKey] === 'object'
      ? { ...data[sessionsKey] } : null;
    const inbox = Array.isArray(data[inboxKey]) ? data[inboxKey] : null;
    const patch = {};
    if (sessions && Object.prototype.hasOwnProperty.call(sessions, task.id)) {
      delete sessions[task.id];
      patch[sessionsKey] = sessions;
    }
    if (inbox && inbox.some((m) => m && m.taskId === task.id)) {
      patch[inboxKey] = inbox.filter((m) => !m || m.taskId !== task.id);
    }
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  } catch (_) {}
}

export async function deleteHeartbeatTask(id) {
  const task = await withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const found = all.find((t) => t.id === id) || null;
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length) throw new Error('找不到该心跳任务');
    await writeAll(next);
    return found;
  });
  await clearHeartbeatTaskData(task);
}

export async function setHeartbeatEnabled(id, enabled) {
  return upsertHeartbeatTask({ id, enabled: !!enabled });
}

export async function dueHeartbeatTasks(now = Date.now()) {
  return (await readAll()).filter((t) => {
    if (t.enabled === false) return false;
    if (!t.nextRunAt) return false; // 一次性任务跑完 nextRunAt=null 且已停用，双保险
    if (Number(t.nextRunAt) > now) return false;
    if (!sameLocalDay(t.nextRunAt, now)) return false; // 隔日过期不补跑
    if (t.lastStatus === 'running') {
      return now - Number(t.updatedAt || 0) > HEARTBEAT_STALE_RUNNING_MS;
    }
    return true;
  });
}

/**
 * 原子领取到期任务：一次读改写把 lastStatus 标成 running，避免同一 tick / 多上下文重复执行。
 * 领取后 runner 仍为空，侧栏或 SW 再 adoptHeartbeatRun 争谁来发这一轮。
 */
export async function claimDueHeartbeatTasks(now = Date.now()) {
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const claimed = [];
    let changed = false;
    for (const t of all) {
      if (t.enabled === false || !t.nextRunAt) continue;
      if (skipExpiredRun(t, now)) changed = true;
      if (t.enabled === false || !t.nextRunAt || Number(t.nextRunAt) > now) continue;
      if (!sameLocalDay(t.nextRunAt, now)) continue;
      const started = Number(t.runStartedAt || t.updatedAt || 0);
      if (
        t.lastStatus === 'running'
        && now - Number(t.updatedAt || 0) <= HEARTBEAT_STALE_RUNNING_MS
        && sameLocalDay(started || t.nextRunAt, now)
      ) continue;
      t.lastStatus = 'running';
      t.runner = null;
      t.runStartedAt = now;
      t.queued = false;
      t.updatedAt = now;
      changed = true;
      claimed.push({ ...t });
    }
    if (changed) await writeAll(all);
    return claimed;
  });
}

/**
 * 侧栏 / SW 争这一轮的执行权。同一 runner 再 adopt 是幂等成功。
 * 返回 false 表示任务没了、已经结束，或被另一方抢走。
 */
export async function adoptHeartbeatRun(id, runner) {
  const role = String(runner || '');
  if (!id || (role !== 'panel' && role !== 'sw')) return false;
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const t = all.find((x) => x.id === id);
    if (!t || t.lastStatus !== 'running') return false;
    if (t.runner && t.runner !== role) return false;
    if (t.runner === role) return true;
    t.runner = role;
    t.updatedAt = Date.now();
    await writeAll(all);
    return true;
  });
}

export async function queuedHeartbeatTasks(projectId) {
  const all = await readAll();
  return all.filter((t) => t.queued && taskBelongsToProject(t, projectId));
}

export async function markHeartbeatQueued(ids) {
  if (!ids || !ids.length) return;
  const set = new Set(ids);
  await withHeartbeatTasksLock(async () => {
    const all = await readAll();
    let changed = false;
    for (const t of all) {
      if (set.has(t.id) && !t.queued) {
        t.queued = true;
        t.updatedAt = Date.now();
        changed = true;
      }
    }
    if (changed) await writeAll(all);
  });
}

export async function markHeartbeatRunning(id) {
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const t = all.find((x) => x.id === id);
    if (!t) return null;
    t.lastStatus = 'running';
    t.runner = t.runner || 'sw';
    t.runStartedAt = Date.now();
    t.queued = false;
    t.updatedAt = Date.now();
    await writeAll(all);
    return t;
  });
}

/** 每次运行留一条流水，供项目概览时间线使用；只保留最近 HEARTBEAT_MAX_RUNS 条。 */
export function appendRunRecord(runs, record) {
  const list = Array.isArray(runs) ? runs.slice() : [];
  list.push(record);
  return list.slice(-HEARTBEAT_MAX_RUNS);
}

export async function markHeartbeatFinished(id, { ok, error, result, runStartedAt } = {}) {
  return withHeartbeatTasksLock(async () => {
    const all = await readAll();
    const t = all.find((x) => x.id === id);
    if (!t) return null;
    if (t.lastStatus !== 'running') return t;
    if (runStartedAt && Number(t.runStartedAt || 0) && Number(t.runStartedAt) !== Number(runStartedAt)) {
      return t;
    }
    const now = Date.now();
    t.lastStatus = ok ? 'ok' : 'error';
    t.lastError = ok ? '' : String(error || '失败');
    t.lastRunAt = now;
    t.queued = false;
    t.runner = null;
    if (result != null) t.lastResult = String(result || '').slice(0, 4000);
    t.runs = appendRunRecord(t.runs, {
      at: Number(t.runStartedAt) || now,
      endedAt: now,
      status: ok ? 'ok' : 'error',
      durationMs: t.runStartedAt ? Math.max(0, now - Number(t.runStartedAt)) : 0,
      error: ok ? '' : String(error || '失败').slice(0, 200),
      result: result != null ? String(result || '').slice(0, 240) : '',
    });
    t.runStartedAt = null;
    const s = normalizeSchedule(t);
    if (t.enabled === false) {
      // 暂停中：保持原计划不动
    } else if (s.type === 'once') {
      t.enabled = false;      // 一次性任务跑完自动停用
      t.nextRunAt = null;
    } else {
      const next = computeNextRunAt(t, now);
      if (next == null) {
        // until 已过且没完成：停用但保留（用户要看得见它没成）
        t.enabled = false;
        t.nextRunAt = null;
      } else {
        t.nextRunAt = next;
      }
    }
    t.updatedAt = now;
    await writeAll(all);
    return t;
  });
}

export async function queuedOrDueCount(projectId) {
  const now = Date.now();
  const list = await listHeartbeatTasks(projectId);
  return list.filter((t) => t.enabled !== false
    && t.lastStatus !== 'running'
    && (t.queued || Number(t.nextRunAt || 0) <= now)
    && sameLocalDay(Number(t.nextRunAt || t.updatedAt || 0), now)).length;
}

export async function ensureHeartbeatAlarm(tasks) {
  const list = tasks || await readAll();
  const need = list.some((t) => t.enabled !== false);
  try {
    if (!need) {
      await chrome.alarms.clear(HEARTBEAT_ALARM);
      return;
    }
    const existing = await chrome.alarms.get(HEARTBEAT_ALARM);
    if (existing) return;
    chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
  } catch (_) { /* SW 以外的上下文可能没有 alarms */ }
}

export function heartbeatUserText(task) {
  return `【心跳任务：${task.name}】\n${task.prompt}\n\n`
    + '（这是定时触发的任务，不是用户刚刚输入。用现有工具尽快做完，几句话汇报结果，不要反问。\n'
    + `本任务 id=${task.id}：如果这次已经达成目标（比如要等的日期/结果已公布），调用 manage_heartbeat(action="complete") 结束本任务；`
    + '只是暂时没查到就照常汇报，不要删，下次还会继续。\n'
    + '如果本任务是在持续追踪某个对象（价格、事件进展等），按「观察-判断-验证-修正」记到笔记本，'
    + '写入的笔记会自动归入本任务的时间线（无需手填 thread_id）：\n'
    + `1) 先 notebook(action="list", thread_id="${task.id}", status="open") 复查上一轮的待核实判断：`
    + '已到 verify_at 或出现新事实的，update 为 verified（判对）并写 reason；\n'
    + '2) 发现旧判断错了：add 一条新判断并设 supersedes=旧笔记 id、reason=为什么错（旧笔记会自动转 refuted），不要直接删旧的；\n'
    + '3) 记录本次观测：add kind="observation"，claim 写具体数值/事实，sources 填来源 URL；\n'
    + '4) 有可验证的预测就 add kind="judgment"，给 confidence 和 verify_at。\n'
    + '汇报时点明本轮哪些判断被验证、哪些被推翻。）';
}
