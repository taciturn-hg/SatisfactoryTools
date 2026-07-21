<template>
  <div class="loading-spinner">
    <div class="spinner" />
    <span class="loading-text">加载中...</span>
  </div>
</template>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
