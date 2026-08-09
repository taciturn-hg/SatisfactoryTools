// 索莫晶体增产验证：晶体级联缩减 + 碎片联合优化
import { readFileSync } from 'node:fs'
import { parseGameData } from '../src/lib/dataParser.ts'
import { planProduction } from '../src/lib/productionEngine.ts'
import { somerSlots } from '../src/config/buildingConfig.ts'

const raw = JSON.parse(readFileSync(new URL('../src/data/zh-Hans.json', import.meta.url), 'utf8'))
const index = parseGameData(raw)

const byName = new Map()
for (const [cn, item] of index.items) byName.set(item.displayName, cn)
const CN = (name) => byName.get(name)

const extractorConfig = {
  minerLevel: 'mk3', minerPurity: 'pure',
  oilExtractor: 'oil_well', oilPurity: 'pure',
  waterExtractor: 'water_extractor', waterPurity: 'normal',
  gasPurity: 'normal',
}

function run(label, itemName, rate, opts = {}) {
  const itemClass = CN(itemName)
  if (!itemClass) { console.log(`${label}: ❌ 找不到物品 ${itemName}`); return }
  const graph = planProduction(index, {
    targetItems: [{ itemClass, rate }],
    targetItemClass: itemClass,
    targetRate: rate,
    alternativeRecipes: new Map(),
    layoutDirection: 'horizontal',
    extractorConfig,
    powerShards: opts.powerShards ?? 0,
    somerCount: opts.somerCount ?? 0,
    byproductRecycling: opts.byproductRecycling ?? false,
    inputItems: opts.inputItems,
  })
  console.log(`\n========== ${label} (${itemName} ${rate}/min, 碎片=${opts.powerShards ?? 0}, 晶体=${opts.somerCount ?? 0}) ==========`)

  // 列出所有生产节点（含晶体/时钟/机器数）
  for (const n of graph.nodes) {
    if (n.isByproduct || n.isUnused || n.isOutputTarget) continue
    const somer = n.somerMachines ?? 0
    const clocks = n.machineClocks?.map(c => (Math.round(c * 1000) / 1000).toString()) ?? []
    const slots = somerSlots(n.machineType)
    const slotsTag = slots != null && slots > 1 ? `(slots=${slots})` : ''
    console.log(`  ${n.itemName.padEnd(12)} rate=${(Math.round(n.rate * 1000) / 1000).toString().padStart(8)} 机器=${clocks.length}${somer ? ` 💎${somer}${slotsTag}` : ''} clocks=[${clocks.join(', ')}]`)
  }

  // 外部供给（资源节点）
  const external = []
  for (const n of graph.nodes) {
    if (n.isOutputTarget || n.isByproduct || n.isUnused) continue
    if (n.recipeUsed === null) external.push(`${n.itemName}=${(Math.round(n.rate * 1000) / 1000)}`)
  }
  if (external.length) console.log(`  外部供给: ${external.join(', ')}`)
}

// 场景1：单链 5 台 100% 需求 → 3 碎片 + 1 晶体 → 应 1 台 250%
// 铁板：原料铁锭+煤，铁板配方 1 铁锭+1 煤 → 1 铁板 @ 6s → 10/min。rate=50 → 5 台 100%
run('铁板 50（5台基准）', '铁板', 50)
run('铁板 50 + 3碎片 + 1晶体', '铁板', 50, { powerShards: 3, somerCount: 1 })

// 场景2：晶体级联缩减原料（同节点晶体 2 颗，应更省机器/原料）
run('铁板 50 + 2晶体（无碎片）', '铁板', 50, { somerCount: 2 })

// 场景3：普通节点超频不变（无晶体时不回归）
run('铁板 50 + 3碎片（无晶体）', '铁板', 50, { powerShards: 3 })

// 场景4：铝产线多级链，验证级联传播
run('铝锭 240 + 2晶体', '铝锭', 240, { somerCount: 2 })
run('铝锭 240 + 2晶体 + 6碎片', '铝锭', 240, { somerCount: 2, powerShards: 6 })

// 场景5：铸造站（成本 2）——铝锭需求 4 台，装 1 台晶体需 2 个，省 1 台
// 每晶体收益 0.5 < 构筑站（成本 1）的 1.0，应优先给构筑站类节点
run('铝锭 240 + 4晶体（铸造站成本2）', '铝锭', 240, { somerCount: 4 })

// 场景6：装配站（成本 2）验证
run('铁板 50 + 装配站', '铁板', 50, { somerCount: 1 })

