/**
 * 任务追踪思维导图的 React Flow 画布（懒加载分块）。
 *
 * 只由 trace-graph.js 动态 import；React Flow / dagre / React 都不进侧栏首屏。
 * 不写 JSX（项目里没有 JSX 转译配置，和 panel.js 里的 React 用法一致用 createElement）。
 */

import { createElement as h, Fragment, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, useReactFlow,
} from '@xyflow/react';
import flowCss from '@xyflow/react/dist/style.css?inline';
import { layoutGraph, sizeOf } from '../lib/trace-layout.js';
import { shortTitle, focusNodeIds } from '../lib/trace-model.js';

// 默认视图只框“最新回合”，且不缩到小于这个比例，否则整图一起缩会看不清字。
const LATEST_MIN_ZOOM = 0.6;

const STYLE_ID = 'trace-flow-base-css';
function injectBaseCss() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = flowCss;
  document.head.appendChild(el);
}

const KIND_LABEL = {
  root: '项目', thread: '线程', turn: '输入', agent: '回复', subagent: '子代理',
  claim: '断言', unresolved: '待解', action: '操作', judgment: '判断', observation: '观测',
};
const TURN_LABEL = { user: '用户输入', heartbeat: '心跳运行', followup: '子代理回报' };
const STATUS_LABEL = {
  open: '待核实', verified: '已核实', refuted: '被推翻', dropped: '已弃用',
  running: '进行中', completed: '完成', incomplete: '未提交', error: '失败', aborted: '已中断', ok: '',
  paused: '已暂停',
  'cross-source-pass': '多源通过', 'entailment-pass': '蕴含通过', 'citation-pass': '引文通过',
  'citation-fail': '引文失败', overclaim: '过度断言', 'source-conflict': '来源冲突', 'source-unverified': '未核验',
};

/** 状态归入 4 个色调，配色由 CSS 决定：good / warn / bad / info / idle */
function toneOf(node) {
  const s = node.status;
  if (['verified', 'completed', 'cross-source-pass', 'entailment-pass', 'citation-pass'].includes(s)) return 'good';
  if (['open', 'running', 'source-unverified', 'incomplete'].includes(s)) return 'warn';
  if (['refuted', 'error', 'citation-fail', 'overclaim', 'source-conflict', 'aborted'].includes(s)) return 'bad';
  if (node.kind === 'observation') return 'info';
  return 'idle';
}

function kindText(node) {
  if (node.kind === 'turn') return TURN_LABEL[node.subtype] || KIND_LABEL.turn;
  if (node.kind === 'subagent' && node.subtype) return `子代理 · ${node.subtype}`;
  return KIND_LABEL[node.kind] || node.kind;
}

function TraceNode({ data }) {
  const { node, selected, onToggle } = data;
  const tone = toneOf(node);
  const status = STATUS_LABEL[node.status] ?? node.status;
  const size = sizeOf(node);
  const cls = ['tf-node', `tf-kind-${node.kind}`, `tf-tone-${tone}`];
  if (selected) cls.push('is-selected');
  if (node.meta && node.meta.overdue) cls.push('is-overdue');
  if (node.kind === 'judgment' && node.status === 'refuted') cls.push('is-struck');
  return h('div', { className: cls.join(' '), style: { width: size.w, minHeight: size.h } },
    h(Handle, { type: 'target', position: Position.Left, isConnectable: false, className: 'tf-handle' }),
    h('div', { className: 'tf-head' },
      h('span', { className: 'tf-kind' }, kindText(node)),
      status ? h('span', { className: 'tf-status' }, status) : null,
      node.collapsible ? h('button', {
        type: 'button',
        className: 'tf-toggle nodrag nopan',
        title: node.collapsed ? '展开分支' : '折叠分支',
        'aria-label': node.collapsed ? `展开 ${node.hiddenCount} 个子节点` : '折叠分支',
        onClick: (e) => { e.stopPropagation(); onToggle(node.id, !node.collapsed); },
      }, node.collapsed ? `+${node.hiddenCount}` : '−') : null),
    node.title ? h('div', { className: 'tf-title' }, shortTitle(node, 70)) : null,
    h(Handle, { type: 'source', position: Position.Right, isConnectable: false, className: 'tf-handle' }));
}

function ReviseEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35,
  });
  return h(Fragment, null,
    h(BaseEdge, { id, path, markerEnd, className: 'tf-edge-revise' }),
    h(EdgeLabelRenderer, null,
      h('div', {
        className: 'tf-edge-label nodrag nopan',
        style: { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` },
      }, (data && data.label) || '修正')));
}

const nodeTypes = { trace: TraceNode };
const edgeTypes = { revise: ReviseEdge };

function Flow({ graph, layout, selectedId, showMiniMap, fitReq, onSelect, onToggle }) {
  const rf = useReactFlow();
  const pos = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const nodes = useMemo(() => graph.nodes.map((n) => {
    const p = pos.get(n.id) || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'trace',
      position: { x: p.x, y: p.y },
      data: { node: n, selected: n.id === selectedId, onToggle },
      draggable: false,
      connectable: false,
    };
  }), [graph, pos, selectedId, onToggle]);
  const edges = useMemo(() => graph.edges.map((e) => (e.type === 'revise'
    ? {
      id: e.id, source: e.source, target: e.target, type: 'revise', data: { label: e.label },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#dc2626' },
    }
    : { id: e.id, source: e.source, target: e.target, type: 'default', className: 'tf-edge-tree' })), [graph]);

  const focus = useMemo(() => focusNodeIds(graph).map((id) => ({ id })), [graph]);
  useEffect(() => {
    if (fitReq.n === 0) return;
    if (fitReq.mode === 'all') rf.fitView({ padding: 0.12, duration: 240 });
    else rf.fitView({ nodes: focus, padding: 0.1, minZoom: LATEST_MIN_ZOOM, maxZoom: 1, duration: 240 });
  }, [fitReq, rf]);

  return h(ReactFlow, {
    nodes,
    edges,
    nodeTypes,
    edgeTypes,
    fitView: true,
    fitViewOptions: { nodes: focus, padding: 0.1, minZoom: LATEST_MIN_ZOOM, maxZoom: 1 },
    minZoom: 0.15,
    maxZoom: 1.6,
    nodesDraggable: false,
    nodesConnectable: false,
    elementsSelectable: true,
    zoomOnDoubleClick: false,
    onNodeClick: (_e, n) => onSelect(n.id),
    onPaneClick: () => onSelect(''),
    className: 'tf-flow',
  },
  h(Background, { gap: 20, size: 1 }),
  h(Controls, { showInteractive: false, position: 'bottom-left' }),
  showMiniMap ? h(MiniMap, { pannable: true, zoomable: true, position: 'bottom-right', className: 'tf-minimap' }) : null);
}

/**
 * @param {HTMLElement} container
 * @returns {{update(state), fit('all' | 'latest'), unmount()}}
 *   state: { graph, selectedId, showMiniMap, onSelect(id), onToggle(id, collapsed) }
 */
export function mountTraceFlow(container) {
  injectBaseCss();
  const root = createRoot(container);
  let fitReq = { n: 0, mode: 'latest' };
  let last = null;
  let layoutCache = { graph: null, layout: null };

  const draw = () => {
    if (!last) return;
    if (layoutCache.graph !== last.graph) layoutCache = { graph: last.graph, layout: layoutGraph(last.graph) };
    const layout = layoutCache.layout;
    root.render(h(ReactFlowProvider, null, h(Flow, {
      graph: last.graph,
      layout,
      selectedId: last.selectedId || '',
      showMiniMap: !!last.showMiniMap,
      fitReq,
      onSelect: last.onSelect,
      onToggle: last.onToggle,
    })));
  };

  return {
    update(state) { last = state; draw(); },
    fit(mode = 'all') { fitReq = { n: fitReq.n + 1, mode }; draw(); },
    unmount() {
      last = null;
      try { root.unmount(); } catch (_) { /* ignore */ }
    },
  };
}
