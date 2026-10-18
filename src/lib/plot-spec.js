/**
 * 把 agent 的收口参数编成 G2 spec。无 DOM，可进 SW / Node 测试。
 * 运行时渲染在 plot-runtime.js（按需加载，不进 Service Worker）。
 *
 * 图种分两档：默认五种；点名才用的七种。模型不得直接写 G2 配置。
 */

export const DEFAULT_PLOT_TYPES = ['bar', 'line', 'area', 'scatter', 'heatmap'];
export const NAMED_PLOT_TYPES = ['donut', 'histogram', 'boxplot', 'radar', 'funnel', 'waterfall', 'sankey'];
export const PLOT_ALIASES = {
  column: 'bar',
  pie: 'donut',
  ring: 'donut',
  box: 'boxplot',
};
export const PLOT_TYPES = [...DEFAULT_PLOT_TYPES, ...NAMED_PLOT_TYPES];
export const MAX_ROWS = 2000;
export const MAX_SERIES = 8;
export const MAX_EVENTS = 20;
export const MAX_DONUT_CATS = 6;

/** 打印（进 docx）用的逻辑尺寸：16:9，等比放进 A4 可打印宽后图内字 ≈9.5pt。 */
export const PRINT_CHART_WIDTH = 480;
export const PRINT_CHART_HEIGHT = 270;
/** 打印锁定字体栈：Word 里回退到宋体会整张图变样，写死中文黑体族。 */
export const PRINT_FONT_FAMILY = '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';

const PALETTE = ['#4e75df', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];

const TYPE_HELP = '默认可用：bar / line / area / scatter / heatmap。点名可用：donut / histogram / boxplot / radar / funnel / waterfall / sankey。';

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

function keysOf(row) {
  return row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : [];
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

function resolveType(raw) {
  if (raw == null || raw === '') return 'bar';
  const key = String(raw).trim().toLowerCase();
  return PLOT_ALIASES[key] || key;
}

function typeError(got) {
  return { ok: false, error: `不支持的图种「${got}」。${TYPE_HELP}` };
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

function inferX(rows, requested) {
  if (requested && rows.some((r) => r[requested] != null)) return requested;
  for (const k of ['x', 'name', 'label', 'date', '日期', 'year', '年', 'month', 'category', 'item', 'stage']) {
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
  for (const k of ['y', 'value', 'units', 'count', '数值', '数量', 'views', 'amount', 'score']) {
    if (rows.some((r) => asNum(r[k]) != null)) return [k];
  }
  const keys = keysOf(rows[0]);
  const nums = keys.filter((k) => rows.some((r) => asNum(r[k]) != null));
  return nums.slice(0, MAX_SERIES);
}

function parseRows(raw) {
  if (!Array.isArray(raw.data) || !raw.data.length) return [];
  const first = raw.data[0];
  if (first && (Array.isArray(first.points) || Array.isArray(first.data)) && (first.name != null || first.points || first.data)) {
    return fromChartSeries(raw.data);
  }
  if (typeof first === 'object' && first && !Array.isArray(first)) {
    return raw.data.slice(0, MAX_ROWS);
  }
  return [];
}

function toLong(rows, xk, yFields, seriesField, { numericX = false } = {}) {
  const out = [];
  const multiY = yFields.length > 1;
  for (const r of rows) {
    const x = numericX ? asNum(r[xk]) : asText(r[xk]);
    if (numericX && x == null) continue;
    if (seriesField && !multiY) {
      const y = asNum(r[yFields[0]]);
      if (y == null) continue;
      out.push({ x, y, series: asText(r[seriesField]) });
      continue;
    }
    for (const yk of yFields.slice(0, MAX_SERIES)) {
      const y = asNum(r[yk]);
      if (y == null) continue;
      out.push({ x, y, series: multiY ? yk : (seriesField ? asText(r[seriesField]) : yk) });
    }
  }
  return out;
}

function seriesCount(data) {
  return unique(data.map((d) => d.series)).filter((s) => s !== '').length;
}

function eventMarks(events) {
  const list = Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [];
  const data = [];
  for (const ev of list) {
    const x = ev && (ev.x ?? ev.date ?? ev.label);
    if (x == null || x === '') continue;
    data.push({ x: asText(x), label: asText(ev.label || ev.name || x) });
  }
  if (!data.length) return [];
  return [{
    type: 'lineX',
    data,
    encode: { x: 'x' },
    style: { stroke: '#92929b', strokeOpacity: 0.9, lineDash: [4, 4], lineWidth: 1 },
    labels: [{
      text: 'label',
      position: 'top',
      dy: 4,
      fontSize: 10,
      fill: '#6b6b73',
      fontFamily: 'inherit',
    }],
  }];
}

function cartesianAxis(nCats, { numericX = false } = {}) {
  const rotate = !numericX && nCats > 10;
  return {
    x: {
      title: false,
      labelFontSize: 10,
      labelAutoRotate: !numericX,
      labelAutoHide: true,
    },
    y: {
      title: false,
      labelFontSize: 10,
      grid: true,
      gridStrokeOpacity: 0.35,
    },
    _labelRotate: rotate,
  };
}

function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(78,117,223,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** G2 面积渐变：沿竖直方向，线附近有色、贴轴近透明。 */
function areaGradient(hex) {
  return `linear-gradient(-90deg, ${hexToRgba(hex, 0.04)} 0%, ${hexToRgba(hex, 0.22)} 42%, ${hexToRgba(hex, 0.52)} 100%)`;
}

function formatTick(n) {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 100) return String(Math.round(n));
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function lastByX(data) {
  const xs = unique(data.map((d) => d.x));
  if (!xs.length) return null;
  const lastX = xs[xs.length - 1];
  for (let i = data.length - 1; i >= 0; i--) {
    if (asText(data[i].x) === asText(lastX)) return data[i];
  }
  return data[data.length - 1] || null;
}

function trendChildren({ data, multi, stack, showPoints }) {
  const encode = { x: 'x', y: 'y' };
  if (multi) encode.color = 'series';
  const transform = stack ? [{ type: 'stackY' }] : undefined;
  const color = PALETTE[0];
  const children = [];
  if (!multi && !stack) {
    children.push({
      type: 'area',
      encode: { x: 'x', y: 'y' },
      style: { fill: areaGradient(color) },
    });
    children.push({
      type: 'line',
      encode: { x: 'x', y: 'y' },
      style: { stroke: color, lineWidth: 2 },
    });
    if (showPoints) {
      children.push({
        type: 'point',
        encode: { x: 'x', y: 'y' },
        style: { fill: color, size: 2.6, lineWidth: 0 },
      });
    }
    const last = lastByX(data);
    if (last && last.y != null) {
      children.push({
        type: 'text',
        data: [{ x: last.x, y: last.y, label: formatTick(last.y) }],
        encode: { x: 'x', y: 'y', text: 'label' },
        style: {
          fill: '#3f3f46',
          fontSize: 10,
          fontWeight: 600,
          dx: 8,
          textAlign: 'left',
          textBaseline: 'middle',
        },
      });
    }
    return children;
  }
  children.push({
    type: 'area',
    encode,
    transform,
    style: { fillOpacity: 0.16 },
    scale: { color: { range: PALETTE } },
  });
  children.push({
    type: 'line',
    encode,
    transform,
    style: { lineWidth: 2 },
    scale: { color: { range: PALETTE } },
  });
  return children;
}

function cartesianSpec({ type, data, stack, events, numericX = false }) {
  const multi = seriesCount(data) > 1;
  const nCats = unique(data.map((d) => d.x)).length;
  const axis = cartesianAxis(nCats, { numericX });
  const rotate = axis._labelRotate;
  delete axis._labelRotate;
  if (type === 'line' || type === 'area') {
    const showPoints = nCats <= 24;
    const padRight = multi ? 16 : 40;
    return {
      type: 'view',
      data,
      padding: rotate ? [multi ? 40 : 16, padRight, 48, 12] : [multi ? 40 : 16, padRight, 28, 12],
      axis,
      legend: multi ? { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 11 } } : false,
      children: [...trendChildren({ data, multi, stack, showPoints }), ...eventMarks(events)],
      interaction: { tooltip: true },
      plotType: type,
      mark: 'line',
    };
  }
  const mark = type === 'bar' ? 'interval' : type === 'scatter' ? 'point' : type;
  const encode = { x: 'x', y: 'y' };
  if (multi) encode.color = 'series';
  const child = {
    type: mark,
    encode,
    scale: { color: { range: PALETTE } },
  };
  if (type === 'bar') {
    child.style = { maxWidth: 36 };
    if (!multi) child.style.fill = PALETTE[0];
    if (stack) child.transform = [{ type: 'stackY' }];
    else if (multi) child.transform = [{ type: 'dodgeX' }];
  } else if (type === 'scatter') {
    child.style = { size: 3 };
    if (!multi) child.style.fill = PALETTE[0];
  }
  return {
    type: 'view',
    data,
    padding: rotate ? [multi ? 40 : 16, 16, 48, 12] : [multi ? 40 : 16, 16, 28, 12],
    axis,
    legend: multi ? { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 11 } } : false,
    children: [child, ...eventMarks(events)],
    interaction: { tooltip: true },
    plotType: type,
    mark,
  };
}

function heatmapSpec(cells) {
  const nCats = unique(cells.map((d) => d.x)).length;
  return {
    type: 'cell',
    data: cells,
    encode: { x: 'x', y: 'y', color: 'value' },
    scale: { color: { range: ['#e8eefc', '#4e75df'] } },
    legend: { color: { position: 'bottom', length: 140, layout: { justifyContent: 'center' } } },
    axis: {
      x: { title: false, labelFontSize: 10, labelAutoRotate: true, labelAutoHide: true },
      y: { title: false, labelFontSize: 10 },
    },
    padding: nCats > 8 ? [8, 16, 48, 48] : [8, 16, 40, 48],
    style: { inset: 1 },
    labels: [{ text: 'label', fontSize: 11 }],
    interaction: { tooltip: true },
    plotType: 'heatmap',
    mark: 'cell',
  };
}

function donutSpec(data) {
  return {
    type: 'interval',
    data,
    encode: { y: 'y', color: 'x' },
    transform: [{ type: 'stackY' }],
    coordinate: { type: 'theta', innerRadius: 0.62 },
    scale: { color: { range: PALETTE } },
    legend: { color: { position: 'right', itemMarkerSize: 8, itemLabelFontSize: 11 } },
    labels: [{ text: 'label', position: 'outside', fontSize: 10 }],
    style: { radius: 4 },
    animate: { enter: { type: 'waveIn', duration: 280 } },
    interaction: { tooltip: true },
    plotType: 'donut',
    mark: 'interval',
  };
}

function histogramSpec(data) {
  return {
    type: 'interval',
    data,
    encode: { x: 'value' },
    transform: [{ type: 'binX', y: 'count' }],
    style: { inset: 0.5, maxWidth: 36, fill: PALETTE[0] },
    axis: {
      x: { title: false, labelFontSize: 10 },
      y: { title: false, labelFontSize: 10, grid: true, gridStrokeOpacity: 0.35 },
    },
    legend: false,
    interaction: { tooltip: true },
    plotType: 'histogram',
    mark: 'interval',
  };
}

function boxplotSpec(data, hasGroup) {
  return {
    type: 'boxplot',
    data,
    encode: hasGroup ? { x: 'x', y: 'y', color: 'x' } : { y: 'y' },
    scale: { color: { range: PALETTE } },
    legend: false,
    axis: {
      x: { title: false, labelFontSize: 10, labelAutoHide: true },
      y: { title: false, labelFontSize: 10, grid: true, gridStrokeOpacity: 0.35 },
    },
    style: { stroke: PALETTE[0], fill: PALETTE[0], fillOpacity: 0.25 },
    interaction: { tooltip: true },
    plotType: 'boxplot',
    mark: 'boxplot',
  };
}

function radarSpec(data) {
  const multi = seriesCount(data) > 1;
  return {
    type: 'view',
    data,
    coordinate: { type: 'polar' },
    scale: {
      x: { padding: 0.5, align: 0 },
      y: { domainMin: 0 },
      color: { range: PALETTE },
    },
    axis: {
      x: { title: false, grid: true, labelFontSize: 10 },
      y: { title: false, gridConnect: 'line', gridStrokeOpacity: 0.35, labelFontSize: 10, zIndex: 1 },
    },
    legend: multi ? { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 11 } } : false,
    children: [
      {
        type: 'area',
        encode: { x: 'x', y: 'y', color: 'series' },
        style: { fillOpacity: 0.12 },
      },
      {
        type: 'line',
        encode: { x: 'x', y: 'y', color: 'series' },
        style: { lineWidth: 2 },
      },
      {
        type: 'point',
        encode: { x: 'x', y: 'y', color: 'series' },
        style: { size: 2.5 },
      },
    ],
    interaction: { tooltip: true },
    plotType: 'radar',
    mark: 'line',
  };
}

function funnelSpec(data) {
  return {
    type: 'interval',
    data,
    encode: { x: 'x', y: 'y', color: 'x', shape: 'funnel' },
    transform: [{ type: 'symmetryY' }],
    coordinate: { transform: [{ type: 'transpose' }] },
    scale: { x: { padding: 0 }, color: { range: PALETTE } },
    axis: false,
    legend: false,
    labels: [{ text: 'label', position: 'inside', fontSize: 11, fill: '#fff' }],
    interaction: { tooltip: true },
    plotType: 'funnel',
    mark: 'interval',
  };
}

function waterfallSpec(data) {
  return {
    type: 'interval',
    data,
    encode: { x: 'x', y: ['start', 'end'], color: 'kind' },
    scale: {
      color: {
        domain: ['up', 'down', 'total'],
        range: ['#0d9488', '#dc2626', '#4e75df'],
      },
    },
    legend: { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 11 } },
    axis: {
      x: { title: false, labelFontSize: 10, labelAutoRotate: true, labelAutoHide: true },
      y: { title: false, labelFontSize: 10, grid: true, gridStrokeOpacity: 0.35 },
    },
    style: { maxWidth: 36 },
    labels: [{ text: 'label', position: 'top', fontSize: 10, dy: -4 }],
    interaction: { tooltip: true },
    plotType: 'waterfall',
    mark: 'interval',
  };
}

function sankeySpec(links) {
  return {
    type: 'sankey',
    layout: { nodeAlign: 'justify', nodePadding: 0.03 },
    data: { type: 'inline', value: { links } },
    scale: { color: { range: PALETTE } },
    style: {
      labelFontSize: 10,
      nodeWidth: 0.02,
      nodeStrokeWidth: 1,
      linkFillOpacity: 0.4,
      labelSpacing: 4,
    },
    interaction: { tooltip: true },
    plotType: 'sankey',
    mark: 'sankey',
  };
}

function inferLinkField(rows, requested, names) {
  if (requested && rows.some((r) => r[requested] != null && r[requested] !== '')) return requested;
  for (const k of names) {
    if (rows.some((r) => r[k] != null && r[k] !== '')) return k;
  }
  return '';
}

function waterfallRows(rows, xk, yk) {
  const out = [];
  let acc = 0;
  for (const r of rows) {
    const x = asText(r[xk]);
    const v = asNum(r[yk]);
    if (v == null) continue;
    const isTotal = r.total === true || r.isTotal === true || /合计|总计|total/i.test(x);
    if (isTotal) {
      out.push({ x, start: 0, end: acc, kind: 'total', label: String(acc) });
    } else {
      const start = acc;
      const end = acc + v;
      out.push({
        x,
        start,
        end,
        kind: v >= 0 ? 'up' : 'down',
        label: (v > 0 ? '+' : '') + String(v),
      });
      acc = end;
    }
  }
  return out;
}

function radarFromWide(rows, raw) {
  const metrics = Array.isArray(raw.y) ? raw.y.map(String) : [];
  const usable = metrics.filter((k) => rows.some((r) => asNum(r[k]) != null));
  if (usable.length < 3) return null;
  const nameK = raw.series && rows.some((r) => r[raw.series] != null)
    ? String(raw.series)
    : (rows.some((r) => r.name != null) ? 'name' : inferX(rows, raw.x));
  const out = [];
  for (const r of rows.slice(0, MAX_SERIES)) {
    const series = asText(r[nameK] || '系列');
    for (const m of usable) {
      const y = asNum(r[m]);
      if (y == null) continue;
      out.push({ x: m, y, series });
    }
  }
  return out.length ? out : null;
}

function finishChart(chart, mode) {
  return mode === 'print' ? { ...chart, option: printLockOption(chart.option) } : chart;
}

/**
 * 打印锁定：白底 + 墨色文字 + 固定字号 + 关动画/tooltip。
 * 图会从 480 逻辑 px 缩到 560px 印在纸上，字号必须同步放大才不会印糊。
 */
export function printLockOption(option) {
  const opt = JSON.parse(JSON.stringify(option || {}));
  const ink = '#18181b';
  const muted = '#52525b';
  const grid = 'rgba(0,0,0,0.10)';
  opt.animate = false;
  opt.animation = false;
  opt.backgroundColor = '#ffffff';
  opt.interaction = { ...(opt.interaction && typeof opt.interaction === 'object' ? opt.interaction : {}), tooltip: false };
  opt.tooltip = { show: false };
  opt.textStyle = { color: ink, fontFamily: PRINT_FONT_FAMILY };
  opt.theme = {
    ...(opt.theme && typeof opt.theme === 'object' ? opt.theme : {}),
    type: 'classic',
    view: {
      ...((opt.theme && opt.theme.view) || {}),
      viewFill: '#ffffff',
    },
  };
  const axisPrint = (axis) => {
    if (!axis || axis === false || typeof axis !== 'object') return axis;
    const paint = (side) => {
      if (!side || side === false || typeof side !== 'object') return side;
      return {
        ...side,
        labelFontSize: 11,
        labelFill: muted,
        labelFontFamily: PRINT_FONT_FAMILY,
        titleFontFamily: PRINT_FONT_FAMILY,
        gridStroke: grid,
        lineStroke: 'rgba(0,0,0,0.12)',
      };
    };
    return { ...axis, x: paint(axis.x), y: paint(axis.y) };
  };
  if (opt.axis) opt.axis = axisPrint(opt.axis);
  if (Array.isArray(opt.children)) {
    opt.children = opt.children.map((c) => (c && c.axis ? { ...c, axis: axisPrint(c.axis) } : c));
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
  const requested = raw.type;
  const type = resolveType(requested);
  if (!PLOT_TYPES.includes(type)) return typeError(requested);
  const title = asText(raw.title || '').slice(0, 80);
  const rows = parseRows(raw);
  if (!rows.length) return { ok: false, error: 'data 需要对象数组，或图表序列 [{name, points:[[x,y]]}]。' };

  const pack = (plotType, option, n) => ({
    ok: true,
    chart: finishChart({
      id: newId(),
      title: title || '图表',
      type: plotType,
      rows: n,
      option,
    }, opts.mode),
  });

  if (type === 'sankey') {
    const sk = inferLinkField(rows, raw.source_field, ['source', 'from', 'src']);
    const tk = inferLinkField(rows, raw.target_field, ['target', 'to', 'dst']);
    const vk = inferY(rows, raw.value || raw.y)[0] || '';
    if (!sk || !tk || !vk) {
      return { ok: false, error: '桑基图需要 source、target、value 三列（或传 source / target / value 字段名）。' };
    }
    const links = [];
    for (const r of rows) {
      const source = asText(r[sk]);
      const target = asText(r[tk]);
      const value = asNum(r[vk]);
      if (!source || !target || value == null) continue;
      links.push({ source, target, value });
    }
    if (!links.length) return { ok: false, error: '桑基图没有可画的边。' };
    return pack('sankey', sankeySpec(links), links.length);
  }

  if (type === 'donut') {
    const xk = inferX(rows, raw.x);
    const yk = inferY(rows, raw.y)[0];
    if (!yk) return { ok: false, error: '环形图需要数值列。请传 y。' };
    const agg = new Map();
    for (const r of rows) {
      const name = asText(r[xk]) || '未命名';
      const v = asNum(r[yk]);
      if (v == null) continue;
      agg.set(name, (agg.get(name) || 0) + v);
    }
    const items = [...agg.entries()].sort((a, b) => b[1] - a[1]);
    if (!items.length) return { ok: false, error: '环形图没有可画的数据。' };
    if (items.length > MAX_DONUT_CATS) {
      return { ok: false, error: `环形图最多 ${MAX_DONUT_CATS} 类，当前 ${items.length} 类。请改用 bar。` };
    }
    const data = items.map(([x, y]) => ({ x, y, label: `${x} ${y}` }));
    return pack('donut', donutSpec(data), data.length);
  }

  if (type === 'histogram') {
    const yk = inferY(rows, raw.y || raw.value)[0];
    if (!yk) return { ok: false, error: '直方图需要一列数值。请传 y。' };
    const data = rows.map((r) => ({ value: asNum(r[yk]) })).filter((d) => d.value != null);
    if (data.length < 2) return { ok: false, error: '直方图至少需要 2 个数值。' };
    return pack('histogram', histogramSpec(data), data.length);
  }

  if (type === 'boxplot') {
    const yk = inferY(rows, raw.y || raw.value)[0];
    if (!yk) return { ok: false, error: '箱线图需要数值列。请传 y。' };
    const groupK = raw.series && rows.some((r) => r[raw.series] != null)
      ? String(raw.series)
      : (raw.x && rows.some((r) => r[raw.x] != null && asNum(r[raw.x]) == null) ? String(raw.x) : '');
    const data = [];
    for (const r of rows) {
      const y = asNum(r[yk]);
      if (y == null) continue;
      data.push({ x: groupK ? asText(r[groupK]) : '', y });
    }
    if (data.length < 3) return { ok: false, error: '箱线图至少需要 3 个数值。' };
    return pack('boxplot', boxplotSpec(data, !!groupK), data.length);
  }

  if (type === 'radar') {
    const folded = radarFromWide(rows, raw);
    let data = folded;
    if (!data) {
      const xk = inferX(rows, raw.x);
      const yFields = inferY(rows, Array.isArray(raw.y) ? undefined : raw.y);
      if (!yFields.length) return { ok: false, error: '雷达图需要数值列。请传 y。' };
      const seriesField = raw.series && rows.some((r) => r[raw.series] != null) ? String(raw.series) : '';
      data = toLong(rows, xk, yFields.slice(0, 1), seriesField);
    }
    if (unique(data.map((d) => d.x)).length < 3) {
      return { ok: false, error: '雷达图至少需要 3 个轴（类别）。数据对不上请改用 bar。' };
    }
    return pack('radar', radarSpec(data), data.length);
  }

  if (type === 'funnel') {
    const xk = inferX(rows, raw.x);
    const yk = inferY(rows, raw.y)[0];
    if (!yk) return { ok: false, error: '漏斗图需要类别列和数值列。' };
    const data = [];
    for (const r of rows) {
      const y = asNum(r[yk]);
      if (y == null) continue;
      const x = asText(r[xk]);
      data.push({ x, y, label: `${x} ${y}` });
    }
    if (data.length < 2) return { ok: false, error: '漏斗图至少需要 2 个阶段。' };
    return pack('funnel', funnelSpec(data), data.length);
  }

  if (type === 'waterfall') {
    const xk = inferX(rows, raw.x);
    const yk = inferY(rows, raw.y)[0];
    if (!yk) return { ok: false, error: '瀑布图需要类别列和增减值。请传 x / y。' };
    const data = waterfallRows(rows, xk, yk);
    if (!data.length) return { ok: false, error: '瀑布图没有可画的数据。' };
    return pack('waterfall', waterfallSpec(data), data.length);
  }

  if (type === 'heatmap') {
    const xk = inferX(rows, raw.x);
    const yk = String(raw.y || raw.series || 'y');
    const vk = String(raw.value || raw.v || 'value');
    const yField = rows.some((r) => r[yk] != null) ? yk : inferX(rows, 'y');
    const vField = rows.some((r) => asNum(r[vk]) != null) ? vk : (inferY(rows, raw.y)[0] || 'value');
    const cells = [];
    for (const r of rows) {
      const n = asNum(r[vField]);
      if (n == null) continue;
      cells.push({
        x: asText(r[xk]),
        y: asText(r[yField]),
        value: n,
        label: n ? String(n) : '',
      });
    }
    if (!cells.length) return { ok: false, error: '热力图需要可解析的数值列（value）。' };
    return pack('heatmap', heatmapSpec(cells), cells.length);
  }

  const xk = inferX(rows, raw.x);
  const yFields = inferY(rows, raw.y);
  if (!yFields.length) return { ok: false, error: '找不到数值列。请传 y（字段名）或确保 data 里有数字。' };
  const seriesField = raw.series && rows.some((r) => r[raw.series] != null) ? String(raw.series) : '';
  const numericX = type === 'scatter';
  const data = toLong(rows, xk, numericX ? yFields.slice(0, 1) : yFields, seriesField, { numericX });
  if (!data.length) return { ok: false, error: '没有可画的数据点。' };
  const stack = raw.stack === true || raw.stack === 'true';
  return pack(type, cartesianSpec({ type, data, stack, events: raw.events, numericX }), data.length);
}
