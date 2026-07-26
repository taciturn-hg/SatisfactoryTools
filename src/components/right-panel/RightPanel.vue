<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { planProduction } from '@/lib/productionEngine'
import { autoLayout } from '@/lib/layoutHelper'
import ItemDetail from '@/components/right-panel/ItemDetail.vue'
import PlanParams from '@/components/right-panel/PlanParams.vue'
import PlanActions from '@/components/right-panel/PlanActions.vue'
import type { ProductionGraph, ExtractorConfig } from '@/types'

const emit = defineEmits<{
  graphReady: [graph: ProductionGraph]
  reset: []
}>()

const dataStore = useDataStore()

const activeTab = ref<'output' | 'input' | 'config'>('output')

const outputItems = ref<string[]>([])
const inputItems = ref<string[]>([])
const outputRates = ref(new Map<string, number>())
const inputRates = ref(new Map<string, number>())

function getItemRate(itemClass: string): number {
  return outputRates.value.get(itemClass) ?? 1
}

function updateItemRate(itemClass: string, rate: number) {
  if (rate <= 0) {
    const next = new Map(outputRates.value)
    next.delete(itemClass)
    outputRates.value = next
    outputItems.value = outputItems.value.filter((v) => v !== itemClass)
  } else {
    outputRates.value = new Map(outputRates.value).set(itemClass, rate)
  }
}

function getInputRate(itemClass: string): number {
  return inputRates.value.get(itemClass) ?? 0
}

function updateInputRate(itemClass: string, rate: number) {
  if (rate <= 0) {
    const next = new Map(inputRates.value)
    next.delete(itemClass)
    inputRates.value = next
    inputItems.value = inputItems.value.filter((v) => v !== itemClass)
  } else {
    inputRates.value = new Map(inputRates.value).set(itemClass, rate)
  }
}

/**
 * 将 PlanParams 中用户选择的替代配方和转换器配方
 * 转换为 Map<itemClass, recipeClass> 格式传给引擎。
 */
function buildAlternativeMap(): Map<string, string> {
  const map = new Map<string, string>()
  const p = paramsRef.value
  if (!p) return map

  const allRecipes = p.selectedRecipes.concat(p.selectedConverter)
  if (!allRecipes.length) return map

  const recipeSet = new Set(allRecipes)
  for (const recipeList of dataStore.index!.recipes.values()) {
    for (const r of recipeList) {
      if (recipeSet.has(r.className)) {
        for (const product of r.products) {
          map.set(product.itemClass, r.className)
        }
      }
    }
  }
  return map
}

function removeOutputItem(value: string) {
  outputItems.value = outputItems.value.filter((v) => v !== value)
  const next = new Map(outputRates.value)
  next.delete(value)
  outputRates.value = next
  debounceRun()
}
function removeInputItem(value: string) {
  inputItems.value = inputItems.value.filter((v) => v !== value)
  const next = new Map(inputRates.value)
  next.delete(value)
  inputRates.value = next
  debounceRun()
}
function resetList() {
  outputItems.value = []
  inputItems.value = []
  outputRates.value = new Map()
  inputRates.value = new Map()
  emit('reset')
}

const paramsRef = ref<InstanceType<typeof PlanParams> | null>(null)

function runPlan() {
  if (!dataStore.index) return
  if (!outputItems.value.length) {
    emit('reset')
    return
  }

  const p = paramsRef.value
  const extractorConfig: ExtractorConfig = {
    minerLevel: (p?.minerLevel ?? 'mk1') as ExtractorConfig['minerLevel'],
    minerPurity: (p?.minerPurity ?? 'normal') as ExtractorConfig['minerPurity'],
    oilExtractor: (p?.oilExtractor ?? 'oil_well') as ExtractorConfig['oilExtractor'],
    oilPurity: (p?.oilPurity ?? 'normal') as ExtractorConfig['oilPurity'],
    waterExtractor: (p?.waterExtractor ?? 'water_extractor') as ExtractorConfig['waterExtractor'],
    waterPurity: (p?.waterPurity ?? 'normal') as ExtractorConfig['waterPurity'],
    gasPurity: (p?.gasPurity ?? 'normal') as ExtractorConfig['gasPurity'],
  }

  const graph = planProduction(dataStore.index, {
    targetItems: outputItems.value.map(itemClass => ({
      itemClass,
      rate: getItemRate(itemClass),
    })),
    targetItemClass: outputItems.value[0]!,
    targetRate: getItemRate(outputItems.value[0]!),
    alternativeRecipes: buildAlternativeMap(),
    layoutDirection: 'horizontal',
    extractorConfig,
    inputItems: inputRates.value,
    powerShards: paramsRef.value?.powerShardCount ?? 0,
    byproductRecycling: paramsRef.value?.byproductRecycling === 'on',
  })

  autoLayout(graph, 'horizontal')
  emit('graphReady', graph)
}

// 产出列表、原料 rates、原料列表、配置参数任一变化时自动重算（300ms 防抖）
let debounceTimer: ReturnType<typeof setTimeout> | undefined
function debounceRun() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runPlan(), 300)
}
watch(
  [outputItems, inputItems, outputRates, inputRates],
  () => debounceRun(),
)

/** 从 dataStore 获取所有物品，转为 a-select 所需格式 */
const allItems = computed(() => {
  if (!dataStore.isLoaded) return []
  return dataStore.allItems.map((item) => ({
    value: item.className,
    label: item.displayName,
  }))
})

const itemLabelMap = computed(() => {
  const map = new Map<string, string>()
  for (const item of allItems.value) {
    map.set(item.value, item.label)
  }
  return map
})

const selectedItem = ref<string | undefined>(undefined)

const currentList = computed(() =>
  activeTab.value === 'output' ? outputItems.value : inputItems.value
)

function addItem() {
  if (!selectedItem.value) return
  if (currentList.value.includes(selectedItem.value)) {
    selectedItem.value = undefined
    return
  }
  if (activeTab.value === 'output') {
    outputItems.value = [...outputItems.value, selectedItem.value]
  } else {
    inputItems.value = [...inputItems.value, selectedItem.value]
    inputRates.value = new Map(inputRates.value).set(selectedItem.value, 1)
  }
  selectedItem.value = undefined
}

const availableItems = computed(() =>
  allItems.value.filter((item) => !currentList.value.includes(item.value))
)
</script>

<template>
  <aside class="right-panel">
    <div class="tab-nav">
      <button class="tab-item" :class="{ active: activeTab === 'output' }" @click="activeTab = 'output'">产出</button>
      <button class="tab-item" :class="{ active: activeTab === 'input' }" @click="activeTab = 'input'">原料</button>
      <button class="tab-item" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">配置</button>
    </div>

    <div v-if="!dataStore.isLoaded" class="panel-content">
      <div v-if="dataStore.loadError" class="item-list-error">
        数据加载失败：{{ dataStore.loadError }}
      </div>
      <div v-else class="item-list-placeholder">数据加载中...</div>
    </div>

    <template v-else>
      <div v-show="activeTab === 'output'" class="tab-pane">
        <div class="panel-top">
          <div class="search-add-row">
            <a-select
              v-model:value="selectedItem"
              show-search
              placeholder="搜索添加物品..."
              :options="availableItems"
              :filter-option="(input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase())"
              style="width: 100%"
              :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
            />
            <button class="btn-add" :disabled="!selectedItem" @click="addItem">＋</button>
          </div>
        </div>
        <div class="panel-content">
          <div v-if="outputItems.length === 0" class="item-list-placeholder">暂无物品</div>
          <div v-else class="item-list">
            <ItemDetail
              v-for="(val) in outputItems"
              :key="val"
              :item-value="val"
              :item-name="itemLabelMap.get(val) ?? val"
              :rate="getItemRate(val)"
              @delete="removeOutputItem"
              @update:rate="updateItemRate"
            />
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'input'" class="tab-pane">
        <div class="panel-top">
          <div class="search-add-row">
            <a-select
              v-model:value="selectedItem"
              show-search
              placeholder="搜索添加物品..."
              :options="availableItems"
              :filter-option="(input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase())"
              style="width: 100%"
              :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
            />
            <button class="btn-add" :disabled="!selectedItem" @click="addItem">＋</button>
          </div>
        </div>
        <div class="panel-content">
          <div v-if="inputItems.length === 0" class="item-list-placeholder">暂无物品</div>
          <div v-else class="item-list">
            <ItemDetail
              v-for="(val) in inputItems"
              :key="val"
              :item-value="val"
              :item-name="itemLabelMap.get(val) ?? val"
              :rate="getInputRate(val)"
              @delete="removeInputItem"
              @update:rate="updateInputRate"
            />
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'config'" class="tab-pane panel-content config-content">
        <PlanParams ref="paramsRef" @change="debounceRun" />
      </div>
    </template>

    <div class="panel-footer">
      <PlanActions @reset="resetList" />
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  width: var(--panel-width);
  min-width: var(--panel-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  z-index: var(--z-panel);
}

.tab-nav {
  display: flex;
  width: 100%;
  border-bottom: 1px solid var(--border-color);
}
.tab-item {
  flex: 1;
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}
.tab-item.active {
  color: var(--color-primary);
  font-weight: 500;
}
.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}
.tab-item:hover {
  color: var(--text-primary);
}

.panel-top {
  padding: 12px 16px 0;
}
.search-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search-add-row > :first-child {
  flex: 1;
}

.btn-add {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.btn-add:hover {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.item-list-placeholder,
.item-list-error {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
}
.item-list-placeholder {
  color: var(--text-muted);
}
.item-list-error {
  color: var(--color-error);
}
.item-list {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}
.config-content {
  padding: 12px 16px 0;
}
.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}
</style>
