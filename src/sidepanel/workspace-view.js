/**
 * 工作区视图 —— 来源 / 笔记 / 产出三主干 + 统一预览。
 *
 * 来源 / 产出 来自 entries（+ 深度任务读到、尚未加入来源的网页）
 * 笔记 来自 notebook_{projectId} 的短结论，以及 write_research_artifact 落的长研究笔记
 */

import { listNotes, formatSource, removeNote, updateNote } from '../lib/notebook.js';
import { logActivity } from '../lib/activity-log.js';
import { listArtifacts, getArtifact, readSection, deleteArtifact, updateArtifact } from '../lib/artifact-store.js';
import { getDocFile } from '../lib/doc-store.js';
import { inferEntryType, isResearchNoteArtifact, researchNoteBadge } from '../lib/source-model.js';
import { mountChart, disposeChartHost } from '../lib/chat-charts.js';
import { createTimelineView } from './timeline-view.js';
import { computeOverviewStats, buildOverviewCharts } from '../lib/overview-stats.js';

const TRUNKS = [
  { id: 'sources', label: '来源' },
  { id: 'notes', label: '笔记' },
  { id: 'outputs', label: '产出' },
];

const NOTE_STATUS_LABEL = {
  open: '待核实',
  verified: '已核实',
  refuted: '被推翻',
  dropped: '已弃用',
};

const COLLAPSE_KEY = (pid) => `wsTrunks_${pid || 'default'}`;
const DEFAULT_COLLAPSED = Object.freeze({
  sources: false,
  notes: false,
  outputs: false,
});

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isProductEntry(e) {
  return !!e && inferEntryType(e) === 'output';
}

function entryTitle(e) {
  return e.aiTitle || e.originalTitle || e.fileName || '(无标题)';
}

function materialBadge(e) {
  if (e.status === 'collecting') return '采集中';
  if (e.status === 'summarizing') return '总结中';
  if (e.status === 'blocked') return '需验证';
  if (e.status === 'error') return '失败';
  if (e.kind === 'image') return '图片';
  if (e.kind === 'document' || e.source === 'upload') return '上传';
  if (e.kind === 'snippet') return '摘录';
  if (e._artifactOnly) return '网页';
  return '采集';
}

function productFormat(e) {
  return String(e?.format || 'md').toUpperCase();
}

const OPEN_FORMATS = new Set(['docx', 'md', 'csv', 'xlsx', 'pdf', 'doc', 'txt']);

function canOpenEntry(e) {
  return !!(e && OPEN_FORMATS.has(String(e.format || '').toLowerCase()));
}

function canOpenUrl(e) {
  return !!(e && e.url && !String(e.url).startsWith('local://'));
}

function rowUrl(row) {
  if (row.kind === 'entry') return canOpenUrl(row.entry) ? row.entry.url : '';
  const u = row.artifact?.url;
  if (row.kind === 'artifact' && u && /^https?:\/\//i.test(u)) return u;
  return '';
}

function selectorFromAnchor(anchor) {
  const value = String(anchor || '').replace(/^.*#/, '');
  if (/^c\d+$/i.test(value)) return { chunk: Number(value.slice(1)) };
  if (/^p\d+$/i.test(value)) return { page: Number(value.slice(1)) };
  if (/^o\d+$/i.test(value)) return { offset: Number(value.slice(1)), maxChars: 4000 };
  return {};
}

function actionsForRow(row) {
  const acts = [];
  if (row.kind === 'entry' && canOpenEntry(row.entry)) acts.push({ act: 'open', label: '打开' });
  if (row.kind === 'entry' && ['pdf', 'doc'].includes(String(row.entry?.format || '').toLowerCase())) {
    acts.push({ act: 'convert', label: '转可编辑' });
  }
  if (rowUrl(row)) acts.push({ act: 'url', label: '链接' });
  acts.push({ act: 'rename', label: '改名' });
  acts.push({ act: 'export', label: '导出' });
  acts.push({ act: 'delete', label: '删除', danger: true });
  return acts;
}

function actionsHtml(acts, extraClass = '') {
  return acts.map((a) =>
    `<button type="button" class="ws-act${a.danger ? ' danger' : ''}${extraClass ? ` ${extraClass}` : ''}" data-act="${escAttr(a.act)}" title="${escAttr(a.label)}">${escHtml(a.label)}</button>`
  ).join('');
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.root
 * @param {() => string} opts.getProjectId
 * @param {() => string} opts.getProjectName
 * @param {() => Array} opts.getEntries
 * @param {() => Set} opts.getSelectedIds
 * @param {(ids: Set) => void} opts.setSelectedIds
 * @param {(entry: object) => void} opts.onOpenDoc
 * @param {(entry: object) => void} opts.onConvertEntry
 * @param {(entry: object) => void} opts.onDeleteEntry
 * @param {(entry: object, title: string) => void} opts.onRenameEntry
 * @param {(entry: object) => void} opts.onOpenUrl
 * @param {(entries: Array) => void} opts.onExportOriginalEntries
 * @param {(trunk: 'sources'|'notes'|'outputs'|'all') => Promise<void>} opts.onClearTrunk
 * @param {(msg: string, isErr?: boolean) => void} opts.showToast
 * @param {() => void} [opts.onSelectionChange]
 */
export function createWorkspaceView(opts) {
  const root = opts.root;
  if (!root) throw new Error('workspace-view: root required');

  let searchQuery = '';
  let selectedKey = ''; // e.g. sources:entryId
  let selectedKeys = new Set();
  let lastSelectedKey = '';
  let collapsed = { ...DEFAULT_COLLAPSED };
  let cache = { sources: [], notes: [], outputs: [] };
  let allCache = { sources: [], notes: [], outputs: [] };
  let previewSplit = 0.42; // preview pane width ratio of tree+preview
  let previewEpoch = 0;

  const els = {
    projectName: root.querySelector('#wsProjectName'),
    search: root.querySelector('#wsSearchInput'),
    tree: root.querySelector('#wsTree'),
    preview: root.querySelector('#wsPreview'),
    previewBody: root.querySelector('#wsPreviewBody'),
    previewTitle: root.querySelector('#wsPreviewTitle'),
    previewMeta: root.querySelector('#wsPreviewMeta'),
    previewActs: root.querySelector('#wsPreviewActs'),
    previewBack: root.querySelector('#wsPreviewBack'),
    split: root.querySelector('#wsPreviewSplit'),
    exportAll: root.querySelector('#exportAllBtn'),
    exportSelected: root.querySelector('#exportSelectedBtn'),
    clearAll: root.querySelector('#clearAllBtn'),
    countMaterials: null,
  };

  async function loadCollapsed() {
    collapsed = { ...DEFAULT_COLLAPSED };
    try {
      const pid = opts.getProjectId();
      const { [COLLAPSE_KEY(pid)]: saved } = await chrome.storage.local.get(COLLAPSE_KEY(pid));
      if (saved && typeof saved === 'object') collapsed = { ...collapsed, ...saved };
    } catch (_) { /* ignore */ }
  }

  function persistCollapsed() {
    const pid = opts.getProjectId();
    chrome.storage.local.set({ [COLLAPSE_KEY(pid)]: collapsed }).catch(() => {});
  }

  async function buildRows() {
    const pid = opts.getProjectId();
    const entries = opts.getEntries() || [];
    const sources = [];
    const outputs = [];
    const entryUrls = new Set();
    const entryIds = new Set();

    for (const e of entries) {
      if (e.id) entryIds.add(String(e.id));
      if (e.url) entryUrls.add(String(e.url));
      if (isProductEntry(e)) {
        outputs.push({
          key: `outputs:${e.id}`,
          trunk: 'outputs',
          kind: 'entry',
          id: e.id,
          title: entryTitle(e),
          badge: productFormat(e),
          subtitle: [(e.aiSummary || '').slice(0, 100), ...(e.tags || []).slice(0, 3).map((tag) => `#${tag}`)].filter(Boolean).join(' · '),
          updatedAt: e.createdAt || e.publishedAt,
          entry: e,
        });
      } else {
        sources.push({
          key: `sources:${e.id}`,
          trunk: 'sources',
          kind: 'entry',
          id: e.id,
          title: entryTitle(e),
          badge: materialBadge(e),
          subtitle: [e.aiSummary, ...(e.tags || []).map((tag) => `#${tag}`)].filter(Boolean).join(' · ').slice(0, 160),
          updatedAt: e.createdAt || e.publishedAt,
          entry: e,
        });
      }
    }

    const researchNotes = [];
    // AI 深度任务读过但未形成 Entry 的网页 → 来源；子代理研究笔记 → 笔记
    try {
      const arts = await listArtifacts({ limit: 200, projectId: pid });
      for (const a of arts) {
        if (isResearchNoteArtifact(a)) {
          researchNotes.push({
            key: `notes:art:${a.doc_id}`,
            trunk: 'notes',
            kind: 'artifact',
            id: a.doc_id,
            title: a.title || '研究笔记',
            badge: researchNoteBadge(a),
            subtitle: a.chars ? `${a.chars} 字` : '',
            updatedAt: a.updatedAt,
            artifact: a,
          });
          continue;
        }
        const url = String(a.url || '');
        if (url && entryUrls.has(url)) continue;
        if (a.sourceEntryId && entryIds.has(String(a.sourceEntryId))) continue;
        if (a.trustClass !== 'source') continue;
        sources.push({
          key: `sources:art:${a.doc_id}`,
          trunk: 'sources',
          kind: 'artifact',
          id: a.doc_id,
          title: a.title || url || a.doc_id,
          badge: '网页',
          subtitle: `${a.chars || 0} 字符`,
          updatedAt: a.updatedAt,
          artifact: a,
        });
      }
    } catch (_) { /* ignore */ }

    const claimNotes = (await listNotes(pid)).map((n) => ({
      key: `notes:${n.id}`,
      trunk: 'notes',
      kind: 'note',
      id: n.id,
      title: n.claim,
      badge: NOTE_STATUS_LABEL[n.status] || n.status,
      subtitle: (n.sources || []).map(formatSource).filter(Boolean).slice(0, 2).join(' · '),
      updatedAt: n.updatedAt || n.createdAt,
      note: n,
    }));
    const notes = [...researchNotes, ...claimNotes]
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));

    const q = searchQuery.trim().toLowerCase();
    const filter = (rows) => {
      if (!q) return rows;
      return rows.filter((r) => {
        const hay = `${r.title} ${r.subtitle} ${r.badge}`.toLowerCase();
        return hay.includes(q);
      });
    };

    allCache = { sources, notes, outputs };
    cache = {
      sources: filter(sources),
      notes: filter(notes),
      outputs: filter(outputs),
      totals: {
        sources: sources.length,
        notes: notes.length,
        outputs: outputs.length,
      },
    };

    // entry 选择沿用宿主 selectedIds；笔记与 artifact 选择由工作区自己维护。
    selectedKeys = new Set([...selectedKeys].filter((key) =>
      key.startsWith('notes:') || key.startsWith('sources:art:')));
    const selectedEntryIds = opts.getSelectedIds();
    for (const r of [...sources, ...outputs]) {
      if (r.kind === 'entry' && selectedEntryIds.has(r.id)) selectedKeys.add(r.key);
    }
    const validKeys = new Set([...sources, ...notes, ...outputs].map((r) => r.key));
    selectedKeys = new Set([...selectedKeys].filter((key) => validKeys.has(key)));
  }

  function findRow(key) {
    for (const t of TRUNKS) {
      const hit = allCache[t.id]?.find((r) => r.key === key);
      if (hit) return hit;
    }
    return null;
  }

  function renderTree() {
    if (!els.tree) return;
    const parts = [];

    for (const t of TRUNKS) {
      const rows = cache[t.id] || [];
      const total = cache.totals?.[t.id] ?? rows.length;
      const isCollapsed = !!collapsed[t.id];
      parts.push(`
        <section class="ws-trunk${isCollapsed ? ' collapsed' : ''}" data-trunk="${t.id}">
          <button type="button" class="ws-trunk-head" data-toggle-trunk="${t.id}" aria-expanded="${!isCollapsed}">
            <svg class="ws-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="ws-trunk-label">${escHtml(t.label)}</span>
            <span class="ws-trunk-count">${total}</span>
          </button>
          <div class="ws-trunk-body" ${isCollapsed ? 'hidden' : ''}>
            ${rows.length === 0
              ? `<div class="ws-empty-trunk">${searchQuery ? '无匹配项' : '暂无'}</div>`
              : rows.map((r) => {
                const sel = selectedKeys.has(r.key);
                const active = selectedKey === r.key;
                return `
                  <div class="ws-row${active ? ' active' : ''}${sel ? ' selected' : ''}"
                       data-key="${escAttr(r.key)}" data-trunk="${t.id}" data-id="${escAttr(r.id)}" data-kind="${escAttr(r.kind)}"
                       role="option" aria-selected="${active}">
                    <input type="checkbox" class="ws-check" data-check-key="${escAttr(r.key)}" ${sel ? 'checked' : ''} aria-label="选择">
                    <div class="ws-row-main">
                      <div class="ws-row-title">${escHtml(r.title)}</div>
                      ${r.subtitle ? `<div class="ws-row-sub">${escHtml(r.subtitle)}</div>` : ''}
                    </div>
                    <span class="ws-badge">${escHtml(r.badge)}</span>
                    <span class="ws-row-time">${escHtml(formatTime(r.updatedAt))}</span>
                    <div class="ws-row-reveal">
                      <div class="ws-row-veil" aria-hidden="true">
                        <span class="ws-row-veil-b ws-row-veil-b1"></span>
                        <span class="ws-row-veil-b ws-row-veil-b2"></span>
                        <span class="ws-row-veil-b ws-row-veil-b3"></span>
                        <span class="ws-row-veil-wash"></span>
                      </div>
                      <div class="ws-row-actions">
                        ${actionsHtml(actionsForRow(r))}
                      </div>
                    </div>
                  </div>`;
              }).join('')}
          </div>
        </section>`);
    }
    els.tree.innerHTML = parts.join('');
  }

  function openNote(noteId) {
    const row = (allCache.notes || []).find((r) => r.id === noteId);
    if (!row) {
      opts.showToast?.('这条笔记已不存在', true);
      return;
    }
    selectedKey = row.key;
    lastSelectedKey = row.key;
    if (collapsed.notes) {
      collapsed.notes = false;
      persistCollapsed();
    }
    renderTree();
    renderPreview();
  }

  function openOutput(entryId) {
    const row = (allCache.outputs || []).find((r) => r.id === entryId);
    if (!row) {
      opts.showToast?.('这份产出已不存在', true);
      return;
    }
    selectedKey = row.key;
    lastSelectedKey = row.key;
    if (collapsed.outputs) {
      collapsed.outputs = false;
      persistCollapsed();
    }
    renderTree();
    renderPreview();
  }

  const timeline = createTimelineView({
    getProjectId: () => opts.getProjectId(),
    getProjectName: () => opts.getProjectName?.() || '',
    getNotes: () => (allCache.notes || []).map((r) => r.note).filter(Boolean),
    onOpenNote: openNote,
    onOpenOutput: openOutput,
    onDraftChat: (text) => opts.onDraftChat?.(text),
  });

  async function renderPreview() {
    if (!els.previewBody) return;
    const epoch = ++previewEpoch;
    const row = selectedKey ? findRow(selectedKey) : null;
    els.previewBody.querySelectorAll('.ws-chart').forEach(disposeChartHost);

    if (els.projectName) {
      els.projectName.textContent = opts.getProjectName?.() || opts.getProjectId() || '';
    }
    if (els.previewBack) els.previewBack.hidden = !row;

    if (!row) {
      if (els.previewTitle) els.previewTitle.textContent = '项目概览';
      if (els.previewMeta) els.previewMeta.textContent = '';
      if (els.previewActs) {
        els.previewActs.hidden = true;
        els.previewActs.innerHTML = '';
      }
      const recentOutputs = (allCache.outputs || []).slice(0, 3);
      const charts = buildOverviewCharts(computeOverviewStats(allCache));
      els.previewBody.innerHTML = `
        <div class="ws-overview">
          ${charts.map((c) => `
            <div class="ws-chart-card">
              <div class="ws-chart-title">${escHtml(c.title)}${c.hint ? `<span class="ws-chart-hint">${escHtml(c.hint)}</span>` : ''}</div>
              <div class="ws-chart" data-chart-id="${escAttr(c.id)}" style="height:${Number(c.height) || 120}px" role="img" aria-label="${escAttr(c.title)}"></div>
            </div>`).join('')}
          ${recentOutputs.length ? `<div class="ws-overview-block"><h4>最近产出</h4><ul>${recentOutputs.map((a) => `<li>${escHtml(a.title)}</li>`).join('')}</ul></div>` : ''}
          <div class="ws-timeline" id="wsTimeline"></div>
        </div>`;
      for (const c of charts) {
        const host = els.previewBody.querySelector(`.ws-chart[data-chart-id="${c.id}"]`);
        if (host) mountChart(host, c.option);
      }
      const tlHost = els.previewBody.querySelector('#wsTimeline');
      if (tlHost) timeline.mount(tlHost).catch((err) => console.warn('[OhMyTab] timeline render failed:', err));
      return;
    }

    if (els.previewTitle) els.previewTitle.textContent = row.title;
    if (els.previewMeta) {
      els.previewMeta.textContent = [row.badge, formatTime(row.updatedAt)].filter(Boolean).join(' · ');
    }
    if (els.previewActs) {
      const acts = actionsForRow(row);
      els.previewActs.innerHTML = actionsHtml(acts);
      els.previewActs.hidden = acts.length === 0;
    }

    if (row.kind === 'entry') {
      const e = row.entry;
      if (e.kind === 'image') {
        els.previewBody.innerHTML = '<p class="ws-muted">正在加载图片…</p>';
        const ab = await getDocFile(e.docId || e.id).catch(() => null);
        if (epoch !== previewEpoch || selectedKey !== row.key) return;
        const mime = e.format === 'png' ? 'image/png'
          : e.format === 'webp' ? 'image/webp'
          : e.format === 'gif' ? 'image/gif'
          : 'image/jpeg';
        const src = ab ? URL.createObjectURL(new Blob([ab], { type: mime })) : '';
        els.previewBody.innerHTML = `
          <div class="ws-preview-entry">
            ${src ? `<img class="ws-preview-img" src="${escAttr(src)}" alt="${escAttr(e.aiTitle || '')}">` : '<p class="ws-muted">找不到图片原件</p>'}
            ${e.aiSummary ? `<p class="ws-preview-summary">${escHtml(e.aiSummary)}</p>` : ''}
            ${e.url ? `<p class="ws-preview-url"><a href="${escAttr(e.url)}" target="_blank" rel="noopener">${escHtml(e.url)}</a></p>` : ''}
          </div>`;
        return;
      }
      const body = (e.fullText || e.aiSummary || '').slice(0, 4000);
      const more = (e.fullText || '').length > 4000 ? '\n\n…' : '';
      els.previewBody.innerHTML = `
        <div class="ws-preview-entry">
          ${e.aiSummary ? `<p class="ws-preview-summary">${escHtml(e.aiSummary)}</p>` : ''}
          ${e.url ? `<p class="ws-preview-url"><a href="${escAttr(e.url)}" target="_blank" rel="noopener">${escHtml(e.url)}</a></p>` : ''}
          <pre class="ws-preview-text">${escHtml(body)}${more}</pre>
        </div>`;
    } else if (row.kind === 'artifact') {
      const research = isResearchNoteArtifact(row.artifact || {});
      els.previewBody.innerHTML = research
        ? '<p class="ws-muted">正在读取研究笔记…</p>'
        : '<p class="ws-muted">正在读取证据原文…</p>';
      const doc = await getArtifact(row.id).catch(() => null);
      if (epoch !== previewEpoch || selectedKey !== row.key) return;
      const full = String(doc?.fullText || '');
      const cap = research ? 40000 : 4000;
      const body = full.slice(0, cap);
      const href = /^https?:\/\//i.test(String(row.artifact?.url || '')) ? row.artifact.url : '';
      els.previewBody.innerHTML = `
        <div class="ws-preview-entry">
          ${href ? `<p class="ws-preview-url"><a href="${escAttr(href)}" target="_blank" rel="noopener">${escHtml(href)}</a></p>` : ''}
          ${research ? '' : `<p class="ws-preview-summary">${escHtml(row.subtitle || '')}</p>`}
          <pre class="ws-preview-text">${escHtml(body || '')}${full.length > cap ? '\n\n…' : ''}</pre>
        </div>`;
    } else if (row.kind === 'note') {
      const n = row.note;
      const srcs = (n.sources || []).map((s) => {
        const label = formatSource(s) || s.note || '';
        return s.doc_id && s.anchor
          ? `<li><button type="button" class="ws-source-anchor" data-doc="${escAttr(s.doc_id)}" data-anchor="${escAttr(s.anchor)}">${escHtml(label)}</button></li>`
          : `<li>${escHtml(label)}</li>`;
      }).join('');
      const trail = (Array.isArray(n.history) ? n.history : []).filter((h) => h && h.from != null);
      const linkBtn = (id, label) => `<button type="button" class="ws-tl-link" data-goto-note="${escAttr(id)}">${escHtml(label)}</button>`;
      const historyHtml = (trail.length || n.supersedes || n.supersededBy || n.verifyAt)
        ? `<h4>追踪</h4><ul class="ws-source-list">
            ${n.verifyAt ? `<li>预计验证：${escHtml(formatTime(n.verifyAt))}</li>` : ''}
            ${n.supersedes ? `<li>修正自：${linkBtn(n.supersedes, '上一条判断')}</li>` : ''}
            ${n.supersededBy ? `<li>已被修正为：${linkBtn(n.supersededBy, '新判断')}</li>` : ''}
            ${trail.map((h) => `<li>${escHtml(formatTime(h.ts))} ${escHtml(NOTE_STATUS_LABEL[h.from] || h.from)} → ${escHtml(NOTE_STATUS_LABEL[h.to] || h.to)}${h.reason ? `：${escHtml(h.reason)}` : ''}</li>`).join('')}
          </ul>`
        : '';
      els.previewBody.innerHTML = `
        <div class="ws-preview-note">
          <p class="ws-note-claim">${escHtml(n.claim)}</p>
          <p class="ws-preview-meta-line">状态：${escHtml(NOTE_STATUS_LABEL[n.status] || n.status)} · 置信度：${escHtml(n.confidence || '')}</p>
          ${historyHtml}
          <h4>出处</h4>
          <ul class="ws-source-list">${srcs || '<li>（无）</li>'}</ul>
          <div class="ws-source-replay"></div>
        </div>`;
    }
  }

  function backToOverview() {
    if (!selectedKey) return;
    selectedKey = '';
    renderTree();
    renderPreview();
  }

  function updateToolbar() {
    const totals = cache.totals || {};
    const hasAnything = Object.values(totals).some((n) => Number(n) > 0);
    if (els.exportAll) els.exportAll.disabled = !hasAnything;
    if (els.exportSelected) els.exportSelected.disabled = selectedKeys.size === 0;
    if (els.clearAll) els.clearAll.disabled = !hasAnything;
    opts.onSelectionChange?.();
  }

  async function refresh() {
    await buildRows();
    renderTree();
    renderPreview();
    updateToolbar();
  }

  function dropRowFromView(row) {
    selectedKeys.delete(row.key);
    if (selectedKey === row.key) selectedKey = '';
    if (lastSelectedKey === row.key) lastSelectedKey = '';
    for (const t of TRUNKS) {
      allCache[t.id] = (allCache[t.id] || []).filter((r) => r.key !== row.key);
      cache[t.id] = (cache[t.id] || []).filter((r) => r.key !== row.key);
      if (cache.totals && typeof cache.totals[t.id] === 'number') {
        cache.totals[t.id] = Math.max(0, (allCache[t.id] || []).length);
      }
    }
    renderTree();
    renderPreview();
    updateToolbar();
  }

  async function deleteRow(row) {
    dropRowFromView(row);
    if (row.kind === 'entry') {
      await opts.onDeleteEntry?.(row.entry);
      return;
    }
    if (row.kind === 'note') {
      const res = await removeNote(opts.getProjectId(), row.id);
      if (res.error) opts.showToast?.(res.error, true);
      await refresh();
      return;
    }
    if (row.kind === 'artifact') {
      const res = await deleteArtifact(row.id);
      if (res.error) opts.showToast?.(res.error, true);
      await refresh();
    }
  }

  async function renameRow(row) {
    const title = window.prompt('新名称', row.title);
    if (title == null || !title.trim() || title.trim() === row.title) return;
    const next = title.trim();
    if (row.kind === 'entry') {
      await opts.onRenameEntry?.(row.entry, next);
    } else if (row.kind === 'note') {
      const res = await updateNote(opts.getProjectId(), row.id, { claim: next });
      if (res.error) return opts.showToast?.(res.error, true);
    } else if (row.kind === 'artifact') {
      const res = await updateArtifact(row.id, { title: next });
      if (res.error) return opts.showToast?.(res.error, true);
    }
    await refresh();
  }

  function allRows() {
    return TRUNKS.flatMap((t) => allCache[t.id] || []);
  }

  function rowsForMode(mode) {
    const rows = allRows();
    return mode === 'selected' ? rows.filter((r) => selectedKeys.has(r.key)) : rows;
  }

  function downloadText(text, filename, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function hydrateRow(row) {
    if (row.kind !== 'artifact') return row;
    const doc = await getArtifact(row.id).catch(() => null);
    return { ...row, artifactDoc: doc };
  }

  function rowSourceText(row) {
    if (row.kind === 'entry') return row.entry?.url || row.entry?.source || '';
    if (row.kind === 'note') return (row.note?.sources || []).map(formatSource).filter(Boolean).join('；');
    return row.artifact?.url || row.id;
  }

  function rowBody(row) {
    if (row.kind === 'entry') return row.entry?.fullText || row.entry?.aiSummary || '';
    if (row.kind === 'note') return row.note?.claim || '';
    return row.artifactDoc?.fullText || '';
  }

  async function exportRows(rows, format) {
    if (!rows.length) return opts.showToast?.('没有可导出的内容', true);
    logActivity({
      projectId: opts.getProjectId(),
      actor: 'user',
      cat: 'file',
      action: 'export',
      label: '导出',
      detail: `${rows.length} 项 · ${format}`,
      status: 'ok',
    });
    let hydrated = await Promise.all(rows.map(hydrateRow));
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    if (format === 'original') {
      const entries = hydrated.filter((r) => r.kind === 'entry').map((r) => r.entry);
      if (entries.length) await opts.onExportOriginalEntries?.(entries);
      const knowledge = hydrated.filter((r) => r.kind !== 'entry');
      if (!knowledge.length) return;
      hydrated = knowledge;
      format = 'md';
    }

    if (format === 'json') {
      const payload = {
        version: 1,
        projectId: opts.getProjectId(),
        projectName: opts.getProjectName?.() || '',
        exportedAt: new Date().toISOString(),
        items: hydrated.map((r) => ({
          trunk: r.trunk,
          kind: r.kind,
          id: r.id,
          title: r.title,
          badge: r.badge,
          summary: r.subtitle || '',
          body: rowBody(r),
          source: rowSourceText(r),
          entry: r.kind === 'entry' ? r.entry : undefined,
          note: r.kind === 'note' ? r.note : undefined,
        })),
      };
      downloadText(JSON.stringify(payload, null, 2), `OhMyTab_工作区_${stamp}.json`, 'application/json;charset=utf-8');
      return;
    }

    if (format === 'csv') {
      const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [['主干', '标题', '类型', '摘要', '来源', '日期'].map(quote).join(',')];
      for (const r of hydrated) {
        lines.push([
          TRUNKS.find((t) => t.id === r.trunk)?.label || r.trunk,
          r.title, r.badge, r.subtitle || '', rowSourceText(r), formatTime(r.updatedAt),
        ].map(quote).join(','));
      }
      downloadText(`\uFEFF${lines.join('\n')}`, `OhMyTab_摘要清单_${stamp}.csv`, 'text/csv;charset=utf-8');
      return;
    }

    const sections = [];
    for (const trunk of TRUNKS) {
      const group = hydrated.filter((r) => r.trunk === trunk.id);
      if (!group.length) continue;
      sections.push(`# ${trunk.label}`);
      for (const r of group) {
        const source = rowSourceText(r);
        sections.push(`## ${r.title}\n\n${source ? `来源：${source}\n\n` : ''}${rowBody(r)}`);
      }
    }
    downloadText(sections.join('\n\n---\n\n'), `OhMyTab_工作区_${stamp}.md`, 'text/markdown;charset=utf-8');
  }

  function closeExportMenus() {
    document.querySelectorAll('.ws-export-dropdown').forEach((el) => el.remove());
  }

  function toggleExportMenu(event, mode) {
    event?.stopPropagation();
    const wrap = event?.currentTarget?.closest('.export-btn-wrap');
    if (!wrap) return;
    const existing = wrap.querySelector('.ws-export-dropdown');
    closeExportMenus();
    if (existing) return;
    const menu = document.createElement('div');
    menu.className = 'export-dropdown ws-export-dropdown';
    [
      ['原件 / 全文', 'original'],
      ['工作区包 (.json)', 'json'],
      ['可读汇编 (.md)', 'md'],
      ['摘要清单 (.csv)', 'csv'],
    ].forEach(([label, format]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'export-dropdown-item';
      button.textContent = label;
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeExportMenus();
        await exportRows(rowsForMode(mode), format);
      });
      menu.appendChild(button);
    });
    wrap.appendChild(menu);
  }

  function toggleClearMenu(event) {
    event?.stopPropagation();
    const wrap = event?.currentTarget?.closest('.export-btn-wrap');
    if (!wrap) return;
    const existing = wrap.querySelector('.ws-export-dropdown');
    closeExportMenus();
    if (existing) return;
    const menu = document.createElement('div');
    menu.className = 'export-dropdown ws-export-dropdown';
    [
      ['清空来源', 'sources'],
      ['清空笔记', 'notes'],
      ['清空产出', 'outputs'],
      ['清空整个工作区', 'all'],
    ].forEach(([label, trunk]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'export-dropdown-item';
      button.textContent = label;
      button.disabled = trunk !== 'all' && !(cache.totals?.[trunk] > 0);
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeExportMenus();
        if (!window.confirm(`确定${label}？此操作不会清空对话。`)) return;
        await opts.onClearTrunk?.(trunk);
        selectedKey = '';
        selectedKeys.clear();
        await refresh();
      });
      menu.appendChild(button);
    });
    wrap.appendChild(menu);
  }

  function setRowSelected(row, selected) {
    if (selected) selectedKeys.add(row.key);
    else selectedKeys.delete(row.key);
    if (row.kind === 'entry') {
      const ids = new Set(opts.getSelectedIds());
      if (selected) ids.add(row.id);
      else ids.delete(row.id);
      opts.setSelectedIds(ids);
    }
  }

  async function runRowAct(row, act) {
    if (act === 'open' && row.entry) opts.onOpenDoc?.(row.entry);
    else if (act === 'convert' && row.entry) opts.onConvertEntry?.(row.entry);
    else if (act === 'convert' && row.entry) opts.onConvertEntry?.(row.entry);
    else if (act === 'url') {
      const url = rowUrl(row);
      if (url) opts.onOpenUrl?.({ url });
    }
    else if (act === 'rename') await renameRow(row);
    else if (act === 'export') {
      await exportRows([row], row.kind === 'entry' ? 'original' : 'md');
    }
    else if (act === 'delete') await deleteRow(row);
  }

  function bindEvents() {
    els.search?.addEventListener('input', () => {
      searchQuery = els.search.value || '';
      refresh();
    });

    els.tree?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-act]')) e.stopPropagation();
    });

    els.tree?.addEventListener('click', async (e) => {
      const toggle = e.target.closest('[data-toggle-trunk]');
      if (toggle) {
        const id = toggle.dataset.toggleTrunk;
        collapsed[id] = !collapsed[id];
        persistCollapsed();
        renderTree();
        return;
      }

      const check = e.target.closest('.ws-check');
      if (check) {
        e.stopPropagation();
        const row = findRow(check.dataset.checkKey);
        if (!row) return;
        setRowSelected(row, check.checked);
        lastSelectedKey = row.key;
        renderTree();
        updateToolbar();
        return;
      }

      const rowEl = e.target.closest('.ws-row');
      if (!rowEl) return;
      const row = findRow(rowEl.dataset.key);
      if (!row) return;

      let actBtn = e.target.closest('[data-act]');
      if (!actBtn && rowEl.matches(':hover')) {
        actBtn = [...rowEl.querySelectorAll('[data-act]')].find((btn) => {
          const r = btn.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX <= r.right
            && e.clientY >= r.top && e.clientY <= r.bottom;
        }) || null;
      }
      if (actBtn) {
        e.preventDefault();
        e.stopPropagation();
        await runRowAct(row, actBtn.dataset.act);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        setRowSelected(row, !selectedKeys.has(row.key));
        lastSelectedKey = row.key;
        renderTree();
        updateToolbar();
      } else if (e.shiftKey && lastSelectedKey) {
        const visible = TRUNKS.flatMap((t) => cache[t.id] || []);
        const a = visible.findIndex((r) => r.key === lastSelectedKey);
        const b = visible.findIndex((r) => r.key === row.key);
        if (a >= 0 && b >= 0) {
          const [start, finish] = a < b ? [a, b] : [b, a];
          for (const r of visible.slice(start, finish + 1)) setRowSelected(r, true);
          renderTree();
          updateToolbar();
        }
      } else {
        lastSelectedKey = row.key;
      }
      selectedKey = row.key;
      renderTree();
      renderPreview();
    });

    els.previewBack?.addEventListener('click', () => backToOverview());

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !selectedKey || root.offsetParent === null) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (document.querySelector('.ws-export-dropdown')) return;
      e.preventDefault();
      backToOverview();
    });

    els.previewActs?.addEventListener('click', async (e) => {
      const actBtn = e.target.closest('[data-act]');
      if (!actBtn || !selectedKey) return;
      const row = findRow(selectedKey);
      if (!row) return;
      e.stopPropagation();
      await runRowAct(row, actBtn.dataset.act);
    });

    els.previewBody?.addEventListener('click', async (e) => {
      const goto = e.target.closest('[data-goto-note]');
      if (goto) {
        openNote(goto.dataset.gotoNote);
        return;
      }
      const button = e.target.closest('.ws-source-anchor');
      if (!button) return;
      const replay = els.previewBody.querySelector('.ws-source-replay');
      if (!replay) return;
      replay.textContent = '正在回放原文…';
      const section = await readSection(button.dataset.doc, selectorFromAnchor(button.dataset.anchor)).catch((error) => ({ error: error.message }));
      replay.textContent = section.error ? section.error : section.text;
    });

    els.tree?.addEventListener('dblclick', (e) => {
      const rowEl = e.target.closest('.ws-row');
      if (!rowEl) return;
      const row = findRow(rowEl.dataset.key);
      if (row?.kind === 'entry' && row.entry) {
        const f = row.entry.format;
        if (f === 'docx' || f === 'md' || f === 'csv' || f === 'xlsx' || f === 'pdf' || f === 'doc' || f === 'txt') {
          opts.onOpenDoc?.(row.entry);
        } else if (rowUrl(row)) {
          opts.onOpenUrl?.({ url: rowUrl(row) });
        }
      } else if (rowUrl(row)) {
        opts.onOpenUrl?.({ url: rowUrl(row) });
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.export-btn-wrap')) closeExportMenus();
    });

    // Preview split drag：改树的粘性宽度，预览吃剩余。拖到最右吸附关闭预览。
    if (els.split && els.preview && els.tree) {
      let dragging = false;
      let startX = 0;
      let startTree = 0;
      const body = root.querySelector('.ws-body');
      const MIN_TREE = 200;
      const SPLIT_W = 5;
      const SNAP_CLOSE_PREVIEW = 88;
      els.split.addEventListener('mousedown', (e) => {
        if (document.getElementById('panelCollect')?.classList.contains('preview-collapsed')) return;
        dragging = true;
        startX = e.clientX;
        startTree = els.tree.offsetWidth;
        document.body.style.userSelect = 'none';
        opts.onLibraryWidth?.(startTree);
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging || !body) return;
        const dx = e.clientX - startX;
        const bodyW = body.clientWidth;
        const nextTree = startTree + dx;
        const previewW = bodyW - nextTree - SPLIT_W;
        if (previewW <= SNAP_CLOSE_PREVIEW) {
          dragging = false;
          document.body.style.userSelect = '';
          opts.onPreviewSnapClose?.();
          return;
        }
        const w = Math.max(MIN_TREE, Math.min(bodyW - SPLIT_W - SNAP_CLOSE_PREVIEW, nextTree));
        opts.onLibraryWidth?.(w);
      });
      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
        opts.onPaneSplitEnd?.();
      });
    }
  }

  async function init() {
    await loadCollapsed();
    bindEvents();
    await refresh();
  }

  return {
    init,
    refresh,
    setSearch(q) {
      searchQuery = q || '';
      if (els.search) els.search.value = searchQuery;
      return refresh();
    },
    clearSelectionPreview: backToOverview,
    focusNote: openNote,
    async focusEntry(entryId) {
      if (!entryId) return;
      await refresh();
      const row = allRows().find((r) => r.kind === 'entry' && r.id === entryId);
      if (!row) return;
      selectedKey = row.key;
      lastSelectedKey = row.key;
      renderTree();
      renderPreview();
    },
    async projectChanged() {
      selectedKey = '';
      selectedKeys.clear();
      lastSelectedKey = '';
      searchQuery = '';
      if (els.search) els.search.value = '';
      await loadCollapsed();
      await refresh();
    },
    toggleExportMenu,
    toggleClearMenu,
    updateToolbar,
    getCache: () => cache,
  };
}

export { TRUNKS, isProductEntry };
