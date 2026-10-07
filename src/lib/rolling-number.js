/**
 * 苹果风格数字文本过渡（SwiftUI `.contentTransition(.numericText())`）：
 * 每位数字独立纵向滚动 —— 旧数字向上滚出并虚化消失，新数字自下滚入并
 * 虚化合焦（blur + saturate bloom，与全站聚焦模糊入场动画同一视觉语言）。
 *
 * 实现要点：
 * - 纯 WAAPI（element.animate），自包含、无外部 CSS 依赖，只操作传入的元素
 *   （遵循 lib 约定：不碰全局 document/window，SW 可安全 import 但不会调用）。
 * - 逐位滚动：新旧数字逐位比较，只有变化的位才滚；千分位分隔符静态不动。
 * - 位数变化（如 9,999 -> 10,000）退化为整串滚动。
 * - 方向语义：增大 -> 新数字自下滚入；减小 -> 新数字自上滚入。
 * - `prefers-reduced-motion` 时直接跳变（无动画）。
 *
 * 用法：rollNumber(el, from, to, { duration = 340, stagger = 18 })
 *   el 是数字容器（其余内容会被替换为滚动列结构）。
 */
const PREFER_REDUCED =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function fmt(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return v.toLocaleString('en-US');
}

const COL_STYLE =
  'display:inline-block;position:relative;overflow:hidden;height:1em;line-height:1em;vertical-align:top;flex:0 0 auto;';
const FACE_STYLE = 'display:block;height:1em;line-height:1em;';
const STATIC_STYLE = 'display:inline-block;height:1em;line-height:1em;vertical-align:top;flex:0 0 auto;';

/** 位数收缩后列宽 glide 回新值宽度的时长（ms）。 */
const GLIDE_MS = 300;

/**
 * 位数减少后（如清空会话 9,999 -> 0）把列宽平滑收回新值宽度。
 * rollColumn 的 sizer 为让旧数字完整滚出而钉在旧值宽度上；滚完不撤的话，
 * 数字右边会留一段空白、把后面的「tokens」标签顶在远处回不来。等滚完再 glide。
 * 增长时 sizer 取的就是新值宽度，列宽本就正确，不收。
 */
function glideShrink(col, newText, rollDuration) {
  const sizer = col.firstChild; // rollColumn 第一个子节点是隐藏的 sizer
  setTimeout(() => {
    const startW = col.offsetWidth; // 旧值宽度
    // 量目标宽度：关过渡、让 sizer 取新值读自然宽，再钉回起始宽度
    col.style.transition = 'none';
    sizer.textContent = newText;
    col.style.width = '';
    const endW = col.offsetWidth;
    col.style.width = startW + 'px';
    void col.offsetWidth; // reflow，确保过渡从起始宽度生效
    col.style.transition = `width ${GLIDE_MS}ms cubic-bezier(.4,0,.2,1)`;
    col.style.width = endW + 'px';
    setTimeout(() => {
      col.style.width = '';
      col.style.transition = '';
    }, GLIDE_MS + 60);
  }, rollDuration);
}

/**
 * 把 el 的数字从 from 滚动到 to。
 * @param {HTMLElement} el 数字容器
 * @param {number} from 当前显示值
 * @param {number} to 目标值
 * @param {object} [opts]
 * @param {number} [opts.duration=340] 每位滚动时长（ms）
 * @param {number} [opts.stagger=18] 逐位错峰（ms，封顶 90ms）
 */
export function rollNumber(el, from, to, opts = {}) {
  if (!el) return;
  const { duration = 340, stagger = 18 } = opts;
  const oldStr = fmt(from);
  const newStr = fmt(to);

  if (oldStr === newStr) {
    el.textContent = newStr;
    return;
  }
  if (PREFER_REDUCED) {
    el.textContent = newStr;
    return;
  }

  el.textContent = '';
  el.style.fontVariantNumeric = 'tabular-nums';

  const up = to > from;
  const oldDigits = oldStr.replace(/\D/g, '').length;
  const newDigits = newStr.replace(/\D/g, '').length;

  /** 单列滚动：oldFace 滚出 + newFace 滚入。
      用隐藏 sizer（新字符串，visibility:hidden 仍占宽）钉住列宽 = 新内容宽度，
      整串滚动（位数变化）时新数字不会被列的 overflow:hidden 裁掉 */
  const rollColumn = (oldText, newText, delay) => {
    const col = document.createElement('span');
    col.style.cssText = COL_STYLE;

    const sizer = document.createElement('span');
    // 取较宽者占位：增长时列宽=新值宽（不被裁），减少时列宽=旧值宽（旧数字完整滚出）
    sizer.textContent = oldText.length >= newText.length ? oldText : newText;
    sizer.style.cssText = FACE_STYLE + 'visibility:hidden;';

    const oldFace = document.createElement('span');
    oldFace.textContent = oldText;
    oldFace.style.cssText = FACE_STYLE + 'position:absolute;top:0;left:0;';
    const newFace = document.createElement('span');
    newFace.textContent = newText;
    newFace.style.cssText = FACE_STYLE + 'position:absolute;top:0;left:0;';
    col.appendChild(sizer);
    col.appendChild(oldFace);
    col.appendChild(newFace);

    const exitY = up ? -110 : 110;
    const enterY = up ? 110 : -110;
    oldFace.animate(
      [
        { transform: 'translateY(0)', opacity: 1, filter: 'none' },
        { transform: `translateY(${exitY}%)`, opacity: 0, filter: 'blur(6px)' },
      ],
      { duration, delay, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' }
    );
    newFace.animate(
      [
        { transform: `translateY(${enterY}%)`, opacity: 0, filter: 'blur(6px) saturate(1.3)' },
        { transform: 'translateY(0)', opacity: 1, filter: 'none' },
      ],
      { duration, delay, easing: 'cubic-bezier(.34,1.25,.64,1)', fill: 'both' }
    );
    return col;
  };

  // 位数变化（罕见跳变）：整串滚动
  if (oldDigits !== newDigits) {
    const col = rollColumn(oldStr, newStr, 0);
    el.appendChild(col);
    // 位数减少时滚完后把列宽 glide 回新值宽度，「tokens」标签滑回来贴住数字
    if (newStr.length < oldStr.length) glideShrink(col, newStr, duration);
    return;
  }

  // 逐位比较：不变的位静态，变化的位滚动（逐位错峰）
  const nodes = [];
  let changed = 0;
  for (let i = 0; i < newStr.length; i++) {
    const o = oldStr[i];
    const n = newStr[i];
    if (o === n) {
      const s = document.createElement('span');
      s.textContent = n;
      s.style.cssText = STATIC_STYLE;
      nodes.push(s);
      continue;
    }
    nodes.push(rollColumn(o, n, Math.min(changed * stagger, 90)));
    changed++;
  }
  el.append(...nodes);
}
