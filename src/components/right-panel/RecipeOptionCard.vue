<script setup lang="ts">
import { formatRate } from '@/lib/recipeOptions'
import type { RecipeIoItem } from '@/lib/recipeOptions'

interface RecipeCardData {
  displayName: string
  ingredients: RecipeIoItem[]
  products: RecipeIoItem[]
}

defineProps<{
  option: RecipeCardData
}>()
</script>

<template>
  <div class="recipe-card">
    <div class="recipe-card-name">{{ option.displayName }}</div>
    <div class="recipe-card-body">
      <div class="recipe-io-list">
        <div v-for="(io, i) in option.ingredients" :key="i" class="recipe-io-item">
          <img v-if="io.icon" :src="io.icon" alt="" class="recipe-io-icon" />
          <span v-else class="recipe-io-icon recipe-io-icon-placeholder">■</span>
          <span class="recipe-io-name">{{ io.name }}</span>
          <span class="recipe-io-amount">{{ formatRate(io.rate) }}/min</span>
        </div>
      </div>
      <div class="recipe-arrow">→</div>
      <div class="recipe-io-list">
        <div v-for="(io, i) in option.products" :key="i" class="recipe-io-item">
          <img v-if="io.icon" :src="io.icon" alt="" class="recipe-io-icon" />
          <span v-else class="recipe-io-icon recipe-io-icon-placeholder">■</span>
          <span class="recipe-io-name">{{ io.name }}</span>
          <span class="recipe-io-amount">{{ formatRate(io.rate) }}/min</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe-card {
  padding: 8px 12px;
}
.recipe-card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.recipe-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}
.recipe-io-list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.recipe-io-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.recipe-io-icon {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;
}
.recipe-io-icon-placeholder {
  color: var(--text-muted);
}
.recipe-io-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recipe-io-amount {
  color: var(--text-muted);
  white-space: nowrap;
}
.recipe-arrow {
  font-size: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
