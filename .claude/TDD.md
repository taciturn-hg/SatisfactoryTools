# 技术设计文档（TDD）

## 《幸福工厂》产线规划工具

**版本**：v1.0
**日期**：2026-07-21

---

## 1. 架构总览

### 1.1 分层架构

```
┌──────────────────────────────────────────────────────────┐
│                     UI 层 (Vue 3)                          │
│  components/common/    components/left-panel/              │
│  components/flow-chart/  components/modals/    views/      │
│                    composables/                            │
├──────────────────────────────────────────────────────────┤
│                 状态管理层 (Pinia)                          │
│  dataStore  │  planStore  │  uiStore  │  savedPlansStore  │
├──────────────────────────────────────────────────────────┤
│               业务逻辑层 (src/lib/)                         │
│  dataParser │ productionEngine │ graphTransformer          │
│  layoutHelper │ planSerializer │ db                       │
├──────────────────────────────────────────────────────────┤
│                数据持久化层                                 │
│  IndexedDB (Dexie)  │  localStorage (方案存取)             │
└──────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

- **UI 与逻辑分离**：`src/lib/` 中的模块为纯函数/类，不依赖 Vue 或任何 UI 框架，可独立进行单元测试。
- **单向数据流**：UI 事件 → Store actions → 业务逻辑 → Store state → UI 响应式渲染。
- **类型优先**：所有模块的公共接口均通过 `src/types/` 定义完整的 TypeScript 类型，禁止使用 `any`。
- **渐进增强**：核心功能（搜索、规划）先于辅助功能（方案管理、导出）实现。

### 1.3 开发策略

采用**先 UI 后逻辑**的分阶段开发方式，尽早获得可视化的页面反馈，避免在前期过度陷入纯逻辑细节。

**阶段一：UI 骨架搭建**

- 搭建页面框架（左右分栏布局、搜索框、流程图占位区域、弹窗槽位等）。
- 所有组件仅实现模板 + 样式，不接入真实业务逻辑。
- 数据全部使用 **mock / 硬编码**，例如写死一组搜索结果、写死一套生产图节点数据。
- 状态管理（Pinia store）和 Composables 可先以 dummy 实现存在，但不与 `lib/` 层对接。
- Vue Flow 先用静态示例节点跑通渲染链路。

**阶段二：业务逻辑接入**

- 逐个实现 `src/lib/` 下的纯逻辑模块（`dataParser` → `productionEngine` → `layoutHelper` → `graphTransformer` → `planSerializer`）。
- 每完成一个模块，即替换对应组件中的 mock 数据，逐步串联成完整链路。
- 模块可独立开发和验证（纯函数，不依赖 Vue），便于调试和后续单元测试。

**阶段三：辅助功能完善**

- 实现方案保存/加载/导入/导出（`savedPlansStore` + `SavePlanModal`）。
- UI 细节打磨（深色主题、动画过渡、响应式适配）。
- 性能优化、错误边界处理、边界情况覆盖。

**目录结构弹性原则**

- 本文档的目录结构为**初始推荐**，开发过程中可根据实际需要随时调整（拆分、合并、新增目录）。
- `components/` 下的分组以功能域为主要依据，当某个分组膨胀时可进一步细分。
- `composables/`、`constants/`、`utils/` 等目录随实际复用需求逐步填充，不必一开始就创建全部空文件。

---

## 2. 类型系统设计

### 2.1 游戏原始数据类型 (`src/types/item.ts`)

```ts
/** 物品形态 */
type ItemForm = 'solid' | 'liquid' | 'gas'

/** 游戏中的物品/资源描述符 */
interface GameItem {
  className: string // 如 "Desc_IronPlate_C"
  displayName: string // 如 "铁板"
  description: string
  stackSize: number // 单格最大堆叠数
  energyValue: number // 作为燃料时的能量值 (MJ)
  radioactiveDecay: number // 放射性衰减
  form: ItemForm
  smallIcon?: string // 图标路径 (base64 或 URL)
}

/** 配方中的物量对 */
interface ItemAmount {
  itemClass: string // GameItem.className
  amount: number
}

/** 制造配方 */
interface GameRecipe {
  className: string // 如 "Recipe_IronPlate_C"
  displayName: string
  ingredients: ItemAmount[]
  products: ItemAmount[]
  manufactoringDuration: number // 制造耗时（秒）
  producedIn: string[] // 可用建筑 className 列表
  isAlternate: boolean // 是否为替代配方
}

/** 生产建筑 */
interface GameBuilding {
  className: string
  displayName: string
  description: string
  powerConsumption: number // 基础功耗 (MW)，实际功耗可能随超频变化
}

/** 解析后的内存索引 */
interface DataIndex {
  items: Map<string, GameItem> // className -> GameItem
  recipes: Map<string, GameRecipe[]> // 物品className -> 所有产出该物品的配方
  recipesByIngredient: Map<string, GameRecipe[]> // 原料className -> 消耗该原料的配方
  buildings: Map<string, GameBuilding> // className -> GameBuilding
}
```

### 2.2 生产图类型 (`src/types/production.ts`)

```ts
/** 生产图中的节点 */
interface ProductionNode {
  id: string // 唯一标识，如 "node_iron_plate_0"
  itemClass: string
  itemName: string // displayName 快照，避免反复查表
  rate: number // 每分钟产量
  recipeUsed: GameRecipe | null // null 表示基础资源（叶子节点）
  machineCount: number // 所需机器台数
  machineType: string | null // 建筑 className，叶子节点为 null
  depth: number // 从根节点（最终产品）算起的层级，根节点 depth=0
  position?: { x: number; y: number } // 布局坐标（layoutHelper 填充）
  isByproduct: boolean // 是否是由副产物引入的节点
  itemIcon?: string // 物品图标路径
}

/** 生产图中的边 */
interface ProductionEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  flowRate: number // 每分钟流量
  itemClass: string // 传输的物品 className
}

/** 完整生产图 */
interface ProductionGraph {
  nodes: ProductionNode[]
  edges: ProductionEdge[]
}

/** 副产物处理策略 */
type ByproductStrategy = 'discard' | 'utilize'

/** 单次规划的参数 */
interface PlanOptions {
  targetItemClass: string
  targetRate: number // 每分钟目标产量
  alternativeRecipes: Map<string, string> // itemClass -> 选用的配方 className
  byproductStrategy: ByproductStrategy
  layoutDirection: 'vertical' | 'horizontal' // 流程图布局方向
}

/** 保存的规划方案 */
interface SavedPlan {
  id: string // uuid
  name: string // 用户自定义方案名称
  createdAt: number // timestamp
  updatedAt: number
  options: PlanOptions
  graph: ProductionGraph // 含节点位置坐标的完整图
}
```

### 2.3 Store 状态类型 (`src/types/store.ts`)

```ts
// dataStore
interface DataStoreState {
  index: DataIndex | null
  isLoaded: boolean
  isLoading: boolean
  loadError: string | null
}

// planStore
interface PlanStoreState {
  currentPlan: PlanOptions | null
  currentGraph: ProductionGraph | null
  isComputing: boolean
}

// uiStore
interface UiStoreState {
  selectedItem: GameItem | null
  selectedNode: ProductionNode | null
  isNodeDetailModalOpen: boolean
  isSavePlanModalOpen: boolean
  searchQuery: string
  theme: 'dark' | 'light'
}

// savedPlansStore
interface SavedPlansStoreState {
  plans: SavedPlan[]
}
```

### 2.4 统一导出 (`src/types/index.ts`)

所有类型通过 barrel export 从 `src/types/index.ts` 统一重新导出，其他模块通过 `@/types` 一次性引入。

---

## 3. 核心模块设计

### 3.1 数据解析器 (`src/lib/dataParser.ts`)

**职责**：将 `zh-Hans.json` 原始数据解析为 `DataIndex`。

**输入**：游戏导出的 JSON 数组，每个元素包含 `NativeClass` 字段区分类型。

**处理流程**：

```
JSON 数组
  │
  ├─ 过滤 NativeClass === 'Class' 的元素
  ├─ 按类别分发：
  │   ├─ FGItemDescriptor / FGResourceDescriptor → GameItem
  │   ├─ FGRecipe → GameRecipe
  │   │   ├─ 解析 mIngredients (ClassName, Amount)
  │   │   ├─ 解析 mProduct (ClassName, Amount)
  │   │   ├─ 解析 mManufactoringDuration
  │   │   └─ 解析 mProducedIn
  │   └─ FGBuildingDescriptor → GameBuilding
  │
  └─ 构建索引：
      ├─ items: Map<className, GameItem>
      ├─ recipes: Map<itemClass, GameRecipe[]> (按产出物品索引)
      ├─ recipesByIngredient: Map<itemClass, GameRecipe[]> (按原料索引)
      └─ buildings: Map<className, GameBuilding>
```

**关键实现细节**：

- 对每个 `FGRecipe`，建立**双向映射**：一个配方可能产出多种物品（副产物），需将配方分别关联到每种产物。
- 处理 `mDisplayName` 字段获取本地化名称。
- 图标路径从 `mSmallIcon` / `mPersistentBigIcon` 中提取。
- 区分标准配方与替代配方：根据 `mRecipeType` 或名称前缀判断。

**接口**：

```ts
function parseGameData(rawJson: unknown[]): DataIndex
```

---

### 3.2 生产规划引擎 (`src/lib/productionEngine.ts`)

**职责**：根据目标物品和产量，执行反向推导，输出 `ProductionGraph`。

**核心算法**：带循环检测的深度优先搜索（DFS），逐层展开原料需求。

```ts
function planProduction(index: DataIndex, options: PlanOptions): ProductionGraph {
  const graph: ProductionGraph = { nodes: [], edges: [] }
  const visited = new Set<string>() // 已访问的 itemClass，防止循环

  function expand(parentNode: ProductionNode): void {
    visited.add(parentNode.itemClass)

    // 1. 选择配方
    const recipe = selectRecipe(index, parentNode.itemClass, options.alternativeRecipes)

    if (!recipe) {
      // 基础资源，标记为叶子节点
      parentNode.recipeUsed = null
      parentNode.machineCount = 1
      parentNode.machineType = null
      return
    }

    parentNode.recipeUsed = recipe
    parentNode.machineType = recipe.producedIn[0] ?? null

    // 2. 计算所需机器台数
    // 主产物的每分钟单台产量 = (主产物单次产量 / 制造耗时秒) * 60
    const mainProduct = recipe.products.find(p => p.itemClass === parentNode.itemClass)!
    const perMachineRate = (mainProduct.amount / recipe.manufactoringDuration) * 60
    const machineCount = Math.ceil(parentNode.rate / perMachineRate)
    parentNode.machineCount = machineCount

    // 3. 处理副产物（配方产出中的其他物品）
    for (const product of recipe.products) {
      if (product.itemClass === parentNode.itemClass) continue // 跳过主产物
      if (options.byproductStrategy === 'discard') continue

      const byproductRate = (product.amount / recipe.manufactoringDuration) * 60 * machineCount
      const byproductNode = addNode(graph, {
        itemClass: product.itemClass,
        itemName: index.items.get(product.itemClass)?.displayName ?? product.itemClass,
        rate: byproductRate,
        depth: parentNode.depth,
        isByproduct: true,
      })
      addEdge(graph, parentNode.id, byproductNode.id, byproductRate, product.itemClass)
    }

    // 4. 对每个原料递归展开
    for (const ingredient of recipe.ingredients) {
      const ingredientRate = (ingredient.amount / recipe.manufactoringDuration) * 60 * machineCount

      if (visited.has(ingredient.itemClass)) {
        console.warn(`循环依赖：${ingredient.itemClass} 在规划 ${parentNode.itemClass} 时已被访问`)
        continue
      }

      const childNode = addNode(graph, {
        itemClass: ingredient.itemClass,
        itemName: index.items.get(ingredient.itemClass)?.displayName ?? ingredient.itemClass,
        rate: ingredientRate,
        depth: parentNode.depth + 1,
        isByproduct: false,
      })
      addEdge(graph, childNode.id, parentNode.id, ingredientRate, ingredient.itemClass)
      expand(childNode)
    }
  }

  // 5. 从根节点开始展开
  const rootNode = addNode(graph, {
    itemClass: options.targetItemClass,
    itemName: index.items.get(options.targetItemClass)?.displayName ?? options.targetItemClass,
    rate: options.targetRate,
    depth: 0,
    isByproduct: false,
  })
  expand(rootNode)

  return graph
}
```

**配方选择逻辑** (`selectRecipe`)：

```ts
function selectRecipe(
  index: DataIndex,
  itemClass: string,
  alternatives: Map<string, string>,
): GameRecipe | null {
  const candidates = index.recipes.get(itemClass)
  if (!candidates || candidates.length === 0) return null // 基础资源，无配方

  // 若用户指定了替代配方，优先使用
  const selected = alternatives.get(itemClass)
  if (selected) {
    return candidates.find(r => r.className === selected) ?? candidates[0]!
  }

  // 默认使用标准配方（isAlternate === false 的第一个）
  return candidates.find(r => !r.isAlternate) ?? candidates[0]!
}
```

**边界条件处理**：

| 场景 | 处理方式 |
|------|----------|
| 目标物品无任何配方（基础资源） | 直接返回单节点图（叶子节点） |
| 循环依赖（A→B→C→A） | 检测已访问节点，停止展开，记录警告 |
| 替代配方产出物不同 | 仅展开所选配方中的原料，不混合多个配方 |
| 配方有多个产物（副产物） | 根据策略：discard 忽略 / utilize 添加副产物节点 |
| 配料表中存在未知物品 | `index.items.get()` 返回 undefined，使用 className 兜底，记录警告 |

---

### 3.3 图转换器 (`src/lib/graphTransformer.ts`)

**职责**：将 `ProductionGraph`（业务模型）转换为 Vue Flow 可消费的节点/连线数据格式。

**接口**：

```ts
import type { Node, Edge } from '@vue-flow/core'

function toVueFlowGraph(graph: ProductionGraph): {
  nodes: Node<ProductionNode>[]
  edges: Edge[]
}
```

**转换要点**：

- 将 `ProductionNode.position` 映射到 Vue Flow 节点的 `position` 字段。
- 将 `ProductionEdge.sourceNodeId` / `targetNodeId` 映射到 Vue Flow 连线的 `source` / `target`。
- 设置 Vue Flow 节点 `type: 'production-node'`，关联到自定义节点组件 `FlowNode.vue`。
- 连线上标注流量值（`label` 字段）。
- 处理节点间的父子关系（via `parentNode` 或 `Handle` 连接点）。

---

### 3.4 图布局辅助 (`src/lib/layoutHelper.ts`)

**职责**：对 `ProductionGraph` 的节点执行自动布局，填充 `position` 字段。

**技术选型**：使用 `dagre` 库进行层次化有向图布局。

**接口**：

```ts
function autoLayout(graph: ProductionGraph, direction: 'vertical' | 'horizontal'): void
```

**实现要点**：

- 构建 dagre 图：将 `ProductionNode` 和 `ProductionEdge` 注册到 dagre 实例。
- 根据 `direction` 设置 `rankdir`（`TB` = 上到下，`LR` = 左到右）。
- dagre 计算后，将 `x, y` 写回 `node.position`。
- 节点 `width` / `height` 根据名称长度和图标尺寸估算。
- 副产物节点可通过偏移量略微偏离主链。

---

### 3.5 方案序列化 (`src/lib/planSerializer.ts`)

**职责**：负责 `SavedPlan` 的序列化（存储）与反序列化（恢复）。

**为什么需要独立模块**：`Map` 对象不能直接 `JSON.stringify`，需要转换。

**接口**：

```ts
function serializePlan(plan: SavedPlan): string
function deserializePlan(json: string): SavedPlan
```

**转换要点**：

- `Map<string, string>`（替代配方映射）→ 二维数组 → JSON
- `ProductionGraph` 中的循环引用防护
- 反序列化时重建 `Map` 对象

---

### 3.6 数据持久化策略

| 数据 | 存储位置 | 库 | 说明 |
|------|----------|-----|------|
| 游戏原始索引 | IndexedDB | Dexie | 首次加载解析后写入，后续直接从 DB 读取 |
| 规划方案列表 | localStorage | - | 存储 `SavedPlan[]`，单个方案含完整图数据 |
| 方案导出文件 | 文件系统 | - | JSON 格式，供用户备份/分享 |
| UI 偏好设置 | localStorage | - | 主题、布局方向偏好、最近搜索记录 |

**Dexie 数据库设计**：

```ts
// src/lib/db.ts
import Dexie, { type EntityTable } from 'dexie'

interface CachedItem {
  className: string
  displayName: string
  data: GameItem
}

const db = new Dexie('SatisfactoryToolsDB') as Dexie & {
  items: EntityTable<CachedItem, 'className'>
}

db.version(1).stores({
  items: 'className, displayName',
})
```

---

## 4. 状态管理设计

### 4.1 数据 Store (`src/stores/dataStore.ts`)

```ts
// 对外暴露的状态和方法
interface DataStore {
  // 状态
  index: DataIndex | null
  isLoaded: boolean
  isLoading: boolean
  loadError: string | null

  // 方法
  loadData(): Promise<void> // 首次从 JSON 加载解析，后续从 IndexedDB 读取
  searchItems(query: string): GameItem[] // 模糊搜索（按 displayName）
  getItem(className: string): GameItem | undefined
  getRecipesForItem(className: string): GameRecipe[] // 产出该物品的所有配方
  getUsagesOfItem(className: string): GameRecipe[] // 消耗该物品的所有配方
}
```

**加载流程**：

1. 检查 IndexedDB 缓存 → 命中则反序列化为 `DataIndex`
2. 未命中 → fetch `zh-Hans.json` → `parseGameData()` → 写入 IndexedDB → 返回
3. 加载中 `isLoading = true`，异常时设置 `loadError`

### 4.2 规划 Store (`src/stores/planStore.ts`)

```ts
interface PlanStore {
  // 状态
  currentPlan: PlanOptions | null
  currentGraph: ProductionGraph | null
  isComputing: boolean

  // 方法
  setTarget(itemClass: string, rate: number): void
  selectAlternativeRecipe(itemClass: string, recipeClass: string): void
  setByproductStrategy(strategy: ByproductStrategy): void
  setLayoutDirection(dir: 'vertical' | 'horizontal'): void
  compute(): Promise<void> // productionEngine → graphTransformer → layoutHelper → currentGraph
}
```

### 4.3 UI Store (`src/stores/uiStore.ts`)

```ts
interface UiStore {
  // 状态
  selectedItem: GameItem | null
  selectedNode: ProductionNode | null
  isNodeDetailModalOpen: boolean
  isSavePlanModalOpen: boolean
  searchQuery: string
  theme: 'dark' | 'light'

  // 方法
  selectItem(item: GameItem | null): void
  selectNode(node: ProductionNode | null): void
  toggleNodeDetailModal(): void
  toggleSavePlanModal(): void
  setSearchQuery(query: string): void
  toggleTheme(): void
}
```

### 4.4 方案存储 Store (`src/stores/savedPlansStore.ts`)

```ts
interface SavedPlansStore {
  // 状态
  plans: SavedPlan[]

  // 方法
  loadPlans(): void // 从 localStorage 读取
  savePlan(name: string, plan: PlanOptions, graph: ProductionGraph): void
  deletePlan(id: string): void
  exportPlan(id: string): string // 导出为 JSON 字符串
  importPlan(json: string): void // 从 JSON 导入
}
```

`planStore` 关注**当前正在编辑的规划**，`savedPlansStore` 关注**持久化的方案列表**，两者职责分离。

### 4.5 统一导出 (`src/stores/index.ts`)

```ts
export { useDataStore } from './dataStore'
export { usePlanStore } from './planStore'
export { useUiStore } from './uiStore'
export { useSavedPlansStore } from './savedPlansStore'
```

---

## 5. 组件设计

### 5.1 组件树

```
App.vue
├── common/AppHeader.vue                      # 顶部导航栏
│   ├── common/AppLogo.vue                    # Logo 图片
│   ├── 导航下拉（"工厂计划" → 生产计划/发电计划）
│   ├── 语言切换下拉
│   └── GitHub 跳转按钮
├── right-panel/RightPanel.vue                # 右侧面板容器（三栏导航）
│   ├── common/SearchInput.vue                # 搜索输入框
│   ├── right-panel/ItemDetail.vue            # 物品卡片（图标+名称+产量+删除）
│   ├── right-panel/PlanParams.vue            # 配置面板（配方/采集/超频）
│   └── right-panel/PlanActions.vue           # 底部按钮（规划/重置/保存/加载）
├── flow-chart/FlowChart.vue                  # 流程图占位 / Vue Flow 画布
│   └── flow-chart/FlowToolbar.vue            # 缩放/适应工具栏
├── modals/NodeDetailModal.vue                # 节点详情弹窗（待实现）
└── modals/SavePlanModal.vue                  # 保存方案命名弹窗（待实现）
```

组件按功能域分目录，`common/` 下放跨域复用的通用组件。

### 5.2 关键组件设计

#### RightPanel.vue

- **Props**: 无（通过 store 获取状态）
- **布局**: 纵向 flex，高度撑满视口，`overflow-y: auto`
- **三栏导航**: 产出/原料/配置，三栏等宽
- **产出 & 原料页签**: 搜索下拉框（`a-select` + `show-search`）+ "＋"添加按钮，选中物品后点击添加按钮才加入列表，不可重复添加，添加后自动清空选择
- **配置页签**: 包含 `PlanParams`（配方选择、采集运输选级、超频输入）

#### ItemDetail.vue

- **Props**: `itemIndex`, `itemValue`, `itemName`
- **布局**: 物品卡片（图标 + 名称 + ⓘ描述气泡 + 产量输入 + ✕删除）
- **交互**:
  - ⓘ 图标悬停 → Ant Design Tooltip 显示物品描述
  - 产量输入为原生 `input[type=number]`，小于等于 0 时自动删除
  - ✕ 删除按钮 → 从列表移除

#### PlanParams.vue

- **三块区域**（以横线分隔）:
  - **配方区**: 替代配方多选（`a-select mode="multiple"`）+ 转换器配方多选，均支持搜索、全选/清除按钮、`listHeight=128` 滚动
  - **采集与运输区**: 6 个单选下拉框（采矿/采油/采水/采气/传送带/管道等级），各自独立绑定变量
  - **超频区**: 能量碎片 + 索莫晶体数字输入（`min=0 step=1`），标注"暂未完成"

#### PlanActions.vue

- **Props**: 无（发出事件）
- **布局**: 横向 4 按钮（规划/重置/保存/加载）
- **交互**: 重置按钮红色背景，点击清空产出和原料列表；其余按钮当前为 disabled

#### FlowChart.vue

- **库**: Vue Flow (`@vue-flow/core`)
- **Props**: 无（从 `planStore.currentGraph` 获取数据，经 `graphTransformer` 转换）
- **交互**:
  - 画布拖拽平移（Vue Flow 内置）
  - 滚轮缩放（Vue Flow 内置）
  - 节点拖拽调整位置（Vue Flow 内置）
  - 点击节点 → `uiStore.selectNode()` → `NodeDetailModal` 弹出
  - 支持迷你地图（Vue Flow MiniMap 插件）
- **性能优化**:
  - 节点 > 100 时启用 Vue Flow 视口裁剪（仅渲染可见节点）
  - 节点数据使用 `shallowRef` 避免深度响应式开销

#### FlowNode.vue

- **Vue Flow 自定义节点**（type: `'production-node'`），渲染 `ProductionNode` 数据
- **视觉**:
  - 矩形卡片，圆角
  - 物品图标 + 名称（主标题）
  - 流量值（副标题，如 `15/min`）
  - 机器信息（底部小字，如 `构造机 × 2.4`）
- **颜色编码**:
  - 基础资源节点：棕色/橙色
  - 中间产物节点：蓝色/青色
  - 最终产品节点：金色
  - 副产物节点：灰色 + 虚线边框

#### NodeDetailModal.vue

- **触发**: `uiStore.isNodeDetailModalOpen === true`
- **内容**: 物品名称+图标、当前流量、配方详情（原料→产物）、机器类型和台数、制造耗时
- **交互**: 点击遮罩或关闭按钮 → `uiStore.toggleNodeDetailModal()`

#### SavePlanModal.vue

- **触发**: `uiStore.isSavePlanModalOpen === true`
- **内容**: 输入方案名称 + 确认/取消
- **交互**: 确认 → `savedPlansStore.savePlan()` → 关闭弹窗

---

## 6. 路由设计

```ts
// src/router/index.ts
const routes = [
  {
    path: '/',
    redirect: '/production-plan',
  },
  {
    path: '/production-plan',
    name: 'production-plan',
    component: () => import('@/views/ProductionPlanPage.vue'),
  },
  {
    path: '/power-plan',
    name: 'power-plan',
    component: () => import('@/views/PowerPlanPage.vue'),
  },
]
```

`/` 自动重定向到 `/production-plan`。`/production-plan` 为主页面（流程图 + 右侧面板布局），`/power-plan` 为发电计划占位页。

`App.vue` 为根布局：顶部 `AppHeader`（Logo + 导航 + 语言切换 + GitHub）+ 底部 `RouterView`。

---

## 7. Composables 设计

Vue 组合式函数，封装可复用的交互逻辑，解耦组件与 Store 的调用细节。

### 7.1 `useSearch` (`src/composables/useSearch.ts`)

```ts
function useSearch() {
  const query = ref('')
  const suggestions = ref<GameItem[]>([])
  const isSearching = ref(false)

  // 对 dataStore.searchItems 做防抖（200ms）
  watchDebounced(query, (q) => {
    suggestions.value = dataStore.searchItems(q)
  })

  function selectItem(item: GameItem): void {
    uiStore.selectItem(item)
    query.value = item.displayName
    suggestions.value = []
  }

  return { query, suggestions, isSearching, selectItem }
}
```

### 7.2 `useProductionPlan` (`src/composables/useProductionPlan.ts`)

```ts
function useProductionPlan() {
  const planStore = usePlanStore()
  const uiStore = useUiStore()

  async function executePlan(): Promise<void> {
    if (!planStore.currentPlan) return
    await planStore.compute()
    // 计算完成后，自动布局
    if (planStore.currentGraph) {
      autoLayout(planStore.currentGraph, planStore.currentPlan.layoutDirection)
    }
  }

  function handleNodeClick(nodeId: string): void {
    const node = planStore.currentGraph?.nodes.find(n => n.id === nodeId) ?? null
    uiStore.selectNode(node)
    uiStore.toggleNodeDetailModal()
  }

  return { executePlan, handleNodeClick }
}
```

### 7.3 `useFlowChart` (`src/composables/useFlowChart.ts`)

```ts
function useFlowChart() {
  const vueFlowNodes = computed(() => {
    if (!planStore.currentGraph) return []
    const { nodes } = toVueFlowGraph(planStore.currentGraph)
    return nodes
  })

  const vueFlowEdges = computed(() => {
    if (!planStore.currentGraph) return []
    const { edges } = toVueFlowGraph(planStore.currentGraph)
    return edges
  })

  return { vueFlowNodes, vueFlowEdges }
}
```

---

## 8. 常量设计

### 8.1 游戏常量 (`src/constants/game.ts`)

```ts
/** 游戏中的默认时间单位（秒），用于配方耗时换算 */
export const DEFAULT_CLOCK_SPEED = 1.0

/** 超频上限 */
export const MAX_OVERCLOCK = 2.5

/** 管道最大流量（/min） */
export const MAX_PIPE_RATE = 300 // Mk.1
export const MAX_PIPE_RATE_MK2 = 600
```

### 8.2 默认选项 (`src/constants/defaultOptions.ts`)

```ts
export const DEFAULT_TARGET_RATE = 10 // 默认目标产量（个/分钟）
export const DEFAULT_BYPRODUCT_STRATEGY: ByproductStrategy = 'discard'
export const DEFAULT_LAYOUT_DIRECTION = 'vertical'
```

---

## 9. 工具函数设计

### 9.1 数值计算 (`src/utils/math.ts`)

```ts
/** 计算每分钟产量 */
function calcPerMinute(amount: number, durationSeconds: number): number

/** 向上取整（机器台数） */
function calcMachineCount(requiredRate: number, perMachineRate: number): number

/** 精度控制（避免浮点误差） */
function round(value: number, decimals: number): number
```

### 9.2 数组工具 (`src/utils/array.ts`)

```ts
/** 按 className 去重 */
function uniqueByClass<T extends { className: string }>(items: T[]): T[]

/** 按指定 key 分组 */
function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]>
```

### 9.3 存储封装 (`src/utils/storage.ts`)

```ts
/** 带错误处理的 localStorage 读写 */
function loadFromStorage<T>(key: string, fallback: T): T
function saveToStorage<T>(key: string, value: T): boolean // 返回是否成功
```

---

## 10. 数据流

### 10.1 应用启动流程

```
main.ts
  │
  ├─ createApp → use(pinia) → use(router) → mount
  │
  └─ App.vue onMounted
      │
      └─ dataStore.loadData()
          │
          ├─ 检查 IndexedDB 缓存
          │   ├─ 命中 → 读取、反序列化 → dataStore.index
          │   └─ 未命中 ↓
          ├─ fetch /data/zh-Hans.json
          ├─ parseGameData(json) → DataIndex
          ├─ 写入 IndexedDB (Dexie)
          └─ dataStore.index = result, isLoaded = true
```

### 10.2 规划计算与渲染流程

```
用户操作                              Store/逻辑                          UI 更新
───────                              ──────────                          ──────
1. 搜索物品                   → dataStore.searchItems()         → SearchInput 下拉
2. 点击结果                   → uiStore.selectItem(item)        → ItemDetail 展示
3. 输入产量                   → planStore.setTarget(item, rate)  → 无
4. (可选) 选替代配方          → planStore.selectAlternative()   → PlanParams 更新
5. (可选) 设副产物策略         → planStore.setByproductStrategy() → PlanParams 更新
6. 点击"规划"                 → useProductionPlan.executePlan()
                                ├─ productionEngine.planProduction()
                                ├─ layoutHelper.autoLayout()
                                └─ planStore.currentGraph = graph
                                                                  → FlowChart 渲染
7. 点击节点                  → uiStore.selectNode(node)        → NodeDetailModal 弹出
8. 拖拽节点调整位置          → 直接修改 node.position (ref)     → 节点实时移动
9. 保存方案                  → savedPlansStore.savePlan(name)   → PlanActions 反馈
```

---

## 11. 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| JSON 数据加载失败 | `dataStore.loadError` 设置错误信息，UI 显示错误提示 + 重试按钮 |
| JSON 解析异常（字段缺失） | `parseGameData` 内 try-catch，跳过异常条目，console 记录，继续处理 |
| IndexedDB 不可用（隐私模式） | 降级为每次加载时重新解析 JSON，不缓存 |
| 循环依赖检测 | `productionEngine` 收集警告 → UI 以 Banner 形式展示 |
| 配方缺失（物品无可用配方） | 返回叶子节点图（仅一个节点），不报错 |
| localStorage 配额超限 | `planSerializer` 保存时捕获 `QuotaExceededError` → 提示用户清理或导出 |
| Vue Flow 渲染大图卡顿 | 视口裁剪 + 节流拖拽 + 超 200 节点提示精简模式 |

---

## 12. 性能目标与实现策略

| 指标 | 目标 | 实现策略 |
|------|------|----------|
| 首次加载可交互 | ≤ 3s | IndexedDB 缓存 + JSON 按需分块 |
| 搜索响应 | ≤ 200ms | `Map` + `Array.filter` 前缀/包含匹配 |
| 规划计算 | ≤ 1s（200节点内） | 纯内存计算，DFS 复杂度 O(N+E) |
| 流程图渲染 | 500+ 节点流畅 | Vue Flow 视口裁剪 + `shallowRef` |
| 方案保存/加载 | ≤ 200ms | 同步 `JSON.stringify/parse`，单方案 < 50KB |
| 打包体积 | 首屏 JS < 500KB | 路由懒加载 + 组件库按需引入 |

---

## 13. 文件结构（完整）

```
satisfactory-planner/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── public/
│   └── favicon.ico
└── src/
    ├── main.ts                        # 应用入口：创建 Vue app，安装 Pinia/Router，挂载
    ├── App.vue                        # 根组件（布局容器）
    ├── assets/                        # 静态资源
    │   ├── styles/
    │   │   ├── global.css             # 全局样式重置、主题变量
    │   │   └── dark.css               # 深色主题覆盖（可选）
    │   └── icons/                     # 物品图标占位（游戏内图标无法直接引用时使用）
    ├── components/                    # 可复用的 Vue 组件（按功能域分目录）
    │   ├── common/                    # 通用组件（跨域复用，与业务无关）
    │   │   ├── AppLogo.vue
    │   │   ├── SearchInput.vue        # 带自动补全下拉的搜索框
    │   │   └── LoadingSpinner.vue
    │   ├── left-panel/                # 左侧面板相关组件
    │   │   ├── LeftPanel.vue          # 左侧面板容器（纵向 flex）
    │   │   ├── ItemDetail.vue         # 物品详情展示（基本属性+配方列表）
    │   │   ├── PlanParams.vue         # 规划参数设置（产量、配方选择、副产物策略）
    │   │   └── PlanActions.vue        # 规划/保存/加载按钮组
    │   ├── flow-chart/                # 流程图相关组件
    │   │   ├── FlowChart.vue          # Vue Flow 画布容器
    │   │   ├── FlowNode.vue           # 自定义节点组件（Vue Flow 节点）
    │   │   ├── FlowEdge.vue           # 自定义连线组件（可选，标注流量值）
    │   │   └── FlowToolbar.vue        # 工具栏（缩放/重置/布局方向/导出）
    │   └── modals/                    # 弹窗组件
    │       ├── NodeDetailModal.vue    # 节点详情弹窗
    │       └── SavePlanModal.vue      # 保存方案命名弹窗
    ├── views/                         # 页面级组件
    │   └── HomePage.vue               # 主页面（左侧面板 + 流程图）
    ├── router/
    │   └── index.ts                   # 路由定义
    ├── stores/                        # Pinia 状态管理
    │   ├── index.ts                   # 统一导出（barrel export）
    │   ├── dataStore.ts               # 游戏数据索引状态
    │   ├── planStore.ts               # 当前规划状态（目标、产量、图数据）
    │   ├── uiStore.ts                 # UI 状态（选中物品、弹窗开关、主题）
    │   └── savedPlansStore.ts         # 已保存方案列表（localStorage 读写）
    ├── lib/                           # 纯业务逻辑（不依赖 Vue，可独立单测）
    │   ├── dataParser.ts              # 解析 raw JSON，构建 DataIndex (Map 索引)
    │   ├── productionEngine.ts        # 反向推导核心算法（DFS + 循环检测）
    │   ├── graphTransformer.ts        # 将 ProductionGraph 转为 Vue Flow 节点/连线
    │   ├── layoutHelper.ts            # 使用 dagre 计算节点初始布局坐标
    │   ├── planSerializer.ts          # 方案序列化/反序列化（Map ↔ JSON）
    │   └── db.ts                      # IndexedDB (Dexie) 封装
    ├── types/                         # TypeScript 类型定义
    │   ├── index.ts                   # 统一导出（barrel export）
    │   ├── item.ts                    # GameItem, GameRecipe, GameBuilding, DataIndex
    │   ├── production.ts              # ProductionNode/Edge/Graph, PlanOptions, SavedPlan
    │   └── store.ts                   # 各 Pinia store 的状态类型
    ├── utils/                         # 通用工具函数
    │   ├── math.ts                    # 数值计算（产量换算、取整、精度控制）
    │   ├── array.ts                   # 数组去重、分组等
    │   └── storage.ts                 # localStorage 封装（含自动序列化与错误处理）
    ├── constants/                     # 常量定义
    │   ├── game.ts                    # 游戏相关常量（时钟速度、超频上限、管道流量）
    │   └── defaultOptions.ts          # 规划器默认参数
    ├── composables/                   # Vue 组合式函数（复用逻辑）
    │   ├── useSearch.ts               # 搜索逻辑（防抖、过滤、选中）
    │   ├── useProductionPlan.ts       # 规划逻辑（调用 engine → layout → 更新 store）
    │   └── useFlowChart.ts            # Vue Flow 交互（节点点击、数据转换 computed）
    └── config/                        # 配置文件
        └── index.ts                   # 应用级配置（环境变量、特性开关等）
```
