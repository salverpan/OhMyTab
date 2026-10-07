/* 首屏同步上色。必须是普通脚本（不能 type=module），在样式表之前执行，避免等 chrome.storage 时闪一下。 */
(function () {
  try {
    var m = localStorage.getItem('citecatColorScheme') || 'auto';
    var dark = m === 'dark' || (m !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
