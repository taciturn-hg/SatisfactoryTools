/**
 * 图布局辅助
 *
 * 职责：使用 dagre 对 ProductionGraph 节点执行自动布局，填充 position 字段。
 *
 * 权重策略：
 * - 深度链路上的边（depth 连续递减）为主干路径，权重 10，dagre 优先拉直
 * - 副产物相关的边为侧枝，权重 1，dagre 会让道
 * - 其余边权重 3
 */

import dagre from 'dagre'
import type { GraphLabel } from 'dagre'
import type { ProductionGraph } from '@/types'

const NODE_WIDTH = 200
const NODE_HEIGHT = 90

/** 节点 itemClass → depth */
function buildDepthMap(graph: ProductionGraph): Map<string, number> {
  const depth = new Map<string, number>()
  for (const n of graph.nodes) {
    depth.set(n.itemClass, n.depth)
  }
  return depth
}

/**
 * 判断边是否在深度链路上（源节点 depth = 目标节点 depth + 1）。
 * 排除副产物节点：副产物节点在同一深度，不应成为主干。
 */
function isDepthEdge(
  sourceId: string,
  targetId: string,
  graph: ProductionGraph,
  depthMap: Map<string, number>,
): boolean {
  const src = graph.nodes.find(n => n.id === sourceId)
  const tgt = graph.nodes.find(n => n.id === targetId)
  if (!src || !tgt) return false
  if (src.isByproduct || tgt.isByproduct) return false
  const srcDepth = depthMap.get(src.itemClass)
  const tgtDepth = depthMap.get(tgt.itemClass)
  if (srcDepth == null || tgtDepth == null) return false
  return srcDepth - tgtDepth === 1
}

/**
 * 自动布局
 *
 * @param graph 生产图（节点的 position 会被修改）
 * @param direction 布局方向
 */
export function autoLayout(
  graph: ProductionGraph,
  direction: 'vertical' | 'horizontal' = 'horizontal',
): void {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  const depthMap = buildDepthMap(graph)

  g.setGraph({
    rankdir: direction === 'horizontal' ? 'LR' : 'TB',
    nodesep: 80,
    ranksep: 180,
    edgesep: 40,
    marginx: 40,
    marginy: 40,
    splines: 'orthogonal',
  } as GraphLabel & Record<string, unknown>)

  // 注册节点
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // 注册边（主干加权重）
  for (const edge of graph.edges) {
    const weight = isDepthEdge(edge.sourceNodeId, edge.targetNodeId, graph, depthMap) ? 10 : 3
    g.setEdge(edge.sourceNodeId, edge.targetNodeId, { weight })
  }

  // 执行布局
  dagre.layout(g)

  // 将 dagre 算出的坐标写回节点
  for (const node of graph.nodes) {
    const dagreNode = g.node(node.id)
    if (dagreNode) {
      node.position = {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      }
    }
  }
}
