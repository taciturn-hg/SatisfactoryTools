<script setup lang="ts">
import RightPanel from '@/components/right-panel/RightPanel.vue'
import FlowChart from '@/components/flow-chart/FlowChart.vue'
</script>

<template>
  <div class="production-plan-page">
    <FlowChart />
    <RightPanel />
  </div>
</template>

<style scoped>
.production-plan-page {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}
</style>
