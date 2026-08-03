// 自动扫描：对所有含副产物的配方，验证副产物循环的物质守恒
// 守恒规则：每个消费节点（有 recipeUsed）的所有入边 itemClass 流量 >= 配方所需
// 且无负流量、无指向已删除节点的边。
import { readFileSync } from 'node:fs'
import { parseGameData } from '../src/lib/dataParser.ts'
import { planProduction } from '../src/lib/productionEngine.ts'

const raw = JSON.parse(readFileSync(new URL('../src/data/zh-Hans.json', import.meta.url), 'utf8'))
const index = parseGameData(raw)

const extractorConfig = {
  minerLevel: 'mk3', minerPurity: 'pure',
  oilExtractor: 'oil_well', oilPurity: 'pure',
  waterExtractor: 'water_extractor', waterPurity: 'normal',
  gasPurity: 'normal',
}

// 收集所有含副产物（多产出且非全部是目标）的配方产物作为测试目标
const targets = new Set()
for (const [itemClass, recipes] of index.recipes) {
  for (const r of recipes) {
    if (r.products.length >= 2) {
      for (const p of r.products) targets.add(p.itemClass)
    }
  }
}

let pass = 0, fail = 0, tested = 0
const failures = []

for (const itemClass of targets) {
  // 以 60/min 为目标测试（量小避免极端数字，但足以检验结构）
  const itemName = index.items.get(itemClass)?.displayName ?? itemClass
  const graph = planProduction(index, {
    targetItems: [{ itemClass, rate: 60 }],
    targetItemClass: itemClass,
    targetRate: 60,
    alternativeRecipes: new Map(),
    layoutDirection: 'horizontal',
    extractorConfig,
    powerShards: 0,
    byproductRecycling: true,
  })

  tested++
  let ok = true
  const problems = []

  // 检查1：边不能指向不存在的节点
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  for (const e of graph.edges) {
    if (!nodeIds.has(e.sourceNodeId) || !nodeIds.has(e.targetNodeId)) {
      ok = false; problems.push(`悬空边 ${e.id}: ${e.sourceNodeId}→${e.targetNodeId}`)
    }
    if (e.flowRate < 0) {
      ok = false; problems.push(`负流量 ${e.id}: ${e.flowRate}`)
    }
  }

  // 检查2：每个配方节点入边需求 >= 配方所需（取整容差 0.01）
  for (const n of graph.nodes) {
    if (!n.recipeUsed || n.isOutputTarget) continue
    const inEdges = graph.edges.filter(e => e.targetNodeId === n.id)
    for (const ing of n.recipeUsed.ingredients) {
      const provided = inEdges
        .filter(e => e.itemClass === ing.itemClass)
        .reduce((s, e) => s + e.flowRate, 0)
      // 所需 = perMachine × totalClock
      const mainProd = n.recipeUsed.products.find(p => p.itemClass === n.itemClass)
      if (!mainProd) continue
      const perMachine = mainProd.amount / n.recipeUsed.manufactoringDuration * 60
      const totalClock = n.machineClocks.reduce((s, c) => s + c, 0)
      const needed = (ing.amount / mainProd.amount) * n.rate
      if (provided < needed - 0.02) {
        ok = false
        problems.push(`${n.itemName} 缺原料 ${index.items.get(ing.itemClass)?.displayName ?? ing.itemClass}: 有 ${provided.toFixed(2)} 需 ${needed.toFixed(2)}`)
      }
    }
  }

  if (ok) pass++
  else {
    fail++
    failures.push({ itemName, itemClass, problems })
  }
}

console.log(`测试目标: ${tested} 个含副产物物品`)
console.log(`通过: ${pass}, 失败: ${fail}`)
if (failures.length) {
  console.log('\n=== 失败详情 ===')
  for (const f of failures.slice(0, 15)) {
    console.log(`\n【${f.itemName}】 ${f.itemClass}`)
    for (const p of f.problems) console.log(`  ✗ ${p}`)
  }
}
