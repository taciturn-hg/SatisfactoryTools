<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'

const emit = defineEmits<{ change: [] }>()

const dataStore = useDataStore()

/** 从 dataStore 获取所有替代配方（标准配方暂不列入） */
const alternateRecipes = computed(() => {
  if (!dataStore.index) return []
  const seen = new Set<string>()
  const result: { value: string; label: string }[] = []
  for (const recipeList of dataStore.index.recipes.values()) {
    for (const r of recipeList) {
      if (!r.isAlternate || seen.has(r.className)) continue
      seen.add(r.className)
      result.push({ value: r.className, label: r.displayName || r.className })
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

const converterRecipes = computed(() => {
  if (!dataStore.index) return []
  const seen = new Set<string>()
  const result: { value: string; label: string }[] = []
  for (const recipeList of dataStore.index.recipes.values()) {
    for (const r of recipeList) {
      if (seen.has(r.className)) continue
      if (r.producedIn.some((p) => p === 'Build_Converter')) {
        seen.add(r.className)
        result.push({ value: r.className, label: r.displayName || r.className })
      }
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

const selectedRecipes = ref<string[]>([])
const selectedConverter = ref<string[]>([])

// 目标参数
const targetRate = ref(1)

// 采矿机
const minerLevel = ref<string>('mk1')
const minerPurity = ref<string>('normal')

// 采油
const oilExtractor = ref<string>('oil_well')
const oilPurity = ref<string>('normal')

// 采水
const waterExtractor = ref<string>('water_extractor')
const waterPurity = ref<string>('normal')

// 采气
const gasPurity = ref<string>('normal')

// 传送
const beltSpeed = ref<string>('')
const pipeSpeed = ref<string>('')

// 超频
const powerShardCount = ref(0)
const somerCount = ref(0)

// 副产物循环
const byproductRecycling = ref<string>('on')

// 任一配置变更时通知父组件
watch(
  [selectedRecipes, selectedConverter, minerLevel, minerPurity,
   oilExtractor, oilPurity, waterExtractor, waterPurity, gasPurity,
   powerShardCount, byproductRecycling],
  () => emit('change'),
)

defineExpose({
  selectedRecipes,
  selectedConverter,
  targetRate,
  minerLevel,
  minerPurity,
  oilExtractor,
  oilPurity,
  waterExtractor,
  waterPurity,
  gasPurity,
  beltSpeed,
  pipeSpeed,
  powerShardCount,
  somerCount,
  byproductRecycling,
})
</script>

<template>
  <div class="plan-params">
    <div class="section-title">配方</div>

    <div class="param-section">
      <div class="param-label">替代配方</div>
      <a-select
        v-model:value="selectedRecipes"
        mode="multiple"
        placeholder="选择替代配方（无选项 = 标准配方）"
        :max-tag-count="1"
        :max-tag-placeholder="
          (omitted: { label: string }[]) => `已选 ${omitted.length + 1} 个替代配方`
        "
        show-search
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :filter-option="
          (input: string, option: { label: string }) =>
            option.label.toLowerCase().includes(input.toLowerCase())
        "
        :options="alternateRecipes"
        style="width: 100%"
        :listHeight="128"
        :virtual="false"
      >
        <template #dropdownRender="{ menuNode: menu }">
          <div>
            <component :is="menu" />
            <div class="dropdown-actions">
              <button
                class="dropdown-btn"
                @click="selectedRecipes = alternateRecipes.map((o) => o.value)"
              >
                全选
              </button>
              <button class="dropdown-btn" @click="selectedRecipes = []">清除</button>
            </div>
          </div>
        </template>
      </a-select>
    </div>

    <div class="param-section">
      <div class="param-label">转换器配方</div>
      <a-select
        v-model:value="selectedConverter"
        mode="multiple"
        placeholder="选择转换器配方（无选项 = 使用 Converter）"
        :max-tag-count="1"
        :max-tag-placeholder="
          (omitted: { label: string }[]) => `已选 ${omitted.length + 1} 个转换配方`
        "
        show-search
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :filter-option="
          (input: string, option: { label: string }) =>
            option.label.toLowerCase().includes(input.toLowerCase())
        "
        :options="converterRecipes"
        style="width: 100%"
        :listHeight="128"
        :virtual="false"
      >
        <template #dropdownRender="{ menuNode: menu }">
          <div>
            <component :is="menu" />
            <div class="dropdown-actions">
              <button
                class="dropdown-btn"
                @click="selectedConverter = converterRecipes.map((o) => o.value)"
              >
                全选
              </button>
              <button class="dropdown-btn" @click="selectedConverter = []">清除</button>
            </div>
          </div>
        </template>
      </a-select>
    </div>

    <div class="section-divider" />

    <div class="section-title">采集与运输</div>

    <div class="param-section">
      <div class="param-label">采矿机等级</div>
      <a-select
        v-model:value="minerLevel"
        placeholder="请选择"
        :options="[
          { value: 'mk1', label: 'Mk.1 （60/分钟 × 纯度）' },
          { value: 'mk2', label: 'Mk.2 （120/分钟 × 纯度）' },
          { value: 'mk3', label: 'Mk.3 （240/分钟 × 纯度）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采矿节点纯度</div>
      <a-select
        v-model:value="minerPurity"
        placeholder="请选择"
        :options="[
          { value: 'impure', label: '不纯 （×0.5 = 30/60/120）' },
          { value: 'normal', label: '中纯 （×1 = 60/120/240）' },
          { value: 'pure', label: '高纯 （×2 = 120/240/480）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采油建筑</div>
      <a-select
        v-model:value="oilExtractor"
        placeholder="请选择"
        :options="[
          { value: 'oil_well', label: '油井' },
          { value: 'resource_well', label: '资源提取器' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采油节点纯度</div>
      <a-select
        v-model:value="oilPurity"
        placeholder="请选择"
        :options="[
          { value: 'impure', label: '不纯 （×0.5）' },
          { value: 'normal', label: '中纯 （×1）' },
          { value: 'pure', label: '高纯 （×2）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采水建筑</div>
      <a-select
        v-model:value="waterExtractor"
        placeholder="请选择"
        :options="[
          { value: 'water_extractor', label: '抽水站 （固定 120/min）' },
          { value: 'resource_well', label: '资源提取器 （120/min × 纯度）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采水节点纯度</div>
      <a-select
        v-model:value="waterPurity"
        placeholder="请选择"
        :options="[
          { value: 'impure', label: '不纯 （×0.5）' },
          { value: 'normal', label: '中纯 （×1）' },
          { value: 'pure', label: '高纯 （×2）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采气节点纯度</div>
      <a-select
        v-model:value="gasPurity"
        placeholder="请选择"
        :options="[
          { value: 'impure', label: '不纯 （×0.5）' },
          { value: 'normal', label: '中纯 （×1）' },
          { value: 'pure', label: '高纯 （×2）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">最大传送速度</div>
      <a-select
        v-model:value="beltSpeed"
        placeholder="请选择"
        :options="[
          { value: 'belt_mk1', label: 'Mk.1 （60 物品/分钟）' },
          { value: 'belt_mk2', label: 'Mk.2 （120 物品/分钟）' },
          { value: 'belt_mk3', label: 'Mk.3 （270 物品/分钟）' },
          { value: 'belt_mk4', label: 'Mk.4 （480 物品/分钟）' },
          { value: 'belt_mk5', label: 'Mk.5 （780 物品/分钟）' },
          { value: 'belt_mk6', label: 'Mk.6 （1200 物品/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">最大流速</div>
      <a-select
        v-model:value="pipeSpeed"
        placeholder="请选择"
        :options="[
          { value: 'pipe_mk1', label: 'Mk.1 （300 m³/分钟）' },
          { value: 'pipe_mk2', label: 'Mk.2 （600 m³/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="section-divider" />

    <div class="section-title">超频</div>

    <div class="param-section">
      <div class="param-label">可用的能量碎片</div>
      <input type="number" class="param-input" v-model.number="powerShardCount" min="0" step="1" />
    </div>
    <div class="param-section">
      <div class="param-label">可用的索莫晶体</div>
      <input type="number" class="param-input" v-model.number="somerCount" min="0" step="1" />
    </div>

    <div class="section-divider" />

    <div class="section-title">副产物</div>
    <div class="param-section">
      <div class="radio-group">
        <label class="radio-item">
          <input type="radio" value="on" v-model="byproductRecycling" />
          <span>循环利用</span>
        </label>
        <label class="radio-item">
          <input type="radio" value="off" v-model="byproductRecycling" />
          <span>忽略副产物</span>
        </label>
      </div>
    </div>

    <div class="section-bottom-spacer" />
  </div>
</template>

<style scoped>
.plan-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 4px;
}

.section-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.section-bottom-spacer {
  height: 24px;
}

.param-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.param-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.param-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.param-input:focus {
  border-color: var(--color-primary);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.dropdown-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}
.dropdown-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.dropdown-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
