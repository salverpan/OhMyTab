import assert from 'node:assert/strict';
import { buildPlotOption } from '../src/lib/plot-spec.js';

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
ok(bar.ok && bar.chart.option.series[0].type === 'bar', '柱状图');
ok(bar.chart.option.xAxis.data.join(',') === '2023,2024,2025', '类目轴');
ok(bar.chart.option.title && bar.chart.option.title.show === false, '图内标题关闭（只留气泡标题）');
ok(bar.chart.option.xAxis.axisLabel.hideOverlap === true, '类目轴防重叠');
ok(bar.chart.option.tooltip.transitionDuration === 0 && bar.chart.option.tooltip.enterable === false, 'tooltip 钉住数值、不跟鼠标滑');
ok(bar.chart.option.tooltip.axisPointer && bar.chart.option.tooltip.axisPointer.snap === true, '轴指示吸附类目');

const dense = buildPlotOption({
  type: 'bar',
  data: Array.from({ length: 14 }, (_, i) => ({ year: `202${i} extra`, units: i })),
  x: 'year',
  y: 'units',
});
ok(dense.ok && dense.chart.option.xAxis.axisLabel.rotate > 0, '类目多则旋转标签');
ok(dense.chart.option.grid.bottom >= 50, '旋转后留足底部');

const line = buildPlotOption({
  type: 'line',
  data: [{ name: 'A', points: [['1月', 1], ['2月', 3], ['3月', 2]] }],
  events: [{ x: '2月', label: '制裁' }],
});
ok(line.ok && line.chart.option.series[0].type === 'line', '序列 points → 折线');
ok(line.chart.option.series[0].markLine.data[0].xAxis === '2月', '事件标线');

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
ok(grouped.ok && grouped.chart.option.series.length === 2, '分组柱');

const heat = buildPlotOption({
  type: 'heatmap',
  data: [
    { x: 'A', y: '1', value: 1 },
    { x: 'B', y: '1', value: 4 },
    { x: 'A', y: '2', value: 2 },
  ],
});
ok(heat.ok && heat.chart.option.series[0].type === 'heatmap', '热力图');

const empty = buildPlotOption({ data: [] });
ok(!empty.ok, '空 data 失败');

const noNum = buildPlotOption({ data: [{ name: 'a', label: 'b' }] });
ok(!noNum.ok, '无数值列失败');

console.log(`plot-spec-smoke: ${passed} passed`);
