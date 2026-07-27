/**
 * 发电计划状态管理
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { calculatePowerPlan } from '@/lib/powerEngine'
import type { PowerPlanOptions, PowerPlanResult } from '@/types'

export const usePowerStore = defineStore('power', () => {
  const currentOptions = ref<PowerPlanOptions | null>(null)
  const currentResult = ref<PowerPlanResult | null>(null)
  const isComputing = ref(false)
  const error = ref<string | null>(null)

  function compute(options: PowerPlanOptions) {
    const dataStore = useDataStore()
    if (!dataStore.index) {
      error.value = '数据未加载'
      return
    }

    isComputing.value = true
    currentOptions.value = options
    error.value = null

    try {
      const result = calculatePowerPlan(options, dataStore.index)
      currentResult.value = result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[powerStore] error:', msg)
      error.value = msg
      currentResult.value = null
    } finally {
      isComputing.value = false
    }
  }

  function reset() {
    currentOptions.value = null
    currentResult.value = null
    error.value = null
  }

  return {
    currentOptions,
    currentResult,
    isComputing,
    error,
    compute,
    reset,
  }
})
