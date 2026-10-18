/**
 * AI 把页面图取来、交到对话 / 网页编辑器 / 文档。
 * 来源只做中转（source=place），交货后默认删掉。
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
  url = '', title = '', imageUrl = '', bytes, mime = '', alt = '', ephemeral = true,
} = {}) {
  if (!bytes) throw new Error('没有可保存的图片字节');
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
    source: ephemeral ? PLACE_IMAGE_SOURCE : 'collect',
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

export async function discardPlacedImages(pid, ids) {
  if (!ids || !ids.length) return 0;
  const all = await getEntries(pid);
  let n = 0;
  for (const id of ids) {
    const entry = all.find((e) => e && e.id === id);
    if (!entry || entry.kind !== 'image') continue;
    if (entry.source !== PLACE_IMAGE_SOURCE) continue;
    await deleteEntryCascade(entry, pid);
    n += 1;
  }
  return n;
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

export async function cropViewportShot(dataUrl, rect) {
  if (!dataUrl || !rect) return null;
  const vw = Number(rect.vw) || 0;
  const vh = Number(rect.vh) || 0;
  const x = Number(rect.x) || 0;
  const y = Number(rect.y) || 0;
  const w = Number(rect.w) || 0;
  const h = Number(rect.h) || 0;
  if (w < 4 || h < 4 || vw < 4 || vh < 4) return null;
  const parsed = dataUrlToBytes(dataUrl);
  if (!parsed) return null;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return parsed;
  const bmp = await createImageBitmap(new Blob([parsed.bytes], { type: parsed.mime }));
  const sx = Math.max(0, Math.round((x / vw) * bmp.width));
  const sy = Math.max(0, Math.round((y / vh) * bmp.height));
  const sw = Math.max(1, Math.min(bmp.width - sx, Math.round((w / vw) * bmp.width)));
  const sh = Math.max(1, Math.min(bmp.height - sy, Math.round((h / vh) * bmp.height)));
  const canvas = new OffscreenCanvas(sw, sh);
  canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  try { bmp.close(); } catch (_) {}
  const out = await canvas.convertToBlob({ type: 'image/png' });
  return { mime: 'image/png', bytes: await out.arrayBuffer() };
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
  const keep = args.keep === true;
  const urls = Array.isArray(args.urls) ? args.urls.map(String).filter(Boolean) : [];
  const selectors = Array.isArray(args.selectors) ? args.selectors.map(String).filter(Boolean) : [];
  const entryIds = Array.isArray(args.entry_ids) ? args.entry_ids.map(String).filter(Boolean) : [];
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
  const wantShot = args.screenshot === true && !figs.length && !targeted && !entryIds.length;
  let candidates = [];
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
      const shot = await captureVisible(srcTab.id).catch(() => null);
      const parsed = shot ? dataUrlToBytes(shot) : null;
      if (!parsed) return JSON.stringify({ ok: false, error: '截取视口失败。确认该标签页在前台可见。' });
      const entry = await saveImageSource(pid, {
        url: srcTab.url || '', title: srcTab.title || '截图',
        imageUrl: '', bytes: parsed.bytes, mime: parsed.mime, alt: '页面截图',
      });
      created.push({ entry, bytes: parsed.bytes, mime: parsed.mime });
      const preview = await bytesToPreviewDataUrl(parsed.bytes, parsed.mime).catch(() => bytesToDataUrl(parsed.bytes, parsed.mime));
      ctx._viewportShot = preview;
      ctx._viewportShotNote = '【视口截图】刚截的当前页。先看图理解页面；要正文原图再用 figs 指定 data.figures 的编号，不要再 screenshot=true。';
      const hits = await grabFromTab(srcTab.id, {}).catch(() => []);
      candidates = hits.map((h) => ({
        src: h.src || '',
        alt: h.alt || '',
        width: h.width,
        height: h.height,
      }));
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
      ? `已截当前视口并显示在对话里。${candidates.length ? `可见大图 ${candidates.length} 张，看完截图再取原图。` : '页面上没有明显的大图元素。'}`
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
        kept: true,
        count: pack.length,
        ids: pack.map((p) => p.entry.id),
        refs,
        hint: '把下面的引用行原样写进 write_document 的 brief（format=docx）或 create_document / update_entry 的 markdown。写完会嵌进文档并清掉这些来源中转。',
        errors,
      });
    }
  }

  let discarded = 0;
  if (!keep && to !== 'document') {
    discarded = await discardPlacedImages(pid, created.map((p) => p.entry.id));
    if (typeof ctx.onEntriesChanged === 'function') {
      try { ctx.onEntriesChanged(); } catch (_) {}
    }
  }

  return JSON.stringify({
    ok: true,
    to,
    screenshot: wantShot,
    count: pack.length,
    ids: pack.map((p) => p.entry.id),
    refs,
    discarded,
    delivered,
    candidates,
    hint: wantShot
      ? '截图像素已附在下一轮。看完再决定：只要这张截图就结束；要正文原图则用 figs 指定 data.figures 的编号再调一次（不要再 screenshot=true）。'
      : undefined,
    errors,
  });
};
