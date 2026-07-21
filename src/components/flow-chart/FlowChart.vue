<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import FlowNode from '@/components/flow-chart/FlowNode.vue'
</script>

<template>
  <div class="flow-chart-container">
    <VueFlow
      id="production-flow"
      :nodes="[
        {
          id: '0',
          type: 'production-node',
          position: { x: 0, y: 0 },
          data: { name: '铁矿石', type: 'resource', rate: 120, buildingName: '采矿机 Mk.1', efficiency: 100, productName: '铁矿石' },
        },
        {
          id: '5',
          type: 'production-node',
          position: { x: 0, y: 120 },
          data: { name: '煤矿石', type: 'resource', rate: 60, buildingName: '采矿机 Mk.1', efficiency: 100, productName: '煤矿石' },
        },
        {
          id: '1',
          type: 'production-node',
          position: { x: 350, y: 60 },
          data: { name: '铁锭', type: 'intermediate', rate: 40, buildingName: '冶炼器', efficiency: 100, productName: '铁锭' },
        },
        {
          id: '2',
          type: 'production-node',
          position: { x: 700, y: 0 },
          data: { name: '铁板', type: 'intermediate', rate: 20, buildingName: '构造机', efficiency: 100, productName: '铁板' },
        },
        {
          id: '3',
          type: 'production-node',
          position: { x: 700, y: 120 },
          data: { name: '螺丝', type: 'intermediate', rate: 40, buildingName: '构造机', efficiency: 100, productName: '螺丝' },
        },
        {
          id: '4',
          type: 'production-node',
          position: { x: 1050, y: 60 },
          data: { name: '强化铁板', type: 'final', rate: 10, buildingName: '组装机', efficiency: 100, productName: '强化铁板' },
        },
      ]"
      :edges="[
        {
          id: 'e0-1',
          source: '0',
          target: '1',
          label: '铁矿石(120/min)',
          type: 'default',
          animated: true,
        },
        { id: 'e1-2', source: '1', target: '2', label: '铁锭(40/min)', type: 'default', animated: true },
        { id: 'e1-3', source: '1', target: '3', label: '铁锭(40/min)', type: 'default', animated: true },
        { id: 'e2-4', source: '2', target: '4', label: '铁板(20/min)', type: 'default', animated: true },
        { id: 'e3-4', source: '3', target: '4', label: '螺丝(40/min)', type: 'default', animated: true },
        { id: 'e5-1', source: '5', target: '1', label: '煤矿石(60/min)', type: 'default', animated: true },
      ]"
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
  flex: 1;
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
