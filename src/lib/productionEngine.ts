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
 * 规则：整数台满频(100%) + 不足一台时降频处理。
 * 微量余数（< 0.005）合并到最后一台满频机器上以避免累积产能不足。
 * 如 2.4 台 → 2×100%, 1×40%
 * 如 2.003 台 → 2×100.3%
 */
function calcMachineGroup(rate: number, perMachineRate: number): {
  machineCount: number
  clocks: number[]
} {
  if (perMachineRate <= 0 || rate <= 0 || !Number.isFinite(rate) || !Number.isFinite(perMachineRate)) {
    return { machineCount: 0, clocks: [] }
  }
  const rawCount = rate / perMachineRate
  const fullMachines = Math.floor(rawCount)
  const remainder = rawCount - fullMachines
  const clocks: number[] = []

  if (fullMachines > 0) {
    clocks.push(...Array<number>(fullMachines).fill(1))
    const roundedRemainder = Number(remainder.toFixed(4))
    if (roundedRemainder > 0.005) {
      clocks.push(roundedRemainder)
    } else if (roundedRemainder > 0) {
      clocks[clocks.length - 1] = Number((1 + roundedRemainder).toFixed(4))
    }
  } else {
    clocks.push(Number(rawCount.toFixed(4)))
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
  const factoryCandidates = allCandidates.filter(
    r => !r.producedIn.some(p => p === 'Build_Converter')
  )
  if (factoryCandidates.length === 0) return null

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

  // 根节点：目标产品
  const rootNode = addNode(graph, {
    itemClass: options.targetItemClass,
    itemName: index.items.get(options.targetItemClass)?.displayName || options.targetItemClass,
    rate: options.targetRate,
    recipeUsed: null,
    machineCount: 0,
    machineClocks: [],
    machineType: null,
    depth: 0,
    isByproduct: false,
  })

  expand(rootNode, new Set())

  mergeDuplicateNodes(graph, index, options)
  applyInputItems(graph, index, options)

  // 将根节点拆分为机器节点 + 目标产出展示节点
  const planRoot = graph.nodes.find(n => n.depth === 0 && !n.isUnused && !n.isByproduct)
  if (planRoot && (planRoot.recipeUsed || planRoot.machineType)) {
    const outputNode: ProductionNode = {
      id: nextId(),
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
    }
    graph.nodes.push(outputNode)
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

    // 找生产该物品的节点（优先非副产物，回退到副产物）
    let producerNode = graph.nodes.find(
      n => n.itemClass === itemClass && !n.isByproduct && !n.isUnused
    )
    if (!producerNode) {
      producerNode = graph.nodes.find(
        n => n.itemClass === itemClass && n.isByproduct && !n.isUnused
      )
    }
    if (!producerNode) continue

    // 找所有消耗该物品的消费者（入边 itemClass 匹配的 target）
    const consumerEdges = graph.edges.filter(e => e.itemClass === itemClass && e.targetNodeId !== producerNode.id)
    const distinctConsumers = [...new Set(consumerEdges.map(e => e.targetNodeId))]
    const totalNeeded = consumerEdges.reduce((s, e) => s + e.flowRate, 0)

    if (totalNeeded > 0) {
      for (const consumerId of distinctConsumers) {
        const consumerTotal = consumerEdges
          .filter(e => e.targetNodeId === consumerId)
          .reduce((s, e) => s + e.flowRate, 0)
        const portion = providedRate * (consumerTotal / totalNeeded)
        addEdge(graph, inputNode.id, consumerId, portion, itemClass)
      }
    } else {
      // 无消费者 → 直接连到生产者（视为消耗自身的示意）
      addEdge(graph, inputNode.id, producerNode.id, providedRate, itemClass)
    }

    // 扣减生产节点的需求
    reduceNodeRate(producerNode, graph, index, options, providedRate)
  }
}

/**
 * 递归扣减节点 rate，重算台数，并向上游回溯缩减。
 */
function reduceNodeRate(
  node: ProductionNode,
  graph: ProductionGraph,
  index: DataIndex,
  options: PlanOptions,
  reduceBy: number,
): void {
  const newRate = Math.max(0, node.rate - reduceBy)

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

    // 按新 machineCount 重新计算每个原料的需求量，直接减到上游
    // 同时更新该节点所有出边的 flowRate，保持出入流量一致
    const totalClock = group.clocks.reduce((s, c) => s + c, 0)
    for (const edge of graph.edges) {
      if (edge.sourceNodeId !== node.id) continue
      edge.flowRate = ratePerMinute(
        node.recipeUsed!.products.find(p => p.itemClass === edge.itemClass)?.amount ?? 0,
        node.recipeUsed!.manufactoringDuration,
      ) * totalClock
    }

    for (const ingredient of node.recipeUsed.ingredients) {
      const newIngredientRate = ratePerMinute(ingredient.amount, node.recipeUsed.manufactoringDuration) * totalClock

      const edge = graph.edges.find(
        e => e.targetNodeId === node.id && e.itemClass === ingredient.itemClass
      )
      if (!edge) continue

      const oldIngredientRate = edge.flowRate
      edge.flowRate = newIngredientRate

      const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId)
      if (!sourceNode || sourceNode.isByproduct) continue

      reduceNodeRate(sourceNode, graph, index, options, oldIngredientRate - newIngredientRate)
    }
  } else {
    // 资源节点（采集器），只需更新台数
    const extractor = resolveResourceExtractor(node.itemClass, index, options.extractorConfig)
    if (extractor) {
      const group = calcMachineGroup(node.rate, extractor.perMachineRate)
      node.machineCount = group.machineCount
      node.machineClocks = group.clocks
    }
  }
}

/**
 * 删除节点及其所有独占上游节点（递归清理叶子方向）。
 *
 * 只有当一个上游节点的所有出边都指向即将被删除的节点时，它才会被删除。
 * 这确保共享的上游节点（如同时供应铁板和铁棒的铁锭）不会被错误地删除。
 */
function removeNodeAndUpstream(node: ProductionNode, graph: ProductionGraph): void {
  const toRemove = new Set<string>()
  const queue = [node.id]

  toRemove.add(node.id)

  // BFS 收集：仅当上游节点的所有出边目的地都在 toRemove 中时才加入
  let head = 0
  while (head < queue.length) {
    const id = queue[head]!
    head++
    for (const edge of graph.edges) {
      if (edge.targetNodeId !== id) continue
      const src = edge.sourceNodeId
      if (toRemove.has(src)) continue
      // 检查该上游节点的所有出边是否都指向待删除节点
      const allOutToRemove = graph.edges
        .filter(e => e.sourceNodeId === src)
        .every(e => toRemove.has(e.targetNodeId))
      if (allOutToRemove) {
        toRemove.add(src)
        queue.push(src)
      }
    }
  }

  graph.edges = graph.edges.filter(
    e => !toRemove.has(e.sourceNodeId) && !toRemove.has(e.targetNodeId)
  )
  graph.nodes = graph.nodes.filter(n => !toRemove.has(n.id))
}
