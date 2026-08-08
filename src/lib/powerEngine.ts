/**
 * 发电计划引擎
 *
 * 纯函数，不依赖 Vue。根据发电机类型、燃料、目标功率和超频设置，
 * 计算所需发电机数量、燃料消耗、辅助资源用量和副产物。
 *
 * 超频规则：每块能量碎片增加 50% 频率上限，最高 250%（3 碎片）。
 * 降频规则：当 allowUnderclock=true 时逐台填充至上限，最后一台降频。
 * 不允许降频时使用离散档位（100%/150%/200%/250%），取刚好满足需求的最低档。
 */

import type { DataIndex, GameGenerator } from '@/types'
import type { PowerPlanOptions, PowerPlanResult } from '@/types'

/**
 * 根据发电机类型获取可用的燃料列表（含能量值）。
 */
export function listAvailableFuels(
  generator: GameGenerator,
  index: DataIndex,
): { itemClass: string; displayName: string; energyValue: number; form: string }[] {
  if (!generator.fuel || generator.fuel.length === 0) return []

  return generator.fuel
    .map(f => {
      const item = index.items.get(f.fuelClass)
      if (!item) return null
      return {
        itemClass: f.fuelClass,
        displayName: item.displayName,
        energyValue: item.energyValue,
        form: item.form,
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
}

/** 液态/气态燃料的能量值需要 ×1000 换算为 MJ/m³ */
function normalizedEnergy(energyValue: number, form: string): number {
  return form === 'liquid' || form === 'gas' ? energyValue * 1000 : energyValue
}

/** 速率/频率可忽略阈值：小于此值的余数视为零，避免浮点噪音产生多余发电机 */
const FUZZ = 0.005

/**
 * 根据碎片数量计算最高可用频率倍率。
 * 每碎片 +50%，上限 250%。
 */
function calcMaxClock(shards: number): number {
  return Math.min(1 + shards * 0.5, 2.5)
}

/**
 * 计算发电计划。
 */
export function calculatePowerPlan(
  options: PowerPlanOptions,
  index: DataIndex,
): PowerPlanResult {
  // 入参 NaN 防护
  const targetPower = Number.isFinite(options.targetPower) ? Math.max(0, options.targetPower) : 0
  const shards = Number.isFinite(options.powerShards) ? Math.max(0, options.powerShards as number) : 0

  const generator = index.generators.get(options.generatorClass)
  if (!generator) throw new Error(`未知发电机: ${options.generatorClass}`)

  const basePower = generator.powerProduction
  if (basePower <= 0) {
    return calcGeothermal(targetPower, generator, options.allowUnderclock ?? false)
  }

  const maxClock = calcMaxClock(shards)

  // 计算所需总频率和 = 目标功率 / 基础功率
  const totalClockNeeded = targetPower / basePower

  let generatorCount: number
  let machineClocks: number[]

  if (options.allowUnderclock) {
    // 允许降频：逐台填充至 maxClock，最后一台取余数
    const fullCount = Math.floor(totalClockNeeded / maxClock)
    const remainder = totalClockNeeded - fullCount * maxClock

    if (fullCount === 0) {
      generatorCount = 1
      machineClocks = [Math.max(0.01, remainder)]
    } else {
      machineClocks = Array.from({ length: fullCount }, () => maxClock)
      if (remainder > FUZZ) {
        machineClocks.push(Math.max(0.01, remainder))
      }
      generatorCount = machineClocks.length
    }
  } else {
    // 不允许降频：使用离散档位 100%/150%/200%/250%，取刚好满足需求的最低档
    const AVAILABLE_TIERS = [1.0, 1.5, 2.0, 2.5].filter(t => t <= maxClock)

    let bestMachines = Infinity
    let bestTier = 1.0

    for (const tier of AVAILABLE_TIERS) {
      const machinesNeeded = Math.ceil(totalClockNeeded / tier)
      if (machinesNeeded < bestMachines || (machinesNeeded === bestMachines && tier < bestTier)) {
        bestMachines = machinesNeeded
        bestTier = tier
      }
    }

    generatorCount = Math.max(1, bestMachines)
    machineClocks = Array.from({ length: generatorCount }, () => bestTier)
  }

  const totalPower = machineClocks.reduce((sum, c) => sum + c * basePower, 0)
  const actualPowerPerGen = totalPower / generatorCount

  // 查找燃料条目
  const fuelEntry = generator.fuel.find(f => f.fuelClass === options.fuelClass)
  const fuelItem = fuelEntry ? index.items.get(fuelEntry.fuelClass) : undefined

  // 燃料/辅助/副产物计算
  let fuelConsumptionPerMinute = 0
  let supplementalConsumptionPerMinute = 0
  let byproductPerMinute = 0
  let byproductClass = ''

  if (fuelItem) {
    const ev = normalizedEnergy(fuelItem.energyValue, fuelItem.form)
    // 燃料消耗 = 60 × 实际总功率 / 能量值
    const rawFuel = (60 * totalPower) / ev
    fuelConsumptionPerMinute = rawFuel

    // cycles/min = 燃料消耗速率 / 单周期燃料装载量
    // fuelLoadAmount 对液态/气态燃料以 mL 为单位，需 ÷1000 以匹配 m³/min 的消耗单位
    const isFluidFuel = fuelItem.form === 'liquid' || fuelItem.form === 'gas'
    const normFuelLoad = isFluidFuel ? (generator.fuelLoadAmount ?? 1) / 1000 : (generator.fuelLoadAmount ?? 1)
    const cyclesPerMinTotal = fuelConsumptionPerMinute / normFuelLoad

    // 辅助资源（水）
    if (generator.requiresSupplementalResource && generator.supplementalLoadAmount) {
      const loadML = generator.supplementalLoadAmount
      supplementalConsumptionPerMinute = (loadML / 1000) * cyclesPerMinTotal
    }

    // 副产物
    if (fuelEntry?.byproduct && fuelEntry.byproductAmount) {
      byproductClass = fuelEntry.byproduct
      const byproductItem = index.items.get(fuelEntry.byproduct)
      const rawAmount = Number(fuelEntry.byproductAmount)
      // 流体副产物 ÷1000（mL→m³），固体副产物保持原值
      const byproductPerCycle = byproductItem && (byproductItem.form === 'liquid' || byproductItem.form === 'gas')
        ? rawAmount / 1000
        : rawAmount
      byproductPerMinute = byproductPerCycle * cyclesPerMinTotal
    }
  }

  return {
    generatorCount,
    actualPowerPerGenerator: actualPowerPerGen,
    totalPower,
    fuelConsumptionPerMinute,
    supplementalConsumptionPerMinute,
    byproductPerMinute,
    byproductClass,
    overclockRatio: machineClocks[0]!,
    machineClocks,
  }
}

/**
 * 地热发电机：功率由正弦波公式决定，不可超频，无燃料。
 */
function calcGeothermal(
  targetPower: number,
  generator: GameGenerator,
  allowUnderclock: boolean,
): PowerPlanResult {
  // 地热发电平均功率 ≈ factor × 2/π
  const avgPower = generator.variablePowerProductionFactor
    ? generator.variablePowerProductionFactor * (2 / Math.PI)
    : 100

  const count = Math.max(1, Math.ceil(targetPower / avgPower))
  const clock = allowUnderclock
    ? Math.max(0.01, targetPower / (count * avgPower))
    : 1

  const actualPowerPerGen = avgPower * clock
  const machineClocks = Array.from({ length: count }, () => clock)

  return {
    generatorCount: count,
    actualPowerPerGenerator: actualPowerPerGen,
    totalPower: count * actualPowerPerGen,
    fuelConsumptionPerMinute: 0,
    supplementalConsumptionPerMinute: 0,
    byproductPerMinute: 0,
    byproductClass: '',
    overclockRatio: clock,
    machineClocks,
  }
}
