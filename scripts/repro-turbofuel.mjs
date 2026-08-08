// 复现：涡轮燃油 375/min 产出 + 副产循环 + 纤维织物 300/min（替代：聚酯织物）
// 检查：聚合树脂副产物回灌扣减是否准确，原油叶子节点不应增产
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

// 配方 className 查找：按产物名 + 配方显示名
function findRecipe(productName, recipeDisplayName) {
  const pcn = CN(productName)
  const recipes = index.recipes.get(pcn) ?? []
  const hit = recipes.find(r => r.displayName === recipeDisplayName)
  if (hit) return hit.className
  console.log(`  未找到配方: ${productName} / ${recipeDisplayName}，候选:`, recipes.map(r => r.displayName))
  return null
}

// 构建替代配方 Map：纤维织物 → 聚酯织物
const polyester = findRecipe('纤维织物', '替代：聚酯织物')
console.log('聚酯织物配方:', polyester)
const alternatives = new Map([[CN('纤维织物'), polyester]])

function run(label, targets, opts = {}) {
  const graph = planProduction(index, {
    targetItems: targets.map(([name, rate]) => ({ itemClass: CN(name), rate })),
    targetItemClass: CN(targets[0][0]),
    targetRate: targets[0][1],
    alternativeRecipes: opts.alternatives ?? alternatives,
    layoutDirection: 'horizontal',
    extractorConfig,
    powerShards: 0,
    byproductRecycling: opts.byproductRecycling ?? true,
    inputItems: opts.inputItems,
  })

  console.log(`\n========== ${label} ==========`)

  // 外部供给（资源节点 + 输入节点）
  console.log('外部供给:')
  for (const n of graph.nodes) {
    if (n.isOutputTarget) continue
    if (n.recipeUsed === null && !n.isByproduct) {
      console.log(`  ${n.itemName} = ${n.rate.toFixed(4)}${n.isUnused ? ' [输入]' : ''}`)
    }
  }

  // 副产物节点
  const byps = graph.nodes.filter(n => n.isByproduct)
  if (byps.length) {
    console.log('副产物:')
    for (const b of byps) {
      console.log(`  ${b.itemName} 产生=${b.rate.toFixed(4)}`)
    }
  }

  // 聚合树脂/原油 节点的边详情
  for (const n of graph.nodes) {
    if (n.itemName === '聚合树脂' || n.itemName === '原油' || n.itemName === '纤维织物') {
      const inEdges = graph.edges.filter(e => e.targetNodeId === n.id)
      const outEdges = graph.edges.filter(e => e.sourceNodeId === n.id)
      console.log(`\n[${n.itemName}] rate=${n.rate.toFixed(4)} byprod=${n.isByproduct} unused=${n.isUnused}`)
      for (const e of inEdges) {
        const src = graph.nodes.find(x => x.id === e.sourceNodeId)
        console.log(`  ← ${src?.itemName} (${e.flowRate.toFixed(4)})`)
      }
      for (const e of outEdges) {
        const dst = graph.nodes.find(x => x.id === e.targetNodeId)
        console.log(`  → ${dst?.itemName} (${e.flowRate.toFixed(4)})`)
      }
    }
  }
}

// 场景 1：只产出涡轮燃油 375/min
run('涡轮燃油 375 单独', [['涡轮燃油', 375]])

// 场景 2：涡轮燃油 375 + 纤维织物 300（聚酯织物）
run('涡轮燃油 375 + 纤维织物 300', [['涡轮燃油', 375], ['纤维织物', 300]])

// 场景 3：完整图 dump
{
  const graph = planProduction(index, {
    targetItems: [{ itemClass: CN('涡轮燃油'), rate: 375 }, { itemClass: CN('纤维织物'), rate: 300 }],
    targetItemClass: CN('涡轮燃油'),
    targetRate: 375,
    alternativeRecipes: alternatives,
    layoutDirection: 'horizontal',
    extractorConfig,
    powerShards: 0,
    byproductRecycling: true,
    inputItems: undefined,
  })
  console.log('\n========== 完整图 dump ==========')
  const name = n => `${n.itemName}${n.isByproduct ? '[BP]' : ''}${n.isUnused ? '[INP]' : ''}${n.isOutputTarget ? '[OUT]' : ''}`
  console.log('--- 节点 ---')
  for (const n of graph.nodes) {
    const recipe = n.recipeUsed ? n.recipeUsed.className : '(资源)'
    console.log(`  ${n.id.padEnd(8)} ${name(n).padEnd(24)} rate=${n.rate.toFixed(4).padStart(10)} recipe=${recipe}`)
  }
  console.log('--- 边 ---')
  for (const e of graph.edges) {
    const src = graph.nodes.find(x => x.id === e.sourceNodeId)
    const dst = graph.nodes.find(x => x.id === e.targetNodeId)
    const item = index.items.get(e.itemClass)?.displayName ?? e.itemClass
    console.log(`  ${src?.itemName.padEnd(10)} (${e.itemClass}) → ${dst?.itemName}  flow=${e.flowRate.toFixed(4)}  [${item}]`)
  }
}
