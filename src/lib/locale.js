/**
 * Browser / Chrome UI language → product locale and RSS translation target.
 *
 * Chrome.i18n.getUILanguage() is the browser UI language (en-US, zh-CN, …),
 * not the page language. Navigator.language is the fallback outside Chrome.
 */

export const UI_LOCALE_KEY = 'uiLocale';

export const TARGET_LANGUAGES = Object.freeze([
  'zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'it',
  'ru', 'ar', 'hi', 'vi', 'th', 'id', 'tr', 'pl', 'nl',
]);

export function chromeUiLanguage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      const lang = chrome.i18n.getUILanguage();
      if (lang) return lang;
    }
  } catch (_) { /* tests / missing permission */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  } catch (_) { /* ignore */ }
  return 'en';
}

export function inferUiLocale(uiLang = chromeUiLanguage()) {
  const l = String(uiLang || '').toLowerCase().replace(/_/g, '-');
  return l.startsWith('zh') ? 'zh' : 'en';
}

export function inferTargetLanguage(uiLang = chromeUiLanguage()) {
  const raw = String(uiLang || '').trim();
  const l = raw.toLowerCase().replace(/_/g, '-');
  if (!l) return 'en';
  if (l.startsWith('zh-hant') || l.startsWith('zh-tw') || l.startsWith('zh-hk') || l.startsWith('zh-mo')) {
    return 'zh-Hant';
  }
  if (l.startsWith('zh')) return 'zh-Hans';
  const primary = l.split('-')[0];
  if (TARGET_LANGUAGES.includes(primary)) return primary;
  return 'en';
}

/** Stored pref `'auto'` follows Chrome UI language; otherwise a BCP-47 target. */
export function resolveTargetLanguage(pref, uiLang = chromeUiLanguage()) {
  const v = String(pref || '').trim();
  if (!v || v === 'auto') return inferTargetLanguage(uiLang);
  if (v === 'zh') return 'zh-Hans';
  return v;
}

export function isAutoTargetLanguage(pref) {
  const v = String(pref || '').trim();
  return !v || v === 'auto';
}
