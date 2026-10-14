/** 划词 / 阅读器浮动聊天窗的边框缩放。左、右、下三边可拖；顶边留给标题栏移动。 */

export const CHAT_RESIZE_EDGE = 8;

export function isChatResizeEdge(win, e) {
  const r = win.getBoundingClientRect();
  return e.clientX <= r.left + CHAT_RESIZE_EDGE
    || e.clientX >= r.right - CHAT_RESIZE_EDGE
    || e.clientY >= r.bottom - CHAT_RESIZE_EDGE;
}

function edgeFlags(win, e) {
  const r = win.getBoundingClientRect();
  return {
    r,
    left: e.clientX <= r.left + CHAT_RESIZE_EDGE,
    right: e.clientX >= r.right - CHAT_RESIZE_EDGE,
    bottom: e.clientY >= r.bottom - CHAT_RESIZE_EDGE,
  };
}

function cursorClass(flags) {
  const horizontal = flags.left || flags.right;
  if (horizontal && flags.bottom) return 'cw-rz-nwse';
  if (horizontal) return 'cw-rz-ew';
  if (flags.bottom) return 'cw-rz-ns';
  return '';
}

function ensureGrip(win) {
  if (win.querySelector(':scope > .cw-rz')) return;
  const el = document.createElement('div');
  el.className = 'cw-rz';
  el.style.cssText = 'position:absolute;z-index:5;right:0;bottom:0;width:22px;height:22px;';
  win.appendChild(el);
}

const CURSOR_CLASSES = ['cw-rz-ew', 'cw-rz-ns', 'cw-rz-nwse'];

function setCursorClass(win, name) {
  for (const c of CURSOR_CLASSES) win.classList.toggle(c, c === name);
}

/**
 * 按住左 / 右 / 下边缘改尺寸。边框停在指针下：
 * 短窗口不被最小高度瞬间弹高，拖过样式 max-height 时关掉过渡，避免边框滞后再跳。
 */
export function bindChatResize(win) {
  ensureGrip(win);
  let dragging = false;
  win.addEventListener('mousemove', (e) => {
    if (dragging) return;
    if (e.target.closest?.('.cw-rz')) { setCursorClass(win, 'cw-rz-nwse'); return; }
    setCursorClass(win, cursorClass(edgeFlags(win, e)));
  });
  win.addEventListener('mouseleave', () => { if (!dragging) setCursorClass(win, ''); });
  win.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || dragging) return;
    if (e.target.closest('.cw-btn, .cw-send, input, button, a, textarea')) return;
    const grip = e.target.closest?.('.cw-rz');
    const flags = edgeFlags(win, e);
    if (grip) { flags.right = true; flags.bottom = true; }
    const cursor = cursorClass(flags);
    if (!cursor) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    win._resized = true;
    setCursorClass(win, cursor);
    try { win.setPointerCapture(e.pointerId); } catch (_) {}

    const rect = flags.r;
    const startW = win.offsetWidth;
    const startH = win.offsetHeight;
    const scaleX = startW ? rect.width / startW : 1;
    const scaleY = startH ? rect.height / startH : 1;
    const floorW = Math.min(280, startW);
    const floorH = Math.min(200, startH);
    const grabX = flags.left ? e.clientX - rect.left : e.clientX - rect.right;
    const grabY = e.clientY - rect.bottom;

    const prevUserSelect = document.documentElement.style.userSelect;
    document.documentElement.style.userSelect = 'none';
    // 先锁住当前尺寸再放开 max-height，避免过渡动画把边框从指针上拖走
    win.style.transition = 'none';
    win.style.width = startW + 'px';
    win.style.height = startH + 'px';
    win.style.maxHeight = 'none';
    const bodyEl = win.querySelector('.cw-body');
    if (bodyEl) bodyEl.style.maxHeight = 'none';

    const onMove = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (flags.right) {
        let right = ev.clientX - grabX;
        right = Math.min(right, window.innerWidth - 8);
        const width = Math.max(floorW, (right - rect.left) / scaleX);
        win.style.width = width + 'px';
      } else if (flags.left) {
        const rightEdge = rect.right;
        let left = ev.clientX - grabX;
        left = Math.max(8, left);
        let width = (rightEdge - left) / scaleX;
        if (width < floorW) {
          width = floorW;
          left = rightEdge - floorW * scaleX;
        }
        win.style.left = left + 'px';
        win.style.width = width + 'px';
      }
      if (flags.bottom) {
        let bottom = ev.clientY - grabY;
        bottom = Math.min(bottom, window.innerHeight - 8);
        const height = Math.max(floorH, (bottom - rect.top) / scaleY);
        win.style.height = height + 'px';
      }
    };
    const onUp = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      dragging = false;
      setCursorClass(win, '');
      win.style.transition = '';
      document.documentElement.style.userSelect = prevUserSelect;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}
