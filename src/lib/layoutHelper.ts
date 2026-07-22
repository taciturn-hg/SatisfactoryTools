/**
 * 图布局辅助
 *
 * 职责：使用 dagre 对 ProductionGraph 节点执行自动布局，填充 position 字段。
 */

import dagre from 'dagre'
import type { ProductionGraph } from '@/types'

const NODE_WIDTH = 200
const NODE_HEIGHT = 90

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

  g.setGraph({
    rankdir: direction === 'horizontal' ? 'LR' : 'TB',
    nodesep: 120,
    ranksep: 150,
    marginx: 40,
    marginy: 40,
  })

  // 注册节点
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // 注册边
  for (const edge of graph.edges) {
    g.setEdge(edge.sourceNodeId, edge.targetNodeId)
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
