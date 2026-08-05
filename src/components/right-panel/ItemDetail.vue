<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { getIconUrl } from '@/lib/iconRegistry'

/** 滚动容器（产出/原料列表所在 .panel-content），滚动时收起下拉 */
let scrollContainer: HTMLElement | null = null
let triggerEl: HTMLElement | null = null

function onContainerScroll() {
  // 事件委托：滚动时触发失焦，关闭下拉（宽面板挂 body，需手动收起避免脱离选择框）
  selectRef.value?.blur()
}

onMounted(() => {
  triggerEl = triggerRootRef.value
  scrollContainer = triggerEl?.closest('.panel-content') ?? null
  scrollContainer?.addEventListener('scroll', onContainerScroll, { passive: true })
})

onBeforeUnmount(() => {
  scrollContainer?.removeEventListener('scroll', onContainerScroll)
})

const selectRef = ref<{ blur: () => void } | null>(null)
const triggerRootRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  itemValue: string
  itemName: string
  rate: number
  /** 该产出的配方下拉选项（原生在前，替代在后，替代带「替代」前缀） */
  recipeOptions?: RecipeOption[]
  /** 当前选中的配方（未指定替代配方时为默认原生配方） */
  recipeValue?: string
}>()

interface RecipeIoItem {
  name: string
  icon?: string
  rate: number
}

interface RecipeOption {
  value: string
  label: string
  displayName: string
  ingredients: RecipeIoItem[]
  products: RecipeIoItem[]
}

const emit = defineEmits<{
  delete: [itemValue: string]
  'update:rate': [itemValue: string, rate: number]
  'change-recipe': [itemValue: string, recipeClass: string]
}>()

const dataStore = useDataStore()

const itemData = computed(() => dataStore.getItem(props.itemValue))

const itemDescription = computed(() => {
  return itemData.value?.description ?? ''
})

const iconSrc = computed(() => {
  const icon = itemData.value?.smallIcon
  if (!icon) return undefined
  return getIconUrl(icon)
})

function onRateChange(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  if (raw === '') return
  const val = Number(raw)
  if (!Number.isFinite(val) || val < 0) return
  emit('update:rate', props.itemValue, val)
}

function onRecipeChange(value: string) {
  emit('change-recipe', props.itemValue, value)
}

/** 下拉面板挂载到 body，脱离右侧面板的 overflow 容器，避免超宽面板触发横向滚动 */
function dropdownContainer(): HTMLElement {
  return document.body
}

/** 格式化每分钟速率：整数省略小数，其余保留 1 位（与产线节点一致） */
function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

function onDelete() {
  emit('delete', props.itemValue)
}
</script>

<template>
  <div class="item-detail" ref="triggerRootRef">
    <div class="item-header">
      <div class="item-icon">
        <img v-if="iconSrc" :src="iconSrc" :alt="itemName" class="item-icon-img" />
        <span v-else class="item-icon-placeholder">■</span>
      </div>
      <div class="item-info-with-rate">
        <div class="item-name-row">
          <span class="item-name">{{ itemName }}</span>
          <a-tooltip :title="itemDescription || '暂无描述'">
            <span class="item-tooltip-trigger">ⓘ</span>
          </a-tooltip>
          <button class="item-delete" @click="onDelete">✕</button>
        </div>
        <div class="recipe-row" v-if="recipeOptions && recipeOptions.length > 0">
          <a-select
            ref="selectRef"
            :value="recipeValue"
            class="recipe-select"
            size="small"
            :options="recipeOptions"
            :dropdown-match-select-width="480"
            :dropdown-style="{ minWidth: '480px' }"
            placement="bottomRight"
            :getPopupContainer="dropdownContainer"
            @change="onRecipeChange"
          >
            <template #option="{ displayName, ingredients, products }">
              <div class="recipe-card">
                <div class="recipe-card-name">{{ displayName }}</div>
                <div class="recipe-card-body">
                  <div class="recipe-io-list">
                    <div v-for="(io, i) in ingredients" :key="i" class="recipe-io-item">
                      <img v-if="io.icon" :src="io.icon" alt="" class="recipe-io-icon" />
                      <span v-else class="recipe-io-icon recipe-io-icon-placeholder">■</span>
                      <span class="recipe-io-name">{{ io.name }}</span>
                      <span class="recipe-io-amount">{{ formatRate(io.rate) }}/min</span>
                    </div>
                  </div>
                  <div class="recipe-arrow">→</div>
                  <div class="recipe-io-list">
                    <div v-for="(io, i) in products" :key="i" class="recipe-io-item">
                      <img v-if="io.icon" :src="io.icon" alt="" class="recipe-io-icon" />
                      <span v-else class="recipe-io-icon recipe-io-icon-placeholder">■</span>
                      <span class="recipe-io-name">{{ io.name }}</span>
                      <span class="recipe-io-amount">{{ formatRate(io.rate) }}/min</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </a-select>
        </div>
        <div class="rate-input-row">
          <input type="number" class="rate-input" :value="rate" min="0" @input="onRateChange" />
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
  overflow: hidden;
}
.item-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
.recipe-row {
  display: flex;
}
.recipe-select {
  width: 100%;
}
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
