/**
 * 生产规划数据闭环
 *
 * 串联：planProduction → autoLayout → toVueFlowGraph → 响应式图数据
 *
 * 封装了 Vue Flow 所需的 Node[]/Edge[] 响应式状态，
 * 供 ProductionPlanPage 消费，剥离页面组件的业务逻辑负担。
 */

import { ref, computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { toVueFlowGraph } from '@/lib/graphTransformer'
import { formatRate } from '@/lib/recipeOptions'
import { somerSlots } from '@/config/buildingConfig'
import type { ProductionGraph } from '@/types'
import type { Node as VFNode, Edge as VFEdge } from '@vue-flow/core'

/** 索莫晶体增幅功率的时钟指数（wiki：P = 基础功率 × (1+已填槽/总槽)² × (时钟)^1.321928） */
const SOMER_POWER_EXPONENT = 1.321928

export function useProductionPlan() {
  const dataStore = useDataStore()

  const flowNodes = ref<VFNode[]>([])
  const flowEdges = ref<VFEdge[]>([])

  /** 当前产线所需的电力总和（MW），整数省略小数 */
  const totalPower = computed(() => {
    const index = dataStore.index
    if (!index || flowNodes.value.length === 0) return '--'

    let power = 0
    for (const node of flowNodes.value) {
      const data = node.data
      if (!data.machineType || !data.machineClocks || data.machineClocks.length === 0) continue
      const bld = index.buildings.get(data.machineType)
      const p = bld?.powerConsumption
      if (!p) continue
      // 游戏功率公式：实际功率 = 基础功率 × sum(clock_i^exponent)
      // 生产建筑默认使用 1.6 指数，部分建筑可能不同（如抽水站 1.0）
      const exponent = bld?.powerConsumptionExponent ?? 1.6
      // 索莫晶体增幅：按 wiki 公式，晶体机功率 = 基础功率 × (1 + 已填槽/总槽)² × 时钟^1.321928
      // 分布按「先装满一台再开下一台」推导：full 台装满 slots，之后 1 台装 partial 个，其余普通机
      const somerTotal = data.somerMachines ?? 0
      const slots = somerSlots(data.machineType) ?? 1
      const clocks = data.machineClocks as number[]
      const hasSomer = somerTotal > 0 && slots > 0
      const full = hasSomer ? Math.floor(somerTotal / slots) : 0
      const partial = hasSomer ? somerTotal % slots : 0

      for (let i = 0; i < clocks.length; i++) {
        const c = clocks[i]!
        let k = 0
        if (hasSomer) {
          if (i < full) k = slots
          else if (i === full && partial > 0) k = partial
        }
        if (k > 0) {
          const boost = 1 + k / slots
          power += p * boost * boost * Math.pow(c, SOMER_POWER_EXPONENT)
        } else {
          power += p * Math.pow(c, exponent)
        }
      }
    }
    return formatRate(power)
  })

  function onGraphReady(graph: ProductionGraph) {
    const { nodes, edges } = toVueFlowGraph(graph, dataStore.index ?? undefined)
    flowNodes.value = nodes
    flowEdges.value = edges
  }

  function onReset() {
    flowNodes.value = []
    flowEdges.value = []
  }

  return {
    flowNodes,
    flowEdges,
    totalPower,
    onGraphReady,
    onReset,
  }
}
