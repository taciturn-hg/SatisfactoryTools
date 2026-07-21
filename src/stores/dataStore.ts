/**
 * 数据状态管理（dataStore）
 *
 * 职责：加载游戏数据（zh-Hans.json），构建 DataIndex 并缓存到 IndexedDB，
 * 提供物品搜索接口供全局使用。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadAndParseGameData } from '@/lib/dataParser'
import { cacheData, loadCachedData } from '@/lib/db'
import type { DataIndex, GameItem } from '@/types'

export const useDataStore = defineStore('data', () => {
  /* ==================== 状态 ==================== */

  const index = ref<DataIndex | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  /* ==================== 计算属性 ==================== */

  /** 所有可制造/可采集的物品列表（按 displayName 排序） */
  const allItems = computed<GameItem[]>(() => {
    if (!index.value) return []
    return Array.from(index.value.items.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'zh-CN')
    )
  })

  /* ==================== 方法 ==================== */

  /**
   * 加载游戏数据，优先从 IndexedDB 缓存读取。
   *
   * 流程：检查缓存 → 命中则反序列化 → 未命中则 fetch JSON 解析 → 写入缓存
   * 加载过程中 isLoading = true，异常时设置 loadError。
   */
  async function loadData(): Promise<void> {
    if (isLoaded.value || isLoading.value) return

    isLoading.value = true
    loadError.value = null

    try {
      // 优先读取缓存
      const cached = await loadCachedData()
      if (cached) {
        index.value = cached
        isLoaded.value = true
        isLoading.value = false
        return
      }

      // 缓存未命中，从 JSON 解析
      const data = await loadAndParseGameData()

      // 写入缓存（后台执行，不阻塞 UI）
      cacheData(data).catch((err) => {
        console.warn('IndexedDB 缓存写入失败:', err)
      })

      index.value = data
      isLoaded.value = true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 按 displayName 模糊搜索物品。
   *
   * @param query 搜索关键词
   * @returns 匹配的物品数组，空字符串输入返回空数组
   */
  function searchItems(query: string): GameItem[] {
    if (!query.trim() || !index.value) return []

    const q = query.trim().toLowerCase()
    return Array.from(index.value.items.values()).filter((item) =>
      item.displayName.toLowerCase().includes(q)
    )
  }

  /**
   * 根据 className 获取物品
   */
  function getItem(className: string): GameItem | undefined {
    return index.value?.items.get(className)
  }

  return {
    index,
    isLoaded,
    isLoading,
    loadError,
    allItems,
    loadData,
    searchItems,
    getItem,
  }
})
