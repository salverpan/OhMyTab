/**
 * 思维导图布局：dagre 从左到右。只用树边（tree）布局；revise 边是跨分支的“修正”连线，
 * 不参与排布，否则新判断会被强行推到旧判断右边、拉乱整棵树。
 * 单独成文件，让 dagre 只进懒加载分块。
 */

import dagre from '@dagrejs/dagre';

export const NODE_SIZE = {
  root: { w: 150, h: 44 },
  thread: { w: 170, h: 44 },
  turn: { w: 220, h: 64 },
  agent: { w: 220, h: 64 },
  subagent: { w: 220, h: 64 },
  claim: { w: 220, h: 58 },
  unresolved: { w: 220, h: 52 },
  action: { w: 220, h: 52 },
  judgment: { w: 220, h: 68 },
  observation: { w: 220, h: 58 },
};

export function sizeOf(node) {
  return NODE_SIZE[node.kind] || NODE_SIZE.action;
}

/**
 * @returns {{nodes: Array<{id:string,x:number,y:number,width:number,height:number}>, width:number, height:number}}
 * x / y 为节点左上角。
 */
export function layoutGraph(graph, { rankSep = 56, nodeSep = 12 } = {}) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: rankSep, nodesep: nodeSep, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of graph.nodes) {
    const { w, h } = sizeOf(n);
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of graph.edges) {
    if (e.type === 'tree') g.setEdge(e.source, e.target);
  }
  dagre.layout(g);
  const out = graph.nodes.map((n) => {
    const p = g.node(n.id);
    const { w, h } = sizeOf(n);
    return { id: n.id, x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2), width: w, height: h };
  });
  const meta = g.graph();
  return { nodes: out, width: Math.ceil(meta.width || 0), height: Math.ceil(meta.height || 0) };
}
