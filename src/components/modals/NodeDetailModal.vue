<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { useUiStore } from '@/stores/uiStore'
import { getIconUrl } from '@/lib/iconRegistry'
import { buildRecipeOptions, formatRate } from '@/lib/recipeOptions'
import type { RecipeOption } from '@/lib/recipeOptions'
import { formatClocks, deriveSomerPerMachine } from '@/lib/graphTransformer'
import { somerSlots } from '@/config/buildingConfig'
import RecipeOptionCard from '@/components/right-panel/RecipeOptionCard.vue'

const dataStore = useDataStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  'restore-default': [itemClass: string]
}>()

/** 当前选中节点的配方下拉选项（无配方可改时为空数组） */
const recipeOptions = computed<RecipeOption[]>(() => {
  const node = uiStore.selectedNode
  if (!node || !dataStore.index) return []
  return buildRecipeOptions(dataStore.index, node.itemClass)
})

/** 当前下拉值：优先覆盖值，其次节点实际用到的配方 */
const recipeValue = computed(() => {
  const node = uiStore.selectedNode
  if (!node) return undefined
  return uiStore.recipeOverrides.get(node.itemClass) ?? node.recipeUsed?.className
})

const itemIconSrc = computed(() => {
  const node = uiStore.selectedNode
  if (!node || !dataStore.index) return undefined
  const icon = dataStore.index.items.get(node.itemClass)?.smallIcon
  return icon ? getIconUrl(icon) : undefined
})

/** 资源叶子节点 / 副产物节点无配方可改，隐藏下拉 */
const canChangeRecipe = computed(() => {
  const node = uiStore.selectedNode
  if (!node) return false
  return node.recipeUsed !== null && recipeOptions.value.length > 0
})

/** 时钟分配片段（含晶体标记 *NSM，SM 部分染紫），如 [{t:'1×200%'},{t:'*1SM',sm:true}]；无机器时为空数组 */
const clockFragments = computed(() => {
  const node = uiStore.selectedNode
  if (!node || !node.machineClocks || node.machineClocks.length === 0) return []
  const somerTotal = node.somerMachines ?? 0
  const slots = somerSlots(node.machineType) ?? 1
  const somerPerMachine = deriveSomerPerMachine(somerTotal, slots, node.machineClocks.length)
  const info = formatClocks(node.machineClocks, somerPerMachine)
  const parts = info.split(/(\*[0-9]+SM)/g).filter(Boolean)
  return parts.map(p => ({ text: p, sm: /^\*[0-9]+SM$/.test(p) }))
})

/** 该节点安装的索莫晶体总数（NSM 标记里的 N） */
const somerTotal = computed(() => uiStore.selectedNode?.somerMachines ?? 0)

/** 从时钟分配反推该节点消耗的能量碎片总数（每台 1+0.5×n 颗，n∈[0,3]） */
const shardCount = computed(() => {
  const node = uiStore.selectedNode
  if (!node?.machineClocks) return 0
  let total = 0
  for (const c of node.machineClocks) {
    if (c > 1.01) total += Math.min(3, Math.max(0, Math.ceil((c - 1) / 0.5)))
  }
  return total
})

function onRecipeChange(recipeClass: string): void {
  const node = uiStore.selectedNode
  if (!node) return
  uiStore.setRecipeOverride(node.itemClass, recipeClass)
  close()
}

function onResetRecipe(): void {
  const node = uiStore.selectedNode
  if (!node) return
  emit('restore-default', node.itemClass)
  close()
}

function close(): void {
  uiStore.isNodeDetailModalOpen = false
}

/** 下拉面板挂载到 body，避免被弹窗容器裁剪 */
function dropdownContainer(): HTMLElement {
  return document.body
}
</script>

<template>
  <a-modal
    :open="uiStore.isNodeDetailModalOpen"
    :footer="null"
    :closable="true"
    :width="520"
    :title="uiStore.selectedNode?.itemName ?? '节点详情'"
    @cancel="close"
  >
    <div v-if="uiStore.selectedNode" class="node-detail">
      <div class="node-info">
        <div class="node-icon">
          <img v-if="itemIconSrc" :src="itemIconSrc" :alt="uiStore.selectedNode.itemName" class="node-icon-img" />
          <span v-else>■</span>
        </div>
        <div class="node-meta">
          <div class="meta-line">
            产出 <span class="meta-value">{{ formatRate(uiStore.selectedNode.rate) }}/min</span>
          </div>
          <div v-if="uiStore.selectedNode.machineType" class="meta-line">
            建筑 <span class="meta-value">
              {{ dataStore.index?.buildings.get(uiStore.selectedNode.machineType)?.displayName ?? uiStore.selectedNode.machineType }}
            </span>
          </div>
          <div v-if="uiStore.selectedNode.machineCount > 0" class="meta-line">
            台数 <span class="meta-value">{{ uiStore.selectedNode.machineClocks?.length ?? Math.ceil(uiStore.selectedNode.machineCount) }} 台</span>
          </div>
          <div v-if="clockFragments.length > 0" class="meta-line">
            时钟 <span class="meta-value">
              <template v-for="(frag, i) in clockFragments" :key="i">
                <span v-if="frag.sm" class="somer-inline">{{ frag.text }}</span>
                <template v-else>{{ frag.text }}</template>
              </template>
            </span>
          </div>
          <div v-if="shardCount > 0" class="meta-line">
            超频 <span class="meta-value">{{ shardCount }} 能量碎片</span>
          </div>
          <div v-if="somerTotal > 0" class="meta-line">
            晶体 <span class="meta-value">{{ somerTotal }}SM</span>
          </div>
        </div>
      </div>

      <div v-if="canChangeRecipe" class="recipe-section">
        <div class="recipe-section-title">生产配方</div>
        <a-select
          :value="recipeValue"
          class="recipe-select"
          :options="recipeOptions"
          :dropdown-match-select-width="480"
          :dropdown-style="{ minWidth: '480px' }"
          :getPopupContainer="dropdownContainer"
          @change="onRecipeChange"
        >
          <template #option="{ displayName, ingredients, products }">
            <RecipeOptionCard :option="{ displayName, ingredients, products }" />
          </template>
        </a-select>
        <button class="reset-btn" :disabled="!uiStore.recipeOverrides.has(uiStore.selectedNode.itemClass)" @click="onResetRecipe">
          恢复默认配方
        </button>
      </div>

      <div v-else class="no-recipe-tip">
        {{ uiStore.selectedNode.recipeUsed === null ? '该节点为资源/手动采集，无配方可改' : '该节点为副产物，配方由产生方决定' }}
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.node-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.node-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.node-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--text-muted);
}

.node-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-line {
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-value {
  color: var(--text-primary);
  font-weight: 500;
}

.somer-inline {
  color: var(--node-somer);
  font-weight: 700;
}

.recipe-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recipe-section-title {
  font-size: 13px;
  color: var(--text-secondary);
}

.recipe-select {
  width: 100%;
}

.reset-btn {
  align-self: flex-start;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-recipe-tip {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 0;
}
</style>
