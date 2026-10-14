/**
 * ChatFlow HTML：这条对话怎么长出来的。
 * 只留提问、派出的线、收回的判断、研报、后来的追问。闲聊与空回复不出现。
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toneOf(status) {
  if (['running'].includes(status)) return 'run';
  if (['error', 'aborted', 'citation-fail', 'overclaim', 'source-conflict'].includes(status)) return 'bad';
  if (['completed', 'ok', 'cross-source-pass', 'entailment-pass', 'citation-pass'].includes(status)) return 'ok';
  if (status === 'source-unverified' || status === 'incomplete') return 'warn';
  return 'ok';
}

function findingTone(g) {
  if (g.counter.length && g.counter.length >= g.support.length) return 'bad';
  if (g.counter.length || (g.counts && g.counts.unverified && g.counts.unverified > (g.counts.pass || 0))) return 'warn';
  if (g.counts && g.counts.pass) return 'ok';
  return 'warn';
}

function lineOf(g) {
  return String(g.answer || g.question || '判断').trim();
}

function groupHtml(g) {
  if (g.orphan) return '';
  const bits = [];
  if (g.counts?.pass) bits.push(`支撑 ${g.counts.pass}`);
  if (g.counter.length) bits.push('有反对');
  if (g.counts?.unverified && !g.counts.pass && !g.counter.length) bits.push('未查清');
  return `<li class="cf-node is-${findingTone(g)}">
    <i class="cf-dot"></i>
    <div>${esc(clip(lineOf(g), 36))}${bits.length ? `<span class="cf-meta">${esc(bits.join(' · '))}</span>` : ''}</div>
  </li>`;
}

function gapHtml(u) {
  return `<li class="cf-node is-warn">
    <i class="cf-dot"></i>
    <div>${esc(clip(u.title, 36))}<span class="cf-meta">未查清</span></div>
  </li>`;
}

function subagentHtml(s) {
  const running = s.status === 'running';
  const tone = running ? 'run' : toneOf(s.status);
  const doneN = (s.groups || []).filter((g) => !g.orphan).length;
  const name = s.title || s.type || '调研';
  const chip = running
    ? '<span class="cf-chip is-run">进行中</span>'
    : `<span class="cf-chip is-ok">完成${doneN ? ` · ${doneN} 条判断` : ''}</span>`;
  const kids = [
    ...(s.groups || []).map(groupHtml),
    ...(s.unresolved || []).map(gapHtml),
  ].filter(Boolean).join('');
  return `<li class="cf-node is-${tone}">
    <i class="cf-dot"></i>
    <div><b>子代理 · ${esc(clip(name, 24))}</b>${chip}</div>
    ${kids ? `<ul>${kids}</ul>` : ''}
  </li>`;
}

function reportHtml(r) {
  return `<li class="cf-node is-ok">
    <i class="cf-dot"></i>
    <div><b>研报</b>${esc(clip(r.title, 80))}<span class="cf-chip is-ok">已产出</span></div>
  </li>`;
}

function turnHtml(turn, followup) {
  const who = turn.subtype === 'heartbeat' ? '心跳' : turn.subtype === 'followup' ? '回报' : '你';
  const ask = turn.subtype === 'heartbeat' ? '心跳' : turn.subtype === 'followup' ? '回报' : (followup ? '追问' : '提问');
  const subs = turn.subagents || [];
  const running = subs.some((s) => s.status === 'running');
  const nodes = [`<li class="cf-node is-you">
    <i class="cf-dot"></i>
    <div><b>${esc(who)}${turn.ts ? ` · ${esc(fmtTime(turn.ts))}` : ''}</b>${esc(clip(turn.title, 42))}<span class="cf-chip">${esc(ask)}</span></div>
  </li>`];
  if (subs.length > 1) {
    const chip = running
      ? '<span class="cf-chip is-run">派出中</span>'
      : '<span class="cf-chip is-ok">已收回</span>';
    const names = subs.map((s) => clip(s.title || s.type || '调研', 12)).join(' / ');
    nodes.push(`<li class="cf-node is-${running ? 'run' : 'ok'}">
      <i class="cf-dot"></i>
      <div><b>主代理</b>${esc(names)}${chip}</div>
      <ul>${subs.map(subagentHtml).join('')}</ul>
    </li>`);
  } else if (subs.length === 1) {
    nodes.push(subagentHtml(subs[0]));
  }
  for (const r of turn.reports || []) nodes.push(reportHtml(r));
  return nodes.join('');
}

export function chatFlowHtml(model) {
  const threads = (model && model.threads) || [];
  const blocks = [];
  const workThreads = threads.filter((th) => (th.turns || []).some((t) => t.grade === 'work'));
  for (const th of workThreads) {
    const chron = (th.turns || []).filter((t) => t.grade === 'work').slice().sort((a, b) => a.ts - b.ts);
    if (!chron.length) continue;
    if (workThreads.length > 1) {
      blocks.push(`<div class="cf-thread">${esc(th.title)}</div>`);
    }
    blocks.push(`<ul class="cf-tree">${chron.map((t, i) => turnHtml(t, i > 0)).join('')}</ul>`);
  }
  if (!blocks.length) {
    return `<section class="cf-root"><div class="cf-k">ChatFlow</div></section>`;
  }
  return `<section class="cf-root"><div class="cf-k">ChatFlow</div>${blocks.join('')}</section>`;
}
