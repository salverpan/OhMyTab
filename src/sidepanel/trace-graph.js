/**
 * 任务追踪：ChatFlow + 简报。
 */

import { listHeartbeatTasks } from '../lib/heartbeat.js';
import { listTrace, subscribeTrace } from '../lib/trace-log.js';
import { buildProcessTimeline } from '../lib/trace-model.js';
import { buildBriefing, isBriefingEmpty } from '../lib/briefing-model.js';
import { briefingHtml } from './briefing-view.js';
import { chatFlowHtml } from './chat-flow-view.js';

const KIND_LABEL = {
  turn: '输入', agent: '主代理回复', subagent: '子代理',
  claim: '断言', unresolved: '未解决项', judgment: '判断', observation: '观测',
  finding: '一线判断', report: '研报', kj: '核心判断', evidence: '证据',
};
const TURN_LABEL = { user: '用户输入', heartbeat: '心跳运行', followup: '子代理回报' };
const STATUS_LABEL = {
  open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用',
  running: '进行中', completed: '完成', incomplete: '未提交报告', error: '失败', aborted: '已中断',
  ok: '完成',
  'cross-source-pass': '多源通过', 'entailment-pass': '蕴含通过', 'citation-pass': '引文通过',
  'citation-fail': '引文失败', overclaim: '过度断言', 'source-conflict': '来源冲突', 'source-unverified': '未核验',
};
const CONF_LABEL = { high: '高', medium: '中', low: '低' };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function kindLabel(node) {
  if (node.kind === 'turn') return TURN_LABEL[node.subtype] || KIND_LABEL.turn;
  if (node.kind === 'subagent' && node.subtype) return `子代理 · ${node.subtype}`;
  return KIND_LABEL[node.kind] || node.kind;
}

/** 笔记判断的详情（测试与少数跳转仍用）。 */
export function traceDetailHtml(node, noteById = new Map()) {
  if (!node) return '';
  const status = STATUS_LABEL[node.status] ?? node.status;
  const rows = [];
  rows.push(`<div class="tg-d-head"><span class="tg-d-kind">${esc(kindLabel(node))}</span>${status ? `<span class="tg-d-status">${esc(status)}</span>` : ''}<span class="tg-d-time">${esc(fmtTime(node.ts))}</span></div>`);
  if (node.title) rows.push(`<div class="tg-d-title">${esc(node.title)}</div>`);
  if (node.text && node.text !== node.title) rows.push(`<div class="tg-d-text">${esc(node.text)}</div>`);
  const meta = node.meta || {};
  if (node.kind === 'judgment' || node.kind === 'observation') {
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

export function createTraceGraphView(opts) {
  let host = null;
  let token = 0;
  let unsubscribe = null;
  let liveTimer = null;
  let activeId = '';

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
    const briefing = buildBriefing({ nodes, notes, tasks, activeId });
    const flow = buildProcessTimeline({ nodes, notes, tasks });
    activeId = briefing.activeId || '';
    host.innerHTML = `<div class="tg-root" data-mode="briefing">${chatFlowHtml(flow)}${briefingHtml(briefing)}</div>`;
  }

  function onClick(e) {
    const draft = e.target.closest('[data-db-draft]');
    if (draft) { opts.onDraftChat?.(draft.dataset.dbDraft); return; }
    const note = e.target.closest('[data-db-note], [data-tg-note]');
    if (note) { opts.onOpenNote?.(note.dataset.dbNote || note.dataset.tgNote); return; }
    const out = e.target.closest('[data-tg-output]');
    if (out) { opts.onOpenOutput?.(out.dataset.tgOutput); }
  }

  function onChange(e) {
    const sel = e.target.closest('[data-tg-arg]');
    if (!sel) return;
    activeId = sel.value;
    render();
  }

  function stopLive() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
  }

  function startLive() {
    stopLive();
    unsubscribe = subscribeTrace((pid) => {
      if (!host || !host.isConnected) { stopLive(); return; }
      if (pid && pid !== (opts.getProjectId() || 'default')) return;
      if (liveTimer) return;
      liveTimer = setTimeout(() => { liveTimer = null; render(); }, 800);
    });
  }

  return {
    async mount(el) {
      if (host && host !== el) {
        host.removeEventListener('click', onClick);
        host.removeEventListener('change', onChange);
      }
      host = el;
      host.addEventListener('click', onClick);
      host.addEventListener('change', onChange);
      startLive();
      await render();
    },
    unmount() {
      stopLive();
      token += 1;
      if (host) {
        host.removeEventListener('click', onClick);
        host.removeEventListener('change', onChange);
      }
      host = null;
    },
    refresh: render,
  };
}

export { isBriefingEmpty };
