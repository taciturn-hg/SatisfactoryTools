/**
 * 生产规划引擎
 *
 * 职责：从最终目标物品和产量出发，反向推导出整个生产链所需的中间产物、
 * 基础资源、机器台数及频率分配，输出 ProductionGraph。
 *
 * 频率计算规则：
 * - 无超频：上限 100%，机器台数按整数分割，剩余一台降频
 *   （如 2.4 台 → 2×100%, 1×40%）
 * - 后续接入超频时：每块能量碎片增加 50% 频率上限，最高 250%
 *   （1 碎片 → 150%, 2 碎片 → 200%, 3 碎片 → 250%）
 *   在频率上限内按实际需求计算，不浪费频率
 */

import type { DataIndex, GameRecipe } from '@/types'
import type {
  ProductionGraph, ProductionNode, ProductionEdge,
  PlanOptions, ExtractorConfig,
} from '@/types'

/* ==================== 辅助函数 ==================== */

let _nextId = 0
function nextId(): string {
  return `n${_nextId++}`
}

/** 纯度倍率 */
const PURITY_MULTIPLIER: Record<string, number> = {
  impure: 0.5,
  normal: 1,
  pure: 2,
}

/** 采矿机等级倍率 */
const MINER_MULTIPLIER: Record<string, number> = {
  mk1: 1,
  mk2: 2,
  mk3: 4,
}

/**
 * 将单次制造中，原料/产物的 Amount 换算为每分钟速率。
 */
function ratePerMinute(amount: number, duration: number): number {
  if (duration <= 0 || amount <= 0) return 0
  const rpm = (amount / duration) * 60
  return Number.isFinite(rpm) ? Number(rpm.toFixed(4)) : 0
}

/**
 * 根据 ExtractorConfig 计算基础资源节点的采集器类型和单台速率。
 *
 * 游戏数据中没有资源开采配方，因此速率由用户配置的采集器等级 × 节点纯度决定。
 *
 * 基线值（普通纯度 × Mk.1 级别）：
 * - 固体矿：Mk1 采矿器 普通节点 = 60/min
 * - 原油井：油井 普通节点 = 120/min；资源井 普通节点 = 120/min
 * - 水：抽水站固定 120/min；资源井 普通节点 = 120/min
 * - 气体：仅资源井 普通节点 = 30/min（实际游戏中氮气产量为变量，此处简化）
 *
 * @returns { machineType, perMachineRate } 或 undefined（未知资源类型）
 */
function resolveResourceExtractor(
  itemClass: string,
  index: DataIndex,
  config: ExtractorConfig | undefined,
): { machineType: string; perMachineRate: number } | undefined {
  const item = index.items.get(itemClass)
  if (!item) return undefined

  // 水 → 抽水站（120/min 固定）或资源提取器（按纯度）
  if (itemClass === 'Desc_Water_C') {
    if (config?.waterExtractor === 'resource_well') {
      const purity = PURITY_MULTIPLIER[config.waterPurity] ?? 1
      return { machineType: 'Build_WaterPump', perMachineRate: 120 * purity }
    }
    return { machineType: 'Build_WaterPump', perMachineRate: 120 }
  }

  // 原油 → 油井 或 资源提取器
  if (itemClass === 'Desc_LiquidOil_C') {
    if (config?.oilExtractor === 'resource_well') {
      const purity = PURITY_MULTIPLIER[config.oilPurity] ?? 1
      return { machineType: 'Build_OilPump', perMachineRate: 120 * purity }
    }
    const purity = PURITY_MULTIPLIER[config?.oilPurity ?? 'normal'] ?? 1
    return { machineType: 'Build_OilPump', perMachineRate: 120 * purity }
  }

  // 固体矿（铁/铜/石灰石/煤/硫/铀/铝土/石英/石炭等）
  if (item.form === 'solid') {
    const minerLevel = config?.minerLevel ?? 'mk1'
    const purity = PURITY_MULTIPLIER[config?.minerPurity ?? 'normal'] ?? 1
    const multiplier = MINER_MULTIPLIER[minerLevel] ?? 1
    const minerMap: Record<string, string> = {
      mk1: 'Build_MinerMk1',
      mk2: 'Build_MinerMk2',
      mk3: 'Build_MinerMk3',
    }
    return { machineType: minerMap[minerLevel] ?? 'Build_MinerMk1', perMachineRate: 60 * multiplier * purity }
  }

  // 液体（其他液态资源，mod 或后续内容）→ 默认采油机
  if (item.form === 'liquid') {
    const purity = PURITY_MULTIPLIER[config?.oilPurity ?? 'normal'] ?? 1
    return { machineType: 'Build_OilPump', perMachineRate: 120 * purity }
  }

  // 气体（氮气等）→ 仅资源井
  if (item.form === 'gas') {
    const purity = PURITY_MULTIPLIER[config?.gasPurity ?? 'normal'] ?? 1
    return { machineType: 'Build_FrackingSmasher', perMachineRate: 30 * purity }
  }

  return undefined
}

/**
 * 根据需求速率和单机产量计算台数与频率分配。
 *
 * maxClock 控制每台机器的频率上限（无超频 = 1，3碎片超频 = 2.5）。
 * 策略：优先用更少的机器跑到 maxClock，满足需求后再补一台降频。
 * 如需要 2.4 台、maxClock=1 → 2×100%, 1×40%
 * 如需要 2.4 台、maxClock=2.5 → 1×240%, 1×降频填剩余
 * 微小余数（< 单台产量的 0.5%）合并到最后一台机器上，避免凭空多一台机器。
 */
function calcMachineGroup(
  rate: number,
  perMachineRate: number,
  maxClock: number = 1,
): {
  machineCount: number
  clocks: number[]
} {
  if (perMachineRate <= 0 || rate <= 0 || !Number.isFinite(rate) || !Number.isFinite(perMachineRate)) {
    return { machineCount: 0, clocks: [] }
  }
  const basePerMachine = perMachineRate * maxClock
  const rawCount = rate / basePerMachine
  const fullMachines = Math.floor(rawCount)
  const remainder = rate - fullMachines * basePerMachine
  const clocks: number[] = []

  if (fullMachines > 0) {
    clocks.push(...Array<number>(fullMachines).fill(maxClock))
    // remainderFraction: 剩余所需相当于多少台机器的产量（无量纲）
    const remainderFraction = remainder / perMachineRate
    if (remainderFraction > 0.005) {
      const lastClock = Number(remainderFraction.toFixed(4))
      clocks.push(Math.min(lastClock, maxClock))
    } else if (remainderFraction > 0) {
      clocks[clocks.length - 1] = Number((maxClock + remainderFraction).toFixed(4))
    }
  } else {
    clocks.push(Number((rate / perMachineRate).toFixed(4)))
  }

  return { machineCount: rawCount, clocks }
}

/**
 * 向图中添加一个节点并返回
 */
function addNode(graph: ProductionGraph, n: Omit<ProductionNode, 'id'>): ProductionNode {
  const node: ProductionNode = { id: nextId(), ...n }
  graph.nodes.push(node)
  return node
}

/**
 * 向图中添加一条边
 */
function addEdge(
  graph: ProductionGraph,
  source: string,
  target: string,
  flowRate: number,
  itemClass: string,
): ProductionEdge {
  const edge: ProductionEdge = {
    id: `e${source}-${target}-${itemClass}`,
    sourceNodeId: source,
    targetNodeId: target,
    flowRate,
    itemClass,
  }
  graph.edges.push(edge)
  return edge
}

/**
 * 评估配方原料距离自然资源的远近程度。
 *
 * 评分规则：原料中直接为自然资源（isResource）或无配方的比例。
 * 比例越高说明路径越短，应优先选择。
 * 如燃料配方：原油→燃料（1/1=1）优于 重油残渣→燃料（0/1=0）。
 */
function recipeResourceScore(recipe: GameRecipe, index: DataIndex): number {
  if (recipe.ingredients.length === 0) return 0
  let resourceCount = 0
  for (const ing of recipe.ingredients) {
    const item = index.items.get(ing.itemClass)
    // 是自然资源 或 没有任何配方（无配方等同不可制造的资源）
    if (item?.isResource || !index.recipes.has(ing.itemClass)) {
      resourceCount++
    }
  }
  return resourceCount / recipe.ingredients.length
}

/**
 * 选择指定物品的配方。
 * 用户指定了替代配方则优先使用，否则使用第一个标准配方。
 * 若无任何配方返回 null（该物品是基础资源）。
 *
 * 过滤规则：
 * - 跳过 Converter 配方（转换器配方用于资源类型转换，不应出现在产线规划中）
 * - 不自动选择替代配方（isAlternate），除非用户通过 alternatives Map 指定
 */
function selectRecipe(
  index: DataIndex,
  itemClass: string,
  alternatives: Map<string, string>,
): GameRecipe | null {
  const allCandidates = index.recipes.get(itemClass)
  if (!allCandidates || allCandidates.length === 0) return null

  // 用户指定了替代配方（含 SAM 转换配方）→ 直接使用
  const selectedClass = alternatives.get(itemClass)
  const selected = selectedClass
    ? allCandidates.find(r => r.className === selectedClass)
    : undefined
  if (selected) return selected

  // 自然资源（矿石/水/原油/气体）固定为叶子节点，不可通过配方展开
  // 除非用户通过 alternatives 明确选择了配方（已在上面返回）
  const item = index.items.get(itemClass)
  if (item?.isResource) return null

  // 过滤 Converter 配方，避免基础资源被 Converter 配方展开
  let factoryCandidates = allCandidates.filter(
    r => !r.producedIn.some(p => p === 'Build_Converter')
  )

  // 过滤解包配方（Recipe_Unpackage*）：反向推导永远不应通过「桶装→流体」解包来生产。
  // 桶装流体用打包配方生产，空桶/空瓶用制造配方生产，解包配方只会引入配方循环
  // （如空桶选 Recipe_UnpackageAlumina 需桶装氧化铝溶液，而桶装又需空桶）。
  // 仅当某物品只有解包配方时才保留，避免误判为不可制造。
  const nonUnpackage = factoryCandidates.filter(
    r => !r.className.startsWith('Recipe_Unpackage')
  )
  if (nonUnpackage.length > 0) factoryCandidates = nonUnpackage

  if (factoryCandidates.length === 0) return null

  // 优先选「目标物品是主产物（products[0]）」的配方，避免把目标物品当副产物来生产。
  // 例如外部补足二氧化硅时应选 Recipe_Silica_C（粗石英→二氧化硅），
  // 而不是 Recipe_AluminaSolution_C（铝土矿+水→氧化铝溶液+二氧化硅，二氧化硅只是副产物，
  // 会把氧化铝溶液重新引入产线纠缠）。
  // 仅当主产物候选中含标准配方时才优先使用；
  // 若主产物全是替代配方（如重油残渣只有 Recipe_Alternate_HeavyOilResidue_C 是主产物配方），
  // 回退到原候选集，让把目标当副产物的标准配方（塑料/橡胶产线）仍可被选中。
  const mainProductCandidates = factoryCandidates.filter(
    r => r.products[0]?.itemClass === itemClass
  )
  const mainStandards = mainProductCandidates.filter(r => !r.isAlternate)
  if (mainStandards.length > 0) factoryCandidates = mainStandards

  // 在所有标准配方中，选原料距自然资源最短的路径
  // 评分规则：原料中自然资源占比越高 → 路径越短
  const standards = factoryCandidates.filter(r => !r.isAlternate)
  if (standards.length > 0) {
    let best = standards[0]!
    let bestScore = recipeResourceScore(best, index)

    for (let i = 1; i < standards.length; i++) {
      const score = recipeResourceScore(standards[i]!, index)
      if (score > bestScore) {
        best = standards[i]!
        bestScore = score
      }
    }
    return best
  }

  // 全是替代配方（如煤的木炭、生物煤）→ 不展开，视为资源
  return null
}

/* ==================== 核心算法 ==================== */

/**
 * 从目标物品出发，反向推导生产链。
 *
 * @param index 游戏数据索引
 * @param options 规划参数（目标物品、产量、替代配方、副产物策略）
 * @returns 生产图（节点 + 边）
 */
export function planProduction(index: DataIndex, options: PlanOptions): ProductionGraph {
  const graph: ProductionGraph = { nodes: [], edges: [] }

  _nextId = 0

  /**
   * 展开单个节点。ancestors 在当前分支上按 add-before/delete-after 模式维护，
   * 避免每层 new Set 的 O(depth²) 分配开销。
   */
  function expand(node: ProductionNode, ancestors: Set<string>): void {
    ancestors.add(node.itemClass)

    const recipe = selectRecipe(index, node.itemClass, options.alternativeRecipes)

    if (!recipe) {
      const extractor = resolveResourceExtractor(node.itemClass, index, options.extractorConfig)
      if (extractor) {
        const group = calcMachineGroup(node.rate, extractor.perMachineRate)
        node.recipeUsed = null
        node.machineCount = group.machineCount
        node.machineClocks = group.clocks
        node.machineType = extractor.machineType
      } else {
        node.recipeUsed = null
        node.machineCount = 1
        node.machineClocks = [1]
        node.machineType = null
      }
      ancestors.delete(node.itemClass)
      return
    }

    node.recipeUsed = recipe

    // 从 producedIn 中选第一个实际生产建筑（跳过制作台手搓/建造枪）
    // 注意：BP_WorkshopComponent（装备工坊）应视为工厂建筑
    node.machineType = null
    for (const p of recipe.producedIn) {
      if (p && p !== 'BP_WorkBenchComponent' && p !== 'BP_BuildGun') {
        node.machineType = p
        break
      }
    }
    if (!node.machineType) {
      node.machineType = recipe.producedIn[0] ?? null
    }

    // 将 BP_WorkshopComponent（装备工坊手搓组件）映射为 Build_Workshop 以获取中文名
    if (node.machineType === 'BP_WorkshopComponent') {
      node.machineType = 'Build_Workshop'
    }

    const mainProduct = recipe.products.find(p => p.itemClass === node.itemClass)
    if (!mainProduct) {
      console.warn(`[planProduction] 配方 ${recipe.className} 产物不含 ${node.itemClass}`)
      ancestors.delete(node.itemClass)
      return
    }
    const perMachineRate = ratePerMinute(mainProduct.amount, recipe.manufactoringDuration)

    const group = calcMachineGroup(node.rate, perMachineRate)
    node.machineCount = group.machineCount
    node.machineClocks = group.clocks

    // 有效总频率 = clock 数组元素之和（降频时 < 时钟数）
    const totalClock = group.clocks.reduce((s, c) => s + c, 0)

    // 处理副产物 — 默认始终展示
    for (const product of recipe.products) {
      if (product.itemClass === node.itemClass) continue

      const byproductRate = ratePerMinute(product.amount, recipe.manufactoringDuration) * totalClock
      const byproductNode = addNode(graph, {
        itemClass: product.itemClass,
        itemName: index.items.get(product.itemClass)?.displayName || product.itemClass,
        rate: byproductRate,
        recipeUsed: null,
        machineCount: 0,
        machineClocks: [],
        machineType: null,
        depth: node.depth,
        isByproduct: true,
      })
      addEdge(graph, node.id, byproductNode.id, byproductRate, product.itemClass)
    }

    // 对每个原料递归展开
    for (const ingredient of recipe.ingredients) {
      const ingredientRate = ratePerMinute(ingredient.amount, recipe.manufactoringDuration) * totalClock

      if (ancestors.has(ingredient.itemClass)) {
        console.warn(
          `[planProduction] 循环依赖: ${ingredient.itemClass} 展开 ${node.itemClass} 时已访问`,
        )
        continue
      }

      const childNode = addNode(graph, {
        itemClass: ingredient.itemClass,
        itemName: index.items.get(ingredient.itemClass)?.displayName || ingredient.itemClass,
        rate: ingredientRate,
        recipeUsed: null,
        machineCount: 0,
        machineClocks: [],
        machineType: null,
        depth: node.depth + 1,
        isByproduct: false,
      })
      addEdge(graph, childNode.id, node.id, ingredientRate, ingredient.itemClass)
      expand(childNode, ancestors)
    }

    ancestors.delete(node.itemClass)
  }

  // 构建目标列表（兼容多目标与单目标；无产出目标时为空，仅显示用户输入的原料节点）
  const targets = options.targetItems?.length
    ? options.targetItems
    : options.targetItemClass
      ? [{ itemClass: options.targetItemClass, rate: options.targetRate }]
      : []

  // 展开每个目标，各自独立检测循环依赖
  for (const t of targets) {
    const rootNode = addNode(graph, {
      itemClass: t.itemClass,
      itemName: index.items.get(t.itemClass)?.displayName || t.itemClass,
      rate: t.rate,
      recipeUsed: null,
      machineCount: 0,
      machineClocks: [],
      machineType: null,
      depth: 0,
      isByproduct: false,
    })
    expand(rootNode, new Set())
  }

  mergeDuplicateNodes(graph, index, options)
  // 先做副产物自循环（副产物回灌扣减净需求），再应用用户输入的原料，
  // 否则输入原料会先扣减尚未回灌时的需求，导致净缺口算错。
  if (options.byproductRecycling) {
    applyByproductRecycling(graph, index, options)
  }
  applyInputItems(graph, index, options)
  applyOverclock(graph, index, options)

  // 为每个深度 0 的生产节点添加目标产出展示节点
  // 合并后同物品多目标已自动归并为一个节点
  const outputTargets = graph.nodes.filter(
    n => n.depth === 0 && !n.isUnused && !n.isByproduct && n.rate > 0.005,
  )
  for (const planRoot of outputTargets) {
    if (!planRoot.recipeUsed && !planRoot.machineType) continue
    const outputNode = addNode(graph, {
      itemClass: planRoot.itemClass,
      itemName: planRoot.itemName,
      rate: planRoot.rate,
      recipeUsed: null,
      machineCount: 0,
      machineClocks: [],
      machineType: null,
      depth: 0,
      isByproduct: false,
      isOutputTarget: true,
    })
    addEdge(graph, planRoot.id, outputNode.id, planRoot.rate, planRoot.itemClass)
  }

  return graph
}

/**
 * 合并图中的重复节点（同一物品 + 同一配方或同为资源）。
 *
 * 展开阶段每个分支独立创建节点，后处理时将相同物品按同一配方生产的节点
 * 合并为一个节点：速率累加、频率重算、多条入边汇入同一节点。
 * 资源节点（无配方）按 itemClass 合并。
 */
function mergeDuplicateNodes(
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
): void {
  const key = (n: ProductionNode): string =>
    n.recipeUsed
      ? `${n.itemClass}::${n.recipeUsed.className}`
      : `__RES__${n.isByproduct ? 'BYP__' : ''}${n.itemClass}`

  // 收集需合并的组
  const groups = new Map<string, ProductionNode[]>()
  for (const node of graph.nodes) {
    const k = key(node)
    const list = groups.get(k) ?? []
    list.push(node)
    groups.set(k, list)
  }

  // 构建全局 oldId → primaryId 映射，仅一次遍历
  const remap = new Map<string, string>()
  const mergedIds = new Set<string>()

  for (const [, group] of groups) {
    if (group.length <= 1) continue

    const primary = group[0]!
    const toMerge = group.slice(1)

    for (const dup of toMerge) {
      primary.rate += dup.rate
    }

    if (primary.recipeUsed) {
      const mainProduct = primary.recipeUsed.products.find(p => p.itemClass === primary.itemClass)
      if (mainProduct) {
        const rpm = ratePerMinute(mainProduct.amount, primary.recipeUsed.manufactoringDuration)
        const newGroup = calcMachineGroup(primary.rate, rpm)
        primary.machineCount = newGroup.machineCount
        primary.machineClocks = newGroup.clocks
      }
    } else {
      const extractor = resolveResourceExtractor(primary.itemClass, index, options.extractorConfig)
      if (extractor) {
        const newGroup = calcMachineGroup(primary.rate, extractor.perMachineRate)
        primary.machineCount = newGroup.machineCount
        primary.machineClocks = newGroup.clocks
      }
    }

    for (const dup of toMerge) {
      remap.set(dup.id, primary.id)
      mergedIds.add(dup.id)
    }
  }

  // 单次遍历重定向边
  for (const edge of graph.edges) {
    const newTarget = remap.get(edge.targetNodeId)
    if (newTarget) edge.targetNodeId = newTarget
    const newSource = remap.get(edge.sourceNodeId)
    if (newSource) edge.sourceNodeId = newSource
  }

  // 去重合并边 + 构造唯一 id
  const edgeSet = new Map<string, typeof graph.edges[0]>()
  for (const edge of graph.edges) {
    const ek = `${edge.sourceNodeId}→${edge.targetNodeId}::${edge.itemClass}`
    const existing = edgeSet.get(ek)
    if (existing) {
      existing.flowRate += edge.flowRate
    } else {
      edgeSet.set(ek, { ...edge, id: `e${edge.sourceNodeId}-${edge.targetNodeId}-${edge.itemClass}` })
    }
  }
  graph.edges = Array.from(edgeSet.values())

  // 删除被合并的节点
  graph.nodes = graph.nodes.filter(n => !mergedIds.has(n.id))
}

/**
 * 将用户输入的原料可视化为图中的节点，找到目标则连线并扣减需求。
 *
 * 每个 inputItems 条目都会创建一个「供给节点」（isUnused），
 * - 在图中找到同 itemClass 的生产节点 → 连线过去，扣减该节点 rate，递归缩减上游
 * - 找不到 → 只渲染孤立节点（无入边出边），用户能看到添加了但没用上
 */
function applyInputItems(
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
): void {
  const inputItems = options.inputItems
  if (!inputItems || inputItems.size === 0) return

  for (const [itemClass, providedRate] of inputItems) {
    if (providedRate <= 0 || !Number.isFinite(providedRate)) continue

    const item = index.items.get(itemClass)
    const inputNode = {
      id: nextId(),
      itemClass,
      itemName: item?.displayName || itemClass,
      rate: providedRate,
      recipeUsed: null,
      machineCount: 0,
      machineClocks: [] as number[],
      machineType: null as string | null,
      depth: -1,
      isByproduct: false,
      isUnused: true,
    }
    graph.nodes.push(inputNode)

    // 找生产该物品的节点（优先非副产物，回退到副产物）。
    // 副产物循环已回灌内部需求，这里定位的是可被输入替代的外部供给节点。
    let producerNode = graph.nodes.find(
      n => n.itemClass === itemClass && !n.isByproduct && !n.isUnused
    )
    if (!producerNode) {
      producerNode = graph.nodes.find(
        n => n.itemClass === itemClass && n.isByproduct && !n.isUnused
      )
    }
    if (!producerNode) continue

    // 输入替代该供给节点的出边消费者（而非所有入边的 target，
    // 避免把副产物入边/回灌边误算为需求导致分流错误）。
    // 只统计与输入同物品的出边，排除该节点产出的副产物边（如氧化铝溶液节点的二氧化硅副产边）。
    const supplyEdges = graph.edges.filter(
      e => e.sourceNodeId === producerNode.id && e.itemClass === itemClass
    )
    const distinctConsumers = [...new Set(supplyEdges.map(e => e.targetNodeId))]
    const totalSupply = supplyEdges.reduce((s, e) => s + e.flowRate, 0)

    if (totalSupply > 0) {
      // 输入量超出供给时截断到实际可替代量
      const used = Math.min(providedRate, totalSupply)
      for (const consumerId of distinctConsumers) {
        const consumerTotal = supplyEdges
          .filter(e => e.targetNodeId === consumerId)
          .reduce((s, e) => s + e.flowRate, 0)
        const portion = used * (consumerTotal / totalSupply)
        addEdge(graph, inputNode.id, consumerId, portion, itemClass)
      }
      // 只扣减实际使用的量
      reduceNodeRate(producerNode, graph, index, options, used)
    } else {
      // 无消费者 → 直接连到生产者（视为消耗自身的示意）
      addEdge(graph, inputNode.id, producerNode.id, providedRate, itemClass)
      reduceNodeRate(producerNode, graph, index, options, providedRate)
    }
  }
}

/**
 * 递归扣减节点 rate，重算台数，并向上游回溯缩减。
 *
 * 图可能存在环（如暗物质↔暗能量的互相消耗），visited 防止沿环无限递归。
 */
function reduceNodeRate(
  node: ProductionNode,
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
  reduceBy: number,
): void {
  const visited = new Set<string>()
  reduceNodeRateInner(node, graph, index, options, reduceBy, visited)
}

function reduceNodeRateInner(
  node: ProductionNode,
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
  reduceBy: number,
  visited: Set<string>,
): void {
  if (visited.has(node.id)) return
  visited.add(node.id)

  const newRate = Number(Math.max(0, node.rate - reduceBy).toFixed(4))

  if (newRate <= 0) {
    removeNodeAndUpstream(node, graph)
    return
  }

  node.rate = newRate

  // 重算该节点的台数
  if (node.recipeUsed) {
    const mainProduct = node.recipeUsed.products.find(p => p.itemClass === node.itemClass)
    if (!mainProduct) return
    const perMachineRate = ratePerMinute(mainProduct.amount, node.recipeUsed.manufactoringDuration)
    const group = calcMachineGroup(node.rate, perMachineRate)
    node.machineCount = group.machineCount
    node.machineClocks = group.clocks

    const totalClock = group.clocks.reduce((s, c) => s + c, 0)

    // 更新出边（主产物取 node.rate，副产物按 totalClock 算）
    for (const edge of graph.edges) {
      if (edge.sourceNodeId !== node.id) continue
      if (edge.itemClass === node.itemClass) {
        edge.flowRate = node.rate
      } else {
        const byRate = ratePerMinute(
          node.recipeUsed!.products.find(p => p.itemClass === edge.itemClass)?.amount ?? 0,
          node.recipeUsed!.manufactoringDuration,
        ) * totalClock
        edge.flowRate = byRate
        // 同步副产物节点的 rate，保持「副产节点 ⇄ 产生边」一致，
        // 否则副产物回灌会按失配的 rate 分配导致负流量
        const byNode = graph.nodes.find(n => n.id === edge.targetNodeId && n.isByproduct)
        if (byNode) byNode.rate = byRate
      }
    }

    // 原料需求用量比推算：ingredientAmount / mainProductAmount * node.rate
    // 避免 totalClock × perMachineRate 因 toFixed(4) 截断导致的精度误差
    for (const ingredient of node.recipeUsed.ingredients) {
      const newIngredientRate = Number(
        (node.rate * (ingredient.amount / mainProduct.amount)).toFixed(4),
      )

      const edge = graph.edges.find(
        e => e.targetNodeId === node.id && e.itemClass === ingredient.itemClass
      )
      if (!edge) continue

      const oldIngredientRate = edge.flowRate
      edge.flowRate = newIngredientRate

      const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId)
      if (!sourceNode || sourceNode.isByproduct) continue

      reduceNodeRateInner(sourceNode, graph, index, options, oldIngredientRate - newIngredientRate, visited)
    }
  } else {
    // 资源节点（采集器），只需更新台数与出边速率
    // （输入原料部分替代资源时，rate 降低但出边仍为旧值，需同步）
    for (const edge of graph.edges) {
      if (edge.sourceNodeId === node.id && edge.itemClass === node.itemClass) {
        edge.flowRate = node.rate
      }
    }
    const extractor = resolveResourceExtractor(node.itemClass, index, options.extractorConfig)
    if (extractor) {
      const group = calcMachineGroup(node.rate, extractor.perMachineRate)
      node.machineCount = group.machineCount
      node.machineClocks = group.clocks
    }
  }
}

/**
 * 删除节点及其所有不再有需求的节点（递归清理叶子方向）。
 *
 * 采用「存活传播」算法：从保留锚点（目标产出 OUT、用户输入 INP）反向传播存活，
 * 一个普通节点存活当且仅当它有一条出边指向存活节点（即下游仍有真实需求）；
 * 副产物节点存活取决于其生产者存活。传播到收敛后，删除 startNode 及
 * 所有不存活的节点。
 *
 * 相比逐点 BFS 的优势：能正确处理副产物回灌形成的双向依赖环
 * （如 氧化铝溶液 ⇄ 碎铝渣），环内节点没有通向存活锚点的出边，会整体被清除。
 * 共享上游（如同时供应铁板和铁棒的铁锭）因有出边指向存活节点而自然保留。
 */
function removeNodeAndUpstream(node: ProductionNode, graph: ProductionGraph): void {
  const toRemove = new Set([node.id])

  // 存活锚点：目标产出（depth 0 根节点或 OUT 展示节点）与用户输入节点永不删除。
  // 注意：本函数在 applyInputItems 阶段调用，此时 OUT 展示节点尚未创建，
  // 因此用 depth === 0 的目标根节点作为锚点。排除 depth 0 的副产物节点
  // （如橡胶产线的重油残渣），它们由生产者决定存活，不构成独立锚点。
  const alive = new Set<string>()
  for (const n of graph.nodes) {
    if (n.isOutputTarget || n.isUnused || (n.depth === 0 && !n.isByproduct)) alive.add(n.id)
  }
  alive.delete(node.id) // startNode 强制删除，即使其 depth 为 0

  // 传播到收敛
  let changed = true
  while (changed) {
    changed = false
    for (const n of graph.nodes) {
      if (n.id === node.id || alive.has(n.id)) continue
      let survives: boolean
      if (n.isByproduct) {
        // 副产物节点无出边，存活取决于生产者（任一入边来源存活）
        survives = graph.edges.some(e => e.targetNodeId === n.id && alive.has(e.sourceNodeId))
      } else {
        // 普通节点存活 ⟺ 存在一条出边指向存活节点
        survives = graph.edges.some(e => e.sourceNodeId === n.id && alive.has(e.targetNodeId))
      }
      if (survives) {
        alive.add(n.id)
        changed = true
      }
    }
  }

  // startNode 及所有不存活的节点一并删除
  for (const n of graph.nodes) {
    if (!alive.has(n.id)) toRemove.add(n.id)
  }

  graph.edges = graph.edges.filter(
    e => !toRemove.has(e.sourceNodeId) && !toRemove.has(e.targetNodeId)
  )
  graph.nodes = graph.nodes.filter(n => !toRemove.has(n.id))
}

/* ==================== 副产物回灌 ==================== */

/**
 * 副产物自循环：将配方节点的副产物直接回灌到有对应原料需求的消费节点，
 * 扣减外部供应，实现「优先用副产物、不足再由外部产线补足」。
 *
 * 对每个副产物：
 *   1. 找到所有产出该副产物的配方节点（多条产生边）
 *   2. 找到需要该物品的消费者及其需求量
 *   3. 回灌边从产生方节点**直接连到消费者**（不经过副产物中转节点），
 *      多个产生方按产生流量占比分配
 *   4. 扣减对应消费者的外部供应边及上游节点速率
 *   5. 副产物被全部利用时删除副产物节点与产生边；
 *      有多余时才保留副产物节点展示剩余量
 */
function applyByproductRecycling(
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
): void {
  const byproducts = graph.nodes.filter(n => n.isByproduct && n.rate > 0.005)
  if (!byproducts.length) return

  for (const bp of byproducts) {
    // 找到所有产出该副产物的产生边（多个配方可产出同一副产物）
    const producerEdges = graph.edges.filter(e => e.targetNodeId === bp.id)
    if (!producerEdges.length) continue
    const producerIds = new Set(producerEdges.map(e => e.sourceNodeId))
    const totalProduced = producerEdges.reduce((s, e) => s + e.flowRate, 0)

    // 找到所有消费该物品的边（排除产生边与副产物节点自身）
    const demandEdges = graph.edges.filter(
      e => e.itemClass === bp.itemClass
        && e.targetNodeId !== bp.id
        && e.sourceNodeId !== bp.id
        && !producerIds.has(e.sourceNodeId),
    )
    if (!demandEdges.length) continue

    // 按消费者分组计算需求
    const consumerMap = new Map<string, number>()
    for (const e of demandEdges) {
      consumerMap.set(e.targetNodeId, (consumerMap.get(e.targetNodeId) ?? 0) + e.flowRate)
    }

    const totalDemand = Array.from(consumerMap.values()).reduce((s, v) => s + v, 0)
    const allocRate = Math.min(totalProduced, totalDemand)

    // 按比例分配
    for (const [consumerId, consumerDemand] of consumerMap) {
      const portion = allocRate * (consumerDemand / totalDemand)
      const trimmed = Number(portion.toFixed(4))
      if (trimmed <= 0.005) continue

      // 回灌边从产生方直接连到消费者，多个产生方按产生流量占比分配
      for (const pe of producerEdges) {
        const pePortion = Number((trimmed * (pe.flowRate / totalProduced)).toFixed(4))
        if (pePortion > 0.005) {
          addEdge(graph, pe.sourceNodeId, consumerId, pePortion, bp.itemClass)
        }
      }

      // 扣减该消费者的外部供应边（副产物替代外部供给，优先利用副产物）
      const externalEdges = graph.edges.filter(
        e => e.targetNodeId === consumerId
          && e.itemClass === bp.itemClass
          && e.sourceNodeId !== bp.id
          && !producerIds.has(e.sourceNodeId),
      )
      for (const extEdge of externalEdges) {
        const reduceBy = Math.min(trimmed, extEdge.flowRate)
        extEdge.flowRate = Number((extEdge.flowRate - reduceBy).toFixed(4))

        // 递归缩减上游
        const upstreamNode = graph.nodes.find(n => n.id === extEdge.sourceNodeId)
        if (upstreamNode && !upstreamNode.isByproduct) {
          reduceNodeRate(upstreamNode, graph, index, options, reduceBy)
        }
      }
    }

    // 结算：副产物被全部利用 → 删除副产物节点与产生边，不留中转
    if (allocRate >= totalProduced - 0.005) {
      graph.nodes = graph.nodes.filter(n => n.id !== bp.id)
      graph.edges = graph.edges.filter(
        e => e.targetNodeId !== bp.id && e.sourceNodeId !== bp.id,
      )
    } else {
      // 有多余副产物（产生 > 需求）：按产生方比例缩减各产生边，保留节点展示剩余量
      const leftoverRatio = (totalProduced - allocRate) / totalProduced
      for (const pe of producerEdges) {
        pe.flowRate = Number((pe.flowRate * leftoverRatio).toFixed(4))
      }
      bp.rate = Number((totalProduced - allocRate).toFixed(4))
    }
  }
}

/* ==================== 超频分配 ==================== */

/**
 * 获取节点单台机器的基准产量/分钟。
 */
function getNodePerMachineRate(
  node: ProductionNode,
  index: DataIndex,
  options: PlanOptions,
): number | undefined {
  if (node.recipeUsed) {
    const mainProduct = node.recipeUsed.products.find(p => p.itemClass === node.itemClass)
    if (!mainProduct) return undefined
    return ratePerMinute(mainProduct.amount, node.recipeUsed.manufactoringDuration)
  }
  const extractor = resolveResourceExtractor(node.itemClass, index, options.extractorConfig)
  return extractor?.perMachineRate
}

/**
 * 将可用能量碎片分配给生产节点。
 *
 * 分配分三步：
 *  第 1 步：资源采集器（叶子节点）— 堆 250%，不省碎片
 *  第 2 步：降频节点 — 给刚好消除降频的最小碎片数
 *  第 3 步：所有非叶子节点合流（降频修复后的 + 无降频的），按 rawCount 降序，
 *           再次参与分配（step 3 覆盖 step 2 的结果，合并为一次完整的 calcNodeClocks）
 */
function applyOverclock(
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
): void {
  const totalShards = options.powerShards ?? 0
  if (totalShards <= 0) return

  const prodNodes = graph.nodes.filter(
    n => !n.isByproduct && !n.isUnused && !n.isOutputTarget && (n.recipeUsed || n.machineType),
  )
  if (prodNodes.length === 0) return

  const demands: { node: ProductionNode; rawCount: number; baseRate: number; isLeaf: boolean }[] = []
  for (const node of prodNodes) {
    const baseRate = getNodePerMachineRate(node, index, options)
    if (!baseRate || baseRate <= 0) continue
    const rawCount = Number((node.rate / baseRate).toFixed(4))
    if (rawCount > 1) {
      demands.push({ node, rawCount, baseRate, isLeaf: !node.recipeUsed })
    }
  }

  if (demands.length === 0) return

  // 分组
  const leaf: typeof demands = []
  const nonLeafWithFraction: typeof demands = []
  const nonLeafNoFraction: typeof demands = []

  for (const d of demands) {
    if (d.isLeaf) {
      leaf.push(d)
    } else if (d.rawCount % 1 > 0.005) {
      nonLeafWithFraction.push(d)
    } else {
      nonLeafNoFraction.push(d)
    }
  }

  let remaining = totalShards

  // ··· 第 1 轮：叶子节点 ···
  leaf.sort((a, b) => b.rawCount - a.rawCount)
  for (const d of leaf) {
    if (remaining <= 0) break
    const { clocks, shardsUsed } = calcLeafNodeClocks(d.rawCount, remaining)
    d.node.machineClocks = clocks
    d.node.machineCount = clocks.length
    remaining -= shardsUsed
  }

  // ··· 第 2 轮：降频节点，消除降频 ···
  // 算出消除每个降频节点的最小碎片数，按 rawCount 降序分配
  // 跳过以下区间：0~25%（降频成本低不值得）、50~75%（投入回报低不值得）
  // 注意：Phase 2 只设置 clocks 但不消耗 remaining，Phase 3 才是最终分配者，
  // 避免 Phase 2 消耗的碎片在 Phase 3 中被重复计入而浪费。
  nonLeafWithFraction.sort((a, b) => b.rawCount - a.rawCount)
  for (const d of nonLeafWithFraction) {
    if (remaining <= 0) break
    const fraction = d.rawCount % 1
    if (fraction <= 0.25 || (fraction > 0.50 && fraction <= 0.75)) continue
    const minShards = Math.ceil(2 * fraction)
    if (minShards > remaining) continue
    const { clocks } = calcNodeClocks(d.rawCount, minShards, false)
    d.node.machineClocks = clocks
    d.node.machineCount = clocks.length
  }

  // ··· 第 3 轮：所有非叶子节点合流，分配剩余碎片 ···
  const allNonLeaf = [...nonLeafWithFraction, ...nonLeafNoFraction]
  allNonLeaf.sort((a, b) => b.rawCount - a.rawCount)
  for (const d of allNonLeaf) {
    if (remaining <= 0) break
    const { clocks, shardsUsed } = calcNodeClocks(d.rawCount, remaining, false)
    d.node.machineClocks = clocks
    d.node.machineCount = clocks.length
    remaining -= shardsUsed
  }
}

/**
 * 对单个节点计算最优的机器频率分配。
 *
 * 叶子节点（采集器）：一个资源节点只能放一台采集器，必须全量压到 250%，
 *   以减少节点占用为最高目标，不节省碎片。
 *   如 rawCount=3.2：3碎片→1×250%+1×70% 优先于 2碎片→2×150%+1×20%
 *
 * 非叶子节点（生产建筑）：在可用碎片内取机器数和碎片数的平衡，
 *   碎片均匀分配避免浪费。
 *   如 rawCount=8：
 *     8 碎片 → 4×200%      （vs 贪心 3×250%+1×50% 浪费 1）
 *     4 碎片 → 4×150%+2×100%
 *     2 碎片 → 2×150%+5×100%
 */
function calcNodeClocks(
  rawCountRaw: number,
  shardsAvailable: number,
  isLeaf: boolean,
): { clocks: number[]; shardsUsed: number } {
  const rawCount = Number(rawCountRaw.toFixed(4))
  if (rawCount <= 1) {
    return { clocks: [Number(rawCount.toFixed(4))], shardsUsed: 0 }
  }

  if (isLeaf) {
    // 叶子节点：堆满 250%，不考虑省碎片
    return calcLeafNodeClocks(rawCount, shardsAvailable)
  }

  // 非叶子节点：从最少机器往上试，在可用碎片内取最优平衡
  const maxMachines = Math.ceil(rawCount)
  const minMachines = Math.max(1, Math.ceil(rawCount / 2.5))

  for (let m = minMachines; m <= maxMachines; m++) {
    const shardsNeeded = Math.max(0, Math.ceil(2 * (rawCount - m)))
    if (shardsNeeded > shardsAvailable) continue

    const maxShardsPerMachine = m * 3
    if (shardsNeeded > maxShardsPerMachine) continue

    const perMachine = Math.floor(shardsNeeded / m)
    const extra = shardsNeeded % m

    const clocks: number[] = []
    for (let i = 0; i < m; i++) {
      const s = perMachine + (i < extra ? 1 : 0)
      clocks.push(1 + 0.5 * s)
    }

    // 如果总产能超出 rawCount，微调最后一台降频
    const total = clocks.reduce((sum, c) => sum + c, 0)
    if (total > rawCount + 0.001) {
      const excess = total - rawCount
      clocks[m - 1] = Number((clocks[m - 1]! - excess).toFixed(4))
    }

    return { clocks, shardsUsed: shardsNeeded }
  }

  // 无可用碎片时的默认分配
  return calcDefaultClocks(rawCount)
}

/**
 * 叶子节点：优先减少机器数量，按实际需求设定每台频率。
 *
 * 策略：用 250% 填满整台机器以最小化台数；剩余需求按实际值设定频率，
 * 碎片仅用于抬高频率上限，不按 50% 阶段向上取值。
 *   如 rawCount=1.8、3 碎片 → [1.8]（2 碎片，精确 180%），而非 [2.5]（超产）
 *   如 rawCount=2.6、6 碎片 → [2.5, 0.1]（总产 2.6 精确），而非 [2.5, 0.5]
 */
function calcLeafNodeClocks(
  rawCountRaw: number,
  shardsAvailable: number,
): { clocks: number[]; shardsUsed: number } {
  const rawCount = Number(rawCountRaw.toFixed(4))
  const clocks: number[] = []
  let unmet = rawCount
  let remaining = shardsAvailable

  // 用 250% 填满整台机器，最小化台数（每台需要 3 碎片）
  while (remaining >= 3 && unmet > 2.5 + 0.005) {
    clocks.push(2.5)
    unmet -= 2.5
    remaining -= 3
  }

  // 最后一台（或唯一一台）机器：碎片只用于抬高上限，频率精确按需求
  if (remaining >= 1 && unmet > 1 + 0.005) {
    const shardsNeeded = Math.ceil((unmet - 1) / 0.5)
    if (shardsNeeded <= remaining && shardsNeeded <= 3) {
      // 碎片足以覆盖需求 → 频率精确等于需求，不多用碎片
      clocks.push(Number(unmet.toFixed(4)))
      remaining -= shardsNeeded
      unmet = 0
    } else {
      // 碎片不足以覆盖 → 用尽可用碎片提升上限，剩余需求由后续机器补齐
      const used = Math.min(remaining, 3)
      const clock = 1 + used * 0.5
      clocks.push(clock)
      unmet -= clock
      remaining -= used
    }
  }

  // 剩余不足 1 台的部分：整台 100% + 精确降频
  if (unmet > 0.005) {
    const full100 = Math.floor(unmet)
    for (let i = 0; i < full100; i++) clocks.push(1)
    unmet -= full100
    if (unmet > 0.005) {
      clocks.push(Number(unmet.toFixed(4)))
    } else if (unmet > 0 && clocks.length > 0) {
      clocks[clocks.length - 1] = Number((clocks[clocks.length - 1]! + unmet).toFixed(4))
    }
  }

  return {
    clocks,
    shardsUsed: shardsAvailable - remaining,
  }
}

/**
 * 无碎片时的默认降频分配。
 */
function calcDefaultClocks(rawCount: number): { clocks: number[]; shardsUsed: number } {
  const clocks: number[] = []
  const fullMachines = Math.floor(rawCount)
  for (let i = 0; i < fullMachines; i++) clocks.push(1)
  const remainder = rawCount - fullMachines
  if (remainder > 0.005) {
    clocks.push(Number(remainder.toFixed(4)))
  } else if (remainder > 0 && clocks.length > 0) {
    clocks[clocks.length - 1] = Number((clocks[clocks.length - 1]! + remainder).toFixed(4))
  }
  return { clocks, shardsUsed: 0 }
}
