<script setup lang="ts">
import { ref } from 'vue'
import { useProductionPlan } from '@/composables/useProductionPlan'
import RightPanel from '@/components/right-panel/RightPanel.vue'
import FlowChart from '@/components/flow-chart/FlowChart.vue'
import NodeDetailModal from '@/components/modals/NodeDetailModal.vue'

const { flowNodes, flowEdges, totalPower, onGraphReady, onReset } = useProductionPlan()

const rightPanelRef = ref<InstanceType<typeof RightPanel> | null>(null)

function onRestoreDefault(itemClass: string): void {
  rightPanelRef.value?.restoreDefaultRecipe(itemClass)
}
</script>

<template>
  <div class="production-plan-page">
    <div class="left-area">
      <div class="canvas-wrapper">
        <FlowChart :nodes="flowNodes" :edges="flowEdges" />
      </div>
      <div class="status-bar">
        <span class="power-info">⚡ {{ totalPower }} MW</span>
      </div>
    </div>
    <RightPanel ref="rightPanelRef" @graph-ready="onGraphReady" @reset="onReset" />
    <NodeDetailModal @restore-default="onRestoreDefault" />
  </div>
</template>

<style scoped>
.production-plan-page {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.left-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.canvas-wrapper {
  flex: 92.5;
  min-height: 0;
}

.status-bar {
  flex: 7.5;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
}

.power-info {
  font-size: 20px;
  color: var(--text-primary);
}
</style>
