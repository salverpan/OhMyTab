/**
 * 项目概览下半部分：任务追踪时间线。
 * 数据来自 notebook（threadId 归组）+ 心跳任务 runs[]，口径见 lib/timeline-model.js。
 */

import { listHeartbeatTasks } from '../lib/heartbeat.js';
import {
  buildTimeline, buildActivityStream, ACTIVITY_FILTERS, ACTIVITY_PAGE,
} from '../lib/timeline-model.js';
import { listActivity, subscribeActivity } from '../lib/activity-log.js';
import { createTraceGraphView } from './trace-graph.js';

const TAB_LABEL = { track: '任务追踪', judge: '判断', activity: '活动' };
const ACTIVITY_FILTER_LABEL = {
  all: '全部', main: '主代理', sub: '子代理', file: '文件', web: '网页', note: '笔记', user: '用户',
};
const FILTER_LABEL = { all: '全部', open: '待核实', refuted: '被推翻' };
const STATUS_LABEL = { open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用' };
const CONF_LABEL = { high: '高', medium: '中', low: '低' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function fmtDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

function noteLink(noteId, inner, cls = '') {
  return noteId
    ? `<button type="button" class="ws-tl-link${cls ? ` ${cls}` : ''}" data-tl-note="${esc(noteId)}">${inner}</button>`
    : inner;
}

function eventHtml(ev, noteById) {
  const time = `<span class="ws-tl-time">${esc(fmtTime(ev.ts))}</span>`;

  if (ev.type === 'run') {
    const dur = fmtDuration(ev.durationMs);
    return `<li class="ws-tl-item ws-tl-run ${ev.status === 'error' ? 'is-error' : 'is-ok'}">
      <span class="ws-tl-dot"></span>
      <div class="ws-tl-body">${time}<span class="ws-tl-run-text">${ev.status === 'error' ? '运行失败' : '运行完成'}${dur ? ` · ${esc(dur)}` : ''}${ev.error ? ` · ${esc(clip(ev.error, 60))}` : ''}</span></div>
    </li>`;
  }

  if (ev.type === 'observation') {
    return `<li class="ws-tl-item ws-tl-observation">
      <span class="ws-tl-dot"></span>
      <div class="ws-tl-body">${time}<span class="ws-tl-tag">观测</span>${noteLink(ev.noteId, esc(clip(ev.text)))}</div>
    </li>`;
  }

  if (ev.type === 'verdict') {
    const cls = ev.to === 'verified' ? 'is-verified' : ev.to === 'refuted' ? 'is-refuted' : 'is-open';
    const label = ev.to === 'open' ? '退回待核实' : (STATUS_LABEL[ev.to] || ev.to);
    return `<li class="ws-tl-item ws-tl-verdict ${cls}">
      <span class="ws-tl-dot"></span>
      <div class="ws-tl-body">${time}<span class="ws-tl-tag ${cls}">${esc(label)}</span>${noteLink(ev.noteId, esc(clip(ev.text, 70)))}${ev.reason ? `<span class="ws-tl-reason">${esc(clip(ev.reason, 90))}</span>` : ''}</div>
    </li>`;
  }

  const refuted = ev.status === 'refuted';
  const cls = ev.status === 'verified' ? 'is-verified' : refuted ? 'is-refuted' : ev.status === 'dropped' ? 'is-dropped' : 'is-open';
  const meta = [];
  if (ev.confidence) meta.push(`置信${CONF_LABEL[ev.confidence] || ev.confidence}`);
  if (ev.verifyAt) meta.push(`${ev.overdue ? '已到验证期' : '预计验证'} ${fmtTime(ev.verifyAt)}`);
  const next = ev.supersededBy ? noteById.get(ev.supersededBy) : null;
  return `<li class="ws-tl-item ws-tl-judgment ${cls}${ev.overdue ? ' is-overdue' : ''}">
    <span class="ws-tl-dot"></span>
    <div class="ws-tl-body">
      ${time}<span class="ws-tl-tag ${cls}">判断 · ${esc(STATUS_LABEL[ev.status] || ev.status)}</span>
      ${ev.supersedes ? '<span class="ws-tl-tag is-revise">修正</span>' : ''}
      ${noteLink(ev.noteId, esc(clip(ev.text)), refuted ? 'is-struck' : '')}
      ${meta.length ? `<span class="ws-tl-meta">${esc(meta.join(' · '))}</span>` : ''}
      ${next ? `<span class="ws-tl-next">→ 修正为 ${noteLink(next.id, esc(clip(next.claim, 60)))}</span>` : ''}
    </div>
  </li>`;
}

function threadHtml(thread, noteById) {
  const c = thread.counts;
  const chips = [
    c.open ? `<span class="ws-tl-chip is-open">待核实 ${c.open}</span>` : '',
    c.verified ? `<span class="ws-tl-chip is-verified">核实 ${c.verified}</span>` : '',
    c.refuted ? `<span class="ws-tl-chip is-refuted">推翻 ${c.refuted}</span>` : '',
  ].join('');
  const state = thread.deleted ? '任务已删除' : thread.enabled ? (thread.nextRunAt ? `下次 ${fmtTime(thread.nextRunAt)}` : '') : '已暂停';
  return `<section class="ws-tl-thread">
    <header class="ws-tl-thread-head">
      <span class="ws-tl-thread-name">${esc(thread.name)}</span>
      ${chips}
      ${state ? `<span class="ws-tl-thread-state">${esc(state)}</span>` : ''}
    </header>
    <ol class="ws-tl-list">
      ${thread.events.map((ev) => eventHtml(ev, noteById)).join('')}
    </ol>
    ${thread.hiddenEvents ? `<div class="ws-tl-more">另有 ${thread.hiddenEvents} 条更早的记录未显示</div>` : ''}
  </section>`;
}

function tabsHtml(tab) {
  return `<div class="ws-tl-tabs">${Object.keys(TAB_LABEL).map((t) =>
    `<button type="button" class="ws-tl-tab${t === tab ? ' active' : ''}" data-tl-tab="${t}">${TAB_LABEL[t]}</button>`).join('')}</div>`;
}

export function timelineHtml(model, filter, noteById) {
  const filters = Object.keys(FILTER_LABEL).map((f) =>
    `<button type="button" class="ws-tl-filter${f === filter ? ' active' : ''}" data-tl-filter="${f}">${FILTER_LABEL[f]}</button>`).join('');
  const body = model.threads.length
    ? model.threads.map((t) => threadHtml(t, noteById)).join('')
    : `<div class="ws-tl-empty">${filter === 'all'
      ? '还没有追踪记录。给心跳任务设定“持续追踪某个对象”的提示词，AI 每次运行后会把观测、判断与修正记在这里。'
      : '当前过滤条件下没有记录。'}</div>`;
  return `<div class="ws-tl-head">${tabsHtml('judge')}<div class="ws-tl-filters">${filters}</div></div>${body}`;
}

function actorBadge(it) {
  if (it.actor === 'sub') return { text: `Sub·${it.actorName || '代理'}`, cls: 'is-sub' };
  if (it.actor === 'main') return { text: 'Main', cls: 'is-main' };
  if (it.actor === 'heartbeat') return { text: '心跳', cls: 'is-heartbeat' };
  if (it.actor === 'user') return { text: '用户', cls: 'is-user' };
  return { text: '系统', cls: 'is-system' };
}

function activityItemHtml(it) {
  const badge = actorBadge(it);
  const dur = fmtDuration(it.durationMs);
  const time = it.count > 1 && it.firstTs !== it.ts
    ? `${fmtTime(it.firstTs)} – ${fmtTime(it.ts).slice(6)}`
    : fmtTime(it.ts);
  return `<li class="ws-tl-item ws-act-item is-cat-${esc(it.cat)}${it.status === 'error' ? ' is-error' : ''}">
    <span class="ws-tl-dot"></span>
    <div class="ws-tl-body">
      <span class="ws-tl-time">${esc(time)}</span>
      <span class="ws-act-actor ${badge.cls}">${esc(badge.text)}</span>
      <span class="ws-act-label">${esc(it.label)}${it.count > 1 ? ` <em class="ws-act-count">×${it.count}</em>` : ''}</span>
      ${it.detail ? `<span class="ws-act-detail">${esc(clip(it.detail, 90))}</span>` : ''}
      ${it.status === 'error' ? '<span class="ws-tl-tag is-refuted">失败</span>' : ''}
      ${dur ? `<span class="ws-tl-meta">${esc(dur)}</span>` : ''}
    </div>
  </li>`;
}

export function activityHtml(stream, filter) {
  const filters = ACTIVITY_FILTERS.map((f) =>
    `<button type="button" class="ws-tl-filter${f === filter ? ' active' : ''}" data-act-filter="${f}">${ACTIVITY_FILTER_LABEL[f]}</button>`).join('');
  const body = stream.items.length
    ? `<ol class="ws-tl-list ws-act-list">${stream.items.map(activityItemHtml).join('')}</ol>
       ${stream.hidden ? `<button type="button" class="ws-tl-more ws-act-more" data-act-more>再显示更早的 ${Math.min(stream.hidden, ACTIVITY_PAGE)} 条（还有 ${stream.hidden} 条）</button>` : ''}`
    : `<div class="ws-tl-empty">${filter === 'all'
      ? '还没有操作记录。之后主代理、子代理的每次工具调用、文库与笔记的变更都会记在这里。'
      : '当前过滤条件下没有记录。'}</div>`;
  return `<div class="ws-tl-head">${tabsHtml('activity')}</div>
    <div class="ws-tl-filters ws-act-filters">${filters}</div>${body}`;
}

/**
 * @param {{getProjectId: () => string, getNotes: () => Array, onOpenNote: (id: string) => void}} opts
 */
export function createTimelineView(opts) {
  let tab = 'track';
  let filter = 'all';
  let actFilter = 'all';
  let actLimit = ACTIVITY_PAGE;
  let host = null;
  let token = 0;
  let unsubscribe = null;
  let liveTimer = null;

  // 画布挂在一个常驻节点上：概览重绘只是把它重新插回去，缩放 / 平移 / 折叠状态不丢。
  const graphView = createTraceGraphView(opts);
  let graphEl = null;
  let graphMounted = false;

  function releaseGraph() {
    if (!graphMounted) return;
    graphView.unmount();
    graphMounted = false;
    if (graphEl) graphEl.innerHTML = '';
  }

  async function render() {
    if (!host) return;
    const mine = ++token;
    const pid = opts.getProjectId();

    if (tab === 'track') {
      if (!graphEl) {
        graphEl = document.createElement('div');
        graphEl.className = 'ws-tg-host';
      }
      const attached = host.contains(graphEl);
      if (!attached) {
        host.innerHTML = `<div class="ws-tl-head">${tabsHtml('track')}</div>`;
        host.appendChild(graphEl);
      }
      if (!attached || !graphMounted) {
        graphMounted = true;
        await graphView.mount(graphEl);
      } else {
        await graphView.refresh();
      }
      return;
    }
    releaseGraph();

    if (tab === 'activity') {
      const events = await listActivity(pid, { limit: Math.max(600, actLimit * 6) });
      if (mine !== token || !host.isConnected) return;
      host.innerHTML = activityHtml(buildActivityStream(events, { filter: actFilter, limit: actLimit }), actFilter);
      return;
    }

    let tasks = [];
    try { tasks = await listHeartbeatTasks(pid); } catch (_) { /* ignore */ }
    if (mine !== token || !host.isConnected) return;
    const notes = opts.getNotes() || [];
    const noteById = new Map(notes.map((n) => [n.id, n]));
    const model = buildTimeline({ notes, tasks, filter });
    host.innerHTML = timelineHtml(model, filter, noteById);
  }

  function stopLive() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
  }

  function startLive() {
    stopLive();
    unsubscribe = subscribeActivity((pid) => {
      if (!host || !host.isConnected) { stopLive(); return; }
      if (tab !== 'activity') return;
      if (pid && pid !== (opts.getProjectId() || 'default')) return;
      if (liveTimer) return;
      liveTimer = setTimeout(() => { liveTimer = null; render(); }, 800);
    });
  }

  function onClick(e) {
    const t = e.target.closest('[data-tl-tab]');
    if (t) {
      const next = t.dataset.tlTab;
      tab = next === 'activity' || next === 'judge' ? next : 'track';
      render();
      return;
    }
    const af = e.target.closest('[data-act-filter]');
    if (af) {
      actFilter = af.dataset.actFilter;
      actLimit = ACTIVITY_PAGE;
      render();
      return;
    }
    if (e.target.closest('[data-act-more]')) {
      actLimit += ACTIVITY_PAGE;
      render();
      return;
    }
    const f = e.target.closest('[data-tl-filter]');
    if (f) {
      filter = f.dataset.tlFilter;
      render();
      return;
    }
    const link = e.target.closest('[data-tl-note]');
    if (link) opts.onOpenNote?.(link.dataset.tlNote);
  }

  return {
    async mount(el) {
      if (host) host.removeEventListener('click', onClick);
      host = el;
      host.addEventListener('click', onClick);
      startLive();
      await render();
    },
    refresh: render,
  };
}
