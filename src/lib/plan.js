/**
 * 任务清单（长任务计划外置）—— 跨轮存活的 todo 列表。
 *
 * 与「调研笔记本」（notebook.js 记结论）分开：这里只记「任务走到哪一步」。
 * 每轮由 buildDynamicPreamble 注入最新清单，长任务因此不再只靠模型工作记忆；
 * 对话里由宿主渲染成一张唯一的清单卡（跟随最新一条 assistant 消息）。
 *
 * 存储：`chrome.storage.local` 的 `plan_{projectId}`（与 entries / notebook 同款）。
 * 形状：{ items: [{ text, status }], updatedAt }
 *   status: todo（待做）| doing（进行中）| done（已完成）
 *
 * 单实例约定：整段会话只保留一张清单——宿主在写入时清掉其它消息上的 plan 字段，
 * 所以历史消息里不留快照，卡片永远体现「现在在哪、还剩多少」。
 */

const MAX_PLAN_ITEMS = 30;
const MAX_ITEM_CHARS = 120;
const DIGEST_MAX_CHARS = 600;

const STATUSES = ['todo', 'doing', 'done'];

const key = (pid) => `plan_${pid || 'default'}`;

let writeChain = Promise.resolve();
function enqueue(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function normalizePlanStatus(v) {
  const s = String(v || '').toLowerCase();
  return STATUSES.includes(s) ? s : 'todo';
}

/** 归一化清单：收 string[] 或 [{text,status}]；空文本丢弃；超限截断。 */
export function normalizePlanItems(raw) {
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const items = [];
  for (const entry of list) {
    const text = String((entry && typeof entry === 'object' ? entry.text ?? entry.title : entry) ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_ITEM_CHARS);
    if (!text) continue;
    items.push({
      text,
      status: normalizePlanStatus(entry && typeof entry === 'object' ? entry.status : 'todo'),
    });
    if (items.length >= MAX_PLAN_ITEMS) break;
  }
  return items;
}

export async function getPlan(pid) {
  try {
    const k = key(pid);
    const { [k]: p } = await chrome.storage.local.get(k);
    const items = normalizePlanItems(p && p.items);
    return { items, updatedAt: Number(p && p.updatedAt) || 0 };
  } catch (_) {
    return { items: [], updatedAt: 0 };
  }
}

export function setPlan(pid, raw) {
  return enqueue(async () => {
    const items = normalizePlanItems(raw);
    if (!items.length) {
      return { error: '清单为空：items 至少要有一条（每项 {text, status?}，status 为 todo/doing/done）。' };
    }
    const plan = { items, updatedAt: Date.now() };
    await chrome.storage.local.set({ [key(pid)]: plan });
    return { ok: true, plan };
  });
}

export function clearPlan(pid) {
  return enqueue(async () => {
    const prev = await getPlan(pid);
    await chrome.storage.local.remove(key(pid));
    return { ok: true, removed: prev.items.length };
  });
}

export function planStats(plan) {
  const items = (plan && plan.items) || [];
  const done = items.filter((i) => i.status === 'done').length;
  const doing = items.filter((i) => i.status === 'doing').length;
  return { total: items.length, done, doing, todo: items.length - done - doing, allDone: items.length > 0 && done === items.length };
}

const GLYPH = { todo: '[ ]', doing: '[→]', done: '[✓]' };

/** 清单正文（不含标题），工具结果与前言共用同一份写法。 */
export function formatPlanLines(plan) {
  return ((plan && plan.items) || []).map((i) => `${GLYPH[i.status] || GLYPH.todo} ${i.text}`).join('\n');
}

/**
 * 注入动态前言的清单块。空清单返回 ''（一个字节都不占）。
 * 未完成的清单带一行催促；全部完成时只留一句收尾提示，等 plan(clear) 后消失。
 */
export function formatPlanDigest(plan, { maxChars = DIGEST_MAX_CHARS } = {}) {
  const items = (plan && plan.items) || [];
  if (!items.length) return '';
  const { total, done, allDone } = planStats(plan);
  const head = `### 当前任务清单（${done}/${total} 已完成）`;
  const lines = [];
  let used = head.length;
  for (const i of items) {
    const line = `${GLYPH[i.status] || GLYPH.todo} ${i.text}`;
    if (used + line.length > maxChars) {
      lines.push(`- …还有 ${items.length - lines.length} 项，用 plan(action="set") 重发可查看/更新`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  const tail = allDone
    ? '任务已收尾：不再需要清单时用 plan(action="clear") 清空。'
    : `未完成 ${total - done} 项。每完成一步立刻用 plan(action="set") 重发整张清单更新状态（别攒着最后一起改）。`;
  return `${head}\n${lines.join('\n')}\n${tail}`;
}

/** 工具结果文本：让模型看到自己刚写下的清单现状。 */
export function formatPlanForTool(plan) {
  const { total, done, allDone } = planStats(plan);
  return [
    `任务清单已更新（${done}/${total} 已完成）`,
    formatPlanLines(plan),
    allDone ? '全部完成，可用 plan(action="clear") 清空。' : '下一步把进行中的那一项做完，完成后立刻重发整张清单。',
  ].join('\n');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATE_LABEL = { todo: '待做', doing: '进行中', done: '已完成' };

/**
 * 清单卡 HTML（宿主渲染用；prefix 区分 chat / cw 两套皮肤）。
 * 全部完成时不展开，头部直接给结论。
 */
export function planCardHtml(plan, prefix = 'chat') {
  const items = (plan && plan.items) || [];
  if (!items.length) return '';
  const { total, done, doing, allDone } = planStats(plan);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const rows = items.map((i) => (
    `<li class="${prefix}-plan-item is-${i.status}">` +
      `<span class="${prefix}-plan-dot" aria-hidden="true"></span>` +
      `<span class="${prefix}-plan-text">${esc(i.text)}</span>` +
    `</li>`
  )).join('');
  const headState = allDone ? `✓ ${done}/${total}` : `${done}/${total}`;
  return `<details class="${prefix}-plan${allDone ? ' is-done' : ''}" data-plan-card="1"${allDone ? '' : ' open'}>` +
    `<summary class="${prefix}-plan-head">` +
      `<span class="${prefix}-plan-title">任务清单</span>` +
      `<span class="${prefix}-plan-count">${headState}</span>` +
      `<span class="${prefix}-plan-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>` +
      `<span class="${prefix}-plan-state">${STATE_LABEL[allDone ? 'done' : (doing ? 'doing' : 'todo')]}</span>` +
    `</summary>` +
    `<ol class="${prefix}-plan-list">${rows}</ol>` +
  `</details>`;
}

/**
 * 就地更新清单卡：已有卡片替换内容（保留用户展开/收起状态），
 * 没有则插到 rootEl 末尾。plan 为空时移除已有卡片。
 */
export function upsertPlanCardEl(rootEl, plan, prefix = 'chat') {
  if (!rootEl || !rootEl.querySelector) return null;
  const sel = `.${prefix}-plan[data-plan-card]`;
  const existing = rootEl.querySelector(sel);
  const html = planCardHtml(plan, prefix);
  if (!html) {
    if (existing) existing.remove();
    return null;
  }
  if (existing) {
    const wasOpen = existing.hasAttribute('open');
    existing.insertAdjacentHTML('afterend', html);
    const next = existing.nextElementSibling;
    existing.remove();
    next.toggleAttribute('open', wasOpen);
    return next;
  }
  rootEl.insertAdjacentHTML('beforeend', html);
  return rootEl.querySelector(sel);
}

/** 工具实现：宿主执行器 `case 'plan'` 直接调用（父级专属）。 */
export async function planTool(args = {}, ctx = {}) {
  const action = String(args.action || '').trim().toLowerCase();
  const pid = ctx.projectId || 'default';
  const notify = (plan) => {
    try { if (typeof ctx.onPlan === 'function') ctx.onPlan(plan); } catch (_) {}
  };

  if (action === 'set') {
    const res = await setPlan(pid, args.items);
    if (res.error) return res.error;
    notify(res.plan); // 宿主持此把清单卡就地更新
    return formatPlanForTool(res.plan);
  }

  if (action === 'clear') {
    const res = await clearPlan(pid);
    if (res.error) return res.error;
    notify(null); // 清单清空 = 卡片撤下
    return `任务清单已清空（原 ${res.removed} 项）。`;
  }

  if (action === 'get') {
    const plan = await getPlan(pid);
    if (!plan.items.length) return '当前没有任务清单。预计 5 步以上的任务先 plan(action="set") 建一张。';
    return formatPlanForTool(plan);
  }

  return 'action 只支持 set（整表重发）/ get（读回）/ clear（清空）。set 需要 items：[{text, status?}]，status 为 todo/doing/done。';
}

export { MAX_PLAN_ITEMS, MAX_ITEM_CHARS, DIGEST_MAX_CHARS as PLAN_DIGEST_MAX_CHARS, STATUSES as PLAN_STATUSES };
