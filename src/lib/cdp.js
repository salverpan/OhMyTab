/**
 * CDP 附着 / 前台唤醒 / 超时封装。
 *
 * chrome.debugger.attach、Page.captureScreenshot、Accessibility.getFullAXTree
 * 在窗口不可见或标签 discarded/frozen 时可能永不返回。所有路径必须：
 * 1. 先 tabs.update({active:true}) + 聚焦窗口（不改尺寸；仅最小化才还原）
 * 2. discarded/frozen 先激活等到 renderer 醒
 * 3. attach / 截图 / AX 树 20s 超时，超时 detach 并抛错（调用方 finally unlock）
 */

import { CDP_TIMEOUT_MS } from './limits.js';

export const CDP_VERSION = '1.3';
export { CDP_TIMEOUT_MS };

const BRING_TO_FRONT_MS = 3000;
const WAKE_RENDERER_MS = 5000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
}

/** Promise 超时则 reject；原 Promise 无法取消，超时后调用方应 detach 兜底。 */
export function withDeadline(promise, ms, label) {
  const timeoutMs = Math.max(0, Number(ms) || 0);
  const name = String(label || '操作');
  const p = Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      p.catch(() => {});
      reject(new Error(`${name} 超时（${Math.round(timeoutMs / 1000)}s）。窗口可能不在前台或标签已冻结。`));
    }, timeoutMs);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function waitUntilAwake(tabId, ms = WAKE_RENDERER_MS) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) throw new Error('标签页已关闭');
    if (!tab.discarded && !tab.frozen) return tab;
    await sleep(200);
  }
  return chrome.tabs.get(tabId);
}

/**
 * 聚焦窗口但不改尺寸。
 * 禁止无条件 state:'normal'：那会把最大化窗口还原成小窗。
 * 仅 minimized 才改 state；focus 仍还不开则 maximized，避免曾经最大化的窗口被压成窗口化。
 */
async function focusWindowPreservingBounds(windowId) {
  if (!windowId) return;
  try {
    await chrome.windows.update(windowId, { focused: true });
  } catch (_) {}
  const win = await chrome.windows.get(windowId).catch(() => null);
  if (win?.state !== 'minimized') return;
  try {
    await chrome.windows.update(windowId, { focused: true, state: 'maximized' });
  } catch (_) {
    await chrome.windows.update(windowId, { state: 'maximized' }).catch(() => {});
  }
}

/**
 * 把标签拉到前台：激活标签 + 聚焦窗口（保持最大化/全屏/原尺寸）。
 * discarded/frozen 时先激活再等到 renderer 醒。
 */
export async function ensureTabForeground(tabId) {
  const id = Number(tabId);
  if (!id) throw new Error('需要 tabId');
  let tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab) throw new Error('标签页不存在或已关闭');
  const wasSleeping = !!(tab.discarded || tab.frozen);
  await chrome.tabs.update(id, { active: true });
  await focusWindowPreservingBounds(tab.windowId);
  if (wasSleeping) tab = await waitUntilAwake(id);
  return tab;
}

/**
 * 仅在 discarded/frozen 时激活以唤醒 renderer，不抢用户当前标签、不改窗口焦点。
 * browser_act 默认路径用这个；截图 / AX / 可信点击仍走 ensureTabForeground。
 */
export async function wakeTabIfSleeping(tabId) {
  const id = Number(tabId);
  if (!id) throw new Error('需要 tabId');
  let tab = await chrome.tabs.get(id).catch(() => null);
  if (!tab) throw new Error('标签页不存在或已关闭');
  if (!tab.discarded && !tab.frozen) return tab;
  await chrome.tabs.update(id, { active: true });
  return waitUntilAwake(id);
}

export async function debuggerDetach(tabId) {
  const id = Number(tabId);
  if (!id) return;
  try { await chrome.debugger.detach({ tabId: id }); } catch (_) {}
}

async function attachOnce(tabId) {
  return withDeadline(
    chrome.debugger.attach({ tabId: Number(tabId) }, CDP_VERSION),
    CDP_TIMEOUT_MS,
    'debugger.attach',
  );
}

/** 前台唤醒 + 限时 attach + Page.bringToFront。超时会尝试 detach。 */
export async function debuggerAttach(tabId) {
  const id = Number(tabId);
  await ensureTabForeground(id);
  try {
    await attachOnce(id);
  } catch (err) {
    if (/another debugger|already.*debug/i.test(err.message || '')) {
      await debuggerDetach(id);
      try {
        await attachOnce(id);
      } catch (err2) {
        await debuggerDetach(id);
        throw err2;
      }
    } else {
      await debuggerDetach(id);
      setTimeout(() => { debuggerDetach(id); }, 500);
      throw err;
    }
  }
  await debuggerSend(id, 'Page.bringToFront', {}, BRING_TO_FRONT_MS).catch(() => {});
}

/**
 * 已附着时再拉一次前台（窗口中途被切走）。未附着则走 debuggerAttach。
 */
export async function prepareTabForCdp(tabId, { attached = false } = {}) {
  const id = Number(tabId);
  await ensureTabForeground(id);
  if (attached) {
    await debuggerSend(id, 'Page.bringToFront', {}, BRING_TO_FRONT_MS).catch(() => {});
  }
}

export async function debuggerSend(tabId, method, params = {}, timeoutMs = CDP_TIMEOUT_MS) {
  const id = Number(tabId);
  return withDeadline(
    chrome.debugger.sendCommand({ tabId: id }, method, params),
    timeoutMs,
    method,
  );
}

/** 一次性 CDP：attach → fn → detach。超时/抛错也会 detach。 */
export async function withDebugger(tabId, fn) {
  const id = Number(tabId);
  await debuggerAttach(id);
  try {
    return await fn(id);
  } finally {
    await debuggerDetach(id);
  }
}
