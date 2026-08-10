/**
 * UI 状态管理（uiStore）
 *
 * 职责：管理全局 UI 状态（选中物品、弹窗开关、主题等）。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GameItem, ProductionNode } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const selectedItem = ref<GameItem | null>(null)
  const selectedNode = ref<ProductionNode | null>(null)
  const isNodeDetailModalOpen = ref(false)
  const isSavePlanModalOpen = ref(false)
  const searchQuery = ref('')
  const theme = ref<'dark' | 'light'>('dark')

  /**
   * 节点弹窗改配方产生的「物品 → 配方」覆盖（itemClass → recipeClass）。
   * 仅记录与引擎默认/产出页/配置页不同的选择；重算时并入 buildAlternativeMap（最高优先）。
   * 弹窗选原生配方时也可能记录（用户显式固定某物品配方，避免引擎重选）。
   */
  const recipeOverrides = ref(new Map<string, string>())

  function selectItem(item: GameItem | null): void {
    selectedItem.value = item
  }

  function selectNode(node: ProductionNode | null): void {
    selectedNode.value = node
  }

  function toggleNodeDetailModal(): void {
    isNodeDetailModalOpen.value = !isNodeDetailModalOpen.value
  }

  function toggleSavePlanModal(): void {
    isSavePlanModalOpen.value = !isSavePlanModalOpen.value
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  /** 为某物品设置配方覆盖（节点弹窗改配方） */
  function setRecipeOverride(itemClass: string, recipeClass: string): void {
    recipeOverrides.value = new Map(recipeOverrides.value).set(itemClass, recipeClass)
  }

  /** 清除某物品的配方覆盖（恢复引擎默认选配） */
  function clearRecipeOverride(itemClass: string): void {
    const next = new Map(recipeOverrides.value)
    next.delete(itemClass)
    recipeOverrides.value = next
  }

  /** 清空所有配方覆盖 */
  function clearRecipeOverrides(): void {
    recipeOverrides.value = new Map()
  }

  return {
    selectedItem,
    selectedNode,
    isNodeDetailModalOpen,
    isSavePlanModalOpen,
    searchQuery,
    theme,
    recipeOverrides,
    selectItem,
    selectNode,
    toggleNodeDetailModal,
    toggleSavePlanModal,
    setSearchQuery,
    toggleTheme,
    setRecipeOverride,
    clearRecipeOverride,
    clearRecipeOverrides,
  }
})
