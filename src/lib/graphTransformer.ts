/**
 * 图转换器
 *
 * 职责：将 ProductionGraph（业务模型）转换为 Vue Flow 可消费的
 * Node/Edge 数据格式，并根据节点类型确定样式。
 */

import type { Node, Edge } from '@vue-flow/core'
import type { ProductionGraph, ProductionNode, DataIndex } from '@/types'
import { getIconUrl } from '@/lib/iconRegistry'

/**
 * 根据节点类型确定颜色代码
 */
function getNodeType(data: ProductionNode): string {
  if (data.isOutputTarget) return 'final'
  if (data.isUnused) return 'unused'
  if (data.isByproduct) return 'byproduct'
  if (data.recipeUsed === null) return 'resource'
  if (data.depth === 0) return 'intermediate'
  return 'intermediate'
}

/**
 * 格式化频率分配文本，如 [1, 1, 0.4] → "2×100%, 1×40%"
 * 精度保留到小数点后 2 位，末尾.00省略
 */
function formatClocks(clocks: number[]): string {
  if (clocks.length === 0) return ''
  const groups: { clock: number; count: number }[] = []
  for (const c of clocks) {
    const pct = parseFloat((c * 100).toFixed(2))
    const existing = groups.find(g => g.clock === pct)
    if (existing) {
      existing.count++
    } else {
      groups.push({ clock: pct, count: 1 })
    }
  }
  return groups.map(g => {
    const pct = g.clock % 1 === 0 ? String(g.clock) : g.clock.toFixed(2)
    return `${g.count}×${pct}%`
  }).join(', ')
}

/**
 * 查找建筑中文名
 */
function lookupBuildingName(machineType: string, index?: DataIndex): string {
  if (!index) return machineType
  return index.buildings.get(machineType)?.displayName || machineType
}

/**
 * 格式化每分钟速率标签，整数省略小数
 */
function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

/** 将 Build_ClassName 转为图标文件路径，仅当 buildings 中有 iconPath 时返回 */
function buildingIconPath(machineType: string, index?: DataIndex): string | undefined {
  const iconPath = index?.buildings.get(machineType)?.iconPath
  if (iconPath) {
    return getIconUrl(iconPath)
  }
  return undefined
}

/** 将物品 className 转为图标文件路径，仅当 GameItem.smallIcon 有值时返回 */
function itemIconPath(itemClass: string, index?: DataIndex): string | undefined {
  const iconPath = index?.items.get(itemClass)?.smallIcon
  if (iconPath) {
    return getIconUrl(iconPath)
  }
  return undefined
}

/**
 * 将 ProductionGraph 转换为 Vue Flow 的节点和边
 */
export function toVueFlowGraph(graph: ProductionGraph, index?: DataIndex): {
  nodes: Node<ProductionNode>[]
  edges: Edge[]
} {
  const nodes: Node<ProductionNode>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: 'production-node',
    position: node.position ?? { x: 0, y: 0 },
    data: {
      ...node,
      name: node.itemName,
      type: getNodeType(node),
      rate: node.rate,
      buildingName: node.machineType
        ? lookupBuildingName(node.machineType, index)
        : undefined,
      itemIcon: node.isOutputTarget
        ? itemIconPath(node.itemClass, index)
        : node.machineType
          ? buildingIconPath(node.machineType, index) ?? itemIconPath(node.itemClass, index)
          : itemIconPath(node.itemClass, index),
      productName: node.itemName,
      clockInfo: formatClocks(node.machineClocks),
      machineCount: node.machineCount,
      totalMachines: node.machineClocks ? node.machineClocks.length : Math.ceil(node.machineCount),
    },
  }))

  const edges: Edge[] = graph.edges.map(edge => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: `${index?.items.get(edge.itemClass)?.displayName || edge.itemClass} ${formatRate(edge.flowRate)}/min`,
    type: 'default',
    animated: true,
  }))

  return { nodes, edges }
}
