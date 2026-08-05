<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { planProduction } from '@/lib/productionEngine'
import { autoLayout } from '@/lib/layoutHelper'
import ItemDetail from '@/components/right-panel/ItemDetail.vue'
import PlanParams from '@/components/right-panel/PlanParams.vue'
import PlanActions from '@/components/right-panel/PlanActions.vue'
import { getIconUrl } from '@/lib/iconRegistry'
import type { ProductionGraph, ExtractorConfig, GameRecipe } from '@/types'

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

/** 按产出物品选定的配方（未含项 = 该产出用默认原生配方） */
const outputRecipes = ref(new Map<string, string>())

/** 配方下拉中单个原料/产物条目 */
interface RecipeIoItem {
  name: string
  icon?: string
  rate: number
}

/** 配方下拉选项（含原料/产物详情，供 #option 插槽渲染） */
interface RecipeOption {
  value: string
  label: string
  displayName: string
  ingredients: RecipeIoItem[]
  products: RecipeIoItem[]
}

function itemDisplayName(itemClass: string): string {
  return dataStore.index?.items.get(itemClass)?.displayName ?? itemClass
}

function itemIcon(itemClass: string): string | undefined {
  const icon = dataStore.index?.items.get(itemClass)?.smallIcon
  return icon ? getIconUrl(icon) : undefined
}

/** 配方原料/产物的每分钟速率：amount / 制造时长(秒) × 60 */
function ratePerMinute(amount: number, duration: number): number {
  if (duration <= 0 || amount <= 0) return 0
  const rpm = (amount / duration) * 60
  return Number.isFinite(rpm) ? Number(rpm.toFixed(4)) : 0
}

/** 产出物品 → 该物品全部可制造配方下拉选项（原生在前，替代在后，替代带「替代」前缀） */
const recipeOptionsMap = computed(() => {
  const map = new Map<string, RecipeOption[]>()
  if (!dataStore.index) return map
  for (const itemClass of outputItems.value) {
    const recipeList = dataStore.index.recipes.get(itemClass)
    if (!recipeList || recipeList.length === 0) continue
    // 资源类产出（水/煤/原油等）引擎固定开采，不展示配方下拉，避免默认值误导
    if (dataStore.index.items.get(itemClass)?.isResource) continue
    const options = recipeList
      .filter(r => !r.producedIn.some(p => p === 'Build_Converter'))
      .sort((a, b) => Number(a.isAlternate) - Number(b.isAlternate))
      .map(r => {
        const displayName = r.className.startsWith('Recipe_Unpackage')
          ? `解包:${r.displayName}`
          : r.displayName
        return {
          value: r.className,
          label: displayName,
          displayName,
          ingredients: r.ingredients.map(i => ({
            name: itemDisplayName(i.itemClass),
            icon: itemIcon(i.itemClass),
            rate: ratePerMinute(i.amount, r.manufactoringDuration),
          })),
          products: r.products.map(p => ({
            name: itemDisplayName(p.itemClass),
            icon: itemIcon(p.itemClass),
            rate: ratePerMinute(p.amount, r.manufactoringDuration),
          })),
        }
      })
    if (options.length > 0) map.set(itemClass, options)
  }
  return map
})

/** 产出物品 → 当前应显示在配方下拉中的配方（默认原生配方，排除解包配方的 className） */
const outputRecipeDefaults = computed(() => {
  const map = new Map<string, string>()
  if (!dataStore.index) return map
  for (const itemClass of outputItems.value) {
    const recipeList = dataStore.index.recipes.get(itemClass)
    if (!recipeList || recipeList.length === 0) continue
    // 资源类产出引擎固定开采，无默认配方
    if (dataStore.index.items.get(itemClass)?.isResource) continue
    const factoryCandidates = recipeList.filter(r => !r.producedIn.some(p => p === 'Build_Converter'))
    const nonUnpackage = factoryCandidates.filter(r => !r.className.startsWith('Recipe_Unpackage'))
    const pool = nonUnpackage.length > 0 ? nonUnpackage : factoryCandidates
    const standards = pool.filter(r => !r.isAlternate)
    const candidates = standards.length > 0 ? standards : pool
    const first = candidates.sort((a, b) => Number(a.isAlternate) - Number(b.isAlternate))[0]
    if (first) map.set(itemClass, first.className)
  }
  return map
})

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

  // 产出下拉已选配方（含解包/其他非替代配方）强制并入，确保引擎按下拉指定生产
  for (const [itemClass, recipeClass] of outputRecipes.value) {
    map.set(itemClass, recipeClass)
  }
  return map
}

function removeOutputItem(value: string) {
  outputItems.value = outputItems.value.filter((v) => v !== value)
  const next = new Map(outputRates.value)
  next.delete(value)
  outputRates.value = next
  const nextRecipes = new Map(outputRecipes.value)
  nextRecipes.delete(value)
  outputRecipes.value = nextRecipes
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
  outputRecipes.value = new Map()
  emit('reset')
}

const paramsRef = ref<InstanceType<typeof PlanParams> | null>(null)

function runPlan() {
  if (!dataStore.index) return
  // 无产出且无输入原料时清空画布；只输入原料时也允许渲染节点
  if (!outputItems.value.length && !inputRates.value.size) {
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
    targetItemClass: outputItems.value[0] ?? '',
    targetRate: getItemRate(outputItems.value[0] ?? ''),
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
    icon: item.smallIcon ? getIconUrl(item.smallIcon) : undefined,
  }))
})

const itemLabelMap = computed(() => {
  const map = new Map<string, string>()
  for (const item of allItems.value) {
    map.set(item.value, item.label)
  }
  return map
})

/** 按配方 className 查找配方（recipes Map 以产物 itemClass 为 key，需遍历） */
function findRecipeByClass(recipeClass: string): GameRecipe | undefined {
  if (!dataStore.index) return undefined
  for (const recipeList of dataStore.index.recipes.values()) {
    const found = recipeList.find(r => r.className === recipeClass)
    if (found) return found
  }
  return undefined
}

/**
 * 从配置页已选配方重建「产出物品 → 配方」映射。
 * 仅匹配产自该配方（作为其任意产物）的产出物品；无匹配或未选任何配方时，
 * 产出使用默认原生配方（dropdown 显示 defaults）。
 */
function rebuildOutputRecipes(): void {
  const next = new Map<string, string>()
  for (const recipeClass of paramsRef.value?.selectedRecipes ?? []) {
    const recipe = findRecipeByClass(recipeClass)
    if (!recipe) continue
    for (const product of recipe.products) {
      if (outputItems.value.includes(product.itemClass)) {
        next.set(product.itemClass, recipeClass)
      }
    }
  }
  // 保留下拉中已选的非替代配方（如解包配方，不在配置页已选列表中）
  for (const [itemClass, recipeClass] of outputRecipes.value) {
    if (!next.has(itemClass)) {
      const recipe = findRecipeByClass(recipeClass)
      if (recipe && !recipe.isAlternate) next.set(itemClass, recipeClass)
    }
  }
  outputRecipes.value = next
}

// 配置页已选配方（替代配方 + 转换器配方）变化 → 反向同步产出下拉
watch(
  () => [paramsRef.value?.selectedRecipes, paramsRef.value?.selectedConverter],
  () => rebuildOutputRecipes(),
)

/** 产出物品当前应显示在配方下拉中的配方 */
const recipeValueOf = (itemClass: string): string | undefined => {
  return outputRecipes.value.get(itemClass) ?? outputRecipeDefaults.value.get(itemClass)
}

/** 下拉切换配方：写入产出级选择，并同步到配置页已选替代配方列表 */
function changeOutputRecipe(itemClass: string, recipeClass: string): void {
  outputRecipes.value = new Map(outputRecipes.value).set(itemClass, recipeClass)
  const recipe = findRecipeByClass(recipeClass)

  // 先移除配置页中所有产出该物品的已选配方（同一物品只用一种配方，
  // 避免切换替代配方时旧配方残留），再按需加入当前选中项。
  let next = (paramsRef.value?.selectedRecipes ?? []).filter((r) => {
    const rec = findRecipeByClass(r)
    return !(rec && rec.products.some((p) => p.itemClass === itemClass))
  })
  if (recipe?.isAlternate) {
    next = [...new Set([...next, recipeClass])]
  }
  if (paramsRef.value) paramsRef.value.selectedRecipes = next
  debounceRun()
}

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
            >
              <template #option="{ label, icon }">
                <div class="option-item">
                  <img v-if="icon" :src="icon" alt="" class="option-item-icon" />
                  <span v-else class="option-item-icon option-item-icon-placeholder">■</span>
                  <span class="option-item-label">{{ label }}</span>
                </div>
              </template>
            </a-select>
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
              :recipe-options="recipeOptionsMap.get(val)"
              :recipe-value="recipeValueOf(val)"
              @delete="removeOutputItem"
              @update:rate="updateItemRate"
              @change-recipe="changeOutputRecipe"
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
            >
              <template #option="{ label, icon }">
                <div class="option-item">
                  <img v-if="icon" :src="icon" alt="" class="option-item-icon" />
                  <span v-else class="option-item-icon option-item-icon-placeholder">■</span>
                  <span class="option-item-label">{{ label }}</span>
                </div>
              </template>
            </a-select>
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

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.option-item-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;
}
.option-item-icon-placeholder {
  color: var(--text-muted);
}
.option-item-label {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
