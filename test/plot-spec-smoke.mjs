import assert from 'node:assert/strict';
import { buildPlotOption, printLockOption, PLOT_TYPES } from '../src/lib/plot-spec.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const bar = buildPlotOption({
  title: '交付量',
  type: 'bar',
  data: [
    { year: '2023', units: 120 },
    { year: '2024', units: 180 },
    { year: '2025', units: 150 },
  ],
  x: 'year',
  y: 'units',
});
ok(bar.ok && bar.chart.option.plotType === 'bar', '柱状图');
ok(bar.chart.option.children[0].type === 'interval', '柱状图 mark=interval');
ok(bar.chart.option.data.map((d) => d.x).join(',') === '2023,2024,2025', '类目轴');
ok(bar.chart.option.type === 'view', '笛卡尔图包在 view 里');
ok(bar.chart.option.axis.x.labelAutoHide === true, '类目轴防重叠');
ok(bar.chart.option.interaction.tooltip === true, '聊天模式开 tooltip');

const dense = buildPlotOption({
  type: 'bar',
  data: Array.from({ length: 14 }, (_, i) => ({ year: `202${i} extra`, units: i })),
  x: 'year',
  y: 'units',
});
ok(dense.ok && Array.isArray(dense.chart.option.padding) && dense.chart.option.padding[2] >= 40, '类目多则加大底部');

const line = buildPlotOption({
  type: 'line',
  data: [{ name: 'A', points: [['1月', 1], ['2月', 3], ['3月', 2]] }],
  events: [{ x: '2月', label: '制裁' }],
});
ok(line.ok && line.chart.option.children[0].type === 'area', '单序列折线带面积');
ok(/linear-gradient/.test(line.chart.option.children[0].style.fill), '面积用竖直渐变填充');
ok(line.chart.option.children.some((c) => c.type === 'line'), '面积上叠折线');
ok(line.chart.option.children.some((c) => c.type === 'text' && c.data[0].label === '2'), '末值标注');
ok(line.chart.option.children.some((c) => c.type === 'lineX' && c.data[0].x === '2月'), '事件标线');

const multiLine = buildPlotOption({
  type: 'line',
  data: [
    { month: '1月', a: 1, b: 2 },
    { month: '2月', a: 3, b: 1 },
  ],
  x: 'month',
  y: ['a', 'b'],
});
ok(multiLine.ok && multiLine.chart.option.children[0].type === 'area', '多序列也是面积折线');
ok(multiLine.chart.option.children[0].style.fillOpacity === 0.16, '多序列用半透明色带，不用渐变');
ok(!multiLine.chart.option.children.some((c) => c.type === 'text'), '多序列不加末值，避免挤');

const grouped = buildPlotOption({
  type: 'bar',
  data: [
    { day: '周一', site: '甲', n: 10 },
    { day: '周一', site: '乙', n: 4 },
    { day: '周二', site: '甲', n: 8 },
    { day: '周二', site: '乙', n: 6 },
  ],
  x: 'day',
  y: 'n',
  series: 'site',
});
ok(grouped.ok && grouped.chart.option.children[0].encode.color === 'series', '分组柱');
ok(grouped.chart.option.children[0].transform[0].type === 'dodgeX', '分组并排');

const stacked = buildPlotOption({
  type: 'bar',
  stack: true,
  data: [
    { day: '周一', site: '甲', n: 10 },
    { day: '周一', site: '乙', n: 4 },
  ],
  x: 'day',
  y: 'n',
  series: 'site',
});
ok(stacked.ok && stacked.chart.option.children[0].transform[0].type === 'stackY', '堆叠柱');

const heat = buildPlotOption({
  type: 'heatmap',
  data: [
    { x: 'A', y: '1', value: 1 },
    { x: 'B', y: '1', value: 4 },
    { x: 'A', y: '2', value: 2 },
  ],
});
ok(heat.ok && heat.chart.option.type === 'cell', '热力图');

const empty = buildPlotOption({ data: [] });
ok(!empty.ok, '空 data 失败');

const noNum = buildPlotOption({ data: [{ name: 'a', label: 'b' }] });
ok(!noNum.ok, '无数值列失败');

const unknown = buildPlotOption({ type: 'wordcloud', data: [{ name: 'a', n: 1 }] });
ok(!unknown.ok && /不支持的图种/.test(unknown.error), '未知图种失败');

const pieAlias = buildPlotOption({
  type: 'pie',
  data: [
    { name: '甲', n: 10 },
    { name: '乙', n: 6 },
  ],
  x: 'name',
  y: 'n',
});
ok(pieAlias.ok && pieAlias.chart.type === 'donut' && pieAlias.chart.option.coordinate.type === 'theta', 'pie → donut');

const tooMany = buildPlotOption({
  type: 'donut',
  data: Array.from({ length: 8 }, (_, i) => ({ name: '类' + i, n: i + 1 })),
  x: 'name',
  y: 'n',
});
ok(!tooMany.ok && /最多 6 类/.test(tooMany.error), '环形图超过 6 类退回');

const sankey = buildPlotOption({
  type: 'sankey',
  data: [
    { source: 'A', target: 'B', value: 4 },
    { source: 'B', target: 'C', value: 2 },
  ],
});
ok(sankey.ok && sankey.chart.option.type === 'sankey' && sankey.chart.option.data.value.links.length === 2, '桑基图');

const sankeyBad = buildPlotOption({ type: 'sankey', data: [{ name: 'A', n: 1 }] });
ok(!sankeyBad.ok && /source/.test(sankeyBad.error), '桑基缺边失败');

const hist = buildPlotOption({
  type: 'histogram',
  data: [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 8 }],
  y: 'v',
});
ok(hist.ok && hist.chart.option.transform[0].type === 'binX', '直方图');

const box = buildPlotOption({
  type: 'boxplot',
  data: [
    { g: '甲', v: 1 }, { g: '甲', v: 2 }, { g: '甲', v: 9 },
    { g: '乙', v: 3 }, { g: '乙', v: 4 }, { g: '乙', v: 5 },
  ],
  x: 'g',
  y: 'v',
});
ok(box.ok && box.chart.option.type === 'boxplot', '箱线图');

const funnel = buildPlotOption({
  type: 'funnel',
  data: [{ stage: '浏览', n: 100 }, { stage: '下单', n: 40 }],
  x: 'stage',
  y: 'n',
});
ok(funnel.ok && funnel.chart.option.encode.shape === 'funnel', '漏斗图');

const waterfall = buildPlotOption({
  type: 'waterfall',
  data: [{ step: '初值', n: 10 }, { step: '增量', n: 4 }, { step: '合计', n: 0 }],
  x: 'step',
  y: 'n',
});
ok(waterfall.ok && waterfall.chart.option.encode.y[0] === 'start', '瀑布图');

const radar = buildPlotOption({
  type: 'radar',
  data: [
    { name: '甲', 攻: 8, 防: 4, 速: 6 },
    { name: '乙', 攻: 5, 防: 7, 速: 3 },
  ],
  y: ['攻', '防', '速'],
  series: 'name',
});
ok(radar.ok && radar.chart.option.coordinate.type === 'polar', '雷达图（宽表）');

ok(PLOT_TYPES.includes('sankey') && PLOT_TYPES.includes('bar'), '图种表包含默认与点名');

const print = printLockOption(bar.chart.option);
ok(print.animate === false && print.theme.view.viewFill === '#ffffff', '打印锁定白底止动画');
ok(bar.chart.option.animate !== false, 'printLockOption 不改原 option');

console.log(`plot-spec-smoke: ${passed} passed`);
