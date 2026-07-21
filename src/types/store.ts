import type { DataIndex, GameItem, GameGenerator } from './item'
import type { ProductionNode, ProductionGraph, PlanOptions, SavedPlan } from './production'
import type { PowerPlanOptions, PowerPlanResult } from './power'

/** dataStore 状态 */
export interface DataStoreState {
  index: DataIndex | null
  isLoaded: boolean
  isLoading: boolean
  loadError: string | null
}

/** planStore 状态 */
export interface PlanStoreState {
  currentPlan: PlanOptions | null
  currentGraph: ProductionGraph | null
  isComputing: boolean
}

/** powerStore 状态 */
export interface PowerStoreState {
  currentOptions: PowerPlanOptions | null
  currentResult: PowerPlanResult | null
  selectedGenerator: GameGenerator | null
  isComputing: boolean
}

/** uiStore 状态 */
export interface UiStoreState {
  selectedItem: GameItem | null
  selectedNode: ProductionNode | null
  isNodeDetailModalOpen: boolean
  isSavePlanModalOpen: boolean
  searchQuery: string
  theme: 'dark' | 'light'
}

/** savedPlansStore 状态 */
export interface SavedPlansStoreState {
  plans: SavedPlan[]
}
