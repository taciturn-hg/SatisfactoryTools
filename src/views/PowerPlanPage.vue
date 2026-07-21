<template>
  <div class="power-plan-page">
    <div class="page-placeholder">
      <div class="placeholder-icon">⚡</div>
      <div class="placeholder-text">发电计划（即将上线）</div>
    </div>
  </div>
</template>

<style scoped>
.power-plan-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg-primary);
}
.page-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
}
.placeholder-icon {
  font-size: 48px;
  opacity: 0.3;
}
.placeholder-text {
  font-size: 14px;
}
</style>
