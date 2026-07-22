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
  /** 每台机器的频率分配，如 [1, 1, 0.4] 表示 2 台满频 + 1 台 40% */
  machineClocks: number[]
  depth: number
  position?: { x: number; y: number }
  isByproduct: boolean
  /** 用户输入的原料在图内未匹配到时的孤立节点 */
  isUnused?: boolean
  /** 标记该节点为目标产出展示节点（绿色），由引擎在末尾自动添加 */
  isOutputTarget?: boolean
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

/** 单次规划的参数 */
export interface PlanOptions {
  targetItemClass: string
  targetRate: number
  alternativeRecipes: Map<string, string>
  layoutDirection: 'vertical' | 'horizontal'
  extractorConfig?: ExtractorConfig
  /** 用户输入的原料（itemClass → 提供速率），用于扣减图中的需求 */
  inputItems?: Map<string, number>

  /** 可用于超频的能量碎片数量 */
  powerShards?: number
}

/** 采矿机等级 */
export type MinerLevel = 'mk1' | 'mk2' | 'mk3'

/** 资源节点纯度 */
export type NodePurity = 'impure' | 'normal' | 'pure'

/** 基础设施配置（采集器、传送带、管道等） */
export interface ExtractorConfig {
  minerLevel: MinerLevel
  minerPurity: NodePurity
  oilExtractor: 'oil_well' | 'resource_well'
  oilPurity: NodePurity
  waterExtractor: 'water_extractor' | 'resource_well'
  waterPurity: NodePurity
  gasPurity: NodePurity
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
