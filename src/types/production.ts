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
  /** 该节点安装索莫晶体的机器台数。每台需装入「输入口数量」个晶体（见 config/buildingConfig 的 somerCrystalCost），
   *  装够后该机产量翻倍、原料消耗不变、功率按二次方 */
  somerMachines?: number
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
  /** 多目标产出（支持同时规划多个物品），为空时使用 targetItemClass/targetRate */
  targetItems?: { itemClass: string; rate: number }[]
  alternativeRecipes: Map<string, string>
  layoutDirection: 'vertical' | 'horizontal'
  extractorConfig?: ExtractorConfig
  /** 用户输入的原料（itemClass → 提供速率），用于扣减图中的需求 */
  inputItems?: Map<string, number>

  /** 可用于超频的能量碎片数量 */
  powerShards?: number
  /** 可用的索莫晶体数量。用于加工建筑增产：一台机器需装「输入口数量」个晶体后产量翻倍（原料不变、功率平方） */
  somerCount?: number
  /** 是否启用副产物自循环，默认关闭 */
  byproductRecycling?: boolean
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
