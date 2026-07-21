/**
 * 规划状态管理（planStore）
 *
 * 职责：管理当前规划的目标物品、产量、选择的替代配方和副产物策略，
 * 调用生产引擎计算并存储结果。
 *
 * 当前阶段：仅定义状态和方法结构，待阶段三完成后接入 productionEngine。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlanOptions, ProductionGraph } from '@/types'
import type { ByproductStrategy } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  /* ==================== 状态 ==================== */

  /** 当前规划参数 */
  const currentPlan = ref<PlanOptions | null>(null)

  /** 当前生产图（计算结果） */
  const currentGraph = ref<ProductionGraph | null>(null)

  /** 是否正在计算 */
  const isComputing = ref(false)

  /** 计算错误信息 */
  const computeError = ref<string | null>(null)

  /* ==================== 方法 ==================== */

  /**
   * 设置目标物品和产量
   */
  function setTarget(itemClass: string, rate: number): void {
    currentPlan.value = {
      ...(currentPlan.value ?? {
        targetItemClass: '',
        targetRate: 0,
        alternativeRecipes: new Map(),
        byproductStrategy: 'discard' as ByproductStrategy,
        layoutDirection: 'vertical',
      }),
      targetItemClass: itemClass,
      targetRate: rate,
    }
  }

  /**
   * 选择指定物品的替代配方
   */
  function selectAlternativeRecipe(itemClass: string, recipeClass: string): void {
    if (!currentPlan.value) return
    const map = new Map(currentPlan.value.alternativeRecipes)
    map.set(itemClass, recipeClass)
    currentPlan.value = { ...currentPlan.value, alternativeRecipes: map }
  }

  /**
   * 设置副产物处理策略
   */
  function setByproductStrategy(strategy: ByproductStrategy): void {
    if (!currentPlan.value) return
    currentPlan.value = { ...currentPlan.value, byproductStrategy: strategy }
  }

  /**
   * 设置流程图布局方向
   */
  function setLayoutDirection(dir: 'vertical' | 'horizontal'): void {
    if (!currentPlan.value) return
    currentPlan.value = { ...currentPlan.value, layoutDirection: dir }
  }

  /**
   * 执行规划计算。
   * 当前为占位实现，待 productionEngine 完成后接入。
   */
  async function compute(): Promise<void> {
    if (!currentPlan.value) return

    isComputing.value = true
    computeError.value = null

    try {
      // TODO: 接入 productionEngine.planProduction(index, options)
      // const graph = planProduction(dataStore.index!, currentPlan.value)
      // currentGraph.value = graph
    } catch (e) {
      computeError.value = (e as Error).message
    } finally {
      isComputing.value = false
    }
  }

  /**
   * 重置规划状态
   */
  function reset(): void {
    currentPlan.value = null
    currentGraph.value = null
    computeError.value = null
  }

  return {
    currentPlan,
    currentGraph,
    isComputing,
    computeError,
    setTarget,
    selectAlternativeRecipe,
    setByproductStrategy,
    setLayoutDirection,
    compute,
    reset,
  }
})
