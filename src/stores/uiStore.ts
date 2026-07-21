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

  return {
    selectedItem,
    selectedNode,
    isNodeDetailModalOpen,
    isSavePlanModalOpen,
    searchQuery,
    theme,
    selectItem,
    selectNode,
    toggleNodeDetailModal,
    toggleSavePlanModal,
    setSearchQuery,
    toggleTheme,
  }
})
