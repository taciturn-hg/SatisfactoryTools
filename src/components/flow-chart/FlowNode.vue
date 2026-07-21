<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  id: string
  data: {
    name: string
    type: 'resource' | 'intermediate' | 'final' | 'byproduct'
    rate: number
    buildingName?: string
    efficiency?: number
    productName?: string
  }
}>()

const borderColor = computed(() => {
  const map: Record<string, string> = {
    resource: 'var(--node-resource)',
    intermediate: 'var(--node-intermediate)',
    final: 'var(--node-final)',
    byproduct: 'var(--node-byproduct)',
  }
  return map[props.data.type] ?? 'var(--node-intermediate)'
})

const borderStyle = computed(() => (props.data.type === 'byproduct' ? 'dashed' : 'solid'))

const handleStyle = {
  background: 'transparent',
  border: 'none',
  width: 0,
  height: 0,
  pointerEvents: 'none' as const,
}
</script>

<template>
  <div class="flow-node" :style="{ borderColor: borderColor, borderStyle }">
    <div class="node-content">
      <div class="node-icon">■</div>
      <div class="node-text">
        <div class="building-line" v-if="data.buildingName">
          {{ data.buildingName }}（{{ data.efficiency ?? 100 }}%）
        </div>
        <div class="product-line">{{ data.productName ?? data.name }}（{{ data.rate }}/min）</div>
      </div>
    </div>
    <Handle type="target" :position="Position.Left" :style="handleStyle" />
    <Handle type="source" :position="Position.Right" :style="handleStyle" />
  </div>
</template>

<style scoped>
.flow-node {
  min-width: 140px;
  border: 2px solid;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: box-shadow var(--transition-fast);
}
.flow-node:hover {
  box-shadow: var(--shadow-md);
}

.node-content {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
}

.node-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  opacity: 0.65;
}

.node-text {
  text-align: left;
  color: var(--text-primary);
}

.building-line,
.product-line {
  font-size: 12px;
  margin-bottom: 2px;
  font-weight: 700;
}
</style>
