/**
 * 文档「修改痕迹」—— doc_edit 每次改动留下的可验收证据。
 *
 * 三个引擎（docx / xlsx / txt）在改动时把 {op, location, before, after, note}
 * 记进返回值；执行器据此挂到当轮 assistant 消息上，宿主渲染成对话里的修改卡
 * （对照 Cursor 的 diff 视图），同时把紧凑版回喂模型当自证材料。
 *
 * 数据不落新库：卡片随 chatSession 的 messages 一起落盘（msg.docEdits）。
 */

/** 单侧文本在记录里的上限（卡片是预览，不是全文）。 */
export const EDIT_PREVIEW_CHARS = 240;
/** 回喂模型时的单侧上限（只用于自证，越短越好）。 */
const MODEL_EDIT_CHARS = 60;
/** 卡片里最多展示的改动块数（超出的折叠成一句）。 */
const CARD_MAX_ITEMS = 40;

const OP_LABEL = {
  replace: '替换',
  insert: '新增',
  delete: '删除',
  format: '格式',
  table: '表格',
  cell: '单元格',
  sheet: '工作表',
  append: '追加',
  review: '修订',
};

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export function opLabel(op) {
  return OP_LABEL[String(op || '')] || '修改';
}

/** 归一化一条改动记录（引擎侧调用；字符串一律 String() 包裹防数字炸掉）。 */
export function makeEdit({ op, location, before, after, note } = {}) {
  return {
    op: String(op || 'replace'),
    location: clip(location, 60),
    before: clip(before, EDIT_PREVIEW_CHARS),
    after: clip(after, EDIT_PREVIEW_CHARS),
    note: clip(note, 60),
  };
}

/** 一次 doc_edit 调用的卡片。 */
export function makeEditsCard({ doc_id, doc_name, tool, edits } = {}) {
  const list = (Array.isArray(edits) ? edits : []).filter(Boolean);
  if (!list.length) return null;
  const id = String(doc_id || doc_name || 'doc');
  return {
    id,
    doc_id: String(doc_id || ''),
    doc_name: String(doc_name || ''),
    tool: String(tool || ''),
    at: Date.now(),
    edits: list,
  };
}

/** 同一文档的多次编辑合并进同一张卡（追加改动块，保留首次出现顺序）。 */
export function mergeEditsCard(prev, next) {
  if (!prev) return next || null;
  if (!next) return prev;
  if (String(prev.id) !== String(next.id)) return next;
  return {
    ...prev,
    ...next,
    edits: [...(prev.edits || []), ...(next.edits || [])],
    at: next.at || prev.at,
  };
}

/** 把新卡并入列表：同 doc 合并，否则追加。 */
export function mergeEditsIntoList(list, card) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (!card) return arr;
  const idx = arr.findIndex((c) => String(c.id) === String(card.id));
  if (idx >= 0) arr[idx] = mergeEditsCard(arr[idx], card);
  else arr.push(card);
  return arr;
}

/**
 * 回喂模型的紧凑摘要：让它知道自己刚改了哪几处的哪几段文字，
 * 汇报时据此说人话（而不是复述 summary）。
 */
export function formatEditsForModel(card) {
  if (!card || !card.edits || !card.edits.length) return '';
  const list = card.edits;
  const lines = list.slice(0, 8).map((e) => {
    const loc = e.location ? `（${e.location}）` : '';
    if (e.op === 'review') return `- ${e.note || '修订已处理'}`;
    if (e.op === 'format') return `- ${loc}${e.note || '格式'}「${clip(e.before, MODEL_EDIT_CHARS)}」`;
    if (e.op === 'insert') return `- ${loc}新增：「${clip(e.after, MODEL_EDIT_CHARS)}」`;
    if (e.op === 'delete') return `- ${loc}删除：「${clip(e.before, MODEL_EDIT_CHARS)}」`;
    return `- ${loc}「${clip(e.before, MODEL_EDIT_CHARS)}」→「${clip(e.after, MODEL_EDIT_CHARS)}」`;
  });
  const extra = list.length > 8 ? `\n…另有 ${list.length - 8} 处（对话里的修改卡可看全）` : '';
  const who = card.doc_name || card.doc_id || '文档';
  return `\n本次改动痕迹已挂到对话里（${who} · ${list.length} 处）：\n${lines.join('\n')}${extra}\n` +
    '（这是你自己刚做的改动：向用户汇报时说清改了哪几处、改成什么，不要只说「已完成」；也不必复述全部痕迹。）';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function editBlockHtml(e, prefix) {
  const label = opLabel(e.op);
  const loc = e.location ? `<span class="${prefix}-diff-loc">${esc(e.location)}</span>` : '';
  const note = e.note ? `<span class="${prefix}-diff-note">${esc(e.note)}</span>` : '';
  const head = `<div class="${prefix}-diff-item-head">${loc}<span class="${prefix}-diff-op">${esc(label)}</span>${note}</div>`;
  const same = e.before && e.after && e.before === e.after;
  const neutral = !e.before && !e.after;
  let lines = '';
  if (neutral || same || (e.op === 'format' && !e.after)) {
    lines = `<div class="${prefix}-diff-line is-same"><span class="${prefix}-diff-sign">·</span><span class="${prefix}-diff-text">${esc(e.before || e.after || e.note)}</span></div>`;
  } else {
    if (e.before) lines += `<div class="${prefix}-diff-line is-del"><span class="${prefix}-diff-sign">−</span><span class="${prefix}-diff-text">${esc(e.before)}</span></div>`;
    if (e.after) lines += `<div class="${prefix}-diff-line is-add"><span class="${prefix}-diff-sign">+</span><span class="${prefix}-diff-text">${esc(e.after)}</span></div>`;
  }
  return `<div class="${prefix}-diff-item">${head}${lines}</div>`;
}

/**
 * 修改卡 HTML（宿主渲染用；prefix 区分 chat / cw 两套皮肤）。
 * 形态对齐子代理卡：折叠头 + 固定高度滚动窗；本轮的卡默认展开。
 */
export function docEditsCardHtml(card, prefix = 'chat') {
  if (!card || !card.edits || !card.edits.length) return '';
  const total = card.edits.length;
  const shown = card.edits.slice(0, CARD_MAX_ITEMS);
  const more = total > shown.length ? `<div class="${prefix}-diff-more">…另有 ${total - shown.length} 处未展开</div>` : '';
  const name = card.doc_name || card.doc_id || '文档';
  return `<details class="${prefix}-diff" data-diff-doc="${esc(card.id)}" open>` +
    `<summary class="${prefix}-diff-head">` +
      `<span class="${prefix}-diff-file">${esc(name)}</span>` +
      `<span class="${prefix}-diff-count">${total} 处修改</span>` +
      `<span class="${prefix}-diff-tag">修订留痕</span>` +
    `</summary>` +
    `<div class="${prefix}-diff-body">${shown.map((e) => editBlockHtml(e, prefix)).join('')}${more}</div>` +
    `<div class="${prefix}-diff-foot">修订未定稿：在 Word / 阅读器里逐条接受或拒绝（doc_review list_revisions）</div>` +
  `</details>`;
}

/**
 * 就地更新修改卡：同文档的卡替换内容（保留展开状态），否则追加。
 * 卡片按 data-diff-doc 定位，一张文档一张卡。
 */
export function upsertDocEditsCardEl(rootEl, card, prefix = 'chat') {
  if (!rootEl || !rootEl.querySelector || !card) return null;
  const sel = `.${prefix}-diff[data-diff-doc="${String(card.id).replace(/"/g, '\\"')}"]`;
  const existing = rootEl.querySelector(sel);
  const html = docEditsCardHtml(card, prefix);
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

/** 消息级渲染（renderChat / 浮动窗重绘时用）。 */
export function docEditsListHtml(list, prefix = 'chat') {
  const cards = Array.isArray(list) ? list : [];
  if (!cards.length) return '';
  return `<div class="${prefix}-diffs">${cards.map((c) => docEditsCardHtml(c, prefix)).join('')}</div>`;
}
