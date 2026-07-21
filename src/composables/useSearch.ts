/**
 * 搜索组合式函数
 *
 * 职责：封装搜索交互逻辑（防抖、过滤），供产出/原料页签使用。
 * 当前使用 dataStore 的真实数据，未接入时降级返回空数组。
 */

import { ref, computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import type { GameItem } from '@/types'

export function useSearch() {
  const dataStore = useDataStore()
  const query = ref('')
  const isSearching = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /** 过滤后的搜索结果 */
  const suggestions = computed<GameItem[]>(() => {
    if (!query.value.trim()) return []
    if (!dataStore.isLoaded) return []
    return dataStore.searchItems(query.value)
  })

  /** 带 200ms 防抖的搜索 */
  function search(q: string): void {
    query.value = q
    isSearching.value = true

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      isSearching.value = false
    }, 200)
  }

  function selectItem(item: GameItem): void {
    query.value = item.displayName
  }

  return {
    query,
    suggestions,
    isSearching,
    search,
    selectItem,
  }
}
