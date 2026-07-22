<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import FlowNode from '@/components/flow-chart/FlowNode.vue'
import type { Node, Edge } from '@vue-flow/core'

defineProps<{
  nodes?: Node[]
  edges?: Edge[]
}>()
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
