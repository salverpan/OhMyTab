/**
 * AI 把页面图取来、交到对话 / 网页编辑器 / 文档。
 * 默认只做中转（source=place），交货后删掉；persist=source 时作为图片条目留在来源。
 * 纯模块：SW / sidepanel / chat-executor 共用。
 */

import { getEntries, saveEntry } from './storage.js';
import { getDocFile, saveDocFile } from './doc-store.js';
import { deleteEntryCascade } from './entry-cascade.js';
import { findMediaRefs } from './create-docx.js';
import { normalizeFigs } from './figure-catalog.js';

export const PLACE_IMAGES_MAX = 8;
export const PLACE_IMAGE_SOURCE = 'place';

export function imageFormatFrom(mime, url) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  const u = String(url || '').toLowerCase();
  if (u.includes('.png')) return 'png';
  if (u.includes('.webp')) return 'webp';
  if (u.includes('.gif')) return 'gif';
  return 'jpg';
}

export function mimeForFormat(format) {
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes: bytes.buffer };
}

export function bytesToDataUrl(bytes, mime = 'image/jpeg') {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const chunk = 0x8000;
  let bin = '';
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function newId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function saveImageSource(pid, {
  url = '', title = '', imageUrl = '', bytes, mime = '', alt = '', persist = 'transient',
} = {}) {
  if (!bytes) throw new Error('没有可保存的图片字节');
  const effectivePersist = persist === 'source' ? 'source' : 'transient';
  const format = imageFormatFrom(mime, imageUrl);
  const caption = String(alt || '').trim();
  const id = newId();
  const fileName = (caption || title || '图片').slice(0, 40).replace(/[<>:"/\\|?*]/g, '_') + '.' + format;
  const entry = {
    id,
    url: String(url || ''),
    imageUrl: String(imageUrl || ''),
    originalTitle: caption || title || '图片',
    aiTitle: caption || title || '图片',
    aiSummary: caption,
    fullText: [caption, title, imageUrl, url].filter(Boolean).join('\n'),
    kind: 'image',
    format,
    fileName,
    fileSize: bytes.byteLength || (bytes.byteLength === 0 ? 0 : new Uint8Array(bytes).byteLength),
    docId: id,
    source: effectivePersist === 'source' ? 'collect' : PLACE_IMAGE_SOURCE,
    tags: [],
    createdAt: Date.now(),
    status: 'completed',
    errorMessage: '',
    publishedAt: todayStr(),
  };
  await saveDocFile(id, bytes);
  await saveEntry(entry, pid);
  return entry;
}

export async function loadImageSource(pid, id) {
  const all = await getEntries(pid);
  const entry = all.find((e) => e && e.id === id && e.kind === 'image');
  if (!entry) return null;
  const bytes = await getDocFile(entry.docId || entry.id).catch(() => null);
  if (!bytes) return null;
  return { entry, bytes, mime: mimeForFormat(entry.format) };
}

/** 只挑出「本次创建、仍是 place 中转」的图片；persist=source 的图片绝不会被清理。 */
export function filterDiscardablePlaceImages(entries, ids) {
  const wanted = new Set((ids || []).map(String));
  return (entries || []).filter((entry) => entry
    && wanted.has(String(entry.id || ''))
    && entry.kind === 'image'
    && entry.source === PLACE_IMAGE_SOURCE);
}

/** document 终点由写文档时清理已嵌入的中转图；其它终点在交付后清理。 */
export function shouldDiscardPlaceImages(persist, to) {
  return persist !== 'source' && to !== 'document';
}

export async function discardPlacedImages(pid, ids) {
  if (!ids || !ids.length) return 0;
  const all = await getEntries(pid);
  const discardable = filterDiscardablePlaceImages(all, ids);
  for (const entry of discardable) {
    await deleteEntryCascade(entry, pid);
  }
  return discardable.length;
}

/** create_document / update_entry 写完 docx 后，把正文里引用过的 place 图清掉。 */
export async function discardEmbeddedPlaceImages(pid, markdown) {
  const ids = findMediaRefs(markdown)
    .filter((t) => t.kind === 'img')
    .map((t) => t.id);
  return discardPlacedImages(pid, ids);
}

export async function bytesToPreviewDataUrl(bytes, mime = 'image/jpeg') {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return bytesToDataUrl(bytes, mime);
  }
  const blob = new Blob([bytes], { type: mime });
  const bmp = await createImageBitmap(blob);
  const max = 1280;
  let w = bmp.width;
  let h = bmp.height;
  if (Math.max(w, h) > max) {
    const s = max / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  try { bmp.close(); } catch (_) {}
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  return bytesToDataUrl(await out.arrayBuffer(), 'image/jpeg');
}

/** 把 CSS 视口坐标归一化并夹到可见视口内；无效或小于 4px 时返回 null。 */
export function normalizeViewportRect(rect = {}) {
  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const vw = num(rect.vw);
  const vh = num(rect.vh);
  const x = num(rect.x);
  const y = num(rect.y);
  const w = num(rect.w ?? rect.width);
  const h = num(rect.h ?? rect.height);
  if (![vw, vh, x, y, w, h].every(Number.isFinite)) return null;
  if (vw < 4 || vh < 4 || w <= 0 || h <= 0) return null;
  const left = Math.max(0, Math.min(vw, x));
  const top = Math.max(0, Math.min(vh, y));
  const right = Math.max(0, Math.min(vw, x + w));
  const bottom = Math.max(0, Math.min(vh, y + h));
  if (right - left < 4 || bottom - top < 4) return null;
  return { x: left, y: top, w: right - left, h: bottom - top, vw, vh };
}

/** 截视口后按 CSS 像素区域裁成 PNG。无法裁剪时返回 null，绝不静默回退整图。 */
export async function cropViewportShot(dataUrl, rect) {
  if (!dataUrl || !rect) return null;
  const box = normalizeViewportRect(rect);
  if (!box) return null;
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return null;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return null;
  let bmp = null;
  try {
    bmp = await createImageBitmap(new Blob([parsed.bytes], { type: parsed.mime }));
    if (!bmp || !bmp.width || !bmp.height) return null;
    const sx = Math.max(0, Math.round((box.x / box.vw) * bmp.width));
    const sy = Math.max(0, Math.round((box.y / box.vh) * bmp.height));
    const sw = Math.max(1, Math.min(bmp.width - sx, Math.round((box.w / box.vw) * bmp.width)));
    const sh = Math.max(1, Math.min(bmp.height - sy, Math.round((box.h / box.vh) * bmp.height)));
    const canvas = new OffscreenCanvas(sw, sh);
    canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const out = await canvas.convertToBlob({ type: 'image/png' });
    return { mime: 'image/png', bytes: await out.arrayBuffer() };
  } catch (_) {
    return null;
  } finally {
    try { bmp?.close(); } catch (_) { /* ignore */ }
  }
}

async function resolveTab(tabId) {
  const n = Number(tabId);
  if (Number.isFinite(n) && n > 0) {
    try { return await chrome.tabs.get(n); } catch (_) { /* 标签已关 */ }
  }
  const [cur] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return cur || null;
}

async function captureVisible(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && tab.windowId) {
    try { await chrome.windows.update(tab.windowId, { focused: true }); } catch (_) {}
  }
  try { await chrome.tabs.update(tabId, { active: true }); } catch (_) {}
  await new Promise((r) => setTimeout(r, 80));
  return chrome.tabs.captureVisibleTab(tab && tab.windowId, { format: 'png' });
}

/**
 * 解析截图区域。region_selector 优先：先把元素滚进视口，再取 CSS 像素矩形。
 * 没传 selector 时直接用 region={x,y,w,h}（视口坐标）。返回未裁剪、只读取区域。
 */
async function resolveScreenshotRegion(tabId, { selector = '', region = null } = {}) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: ({ selector: sel, region: box } = {}) => {
      const vw = window.innerWidth || document.documentElement.clientWidth || 1;
      const vh = window.innerHeight || document.documentElement.clientHeight || 1;
      if (sel) {
        let el = null;
        try { el = document.querySelector(sel); } catch (_) {
          return { ok: false, error: `区域选择器语法错误：${sel}` };
        }
        if (!el) return { ok: false, error: `页面里找不到区域元素：${sel}` };
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
        const r = el.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) {
          return { ok: false, error: `区域元素不可见或尺寸为 0：${sel}` };
        }
        return {
          ok: true,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height, vw, vh },
        };
      }
      if (!box || typeof box !== 'object') return { ok: false, error: '截图区域参数无效' };
      return {
        ok: true,
        rect: {
          x: box.x,
          y: box.y,
          w: box.w ?? box.width,
          h: box.h ?? box.height,
          vw,
          vh,
        },
      };
    },
    args: [{ selector, region }],
  }).catch(() => []);
  const result = injected && injected[0] && injected[0].result;
  if (!result || result.ok !== true) {
    return { ok: false, error: (result && result.error) || '无法读取截图区域' };
  }
  const rect = normalizeViewportRect(result.rect);
  if (!rect) return { ok: false, error: '截图区域无效或不在当前可见视口内' };
  return { ok: true, rect };
}

async function fetchImageBytes(src) {
  if (!src || src.startsWith('blob:')) return null;
  if (src.startsWith('data:')) return dataUrlToBytes(src);
  try {
    const resp = await fetch(src);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const mime = resp.headers.get('content-type') || '';
    return { mime, bytes: await resp.arrayBuffer() };
  } catch (_) {
    return null;
  }
}

async function grabFromTab(tabId, { urls, selectors }) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: ({ urls: hrefs, selectors: list } = {}) => {
      const els = [];
      const seen = new Set();
      const vw = window.innerWidth || document.documentElement.clientWidth || 1;
      const vh = window.innerHeight || document.documentElement.clientHeight || 1;
      const push = (img) => {
        if (!img || seen.has(img)) return;
        const src = String(img.currentSrc || img.src || '').trim();
        if (!src && !(img.naturalWidth || img.width)) return;
        seen.add(img);
        els.push(img);
      };
      const fromEl = (el) => {
        if (!el) return;
        if (el.tagName === 'IMG') { push(el); return; }
        el.querySelectorAll?.('img').forEach(push);
      };
      const sels = Array.isArray(list) ? list.map(String).filter(Boolean) : [];
      const hrefList = Array.isArray(hrefs) ? hrefs.map(String).filter(Boolean) : [];
      if (sels.length) {
        for (const sel of sels.slice(0, 20)) {
          try { document.querySelectorAll(sel).forEach(fromEl); } catch (_) { /* 非法选择器 */ }
        }
      }
      if (hrefList.length) {
        const norm = (u) => {
          try { const x = new URL(u, location.href); x.hash = ''; return x.href; } catch (_) { return String(u || ''); }
        };
        const imgs = [...document.images];
        for (const u of hrefList) {
          const want = norm(u);
          const img = imgs.find((el) => norm(el.currentSrc || el.src || '') === want);
          if (img) push(img);
        }
      }
      if (!sels.length && !hrefList.length) {
        document.querySelectorAll('img').forEach((img) => {
          const r = img.getBoundingClientRect();
          if (r.width >= 72 && r.height >= 72 && r.bottom > 0 && r.top < vh) push(img);
        });
      }
      return els.slice(0, 8).map((img) => {
        const r = img.getBoundingClientRect();
        return {
          src: String(img.currentSrc || img.src || '').trim(),
          alt: String(img.getAttribute('alt') || '').trim(),
          width: img.naturalWidth || Math.round(r.width),
          height: img.naturalHeight || Math.round(r.height),
          rect: { x: r.x, y: r.y, w: r.width, h: r.height, vw, vh },
        };
      });
    },
    args: [{ urls, selectors }],
  }).catch(() => []);
  const hits = [];
  const seen = new Set();
  for (const frame of injected || []) {
    for (const item of frame.result || []) {
      if (!item) continue;
      const key = item.src || `${item.rect?.x},${item.rect?.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(item);
    }
  }
  return hits.slice(0, PLACE_IMAGES_MAX);
}

async function alignImageRect(tabId, src) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: (url) => {
      const norm = (u) => {
        try { const x = new URL(u, location.href); x.hash = ''; return x.href; } catch (_) { return String(u || ''); }
      };
      const want = norm(url);
      const img = [...document.images].find((el) => norm(el.currentSrc || el.src || '') === want);
      if (!img) return null;
      try { img.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
      const r = img.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, vw: window.innerWidth || 1, vh: window.innerHeight || 1 };
    },
    args: [src],
  }).catch(() => []);
  return (injected && injected[0] && injected[0].result) || null;
}

async function materializeHit(tabId, hit) {
  const fetched = await fetchImageBytes(hit.src);
  if (fetched && fetched.bytes && fetched.bytes.byteLength > 80) return fetched;
  const rect = hit.src ? await alignImageRect(tabId, hit.src) : null;
  const box = rect || hit.rect;
  if (!box) return null;
  const shot = await captureVisible(tabId).catch(() => null);
  if (!shot) return null;
  return cropViewportShot(shot, box);
}

function chromeTabsReady() {
  return typeof chrome !== 'undefined' && !!(chrome.tabs && chrome.tabs.sendMessage);
}

function pageUrlKey(raw) {
  try {
    const url = new URL(String(raw || ''));
    url.hash = '';
    return url.href;
  } catch (_) {
    return String(raw || '').trim();
  }
}

async function waitTabComplete(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.status === 'complete') return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUp);
      resolve();
    }, 15000);
    function onUp(id, info) {
      if (id !== tabId || info.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUp);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUp);
  });
}

async function openSourceTab(url) {
  const want = pageUrlKey(url);
  const all = await chrome.tabs.query({});
  const hit = all.find((t) => t.url && pageUrlKey(t.url) === want);
  if (hit) return { tab: hit, opened: false };
  const created = await chrome.tabs.create({ url, active: false });
  await waitTabComplete(created.id);
  await new Promise((r) => setTimeout(r, 500));
  return { tab: created, opened: true };
}

async function sendFigureGrab(tabId, n) {
  for (let i = 0; i < 3; i++) {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'GRAB_FIGURE', n }).catch(() => null);
    if (resp) return resp;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function resolveFigureTab(req) {
  if (req.tab_id) {
    const tab = await chrome.tabs.get(req.tab_id).catch(() => null);
    const samePage = !req.url || (tab && pageUrlKey(tab.url) === pageUrlKey(req.url));
    if (tab && samePage) return { tab, opened: false };
  }
  if (req.url) return openSourceTab(req.url);
  return { tab: null, opened: false };
}

async function insertIntoEditor(tabId, ids, selector, projectId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: async ({ ids: imageIds, selector: sel, projectId: pid } = {}) => {
      const isEditor = (el) => {
        if (!el || el.nodeType !== 1) return false;
        if (el.isContentEditable) return true;
        const ce = el.getAttribute('contenteditable');
        if (ce === '' || ce === 'true') return true;
        return false;
      };
      let target = null;
      if (sel) {
        try { target = document.querySelector(sel); } catch (_) { target = null; }
      }
      if (!isEditor(target)) {
        const ae = document.activeElement;
        if (isEditor(ae)) target = ae;
      }
      if (!isEditor(target)) {
        target = document.querySelector('[contenteditable="true"], [contenteditable=""], [contenteditable]');
      }
      if (!isEditor(target)) return { ok: false, reason: 'no-editor' };
      const images = [];
      for (const id of imageIds || []) {
        const r = await chrome.runtime.sendMessage({ type: 'GET_IMAGE_SOURCE', data: { id, projectId: pid } });
        if (r && r.ok && r.dataUrl) images.push(r);
      }
      if (!images.length) return { ok: false, reason: 'no-bytes' };
      target.focus();
      for (const item of images) {
        const img = document.createElement('img');
        img.src = item.dataUrl;
        img.alt = item.alt || '';
        img.style.maxWidth = '100%';
        const selection = window.getSelection();
        if (selection && selection.rangeCount && target.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          target.appendChild(img);
        }
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, count: images.length };
    },
    args: [{ ids, selector, projectId }],
  }).catch((err) => [{ result: { ok: false, reason: err.message } }]);
  const ok = (injected || []).find((f) => f && f.result && f.result.ok);
  if (ok) return ok.result;
  const last = (injected || []).map((f) => f && f.result).filter(Boolean).pop();
  return last || { ok: false, reason: 'inject-failed' };
}

function showInChat(ctx, card) {
  if (!Array.isArray(ctx.pendingImages)) ctx.pendingImages = [];
  ctx.pendingImages.push(card);
  if (typeof ctx.onImage === 'function') {
    try { ctx.onImage(card); } catch (_) {}
  }
}

/**
 * @param {object} args place_images 工具参数
 * @param {object} ctx chat-executor 宿主上下文
 * @param {{writeDocument?: Function}} [hooks]
 */
export async function runPlaceImages(args, ctx, hooks = {}) {
  const pid = ctx.projectId || 'default';
  const to = String(args.to || 'chat').trim();
  if (!['chat', 'editor', 'document'].includes(to)) {
    return JSON.stringify({ ok: false, error: 'to 须为 chat / editor / document' });
  }
  if (Object.prototype.hasOwnProperty.call(args, 'keep')) {
    return JSON.stringify({ ok: false, error: 'keep 已移除，请改用 persist: transient | source' });
  }
  if (args.persist != null && !['transient', 'source'].includes(args.persist)) {
    return JSON.stringify({ ok: false, error: 'persist 须为 transient 或 source' });
  }
  const persist = args.persist === 'source' ? 'source' : 'transient';
  const urls = Array.isArray(args.urls) ? args.urls.map(String).filter(Boolean) : [];
  const selectors = Array.isArray(args.selectors) ? args.selectors.map(String).filter(Boolean) : [];
  const entryIds = Array.isArray(args.entry_ids) ? args.entry_ids.map(String).filter(Boolean) : [];
  const regionSelector = String(args.region_selector || '').trim();
  const region = args.region && typeof args.region === 'object' && !Array.isArray(args.region) ? args.region : null;
  if (args.region != null && !region) {
    return JSON.stringify({ ok: false, error: 'region 须为 {x,y,w,h} 对象' });
  }
  const hasRegion = !!(regionSelector || region);
  const created = [];
  const reused = [];
  const errors = [];

  for (const id of entryIds.slice(0, PLACE_IMAGES_MAX)) {
    const loaded = await loadImageSource(pid, id);
    if (!loaded) {
      errors.push(`找不到来源图片 ${id}`);
      continue;
    }
    reused.push(loaded);
  }

  const figs = normalizeFigs(args.figs);
  const targeted = urls.length > 0 || selectors.length > 0;
  const explicitSources = figs.length > 0 || targeted || entryIds.length > 0;
  if (hasRegion && explicitSources) {
    return JSON.stringify({ ok: false, error: 'region / region_selector 不能与 figs、urls、selectors、entry_ids 同时使用' });
  }
  const wantShot = (args.screenshot === true || hasRegion) && !explicitSources;
  let candidates = [];
  let shotRect = null;
  const openedTabs = [];

  if (figs.length) {
    if (!chromeTabsReady()) return JSON.stringify({ ok: false, error: '当前环境不能按编号取来源图' });
    try {
      for (const req of figs) {
        if (created.length + reused.length >= PLACE_IMAGES_MAX) break;
        if (!req.tab_id && !req.url) {
          errors.push(`图 ${req.n} 缺少 tab_id 或来源页 url`);
          continue;
        }
        const { tab, opened } = await resolveFigureTab(req);
        if (opened && tab) openedTabs.push(tab.id);
        if (!tab) {
          errors.push(`图 ${req.n} 的来源页打不开`);
          continue;
        }
        const grabbed = await sendFigureGrab(tab.id, req.n);
        if (!grabbed || !grabbed.ok || !grabbed.src) {
          errors.push((grabbed && grabbed.error) || `正文里没有图 ${req.n}`);
          continue;
        }
        const got = await materializeHit(tab.id, {
          src: grabbed.src,
          alt: grabbed.caption || '',
          rect: grabbed.rect,
        });
        if (!got) {
          errors.push(`无法读取图 ${req.n}`);
          continue;
        }
        const entry = await saveImageSource(pid, {
          url: tab.url || req.url || '',
          title: tab.title || '',
          imageUrl: grabbed.src,
          bytes: got.bytes,
          mime: got.mime,
          alt: grabbed.caption || '',
          persist,
        });
        created.push({ entry, bytes: got.bytes, mime: got.mime });
      }
    } finally {
      for (const id of openedTabs) chrome.tabs.remove(id).catch(() => {});
    }
  } else if (!wantShot && !targeted && !entryIds.length) {
    if (!chromeTabsReady()) {
      return JSON.stringify({ ok: false, error: '要取来源里的图，请用 figs 指定编号' });
    }
    const srcTab = await resolveTab(args.tab_id);
    if (!srcTab) return JSON.stringify({ ok: false, error: '找不到来源页。先读页面，再用 figs 里的 tab_id 或 url。' });
    const cat = await chrome.tabs.sendMessage(srcTab.id, { type: 'CATALOG_FIGURES' }).catch(() => null);
    return JSON.stringify({
      ok: false,
      error: '要取来源里的图，请用 figs 指定编号。编号来自 read_tab / read_current_page 的 data.figures。',
      tab_id: srcTab.id,
      url: srcTab.url || '',
      figures: (cat && cat.figures) || [],
      cover: (cat && cat.cover) || null,
    });
  } else if ((wantShot || targeted) && created.length + reused.length < PLACE_IMAGES_MAX) {
    const srcTab = await resolveTab(args.tab_id);
    if (!srcTab) return JSON.stringify({ ok: false, error: '找不到取图的标签页（传 tab_id 或先打开目标页）' });

    if (wantShot) {
      if (hasRegion) {
        const resolved = await resolveScreenshotRegion(srcTab.id, { selector: regionSelector, region });
        if (!resolved.ok) return JSON.stringify({ ok: false, error: resolved.error });
        shotRect = resolved.rect;
      }
      const shot = await captureVisible(srcTab.id).catch(() => null);
      if (!shot) return JSON.stringify({ ok: false, error: '截取视口失败。确认该标签页在前台可见。' });
      const captured = shotRect
        ? await cropViewportShot(shot, shotRect)
        : dataUrlToBytes(shot);
      if (!captured) {
        return JSON.stringify({
          ok: false,
          error: shotRect ? '截图区域裁剪失败，请检查 region / region_selector 是否在可见视口内。' : '截图数据无效。',
        });
      }
      const entry = await saveImageSource(pid, {
        url: srcTab.url || '', title: srcTab.title || '截图',
        imageUrl: '', bytes: captured.bytes, mime: captured.mime,
        alt: shotRect ? '页面区域截图' : '页面截图',
        persist,
      });
      created.push({ entry, bytes: captured.bytes, mime: captured.mime });
      const preview = await bytesToPreviewDataUrl(captured.bytes, captured.mime).catch(() => bytesToDataUrl(captured.bytes, captured.mime));
      ctx._viewportShot = preview;
      ctx._viewportShotNote = shotRect
        ? '【区域截图】刚截的页面选区。先看图理解；需要正文原图再用 figs 指定 data.figures 的编号，不要再 screenshot=true。'
        : '【视口截图】刚截的当前页。先看图理解页面；要正文原图再用 figs 指定 data.figures 的编号，不要再 screenshot=true。';
      if (!shotRect) {
        const hits = await grabFromTab(srcTab.id, {}).catch(() => []);
        candidates = hits.map((h) => ({
          src: h.src || '',
          alt: h.alt || '',
          width: h.width,
          height: h.height,
        }));
      }
    } else if (targeted) {
      const hits = await grabFromTab(srcTab.id, { urls, selectors });
      const room = PLACE_IMAGES_MAX - created.length - reused.length;
      for (const hit of hits.slice(0, room)) {
        try {
          const got = await materializeHit(srcTab.id, hit);
          if (!got) {
            errors.push(`无法读取 ${hit.src || '元素'}（已尝试截图）`);
            continue;
          }
          const entry = await saveImageSource(pid, {
            url: srcTab.url || '',
            title: srcTab.title || '',
            imageUrl: hit.src || '',
            bytes: got.bytes,
            mime: got.mime,
            alt: hit.alt || '',
            persist,
          });
          created.push({ entry, bytes: got.bytes, mime: got.mime });
        } catch (err) {
          errors.push(err.message || String(err));
        }
      }
    }
  }

  const pack = [...reused, ...created];
  if (!pack.length) {
    return JSON.stringify({ ok: false, error: errors[0] || '没有取到图片。用 figs 指定 data.figures 里的编号。', errors });
  }

  if (typeof ctx.onEntriesChanged === 'function') {
    try { ctx.onEntriesChanged(); } catch (_) {}
  }

  const refs = pack.map((p) => `![${p.entry.aiTitle || '图片'}](img:${p.entry.id})`);
  let delivered = '';

  if (to === 'chat') {
    for (const p of pack) {
      const preview = await bytesToPreviewDataUrl(p.bytes, p.mime).catch(() => bytesToDataUrl(p.bytes, p.mime));
      showInChat(ctx, {
        id: p.entry.id,
        alt: p.entry.aiTitle || '',
        dataUrl: preview,
      });
    }
    delivered = wantShot
      ? `已截取${shotRect ? '当前页面选区' : '当前视口'}并显示在对话里。${shotRect ? '' : (candidates.length ? `可见大图 ${candidates.length} 张，看完截图再取原图。` : '页面上没有明显的大图元素。')}`
      : `已在对话里显示 ${pack.length} 张图。`;
  } else if (to === 'editor') {
    const dest = await resolveTab(args.editor_tab_id || args.tab_id);
    if (!dest) return JSON.stringify({ ok: false, error: '找不到要插入的标签页。先打开公众号/邮件编辑页，或传 editor_tab_id。' });
    const inserted = await insertIntoEditor(dest.id, pack.map((p) => p.entry.id), args.selector, pid);
    if (!inserted.ok) {
      const why = inserted.reason === 'no-editor'
        ? '目标页没有找到可编辑区。请先点进正文窗格，或传 selector。'
        : (inserted.reason || '插入失败');
      return JSON.stringify({ ok: false, error: why, ids: pack.map((p) => p.entry.id), refs, errors });
    }
    delivered = `已把 ${inserted.count} 张图插入「${dest.title || dest.url}」。`;
  } else {
    const docId = String(args.doc_id || '').trim();
    const title = String(args.title || '').trim();
    const block = refs.join('\n\n');
    if (docId && typeof hooks.updateDocument === 'function') {
      const updated = await hooks.updateDocument({ docId, append: block, ctx });
      if (!updated.ok) return JSON.stringify({ ok: false, error: updated.error || '写入文档失败', refs });
      delivered = `已把 ${pack.length} 张图写入文档。`;
    } else if (title && typeof hooks.createDocument === 'function') {
      const createdDoc = await hooks.createDocument({ title, content: block, ctx });
      if (!createdDoc.ok) return JSON.stringify({ ok: false, error: createdDoc.error || '创建文档失败', refs });
      delivered = `已新建文档「${title}」并嵌入 ${pack.length} 张图。`;
    } else {
      return JSON.stringify({
        ok: true,
        persist,
        persisted: persist === 'source',
        count: pack.length,
        ids: pack.map((p) => p.entry.id),
        refs,
        hint: persist === 'source'
          ? '图片已保存在来源。把下面的引用行原样写进 write_document 的 brief（format=docx）或 create_document / update_entry 的 markdown；来源里的图片会保留。'
          : '把下面的引用行原样写进 write_document 的 brief（format=docx）或 create_document / update_entry 的 markdown。写完会嵌进文档并清掉这些中转图片。',
        errors,
      });
    }
  }

  if (persist === 'source' && delivered && !delivered.includes('来源')) {
    delivered += ' 图片已保存到来源。';
  }

  let discarded = 0;
  if (shouldDiscardPlaceImages(persist, to)) {
    discarded = await discardPlacedImages(pid, created.map((p) => p.entry.id));
    if (typeof ctx.onEntriesChanged === 'function') {
      try { ctx.onEntriesChanged(); } catch (_) {}
    }
  }

  return JSON.stringify({
    ok: true,
    to,
    persist,
    persisted: persist === 'source',
    screenshot: wantShot,
    region: shotRect ? { x: shotRect.x, y: shotRect.y, w: shotRect.w, h: shotRect.h } : undefined,
    count: pack.length,
    ids: pack.map((p) => p.entry.id),
    refs,
    discarded,
    delivered,
    candidates,
    hint: wantShot
      ? (persist === 'source'
        ? '选区像素已附在下一轮，图片作为来源条目保留。'
        : '截图像素已附在下一轮。临时图在交付后清理；只有用户明确要求保存到来源时才传 persist=source。')
      : undefined,
    errors,
  });
};
