/** 物品形态 */
export type ItemForm = 'solid' | 'liquid' | 'gas'

/** 配方中的物量对 */
export interface ItemAmount {
  itemClass: string
  amount: number
}

/** 游戏中的物品/资源描述符 */
export interface GameItem {
  className: string
  displayName: string
  description: string
  stackSize: number
  energyValue: number
  radioactiveDecay: number
  form: ItemForm
  smallIcon?: string
  persistentBigIcon?: string
  resourceSinkPoints?: number
  isAlienItem?: boolean
  gameplayTags?: string
  /** 是否为自然资源（矿石/水/原油/气体），此类物品不可通过配方制造 */
  isResource: boolean
}

/** 制造配方 */
export interface GameRecipe {
  className: string
  displayName: string
  ingredients: ItemAmount[]
  products: ItemAmount[]
  manufactoringDuration: number
  producedIn: string[]
  isAlternate: boolean
  variablePowerConsumptionConstant?: number
  variablePowerConsumptionFactor?: number
}

/** 生产建筑描述符（key 统一为 Build_* 格式） */
export interface GameBuilding {
  className: string
  displayName: string
  description: string
  iconPath?: string
  powerConsumption?: number
  /** 功率指数，用于超频时计算实际电力消耗：实际功率 = 基础功率 × Σ(clock^exponent) */
  powerConsumptionExponent?: number
  cachedStackSize?: number
}

/** 发电机燃料条目（对应 mFuel 数组中的每个元素） */
export interface FuelEntry {
  fuelClass: string
  supplementalResourceClass?: string
  byproduct?: string
  byproductAmount?: string
}

/** 发电机数据 */
export interface GameGenerator {
  className: string
  displayName: string
  description: string
  powerProduction: number
  fuel: FuelEntry[]
  fuelLoadAmount?: number
  requiresSupplementalResource?: boolean
  supplementalLoadAmount?: number
  supplementalToPowerRatio?: number
  isFullBlast?: boolean
  canChangePotential?: boolean
  canChangeProductionBoost?: boolean
  minPotential?: number
  maxPotential?: number
  baseProductionBoost?: number
  powerConsumptionExponent?: number
  productionBoostPowerConsumptionExponent?: number
  /** 地热发电机专用字段 */
  variablePowerProductionConstant?: number
  variablePowerProductionFactor?: number
  variablePowerProductionCycleLength?: number
  minPowerProduction?: number
  maxPowerProduction?: number
  /** 核电站专用字段 */
  wasteLeftFromCurrentFuel?: number
  currentGeneratorNuclearWarning?: string
  /** 外星能源增强器专用字段 */
  baseProductionBoostOverride?: number
}

/** 解析后的内存索引 */
export interface DataIndex {
  items: Map<string, GameItem>
  recipes: Map<string, GameRecipe[]>
  recipesByIngredient: Map<string, GameRecipe[]>
  /** key 统一为 Build_* 格式（className 去掉 _C 后缀、Desc_ → Build_） */
  buildings: Map<string, GameBuilding>
  generators: Map<string, GameGenerator>
}
