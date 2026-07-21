<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  itemValue: string
  itemName: string
}>()

const emit = defineEmits<{
  delete: [itemValue: string]
}>()

const rate = ref(10)

function onRateChange(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  // 清空输入时不作处理，保留原值
  if (raw === '') return
  const val = Number(raw)
  // NaN 或负数不更新
  if (!Number.isFinite(val) || val < 0) return
  rate.value = Math.floor(val) // 只保留正整数
}

function onDelete() {
  emit('delete', props.itemValue)
}
</script>

<template>
  <div class="item-detail">
    <div class="item-header">
      <div class="item-icon">■</div>
      <div class="item-info-with-rate">
        <div class="item-name-row">
          <span class="item-name">{{ itemName }}</span>
          <a-tooltip title="制造用原料。最基础的零件之一。">
            <span class="item-tooltip-trigger">ⓘ</span>
          </a-tooltip>
          <button class="item-delete" @click="onDelete">✕</button>
        </div>
        <div class="rate-input-row">
          <input
            type="number"
            class="rate-input"
            :value="rate"
            min="0"
            @input="onRateChange"
          />
          <span class="rate-unit">个/分钟</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-detail {
  padding: 8px 16px;
}
.item-header {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}
.item-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  background: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.item-info-with-rate {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.item-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.item-tooltip-trigger {
  font-size: 14px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 4px;
}
.item-tooltip-trigger:hover {
  color: var(--color-primary);
}
:deep(.ant-tooltip-inner) {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  border: 1px solid var(--border-color);
}
:deep(.ant-tooltip-arrow::before) {
  background: var(--bg-tertiary);
}
.item-delete {
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.item-delete:hover {
  color: var(--color-error);
  background: rgba(255, 77, 79, 0.1);
}
.rate-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rate-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.rate-input:focus {
  border-color: var(--color-primary);
}
.rate-unit {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
