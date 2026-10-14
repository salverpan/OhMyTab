/**
 * 过程时间线 HTML（纯函数）。断言按 finding 聚合，闲聊回合压成一行。
 */

const STATUS_LABEL = {
  open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用',
  running: '进行中', completed: '完成', incomplete: '未提交', error: '失败', aborted: '已中断',
  paused: '已暂停', ok: '完成',
  'cross-source-pass': '多源通过', 'entailment-pass': '蕴含通过', 'citation-pass': '引文通过',
  'citation-fail': '引文失败', overclaim: '过度断言', 'source-conflict': '来源冲突',
  'source-unverified': '未核验',
};
const TURN_LABEL = { user: '用户', heartbeat: '心跳', followup: '回报' };
const CONF_LABEL = { high: '高', medium: '中', low: '低' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clip(s, n = 110) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDuration(a, b) {
  if (!a || !b || b < a) return '';
  const s = Math.round((b - a) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

function tone(status) {
  if (['verified', 'completed', 'ok', 'cross-source-pass', 'entailment-pass', 'citation-pass'].includes(status)) return 'good';
  if (['refuted', 'error', 'citation-fail', 'overclaim', 'source-conflict', 'aborted'].includes(status)) return 'bad';
  if (['open', 'running', 'source-unverified', 'incomplete'].includes(status)) return 'warn';
  return 'idle';
}

function countsHtml(c) {
  if (!c || !c.total) return '';
  const bits = [];
  if (c.pass) bits.push(`<span class="tp-chip is-good">通过 ${c.pass}</span>`);
  if (c.unverified) bits.push(`<span class="tp-chip is-warn">未核验 ${c.unverified}</span>`);
  if (c.fail) bits.push(`<span class="tp-chip is-bad">失败 ${c.fail}</span>`);
  return `<span class="tp-counts">${bits.join('')}</span>`;
}

function claimList(items) {
  if (!items.length) return '';
  return `<ul class="tp-claims">${items.map((c) =>
    `<li class="tp-claim is-${esc(tone(c.status))}" data-tg-select="${esc(c.id)}">
      <span class="tp-v">${esc(STATUS_LABEL[c.status] || c.status || '未核验')}</span>
      <span class="tp-claim-t">${esc(clip(c.title, 140))}</span>
    </li>`).join('')}</ul>`;
}

function groupHtml(g) {
  const open = g.counts.total <= 3 && !g.orphan ? ' open' : '';
  const head = g.orphan
    ? `未归入问题的断言 ${g.counts.total}`
    : `${esc(clip(g.question || '判断', 80))}`;
  return `<details class="tp-group${g.orphan ? ' is-orphan' : ''}"${open}>
    <summary>
      <span class="tp-group-q">${head}</span>
      ${countsHtml(g.counts)}
    </summary>
    ${g.answer ? `<p class="tp-ans">${esc(clip(g.answer, 240))}</p>` : ''}
    ${g.support.length ? `<div class="tp-k">支撑</div>${claimList(g.support)}` : ''}
    ${g.counter.length ? `<div class="tp-k">反对</div>${claimList(g.counter)}` : ''}
  </details>`;
}

function subagentHtml(s) {
  const dur = fmtDuration(s.ts, s.endedAt);
  const st = STATUS_LABEL[s.status] || s.status;
  return `<div class="tp-sub" data-tg-select="${esc(s.id)}">
    <div class="tp-sub-head">
      <span class="tp-tag">子代理 · ${esc(s.type || '')}</span>
      <span class="tp-sub-title">${esc(clip(s.title, 80))}</span>
      <span class="tp-chip is-${esc(tone(s.status))}">${esc(st)}</span>
      ${dur ? `<span class="tp-dur">${esc(dur)}</span>` : ''}
      ${countsHtml(s.counts)}
    </div>
    ${s.groups.map(groupHtml).join('')}
    ${s.unresolved.length ? `<div class="tp-k">未查清</div><ul class="tp-gaps">${s.unresolved.map((u) =>
      `<li data-tg-select="${esc(u.id)}">${esc(clip(u.title, 140))}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function turnHtml(turn) {
  const dur = fmtDuration(turn.ts, turn.endedAt);
  const idle = turn.grade === 'idle';
  const label = TURN_LABEL[turn.subtype] || '输入';
  const meta = [fmtTime(turn.ts), dur].filter(Boolean).join(' · ');
  const inner = `
    ${turn.reply ? `<div class="tp-reply" data-tg-select="${esc(turn.reply.id)}">${esc(clip(turn.reply.title || turn.reply.text, 160))}</div>` : ''}
    ${turn.reports.map((r) =>
      `<div class="tp-report" data-tg-select="${esc(r.id)}">
        <span class="tp-tag">研报</span>
        <span>${esc(clip(r.title, 80))}</span>
        ${r.text ? `<div class="tp-ans">${esc(clip(r.text, 160))}</div>` : ''}
        ${r.entryId ? `<button type="button" class="tp-open" data-tg-output="${esc(r.entryId)}">打开产出</button>` : ''}
      </div>`).join('')}
    ${turn.subagents.map(subagentHtml).join('')}
    ${turn.judgments.map((j) =>
      `<div class="tp-note is-${esc(j.status)}" data-tg-select="${esc(j.id)}">
        <span class="tp-tag">${j.kind === 'observation' ? '观测' : '判断'}</span>
        ${esc(clip(j.title, 120))}
      </div>`).join('')}`;
  if (idle) {
    return `<details class="tp-turn is-idle">
      <summary><span class="tp-kind">${esc(label)}</span><span class="tp-turn-t">${esc(clip(turn.title, 90))}</span><span class="tp-meta">${esc(meta)}</span></summary>
      ${inner || '<div class="tp-none">没有调研产出</div>'}
    </details>`;
  }
  return `<section class="tp-turn is-work" data-tg-select="${esc(turn.id)}">
    <header class="tp-turn-head">
      <span class="tp-kind">${esc(label)}</span>
      <span class="tp-turn-t">${esc(clip(turn.title, 120))}</span>
      <span class="tp-meta">${esc(meta)}</span>
    </header>
    ${inner}
  </section>`;
}

export function processTimelineHtml(model) {
  if (!model || !model.threads.length) {
    return '';
  }
  return `<div class="tp-root">${model.threads.map((th) => `<section class="tp-thread">
    <header class="tp-thread-head">${esc(th.title)}${th.paused ? '<span class="tp-chip">已暂停</span>' : ''}</header>
    ${th.turns.map(turnHtml).join('')}
    ${th.looseNotes.map((j) => `<div class="tp-note" data-tg-select="${esc(j.id)}">${esc(clip(j.title, 120))}</div>`).join('')}
  </section>`).join('')}</div>`;
}
