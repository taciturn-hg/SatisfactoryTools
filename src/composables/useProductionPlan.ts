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
import type { ProductionGraph } from '@/types'
import type { Node as VFNode, Edge as VFEdge } from '@vue-flow/core'

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
      // 游戏功率公式：实际功率 = 基础功率 × sum(clock_i^1.6)
      // 生产建筑固定使用 1.6 指数
      for (const c of data.machineClocks) {
        power += p * Math.pow(c, 1.6)
      }
    }
    const rounded = Math.round(power * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
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
