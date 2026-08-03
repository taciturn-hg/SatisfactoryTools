// 综合验证：副产物循环修复后，多个产线场景的净需求与回灌逻辑
import { readFileSync } from 'node:fs'
import { parseGameData } from '../src/lib/dataParser.ts'
import { planProduction } from '../src/lib/productionEngine.ts'

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
    byproductRecycling: opts.byproductRecycling ?? true,
    inputItems: opts.inputItems,
  })
  console.log(`\n========== ${label} (${itemName} ${rate}/min, 副产循环=${opts.byproductRecycling ?? true}) ==========`)

  // 汇总每种物品的净供给（资源节点入边 + 输入节点）和消耗
  const itemNames = new Map()
  for (const [cn, it] of index.items) itemNames.set(cn, it.displayName)

  // 资源/输入节点（外部供给）：需要外部提供的量
  const external = []
  for (const n of graph.nodes) {
    if (n.isOutputTarget) continue
    if (n.recipeUsed === null && !n.isByproduct) {
      external.push({ name: n.itemName, rate: n.rate, isInput: n.isUnused === true })
    }
  }
  if (external.length) {
    console.log('外部供给:')
    for (const e of external) console.log(`  ${e.name}${e.isInput ? '[输入]' : ''} = ${e.rate}`)
  }

  // 副产物节点（回灌）
  const byps = graph.nodes.filter(n => n.isByproduct)
  if (byps.length) {
    console.log('副产物:')
    for (const b of byps) {
      const outEdges = graph.edges.filter(e => e.sourceNodeId === b.id && e.targetNodeId !== undefined)
      console.log(`  ${b.itemName} 产生=${b.rate}, 回灌: ${outEdges.map(e => `${graph.nodes.find(n=>n.id===e.targetNodeId)?.itemName}(${e.flowRate})`).join(', ') || '无'}`)
    }
  }
}

// 场景1：铝锭（核心）
run('铝产线', '铝锭', 240)

// 场景2：铝锭 + 输入水 240
run('铝产线+输入水240', '铝锭', 240, { inputItems: new Map([[CN('水'), 240]]) })

// 场景3：铝锭 + 输入水 120（不足）
run('铝产线+输入水120', '铝锭', 240, { inputItems: new Map([[CN('水'), 120]]) })

// 场景4：铝锭 + 超频
run('铝产线+超频', '铝锭', 240, { powerShards: 30 })

// 场景5：铝锭 关闭副产物循环
run('铝产线(关循环)', '铝锭', 240, { byproductRecycling: false })

// 场景6：钢（钢铁有副产焦油/石灰吗?无，验证普通产线不回归）
run('铁锭', '铁锭', 120)

// 场景7：钢（高炉副产?）
run('钢锭', '钢锭', 120)
