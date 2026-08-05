/**
 * IndexedDB 缓存封装（Dexie）
 *
 * 职责：缓存解析后的 DataIndex 到 IndexedDB，避免每次刷新重新读取并解析 ~10MB 的 JSON。
 *
 * 由于 DataIndex 使用 Map 数据结构，Dexie 无法直接存储 Map，
 * 写入时将 Map 展开为数组，读取时重构 Map。
 */

import Dexie, { type EntityTable } from 'dexie'
import type { DataIndex, GameItem, GameRecipe, GameBuilding, GameGenerator } from '@/types'

/* ==================== 数据库定义 ==================== */

/** Dexie 持久化的物品记录 */
interface PersistedItem extends GameItem {
  className: string
}

/** Dexie 持久化的配方记录（用于按产物索引） */
interface PersistedRecipe extends GameRecipe {
  className: string
}

/** Dexie 持久化的配方记录（用于按原料索引） */
interface PersistedRecipeByIngredient extends GameRecipe {
  className: string
}

/** Dexie 持久化的建筑记录（统一包含 displayName、iconPath 等所有字段） */
interface PersistedBuilding extends GameBuilding {
  className: string
}

/** Dexie 持久化的发电机记录 */
interface PersistedGenerator extends GameGenerator {
  className: string
}

/** Dexie 数据库定义 */
const db = new Dexie('SatisfactoryToolsDB') as Dexie & {
  items: EntityTable<PersistedItem, 'className'>
  recipes: EntityTable<PersistedRecipe, 'className'>
  recipesByIngredient: EntityTable<PersistedRecipeByIngredient, 'className'>
  buildings: EntityTable<PersistedBuilding, 'className'>
  generators: EntityTable<PersistedGenerator, 'className'>
}

db.version(4).stores({
  items: 'className, displayName',
  recipes: 'className',
  recipesByIngredient: 'className',
  buildings: 'className',
  generators: 'className',
})

/* ==================== 序列化辅助 ==================== */

/**
 * 将数组按 className 重构为 Map
 * IndexedDB 只能存储 JSON 可序列化的数组，读取后需重新组织为 Map 结构
 */
function arrayToMapByClass<T extends { className: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    map.set(item.className, item)
  }
  return map
}

/**
 * 将 Map 展开为数组（Dexie 只接受对象数组）
 */
function recipesMapToArray(recipes: Map<string, GameRecipe[]>): PersistedRecipe[] {
  const result: PersistedRecipe[] = []
  for (const recipesOfItem of recipes.values()) {
    for (const recipe of recipesOfItem) {
      result.push(recipe)
    }
  }
  return result
}

/**
 * 将 recipes Map 按产物索引重新组织
 *
 * 注意：由于写入时 recipes 和 recipesByIngredient 可能各自包含同一个 recipe 对象的
 * 多次引用，反序列化后它们变为独立对象。这在 read-only 场景下安全（不共享引用），
 * 如果有人修改一个 Map 中的 recipe，不会影响另一个 Map。当前阶段只读，不影响。
 */
function recipesArrayToMap(recipes: PersistedRecipe[]): Map<string, GameRecipe[]> {
  const map = new Map<string, GameRecipe[]>()
  for (const recipe of recipes) {
    // 按产物索引：recipe.products 中的每种产物都作为 key
    for (const product of recipe.products) {
      const list = map.get(product.itemClass) ?? []
      list.push(recipe)
      map.set(product.itemClass, list)
    }
  }
  return map
}

/**
 * 将 recipesByIngredient 数组按原料重构为 Map
 */
function recipesByIngredientArrayToMap(
  recipes: PersistedRecipeByIngredient[],
): Map<string, GameRecipe[]> {
  const map = new Map<string, GameRecipe[]>()
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const list = map.get(ing.itemClass) ?? []
      list.push(recipe)
      map.set(ing.itemClass, list)
    }
  }
  return map
}

/* ==================== 读写接口 ==================== */

/** 缓存版本标识，若 DataIndex 结构变化可通过此值触发重建缓存 */
const CACHE_VERSION = 9

/** localStorage 中用于判断是否存在有效缓存的 key */
const CACHE_META_KEY = 'SatisfactoryTools_cache_version'

/**
 * 按 className 去重（同一个配方可能被多个产出物品索引，产生重复 className）
 */
function dedupByClass<T extends { className: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.className)) return false
    seen.add(item.className)
    return true
  })
}

/**
 * 将 DataIndex 写入 IndexedDB。
 *
 * Map 不能直接序列化，分两步：
 * 1. 将每个 Map 展开为对象数组
 * 2. 批量写入 Dexie 对应表
 *
 * 写入成功后，在 localStorage 中标记缓存版本号，用于后续快速判断是否需重新解析。
 */
export async function cacheData(index: DataIndex): Promise<void> {
  await db.transaction(
    'rw',
    db.items,
    db.recipes,
    db.recipesByIngredient,
    db.buildings,
    db.generators,
    async () => {
      // 清空旧数据
      await db.items.clear()
      await db.recipes.clear()
      await db.recipesByIngredient.clear()
      await db.buildings.clear()
      await db.generators.clear()

      // 批量写入
      await db.items.bulkAdd(Array.from(index.items.values()))
      await db.recipes.bulkAdd(dedupByClass(recipesMapToArray(index.recipes)))
      await db.recipesByIngredient.bulkAdd(
        dedupByClass(recipesMapToArray(index.recipesByIngredient)),
      )
      await db.buildings.bulkAdd(Array.from(index.buildings.values()))
      await db.generators.bulkAdd(Array.from(index.generators.values()))
    },
  )

  try {
    localStorage.setItem(CACHE_META_KEY, String(CACHE_VERSION))
  } catch {
    // 隐私模式下 localStorage 可能不可用
  }
}

/**
 * 从 IndexedDB 读取缓存的 DataIndex。
 *
 * 从各表读取全部记录后，重构为 Map 结构。
 *
 * @returns 缓存的 DataIndex，若缓存不存在或版本不匹配返回 null
 */
export async function loadCachedData(): Promise<DataIndex | null> {
  try {
    // 快速检测：localStorage 中的版本号不匹配说明缓存无效
    // 注意：getItem 在隐私模式下可能抛出 SecurityError，放入 try 块保护
    if (localStorage.getItem(CACHE_META_KEY) !== String(CACHE_VERSION)) {
      return null
    }
  } catch {
    return null
  }

  try {
    // 并行读取所有表
    const [items, recipes, recipesByIngredient, buildings, generators] =
      await Promise.all([
        db.items.toArray(),
        db.recipes.toArray(),
        db.recipesByIngredient.toArray(),
        db.buildings.toArray(),
        db.generators.toArray(),
      ])

    if (items.length === 0 && recipes.length === 0) {
      return null
    }

    return {
      items: arrayToMapByClass(items),
      recipes: recipesArrayToMap(recipes),
      recipesByIngredient: recipesByIngredientArrayToMap(recipesByIngredient),
      buildings: arrayToMapByClass(buildings),
      generators: arrayToMapByClass(generators),
    }
  } catch {
    // IndexedDB 不可用（如隐私模式）或数据损坏，清理标记后返回 null
    try {
      localStorage.removeItem(CACHE_META_KEY)
    } catch {
      /* 隐私模式下 removeItem 也可能失败 */
    }
    return null
  }
}
