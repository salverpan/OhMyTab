/**
 * 探头像素猫：趴在聊天输入框上沿的 8-bit 小猫（只露耳朵+头+两只前爪）。
 *
 * 实现路线（2026-08-17 调研定稿）：内联 SVG rect 网格 + shape-rendering=crispEdges，
 * 零图片资源、零新依赖；配色走 CSS 变量随亮暗主题。
 *
 * 行为（按用户迭代定稿）：
 * - 非场驻：周期性概率出没——约每 4~9 分钟尝试一次，70% 概率探头，停留 2~4 分钟
 *   （均值≈每 10 分钟出来 3 分钟）后平滑缩回输入框后面；
 * - 伸爪概率：每分钟 tick，概率 10% 起、每分钟 +10%，触发一次平滑伸爪后重置回 10%；
 * - AI 生成中（setPeekCatThinking(true)）：强制探头看着 + 双爪循环快按，结束后恢复调度；
 * - 切回聊天面板（peekCatEnter）：探头跳出并重置停留计时；
 * - 随机眨眼（2.2-6s 间隔 JS 调度）；prefers-reduced-motion 全部禁用，猫静止常驻。
 */

const HEAD = [
  // 探头猫头 10x7 网格：# 描边 o 体色(橘) P 粉(内耳/鼻) K 眼
  '.#......#.',
  '#P#....#P#',
  '#o#....#o#',
  '##########',
  '#ooKooKoo#',
  '#oooPPooo#',
  '.########.',
];
const COLORS = {
  '#': 'var(--peek-line)',
  o: 'var(--peek-fur)',
  P: 'var(--peek-pink)',
  K: 'var(--peek-line)',
};

function buildCatSvg() {
  let head = '';
  let eyes = '';
  HEAD.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const r = `<rect x="${x + 2}" y="${y}" width="1" height="1" fill="${COLORS[ch]}"/>`;
      if (ch === 'K') eyes += r; // 眼睛独立分组，眨眼 scaleY
      else head += r;
    });
  });
  // 爪：橘色一列 + 深色指尖一行（指尖压住输入框顶边形成“扒住”感）
  const pawL = '<g class="cat-paw cat-paw-l"><rect x="2" y="7" width="2" height="1" fill="var(--peek-fur)"/><rect x="2" y="8" width="2" height="1" fill="var(--peek-line)"/></g>';
  const pawR = '<g class="cat-paw cat-paw-r"><rect x="10" y="7" width="2" height="1" fill="var(--peek-fur)"/><rect x="10" y="8" width="2" height="1" fill="var(--peek-line)"/></g>';
  return `<svg viewBox="0 0 14 9" shape-rendering="crispEdges" aria-hidden="true"><g class="cat-head">${head}<g class="cat-eyes">${eyes}</g></g>${pawL}${pawR}</svg>`;
}

let catEl = null;
let clipEl = null;
let thinking = false;
let reduced = false;
let appTimer = 0;    // 下次尝试探头
let stayTimer = 0;   // 停留结束缩回
let pawTimer = 0;    // 每分钟伸爪概率 tick
let pawProb = 0.1;   // 初始伸爪概率 10%，每分钟 +10%，触发后重置

/** 探头爬升（头先露、爪后到，由裁剪层裁切自然形成）；停留计时重置 */
function showCat() {
  if (!catEl) return;
  catEl.classList.add('is-rising'); // 爬升用慢速 transition
  catEl.classList.add('visible');
  // 爬升结束回落为普通速度（缩回用）
  catEl.addEventListener('transitionend', function off(e) {
    if (e.propertyName === 'transform' && catEl.classList.contains('visible')) {
      catEl.classList.remove('is-rising');
      catEl.removeEventListener('transitionend', off);
    }
  });
  clearTimeout(stayTimer);
  stayTimer = setTimeout(hideCat, (2 + Math.random() * 2) * 60000); // 停留 2-4 分钟
}

/** 平滑滑出裁剪层，完全消失 */
function hideCat() {
  if (!catEl) return;
  clearTimeout(stayTimer);
  catEl.classList.remove('is-rising');
  catEl.classList.remove('visible');
}

/** 概率出没调度：间隔 4-9 分钟随机，70% 概率探头 */
function scheduleAppearance() {
  clearTimeout(appTimer);
  appTimer = setTimeout(() => {
    if (!thinking && Math.random() < 0.7) showCat();
    scheduleAppearance();
  }, (4 + Math.random() * 5) * 60000);
}

/** 一次性平滑伸爪（左右爪错开 0.12s），infinite 动画不派发 animationend，可安全移除 */
function playPawTap() {
  if (!catEl) return;
  for (const el of catEl.querySelectorAll('.cat-paw')) {
    el.classList.remove('tap');
    void el.offsetWidth;
    el.classList.add('tap');
    el.addEventListener('animationend', function off() {
      el.classList.remove('tap');
      el.removeEventListener('animationend', off);
    });
  }
}

/**
 * 挂载探头猫到输入框容器（.cmd-input-wrap，自带 position:relative 充当“窗台”）。
 * 重复调用安全（先卸载旧节点）。
 */
export function mountPeekCat(host) {
  if (!host) return;
  catEl?.remove();
  clipEl?.remove();
  catEl = document.createElement('div');
  catEl.className = 'peek-cat';
  catEl.innerHTML = buildCatSvg();
  clipEl = document.createElement('div');
  clipEl.className = 'peek-cat-clip';
  clipEl.appendChild(catEl);
  host.appendChild(clipEl);
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  showCat(); // 开场探头（reduced-motion 下无动画，直接可见）
  if (reduced) return; // 尊重减弱动效：静止常驻，不做任何调度

  // 随机眨眼（2.2-6s 间隔，闭眼 ~140ms）
  const eyes = catEl.querySelector('.cat-eyes');
  (function blink() {
    setTimeout(() => {
      eyes?.classList.add('blink');
      setTimeout(() => { eyes?.classList.remove('blink'); blink(); }, 140);
    }, 2200 + Math.random() * 3800);
  })();

  // 非场驻：概率出没
  scheduleAppearance();

  // 伸爪概率：每分钟 tick，+10%/分钟，触发后重置
  pawTimer = setInterval(() => {
    if (thinking) return; // thinking 时走循环快按，不参与概率
    if (Math.random() < pawProb) {
      playPawTap();
      pawProb = 0.1;
    } else {
      pawProb = Math.min(1, pawProb + 0.1);
    }
  }, 60000);
}

/** AI 生成状态联动：true = 探头看着 + 双爪循环快按；结束恢复概率出没调度 */
export function setPeekCatThinking(v) {
  thinking = !!v;
  catEl?.classList.toggle('is-thinking', thinking);
  if (thinking) {
    showCat(); // 生成中强制探头
    clearTimeout(appTimer); // 暂停出没调度
  } else {
    scheduleAppearance();
  }
}

/** 切回聊天面板时调用：探头跳出并重置停留计时 */
export function peekCatEnter() {
  showCat();
}
