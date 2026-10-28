/**
 * Side-panel workflow for creating a feed from visual page selections.
 * All selection happens in the active tab's content script; this module owns
 * the wizard UI, field mapping state, preview and save.
 */

import {
  WEBFEED_FIELDS,
  WEBFEED_FIELD_LABELS,
  normalizeWebFeedRecipe,
} from '../lib/webfeed-recipe.js';

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

let deps = null;
let initialized = false;
let dialogOpen = false;
let draft = null;
let previewToken = 0;

function escHtml(value) {
  return deps?.escHtml ? deps.escHtml(value) : String(value == null ? '' : value);
}

function escAttr(value) {
  return deps?.escAttr ? deps.escAttr(value) : escHtml(value).replace(/"/g, '&quot;');
}

function showToast(message, isError) {
  deps?.showToast?.(message, isError);
}

function setStatus(message, kind = '') {
  const el = qs('#webFeedStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'feed-dialog-status' + (kind ? ' ' + kind : '');
}

function setPickStatus(message, tone = '') {
  const box = qs('#webFeedPickStatus');
  const text = qs('#webFeedPickStatusText');
  if (text) text.textContent = message || '';
  if (box) {
    box.hidden = !message;
    box.classList.toggle('is-error', tone === 'error');
    box.classList.toggle('is-success', tone === 'success');
  }
}

function setBusy(busy, label) {
  const save = qs('#webFeedSaveBtn');
  if (save) {
    save.disabled = !!busy || !(draft?.previewItems?.length > 0);
    if (busy && label) save.textContent = label;
    else save.textContent = '保存为订阅源';
  }
}

function sendToTab(message, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!draft?.tabId) { resolve({ ok: false, error: '页面标签页已关闭' }); return; }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: '页面响应超时，请刷新网页后重试' });
    }, timeoutMs);
    try {
      chrome.tabs.sendMessage(draft.tabId, message).then(
        (resp) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(resp || { ok: false, error: '页面未返回结果' });
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, error: (err && err.message) || '无法连接页面，请刷新网页后重试' });
        },
      );
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: (err && err.message) || '无法连接页面' });
    }
  });
}

function resetDraft() {
  draft = null;
  previewToken += 1;
}

function showDialog() {
  const dialog = qs('#webFeedDialog');
  if (!dialog) return;
  dialog.hidden = false;
  dialog.style.display = '';
  dialogOpen = true;
}

function hideDialog() {
  const dialog = qs('#webFeedDialog');
  if (dialog) {
    dialog.style.display = 'none';
    dialog.hidden = true;
  }
  dialogOpen = false;
}

function renderPageCard() {
  if (!draft) return;
  const titleEl = qs('#webFeedPageTitle');
  const urlEl = qs('#webFeedPageUrl');
  if (titleEl) titleEl.textContent = draft.pageTitle || '当前网页';
  if (urlEl) urlEl.textContent = draft.pageUrl || '';
  if (urlEl) urlEl.title = draft.pageUrl || '';
}

function clearCandidates() {
  const box = qs('#webFeedCandidates');
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
}

function renderCandidates(candidates) {
  const box = qs('#webFeedCandidates');
  if (!box || !draft) return;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = candidates.map((c) => (
    '<button type="button" class="web-feed-candidate-btn" data-candidate-id="' + escAttr(c.id) + '">' +
      '<span class="web-feed-candidate-dot" style="background:' + escAttr(c.color || '#6366f1') + '"></span>' +
      '<span class="web-feed-candidate-main">' +
        '<span class="web-feed-candidate-title">' + escHtml(c.sampleTitle || '候选列表') + '</span>' +
        '<span class="web-feed-candidate-selector">' + escHtml(c.selector || '') + '</span>' +
      '</span>' +
      '<span class="web-feed-candidate-count">' + (Number(c.count) || 0) + ' 条</span>' +
    '</button>'
  )).join('');
  box.querySelectorAll('[data-candidate-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!draft || draft.busy) return;
      draft.busy = true;
      setPickStatus('正在应用候选模板…');
      const resp = await sendToTab({ type: 'WEBFEED_SELECT_CANDIDATE', candidateId: btn.dataset.candidateId }, 8000);
      draft.busy = false;
      if (!resp?.ok) {
        setPickStatus(resp?.error || '候选模板已失效，请重新开始', 'error');
        setStatus(resp?.error || '候选模板已失效', 'error');
      }
    });
  });
}

function renderWarnings(messages) {
  const box = qs('#webFeedPreviewWarnings');
  if (!box) return;
  const list = Array.from(new Set((messages || []).filter(Boolean)));
  if (list.length === 0) {
    box.hidden = true;
    box.textContent = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = list.map((m) => '• ' + escHtml(m)).join('<br>');
}

function formatPreviewDate(ts) {
  if (!ts) return '无日期';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '无日期';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderPreview(items, response) {
  const list = qs('#webFeedPreviewList');
  if (!list) return;
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = '<div class="web-feed-preview-empty">没有抓到可预览的条目，请检查字段或重新框选</div>';
    return;
  }
  list.innerHTML = items.map((item) => {
    const cover = item.coverUrl
      ? '<img class="web-feed-preview-cover" src="' + escAttr(item.coverUrl) + '" alt="" loading="lazy">'
      : '';
    const title = escHtml(item.title || '(无标题)');
    const titleHtml = item.link
      ? '<a href="' + escAttr(item.link) + '" target="_blank" rel="noopener">' + title + '</a>'
      : title;
    const summary = item.summary ? '<div class="web-feed-preview-summary">' + escHtml(item.summary) + '</div>' : '';
    return '<div class="web-feed-preview-item">' +
      cover +
      '<div class="web-feed-preview-body">' +
        '<div class="web-feed-preview-title">' + titleHtml + '</div>' +
        '<div class="web-feed-preview-meta"><span>' + escHtml(formatPreviewDate(item.publishedAt)) + '</span>' +
          (item.author ? '<span>' + escHtml(item.author) + '</span>' : '') +
          (item.link ? '<span>' + escHtml(item.link) + '</span>' : '') +
        '</div>' +
        summary +
      '</div>' +
    '</div>';
  }).join('');
  list.querySelectorAll('img.web-feed-preview-cover').forEach((img) => {
    img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
  });
  const matched = Number(response?.matched) || items.length;
  renderWarnings(response?.warnings);
  setStatus('预览成功：匹配 ' + matched + ' 条，展示 ' + items.length + ' 条', 'success');
}

function fieldSample(field) {
  return (draft?.samples && draft.samples[field]) || '';
}

function renderFields() {
  const list = qs('#webFeedFieldList');
  if (!list || !draft?.recipe) return;
  const fields = draft.recipe.fields || {};
  list.innerHTML = WEBFEED_FIELDS.map((field) => {
    const def = fields[field];
    const parts = Array.isArray(def?.parts) ? def.parts : [];
    const sample = fieldSample(field);
    const valueText = sample
      ? sample + (parts.length > 1 ? '（合并 ' + parts.length + ' 个元素）' : '')
      : '未选择';
    const multiAllowed = field === 'title' || field === 'summary' || field === 'author';
    return '<div class="web-feed-field-row" data-field="' + field + '">' +
      '<div class="web-feed-field-name">' + escHtml(WEBFEED_FIELD_LABELS[field] || field) + '</div>' +
      '<div class="web-feed-field-value' + (sample ? '' : ' missing') + '" title="' + escAttr(valueText) + '">' + escHtml(valueText) + '</div>' +
      '<div class="web-feed-field-actions">' +
        '<button type="button" data-field-action="pick" data-field="' + field + '">改选</button>' +
        (multiAllowed ? '<button type="button" data-field-action="multi" data-field="' + field + '">多选</button>' : '') +
        (parts.length ? '<button type="button" data-field-action="clear" data-field="' + field + '">清除</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function renderTemplateInfo() {
  const el = qs('#webFeedTemplateInfo');
  if (!el || !draft?.recipe) return;
  el.textContent = '已识别 ' + (draft.itemCount || 0) + ' 条 · ' + draft.recipe.itemSelector;
  el.title = draft.recipe.itemSelector || '';
}

async function startFieldPicker(field, multi) {
  if (!draft?.recipe) return;
  setStatus(multi
    ? '请在网页中直接连续点击多个「' + (WEBFEED_FIELD_LABELS[field] || field) + '」元素，再次点击可移除；完成后点网页工具栏“完成”。'
    : '请在网页中点选「' + (WEBFEED_FIELD_LABELS[field] || field) + '」。');
  const resp = await sendToTab({
    type: 'WEBFEED_START_FIELD_PICKER',
    field,
    multi: !!multi,
    recipe: draft.recipe,
  }, 10000);
  if (!resp?.ok) {
    setStatus(resp?.error || '无法启动字段选择，请刷新网页后重试', 'error');
    showToast(resp?.error || '字段选择启动失败', true);
    return;
  }
  draft.selectingField = field;
  draft.selectingMulti = !!multi;
}

async function refreshPreview() {
  if (!draft?.recipe) return;
  const token = ++previewToken;
  const save = qs('#webFeedSaveBtn');
  if (save) save.disabled = true;
  setStatus('正在读取网页并预览…');
  const resp = await sendToTab({
    type: 'WEBFEED_EXTRACT',
    recipe: draft.recipe,
    maxItems: 12,
  }, 15000);
  if (token !== previewToken) return;
  if (!resp || resp.ok === false) {
    draft.previewItems = [];
    renderWarnings(resp?.warnings || [resp?.error || '预览失败']);
    renderPreview([], resp);
    setStatus(resp?.error || '预览失败', 'error');
    setBusy(false);
    return;
  }
  draft.previewItems = Array.isArray(resp.items) ? resp.items : [];
  draft.previewResp = resp;
  renderPreview(draft.previewItems, resp);
  setBusy(false);
  if (draft.previewItems.length === 0) {
    setStatus('没有抓到条目，请调整字段或重新框选模板', 'error');
  }
}

function applySelectedField(field, parts) {
  if (!draft?.recipe) return;
  if (!WEBFEED_FIELDS.includes(field)) return;
  const cleanParts = Array.isArray(parts)
    ? parts.filter((p) => p && p.selector).map((p) => ({ selector: p.selector, attr: p.attr || 'text' }))
    : [];
  if (cleanParts.length === 0) {
    delete draft.recipe.fields[field];
    delete draft.samples[field];
  } else {
    draft.recipe.fields[field] = { parts: cleanParts, separator: ' ' };
    draft.samples[field] = (parts || []).map((p) => p.sample).filter(Boolean).join(' ');
  }
  try {
    draft.recipe = normalizeWebFeedRecipe(draft.recipe);
  } catch (err) {
    setStatus('保存字段失败：' + err.message, 'error');
    return;
  }
  renderFields();
  refreshPreview();
}

function handlePickerEvent(data) {
  if (!draft || !data) return;
  if (data.event === 'cancelled') {
    setPickStatus('已取消页面选择');
    setStatus('已取消选择，可重新点击“重新框选”', '');
    return;
  }
  if (data.event === 'item-selected') {
    try {
      const recipe = normalizeWebFeedRecipe(data.recipe);
      draft.recipe = recipe;
      draft.samples = data.samples || {};
      draft.itemCount = Number(data.count) || 0;
      draft.itemWarnings = data.warnings || [];
      draft.previewItems = [];
      renderWarnings(draft.itemWarnings);
      renderFields();
      renderTemplateInfo();
      const panel = qs('#webFeedRecipePanel');
      if (panel) panel.hidden = false;
      clearCandidates();
      setPickStatus('已识别 ' + draft.itemCount + ' 条内容，接下来确认字段', 'success');
      const titleInput = qs('#webFeedTitleInput');
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = draft.pageTitle || '';
        if (!titleInput.value.trim()) {
          try { titleInput.value = new URL(draft.pageUrl).hostname.replace(/^www\./, ''); } catch (_) {}
        }
      }
      const save = qs('#webFeedSaveBtn');
      if (save) save.disabled = true;
      setStatus('条目模板已保存，正在生成预览…');
      refreshPreview();
    } catch (err) {
      setStatus('选择结果无效：' + err.message, 'error');
    }
    return;
  }
  if (data.event === 'field-selected') {
    if (data.cancelled) {
      setStatus('已取消字段选择', '');
      draft.selectingField = null;
      return;
    }
    if (!draft.selectingField || data.field !== draft.selectingField) return;
    applySelectedField(data.field, data.parts || []);
    draft.selectingField = null;
    draft.selectingMulti = false;
    setPickStatus('字段「' + (WEBFEED_FIELD_LABELS[data.field] || data.field) + '」已更新', 'success');
  }
}

async function startItemPicker(clearRecipe) {
  if (!draft) return;
  if (clearRecipe) {
    draft.recipe = null;
    draft.samples = {};
    draft.previewItems = [];
    draft.itemCount = 0;
    const panel = qs('#webFeedRecipePanel');
    if (panel) panel.hidden = true;
    const save = qs('#webFeedSaveBtn');
    if (save) save.disabled = true;
    renderWarnings([]);
    renderPreview([], null);
    clearCandidates();
  }
  setPickStatus('正在页面中识别重复内容…');
  setStatus('');
  const resp = await sendToTab({ type: 'WEBFEED_START_PICKER' }, 12000);
  if (!resp?.ok) {
    setPickStatus(resp?.error || '无法启动页面选择，请刷新网页后重试', 'error');
    setStatus(resp?.error || '无法启动页面选择', 'error');
    return;
  }
  draft.candidates = resp.candidates || [];
  draft.pageTitle = resp.pageTitle || draft.pageTitle;
  renderPageCard();
  if (draft.candidates.length > 0) {
    setPickStatus('已识别 ' + draft.candidates.length + ' 组候选，在页面上点选即可。');
    renderCandidates(draft.candidates);
  } else {
    setPickStatus('未识别到重复内容，请在页面上点选一条。');
    renderCandidates([]);
  }
}

async function saveWebFeed() {
  if (!draft?.recipe || !draft.previewItems.length) {
    setStatus('请先完成字段确认并生成有效预览', 'error');
    return;
  }
  const titleInput = qs('#webFeedTitleInput');
  const title = titleInput ? titleInput.value.trim() : '';
  if (!title) {
    setStatus('请填写源名称', 'error');
    titleInput?.focus();
    return;
  }
  const intervalMin = Math.max(1, Number(qs('#webFeedIntervalSelect')?.value) || 30);
  const maxRaw = qs('#webFeedMaxInput')?.value;
  const maxItems = maxRaw === '' || maxRaw == null
    ? null
    : Math.max(1, Math.min(500, Number(maxRaw) || 100));
  const scope = qs('input[name="webFeedScope"]:checked')?.value || 'global';
  const refreshMode = qs('#webFeedRefreshModeSelect')?.value || 'auto';

  setBusy(true, '保存中…');
  setStatus('正在保存网页源…');
  const resp = await deps.send('FEED_SUBSCRIBE_WEBPAGE', {
    recipe: draft.recipe,
    title,
    scope,
    intervalMin,
    maxItems,
    refreshMode,
    initialItems: draft.previewItems,
  }, 30000);
  setBusy(false);
  if (!resp?.success) {
    setStatus('保存失败：' + (resp?.error || '未知错误'), 'error');
    return;
  }
  const inserted = Number(resp.inserted) || 0;
  setStatus('已保存：' + title + ' · 首次写入 ' + inserted + ' 条', 'success');
  setPickStatus('网页源已保存', 'success');
  showToast('网页源已添加：' + title);
  const feedId = resp.feed?.id || null;
  closeWebFeedBuilder();
  try {
    await deps.onSaved?.(feedId);
  } catch (err) {
    console.warn('[web-feed] onSaved failed:', err);
  }
}

function closeWebFeedBuilder(silent) {
  if (draft?.tabId) {
    try {
      Promise.resolve(chrome.tabs.sendMessage(draft.tabId, { type: 'WEBFEED_STOP_PICKER' })).catch(() => {});
    } catch (_) {}
  }
  previewToken += 1;
  hideDialog();
  clearCandidates();
  resetDraft();
  if (!silent) setStatus('');
  const save = qs('#webFeedSaveBtn');
  if (save) {
    save.disabled = true;
    save.textContent = '保存为订阅源';
  }
}

async function openWebFeedBuilder() {
  if (!initialized) return;
  if (dialogOpen) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') {
    showToast('没有找到当前网页标签页', true);
    return;
  }
  const url = String(tab.url || '');
  if (!/^https?:\/\//i.test(url)) {
    showToast('只能在普通 http/https 网页上创建订阅源', true);
    return;
  }
  resetDraft();
  draft = {
    tabId: tab.id,
    pageUrl: url,
    pageTitle: tab.title || '',
    candidates: [],
    recipe: null,
    samples: {},
    itemCount: 0,
    itemWarnings: [],
    previewItems: [],
    previewResp: null,
    selectingField: null,
    selectingMulti: false,
    busy: false,
  };
  const panel = qs('#webFeedRecipePanel');
  if (panel) panel.hidden = true;
  const titleInput = qs('#webFeedTitleInput');
  if (titleInput) titleInput.value = tab.title || '';
  const maxInput = qs('#webFeedMaxInput');
  if (maxInput) maxInput.value = '100';
  const interval = qs('#webFeedIntervalSelect');
  if (interval) interval.value = '30';
  const refreshModeSelect = qs('#webFeedRefreshModeSelect');
  if (refreshModeSelect) refreshModeSelect.value = 'auto';
  const globalScope = qs('input[name="webFeedScope"][value="global"]');
  if (globalScope) globalScope.checked = true;
  setStatus('');
  setPickStatus('正在连接当前网页…');
  renderWarnings([]);
  renderPreview([], null);
  renderPageCard();
  showDialog();
  await startItemPicker(false);
}

function bindDialogEvents() {
  qs('#webFeedDialogCloseBtn')?.addEventListener('click', () => closeWebFeedBuilder());
  qs('#webFeedCancelBtn')?.addEventListener('click', () => closeWebFeedBuilder());
  qs('#webFeedDialog')?.addEventListener('click', (event) => {
    if (event.target?.id === 'webFeedDialog') closeWebFeedBuilder();
  });
  qs('#webFeedRepickBtn')?.addEventListener('click', () => {
    if (draft?.busy) return;
    startItemPicker(true);
  });
  qs('#webFeedPreviewBtn')?.addEventListener('click', () => {
    if (draft?.recipe) refreshPreview();
  });
  qs('#webFeedSaveBtn')?.addEventListener('click', saveWebFeed);
  qs('#webFeedFieldList')?.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-field-action]');
    if (!btn || !draft?.recipe || draft.busy) return;
    const field = btn.dataset.field;
    const action = btn.dataset.fieldAction;
    if (action === 'pick') startFieldPicker(field, false);
    else if (action === 'multi') startFieldPicker(field, true);
    else if (action === 'clear') {
      delete draft.recipe.fields[field];
      delete draft.samples[field];
      try { draft.recipe = normalizeWebFeedRecipe(draft.recipe); } catch (_) {}
      renderFields();
      refreshPreview();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!dialogOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWebFeedBuilder();
    }
  });
}

export function initWebFeedBuilder(options = {}) {
  deps = options;
  if (initialized) return;
  initialized = true;
  bindDialogEvents();
  qs('#feedCreateWebBtn')?.addEventListener('click', openWebFeedBuilder);
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!dialogOpen || !draft || !message || message.type !== 'WEBFEED_EVENT') return;
      if (sender?.tab?.id !== draft.tabId) return;
      handlePickerEvent(message.data);
    });
  }
}
