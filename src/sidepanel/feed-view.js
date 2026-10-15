/**
 * Feed view (sub panel) - subscription source list + item stream.
 * Communicates with service-worker via FEED_* messages.
 */

import { pickLocalFiles, OPML_PICK_TYPES } from '../lib/pick-files.js';

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

/**
 * Expand RSSHub shorthand inputs into full URLs.
 *   "https://..."             → unchanged
 *   "http://..."              → unchanged
 *   "rsshub:twitter/user/x"   → "{instance}/twitter/user/x"
 *   "rsshub://twitter/user/x" → "{instance}/twitter/user/x"
 *   "/twitter/user/x"         → "{instance}/twitter/user/x"
 *   anything else             → unchanged (legacy autodiscovery path)
 */
function expandRsshubShorthand(input, instance) {
  if (!input) return input;
  const s = String(input).trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  const base = (instance || 'https://rsshub.app').replace(/\/+$/, '');
  let route = null;
  if (s.startsWith('rsshub://')) route = s.slice('rsshub://'.length);
  else if (s.startsWith('rsshub:')) route = s.slice('rsshub:'.length);
  else if (s.startsWith('/')) route = s.slice(1);
  if (route == null) return s;
  route = route.replace(/^\/+/, '');
  return base + '/' + route;
}

let feedInitialized = false;
let _showToast = (msg) => console.log(msg);
let _escHtml = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
let _escAttr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* 星标图标（SVG，替代 unicode ★☆，跨平台渲染一致） */
let STAR_FILLED = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26 6.6.57-5 4.4 1.5 6.47L12 16.9 5.99 19.7l1.5-6.47-5-4.4 6.6-.57z"/></svg>';
let STAR_OUTLINE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.9 6.26 6.6.57-5 4.4 1.5 6.47L12 16.9 5.99 19.7l1.5-6.47-5-4.4 6.6-.57z"/></svg>';
let _askAi = null;
let _goToCollect = null;

const state = {
  feeds: [],
  items: [],
  activeFeedId: null,
  filter: 'all',
  selectedItemIds: new Set(),
  expandedItemIds: new Set(),
  searchQuery: '',
  hasMore: false,
  loadingMore: false,
  loadToken: 0,
};

const PAGE_SIZE = 80;
let searchDebounceTimer = null;
let pendingOpmlFile = null;
let scrollObserver = null;
let _autoRefreshScheduled = false;
let _lastBackfillRunning = false;

function scheduleAutoRefresh() {
  if (_autoRefreshScheduled) return;
  if (!feedInitialized) return;
  _autoRefreshScheduled = true;
  setTimeout(async () => {
    _autoRefreshScheduled = false;
    try {
      await reloadSidebar();
      await reloadItems();
    } catch (_) {}
  }, 600);
}

function handleTranslateProgress(data) {
  if (!data) return;
  const running = !!data.running;
  // While translating, only refresh the cheap sidebar counts. Items will be
  // refreshed once when the backfill finishes (avoids tearing down 80 DOM
  // cards every 600ms for many minutes).
  if (running) {
    scheduleSidebarRefresh();
  } else if (_lastBackfillRunning && !running) {
    scheduleAutoRefresh();
  }
  _lastBackfillRunning = running;
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.type === 'TRANSLATE_PROGRESS') {
      handleTranslateProgress(message.data);
    } else if (message.type === 'COLLECTION_STATUS_CHANGED') {
      // Patch only the cards whose link matches; falls back to debounced
      // reload only when nothing matched (e.g. an item from another view).
      handleCollectionStatusChanged(message);
    }
  });
}

// 与 panel.js 同策：side panel 隐藏期间消息/存储事件可能不送达，
// 重新可见时强制从 SW 重读（否则"入库了不显示，重开才正常"）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !feedInitialized) return;
  reloadSidebar().catch(() => {});
  reloadItems().catch(() => {});
});

async function handleCollectionStatusChanged(message) {
  const urls = Array.isArray(message?.urls) ? message.urls : [];
  if (message?.refreshAll || urls.length === 0) {
    scheduleAutoRefresh();
    return;
  }
  const urlSet = new Set(urls);
  const affected = state.items.filter((it) => it.link && urlSet.has(it.link));
  if (affected.length === 0) {
    // Item may not be in current view; do a sidebar refresh only (cheap)
    scheduleSidebarRefresh();
    return;
  }
  // Re-fetch fresh server-side state for each affected item, then patch in-place
  await Promise.all(affected.map(async (it) => {
    const resp = await send('FEED_ITEM_GET', { itemId: it.id }).catch(() => null);
    if (resp && resp.success && resp.item) {
      Object.assign(it, resp.item);
      updateItemCard(it);
    }
  }));
  scheduleSidebarRefresh();
}

let _sidebarRefreshScheduled = false;
function scheduleSidebarRefresh() {
  if (_sidebarRefreshScheduled) return;
  if (!feedInitialized) return;
  _sidebarRefreshScheduled = true;
  setTimeout(() => {
    _sidebarRefreshScheduled = false;
    reloadSidebar().catch(() => {});
  }, 600);
}

function send(type, data) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // SW 被 kill / 无响应：兜底返回 null，避免 promise 挂起 + 未处理拒绝
      resolve(null);
    }, 8000);
    try {
      chrome.runtime.sendMessage({ type, data: data || {} }).then(
        (resp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(resp);
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          // 通道关闭：同兜底，不向上抛
          resolve(null);
        },
      );
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Build a chat prompt that asks the AI to search the web for the original
 * article behind a link-less RSS item, then collect it. The user has clicked
 * "加入来源", so we make the intent explicit and let the AI drive the rest
 * (search_web → collect_content → confirm_collect).
 */
function buildAiSearchPrompt(payload) {
  const title = (payload?.title || '').replace(/\s+/g, ' ').trim();
  const summary = (payload?.summary || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const parts = [
    '这条 RSS 没有原文链接，请帮我找到原始来源并直接加入来源（不需要我确认，直接入库）：',
    title ? `标题：${title}` : '',
    summary ? `摘要：${summary}` : '',
    '步骤：先用 search_web 找到权威原始来源（优先官方/政府/大型媒体），命中后调用 collect_content 传入找到的 URL，然后**立即**调用 confirm_collect 完成入库，不要等我说"确认"。若搜不到可靠来源，直接用上面的标题+摘要作为文本调用 collect_content，然后**立即** confirm_collect 入库（不要捏造细节）。',
    '重要：这是一次性授权，collect_content 后直接 confirm_collect，不要再问我"是否加入来源"。',
  ];
  return parts.filter(Boolean).join('\n');
}

function escalateToAiSearch(payload) {
  if (!_askAi) {
    _showToast('请到「采集」标签让 AI 帮你查找原文', true);
    return;
  }
  _askAi(buildAiSearchPrompt(payload));
}

export function initFeedView(opts = {}) {
  if (opts.showToast) _showToast = opts.showToast;
  if (opts.escHtml) _escHtml = opts.escHtml;
  if (opts.escAttr) _escAttr = opts.escAttr;
  if (opts.askAi) _askAi = opts.askAi;
  if (opts.goToCollect) _goToCollect = opts.goToCollect;
  if (feedInitialized) {
    reloadSidebar();
    reloadItems();
    return;
  }
  feedInitialized = true;
  bindEvents();
  reloadSidebar();
  reloadItems();
}

/* 索引重建驱动（2026-08-27 起仅手动）：开机/开面板自动重建已封存——
   写入路径均增量建索引，全量重建由设置页「重建全文索引」按钮触发。
   这里保留循环驱动 + 进度条渲染，供手动流程复用。 */
let indexBuildTimer = 0;
function renderIndexProgress(st) {
  const box = qs('#feedIndexProgress');
  console.log('[RSS] renderIndexProgress:', st, 'box:', !!box);
  if (!box) return;
  if (!st || st.built || st.total === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const pct = Math.min(100, Math.round((st.done / st.total) * 100));
  const bar = box.querySelector('.feed-index-progress-bar');
  const label = box.querySelector('.feed-index-progress-label');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `正在构建搜索索引 ${pct}%（${st.done.toLocaleString()} / ${st.total.toLocaleString()}）`;
}
function kickIndexBuild() {
  console.log('[RSS] kickIndexBuild called, timer:', indexBuildTimer);
  if (indexBuildTimer) return; // 已有循环在跑
  const run = async () => {
    try {
      const resp = await send('FEED_BUILD_INDEX');
      console.log('[RSS] FEED_BUILD_INDEX resp:', resp);
      if (resp && resp.done) { indexBuildTimer = 0; renderIndexProgress(null); return; }
      // 每批后查一次进度刷新进度条
      try {
        const st = await send('FEED_INDEX_STATUS');
        console.log('[RSS] FEED_INDEX_STATUS:', st);
        renderIndexProgress(st);
      } catch (_) {}
    } catch (err) { console.log('[RSS] kickIndexBuild error:', err); indexBuildTimer = 0; return; }
    indexBuildTimer = setTimeout(run, 1200); // 每 1.2s 跑一批，直到完成
  };
  run();
}

/** 手动触发全量索引重建（设置页「重建全文索引」按钮调用）：
 *  先让 SW 重置断点，再启动侧栏循环驱动批次 + 进度条。 */
export async function startManualIndexRebuild() {
  await send('FEED_RESET_INDEX');
  kickIndexBuild();
}

function bindEvents() {
  qs('#feedAddBtn')?.addEventListener('click', openAddDialog);
  qs('#feedDialogCloseBtn')?.addEventListener('click', closeAddDialog);
  qs('#feedDialogCancelBtn')?.addEventListener('click', closeAddDialog);
  qs('#feedDialogAddBtn')?.addEventListener('click', submitAdd);
  qs('#feedAddDialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'feedAddDialog') closeAddDialog();
  });
qs('#feedUrlInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAdd(); }
  });
  qs('#feedOpmlPickBtn')?.addEventListener('click', async () => {
    try {
      const files = await pickLocalFiles({ multiple: false, types: OPML_PICK_TYPES });
      pendingOpmlFile = files[0] || null;
      const nameEl = qs('#feedOpmlName');
      if (nameEl) nameEl.textContent = pendingOpmlFile ? pendingOpmlFile.name : '';
    } catch (err) {
      pendingOpmlFile = null;
      const nameEl = qs('#feedOpmlName');
      if (nameEl) nameEl.textContent = '';
      console.warn('[feed] OPML picker', err);
    }
  });
  qs('#feedRefreshAllBtn')?.addEventListener('click', refreshAll);
  qs('#feedExportBtn')?.addEventListener('click', exportFeedUrls);
  qs('#feedDeleteAllItemsBtn')?.addEventListener('click', deleteAllItems);

  qsa('.feed-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('.feed-filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      reloadItems();
    });
  });

  qs('#feedSearchInput')?.addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (v === state.searchQuery) return;
    state.searchQuery = v;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => { reloadItems(); }, 220);
  });

  qs('#feedCollectBtn')?.addEventListener('click', collectSelected);
  qs('#feedClearSelectedBtn')?.addEventListener('click', () => {
    const ids = Array.from(state.selectedItemIds);
    state.selectedItemIds.clear();
    const list = qs('#feedItemList');
    if (list) {
      ids.forEach((id) => {
        const card = list.querySelector('.feed-item-card[data-item-id="' + CSS.escape(id) + '"]');
        if (card) {
          card.classList.remove('selected');
          const cb = card.querySelector('.feed-item-check');
          if (cb) cb.checked = false;
        }
      });
    }
    updateSelectedBar();
  });

  // Sidebar resizer (drag to adjust width)
  bindSidebarResizer();

  // Edit dialog
  qs('#feedEditCloseBtn')?.addEventListener('click', closeEditDialog);
  qs('#feedEditCancelBtn')?.addEventListener('click', closeEditDialog);
  qs('#feedEditSaveBtn')?.addEventListener('click', submitEdit);
  qs('#feedEditDeleteBtn')?.addEventListener('click', submitEditDelete);
  qs('#feedEditDialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'feedEditDialog') closeEditDialog();
  });

  // 对话框键盘支持：Esc 关闭 + Tab 焦点圈定
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const edit = qs('#feedEditDialog');
      const add = qs('#feedAddDialog');
      if (edit && edit.style.display !== 'none') { closeEditDialog(); return; }
      if (add && !add.hidden && add.style.display !== 'none') { closeAddDialog(); return; }
    }
    if (e.key === 'Tab') {
      const edit = qs('#feedEditDialog');
      const add = qs('#feedAddDialog');
      const dialog = (edit && edit.style.display !== 'none') ? edit : ((add && !add.hidden && add.style.display !== 'none') ? add : null);
      if (!dialog) return;
      const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---- Sidebar resizer ---- */

const SIDEBAR_WIDTH_KEY = 'feedSidebarWidth';
const MIN_W = 110, MAX_W = 380;

async function bindSidebarResizer() {
  const sidebar = qs('#feedSidebar');
  const resizer = qs('#feedSidebarResizer');
  if (!sidebar || !resizer) return;

  // Restore persisted width
  try {
    const { [SIDEBAR_WIDTH_KEY]: saved } = await chrome.storage.local.get(SIDEBAR_WIDTH_KEY);
    if (saved >= MIN_W && saved <= MAX_W) {
      sidebar.style.width = saved + 'px';
      sidebar.style.minWidth = saved + 'px';
    }
  } catch (_) {}

  let dragging = false;
  let startX = 0;
  let startW = 0;
  let zoomFactor = 1;

  resizer.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));
    zoomFactor = Number.isFinite(z) && z > 0 ? z : 1;
    startW = parseFloat(getComputedStyle(sidebar).width) || sidebar.getBoundingClientRect().width / zoomFactor;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) / zoomFactor;
    const next = Math.max(MIN_W, Math.min(MAX_W, startW + delta));
    sidebar.style.width = next + 'px';
    sidebar.style.minWidth = next + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const w = Math.round(parseFloat(getComputedStyle(sidebar).width) || (sidebar.getBoundingClientRect().width / zoomFactor));
    chrome.storage.local.set({ [SIDEBAR_WIDTH_KEY]: w }).catch(() => {});
  });
}

/* ---- 通用确认对话框（替代原生 confirm：风格统一 + 无障碍） ---- */
function confirmDialog(message, { okLabel = '确定', cancelLabel = '取消' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmDialogTitle" aria-describedby="confirmDialogMsg">' +
        '<div class="confirm-dialog-title" id="confirmDialogTitle">请确认</div>' +
        '<div class="confirm-dialog-msg" id="confirmDialogMsg">' + _escHtml(message) + '</div>' +
        '<div class="confirm-dialog-actions">' +
          '<button class="btn" data-act="cancel">' + _escHtml(cancelLabel) + '</button>' +
          '<button class="btn btn-danger" data-act="ok">' + _escHtml(okLabel) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    const okBtn = overlay.querySelector('[data-act="ok"]');
    const cancelBtn = overlay.querySelector('[data-act="cancel"]');
    okBtn.focus();
    const done = (val) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === okBtn) { e.preventDefault(); cancelBtn.focus(); }
        else if (!e.shiftKey && document.activeElement === cancelBtn) { e.preventDefault(); okBtn.focus(); }
      }
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) done(false);
      else if (e.target.closest('[data-act="cancel"]')) done(false);
      else if (e.target.closest('[data-act="ok"]')) done(true);
    });
    document.addEventListener('keydown', onKey);
  });
}

/* ---- Edit dialog ---- */

let editingFeedId = null;
let lastDialogTrigger = null; // 对话框打开前的焦点元素，关闭后还原

function openEditDialog(feed) {
  editingFeedId = feed.id;
  lastDialogTrigger = document.activeElement;
  const dialog = qs('#feedEditDialog');
  if (!dialog) return;
  dialog.style.display = '';
  qs('#feedEditTitle').value = feed.title || '';
  qs('#feedEditUrl').value = feed.url || '';
  qs('#feedEditMax').value = (feed.maxItems != null && feed.maxItems !== '') ? feed.maxItems : '';
  qs('#feedEditFrom').value = feed.fetchFrom || '';
  qs('#feedEditTo').value = feed.fetchTo || '';
  qs('#feedEditAutoTranslate').checked = !!feed.autoTranslate;
  const status = qs('#feedEditStatus');
  if (status) { status.textContent = ''; status.className = 'feed-dialog-status'; }
  qs('#feedEditTitle')?.focus();
}

function closeEditDialog() {
  editingFeedId = null;
  const dialog = qs('#feedEditDialog');
  if (dialog) dialog.style.display = 'none';
  if (lastDialogTrigger && typeof lastDialogTrigger.focus === 'function') lastDialogTrigger.focus();
}

async function submitEdit() {
  if (!editingFeedId) return;
  const status = qs('#feedEditStatus');
  const title = qs('#feedEditTitle').value.trim();
  const url = qs('#feedEditUrl').value.trim();
  const maxRaw = qs('#feedEditMax').value.trim();
  const from = qs('#feedEditFrom').value || null;
  const to = qs('#feedEditTo').value || null;

  if (!title) { status.textContent = '名称不能为空'; status.className = 'feed-dialog-status error'; return; }
  if (!url) { status.textContent = 'URL 不能为空'; status.className = 'feed-dialog-status error'; return; }
  if (from && to && from > to) { status.textContent = '起始日期不能晚于结束日期'; status.className = 'feed-dialog-status error'; return; }

  const maxItems = maxRaw === '' ? null : Math.max(1, Math.min(500, parseInt(maxRaw, 10) || 50));
  const autoTranslate = qs('#feedEditAutoTranslate').checked;

  status.textContent = '保存中...';
  status.className = 'feed-dialog-status';

  const resp = await send('FEED_UPDATE', {
    feedId: editingFeedId,
    updates: { title, url, maxItems, fetchFrom: from, fetchTo: to, autoTranslate },
  });

  if (resp && resp.success) {
    closeEditDialog();
    await reloadSidebar();
    await reloadItems();
  } else {
    status.textContent = '保存失败: ' + (resp ? resp.error : '未知');
    status.className = 'feed-dialog-status error';
  }
}

async function submitEditDelete() {
  if (!editingFeedId) return;
  const resp = await send('FEED_DELETE', { feedId: editingFeedId });
  if (resp && resp.success) {
    if (state.activeFeedId === editingFeedId) state.activeFeedId = null;
    closeEditDialog();
    await reloadSidebar();
    await reloadItems();
  }
}

/* ---- Add dialog + Refresh all ---- */

function openAddDialog() {
  const dialog = qs('#feedAddDialog');
  if (!dialog) return;
  dialog.style.display = '';
  dialog.hidden = false;
  lastDialogTrigger = qs('#feedAddBtn');
  const input = qs('#feedUrlInput');
  if (input) { input.value = ''; input.focus(); }
  const status = qs('#feedDialogStatus');
  if (status) { status.textContent = ''; status.className = 'feed-dialog-status'; }
  const results = qs('#feedDialogResults');
  if (results) { results.hidden = true; results.innerHTML = ''; }
  pendingOpmlFile = null;
  const opmlName = qs('#feedOpmlName');
  if (opmlName) opmlName.textContent = '';
}

function closeAddDialog() {
  const dialog = qs('#feedAddDialog');
  if (dialog) dialog.style.display = 'none';
  if (lastDialogTrigger && typeof lastDialogTrigger.focus === 'function') lastDialogTrigger.focus();
}

async function submitAdd() {
  const input = qs('#feedUrlInput');
  const status = qs('#feedDialogStatus');
  const results = qs('#feedDialogResults');
  const addBtn = qs('#feedDialogAddBtn');
  if (!input || !status || !addBtn) return;

  // Collect URLs (one per line, strip empties/comments)
  const raw = input.value.trim();
  const hasOpml = !!pendingOpmlFile;

  if (!raw && !hasOpml) {
    status.textContent = '请输入 URL 或选择 OPML 文件';
    status.className = 'feed-dialog-status error';
    return;
  }

  const scope = document.querySelector('input[name="feedScope"]:checked')?.value || 'global';
  addBtn.disabled = true;
  addBtn.textContent = '订阅中...';
  status.className = 'feed-dialog-status';
  if (results) { results.hidden = true; results.innerHTML = ''; }

  try {
    let resp;
    if (hasOpml) {
      status.textContent = '正在解析 OPML...';
      const xmlText = await pendingOpmlFile.text();
      resp = await send('FEED_IMPORT_OPML', { xmlText, scope });
    } else {
      let urls = raw.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean).filter((s) => !s.startsWith('#'));
      // Expand RSSHub shorthand: "/twitter/user/x" or "rsshub:twitter/user/x"
      // → "{instance}/twitter/user/x"
      const prefsResp = await chrome.runtime.sendMessage({ type: 'FEED_GET_PREFS' }).catch(() => null);
      const instance = (prefsResp && prefsResp.prefs && prefsResp.prefs.rsshubInstance) || 'https://rsshub.app';
      urls = urls.map((u) => expandRsshubShorthand(u, instance));
      if (urls.length === 0) {
        status.textContent = '没有有效的 URL';
        status.className = 'feed-dialog-status error';
        return;
      }
      if (urls.length === 1) {
        status.textContent = '正在解析订阅源...';
        resp = await send('FEED_SUBSCRIBE', { url: urls[0], scope });
        // Normalize single response to batch format for unified handling below
        if (resp && resp.success) {
          resp = { success: true, results: [{ url: urls[0], ok: true, feed: resp.feed, inserted: resp.inserted }], ok: 1, fail: 0, total: 1 };
        } else if (resp) {
          resp = { success: true, results: [{ url: urls[0], ok: false, error: resp.error }], ok: 0, fail: 1, total: 1 };
        }
      } else {
        status.textContent = '正在批量订阅 ' + urls.length + ' 个源（每 4 个并发）...';
        resp = await send('FEED_SUBSCRIBE_BATCH', { items: urls, scope });
      }
    }

    if (resp && resp.success) {
      const ok = resp.ok || 0;
      const fail = resp.fail || 0;
      const totalInserted = (resp.results || []).reduce((s, r) => s + (r.inserted || 0), 0);
      status.textContent = '完成: 成功 ' + ok + ' 个源' + (fail > 0 ? ', 失败 ' + fail + ' 个' : '') + ', 共 ' + totalInserted + ' 条新条目';
      status.className = 'feed-dialog-status ' + (fail === 0 ? 'success' : (ok > 0 ? '' : 'error'));

      // Show per-URL results
      if (results && (resp.results || []).length > 0) {
        results.hidden = false;
        results.innerHTML = resp.results.map((r) => {
          const cls = r.ok ? 'ok' : 'fail';
          const meta = r.ok
            ? (r.feed ? r.feed.title + ' · ' + (r.inserted || 0) + ' 条' : '已订阅')
            : (r.error || '失败');
          return '<div class="feed-result-row ' + cls + '"><span class="feed-result-url">' + _escHtml(r.url) + '</span><span class="feed-result-meta">' + _escHtml(meta) + '</span></div>';
        }).join('');
      }

      // Auto-close only if everything succeeded and was just one
      if (fail === 0) {
        setTimeout(() => {
          closeAddDialog();
          reloadSidebar();
          reloadItems();
        }, ok === 1 ? 700 : 1500);
      } else {
        // Refresh sidebar anyway so user can see new feeds; keep dialog open to view failures
        reloadSidebar();
        reloadItems();
      }
    } else {
      status.textContent = '失败: ' + (resp ? resp.error : '未知错误');
      status.className = 'feed-dialog-status error';
    }
  } catch (err) {
    status.textContent = '失败: ' + err.message;
    status.className = 'feed-dialog-status error';
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = '添加';
    // Clear OPML selection after submit
    pendingOpmlFile = null;
    const nameEl = qs('#feedOpmlName');
    if (nameEl) nameEl.textContent = '';
  }
}

async function refreshAll() {
  const btn = qs('#feedRefreshAllBtn');
  if (!btn) return;
  btn.classList.add('spinning');
  const resp = await send('FEED_REFRESH_ALL');
  btn.classList.remove('spinning');
  if (resp && resp.success) {
    if (resp.inserted > 0 || resp.errors > 0) {
      _showToast('新增 ' + resp.inserted + ' 条' + (resp.errors > 0 ? '，' + resp.errors + ' 个失败' : ''));
    }
  } else {
    _showToast('刷新失败', true);
  }
  await reloadSidebar();
  await reloadItems();
}

async function exportFeedUrls() {
  const feeds = Array.isArray(state.feeds) ? state.feeds : [];
  if (feeds.length === 0) {
    _showToast('没有可导出的订阅源', true);
    return;
  }
  const urls = feeds.map((f) => (f && f.url ? String(f.url).trim() : '')).filter(Boolean);
  if (urls.length === 0) {
    _showToast('没有可导出的订阅源', true);
    return;
  }
  const blob = new Blob([urls.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'supercat-feeds-' + stamp + '.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

async function deleteAllItems() {
  const feeds = Array.isArray(state.feeds) ? state.feeds : [];
  if (feeds.length === 0) {
    _showToast('没有订阅源', true);
    return;
  }
  if (!(await confirmDialog('确定要清空所有 ' + feeds.length + ' 个订阅源下的全部新闻吗？\n（订阅源会保留，仅删除新闻条目，操作不可撤销）'))) return;
  const resp = await send('FEED_DELETE_ALL_ITEMS').catch((err) => ({ success: false, error: err?.message }));
  if (resp && resp.success) {
    state.activeFeedId = null;
    state.selectedItemIds.clear();
    state.expandedItemIds.clear();
    await reloadSidebar();
    await reloadItems();
  } else {
    _showToast('清空失败: ' + (resp?.error || '未知'), true);
  }
}

/* ---- Sidebar (source list) ---- */

async function reloadSidebar() {
  const resp = await send('FEED_LIST');
  if (!resp || !resp.success) return;
  state.feeds = resp.feeds || [];
  renderSidebar();
}

function renderSidebar() {
  const list = qs('#feedSourceList');
  if (!list) return;
  if (state.feeds.length === 0) {
    list.innerHTML = '<div class="feed-source-empty">还没有订阅源<br>点击右上角 + 添加</div>';
    return;
  }
  const totalCount = state.feeds.reduce((s, f) => s + (f.totalCount || 0), 0);
  const allBtn =
    '<div class="feed-source-item ' + (state.activeFeedId === null ? 'active' : '') + '" data-feed-id="">' +
      '<div class="feed-source-icon all-icon">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
      '</div>' +
      '<div class="feed-source-name">全部</div>' +
      (totalCount > 0 ? '<span class="feed-source-count">' + totalCount + '</span>' : '') +
    '</div>';
  const globalFeeds = state.feeds.filter((f) => f.scope === 'global');
  const projectFeeds = state.feeds.filter((f) => f.scope !== 'global');
  let html = allBtn;
  if (globalFeeds.length > 0) {
    html += '<div class="feed-source-group">全局</div>';
    html += globalFeeds.map(renderSourceRow).join('');
  }
  if (projectFeeds.length > 0) {
    html += '<div class="feed-source-group">当前项目专属</div>';
    html += projectFeeds.map(renderSourceRow).join('');
  }
  list.innerHTML = html;

  list.querySelectorAll('img.feed-source-favicon').forEach((img) => {
    img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
  });

  list.querySelectorAll('.feed-source-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.feedId || null;
      state.activeFeedId = id;
      state.selectedItemIds.clear();
      list.querySelectorAll('.feed-source-item').forEach((e) => e.classList.remove('active'));
      el.classList.add('active');
      reloadItems();
    });
  });
  list.querySelectorAll('.feed-source-refresh').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.feedId;
      btn.classList.add('spinning');
      const resp = await send('FEED_REFRESH_ONE', { feedId: id });
      btn.classList.remove('spinning');
      if (resp && resp.success) {
        if (!resp.notModified && (resp.inserted > 0 || resp.errors > 0)) {
          _showToast('新增 ' + (resp.inserted || 0) + (resp.errors > 0 ? '，失败 ' + resp.errors : ''));
        }
      } else {
        _showToast('刷新失败: ' + (resp ? resp.error : '未知'), true);
      }
      await reloadSidebar();
      if (state.activeFeedId === id || state.activeFeedId === null) {
        await reloadItems();
      }
    });
  });
  list.querySelectorAll('.feed-source-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.feedId;
      const feed = state.feeds.find((f) => f.id === id);
      if (feed) openEditDialog(feed);
    });
  });

  bindSidebarDragDrop(list);
}

/* ---- Sidebar drag-and-drop reorder ---- */

let dragState = null;

function bindSidebarDragDrop(list) {
  list.querySelectorAll('.feed-source-item[data-feed-id]:not([data-feed-id=""])').forEach((el) => {
    el.setAttribute('draggable', 'true');

    el.addEventListener('dragstart', (e) => {
      const id = el.dataset.feedId;
      const feed = state.feeds.find((f) => f.id === id);
      if (!feed) { e.preventDefault(); return; }
      dragState = { id, scope: feed.scope };
      el.classList.add('dragging');
      try {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      } catch (_) {}
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      list.querySelectorAll('.feed-source-item.drop-before, .feed-source-item.drop-after')
        .forEach((n) => n.classList.remove('drop-before', 'drop-after'));
    });

    el.addEventListener('dragover', (e) => {
      if (!dragState) return;
      const targetId = el.dataset.feedId;
      if (!targetId || targetId === dragState.id) return;
      const target = state.feeds.find((f) => f.id === targetId);
      // Restrict reorder to the same scope so global/project groups stay coherent
      if (!target || target.scope !== dragState.scope) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      list.querySelectorAll('.feed-source-item.drop-before, .feed-source-item.drop-after')
        .forEach((n) => n.classList.remove('drop-before', 'drop-after'));
      el.classList.add(before ? 'drop-before' : 'drop-after');
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!dragState) return;
      const targetId = el.dataset.feedId;
      if (!targetId || targetId === dragState.id) return;
      const target = state.feeds.find((f) => f.id === targetId);
      const dragged = state.feeds.find((f) => f.id === dragState.id);
      if (!target || !dragged || target.scope !== dragged.scope) return;

      const rect = el.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      const newOrder = applyReorderInGroup(dragged, target, before);
      dragState = null;
      list.querySelectorAll('.feed-source-item.drop-before, .feed-source-item.drop-after')
        .forEach((n) => n.classList.remove('drop-before', 'drop-after'));
      // Optimistic local update, then persist
      state.feeds = newOrder;
      renderSidebar();
      const ids = newOrder.map((f) => f.id);
      const resp = await send('FEED_REORDER', { feedIds: ids }).catch((err) => ({ success: false, error: err?.message }));
      if (!resp || !resp.success) {
        _showToast('排序保存失败: ' + (resp?.error || '未知'), true);
        await reloadSidebar();
      }
    });
  });
}

/**
 * Build the next state.feeds array reflecting the drop: move `dragged`
 * adjacent to `target` (before or after). Reorder only happens within
 * the dragged.scope group; other-scope feeds keep their relative order.
 */
function applyReorderInGroup(dragged, target, before) {
  const scope = dragged.scope;
  const inScope = state.feeds.filter((f) => f.scope === scope && f.id !== dragged.id);
  const outScope = state.feeds.filter((f) => f.scope !== scope);
  const targetIdx = inScope.findIndex((f) => f.id === target.id);
  const insertAt = before ? targetIdx : (targetIdx + 1);
  inScope.splice(insertAt, 0, dragged);
  // Preserve display ordering: global block first, then project (matches renderSidebar)
  const globals = scope === 'global' ? inScope : outScope.filter((f) => f.scope === 'global');
  const projects = scope === 'global' ? outScope.filter((f) => f.scope !== 'global') : inScope;
  return [...globals, ...projects];
}

function renderSourceRow(feed) {
  const isActive = state.activeFeedId === feed.id;
  const errBadge = feed.lastError
    ? '<span class="feed-source-err" title="' + _escAttr(feed.lastError) + '">!</span>'
    : '';
  const favicon = feed.faviconUrl
    ? '<img class="feed-source-favicon" src="' + _escAttr(feed.faviconUrl) + '" alt="">'
    : '<div class="feed-source-icon fallback-icon">' + _escHtml((feed.title || '?').slice(0, 1)) + '</div>';
  const count = feed.totalCount || 0;
  const countBadge = count > 0 ? '<span class="feed-source-count" title="' + count + ' 条">' + count + '</span>' : '';
  return '<div class="feed-source-item ' + (isActive ? 'active' : '') + '" data-feed-id="' + _escAttr(feed.id) + '" title="' + _escAttr(feed.title) + '">' +
    favicon +
    '<div class="feed-source-name">' + _escHtml(feed.title || '(无标题)') + '</div>' +
    countBadge +
    errBadge +
    '<div class="feed-source-actions">' +
      '<button class="feed-source-edit" data-feed-id="' + _escAttr(feed.id) + '" title="编辑">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
      '</button>' +
      '<button class="feed-source-refresh" data-feed-id="' + _escAttr(feed.id) + '" title="刷新">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
      '</button>' +
    '</div>' +
    '</div>';
}

/* ---- Items stream ---- */

let fillTimer = 0; // 第二段补差请求的 token（防竞态）

async function reloadItems() {
  const token = ++state.loadToken;
  state.items = [];
  state.hasMore = false;
  state.loadingMore = false;
  clearTimeout(fillTimer);
  showFeedSkeleton();
  const hasQuery = !!state.searchQuery;
  // 第一段：有搜索词时先只跑索引（快），无搜索词直接全量
  const resp = await send('FEED_ITEMS_LIST', {
    feedId: state.activeFeedId || undefined,
    limit: PAGE_SIZE,
    onlyStarred: state.filter === 'starred',
    searchQuery: state.searchQuery || '',
    indexOnly: hasQuery,
  });
  if (token !== state.loadToken) return; // a newer request superseded us
  if (!resp || !resp.success) return;
  state.items = resp.items || [];
  state.hasMore = state.items.length >= PAGE_SIZE;
  renderItems();

  // 第二段起：自动拉完所有匹配（不设上限）。每批 FILL_BATCH 条，
  // 用 publishedAt 游标持续拉取，直到后端报告没有更多（hasMore=false）。
  // complete 恒为 false（有搜索词）：索引命中再多也继续补差，不漏消息。
  if (hasQuery && resp.complete === false) {
    const fillToken = ++fillTimer;
    const skipIds = state.items.map((i) => i.id);
    const FILL_BATCH = 1000;
    let cursor = null; // publishedAt 游标
    for (;;) {
      const fill = await send('FEED_ITEMS_LIST', {
        feedId: state.activeFeedId || undefined,
        limit: FILL_BATCH,
        onlyStarred: state.filter === 'starred',
        searchQuery: state.searchQuery || '',
        skipIds,
        beforePublishedAt: cursor || undefined,
      });
      if (token !== state.loadToken) return;
      if (fillToken !== fillTimer) return; // 更新的补差请求 superseded
      if (!fill || !fill.success) return;
      const seen = new Set(state.items.map((i) => i.id));
      const extra = (fill.items || []).filter((i) => !seen.has(i.id));
      if (extra.length > 0) {
        state.items.push(...extra);
        renderItems();
      }
      if (!fill.hasMore) break; // 后端确认没有更多匹配，拉完
      if (extra.length === 0) break; // 兜底：无新数据但还有更多 → 防死循环
      cursor = extra[extra.length - 1].publishedAt; // 下一批游标
    }
    state.hasMore = state.items.length >= PAGE_SIZE;
  }
}

async function loadMoreItems() {
  if (state.loadingMore || !state.hasMore || state.items.length === 0) return;
  state.loadingMore = true;
  updateLoadMoreSentinel();
  const cursor = state.items[state.items.length - 1].publishedAt || 0;
  const token = state.loadToken;
  const resp = await send('FEED_ITEMS_LIST', {
    feedId: state.activeFeedId || undefined,
    limit: PAGE_SIZE,
    beforePublishedAt: cursor,
    onlyStarred: state.filter === 'starred',
    searchQuery: state.searchQuery || '',
  });
  if (token !== state.loadToken) return;
  state.loadingMore = false;
  if (!resp || !resp.success) {
    state.hasMore = false;
    updateLoadMoreSentinel();
    return;
  }
  const newItems = resp.items || [];
  const seen = new Set(state.items.map((i) => i.id));
  const dedup = newItems.filter((i) => !seen.has(i.id));
  state.items.push(...dedup);
  state.hasMore = newItems.length >= PAGE_SIZE;
  appendItemCards(dedup);
  updateLoadMoreSentinel();
}

/* 请求期间的骨架占位（shimmer 灰条），收到响应后由 renderItems 替换 */
function showFeedSkeleton() {
  const list = qs('#feedItemList');
  if (!list) return;
  const emptyState = qs('#feedEmptyState');
  if (emptyState) emptyState.style.display = 'none';
  list.querySelectorAll('.feed-item-card, .feed-skeleton-card, .feed-search-empty, .feed-load-more-sentinel').forEach((el) => el.remove());
  for (let i = 0; i < 4; i++) {
    const card = document.createElement('div');
    card.className = 'feed-skeleton-card';
    card.innerHTML =
      '<div class="sk-line sk-w90"></div>' +
      '<div class="sk-line sk-w60"></div>' +
      '<div class="sk-line sk-w40"></div>';
    list.appendChild(card);
  }
}

function renderItems() {
  const list = qs('#feedItemList');
  const emptyState = qs('#feedEmptyState');
  if (!list) return;
  if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
  list.querySelectorAll('.feed-item-card').forEach((el) => el.remove());
  list.querySelectorAll('.feed-skeleton-card').forEach((el) => el.remove());
  list.querySelector('.feed-search-empty')?.remove();
  list.querySelector('.feed-load-more-sentinel')?.remove();
  if (state.items.length === 0) {
    if (state.feeds.length === 0) {
      if (emptyState) emptyState.style.display = '';
    } else if (emptyState) {
      emptyState.style.display = 'none';
      const div = document.createElement('div');
      div.className = 'feed-search-empty';
      div.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>没有匹配条目</p>';
      list.appendChild(div);
    }
    updateSelectedBar();
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  // 初始全量渲染不走聚焦模糊（80 张卡同时跑 blur 会卡顿），保留轻量 cardEnter
  appendItemCards(state.items, false);
  updateSelectedBar();
  ensureLoadMoreSentinel();
}

function appendItemCards(items, withEnter = true) {
  const list = qs('#feedItemList');
  if (!list || !items || items.length === 0) return;
  const feedById = Object.fromEntries(state.feeds.map((f) => [f.id, f]));
  const sentinel = list.querySelector('.feed-load-more-sentinel');
  items.forEach((item, i) => {
    const card = createItemCard(item, feedById[item.feedId]);
    if (withEnter) {
      // 追加批次聚焦模糊入场（错峰，最多 12 张卡内递进）
      card.classList.add('feed-item-enter');
      card.style.animationDelay = Math.min(i * 30, 360) + 'ms';
    }
    if (sentinel) list.insertBefore(card, sentinel);
    else list.appendChild(card);
  });
}

/**
 * Incrementally replace a single card without rebuilding the whole list.
 * Used by per-card actions (expand/collapse/star/fetch full) to avoid the
 * expensive renderItems() full rerender when the user has lots of cards.
 */
function updateItemCard(item) {
  const list = qs('#feedItemList');
  if (!list) return;
  const old = list.querySelector('.feed-item-card[data-item-id="' + CSS.escape(item.id) + '"]');
  if (!old) return;
  const feed = state.feeds.find((f) => f.id === item.feedId);
  const next = createItemCard(item, feed);
  // 展开/收起/抓全文等单卡替换：聚焦模糊入场
  next.classList.add('feed-item-enter');
  old.replaceWith(next);
}

function ensureLoadMoreSentinel() {
  const list = qs('#feedItemList');
  if (!list) return;
  list.querySelector('.feed-load-more-sentinel')?.remove();
  if (!state.hasMore) return;
  const sentinel = document.createElement('div');
  sentinel.className = 'feed-load-more-sentinel';
  sentinel.textContent = state.loadingMore ? '加载中…' : '滚动加载更多';
  sentinel.classList.toggle('loading', state.loadingMore);
  list.appendChild(sentinel);
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) loadMoreItems();
    }
  }, { root: list, rootMargin: '300px 0px', threshold: 0 });
  scrollObserver.observe(sentinel);
}

function updateLoadMoreSentinel() {
  const sentinel = qs('#feedItemList .feed-load-more-sentinel');
  if (!sentinel) {
    if (state.hasMore) ensureLoadMoreSentinel();
    return;
  }
  if (!state.hasMore) {
    sentinel.remove();
    return;
  }
  sentinel.textContent = state.loadingMore ? '加载中…' : '滚动加载更多';
  sentinel.classList.toggle('loading', state.loadingMore);
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚才';
  if (mins < 60) return mins + ' 分钟前';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' 小时前';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + ' 天前';
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function formatItemDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/* ---- Item card rendering ---- */

function createItemCard(item, feed) {
  const card = document.createElement('div');
  const isSelected = state.selectedItemIds.has(item.id);
  const isExpanded = state.expandedItemIds.has(item.id);
  const isCollected = !!item.collectedEntryId;
  card.className = 'feed-item-card';
  if (isSelected) card.classList.add('selected');
  if (isExpanded) card.classList.add('expanded');
  if (isCollected) card.classList.add('collected');
  card.dataset.itemId = item.id;
  const sourceName = feed ? feed.title : '未知来源';
  const sourceIcon = feed && feed.faviconUrl
    ? '<img class="feed-item-favicon" src="' + _escAttr(feed.faviconUrl) + '" alt="">'
    : '';
  const timeAgo = formatRelativeTime(item.publishedAt || item.createdAt);
  const dateStr = formatItemDate(item.publishedAt || item.createdAt);

  if (isExpanded) {
    const contentHTML = item.fullText
      ? '<div class="feed-item-fulltext">' + _escHtml(item.fullText) + '</div>'
      : (item.contentHtml
          ? '<div class="feed-item-htmlcontent">' + sanitizeHtml(item.contentHtml) + '</div>'
          : '<div class="feed-item-fulltext">' + _escHtml(item.summary || '(无内容)') + '</div>');
    card.innerHTML =
      '<div class="feed-item-expanded-header">' +
        '<input type="checkbox" class="feed-item-check" ' + (isSelected ? 'checked' : '') + '>' +
        '<div class="feed-item-source-line">' +
          sourceIcon +
          '<span class="feed-item-source-name">' + _escHtml(sourceName) + '</span>' +
          '<span class="feed-item-time" title="' + _escAttr(dateStr) + '">' + _escHtml(dateStr) + '</span>' +
          (item.starred ? '<span class="feed-item-star active">' + STAR_FILLED + '</span>' : '') +
          (isCollected ? '<span class="feed-item-collected-badge">已加入来源</span>' : '') +
        '</div>' +
        '<div class="feed-item-expanded-actions">' +
          '<button class="feed-item-star-btn">' + (item.starred ? STAR_FILLED : STAR_OUTLINE) + '</button>' +
          '<button class="feed-item-collapse-btn">收起</button>' +
        '</div>' +
      '</div>' +
      '<h3 class="feed-item-title-full">' + _escHtml(item.title || '(无标题)') + '</h3>' +
      (item.author ? '<div class="feed-item-author">' + _escHtml(item.author) + '</div>' : '') +
      contentHTML +
      '<div class="feed-item-expanded-footer">' +
        '<a href="' + _escAttr(item.link) + '" target="_blank" rel="noopener" class="feed-item-link">原文 ↗</a>' +
        (!item.hasFullText && item.link ? '<button class="feed-item-fetch-full-btn">抓取全文</button>' : '') +
        (!isCollected ? '<button class="feed-item-collect-one-btn">加入来源</button>' : '<button class="feed-item-view-entry-btn">查看来源</button>') +
      '</div>';
  } else {
    const summaryPreview = (item.summary || '').slice(0, 200);
    // 新条目角标：createdAt 在最近 10 分钟内
    const freshAt = typeof item.createdAt === 'number' ? item.createdAt : new Date(item.createdAt || 0).getTime();
    const isFresh = freshAt > 0 && (Date.now() - freshAt) < 10 * 60 * 1000;
    const headIcon = sourceIcon
      ? sourceIcon
      : '<div class="feed-item-source-icon">' + _escHtml((sourceName || '?').slice(0, 1)) + '</div>';
    card.innerHTML =
      '<input type="checkbox" class="feed-item-check" ' + (isSelected ? 'checked' : '') + '>' +
      (isFresh ? '<span class="feed-item-new-tag">NEW</span>' : '') +
      '<div class="feed-item-body">' +
        '<div class="feed-item-head">' +
          headIcon +
          '<div class="feed-item-title">' + _escHtml(item.title || '(无标题)') + '</div>' +
          '<span class="feed-item-time">' + _escHtml(timeAgo) + '</span>' +
        '</div>' +
        (summaryPreview ? '<div class="feed-item-summary">' + _escHtml(summaryPreview) + (item.summary.length > 200 ? '…' : '') + '</div>' : '') +
        '<div class="feed-item-meta-row">' +
          '<span class="feed-item-source-tag">' + _escHtml(sourceName) + '</span>' +
          '<button class="feed-item-star-mini' + (item.starred ? ' active' : '') + '" title="' + (item.starred ? '取消星标' : '标记星标') + '">' + (item.starred ? STAR_FILLED : STAR_OUTLINE) + '</button>' +
          (isCollected ? '<span class="feed-item-collected-badge">已加入来源</span>' : '') +
          (item.translated ? '<span class="feed-item-translated-badge" title="已自动翻译，来源: ' + _escAttr(item.sourceLanguage || '') + '">译</span>' : '') +
        '</div>' +
        '<div class="feed-item-actions">' +
          (!isCollected ? '<button class="feed-item-collect-one-btn">加入来源</button>' : '') +
        '</div>' +
      '</div>';
  }
  card.querySelectorAll('img.feed-item-favicon').forEach((img) => {
    img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
  });
  bindCardEvents(card, item);
  return card;
}

function sanitizeHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  return div.innerHTML;
}

/* ---- Card events ---- */

/* 展开条目（点击卡片触发；内容不足时自动后台抓全文） */
async function expandFeedItem(item) {
  state.expandedItemIds.add(item.id);
  const haveContent = (item.fullText && item.fullText.length > 200)
    || (item.contentHtml && item.contentHtml.length > 500);
  updateItemCard(item);
  if (!haveContent && item.link) {
    const c = document.querySelector('.feed-item-card[data-item-id="' + CSS.escape(item.id) + '"]');
    if (c) c.classList.add('fetching');
    const resp = await send('FEED_ITEM_FETCH_FULL', { itemId: item.id });
    if (resp && resp.success) {
      item.fullText = resp.fullText;
      item.hasFullText = true;
    }
    updateItemCard(item);
  }
}

function bindCardEvents(card, item) {
  const check = card.querySelector('.feed-item-check');
  if (check) {
    check.addEventListener('change', () => {
      if (check.checked) state.selectedItemIds.add(item.id);
      else state.selectedItemIds.delete(item.id);
      card.classList.toggle('selected', check.checked);
      updateSelectedBar();
    });
  }

  // 点击卡片本体 = 展开（交互子元素除外：checkbox / 星标 / 操作组 / 链接 / 按钮）
  card.addEventListener('click', (e) => {
    if (e.target.closest('.feed-item-check, .feed-item-star-mini, .feed-item-actions, a, button')) return;
    if (!state.expandedItemIds.has(item.id)) expandFeedItem(item);
  });

  card.querySelector('.feed-item-collapse-btn')?.addEventListener('click', () => {
    state.expandedItemIds.delete(item.id);
    updateItemCard(item);
  });

  card.querySelector('.feed-item-star-btn')?.addEventListener('click', async () => {
    await send('FEED_ITEM_STAR', { itemId: item.id });
    item.starred = !item.starred;
    updateItemCard(item);
  });

  // 列表卡片 meta 行的星标：直接点击切换（不进入展开态）
  card.querySelector('.feed-item-star-mini')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await send('FEED_ITEM_STAR', { itemId: item.id });
    item.starred = !item.starred;
    updateItemCard(item);
  });

  card.querySelector('.feed-item-fetch-full-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '抓取中...';
    const resp = await send('FEED_ITEM_FETCH_FULL', { itemId: item.id, force: true });
    if (resp && resp.success) {
      item.fullText = resp.fullText;
      item.hasFullText = true;
    } else {
      _showToast('抓取失败: ' + (resp ? resp.error : '未知'), true);
    }
    updateItemCard(item);
  });

  card.querySelector('.feed-item-collect-one-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '处理中...';
    const resp = await send('FEED_ITEMS_COLLECT', { itemIds: [item.id] });
    if (resp && resp.success && resp.results[0] && resp.results[0].ok) {
      item.collectedEntryId = resp.results[0].entryId;
      reloadSidebar();
      updateItemCard(item);
    } else {
      const r0 = resp && resp.results && resp.results[0];
      if (r0 && r0.needsAiSearch && r0.payload) {
        escalateToAiSearch(r0.payload);
        btn.disabled = false;
        btn.textContent = '加入来源';
        return;
      }
      const err = (r0 && r0.error) || (resp && resp.error) || '未知错误';
      _showToast('加入失败: ' + err, true);
      btn.disabled = false;
      btn.textContent = '加入来源';
    }
  });

  card.querySelector('.feed-item-view-entry-btn')?.addEventListener('click', () => {
    _goToCollect?.(item.collectedEntryId);
  });
}

/* ---- Bulk actions ---- */

function updateSelectedBar() {
  const bar = qs('#feedSelectedBar');
  const countEl = qs('#feedSelectedCount');
  if (!bar || !countEl) return;
  const n = state.selectedItemIds.size;
  if (n === 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  countEl.textContent = '已选 ' + n + ' 项';
}

async function collectSelected() {
  const ids = Array.from(state.selectedItemIds);
  if (ids.length === 0) return;
  const collectBtn = qs('#feedCollectBtn');
  if (collectBtn) {
    collectBtn.disabled = true;
    collectBtn.textContent = '处理中 (0/' + ids.length + ')...';
  }
  const resp = await send('FEED_ITEMS_COLLECT', { itemIds: ids });
  if (collectBtn) {
    collectBtn.disabled = false;
    collectBtn.textContent = '加入来源';
  }
  if (resp && resp.success) {
    const failed = resp.results.filter((r) => !r.ok);
    const needsAi = failed.filter((r) => r.needsAiSearch && r.payload);
    const otherFail = failed.length - needsAi.length;
    if (otherFail > 0 || needsAi.length > 0) {
      let msg = '';
      if (otherFail > 0) msg += otherFail + ' 条失败';
      if (needsAi.length > 0) msg += (msg ? '，' : '') + needsAi.length + ' 条无链接';
      _showToast(msg, otherFail > 0);
    }
    state.selectedItemIds.clear();
    await reloadSidebar();
    await reloadItems();
    // Escalate the first one to chat; user can repeat per item if needed
    if (needsAi.length > 0) {
      escalateToAiSearch(needsAi[0].payload);
    }
  } else {
    _showToast('加入失败: ' + (resp ? resp.error : '未知'), true);
  }
}
