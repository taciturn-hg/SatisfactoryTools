/** 发电机类型分类 */
export type GeneratorCategory = 'biomass' | 'coal' | 'fuel' | 'nuclear' | 'geothermal'

/** 燃料信息（供 UI 和计算引擎使用） */
export interface FuelInfo {
  itemClass: string
  displayName: string
  energyValue: number
  supplementalResourceClass?: string
  byproduct?: string
  byproductAmount?: string
}

/** 发电计划参数 */
export interface PowerPlanOptions {
  /** 目标发电功率 (MW) */
  targetPower: number
  /** 发电机 ClassName */
  generatorClass: string
  /** 选择的燃料 ClassName */
  fuelClass: string
  /** 可用能量碎片数量（超频用） */
  powerShards?: number
  /** 是否允许降频（不足一台时降频 vs 直接加一台） */
  allowUnderclock?: boolean
}

/** 发电计划计算结果 */
export interface PowerPlanResult {
  /** 所需发电机数量 */
  generatorCount: number
  /** 每台发电机的实际发电功率 (MW) */
  actualPowerPerGenerator: number
  /** 总发电功率 (MW) */
  totalPower: number
  /** 每分钟燃料消耗量 */
  fuelConsumptionPerMinute: number
  /** 每分钟辅助资源消耗量（如水），0 表示不需要 */
  supplementalConsumptionPerMinute: number
  /** 每分钟副产物产量（如核废料），0 表示无副产物 */
  byproductPerMinute: number
  /** 副产物 ClassName，空字符串表示无 */
  byproductClass: string
  /** 实际使用的超频倍率 */
  overclockRatio: number
  /** 每台发电机的频率分配，如 [2.5, 2.5, 0.7] 表示 2 台 250% + 1 台 70% */
  machineClocks: number[]
}
