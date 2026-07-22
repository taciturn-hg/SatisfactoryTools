/**
 * 游戏 JSON 数据解析器
 *
 * 职责：将 zh-Hans.json（UTF-16 LE 编码）解析为结构化的 DataIndex，
 * 包含物品、配方、建筑、发电机的 Map 索引和反向索引。
 *
 * 所有函数均为纯函数，不依赖 Vue 或浏览器 API（除原始数据加载外）。
 */

import type {
  DataIndex, GameItem, GameRecipe, GameBuilding, GameGenerator,
  FuelEntry, ItemAmount, ItemForm,
} from '@/types'

/* ==================== 类型 ==================== */

/** UE 格式中表示堆叠大小的字符串枚举 */
type StackSizeStr = 'SS_ONE' | 'SS_SMALL' | 'SS_MEDIUM' | 'SS_BIG' | 'SS_HUGE' | 'SS_FLUID'

/** UE 格式中表示物品形态的字符串枚举，用于 parseItemForm 的类型约束 */
type FormStr = 'RF_SOLID' | 'RF_LIQUID' | 'RF_GAS' | 'RF_INVALID'

/* ==================== 字段值转换 ==================== */

/** 将 UE 布尔值字符串转换为 JavaScript 布尔值 */
function parseBoolean(value: string): boolean {
  return value === 'True'
}

/** 将 UE 浮点数字符串转换为 number，无法解析时返回 0 */
function parseFloatValue(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** 将 UE 整数字符串转换为 number，无法解析时返回 0 */
function parseIntValue(value: string): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

/** 将 RF_SOLID 等枚举转为 ItemForm 类型，无效值返回 undefined */
function parseItemForm(form: string): ItemForm | undefined {
  const map: Partial<Record<FormStr, ItemForm>> = {
    RF_SOLID: 'solid',
    RF_LIQUID: 'liquid',
    RF_GAS: 'gas',
  }
  return map[form as FormStr]
}

/** 从 mStackSize 枚举字符串获取最大堆叠数，部分物品 mCachedStackSize 更准确 */
function parseStackSizeForm(raw: string): number {
  const map: Record<StackSizeStr, number> = {
    SS_ONE: 1,
    SS_SMALL: 50,
    SS_MEDIUM: 100,
    SS_BIG: 200,
    SS_HUGE: 500,
    SS_FLUID: 0,
  }
  return map[raw as StackSizeStr] ?? 100
}

/** 从 UE 路径中提取相对于 assets/icons/ 的路径。
 *  输入: "Texture2D /Game/FactoryGame/Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.IconDesc_IronPlates_256"
 *  输出: "FactoryGame/Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.png"
 *  取 /Game/ 之后的部分，去掉末尾 .同名 后缀，补 .png */
function extractIconPath(raw: string): string | undefined {
  if (!raw || raw === 'None') return undefined
  const path = raw.replace(/^Texture2D /, '').trim()
  const idx = path.indexOf('/Game/')
  if (idx === -1) {
    // 降级：取末尾同名资源名
    const fallback = path.match(/\/([A-Za-z0-9_]+)\.\1$/)
    return fallback ? fallback[1]! + '.png' : undefined
  }
  const relative = path.slice(idx + '/Game/'.length)
  // 去掉末尾 .同名 后缀，如 IconDesc_IronPlates_256.IconDesc_IronPlates_256 → IconDesc_IronPlates_256
  const cleaned = relative.replace(/([A-Za-z0-9_]+)\.\1$/, '$1')
  return cleaned + '.png'
}

/* ==================== UE 内联属性解析 ==================== */

/**
 * 解析 UE 的 ((ItemClass="...",Amount=N),...) 格式字符串。
 *
 * 该格式用于 mIngredients 和 mProduct 字段：
 *   ((ItemClass="path'ClassName_C'",Amount=N))
 * 多条目：((ItemClass="...",Amount=N),(ItemClass="...",Amount=M))
 * 空值：""（空字符串表示无原料/无产物）
 *
 * @returns 解析后的 ItemAmount 数组，空字符串入参返回空数组
 */
function parseUEItemAmountPairs(text: string): ItemAmount[] {
  if (!text) return []

  const results: ItemAmount[] = []

  // 匹配每对 ItemClass + Amount
  // 正则说明：
  //   ItemClass="...ClassName_C'  → 提取末尾的 ClassName（利用同名模式 ClassName.ClassName_C）
  //   Amount=数字                 → 提取数量（整数或小数）
  const pairPattern = /([A-Za-z0-9_]+)\.\1_C'[^)]*?Amount=([\d.]+)/g
  let match: RegExpExecArray | null

  while ((match = pairPattern.exec(text)) !== null) {
    results.push({
      itemClass: match[1]! + '_C', // 补回 _C 后缀以匹配 items Map 的 key
      amount: parseFloatValue(match[2]!), // 捕获组2: Amount（如 "3"）
    })
  }

  return results
}

/**
 * 解析 UE 的 ("path/A.B_C","path/C.D_C") 格式字符串。
 *
 * 该格式用于 mProducedIn、mDefaultFuelClasses 等字段：
 *   ("/Game/.../Build_ConstructorMk1.Build_ConstructorMk1_C","/Game/.../BP_WorkBenchComponent.BP_WorkBenchComponent_C")
 * 空值："" 或 "()"
 *
 * 从每个路径条目中提取末尾的 ClassName。
 *   /Game/.../Build_ConstructorMk1.Build_ConstructorMk1_C  → Build_ConstructorMk1
 *   /Script/FactoryGame.FGBuildableAutomatedWorkBench       → FGBuildableAutomatedWorkBench
 *
 * @returns 提取的 ClassName 数组
 */
export function parseUEProducedIn(text: string): string[] {
  if (!text || text === '()') return []

  const results: string[] = []

  // 1. 提取所有引号内的路径字符串
  //    移除首尾的 ()，再匹配 "..." 之间的内容
  const content = text.replace(/^\(|\)$/g, '')
  const pathPattern = /"([^"]+)"/g
  let pathMatch: RegExpExecArray | null

  while ((pathMatch = pathPattern.exec(content)) !== null) {
    const path = pathMatch[1]!

    // 2. 尝试匹配 ClassName.ClassName_C 模式（最常见）
    //    如: /.../Build_ConstructorMk1.Build_ConstructorMk1_C
    const classMatch = path.match(/([A-Za-z0-9_]+)\.\1_C$/)
    if (classMatch) {
      results.push(classMatch[1]!)
      continue
    }

    // 3. 降级：取最后一个 / 之后到末尾的部分
    //    如: /Script/FactoryGame.FGBuildableAutomatedWorkBench
    const lastSegment = path.split('/').pop()
    if (lastSegment) {
      // Script 路径: FactoryGame.FGBuildableAutomatedWorkBench → 取第二个
      // 简单路径: Build_ConstructorMk1（无.） → 直接取
      const dotParts = lastSegment.split('.')
      const name = dotParts.length >= 2 ? dotParts[dotParts.length - 1]! : dotParts[0]!
      // 补回 _C 后缀以匹配 buildings Map 的 key（buildings 以 className 原始值索引）
      if (name) results.push(name)
    }
  }

  return results
}

/**
 * 解析 UE 的 mFuel 字段。
 *
 * 特别注意：mFuel 在 JSON 中已经是解析好的数组（不是字符串），
 * 但每个元素使用原始字段名（如 mFuelClass）。
 * 此函数处理可能为字符串的边界情况，并统一转换为 FuelEntry[]。
 */
function parseFuelEntries(raw: unknown): FuelEntry[] {
  // 已解析为数组（最常见情况）
  if (Array.isArray(raw)) {
    return raw.map((entry: Record<string, string>) => ({
      fuelClass: entry.mFuelClass ?? entry.fuelClass ?? '',
      supplementalResourceClass: entry.mSupplementalResourceClass || undefined,
      byproduct: entry.mByproduct || undefined,
      byproductAmount: entry.mByproductAmount || undefined,
    }))
  }

  // 极少数情况：可能为字符串格式
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parseFuelEntries(parsed)
    } catch {
      // 非标准 JSON 格式时尝试 UE 格式解析
      return parseUEProducedIn(raw).map(cn => ({ fuelClass: cn }))
    }
  }

  return []
}

/* ==================== NativeClass 提取 ==================== */

/**
 * 从 UE 完整 NativeClass 路径中提取简短的类名。
 *
 * 输入: "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'"
 * 输出: "FGItemDescriptor"
 *
 * 用于在 switch-case 中判断当前块属于哪类数据。
 */
function extractNativeClass(nativeClass: string): string {
  // 取最后一个 . 或 / 之后的内容，再去掉尾部可能存在的 '
  const short = nativeClass.replace(/.*[./]/, '').replace(/'$/, '')
  return short
}

/* ==================== 数据结构解析 ==================== */

/**
 * 将 FGItemDescriptor 及其子类的原始属性对象解析为 GameItem。
 *
 * 适用于：FGItemDescriptor、FGResourceDescriptor、FGItemDescriptorBiomass、
 *         FGItemDescriptorNuclearFuel、FGPowerShardDescriptor、FGItemDescriptorPowerBoosterFuel。
 *
 * 核燃料和能量碎片的额外字段（mSpentFuelClass、mPowerShardType 等）暂不提取，
 * 后续有需要时可通过 raw 扩展。
 */
function parseItem(raw: Record<string, string>, isResource = false): GameItem {
  const displayName = raw.mDisplayName || ''
  const stackSizeRaw = raw.mCachedStackSize
    ? parseIntValue(raw.mCachedStackSize)
    : parseStackSizeForm(raw.mStackSize || '')

  return {
    className: raw.ClassName ?? '',
    displayName,
    description: raw.mDescription ?? '',
    stackSize: stackSizeRaw > 0 ? stackSizeRaw : 100,
    energyValue: parseFloatValue(raw.mEnergyValue ?? '0'),
    radioactiveDecay: parseFloatValue(raw.mRadioactiveDecay ?? '0'),
    form: parseItemForm(raw.mForm ?? '') ?? 'solid',
    smallIcon: extractIconPath(raw.mSmallIcon ?? ''),
    persistentBigIcon: extractIconPath(raw.mPersistentBigIcon ?? ''),
    resourceSinkPoints: raw.mResourceSinkPoints
      ? parseIntValue(raw.mResourceSinkPoints)
      : undefined,
    isAlienItem: raw.mIsAlienItem ? parseBoolean(raw.mIsAlienItem) : undefined,
    isResource,
  }
}

/**
 * 将 FGRecipe 的原始属性对象解析为 GameRecipe。
 *
 * 关键解析逻辑：
 * - mIngredients / mProduct：UE 内联格式 → parseUEItemAmountPairs()
 * - mProducedIn：UE 括号字符串数组 → parseUEProducedIn()
 * - 替代配方识别：ClassName 以 Recipe_Alternate_ 开头
 */
function parseRecipe(raw: Record<string, string>): GameRecipe {
  const className = raw.ClassName ?? ''

  return {
    className,
    displayName: raw.mDisplayName || '',
    ingredients: parseUEItemAmountPairs(raw.mIngredients ?? ''),
    products: parseUEItemAmountPairs(raw.mProduct ?? ''),
    manufactoringDuration: parseFloatValue(raw.mManufactoringDuration ?? '1'),
    producedIn: parseUEProducedIn(raw.mProducedIn ?? ''),
    isAlternate: className.startsWith('Recipe_Alternate_'),
    variablePowerConsumptionConstant: raw.mVariablePowerConsumptionConstant
      ? parseFloatValue(raw.mVariablePowerConsumptionConstant)
      : undefined,
    variablePowerConsumptionFactor: raw.mVariablePowerConsumptionFactor
      ? parseFloatValue(raw.mVariablePowerConsumptionFactor)
      : undefined,
  }
}

/**
 * 将 FGBuildingDescriptor 的原始属性对象解析为 GameBuilding。
 *
 * 注意：多数建筑是墙体、地基等装饰物，与产线无关。
 * 筛选逻辑放在调用方（可按 mSubCategories 过滤）。
 *
 * 特殊情况：部分建筑的 mDisplayName 为空字符串（如 Desc_WorkBench_C），
 * 此时 displayName 保持空，由调用方或 UI 做降级展示。
 */
function parseBuilding(raw: Record<string, string>): GameBuilding {
  return {
    className: raw.ClassName ?? '',
    displayName: raw.mDisplayName || '',
    description: raw.mDescription ?? '',
    iconPath: extractIconPath(raw.mSmallIcon ?? ''),
    powerConsumption: raw.mPowerConsumption
      ? parseFloatValue(raw.mPowerConsumption)
      : undefined,
    cachedStackSize: raw.mCachedStackSize
      ? parseIntValue(raw.mCachedStackSize)
      : undefined,
  }
}

/**
 * 将 FGBuildableGeneratorFuel / FGBuildableGeneratorNuclear /
 * FGBuildableGeneratorGeoThermal / FGBuildablePowerBooster /
 * FGBuildablePowerStorage 的原始属性对象解析为 GameGenerator。
 *
 * 由于这 5 种发电机/电力块的字段有较大差异，使用可选字段区分：
 *
 * TODO: 后续应改为 discriminated union 或拆分独立接口，让类型系统约束各发电机类型的合法字段，
 *       避免 Fuel 发电机访问地热专用字段等运行时错误。当前 20+ 可选字段让类型系统无法提供窄化能力。
 * - 燃料发电机：powerProduction + fuel[] + 超频相关字段
 * - 核电站：同上 + wasteLeftFromCurrentFuel
 * - 地热发电机：variablePower* 系列字段，无燃料
 * - 外星能源增强器：暂仅提取基础字段
 * - 蓄电池：powerStore* 系列字段（暂仅存储，不参与当前计算）
 */
function parseGenerator(raw: Record<string, string>): GameGenerator {
  const generator: GameGenerator = {
    className: raw.ClassName ?? '',
    displayName: raw.mDisplayName || '',
    description: raw.mDescription ?? '',
    powerProduction: parseFloatValue(raw.mPowerProduction ?? '0'),
    fuel: parseFuelEntries(raw.mFuel),
    fuelLoadAmount: raw.mFuelLoadAmount ? parseIntValue(raw.mFuelLoadAmount) : undefined,
    requiresSupplementalResource: raw.mRequiresSupplementalResource
      ? parseBoolean(raw.mRequiresSupplementalResource)
      : undefined,
    supplementalLoadAmount: raw.mSupplementalLoadAmount
      ? parseIntValue(raw.mSupplementalLoadAmount)
      : undefined,
    supplementalToPowerRatio: raw.mSupplementalToPowerRatio
      ? parseFloatValue(raw.mSupplementalToPowerRatio)
      : undefined,
    isFullBlast: raw.mIsFullBlast ? parseBoolean(raw.mIsFullBlast) : undefined,
    canChangePotential: raw.mCanChangePotential
      ? parseBoolean(raw.mCanChangePotential)
      : undefined,
    canChangeProductionBoost: raw.mCanChangeProductionBoost
      ? parseBoolean(raw.mCanChangeProductionBoost)
      : undefined,
    minPotential: raw.mMinPotential ? parseFloatValue(raw.mMinPotential) : undefined,
    maxPotential: raw.mMaxPotential ? parseFloatValue(raw.mMaxPotential) : undefined,
    baseProductionBoost: raw.mBaseProductionBoost
      ? parseFloatValue(raw.mBaseProductionBoost)
      : undefined,
    powerConsumptionExponent: raw.mPowerConsumptionExponent
      ? parseFloatValue(raw.mPowerConsumptionExponent)
      : undefined,
    productionBoostPowerConsumptionExponent: raw.mProductionBoostPowerConsumptionExponent
      ? parseFloatValue(raw.mProductionBoostPowerConsumptionExponent)
      : undefined,
    // 地热发电机专用
    variablePowerProductionConstant: raw.mVariablePowerProductionConstant
      ? parseFloatValue(raw.mVariablePowerProductionConstant)
      : undefined,
    variablePowerProductionFactor: raw.mVariablePowerProductionFactor
      ? parseFloatValue(raw.mVariablePowerProductionFactor)
      : undefined,
    variablePowerProductionCycleLength: raw.mVariablePowerProductionCycleLength
      ? parseFloatValue(raw.mVariablePowerProductionCycleLength)
      : undefined,
    minPowerProduction: raw.mMinPowerProduction
      ? parseFloatValue(raw.mMinPowerProduction)
      : undefined,
    maxPowerProduction: raw.mMaxPowerProduction
      ? parseFloatValue(raw.mMaxPowerProduction)
      : undefined,
    // 核电站专用
    wasteLeftFromCurrentFuel: raw.mWasteLeftFromCurrentFuel
      ? parseIntValue(raw.mWasteLeftFromCurrentFuel)
      : undefined,
    currentGeneratorNuclearWarning: raw.mCurrentGeneratorNuclearWarning || undefined,
  }

  return generator
}

/* ==================== 索引构建 ==================== */

/**
 * 遍历 114 个数据块，按 NativeClass 分发到不同的解析函数，构建 DataIndex。
 *
 * 处理流程：
 * 1. 提取每个块的 NativeClass 简名
 * 2. 根据简名分发到对应解析函数
 * 3. 物品类块 → items Map（className → GameItem）
 * 4. 配方类块 → recipes Map（产出物品 className → GameRecipe[]）
 *                + recipesByIngredient Map（原料 className → GameRecipe[]）
 * 5. 建筑描述符块 → buildings Map（className → GameBuilding）
 * 6. 发电机/电力块 → generators Map（className → GameGenerator）
 * 7. 无关块 → 跳过
 *
 * @param rawJson 从 zh-Hans.json 解析出来的顶层数组
 * @returns 构建完成的 DataIndex
 */
export function parseGameData(rawJson: unknown[]): DataIndex {
  const index: DataIndex = {
    items: new Map(),
    recipes: new Map(),
    recipesByIngredient: new Map(),
    buildings: new Map(),
    generators: new Map(),
  }

  for (const block of rawJson) {
    // 每个块必须有 NativeClass 和 Classes 字段
    const nativeClass = extractNativeClass(String((block as Record<string, unknown>).NativeClass ?? ''))
    const classes = (block as Record<string, unknown>).Classes as Record<string, string>[]
    if (!classes || !Array.isArray(classes)) continue

    // 所有 FGBuildable* 块统一提取中文建筑名 + 功耗，合并到 buildings Map
    if (nativeClass.startsWith('FGBuildable')) {
      for (const raw of classes) {
        const cn = raw.ClassName ?? ''
        const name = raw.mDisplayName || ''
        if (!cn || !name) continue
        const key = cn.replace(/_C$/, '')
        const power = raw.mPowerConsumption
          ? parseFloatValue(raw.mPowerConsumption)
          : undefined
        const existing = index.buildings.get(key)
        if (existing) {
          if (name) existing.displayName = name
          if (power !== undefined) existing.powerConsumption = power
        } else {
          index.buildings.set(key, {
            className: key,
            displayName: name,
            description: '',
            powerConsumption: power,
          })
        }
      }
    }

    switch (nativeClass) {
      /* ---------- 物品类块 ---------- */
      // 11 种物品相关描述符统一用 parseItem，字段结构兼容
      case 'FGResourceDescriptor': {
        for (const raw of classes) {
          const item = parseItem(raw, true)
          if (item.className) index.items.set(item.className, item)
        }
        break
      }

      case 'FGItemDescriptor':
      case 'FGItemDescriptorBiomass':
      case 'FGItemDescriptorNuclearFuel':
      case 'FGItemDescriptorPowerBoosterFuel':
      case 'FGPowerShardDescriptor':
      case 'FGConsumableDescriptor':
      case 'FGEquipmentDescriptor':
      case 'FGVehicleDescriptor':
      case 'FGAmmoTypeProjectile':
      case 'FGAmmoTypeSpreadshot':
      case 'FGAmmoTypeInstantHit': {
        for (const raw of classes) {
          const item = parseItem(raw)
          if (item.className) index.items.set(item.className, item)
        }
        break
      }

      /* ---------- 配方块 ---------- */
      // 只索引有实际生产建筑的制造配方（排除手搓/建造枪配方）
      case 'FGRecipe': {
        for (const raw of classes) {
          const recipe = parseRecipe(raw)
          if (!recipe.className) continue

          // 跳过所有 producedIn 都是手搓/建造枪的配方（如墙体/地基等建筑配方）
          // 手搓建筑：BP_WorkBenchComponent（制作台）、BP_BuildGun（建造枪）
          // 注意：BP_WorkshopComponent（装备工坊）应视为工厂建筑
          if (recipe.producedIn.length > 0) {
            const hasFactory = recipe.producedIn.some(
              (p) => p !== 'BP_WorkBenchComponent' && p !== 'BP_BuildGun'
            )
            if (!hasFactory) continue
          }

          // 按产物索引：每种产出物品都能找到这个配方
          for (const product of recipe.products) {
            const list = index.recipes.get(product.itemClass) ?? []
            // 去重：同一个配方可能被多个产物引用（副产物场景下同一配方只存一次）
            if (!list.find(r => r.className === recipe.className)) {
              list.push(recipe)
            }
            index.recipes.set(product.itemClass, list)
          }

          // 按原料索引：每种原料都能找到消耗它的配方
          for (const ing of recipe.ingredients) {
            const list = index.recipesByIngredient.get(ing.itemClass) ?? []
            if (!list.find(r => r.className === recipe.className)) {
              list.push(recipe)
            }
            index.recipesByIngredient.set(ing.itemClass, list)
          }
        }
        break
      }

      /* ---------- 涂装/外观配方 ---------- */
      // 解析但不索引到 recipes（外观定制，非生产配方）
      case 'FGCustomizationRecipe': {
        // 仅在调试时需要，正常运行无需处理
        break
      }

      /* ---------- 建筑描述符块 ---------- */
      case 'FGBuildingDescriptor': {
        for (const raw of classes) {
          const building = parseBuilding(raw)
          if (!building.className) continue
          const key = building.className.replace(/_C$/, '').replace(/^Desc_/, 'Build_')
          const existing = index.buildings.get(key)
          if (existing) {
            if (building.displayName) existing.displayName = building.displayName
            if (building.description) existing.description = building.description
            if (building.iconPath) existing.iconPath = building.iconPath
            if (building.powerConsumption !== undefined) existing.powerConsumption = building.powerConsumption
          } else {
            index.buildings.set(key, { ...building, className: key })
          }
        }
        break
      }

      /* ---------- 发电机/电力块 ---------- */
      // 5 种发电机/电力相关块统一用 parseGenerator
      case 'FGBuildableGeneratorFuel':
      case 'FGBuildableGeneratorNuclear':
      case 'FGBuildableGeneratorGeoThermal':
      case 'FGBuildablePowerBooster':
      case 'FGBuildablePowerStorage': {
        for (const raw of classes) {
          const generator = parseGenerator(raw)
          if (generator.className) index.generators.set(generator.className, generator)
        }
        break
      }

      /* ---------- 无关块：跳过 ---------- */
      default:
        break
    }
  }

  // ---- 后处理：归一化流体配方的 Amount ----
  // 游戏数据中流体的 Amount 是 mL/内部单位，固体才是标准单位。
  // 如燃料 Amount=4000 实际应为 4 m³，需除以 1000。
  for (const [, recipes] of index.recipes) {
    for (const recipe of recipes) {
      for (const product of recipe.products) {
        const item = index.items.get(product.itemClass)
        if (item && (item.form === 'liquid' || item.form === 'gas') && product.amount >= 100) {
          product.amount /= 1000
        }
      }
      for (const ingredient of recipe.ingredients) {
        const item = index.items.get(ingredient.itemClass)
        if (item && (item.form === 'liquid' || item.form === 'gas') && ingredient.amount >= 100) {
          ingredient.amount /= 1000
        }
      }
    }
  }

  return index
}

/* ==================== 数据加载 ==================== */

/**
 * 从指定 URL 加载 zh-Hans.json，解析为 DataIndex。
 *
 * @param url JSON 文件路径，默认使用 Vite 资产引用指向 src/data/zh-Hans.json
 * @returns 解析完成的 DataIndex
 */
export async function loadAndParseGameData(url?: string): Promise<DataIndex> {
  const resolvedUrl = url ?? new URL('../data/zh-Hans.json', import.meta.url).href
  const response = await fetch(resolvedUrl)

  if (!response.ok) {
    throw new Error(`加载游戏数据失败: HTTP ${response.status} ${response.statusText}`)
  }

  // 标准 UTF-8 JSON，直接解析
  let rawJson: unknown[]
  try {
    rawJson = await response.json()
  } catch (e) {
    throw new Error(`游戏数据 JSON 解析失败: ${(e as Error).message}`)
  }

  if (!Array.isArray(rawJson)) {
    throw new Error('游戏数据格式错误：顶层应为数组')
  }

  return parseGameData(rawJson)
}
