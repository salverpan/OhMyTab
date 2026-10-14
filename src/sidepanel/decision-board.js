/**
 * 决策板的 HTML 渲染（纯函数，可在 Node 里测）。数据口径见 lib/decision-model.js。
 *
 * 交互约定（由 trace-graph.js 统一委托处理）：
 *   data-db-note="<noteId>"   在笔记中打开
 *   data-db-draft="<文本>"     把指令预填进对话输入框，用户确认后再发送
 */

import { STRENGTH_LABEL, researchPrompt, decisionPrompt } from '../lib/decision-model.js';

const CONF_LABEL = { high: '高', medium: '中', low: '低' };
const TREND = { up: { t: '↑ 置信上升', c: 'is-up' }, down: { t: '↓ 置信下降', c: 'is-down' }, flat: { t: '→ 置信不变', c: '' } };
const NOTE_STATUS = { open: '待核实', verified: '已核实' };
const DISPUTE_LABEL = {
  risk: '风险', refuted: '被推翻', 'source-conflict': '来源冲突', overclaim: '超出证据', 'citation-fail': '引文对不上',
};
const CHANGE_LABEL = {
  pivot: '方向调整', replaced: '结论被替换', 'note-verified': '判断获证实', 'note-refuted': '判断被推翻', 'note-reopened': '判断退回待核实',
};
const GAP_LABEL = { unresolved: '未查清', next: '建议下一步', 'single-source': '单一来源', due: '到期复核' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clip(s, n = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function draftBtn(text, label) {
  return `<button type="button" class="db-act" data-db-draft="${esc(text)}">${esc(label)}</button>`;
}

function titleLink(title, noteId, max = 120) {
  const t = esc(clip(title, max));
  return noteId ? `<button type="button" class="db-link" data-db-note="${esc(noteId)}">${t}</button>` : `<span>${t}</span>`;
}

function attentionHtml(att) {
  const parts = [];
  for (const a of att.asks) {
    parts.push(`<li class="db-attn-item is-ask">
      <span class="db-tag is-ask">待你拍板</span>
      <div class="db-attn-body">
        <div class="db-attn-title">${esc(clip(a.title, 140))}</div>
        ${a.text ? `<div class="db-sub">${esc(clip(a.text, 160))}</div>` : ''}
        ${a.options.length ? `<div class="db-opts">${a.options.map((o) => `<span class="db-opt">${esc(o)}</span>`).join('')}</div>` : ''}
        ${a.issueTitle ? `<div class="db-from">议题：${esc(clip(a.issueTitle, 50))}</div>` : ''}
      </div>
      ${draftBtn(decisionPrompt(a), '去回答')}
    </li>`);
  }
  for (const a of att.alerts) {
    const label = DISPUTE_LABEL[a.type] || CHANGE_LABEL[a.type] || '变化';
    parts.push(`<li class="db-attn-item is-alert">
      <span class="db-tag is-bad">${esc(label)}</span>
      <div class="db-attn-body">
        <div class="db-attn-title">${titleLink(a.title, a.noteId, 140)}</div>
        ${a.text ? `<div class="db-sub">${esc(clip(a.text, 160))}</div>` : ''}
        <div class="db-from">${esc(fmtTime(a.ts))}${a.issueTitle ? ` · ${esc(clip(a.issueTitle, 40))}` : ''}</div>
      </div>
    </li>`);
  }
  for (const o of att.overdue) {
    parts.push(`<li class="db-attn-item is-due">
      <span class="db-tag is-warn">到期复核</span>
      <div class="db-attn-body">
        <div class="db-attn-title">${titleLink(o.title, o.noteId, 140)}</div>
        <div class="db-from">应于 ${esc(fmtTime(o.ts))} 复核${o.issueTitle ? ` · ${esc(clip(o.issueTitle, 40))}` : ''}</div>
      </div>
      ${draftBtn(researchPrompt(o.issueTitle || '', { type: 'due', title: o.title }), '派去复核')}
    </li>`);
  }
  if (!parts.length) return '';
  return `<section class="db-attn"><h4 class="db-h">需要你关注</h4><ul class="db-attn-list">${parts.join('')}</ul></section>`;
}

function strengthHtml(s) {
  if (!s.total) return '<div class="db-strength is-empty">还没有经过核验的断言</div>';
  const seg = (k) => (s[k] ? `<i class="db-seg is-${k}" style="flex:${s[k]}" title="${esc(STRENGTH_LABEL[k])} ${s[k]}"></i>` : '');
  const legend = ['strong', 'single', 'contested', 'unverified']
    .filter((k) => s[k])
    .map((k) => `<span class="db-leg"><i class="db-dot is-${k}"></i>${esc(STRENGTH_LABEL[k])} ${s[k]}</span>`)
    .join('');
  return `<div class="db-strength">
    <div class="db-bar">${seg('strong')}${seg('single')}${seg('contested')}${seg('unverified')}</div>
    <div class="db-legend">${legend}</div>
    ${s.weakModality ? `<div class="db-sub">其中 ${s.weakModality} 条只证明了“某方这么说”，不等于事情已确认</div>` : ''}
  </div>`;
}

function conclusionHtml(t) {
  const c = t.conclusion;
  if (!c) {
    return `<div class="db-conc is-empty">还没有明确结论${t.judgmentTotal ? `，目前有 ${t.judgmentTotal} 条判断（见下）` : ''}</div>`;
  }
  const trend = TREND[c.trend];
  return `<div class="db-conc">
    <div class="db-conc-head">
      <span class="db-k">当前结论</span>
      ${c.confidence ? `<span class="db-conf is-${esc(c.confidence)}">置信${esc(CONF_LABEL[c.confidence] || c.confidence)}</span>` : ''}
      ${trend && c.trend !== 'flat' ? `<span class="db-trend ${trend.c}">${esc(trend.t)}</span>` : ''}
    </div>
    <div class="db-conc-title">${esc(clip(c.title, 200))}</div>
    ${c.text ? `<div class="db-sub">${esc(clip(c.text, 240))}</div>` : ''}
  </div>`;
}

function block(title, items, empty = '') {
  if (!items.length && !empty) return '';
  return `<div class="db-block"><div class="db-k">${esc(title)}</div>${items.length
    ? `<ul class="db-list">${items.join('')}</ul>`
    : `<div class="db-none">${esc(empty)}</div>`}</div>`;
}

function issueHtml(t) {
  const meta = [t.kind === 'chat' ? '对话' : '持续追踪'];
  if (t.paused) meta.push('已暂停');
  else if (t.nextRunAt) meta.push(`下次 ${fmtTime(t.nextRunAt)}`);
  if (t.deleted) meta.push('任务已删除');
  if (t.lastTs) meta.push(`更新于 ${fmtTime(t.lastTs)}`);
  if (t.subagents) meta.push(`调研 ${t.subagents} 次`);

  const judgments = t.judgments.map((j) => `<li class="db-row">
    <span class="db-chip is-${esc(j.status)}${j.overdue ? ' is-overdue' : ''}">${esc(j.overdue ? '到期' : (NOTE_STATUS[j.status] || j.status))}</span>
    ${j.confidence ? `<span class="db-conf is-${esc(j.confidence)}">${esc(CONF_LABEL[j.confidence] || '')}</span>` : ''}
    ${titleLink(j.title, j.noteId)}
  </li>`);
  if (t.judgmentTotal > t.judgments.length) {
    judgments.push(`<li class="db-more">另有 ${t.judgmentTotal - t.judgments.length} 条</li>`);
  }
  const disputes = t.disputes.map((d) => `<li class="db-row">
    <span class="db-chip is-bad">${esc(DISPUTE_LABEL[d.type] || d.type)}</span>
    <div class="db-row-body">${titleLink(d.title, d.noteId)}${d.text ? `<div class="db-sub">${esc(clip(d.text, 140))}</div>` : ''}</div>
  </li>`);
  const gaps = t.gaps.map((g) => `<li class="db-row">
    <span class="db-chip is-gap">${esc(GAP_LABEL[g.type] || '缺口')}</span>
    <div class="db-row-body"><span>${esc(clip(g.title, 140))}</span></div>
    ${draftBtn(researchPrompt(t.title, g), '派去调研')}
  </li>`);
  const changes = t.changes.map((c) => `<li class="db-row">
    <span class="db-chip">${esc(CHANGE_LABEL[c.type] || '变化')}</span>
    <div class="db-row-body">${titleLink(c.title, c.noteId)}<span class="db-time">${esc(fmtTime(c.ts))}</span></div>
  </li>`);

  return `<section class="db-issue">
    <header class="db-issue-head">
      <div class="db-issue-title">${esc(clip(t.title, 120))}</div>
      <div class="db-issue-meta">${esc(meta.join(' · '))}</div>
    </header>
    ${conclusionHtml(t)}
    <div class="db-block"><div class="db-k">证据强度</div>${strengthHtml(t.strength)}</div>
    ${block('关键判断', judgments)}
    ${block('分歧与风险', disputes, '目前没有发现冲突或被推翻的判断')}
    ${block('还不知道的 · 下一步查什么', gaps, '没有记录在案的缺口')}
    ${block('最近 7 天的变化', changes)}
  </section>`;
}

export function decisionBoardHtml(board) {
  if (!board || board.empty) {
    return `<div class="db-empty">还没有可供决策的内容。让主代理调研一个问题、或设置心跳持续追踪某个对象后，这里会整理出：需要你拍板的事、当前结论与证据强度、分歧与风险、下一步该查什么。</div>`;
  }
  return `<div class="db-root">${attentionHtml(board.attention)}${board.issues.map(issueHtml).join('')}</div>`;
}
