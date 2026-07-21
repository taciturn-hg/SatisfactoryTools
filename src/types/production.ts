import type { GameRecipe } from './item'

/** 生产图中的节点 */
export interface ProductionNode {
  id: string
  itemClass: string
  itemName: string
  rate: number
  recipeUsed: GameRecipe | null
  machineCount: number
  machineType: string | null
  depth: number
  position?: { x: number; y: number }
  isByproduct: boolean
  itemIcon?: string
}

/** 生产图中的边 */
export interface ProductionEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  flowRate: number
  itemClass: string
}

/** 完整生产图 */
export interface ProductionGraph {
  nodes: ProductionNode[]
  edges: ProductionEdge[]
}

/** 副产物处理策略 */
export type ByproductStrategy = 'discard' | 'utilize'

/** 单次规划的参数 */
export interface PlanOptions {
  targetItemClass: string
  targetRate: number
  alternativeRecipes: Map<string, string>
  byproductStrategy: ByproductStrategy
  layoutDirection: 'vertical' | 'horizontal'
}

/** 保存的规划方案 */
export interface SavedPlan {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  options: PlanOptions
  graph: ProductionGraph
}
