<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import FlowNode from '@/components/flow-chart/FlowNode.vue'
import { useUiStore } from '@/stores/uiStore'
import type { Node, Edge, NodeMouseEvent } from '@vue-flow/core'
import type { ProductionNode } from '@/types'

defineProps<{
  nodes?: Node[]
  edges?: Edge[]
}>()

const uiStore = useUiStore()

/** 点击节点 → 打开详情弹窗（改配方） */
function onNodeClick({ node }: NodeMouseEvent) {
  const data = node.data as ProductionNode | undefined
  if (!data) return
  uiStore.selectNode(data)
  uiStore.isNodeDetailModalOpen = true
}
</script>

<template>
  <div class="flow-chart-container">
    <VueFlow
      id="production-flow"
      :nodes="nodes"
      :edges="edges"
      :min-zoom="0.1"
      :max-zoom="3"
      fit-view-on-init
      @node-click="onNodeClick"
    >
      <MiniMap position="bottom-right" />
      <template #node-production-node="props">
        <FlowNode v-bind="props" />
      </template>
    </VueFlow>
  </div>
</template>

<style scoped>
.flow-chart-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-primary);
}

:deep(.vue-flow__edge-textbg) {
  fill: transparent !important;
}

:deep(.vue-flow__edge-text) {
  fill: #ffffff !important;
  font-size: 11px;
}
</style>
