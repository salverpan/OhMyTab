/**
 * 项目概览的统计口径与 G2 spec 构造。纯函数、无 DOM，可在 node 下冒烟。
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
    const n = row.note;
    if (!n) continue; // 研究 artifact 只计「近 14 天新增」，不进状态 / 校准矩阵
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

export function activityOption(stats) {
  const a = stats.activity;
  const data = [];
  for (let i = 0; i < a.labels.length; i++) {
    data.push({ day: a.labels[i], kind: '来源', count: a.sources[i] });
    data.push({ day: a.labels[i], kind: '笔记', count: a.notes[i] });
    data.push({ day: a.labels[i], kind: '产出', count: a.outputs[i] });
  }
  return {
    type: 'interval',
    data,
    encode: { x: 'day', y: 'count', color: 'kind' },
    transform: [{ type: 'stackY' }],
    scale: {
      color: {
        domain: ['来源', '笔记', '产出'],
        range: [TRUNK_COLOR.sources, TRUNK_COLOR.notes, TRUNK_COLOR.outputs],
      },
    },
    axis: {
      x: { title: false, labelFontSize: 10, labelAutoHide: true, tick: false, grid: false, line: false },
      y: { title: false, label: false, tick: false, grid: false, line: false },
    },
    legend: { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 10 } },
    style: { maxWidth: 16 },
    animate: false,
    plotType: 'bar',
  };
}

export function statusOption(stats) {
  const data = NOTE_STATUS_ORDER.map((s) => ({
    row: '笔记',
    status: NOTE_STATUS_LABEL[s],
    count: stats.noteStatus[s],
    label: stats.noteStatus[s] > 0 ? String(stats.noteStatus[s]) : '',
  }));
  return {
    type: 'interval',
    coordinate: { transform: [{ type: 'transpose' }] },
    data,
    encode: { x: 'row', y: 'count', color: 'status' },
    transform: [{ type: 'stackY' }],
    scale: {
      color: {
        domain: NOTE_STATUS_ORDER.map((s) => NOTE_STATUS_LABEL[s]),
        range: NOTE_STATUS_ORDER.map((s) => STATUS_COLOR[s]),
      },
    },
    axis: false,
    legend: { color: { position: 'top', itemMarkerSize: 8, itemLabelFontSize: 10 } },
    labels: [{ text: 'label', fill: '#fff', fontSize: 10, position: 'inside' }],
    animate: false,
    plotType: 'bar',
  };
}

export function calibrationOption(stats) {
  const data = [];
  stats.calibration.forEach((row, yi) => {
    row.forEach((v, xi) => {
      data.push({
        status: NOTE_STATUS_LABEL[NOTE_STATUS_ORDER[xi]],
        conf: `置信${CONFIDENCE_LABEL[CONFIDENCE_ORDER[yi]]}`,
        count: v,
        label: v ? String(v) : '',
      });
    });
  });
  return {
    type: 'cell',
    data,
    encode: { x: 'status', y: 'conf', color: 'count' },
    scale: {
      y: { domain: ['置信高', '置信中', '置信低'] },
      color: { range: ['rgba(99,102,241,0.06)', 'rgba(99,102,241,0.85)'] },
    },
    legend: false,
    axis: {
      x: { title: false, labelFontSize: 10 },
      y: { title: false, labelFontSize: 10 },
    },
    style: { inset: 1 },
    labels: [{ text: 'label', fontSize: 11 }],
    animate: false,
    plotType: 'heatmap',
  };
}

export function sourceMixOption(stats) {
  const data = (stats.sourceMix || []).map((i) => ({ name: i.name, count: i.count }));
  return {
    type: 'interval',
    coordinate: { transform: [{ type: 'transpose' }] },
    data,
    encode: { x: 'name', y: 'count' },
    axis: {
      y: false,
      x: { title: false, labelFontSize: 10 },
    },
    legend: false,
    labels: [{ text: 'count', position: 'right', dx: 4, fontSize: 10 }],
    style: { fill: TRUNK_COLOR.sources, maxWidth: 12 },
    animate: false,
    plotType: 'bar',
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
