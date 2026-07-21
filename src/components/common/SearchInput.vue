<template>
  <div class="search-input">
    <input
      type="text"
      class="search-input-field"
      placeholder="搜索物品名称..."
    />
  </div>
</template>

<style scoped>
.search-input-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}
.search-input-field:focus {
  border-color: var(--color-primary);
}
.search-input-field::placeholder {
  color: var(--text-muted);
}
</style>
