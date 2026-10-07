/**
 * 聊天气泡里的图表挂载。DOM-only，禁止被 Service Worker 静态导入。
 * echarts 经 chrome.runtime.getURL('lib/plot-runtime.js') 按需加载。
 */

const registry = new Map();
let runtimePromise = null;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function registerCharts(charts) {
  for (const c of charts || []) {
    if (c && c.id && c.option) registry.set(c.id, c);
  }
}

export function chartHostHtml(charts) {
  registerCharts(charts);
  if (!charts || !charts.length) return '';
  return charts.map((c) => (
    `<div class="chat-chart-card" data-chart-id="${esc(c.id)}">` +
      `<div class="chat-chart-title">${esc(c.title || '图表')}</div>` +
      `<div class="chat-chart" role="img" aria-label="${esc(c.title || '图表')}"></div>` +
    `</div>`
  )).join('');
}

function loadRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
      throw new Error('图表运行时需要 chrome.runtime.getURL');
    }
    return import(/* @vite-ignore */ chrome.runtime.getURL('lib/plot-runtime.js'));
  })();
  return runtimePromise;
}

function disposeHost(el) {
  if (!el) return;
  if (el._citecatPtrFix && typeof el.removeEventListener === 'function') {
    for (const t of ['pointermove', 'pointerdown', 'mousemove', 'mousedown']) {
      try { el.removeEventListener(t, el._citecatPtrFix, true); } catch (_) {}
    }
    el._citecatPtrFix = null;
  }
  if (el._citecatRo) {
    try { el._citecatRo.disconnect(); } catch (_) {}
    el._citecatRo = null;
  }
  if (el._citecatChart) {
    try { el._citecatChart.dispose(); } catch (_) {}
    el._citecatChart = null;
  }
}

export function disposeChartHost(el) {
  disposeHost(el);
}

/** 工作区等非聊天场景：把任意 ECharts option 挂到一个 DOM 节点上。 */
export async function mountChart(host, option) {
  if (!host || !option) return null;
  try {
    const runtime = await loadRuntime();
    if (!host.isConnected) return null;
    return runtime.renderEChart(host, option);
  } catch (err) {
    host.textContent = '图表加载失败：' + (err.message || err);
    return null;
  }
}

export function disposeChatCharts(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.chat-chart').forEach(disposeHost);
}

export async function mountChatCharts(root) {
  if (!root || !root.querySelectorAll) return;
  const cards = [...root.querySelectorAll('.chat-chart-card[data-chart-id]')];
  if (!cards.length) return;
  let runtime;
  try {
    runtime = await loadRuntime();
  } catch (err) {
    cards.forEach((card) => {
      const host = card.querySelector('.chat-chart');
      if (host) host.textContent = '图表加载失败：' + (err.message || err);
    });
    return;
  }
  for (const card of cards) {
    const id = card.getAttribute('data-chart-id');
    const rec = registry.get(id);
    const host = card.querySelector('.chat-chart');
    if (!host || !rec || !rec.option) continue;
    try {
      runtime.renderEChart(host, rec.option);
    } catch (err) {
      host.textContent = '绘图失败：' + (err.message || err);
    }
  }
}

export function appendChartsTo(container, charts, beforeEl) {
  if (!container || !charts || !charts.length) return null;
  const html = chartHostHtml(charts);
  if (container.classList.contains('chat-live-charts')) {
    container.insertAdjacentHTML('beforeend', html);
    mountChatCharts(container);
    return container;
  }
  const wrap = document.createElement('div');
  wrap.className = 'chat-live-charts';
  wrap.innerHTML = html;
  if (beforeEl && beforeEl.parentNode === container) container.insertBefore(wrap, beforeEl);
  else container.appendChild(wrap);
  mountChatCharts(wrap);
  return wrap;
}

/** 把一张图挂到当前 AI 气泡（流式中途 / 浮动窗共用）。 */
export function appendChartInMessage(msgEl, chart, beforeSelector) {
  if (!msgEl || !chart) return null;
  let stack = msgEl.querySelector('.chat-live-charts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'chat-live-charts';
    const before = beforeSelector ? msgEl.querySelector(beforeSelector) : null;
    if (before) msgEl.insertBefore(stack, before);
    else msgEl.appendChild(stack);
  }
  return appendChartsTo(stack, [chart]);
}

/** dataURL → 字节（跨上下文回传走 base64 字符串；ArrayBuffer 过不了 sendMessage）。 */
export function dataUrlToBytes(dataUrl) {
  const comma = String(dataUrl).indexOf(',');
  const bin = atob(comma >= 0 ? String(dataUrl).slice(comma + 1) : '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * 光栅化：把 option 渲成一张 PNG 字节（供 docx 插图）。**必须有 DOM**
 * （ECharts 要真 DOM + canvas + 字体度量），所以只能在侧栏 / 阅读器这类页面跑；
 * SW 宿主没有 DOM，调用方要先判断能力再决定是否走这条路。
 *
 * 容器放视口外但**保留布局**（left:-10000px）——`display:none` 量不到宽高，
 * 渲出来是空白图。渲完立即 dispose + 摘除，不留节点。
 *
 * @returns {Promise<{ok:true, bytes:Uint8Array, dataUrl:string, width:number, height:number} | {ok:false, error:string}>}
 */
export async function rasterizeChartOption(option, { width = 640, height = 360, pixelRatio = 2, background = '#ffffff' } = {}) {
  if (!option) return { ok: false, error: '缺少 option' };
  let runtime;
  try {
    runtime = await loadRuntime();
  } catch (err) {
    return { ok: false, error: '图表运行时加载失败：' + (err.message || err) };
  }
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  document.body.appendChild(host);
  try {
    runtime.renderEChart(host, option);
    const inst = host._citecatChart;
    if (!inst) return { ok: false, error: '图表实例未创建' };
    const dataUrl = inst.getDataURL({ type: 'png', pixelRatio, backgroundColor: background });
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes.length) return { ok: false, error: '导出得到空白图' };
    return { ok: true, bytes, dataUrl, width, height };
  } catch (err) {
    return { ok: false, error: '光栅化失败：' + (err.message || err) };
  } finally {
    disposeHost(host);
    host.remove();
  }
}
