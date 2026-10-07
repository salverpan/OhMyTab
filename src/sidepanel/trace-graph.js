/**
 * 任务追踪思维导图的侧栏外壳（原生 JS）。
 *
 * 职责：取数（trace-log + 笔记 + 心跳任务）-> buildTraceGraph -> 懒加载 React Flow 画布；
 * 折叠状态、选中、放大、详情卡、实时刷新。画布本身在 trace-flow.js（动态 import）。
 */

import { listHeartbeatTasks } from '../lib/heartbeat.js';
import { listTrace, subscribeTrace } from '../lib/trace-log.js';
import { buildTraceGraph, isGraphEmpty } from '../lib/trace-model.js';

const KIND_LABEL = {
  root: '项目', thread: '线程', turn: '输入', agent: '主代理回复', subagent: '子代理',
  claim: '断言', unresolved: '未解决项', action: '操作', judgment: '判断', observation: '观测',
};
const TURN_LABEL = { user: '用户输入', heartbeat: '心跳运行', followup: '子代理回报' };
const STATUS_LABEL = {
  open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用',
  running: '进行中', completed: '完成', incomplete: '未提交报告', error: '失败', aborted: '已中断',
  paused: '已暂停',
  'cross-source-pass': '多源通过', 'entailment-pass': '蕴含通过', 'citation-pass': '引文通过',
  'citation-fail': '引文失败', overclaim: '过度断言', 'source-conflict': '来源冲突', 'source-unverified': '未核验',
};
const CONF_LABEL = { high: '高', medium: '中', low: '低' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function kindLabel(node) {
  if (node.kind === 'turn') return TURN_LABEL[node.subtype] || KIND_LABEL.turn;
  if (node.kind === 'subagent' && node.subtype) return `子代理 · ${node.subtype}`;
  return KIND_LABEL[node.kind] || node.kind;
}

/**
 * 选中节点的详情卡。纯函数（可在 Node 里测）。
 * @param {object|null} node buildTraceGraph 输出的节点
 * @param {Map<string, object>} noteById 笔记本条目，用于判断的新旧对比
 */
export function traceDetailHtml(node, noteById = new Map()) {
  if (!node) return '';
  const status = STATUS_LABEL[node.status] ?? node.status;
  const rows = [];
  rows.push(`<div class="tg-d-head"><span class="tg-d-kind">${esc(kindLabel(node))}</span>${status ? `<span class="tg-d-status">${esc(status)}</span>` : ''}<span class="tg-d-time">${esc(fmtTime(node.ts))}${node.endedAt ? ` · ${esc(fmtDuration(node.ts, node.endedAt))}` : ''}</span></div>`);
  if (node.title) rows.push(`<div class="tg-d-title">${esc(node.title)}</div>`);
  if (node.text && node.text !== node.title) rows.push(`<div class="tg-d-text">${esc(node.text)}</div>`);

  const meta = node.meta || {};
  if (node.kind === 'judgment' || node.kind === 'observation') {
    const bits = [];
    if (meta.confidence) bits.push(`置信${CONF_LABEL[meta.confidence] || meta.confidence}`);
    if (meta.verifyAt) bits.push(`${meta.overdue ? '已到验证期' : '预计验证'} ${fmtTime(meta.verifyAt)}`);
    if (bits.length) rows.push(`<div class="tg-d-meta">${esc(bits.join(' · '))}</div>`);

    const prev = meta.supersedes ? noteById.get(meta.supersedes) : null;
    const next = meta.supersededBy ? noteById.get(meta.supersededBy) : null;
    if (prev) {
      rows.push(`<div class="tg-d-diff"><div class="tg-d-old"><span>修正前</span>${esc(prev.claim)}</div><div class="tg-d-new"><span>修正后</span>${esc(node.title)}</div></div>`);
    }
    if (next) {
      rows.push(`<div class="tg-d-diff"><div class="tg-d-old"><span>当前判断</span>${esc(node.title)}</div><div class="tg-d-new"><span>被修正为</span>${esc(next.claim)}</div></div>`);
    }
    const hist = Array.isArray(meta.history) ? meta.history : [];
    if (hist.length) {
      rows.push(`<ul class="tg-d-history">${hist.map((h) => `<li>${esc(fmtTime(h.ts))} · ${esc(STATUS_LABEL[h.to] || h.to)}${h.reason ? ` — ${esc(h.reason)}` : ''}</li>`).join('')}</ul>`);
    }
    if (meta.noteId) rows.push(`<button type="button" class="tg-d-open" data-tg-note="${esc(meta.noteId)}">在笔记中打开</button>`);
  }
  return `<div class="tg-detail-card">${rows.join('')}</div>`;
}

const LEGEND = [
  ['good', '已核实 / 通过'], ['warn', '待核实 / 进行中'], ['bad', '被推翻 / 失败'], ['info', '观测'],
];

/**
 * @param {{getProjectId: () => string, getNotes: () => Array, getProjectName?: () => string, onOpenNote: (id: string) => void}} opts
 */
export function createTraceGraphView(opts) {
  let host = null;
  let root = null;
  let canvas = null;
  let detail = null;
  let flow = null;
  let flowLoading = null;
  let overrides = {};
  let selectedId = '';
  let full = false;
  let graph = null;
  let noteById = new Map();
  let token = 0;
  let unsubscribe = null;
  let liveTimer = null;

  function loadFlow() {
    if (!flowLoading) flowLoading = import('./trace-flow.js');
    return flowLoading;
  }

  function onToggle(id, collapsed) {
    overrides = { ...overrides, [id]: collapsed ? 'collapsed' : 'expanded' };
    render();
  }

  function onSelect(id) {
    selectedId = id || '';
    paintDetail();
    if (graph && flow) draw();
  }

  function paintDetail() {
    if (!detail) return;
    const node = graph && selectedId ? graph.nodes.find((n) => n.id === selectedId) : null;
    detail.innerHTML = traceDetailHtml(node || null, noteById);
    detail.hidden = !node;
  }

  function draw() {
    if (!flow || !graph) return;
    flow.update({ graph, selectedId, showMiniMap: full, onSelect, onToggle });
  }

  function setFull(next) {
    full = next;
    if (root) root.classList.toggle('is-full', full);
    const btn = host && host.querySelector('[data-tg-full]');
    if (btn) btn.textContent = full ? '退出放大' : '放大';
    if (full) document.addEventListener('keydown', onEsc, true);
    else document.removeEventListener('keydown', onEsc, true);
    draw();
    if (flow) flow.fit('latest');
  }

  function onEsc(e) {
    if (e.key !== 'Escape' || !full) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    setFull(false);
  }

  function shellHtml() {
    return `<div class="tg-root${full ? ' is-full' : ''}">
      <div class="tg-toolbar">
        <span class="tg-stats" data-tg-stats></span>
        <span class="tg-legend">${LEGEND.map(([t, l]) => `<i class="tg-dot tf-tone-${t}"></i>${l}`).join('')}<i class="tg-dash"></i>修正</span>
        <span class="tg-actions">
          <button type="button" class="tg-btn" data-tg-latest title="定位到最新回合">最新</button>
          <button type="button" class="tg-btn" data-tg-fit title="缩放到显示整张图">全图</button>
          <button type="button" class="tg-btn" data-tg-full>${full ? '退出放大' : '放大'}</button>
        </span>
      </div>
      <div class="tg-canvas trace-flow" role="img" aria-label="任务追踪思维导图"></div>
      <div class="tg-empty" hidden></div>
      <div class="tg-detail" hidden></div>
    </div>`;
  }

  async function render() {
    if (!host) return;
    const mine = ++token;
    const pid = opts.getProjectId();
    let nodes = [];
    let tasks = [];
    try { nodes = await listTrace(pid, { limit: 2000 }); } catch (_) { /* ignore */ }
    try { tasks = await listHeartbeatTasks(pid); } catch (_) { /* ignore */ }
    if (mine !== token || !host || !host.isConnected) return;

    const notes = opts.getNotes() || [];
    noteById = new Map(notes.map((n) => [n.id, n]));
    graph = buildTraceGraph({
      nodes, notes, tasks, overrides, projectName: opts.getProjectName ? opts.getProjectName() : '',
    });

    if (!root || !root.isConnected) {
      host.innerHTML = shellHtml();
      root = host.querySelector('.tg-root');
      canvas = host.querySelector('.tg-canvas');
      detail = host.querySelector('.tg-detail');
      if (flow) { flow.unmount(); flow = null; }
    }

    const empty = isGraphEmpty(graph);
    const emptyEl = host.querySelector('.tg-empty');
    canvas.hidden = empty;
    emptyEl.hidden = !empty;
    host.querySelector('.tg-toolbar').hidden = empty;
    if (empty) {
      emptyEl.textContent = '还没有可绘制的内容。与主代理对话、派出子代理，或设置心跳追踪任务后，这里会按“输入 → 回复 → 子代理 → 断言 / 判断”长出分支。';
      paintDetail();
      return;
    }

    const s = graph.stats;
    host.querySelector('[data-tg-stats]').textContent =
      `${s.turns} 个回合 · ${s.subagents} 个子代理 · ${s.judgments} 个判断${s.revisions ? ` · ${s.revisions} 次修正` : ''}`;

    let mod;
    try { mod = await loadFlow(); } catch (err) {
      flowLoading = null;
      emptyEl.hidden = false;
      canvas.hidden = true;
      emptyEl.textContent = `导图组件加载失败：${(err && err.message) || err}`;
      return;
    }
    if (mine !== token || !host.isConnected) return;
    if (!flow) flow = mod.mountTraceFlow(canvas);
    if (selectedId && !graph.nodes.some((n) => n.id === selectedId)) selectedId = '';
    paintDetail();
    draw();
  }

  function onClick(e) {
    if (e.target.closest('[data-tg-fit]')) { flow && flow.fit('all'); return; }
    if (e.target.closest('[data-tg-latest]')) { flow && flow.fit('latest'); return; }
    if (e.target.closest('[data-tg-full]')) { setFull(!full); return; }
    const open = e.target.closest('[data-tg-note]');
    if (open) opts.onOpenNote?.(open.dataset.tgNote);
  }

  function stopLive() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
  }

  function startLive() {
    stopLive();
    unsubscribe = subscribeTrace((pid) => {
      if (!host || !host.isConnected) { stopLive(); teardown(); return; }
      if (pid && pid !== (opts.getProjectId() || 'default')) return;
      if (liveTimer) return;
      liveTimer = setTimeout(() => { liveTimer = null; render(); }, 800);
    });
  }

  function teardown() {
    if (full) { full = false; document.removeEventListener('keydown', onEsc, true); }
    if (flow) { flow.unmount(); flow = null; }
    root = null; canvas = null; detail = null;
  }

  return {
    async mount(el) {
      if (host && host !== el) { host.removeEventListener('click', onClick); teardown(); }
      host = el;
      host.addEventListener('click', onClick);
      startLive();
      await render();
    },
    /** 标签切走 / 预览被替换前调用，释放 React 根与监听。 */
    unmount() {
      stopLive();
      token += 1;
      if (host) host.removeEventListener('click', onClick);
      teardown();
      host = null;
    },
    refresh: render,
  };
}
