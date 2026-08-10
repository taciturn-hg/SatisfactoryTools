// 验证修复：追踪步枪弹场景（输入替代 + 副产物循环）
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

const INPUTS = new Map([
  [CN('步枪弹药'), 75],
  [CN('急速电线'), 1000],
])

function run(label, recycle, inputs, shards = 0, somer = 0) {
  const graph = planProduction(index, {
    targetItems: [{ itemClass: CN('追踪步枪弹'), rate: 37.5 }],
    targetItemClass: CN('追踪步枪弹'),
    targetRate: 37.5,
    alternativeRecipes: new Map(),
    layoutDirection: 'horizontal',
    extractorConfig,
    powerShards: shards,
    somerCount: somer,
    byproductRecycling: recycle,
    inputItems: inputs,
  })

  const plastic = graph.nodes.find(n => n.itemName === '塑料' && !n.isByproduct)
  const crude = graph.nodes.find(n => n.itemName === '原油')
  const copper = graph.nodes.find(n => n.itemName === '铜锭' && !n.isByproduct)
  const copperOuts = graph.edges.filter(e => e.sourceNodeId === copper?.id)
  const copperOutStr = copperOuts.map(e => {
    const tgt = graph.nodes.find(n => n.id === e.targetNodeId)?.itemName ?? '?'
    return `${tgt}:${(Math.round(e.flowRate * 1000) / 1000)}`
  }).join('  ')

  // 校验铜锭出边总和 == rate（共享节点不覆盖）
  const sum = copperOuts.reduce((s, e) => s + e.flowRate, 0)
  const copperOk = copper ? Math.abs(sum - copper.rate) < 0.01 : 'n/a'
  const plasticOk = plastic ? Math.abs(plastic.rate - 15) < 0.01 : 'no-node'
  const crudeOk = crude ? crude.rate > 0 : 'no-node'

  console.log(`[${label}] 塑料=${plastic ? Math.round(plastic.rate * 1000) / 1000 : '无'}(期望15) 原油=${crude ? Math.round(crude.rate * 1000) / 1000 : '无'}(期望存在)`)
  console.log(`        铜锭: rate=${copper ? Math.round(copper.rate * 1000) / 1000 : '无'} 出边=${copperOutStr} | 出边和==rate: ${copperOk ? '✓' : '✗'} 塑料==15: ${plasticOk === true ? '✓' : plasticOk} 原油存在: ${crudeOk === true ? '✓' : crudeOk}`)
}

run('循环on  有输入 无碎片', true, INPUTS)
run('循环off 有输入 无碎片', false, INPUTS)
run('循环on  无输入 无碎片', true, undefined)
run('循环off 无输入 无碎片', false, undefined)
run('循环on  有输入 6碎片', true, INPUTS, 6)
run('循环on  有输入 2晶体', true, INPUTS, 0, 2)
