/**
 * G2 运行时（按需加载）。独立打成 dist/lib/plot-runtime.js，
 * 不进 Service Worker / 不进 content 常驻包。
 */
import { Runtime, extend, corelib, plotlib, graphlib } from '@antv/g2';
import { Canvas as GCanvas } from '@antv/g';
import { Renderer as CanvasRenderer } from '@antv/g-canvas';

const Chart = extend(Runtime, { ...corelib(), ...plotlib(), ...graphlib() });

function themeFrom(el, option) {
  const printFill = option && option.theme && option.theme.view && option.theme.view.viewFill;
  if (printFill === '#ffffff') {
    return {
      type: 'classic',
      view: { viewFill: '#ffffff' },
    };
  }
  const cs = getComputedStyle(el || document.documentElement);
  const isDark = (() => {
    const forced = document.documentElement.dataset.theme;
    if (forced === 'dark') return true;
    if (forced === 'light') return false;
    const bg = (cs.getPropertyValue('--canvas') || '#fff').trim();
    return /#1|#0|rgb\(\s*2[0-4]/.test(bg) || matchMedia('(prefers-color-scheme: dark)').matches;
  })();
  return {
    type: isDark ? 'classicDark' : 'classic',
    view: { viewFill: 'transparent' },
  };
}

const observers = new WeakMap();

function detachRo(el) {
  const ro = observers.get(el) || (el && el._citecatRo);
  if (!ro) return;
  try { ro.disconnect(); } catch (_) {}
  observers.delete(el);
  if (el) el._citecatRo = null;
}

function attachRo(el, chart) {
  detachRo(el);
  if (!el || typeof ResizeObserver === 'undefined') return;
  const ro = new ResizeObserver(() => {
    try { chart.forceFit(); } catch (_) {}
  });
  ro.observe(el);
  observers.set(el, ro);
  el._citecatRo = ro;
}

function makeCanvas(el, width, height, pixelRatio) {
  const renderer = new CanvasRenderer();
  return new GCanvas({
    container: el,
    width,
    height,
    renderer,
    devicePixelRatio: pixelRatio,
  });
}

function applyTheme(el, option) {
  const spec = JSON.parse(JSON.stringify(option || {}));
  spec.theme = themeFrom(el, spec);
  return spec;
}

export function disposeChart(el) {
  if (!el) return;
  detachRo(el);
  const inst = el._citecatChart;
  if (inst) {
    try {
      if (typeof inst.destroy === 'function') inst.destroy();
      else if (typeof inst.dispose === 'function') inst.dispose();
    } catch (_) {}
    el._citecatChart = null;
  }
}

/**
 * 把 G2 spec 挂到 DOM 节点上。option 是 plot-spec 编出的声明式配置。
 * @param {HTMLElement} el
 * @param {object} option
 * @param {{width?:number,height?:number,autoFit?:boolean,pixelRatio?:number}} [extra]
 */
export async function renderChart(el, option, extra = {}) {
  if (!el || !option) return null;
  disposeChart(el);
  const width = Number(extra.width) || undefined;
  const height = Number(extra.height) || undefined;
  const autoFit = extra.autoFit !== false && !(width && height);
  const opts = { container: el, autoFit };
  if (width) opts.width = width;
  if (height) opts.height = height;
  if (extra.pixelRatio && width && height) {
    opts.canvas = makeCanvas(el, width, height, extra.pixelRatio);
    opts.autoFit = false;
  }
  const chart = new Chart(opts);
  chart.options(applyTheme(el, option));
  await chart.render();
  el._citecatChart = chart;
  if (opts.autoFit) attachRo(el, chart);
  return chart;
}

/** @deprecated 兼容旧调用名 */
export const renderEChart = renderChart;
export const disposeEChart = disposeChart;

export function chartToDataURL(chart, { background = '#ffffff' } = {}) {
  if (!chart || typeof chart.getContext !== 'function') throw new Error('图表实例无效');
  const gCanvas = chart.getContext().canvas;
  const htmlCanvas = gCanvas && gCanvas.getContextService && gCanvas.getContextService().getDomElement();
  if (!htmlCanvas || !htmlCanvas.toDataURL) throw new Error('找不到画布');
  if (!background || background === 'transparent') return htmlCanvas.toDataURL('image/png');
  const out = document.createElement('canvas');
  out.width = htmlCanvas.width;
  out.height = htmlCanvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('无法创建导出画布');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(htmlCanvas, 0, 0);
  return out.toDataURL('image/png');
}

export { Chart };
