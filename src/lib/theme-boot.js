/* 首屏同步上色。必须是普通脚本（不能 type=module），在样式表之前执行，避免等 chrome.storage 时闪一下。 */
(function () {
  try {
    var m = localStorage.getItem('citecatColorScheme') || 'auto';
    var dark = m === 'dark' || (m !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
  try {
    var raw = localStorage.getItem('citecatUiScale');
    var scale = null;
    if (raw && raw !== 'auto') {
      var n = parseFloat(raw);
      if (n > 0) scale = n;
    }
    if (scale == null) {
      var dpr = window.devicePixelRatio || 1;
      var w = screen.width || 1920;
      if (dpr >= 1.9 && w >= 2400) scale = 0.95;
      else if (dpr >= 1.4) scale = 0.92;
      else if (dpr >= 1.2) scale = 0.95;
      else if (dpr <= 1.05 && w >= 2400) scale = 1.3;
      else if (dpr <= 1.05 && w >= 1900) scale = 1.05;
      else scale = 1;
    }
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  } catch (e) {}
})();
