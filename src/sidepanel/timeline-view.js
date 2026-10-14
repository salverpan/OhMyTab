/**
 * 工作区下半：任务追踪（ChatFlow + 简报）与活动。
 */

import {
  buildActivityStream, ACTIVITY_FILTERS, ACTIVITY_PAGE,
} from '../lib/timeline-model.js';
import { listActivity, subscribeActivity } from '../lib/activity-log.js';
import { createTraceGraphView } from './trace-graph.js';

const TAB_LABEL = { track: '任务追踪', activity: '活动' };
const ACTIVITY_FILTER_LABEL = {
  all: '全部', main: '主代理', sub: '子代理', file: '文件', web: '网页', note: '笔记', user: '用户',
};

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

function tabsHtml(tab) {
  return `<div class="ws-tl-tabs">${Object.keys(TAB_LABEL).map((t) =>
    `<button type="button" class="ws-tl-tab${t === tab ? ' active' : ''}" data-tl-tab="${t}">${TAB_LABEL[t]}</button>`).join('')}</div>`;
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
    : (filter === 'all' ? '' : '<div class="ws-tl-empty">当前过滤条件下没有记录。</div>');
  return `<div class="ws-tl-head">${tabsHtml('activity')}</div>
    <div class="ws-tl-filters ws-act-filters">${filters}</div>${body}`;
}

/**
 * @param {{getProjectId: () => string, getNotes: () => Array, onOpenNote: (id: string) => void}} opts
 */
export function createTimelineView(opts) {
  let tab = 'track';
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

    const events = await listActivity(pid, { limit: Math.max(600, actLimit * 6) });
    if (mine !== token || !host.isConnected) return;
    host.innerHTML = activityHtml(buildActivityStream(events, { filter: actFilter, limit: actLimit }), actFilter);
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
      tab = next === 'activity' ? 'activity' : 'track';
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
