<script setup lang="ts">
import { ref, computed } from 'vue'
import ItemDetail from '@/components/right-panel/ItemDetail.vue'
import PlanParams from '@/components/right-panel/PlanParams.vue'
import PlanActions from '@/components/right-panel/PlanActions.vue'

const activeTab = ref<'output' | 'input' | 'config'>('output')

const outputItems = ref<string[]>([])
const inputItems = ref<string[]>([])

function removeOutputItem(value: string) {
  outputItems.value = outputItems.value.filter((v) => v !== value)
}
function removeInputItem(value: string) {
  inputItems.value = inputItems.value.filter((v) => v !== value)
}
function resetList() {
  outputItems.value = []
  inputItems.value = []
}

const allItems = [
  { value: 'iron_plate', label: '铁板' },
  { value: 'iron_rod', label: '铁棒' },
  { value: 'screw', label: '螺丝' },
  { value: 'cable', label: '电缆' },
  { value: 'copper_plate', label: '铜板' },
  { value: 'wire', label: '铜线' },
  { value: 'reinforced_plate', label: '强化铁板' },
  { value: 'concrete', label: '混凝土' },
  { value: 'steel_pipe', label: '钢管' },
  { value: 'steel_beam', label: '钢梁' },
  { value: 'rotor', label: '转子' },
  { value: 'stator', label: '定子' },
  { value: 'motor', label: '电动机' },
  { value: 'frame', label: '框架' },
  { value: 'heavy_frame', label: '重型框架' },
  { value: 'computer', label: '计算机' },
  { value: 'circuit_board', label: '电路板' },
  { value: 'rubber', label: '橡胶' },
  { value: 'plastic', label: '塑料' },
  { value: 'fuel', label: '燃油' },
]

const selectedItem = ref<string | undefined>(undefined)

const itemLabelMap = new Map(allItems.map(i => [i.value, i.label]))

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
  }
  selectedItem.value = undefined
}

// 移除已选中的物品使下拉框不显示已添加的选项
const availableItems = computed(() =>
  allItems.filter(item => !currentList.value.includes(item.value))
)
</script>

<template>
  <aside class="right-panel">
    <div class="tab-nav">
      <button class="tab-item" :class="{ active: activeTab === 'output' }" @click="activeTab = 'output'">产出</button>
      <button class="tab-item" :class="{ active: activeTab === 'input' }" @click="activeTab = 'input'">原料</button>
      <button class="tab-item" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">配置</button>
    </div>

    <template v-if="activeTab === 'output'">
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
            @delete="removeOutputItem"
          />
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'input'">
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
            @delete="removeInputItem"
          />
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'config'">
      <div class="panel-content config-content">
        <PlanParams />
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

.item-list-placeholder {
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.item-list {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
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
