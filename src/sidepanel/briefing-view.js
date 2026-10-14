/**
 * 任务追踪简报 HTML。问题、结论、判断（支撑/反对/未核）+ 缺口。
 */

import { researchPrompt, decisionPrompt } from '../lib/briefing-model.js';

const STANCE = { support: '很可能成立', mixed: '有争议', counter: '不成立' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function trioHtml(pass, fail, open) {
  const items = [
    { n: Number(pass) || 0, label: '支撑', cls: 'is-for' },
    { n: Number(fail) || 0, label: '反对', cls: 'is-against' },
    { n: Number(open) || 0, label: '未核', cls: 'is-open' },
  ];
  const max = Math.max(items[0].n, items[1].n, items[2].n, 1);
  return `<div class="j-trio">${items.map((it) => {
    const op = (0.28 + (it.n / max) * 0.72).toFixed(2);
    return `<span class="${it.cls}"><small>${it.label}</small><b style="opacity:${op}">${it.n}</b></span>`;
  }).join('')}</div>`;
}

function quoteHtml(side, label) {
  if (!side?.top?.length) return '';
  return `<div class="tb-quotes"><div class="tb-qk">${esc(label)}</div>${side.top.map((q) =>
    `<blockquote class="tb-q">${esc(clip(q.text || q.title, 140))}${q.attribution ? `<cite>${esc(q.attribution)}</cite>` : ''}</blockquote>`).join('')}</div>`;
}

function stanceOf(j) {
  if (j.lean === 'support' && j.likelihood) return `${j.likelihood}成立`;
  return STANCE[j.lean] || '有争议';
}

function judgmentHtml(j, i) {
  const cls = j.lean === 'counter' ? 'is-no' : j.lean === 'mixed' ? 'is-mixed' : '';
  const n = String(i + 1).padStart(2, '0');
  const m = j.meter || { pass: 0, fail: 0, warn: 0 };
  return `<li class="j ${cls}">
    <div class="j-top"><span class="j-n">${n}</span><span class="j-stance">${esc(stanceOf(j))}</span></div>
    <p class="j-t">${esc(j.title)}</p>
    ${j.text ? `<p class="j-why">${esc(clip(j.text, 180))}</p>` : ''}
    ${trioHtml(m.pass, m.fail, m.warn)}
    <details class="tb-more">
      <summary>看证据摘录</summary>
      ${quoteHtml(j.support, '支撑')}
      ${quoteHtml(j.counter, '反对')}
    </details>
  </li>`;
}

function draftBtn(text, label) {
  return `<button type="button" class="tb-act" data-db-draft="${esc(text)}">${esc(label)}</button>`;
}

export function briefingHtml(b) {
  if (!b || b.empty) {
    return b?.question ? `<article class="tb-root"><div class="tb-question">${esc(b.question)}</div></article>` : '';
  }
  const pick = b.options.length > 1
    ? `<label class="tb-pick">议题 <select data-tg-arg>${b.options.map((o) =>
      `<option value="${esc(o.id)}"${o.id === b.activeId ? ' selected' : ''}>${esc(o.title)}</option>`).join('')}</select></label>`
    : '';
  const asks = b.asks.map((a) => `<li class="tb-attn is-ask">
    <span class="tb-tag is-ask">待你拍板</span>
    <div><b>${esc(clip(a.title, 120))}</b>${a.options.length ? `<div class="tb-opts">${a.options.map((o) => `<span>${esc(o)}</span>`).join('')}</div>` : ''}</div>
    ${draftBtn(decisionPrompt(a), '去回答')}
  </li>`).join('');
  const gaps = b.gaps.map((g) => `<li class="tb-row">
    <i>${g.type === 'open-note' ? '待核实' : g.type === 'unresolved' ? '缺口' : '缺口'}</i>
    <span>${esc(clip(g.title, 100))}</span>
    ${draftBtn(researchPrompt(b.topic, { type: g.type === 'open-note' ? 'unresolved' : g.type, title: g.title }), '派去查')}
  </li>`).join('');

  return `<article class="tb-root">
    ${pick}
    ${asks ? `<ul class="tb-asks">${asks}</ul>` : ''}
    ${b.question ? `<div class="tb-question">${esc(b.question)}</div>` : ''}
    ${b.conclusion ? `<section class="tb-bluf">
      <div class="tb-k">结论</div>
      <div class="tb-bluf-t">${esc(b.conclusion.text || b.conclusion.title)}</div>
      ${b.conclusion.entryId ? `<button type="button" class="tb-act" data-tg-output="${esc(b.conclusion.entryId)}">打开研报</button>` : ''}
    </section>` : ''}
    ${b.judgments.length ? `<section class="tb-js">
      <div class="tb-k">核心判断</div>
      <ol class="jlist">${b.judgments.map(judgmentHtml).join('')}</ol>
    </section>` : ''}
    ${gaps ? `<section class="tb-block"><div class="tb-k">还不知道</div><ul class="tb-list">${gaps}</ul></section>` : ''}
  </article>`;
}
