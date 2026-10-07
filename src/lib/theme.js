/**
 * 外观：白天 / 黑夜 / 自动。
 * 存的是模式（light | dark | auto）；页面上 data-theme 只写解析后的 light | dark。
 * localStorage 给首屏脚本同步读取，避免等 chrome.storage 时闪一下。
 */

export const THEME_KEY = 'colorScheme';
export const THEME_LOCAL_KEY = 'citecatColorScheme';

export function normalizeThemeMode(v) {
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

export function resolveTheme(mode) {
  const m = normalizeThemeMode(mode);
  if (m === 'light' || m === 'dark') return m;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (_) {
    return 'light';
  }
}

/** 把已解析的主题写到当前文档。mode 是用户选项，不是解析结果。 */
export function applyDocumentTheme(mode) {
  const stored = normalizeThemeMode(mode);
  const resolved = resolveTheme(stored);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  try { localStorage.setItem(THEME_LOCAL_KEY, stored); } catch (_) {}
  return resolved;
}

export async function loadThemeMode() {
  try {
    const r = await chrome.storage.local.get(THEME_KEY);
    if (r && r[THEME_KEY]) return normalizeThemeMode(r[THEME_KEY]);
  } catch (_) {}
  try { return normalizeThemeMode(localStorage.getItem(THEME_LOCAL_KEY)); } catch (_) {}
  return 'auto';
}

export async function saveThemeMode(mode) {
  const m = normalizeThemeMode(mode);
  await chrome.storage.local.set({ [THEME_KEY]: m });
  try { localStorage.setItem(THEME_LOCAL_KEY, m); } catch (_) {}
  applyDocumentTheme(m);
  return m;
}

/** 自动模式下跟随系统。getMode 返回当前保存的模式。 */
export function watchSystemTheme(getMode, onAuto) {
  let mq;
  try { mq = matchMedia('(prefers-color-scheme: dark)'); } catch (_) { return () => {}; }
  const onChange = () => {
    if (normalizeThemeMode(typeof getMode === 'function' ? getMode() : getMode) === 'auto') {
      if (typeof onAuto === 'function') onAuto();
    }
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
