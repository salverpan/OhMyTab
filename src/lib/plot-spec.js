/**
 * 把 agent 的收口参数编成 ECharts option。无 DOM，可进 SW / Node 测试。
 * 运行时渲染在 plot-runtime.js（按需加载，不进 Service Worker）。
 */

export const PLOT_TYPES = ['bar', 'line', 'area', 'scatter', 'heatmap'];
export const MAX_ROWS = 2000;
export const MAX_SERIES = 8;
export const MAX_EVENTS = 20;

/** 打印（进 docx）用的逻辑尺寸：16:9，等比放进 A4 可打印宽后图内字 ≈9.5pt。 */
export const PRINT_CHART_WIDTH = 480;
export const PRINT_CHART_HEIGHT = 270;
/** 打印锁定字体栈：Word 里回退到宋体会整张图变样，写死中文黑体族。 */
export const PRINT_FONT_FAMILY = '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';

const PALETTE = ['#4e75df', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v).slice(0, 80);
}

function asNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function newId() {
  return 'cht_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 仪表盘抽取 {name, points:[[x,y]]} / {name, data:[]} → 长表 */
function fromChartSeries(list) {
  const rows = [];
  for (const s of list.slice(0, MAX_SERIES)) {
    const name = asText(s.name || s.title || '系列');
    if (Array.isArray(s.points)) {
      for (const pt of s.points.slice(0, MAX_ROWS)) {
        if (Array.isArray(pt) && pt.length >= 2) rows.push({ x: asText(pt[0]), y: asNum(pt[1]), series: name });
        else if (pt && typeof pt === 'object') {
          const x = pt.x ?? pt[0] ?? pt.name;
          const y = pt.y ?? pt.value ?? pt[1];
          rows.push({ x: asText(x), y: asNum(y), series: name });
        }
      }
    } else if (Array.isArray(s.data)) {
      s.data.slice(0, MAX_ROWS).forEach((v, i) => {
        if (Array.isArray(v) && v.length >= 2) rows.push({ x: asText(v[0]), y: asNum(v[1]), series: name });
        else rows.push({ x: String(i + 1), y: asNum(v), series: name });
      });
    }
  }
  return rows;
}

function keysOf(row) {
  return row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [];
}

function inferX(rows, requested) {
  if (requested && rows.some((r) => r[requested] != null)) return requested;
  for (const k of ['x', 'name', 'label', 'date', '日期', 'year', '年', 'month', 'category']) {
    if (rows.some((r) => r[k] != null && r[k] !== '')) return k;
  }
  const keys = keysOf(rows[0]);
  const nonNum = keys.find((k) => asNum(rows[0][k]) == null);
  return nonNum || keys[0] || 'x';
}

function inferY(rows, requested) {
  if (Array.isArray(requested) && requested.length) {
    return requested.map(String).filter((k) => rows.some((r) => asNum(r[k]) != null)).slice(0, MAX_SERIES);
  }
  if (requested && rows.some((r) => asNum(r[requested]) != null)) return [String(requested)];
  for (const k of ['y', 'value', 'units', 'count', '数值', '数量', 'views', 'amount']) {
    if (rows.some((r) => asNum(r[k]) != null)) return [k];
  }
  const keys = keysOf(rows[0]);
  const nums = keys.filter((k) => rows.some((r) => asNum(r[k]) != null));
  return nums.slice(0, MAX_SERIES);
}

function unique(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const k = asText(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function markLines(events) {
  const list = Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [];
  const data = [];
  for (const ev of list) {
    const x = ev && (ev.x ?? ev.date ?? ev.label);
    if (x == null || x === '') continue;
    data.push({
      xAxis: asText(x),
      label: {
        formatter: asText(ev.label || ev.name || x),
        color: '#6b6b73',
        fontSize: 10,
        position: 'insideEndTop',
        distance: 6,
      },
      lineStyle: { type: 'dashed', color: '#92929b' },
    });
  }
  return data.length ? { symbol: 'none', data, silent: true } : null;
}

function categoryLabelOpts(categories) {
  const cats = Array.isArray(categories) ? categories : [];
  const n = cats.length;
  const long = cats.some((c) => String(c).length > 6);
  const rotate = n > 10 || (n > 6 && long) ? 36 : (long && n > 4 ? 28 : 0);
  return {
    hideOverlap: true,
    interval: 'auto',
    rotate,
    fontSize: 10,
    lineHeight: 12,
    overflow: 'truncate',
    width: rotate ? 52 : (long ? 64 : undefined),
    ellipsis: '…',
    margin: 10,
  };
}

function cartesianOption({ type, categories, series, events }) {
  const isScatter = type === 'scatter';
  const isArea = type === 'area';
  const xLabels = isScatter ? null : categoryLabelOpts(categories);
  const rotate = xLabels && xLabels.rotate ? xLabels.rotate : 0;
  const hasLegend = series.length > 1;
  const option = {
    animationDuration: 280,
    title: { show: false },
    tooltip: {
      trigger: isScatter ? 'item' : 'axis',
      confine: true,
      transitionDuration: 0,
      enterable: false,
      axisPointer: isScatter ? undefined : { type: 'line', snap: true, animation: false },
    },
    legend: hasLegend
      ? {
          top: 4,
          type: 'scroll',
          itemWidth: 12,
          itemHeight: 8,
          itemGap: 12,
          padding: [0, 8, 10, 8],
          textStyle: { fontSize: 11 },
        }
      : undefined,
    grid: {
      left: 10,
      right: 16,
      top: hasLegend ? 52 : 16,
      bottom: rotate ? 56 : 28,
      containLabel: true,
    },
    xAxis: isScatter
      ? {
          type: 'value',
          name: series[0] && series[0].xName,
          splitLine: { lineStyle: { opacity: 0.35 } },
          axisLabel: { hideOverlap: true, fontSize: 10 },
        }
      : { type: 'category', data: categories, axisLabel: xLabels, axisTick: { alignWithLabel: true } },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { opacity: 0.35 } },
      axisLabel: { hideOverlap: true, fontSize: 10 },
    },
    series: series.map((s, i) => {
      const color = PALETTE[i % PALETTE.length];
      if (isScatter) {
        return {
          type: 'scatter',
          name: s.name,
          data: s.points,
          itemStyle: { color },
        };
      }
      const ser = {
        type: 'line',
        name: s.name,
        data: s.data,
        showSymbol: s.data.length <= 24,
        itemStyle: { color },
        lineStyle: { width: 2, color },
      };
      if (type === 'bar') {
        ser.type = 'bar';
        ser.barMaxWidth = 36;
        delete ser.showSymbol;
        delete ser.lineStyle;
      } else if (isArea) {
        ser.areaStyle = { opacity: 0.18, color };
        ser.smooth = 0.15;
      }
      const ml = i === 0 ? markLines(events) : null;
      if (ml) ser.markLine = ml;
      return ser;
    }),
  };
  return option;
}

function heatmapOption({ xCats, yCats, cells }) {
  const xLabels = categoryLabelOpts(xCats);
  return {
    animationDuration: 280,
    title: { show: false },
    tooltip: { position: 'top', confine: true, transitionDuration: 0, enterable: false },
    grid: { left: 10, right: 16, top: 16, bottom: xLabels.rotate ? 72 : 52, containLabel: true },
    xAxis: { type: 'category', data: xCats, splitArea: { show: true }, axisLabel: xLabels },
    yAxis: { type: 'category', data: yCats, splitArea: { show: true }, axisLabel: { hideOverlap: true, fontSize: 10 } },
    visualMap: {
      min: cells.reduce((m, c) => Math.min(m, c[2]), Infinity),
      max: cells.reduce((m, c) => Math.max(m, c[2]), -Infinity),
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#e8eefc', '#4e75df'] },
    },
    series: [{ type: 'heatmap', data: cells, emphasis: { itemStyle: { shadowBlur: 4 } } }],
  };
}

/**
 * 打印锁定：把聊天用的 option 改成「白底 + 墨色文字 + 固定字号」的静态图配置。
 * 图会从 480 逻辑 px 缩到 560px（5.83in）印在纸上，字号必须同步放大才不会印糊；
 * 交互组件（tooltip / calculable / 动画）一律关掉——docx 里是一张位图。
 */
export function printLockOption(option) {
  const opt = JSON.parse(JSON.stringify(option || {}));
  const ink = '#18181b';
  const body = '#3f3f46';
  const muted = '#52525b';
  const hair = 'rgba(0,0,0,0.12)';
  const grid = 'rgba(0,0,0,0.10)';
  opt.animation = false;
  opt.backgroundColor = '#ffffff';
  opt.textStyle = { color: ink, fontFamily: PRINT_FONT_FAMILY };
  opt.tooltip = { show: false };
  if (opt.legend) {
    opt.legend.textStyle = { ...(opt.legend.textStyle || {}), color: body, fontSize: 11 };
  }
  const axisFix = (axis) => {
    if (!axis || Array.isArray(axis)) return;
    axis.axisLabel = { ...(axis.axisLabel || {}), color: muted, fontSize: 11, lineHeight: 13 };
    axis.nameTextStyle = { ...(axis.nameTextStyle || {}), color: muted, fontSize: 11 };
    axis.axisLine = { ...(axis.axisLine || {}), lineStyle: { ...((axis.axisLine || {}).lineStyle || {}), color: hair } };
    axis.splitLine = { ...(axis.splitLine || {}), lineStyle: { ...((axis.splitLine || {}).lineStyle || {}), color: grid, opacity: 1 } };
    axis.axisTick = { ...(axis.axisTick || {}), lineStyle: { ...((axis.axisTick || {}).lineStyle || {}), color: hair } };
  };
  axisFix(opt.xAxis);
  axisFix(opt.yAxis);
  if (opt.visualMap && !Array.isArray(opt.visualMap)) {
    opt.visualMap.calculable = false;
    opt.visualMap.textStyle = { ...(opt.visualMap.textStyle || {}), color: body, fontSize: 10 };
  }
  for (const s of (Array.isArray(opt.series) ? opt.series : [])) {
    if (s && s.markLine && s.markLine.label) {
      s.markLine.label = { ...s.markLine.label, color: muted, fontSize: 10 };
    }
  }
  return opt;
}

/**
 * @param {object} args plot_chart 参数
 * @param {object} [opts]
 * @param {'chat'|'print'} [opts.mode] print = 打印锁定（进 docx 用）
 * @returns {{ok:true, chart:{id,title,type,rows,option}} | {ok:false, error:string}}
 */
export function buildPlotOption(args, opts = {}) {
  const raw = args || {};
  const type = PLOT_TYPES.includes(raw.type) ? raw.type : 'bar';
  const title = asText(raw.title || '').slice(0, 80);
  const finish = (chart) => (opts.mode === 'print' ? { ...chart, option: printLockOption(chart.option) } : chart);
  let rows = [];

  if (Array.isArray(raw.data) && raw.data.length) {
    const first = raw.data[0];
    if (first && (Array.isArray(first.points) || Array.isArray(first.data)) && (first.name != null || first.points || first.data)) {
      rows = fromChartSeries(raw.data);
    } else if (typeof first === 'object' && first && !Array.isArray(first)) {
      rows = raw.data.slice(0, MAX_ROWS);
    }
  }
  if (!rows.length) return { ok: false, error: 'data 需要对象数组，或图表序列 [{name, points:[[x,y]]}]。' };

  if (type === 'heatmap') {
    const xk = inferX(rows, raw.x);
    const yk = String(raw.y || raw.series || 'y');
    const vk = String(raw.value || raw.v || 'value');
    const yField = rows.some((r) => r[yk] != null) ? yk : inferX(rows, 'y');
    const vField = rows.some((r) => asNum(r[vk]) != null) ? vk : (inferY(rows, raw.y)[0] || 'value');
    const xCats = unique(rows.map((r) => r[xk]));
    const yCats = unique(rows.map((r) => r[yField]));
    const cells = [];
    for (const r of rows) {
      const n = asNum(r[vField]);
      if (n == null) continue;
      cells.push([asText(r[xk]), asText(r[yField]), n]);
    }
    if (!cells.length) return { ok: false, error: '热力图需要可解析的数值列（value）。' };
    return {
      ok: true,
      chart: finish({
        id: newId(),
        title: title || '热力图',
        type,
        rows: cells.length,
        option: heatmapOption({ xCats, yCats, cells }),
      }),
    };
  }

  const xk = inferX(rows, raw.x);
  const yFields = inferY(rows, raw.y);
  if (!yFields.length) return { ok: false, error: '找不到数值列。请传 y（字段名）或确保 data 里有数字。' };

  const seriesField = raw.series && rows.some((r) => r[raw.series] != null) ? String(raw.series) : '';
  const categories = unique(rows.map((r) => r[xk]));
  const series = [];

  if (type === 'scatter') {
    const yk = yFields[0];
    const groups = seriesField ? unique(rows.map((r) => r[seriesField])).slice(0, MAX_SERIES) : [''];
    for (const g of groups) {
      const pts = [];
      for (const r of rows) {
        if (g && asText(r[seriesField]) !== g) continue;
        const xv = asNum(r[xk]);
        const yv = asNum(r[yk]);
        if (xv == null || yv == null) continue;
        pts.push([xv, yv]);
      }
      if (pts.length) series.push({ name: g || yk, points: pts, xName: xk });
    }
  } else if (seriesField && yFields.length === 1) {
    const yk = yFields[0];
    const groups = unique(rows.map((r) => r[seriesField])).slice(0, MAX_SERIES);
    for (const g of groups) {
      const data = categories.map((cat) => {
        const hit = rows.find((r) => asText(r[xk]) === cat && asText(r[seriesField]) === g);
        return hit ? asNum(hit[yk]) : null;
      });
      series.push({ name: g, data });
    }
  } else {
    for (const yk of yFields.slice(0, MAX_SERIES)) {
      series.push({
        name: yk,
        data: categories.map((cat) => {
          const hit = rows.find((r) => asText(r[xk]) === cat);
          return hit ? asNum(hit[yk]) : null;
        }),
      });
    }
  }

  if (!series.length) return { ok: false, error: '没有可画的数据点。' };

  return {
    ok: true,
    chart: finish({
      id: newId(),
      title: title || '图表',
      type,
      rows: rows.length,
      option: cartesianOption({ type, categories, series, events: raw.events }),
    }),
  };
}
