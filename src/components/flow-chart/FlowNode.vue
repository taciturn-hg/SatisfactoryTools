<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

const props = defineProps<{
  id: string
  data: {
    name: string
    type: 'resource' | 'intermediate' | 'final' | 'byproduct' | 'unused'
    rate: number
    buildingName?: string
    machineCount?: number
    clockInfo?: string
    itemIcon?: string
    totalMachines?: number
    isOverclocked?: boolean
  }
}>()

const borderColor = computed(() => {
  const map: Record<string, string> = {
    resource: 'var(--node-resource)',
    intermediate: 'var(--node-intermediate)',
    final: 'var(--node-final)',
    byproduct: 'var(--node-byproduct)',
    unused: 'var(--node-unused)',
  }
  return map[props.data.type] ?? 'var(--node-intermediate)'
})

const borderStyle = computed(() =>
  props.data.type === 'byproduct' || props.data.type === 'unused'
    ? 'dashed'
    : 'solid'
)

const handleStyle = {
  background: 'transparent',
  border: 'none',
  width: 0,
  height: 0,
  pointerEvents: 'none' as const,
}
</script>

<template>
  <div
    class="flow-node"
    :class="{ 'node-overclocked': data.isOverclocked }"
    :style="{ borderColor, borderStyle }"
  >
    <div class="node-content">
      <div class="node-icon">
        <img v-if="data.itemIcon" :src="data.itemIcon" :alt="data.name" class="node-icon-img" />
        <span v-else>■</span>
      </div>
      <div class="node-text">
        <div class="building-line" v-if="data.buildingName">
          🏭 {{ data.buildingName }}
        </div>
        <div class="product-line">{{ data.name }} <span class="rate-tag">产出 {{ formatRate(data.rate) }}/min</span></div>
        <div class="machine-line" v-if="data.clockInfo">
          {{ data.totalMachines ?? Math.ceil(data.machineCount || 0) }}台
          <span class="clock-detail">{{ data.clockInfo }}</span>
        </div>
      </div>
    </div>
    <Handle type="target" :position="Position.Left" :style="handleStyle" />
    <Handle type="source" :position="Position.Right" :style="handleStyle" />
  </div>
</template>

<style scoped>
.flow-node {
  min-width: 160px;
  border: 2px solid;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: box-shadow var(--transition-fast);
}
.flow-node:hover {
  box-shadow: var(--shadow-md);
}
.node-overclocked {
  box-shadow: 0 0 12px 2px rgba(255, 200, 50, 0.5), 0 0 24px 4px rgba(255, 200, 50, 0.2);
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
  overflow: hidden;
}
.node-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-text {
  text-align: left;
  color: var(--text-primary);
}

.building-line {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.product-line {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
}

.rate-tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-primary);
}

.machine-line {
  font-size: 11px;
  color: var(--text-muted);
}

.clock-detail {
  color: var(--text-secondary);
}
</style>
