/**
 * 项目概览的统计口径与 ECharts option 构造。纯函数、无 DOM，可在 node 下冒烟。
 * 行（row）结构沿用 workspace-view 的 sources / notes / outputs。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const NOTE_STATUS_ORDER = ['open', 'verified', 'refuted', 'dropped'];
export const NOTE_STATUS_LABEL = {
  open: '待核实',
  verified: '已核实',
  refuted: '被推翻',
  dropped: '已弃用',
};
export const CONFIDENCE_ORDER = ['high', 'medium', 'low'];
export const CONFIDENCE_LABEL = { high: '高', medium: '中', low: '低' };

const STATUS_COLOR = {
  open: '#f59e0b',
  verified: '#16a34a',
  refuted: '#dc2626',
  dropped: '#a1a1aa',
};

const TRUNK_COLOR = {
  sources: '#6366f1',
  notes: '#0ea5e9',
  outputs: '#14b8a6',
};

export function toMillis(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

function rowTime(row) {
  return toMillis(row?.note?.createdAt)
    || toMillis(row?.entry?.createdAt)
    || toMillis(row?.entry?.publishedAt)
    || toMillis(row?.updatedAt);
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(ts) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @param {{sources?: Array, notes?: Array, outputs?: Array}} groups
 * @param {{days?: number, now?: number}} [opts]
 */
export function computeOverviewStats(groups, { days = 14, now = Date.now() } = {}) {
  const sources = groups?.sources || [];
  const notes = groups?.notes || [];
  const outputs = groups?.outputs || [];

  const today = startOfDay(now);
  const first = today - (days - 1) * DAY_MS;
  const labels = [];
  for (let i = 0; i < days; i++) labels.push(dayLabel(first + i * DAY_MS));
  const activity = {
    labels,
    sources: new Array(days).fill(0),
    notes: new Array(days).fill(0),
    outputs: new Array(days).fill(0),
  };
  const bump = (list, key) => {
    for (const row of list) {
      const ts = rowTime(row);
      if (!ts) continue;
      const idx = Math.floor((startOfDay(ts) - first) / DAY_MS);
      if (idx >= 0 && idx < days) activity[key][idx] += 1;
    }
  };
  bump(sources, 'sources');
  bump(notes, 'notes');
  bump(outputs, 'outputs');
  const activityTotal = [...activity.sources, ...activity.notes, ...activity.outputs]
    .reduce((a, b) => a + b, 0);

  const noteStatus = Object.fromEntries(NOTE_STATUS_ORDER.map((s) => [s, 0]));
  const calibration = CONFIDENCE_ORDER.map(() => NOTE_STATUS_ORDER.map(() => 0));
  let judgedTotal = 0;
  for (const row of notes) {
    const n = row.note || row;
    if (n.kind === 'observation') continue; // 观测只是数据点，不参与状态 / 校准统计
    judgedTotal += 1;
    const status = NOTE_STATUS_ORDER.includes(n.status) ? n.status : 'open';
    const conf = CONFIDENCE_ORDER.includes(n.confidence) ? n.confidence : 'medium';
    noteStatus[status] += 1;
    calibration[CONFIDENCE_ORDER.indexOf(conf)][NOTE_STATUS_ORDER.indexOf(status)] += 1;
  }

  const mixMap = new Map();
  for (const row of sources) {
    const name = row.badge || '采集';
    mixMap.set(name, (mixMap.get(name) || 0) + 1);
  }
  const sourceMix = [...mixMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    activity,
    activityTotal,
    noteStatus,
    noteTotal: judgedTotal,
    calibration,
    sourceMix,
  };
}

const AXIS_TEXT = { fontSize: 10 };

export function activityOption(stats) {
  const a = stats.activity;
  const series = [
    ['sources', '来源'],
    ['notes', '笔记'],
    ['outputs', '产出'],
  ].map(([key, name]) => ({
    name,
    type: 'bar',
    stack: 'total',
    barMaxWidth: 16,
    itemStyle: { color: TRUNK_COLOR[key] },
    data: a[key],
  }));
  return {
    animation: false,
    grid: { left: 28, right: 8, top: 26, bottom: 20 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 8, textStyle: AXIS_TEXT },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: a.labels,
      axisLabel: { ...AXIS_TEXT, interval: 'auto' },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: AXIS_TEXT,
      splitLine: { lineStyle: { opacity: 0.35 } },
    },
    series,
  };
}

export function statusOption(stats) {
  const series = NOTE_STATUS_ORDER.map((s) => ({
    name: NOTE_STATUS_LABEL[s],
    type: 'bar',
    stack: 'status',
    itemStyle: { color: STATUS_COLOR[s] },
    label: { show: stats.noteStatus[s] > 0, color: '#fff', fontSize: 10, formatter: '{c}' },
    data: [stats.noteStatus[s]],
  }));
  return {
    animation: false,
    grid: { left: 6, right: 6, top: 26, bottom: 4 },
    legend: { top: 0, itemWidth: 10, itemHeight: 8, textStyle: AXIS_TEXT },
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', show: false, max: Math.max(1, stats.noteTotal) },
    yAxis: { type: 'category', show: false, data: ['笔记'] },
    series,
  };
}

export function calibrationOption(stats) {
  const data = [];
  let max = 1;
  stats.calibration.forEach((row, y) => {
    row.forEach((v, x) => {
      data.push([x, y, v]);
      if (v > max) max = v;
    });
  });
  return {
    animation: false,
    grid: { left: 34, right: 8, top: 6, bottom: 22 },
    tooltip: {
      formatter: (p) => {
        const [x, y, v] = p.data;
        return `置信度 ${CONFIDENCE_LABEL[CONFIDENCE_ORDER[y]]} · ${NOTE_STATUS_LABEL[NOTE_STATUS_ORDER[x]]}：${v} 条`;
      },
    },
    xAxis: {
      type: 'category',
      data: NOTE_STATUS_ORDER.map((s) => NOTE_STATUS_LABEL[s]),
      axisLabel: AXIS_TEXT,
      axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: CONFIDENCE_ORDER.map((c) => `置信${CONFIDENCE_LABEL[c]}`),
      axisLabel: AXIS_TEXT,
      axisTick: { show: false },
      inverse: true,
    },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: ['rgba(99,102,241,0.06)', 'rgba(99,102,241,0.85)'] },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, fontSize: 11, formatter: (p) => (p.data[2] ? String(p.data[2]) : '') },
      itemStyle: { borderColor: 'rgba(128,128,128,0.25)', borderWidth: 1, borderRadius: 3 },
    }],
  };
}

export function sourceMixOption(stats) {
  const items = stats.sourceMix;
  return {
    animation: false,
    grid: { left: 52, right: 24, top: 4, bottom: 4 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', show: false, minInterval: 1 },
    yAxis: {
      type: 'category',
      inverse: true,
      data: items.map((i) => i.name),
      axisLabel: AXIS_TEXT,
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 12,
      itemStyle: { color: TRUNK_COLOR.sources, borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: 'right', fontSize: 10 },
      data: items.map((i) => i.count),
    }],
  };
}

/** 源数据决定显示哪些图；返回 [{id,title,hint,option,height}]。 */
export function buildOverviewCharts(stats) {
  const charts = [];
  if (stats.activityTotal > 0) {
    charts.push({ id: 'activity', title: '近 14 天新增', option: activityOption(stats), height: 150 });
  }
  if (stats.noteTotal > 0) {
    charts.push({ id: 'status', title: '笔记状态', option: statusOption(stats), height: 70 });
    charts.push({
      id: 'calibration',
      title: '置信度 × 状态',
      hint: '高置信度的笔记若常被推翻，说明判断偏乐观',
      option: calibrationOption(stats),
      height: 110,
    });
  }
  if (stats.sourceMix.length) {
    charts.push({
      id: 'sourceMix',
      title: '来源构成',
      option: sourceMixOption(stats),
      height: Math.max(56, stats.sourceMix.length * 22 + 8),
    });
  }
  return charts;
}
