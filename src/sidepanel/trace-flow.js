/**
 * 论证图画布（懒加载分块）。问题 → 结论 → 判断 → 证据。
 * 只由 trace-graph.js 动态 import；React Flow / dagre / React 都不进侧栏首屏。
 */

import { createElement as h, Fragment, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, useReactFlow,
} from '@xyflow/react';
import flowCss from '@xyflow/react/dist/style.css?inline';
import { layoutArgumentGraph, sizeOfArg, argumentFocusIds } from '../lib/argument-model.js';
import { shortTitle } from '../lib/trace-model.js';

const LATEST_MIN_ZOOM = 0.55;
const STYLE_ID = 'trace-flow-base-css';

function injectBaseCss() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = flowCss;
  document.head.appendChild(el);
}

const KIND_LABEL = {
  question: '问题', conclusion: '结论', judgment: '判断',
  evidence: '证据', bundle: '更多', gap: '缺口',
};
const CONF_LABEL = { high: '高', medium: '中', low: '低' };
const STATUS_LABEL = {
  'cross-source-pass': '多源通过', 'entailment-pass': '蕴含通过', 'citation-pass': '引文通过',
  'citation-fail': '引文失败', overclaim: '过度断言', 'source-conflict': '来源冲突',
  'source-unverified': '未核验', contested: '存疑', ok: '',
};

function toneOf(node) {
  const s = node.status;
  if (node.kind === 'question' || node.kind === 'conclusion') return 'idle';
  if (node.kind === 'judgment') return 'info';
  if (node.kind === 'gap') return 'warn';
  if (['cross-source-pass', 'entailment-pass', 'citation-pass', 'ok'].includes(s)) return 'good';
  if (['citation-fail', 'overclaim', 'source-conflict', 'contested'].includes(s)) return 'bad';
  return 'warn';
}

function TraceNode({ data }) {
  const { node, selected, onToggle } = data;
  const tone = toneOf(node);
  const status = STATUS_LABEL[node.status] ?? node.status;
  const size = sizeOfArg(node);
  const cls = ['tf-node', `tf-kind-${node.kind}`, `tf-tone-${tone}`];
  if (selected) cls.push('is-selected');
  const conf = node.meta?.confidence || node.subtype;
  const extra = [
    node.meta?.likelihood,
    conf && CONF_LABEL[conf] ? `置信${CONF_LABEL[conf]}` : '',
  ].filter(Boolean).join(' · ');
  return h('div', { className: cls.join(' '), style: { width: size.w, minHeight: size.h } },
    h(Handle, { type: 'target', position: Position.Left, isConnectable: false, className: 'tf-handle' }),
    h('div', { className: 'tf-head' },
      h('span', { className: 'tf-kind' }, KIND_LABEL[node.kind] || node.kind),
      status ? h('span', { className: 'tf-status' }, status) : null,
      extra ? h('span', { className: 'tf-extra' }, extra) : null,
      node.collapsible ? h('button', {
        type: 'button',
        className: 'tf-toggle nodrag nopan',
        title: node.collapsed ? '展开全部证据' : '收起',
        onClick: (e) => { e.stopPropagation(); onToggle(node.meta?.expandId || node.id, !node.collapsed); },
      }, node.collapsed ? `+${node.hiddenCount}` : '−') : null),
    node.title ? h('div', { className: 'tf-title' }, shortTitle(node, 72)) : null,
    node.kind === 'conclusion' && node.text ? h('div', { className: 'tf-sub' }, shortTitle({ title: node.text }, 90)) : null,
    h(Handle, { type: 'source', position: Position.Right, isConnectable: false, className: 'tf-handle' }));
}

function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, className }) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.25,
  });
  return h(Fragment, null,
    h(BaseEdge, { id, path, markerEnd, className }),
    data && data.label ? h(EdgeLabelRenderer, null,
      h('div', {
        className: `tf-edge-label nodrag nopan ${data.tone || ''}`,
        style: { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` },
      }, data.label)) : null);
}

const nodeTypes = { trace: TraceNode };
const edgeTypes = { labeled: LabeledEdge };

function Flow({ graph, layout, selectedId, showMiniMap, fitReq, onSelect, onToggle }) {
  const rf = useReactFlow();
  const pos = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const nodes = useMemo(() => graph.nodes.map((n) => {
    const p = pos.get(n.id) || { x: 0, y: 0 };
    return {
      id: n.id, type: 'trace', position: { x: p.x, y: p.y },
      data: { node: n, selected: n.id === selectedId, onToggle },
      draggable: false, connectable: false,
    };
  }), [graph, pos, selectedId, onToggle]);
  const edges = useMemo(() => graph.edges.map((e) => {
    if (e.type === 'counter') {
      return {
        id: e.id, source: e.source, target: e.target, type: 'labeled',
        className: 'tf-edge-counter', data: { label: '反对', tone: 'is-counter' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#dc2626' },
      };
    }
    if (e.type === 'support') {
      return {
        id: e.id, source: e.source, target: e.target, type: 'default', className: 'tf-edge-support',
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#16a34a' },
      };
    }
    return { id: e.id, source: e.source, target: e.target, type: 'default', className: 'tf-edge-leads' };
  }), [graph]);

  const focus = useMemo(() => argumentFocusIds(graph).map((id) => ({ id })), [graph]);
  useEffect(() => {
    if (fitReq.n === 0) return;
    if (fitReq.mode === 'all') rf.fitView({ padding: 0.12, duration: 240 });
    else rf.fitView({ nodes: focus, padding: 0.1, minZoom: LATEST_MIN_ZOOM, maxZoom: 1, duration: 240 });
  }, [fitReq, rf]);

  return h(ReactFlow, {
    nodes, edges, nodeTypes, edgeTypes,
    fitView: true,
    fitViewOptions: { nodes: focus, padding: 0.1, minZoom: LATEST_MIN_ZOOM, maxZoom: 1 },
    minZoom: 0.15, maxZoom: 1.6,
    nodesDraggable: false, nodesConnectable: false, elementsSelectable: true,
    zoomOnDoubleClick: false,
    onNodeClick: (_e, n) => onSelect(n.id),
    onPaneClick: () => onSelect(''),
    className: 'tf-flow',
  },
  h(Background, { gap: 20, size: 1 }),
  h(Controls, { showInteractive: false, position: 'bottom-left' }),
  showMiniMap ? h(MiniMap, { pannable: true, zoomable: true, position: 'bottom-right', className: 'tf-minimap' }) : null);
}

export function mountTraceFlow(container) {
  injectBaseCss();
  const root = createRoot(container);
  let fitReq = { n: 0, mode: 'latest' };
  let last = null;
  let layoutCache = { graph: null, layout: null };

  const draw = () => {
    if (!last) return;
    if (layoutCache.graph !== last.graph) {
      layoutCache = { graph: last.graph, layout: layoutArgumentGraph(last.graph) };
    }
    root.render(h(ReactFlowProvider, null, h(Flow, {
      graph: last.graph,
      layout: layoutCache.layout,
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
