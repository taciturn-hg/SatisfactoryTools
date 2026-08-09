/**
 * 图转换器
 *
 * 职责：将 ProductionGraph（业务模型）转换为 Vue Flow 可消费的
 * Node/Edge 数据格式，并根据节点类型确定样式。
 */

import type { Node, Edge } from '@vue-flow/core'
import type { ProductionGraph, ProductionNode, DataIndex } from '@/types'
import { getIconUrl } from '@/lib/iconRegistry'
import { formatRate } from '@/lib/recipeOptions'
import { somerSlots } from '@/config/buildingConfig'

/**
 * 根据节点类型确定颜色代码
 */
function getNodeType(data: ProductionNode): string {
  if (data.isOutputTarget) return 'final'
  if (data.isUnused) return 'unused'
  if (data.isByproduct) return 'byproduct'
  if (data.recipeUsed === null) return 'resource'
  return 'intermediate'
}

/** 判断是否有任意机器超频（时钟 > 1.0） */
function isOverclocked(clocks: number[]): boolean {
  return clocks.some(c => c > 1.01)
}

/**
 * 格式化频率分配文本，如 [1, 1, 0.4] → "2×100%, 1×40%"
 * 精度保留到小数点后 2 位，末尾.00省略。
 *
 * 若提供 somerPerMachine（每台机器装入的索莫晶体数，与 clocks 等长），
 * 装晶体的机器在其时钟后标 *NSM（N = 该台晶体数），便于分辨哪些机器放了晶体。
 * 按「时钟 + 晶体数」分组合并（0 晶体 = 无晶体，格式不变）。
 */
export function formatClocks(clocks: number[], somerPerMachine?: number[]): string {
  if (clocks.length === 0) return ''
  const hasSomer = somerPerMachine?.some(s => s && s > 0) ?? false
  const groups: { clock: number; count: number; somer: number }[] = []
  for (let i = 0; i < clocks.length; i++) {
    const c = clocks[i]!
    const pct = parseFloat((c * 100).toFixed(2))
    const sm = hasSomer ? (somerPerMachine?.[i] ?? 0) : 0
    const existing = groups.find(g => g.clock === pct && g.somer === sm)
    if (existing) {
      existing.count++
    } else {
      groups.push({ clock: pct, count: 1, somer: sm })
    }
  }
  return groups.map(g => {
    const pct = g.clock % 1 === 0 ? String(g.clock) : g.clock.toFixed(2)
    const somerTag = g.somer > 0 ? `*${g.somer}SM` : ''
    return `${g.count}×${pct}%${somerTag}`
  }).join(', ')
}

/**
 * 由节点晶体总数与槽位数推导每台机器的晶体分布。
 * 分布约定（引擎）：先装满一台（slots 个）再开下一台，最后一台部分装。
 */
export function deriveSomerPerMachine(
  somerTotal: number,
  slots: number,
  machineCount: number,
): number[] {
  if (somerTotal <= 0 || slots <= 0) return Array(machineCount).fill(0)
  const full = Math.floor(somerTotal / slots)
  const partial = somerTotal % slots
  const per: number[] = []
  for (let i = 0; i < machineCount; i++) {
    if (i < full) per.push(slots)
    else if (i === full && partial > 0) per.push(partial)
    else per.push(0)
  }
  return per
}

/**
 * 查找建筑中文名
 */
function lookupBuildingName(machineType: string, index?: DataIndex): string {
  if (!index) return machineType
  return index.buildings.get(machineType)?.displayName || machineType
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
  const nodes: Node<ProductionNode>[] = graph.nodes.map((node) => {
    const somerTotal = node.somerMachines ?? 0
    const slots = somerSlots(node.machineType) ?? 1
    const somerPerMachine = deriveSomerPerMachine(
      somerTotal,
      slots,
      node.machineClocks ? node.machineClocks.length : Math.ceil(node.machineCount),
    )
    return {
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
        clockInfo: formatClocks(node.machineClocks, somerPerMachine),
        machineCount: node.machineCount,
        somerMachines: somerTotal,
        somerPerMachine,
        machineType: node.machineType,
        totalMachines: node.machineClocks ? node.machineClocks.length : Math.ceil(node.machineCount),
        isOverclocked: isOverclocked(node.machineClocks),
      },
    }
  })

  // 合并双向边：同对节点间的反向边（如副产物回灌边与主料边）合并为一条双向箭头边，
  // 避免 dagre 布局把两条反向边垂直错开成交叉 X 型、中间标签重叠。
  // 例：氧化铝溶液 ⇄ 碎铝渣（氧化铝溶液 240/min → 碎铝渣，水 120/min → 氧化铝溶液）
  // 按有向对分组收集边，同一方向的多条边（如配方产出多个副产物都流向同一消费者）
  // 全部计入双向边的 label，不丢弃任何一条。
  const grouped = new Map<string, typeof graph.edges[number][]>()
  for (const e of graph.edges) {
    const k = `${e.sourceNodeId}→${e.targetNodeId}`
    const list = grouped.get(k) ?? []
    list.push(e)
    grouped.set(k, list)
  }

  const edges: Edge[] = []
  const emitted = new Set<string>()
  for (const [fk, forwardList] of grouped) {
    const [s, t] = fk.split('→') as [string, string]
    const rk = `${t}→${s}`
    const backwardList = grouped.get(rk)

    if (!backwardList) {
      // 纯单向边：各自渲染
      for (const e of forwardList) {
        edges.push({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          label: `${index?.items.get(e.itemClass)?.displayName || e.itemClass} ${formatRate(e.flowRate)}/min`,
          type: 'default',
          animated: true,
        })
      }
      continue
    }

    // 双向对：仅在字典序较小的方向处理一次，避免重复
    const canonical = fk < rk
    if (!canonical || emitted.has(rk)) continue
    emitted.add(fk)
    emitted.add(rk)

    const fmtSide = (list: typeof graph.edges[number][]) =>
      list
        .map(e => `${index?.items.get(e.itemClass)?.displayName || e.itemClass} ${formatRate(e.flowRate)}/min`)
        .join(', ')

    edges.push({
      id: `bi${s}-${t}`,
      source: s,
      target: t,
      label: `${fmtSide(forwardList)} ⇄ ${fmtSide(backwardList)}`,
      type: 'default',
      animated: true,
      markerStart: 'arrow',
      markerEnd: 'arrow',
    })
  }

  return { nodes, edges }
}
