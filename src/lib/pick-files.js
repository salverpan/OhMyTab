/**
 * 从用户点击手势打开系统文件框。
 *
 * Chrome 145+ / 150+ 把「几乎看不见的 <input type=file> 盖在假按钮上」当成 UI
 * 冒充（CVE-2026-2322、CVE-2026-14031），会故意拖几秒才弹出对话框。
 * Side Panel 里对 hidden / display:none / opacity:0 再 input.click() 同样会卡。
 *
 * File System Access API 不走 HTML file input，避开这两条慢路径。
 */

export async function pickLocalFiles({ multiple = true, types } = {}) {
  if (typeof window.showOpenFilePicker !== 'function') {
    throw new Error('当前浏览器不支持 showOpenFilePicker');
  }
  try {
    const opts = { multiple, excludeAcceptAllOption: false };
    if (types && types.length) opts.types = types;
    const handles = await window.showOpenFilePicker(opts);
    return Promise.all(handles.map((h) => h.getFile()));
  } catch (err) {
    if (err && err.name === 'AbortError') return [];
    throw err;
  }
}

export const OPML_PICK_TYPES = [
  { description: 'OPML', accept: { 'text/xml': ['.opml', '.xml'], 'application/xml': ['.opml', '.xml'] } },
];
