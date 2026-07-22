<template>
  <div class="plan-actions">
    <button class="btn btn-danger" @click="$emit('reset')">重置</button>
    <button class="btn btn-default" disabled>保存</button>
    <button class="btn btn-default" disabled>加载</button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  reset: []
}>()
</script>

<style scoped>
.plan-actions {
  display: flex;
  gap: 8px;
}
.btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: all var(--transition-fast);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
}
.btn-default {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
.btn-danger {
  background: var(--color-error);
  color: #fff;
  border: none;
}
</style>
