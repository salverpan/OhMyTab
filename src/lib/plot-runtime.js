/**
 * ECharts 运行时（按需加载）。独立打成 dist/lib/plot-runtime.js，
 * 不进 Service Worker / 不进 content 常驻包。
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

function themeFrom(el) {
  const cs = getComputedStyle(el || document.documentElement);
  const ink = (cs.getPropertyValue('--ink') || '#18181b').trim() || '#18181b';
  const muted = (cs.getPropertyValue('--muted') || '#6b6b73').trim() || '#6b6b73';
  const hair = (cs.getPropertyValue('--hairline') || 'rgba(0,0,0,0.08)').trim() || 'rgba(0,0,0,0.08)';
  const isDark = (() => {
    const forced = document.documentElement.dataset.theme;
    if (forced === 'dark') return true;
    if (forced === 'light') return false;
    const bg = (cs.getPropertyValue('--canvas') || '#fff').trim();
    return /#1|#0|rgb\(\s*2[0-4]/.test(bg) || matchMedia('(prefers-color-scheme: dark)').matches;
  })();
  return {
    backgroundColor: 'transparent',
    textStyle: { color: ink, fontFamily: 'inherit' },
    legend: { textStyle: { color: muted } },
    tooltip: {
      backgroundColor: isDark ? '#27272a' : '#ffffff',
      borderColor: hair,
      textStyle: { color: ink, fontSize: 12 },
      confine: true,
      transitionDuration: 0,
      enterable: false,
      extraCssText: 'pointer-events:none;',
    },
  };
}

const PTR_EVENTS = ['pointermove', 'pointerdown', 'mousemove', 'mousedown'];

/** 侧栏面板用了 CSS zoom（--ui-scale）。ZRender 默认吃 offsetX，和缩放后的 canvas 对不齐，tooltip/轴指示会跟着鼠标漂。 */
function attachPointerFix(host) {
  detachPointerFix(host);
  if (!host || typeof host.addEventListener !== 'function') return;
  const onPtr = (e) => {
    const canvas = host.querySelector && host.querySelector('canvas');
    if (!canvas || e.clientX == null) return;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    e.zrX = (e.clientX - rect.left) * (canvas.clientWidth / rect.width);
    e.zrY = (e.clientY - rect.top) * (canvas.clientHeight / rect.height);
  };
  for (const t of PTR_EVENTS) host.addEventListener(t, onPtr, true);
  host._citecatPtrFix = onPtr;
}

function detachPointerFix(host) {
  const onPtr = host && host._citecatPtrFix;
  if (!onPtr) return;
  for (const t of PTR_EVENTS) {
    try { host.removeEventListener(t, onPtr, true); } catch (_) {}
  }
  host._citecatPtrFix = null;
}

function withStableTooltip(option, theme) {
  const fromOpt = (option && option.tooltip) || {};
  const axisPointer = fromOpt.trigger === 'axis'
    ? { type: 'line', snap: true, animation: false, ...(fromOpt.axisPointer || {}) }
    : fromOpt.axisPointer;
  return {
    ...(theme.tooltip || {}),
    ...fromOpt,
    confine: true,
    transitionDuration: 0,
    enterable: false,
    extraCssText: [theme.tooltip && theme.tooltip.extraCssText, fromOpt.extraCssText, 'pointer-events:none;']
      .filter(Boolean).join(''),
    ...(axisPointer ? { axisPointer } : {}),
  };
}

const observers = new WeakMap();

export function renderEChart(el, option) {
  if (!el || !option) return null;
  detachPointerFix(el);
  const existing = echarts.getInstanceByDom(el);
  if (existing) existing.dispose();
  const inst = echarts.init(el, null, { renderer: 'canvas' });
  const theme = themeFrom(el);
  inst.setOption({
    ...theme,
    ...option,
    title: { show: false },
    tooltip: withStableTooltip(option, theme),
  }, { notMerge: true });
  attachPointerFix(el);
  if (typeof ResizeObserver !== 'undefined') {
    const prevRo = observers.get(el) || el._citecatRo;
    if (prevRo) {
      try { prevRo.disconnect(); } catch (_) {}
    }
    const ro = new ResizeObserver(() => {
      try { inst.resize(); } catch (_) {}
    });
    ro.observe(el);
    observers.set(el, ro);
    el._citecatRo = ro;
  }
  el._citecatChart = inst;
  return inst;
}

export function disposeEChart(el) {
  if (!el) return;
  detachPointerFix(el);
  const ro = observers.get(el);
  if (ro) {
    try { ro.disconnect(); } catch (_) {}
    observers.delete(el);
  }
  if (el._citecatChart) {
    try { el._citecatChart.dispose(); } catch (_) {}
    el._citecatChart = null;
  } else {
    const inst = echarts.getInstanceByDom(el);
    if (inst) try { inst.dispose(); } catch (_) {}
  }
  el._citecatRo = null;
}

export { echarts };
