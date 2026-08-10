/**
 * 配方下拉共享模块
 *
 * 产出页（RightPanel）与配置页（PlanParams）的配方下拉使用相同的
 * 选项数据结构、速率计算与卡片渲染。此模块集中定义类型与纯函数，
 * 避免在多个组件中重复复制。
 */

import type { DataIndex } from '@/types'
import { getIconUrl } from '@/lib/iconRegistry'

/** 配方卡片中单个原料/产物条目 */
export interface RecipeIoItem {
  name: string
  icon?: string
  rate: number
}

/** 配方下拉选项（含原料/产物详情，供 #option 插槽渲染） */
export interface RecipeOption {
  value: string
  label: string
  displayName: string
  ingredients: RecipeIoItem[]
  products: RecipeIoItem[]
}

/** 查找物品显示名，未命中时回退到 className */
export function itemDisplayName(index: DataIndex | null | undefined, itemClass: string): string {
  return index?.items.get(itemClass)?.displayName ?? itemClass
}

/** 获取物品图标 URL（无图标时返回 undefined） */
export function itemIcon(index: DataIndex | null | undefined, itemClass: string): string | undefined {
  const icon = index?.items.get(itemClass)?.smallIcon
  return icon ? getIconUrl(icon) : undefined
}

/** 配方原料/产物的每分钟速率：amount / 制造时长(秒) × 60，保持浮点原生精度 */
export function ratePerMinute(amount: number, duration: number): number {
  if (duration <= 0 || amount <= 0) return 0
  const rpm = (amount / duration) * 60
  return Number.isFinite(rpm) ? rpm : 0
}

/** 格式化每分钟速率：四舍五入到小数点后 3 位，去掉尾随零（3.5 → "3.5"、3.75 → "3.75"、3.755 → "3.755"） */
export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 1000) / 1000
  return String(rounded)
}

/**
 * 生成某物品的全部可制造配方下拉选项（原生在前、替代在后带「替代」前缀、解包带「解包:」前缀）。
 * 不排除 Converter/解包配方——用户显式选择时引擎 alternatives 早返回直接采用。
 * 资源类物品（水/煤/原油等）无配方可改，返回空数组（调用方据此隐藏下拉）。
 */
export function buildRecipeOptions(index: DataIndex, itemClass: string): RecipeOption[] {
  const recipeList = index.recipes.get(itemClass)
  if (!recipeList || recipeList.length === 0) return []
  return [...recipeList]
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
          name: itemDisplayName(index, i.itemClass),
          icon: itemIcon(index, i.itemClass),
          rate: ratePerMinute(i.amount, r.manufactoringDuration),
        })),
        products: r.products.map(p => ({
          name: itemDisplayName(index, p.itemClass),
          icon: itemIcon(index, p.itemClass),
          rate: ratePerMinute(p.amount, r.manufactoringDuration),
        })),
      }
    })
}
