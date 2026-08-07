# 开发计划（DEV_PLAN）

**项目**：《幸福工厂》产线规划工具
**版本**：v1.0
**更新日期**：2026-07-21

本文档基于 PRD（产品需求文档）和 TDD（技术设计文档），将开发工作拆分为可执行的阶段和任务，按"先 UI 骨架、再接入逻辑"的策略推进。

---

## 1. 开发总览

### 1.1 总体策略

1. **先 UI 后逻辑**：每个功能板块先搭 UI 壳子（mock 数据），再逐模块接入真实业务逻辑
2. **lib/ 层纯函数优先**：业务逻辑模块独立于 Vue，可脱离 UI 进行开发和验证
3. **目录结构弹性**：TDD 中的目录结构为初始推荐，开发过程中 随需调整

### 1.2 三大功能板块

| 板块 | 说明 | 优先级 |
|------|------|--------|
| **产线规划** | 物品搜索 → 设定产量 → 反向推导 → 生产链流程图 | P0 核心 |
| **发电计划** | 发电机选择 → 设定电力目标 → 计算发电机数量与燃料消耗 | P1 扩展 |
| **方案管理** | 保存/加载/导出/导入规划方案 | P0 基础 |

---

## 2. 阶段拆解

### 阶段 1：基础设施搭建

**目标**：项目可运行、类型定义就绪、数据解析模块完成

#### 1.1 项目配置完善

- [x] 安装 UI 相关依赖：Ant Design Vue、Vue Flow、Dexie
- [x] 完善 `index.html`（中文标题、meta 标签）
- [x] 配置全局 CSS（深色主题变量 + 基础重置）

#### 1.2 类型定义 (`src/types/`)

按 TDD 第 2 章，建立完整的 TypeScript 类型体系：

- [x] `item.ts` — `GameItem`, `GameRecipe`, `GameBuilding`, `GameGenerator`, `DataIndex`
- [x] `production.ts` — `ProductionNode`, `ProductionEdge`, `ProductionGraph`, `PlanOptions`
- [x] `store.ts` — 各 Store 的状态类型
- [x] `index.ts` — barrel export

#### 1.3 数据解析器 (`src/lib/dataParser.ts`)

依据 `src/data/DATA_PARSING.md` 数据字典：

**输入**：`zh-Hans.json`（UTF-8 编码，原始数据已从 UTF-16 LE 转换）
**输出**：`DataIndex`（含 items, recipes, recipesByIngredient, buildings, generators）

子任务：

- [x] 实现文件读取解析（`fetch` → `response.json()`，标准 UTF-8）
- [x] 实现 `FGItemDescriptor` / `FGResourceDescriptor` / `FGItemDescriptorBiomass` / `FGItemDescriptorNuclearFuel` / `FGPowerShardDescriptor` / `FGItemDescriptorPowerBoosterFuel` → `GameItem` 转换
- [x] 实现 `FGRecipe` → `GameRecipe` 转换（含 UE 内联格式 `mIngredients` / `mProduct` / `mProducedIn` 解析、替代配方识别）
- [x] 实现 `FGBuildingDescriptor` → `GameBuilding` 转换
- [x] 实现 `FGBuildableGeneratorFuel` / `FGBuildableGeneratorNuclear` / `FGBuildableGeneratorGeoThermal` / `FGBuildablePowerBooster` / `FGBuildablePowerStorage` → `GameGenerator` 转换
- [x] 实现 `mFuel` 字段解析（JSON 对象数组，含燃料 ClassName、辅助资源、副产物）
- [x] 构建反向索引：`recipes`（按产物）、`recipesByIngredient`（按原料）

> 验证方式：在浏览器控制台调用 `parseGameData()`，检查返回的 `DataIndex` 中各 Map 的条目数量是否符合预期。

#### 1.4 IndexedDB 缓存 (`src/lib/db.ts`)

- [x] 封装 Dexie，建立 `items` 表（`className` 主键，`displayName` 索引）
- [x] 实现 `cacheData(index: DataIndex)` 写入
- [x] 实现 `loadCachedData()` 读取并反序列化

---

### 阶段 2：产线规划 — UI 骨架

**目标**：左右分栏页面可交互、搜索可用、流程图可渲染（数据为 mock）

#### 2.1 通用组件 (`src/components/common/`)

- [x] `AppLogo.vue` — Logo 图片
- [x] `SearchInput.vue` — 搜索输入框
- [x] `LoadingSpinner.vue` — 通用加载动画
- [x] `AppHeader.vue` — 顶部导航栏（Logo + 导航下拉 + 语言切换 + GitHub 链接）

#### 2.2 右侧面板组件 (`src/components/right-panel/`)

- [x] `RightPanel.vue` — 右侧面板容器，三栏导航（产出/原料/配置）
  - 产出页签：a-select 搜索添加 + ItemDetail 列表，不可重复添加
  - 原料页签：同上
  - 配置页签：PlanParams（配方 + 采集运输 + 超频设置）
- [x] `ItemDetail.vue` — 物品卡片（图标 + 名称 + 描述气泡 + 产量输入 + 删除）
- [x] `PlanParams.vue` — 配置面板（替代配方/转换器多选、采集与运输选级、超频输入）
- [x] `PlanActions.vue` — 底部按钮组（规划/重置/保存/加载）

#### 2.3 流程图组件 (`src/components/flow-chart/`)

- [x] `FlowChart.vue` — Vue Flow 画布容器（mock 5-6 个节点 + 连线）
- [x] `FlowNode.vue` — 自定义节点（物品图标 + 名称 + 流量 + 机器信息）

#### 2.4 弹窗组件 (`src/components/modals/`)

- [ ] `NodeDetailModal.vue` — 点击节点后弹出的详情弹窗（已搁置，后续阶段实现）
- [ ] `SavePlanModal.vue` — 方案命名保存弹窗（已搁置，后续阶段实现）

#### 2.5 页面 + 路由

- [x] `ProductionPlanPage.vue` — 主页面（流程图 + 右侧面板）
- [x] `PowerPlanPage.vue` — 发电计划占位页
- [x] `App.vue` — 根布局（AppHeader + RouterView）
- [x] `router/index.ts` — 路由定义

#### 2.6 Pinia Store

- [x] 暂不实现，推迟至阶段三 3.1 统一完成

---

### 阶段 3：产线规划 — 业务逻辑接入

**目标**：真实数据替换 mock、计算引擎可用、流程图渲染真实数据

#### 3.1 Store 实现

- [x] `dataStore.ts` — 接入 `dataParser` + IndexedDB，实现 `loadData()`、`searchItems()`
- [x] `planStore.ts` — 规划状态管理（target、替代配方、compute 骨架）
- [x] `uiStore.ts` — UI 状态（selectedItem, modals, theme 等）
- [x] `stores/index.ts` — barrel export

#### 3.2 搜索交互 (`src/composables/useSearch.ts`)

- [x] 实现防抖搜索（200ms）
- [x] 使用 dataStore 的真实数据搜索

#### 3.3 生产引擎 (`src/lib/productionEngine.ts`)

按 TDD 第 3.2 章实现反向推导 DFS 算法：

- [x] 核心算法：`planProduction(index, options) → ProductionGraph`
- [x] 配方选择逻辑（默认配方 vs 用户指定的替代配方）
- [x] 机器数量计算（含精度处理）
- [x] 循环依赖检测
- [x] 副产物处理（默认展示，用户通过替代配方利用）

#### 3.3.1 产出页配方下拉（2026-08-06 新增）

- [x] 产出页签每个产出项下方新增配方下拉：原生在前、替代配方带「替代」、解包配方带「解包:」前缀
- [x] 下拉选项以卡片展示：配方名 + 原料列表 → 产物列表（含图标与每分钟速率）
- [x] 选中替代配方 → 产出固定用该配方；配置页替代配方列表与产出下拉双向同步（同一物品只保留一种配方）
- [x] 资源类产出（水/煤等）引擎固定开采，不显示配方下拉
- [x] 配置页替代配方下拉同步升级为卡片式 UI（多选、全选/清除不变）
- [x] 替代配方识别改为启发式：`Alternate_` 前缀但唯一产物且显示名与产物名一致者视为原生配方（涡轮燃油/压缩煤）
- [x] `CACHE_VERSION` 提升至 9，使 isAlternate 语义变更对已缓存用户生效

#### 3.3.2 配方下拉共享模块（2026-08-06 重构）

- [x] 抽取 `src/lib/recipeOptions.ts`：`RecipeIoItem`/`RecipeOption` 类型 + `itemDisplayName`/`itemIcon`/`ratePerMinute`/`formatRate` 纯函数
- [x] 抽取 `src/components/right-panel/RecipeOptionCard.vue`：配方卡片渲染（配方名 + 原料→产物）及样式，供 RightPanel/ItemDetail/PlanParams 共用，消除三处重复代码

#### 3.4 图转换与布局

- [x] `graphTransformer.ts` — `ProductionGraph` → Vue Flow 格式
- [x] `layoutHelper.ts` — 引入 dagre，实现 `autoLayout()`

#### 3.5 流程图交互 (`src/composables/useFlowChart.ts`)

- [ ] `useFlowChart.ts` — 节点点击/拖拽/视口裁剪（未实现，搁置到后续阶段）
- [x] 节点拖拽位置更新（Vue Flow 原生支持，无需额外代码）
- [x] 节点点击 → 弹出详情（搁置，NodeDetailModal 未实现）
- [x] 视口裁剪（搁置，>100 节点场景尚未触发）

#### 3.6 数据闭环

- [x] `useProductionPlan.ts` — 串联 engine → layout → store → 渲染

---

### 阶段 4：发电计划

**目标**：新的独立板块，允许用户选择发电机类型和燃料，计算所需建筑数量和燃料消耗

#### 4.1 类型扩展

- [x] 增加 `src/types/power.ts`：
  - `GeneratorType`（生物质/煤炭/燃油/核电/地热）
  - `FuelInfo`（燃料 ClassName、能量值、辅助资源需求、副产物）
  - `PowerPlanOptions`（目标功率、发电机类型、燃料选择、能量碎片数量）
  - `PowerPlanResult`（所需发电机数量、燃料消耗速率、超频后功率）

#### 4.2 引擎模块 (`src/lib/powerEngine.ts`)

纯函数，不依赖 Vue：

- [x] `calculateGenerators(options: PowerPlanOptions, index: DataIndex) → PowerPlanResult`
  - 输入：目标功率 + 发电机类型 + 燃料 + 超频倍率 + 能量碎片数量
  - 计算：`所需发电机数量 = ceil(目标功率 / 单台功率)`
  - 超频计算：`实际功率 = 基础功率 × 超频倍率^(1/1.6)`
  - 燃料消耗：`单台每分钟消耗 = 60 × 功率 / 燃料能量值`
- [x] `listAvailableFuels(generatorClass: string, index: DataIndex) → FuelInfo[]`
  - 从发电机的 `mFuel` 字段提取可选燃料列表

#### 4.3 UI 组件 (`src/components/power-plan/`)

新目录，不与产线规划混在一起：

- [x] ~~`PowerPlanPanel.vue` — 发电计划面板容器~~（已直接在 `PowerPlanPage.vue` 中实现）
- [x] ~~`GeneratorSelector.vue` — 发电机类型选择（列表 + 功率展示）~~（已直接在 `PowerPlanPage.vue` 中实现）
- [x] ~~`FuelSelector.vue` — 燃料选择（依据发电机类型动态过滤）~~（已直接在 `PowerPlanPage.vue` 中实现）
- [x] ~~`PowerRateInput.vue` — 目标功率输入~~（已直接在 `PowerPlanPage.vue` 中实现）
- [x] ~~`OverclockConfig.vue` — 超频/降频配置（含能量碎片数量输入）~~（已直接在 `PowerPlanPage.vue` 中实现）
- [x] ~~`PowerResult.vue` — 计算结果展示（发电机数量、燃料消耗、实际功率）~~（已直接在 `PowerPlanPage.vue` 中实现）

#### 4.4 Store (`src/stores/powerStore.ts`)

- [x] 管理当前发电计划状态
- [x] 调用 `powerEngine`

#### 4.5 路由

- [x] 新增路由 `/power` → `PowerPlanPage.vue`
- [x] 顶部导航增加"发电计划"入口

---

### 阶段 5：方案管理

**目标**：规划结果可保存、恢复、导出

#### 5.1 序列化 (`src/lib/planSerializer.ts`)

- [ ] 实现 `SavedPlan` 的序列化/反序列化（Map → JSON → Map）

#### 5.2 Store (`src/stores/savedPlansStore.ts`)

- [ ] localStorage 读写
- [ ] 方案增删改查
- [ ] 导入/导出 JSON 文件

#### 5.3 Composables

- [ ] `usePlanManager.ts` — 方案管理的交互逻辑

---

### 阶段 6：打磨与优化

#### 6.1 UI 细节

- [ ] 深色主题完善
- [ ] 节点颜色编码（基础资源/中间产物/最终产品/副产物）
- [ ] 响应式布局适配（移动端不做，但桌面端 1024px-2560px 范围应正常）
- [ ] 动画过渡

#### 6.2 性能优化

- [ ] Vue Flow 视口裁剪
- [ ] `shallowRef` 优化图数据
- [ ] JSON 解析后的 IndexedDB 缓存验证

#### 6.3 错误处理

按 TDD 第 11 章覆盖各边界场景

#### 6.4 测试

- [ ] 生产引擎单元测试（关键配方推导链验证）
- [ ] 发电引擎单元测试
- [ ] 数据解析器测试（确认条目数量、关键字段值正确）

---

## 3. 开发顺序决策

```
阶段 1 (基础设施)
  └→ 阶段 2 (产线规划 UI 骨架)
       ├→ 阶段 3 (产线规划 逻辑接入)
       │    └→ 阶段 5 (方案管理)
       └→ 阶段 4 (发电计划)
            └→ 阶段 6 (打磨)
```

- 阶段 1 和阶段 2 可部分并行（类型定义可在搭 UI 时同步完善）
- 阶段 3 和阶段 4 依赖阶段 1 的 `dataParser`，但彼此独立
- 阶段 5 依赖阶段 3（有了规划结果才能保存）

## 4. 环境依赖（后续安装）

| 包 | 用途 | 安装命令 |
|----|------|----------|
| `ant-design-vue` | UI 组件库 | `npm install ant-design-vue` |
| `@vue-flow/core` | 流程图 | `npm install @vue-flow/core` |
| `@vue-flow/minimap` | 小地图插件 | `npm install @vue-flow/minimap` |
| `dagre` | 图布局算法 | `npm install dagre` |
| `@types/dagre` | dagre 类型 | `npm install -D @types/dagre` |
| `dexie` | IndexedDB 封装 | `npm install dexie` |

> 按阶段逐步安装，避免一次性安装大量包。阶段 1 需要 dexie；阶段 2 需要 ant-design-vue 和 @vue-flow/core；阶段 3 需要 dagre。

---

## 5. 已知问题与待办

> 记录开发过程中发现、暂未处理的问题，后续按优先级安排。

### 5.1 暗物质系列产线无法展开（待处理）

**状态**：待处理（2026-08-03 记录）

**问题**：规划「暗物质残渣」「叠加态振荡器」等含暗物质链路的产出时，引擎无法正确展开。

**根因**：`暗物质残渣`（`Desc_DarkEnergy_C`）唯一的主产物制造配方是 `Recipe_DarkEnergy_C`（活性SAM→暗物质残渣），但它产自 **`Build_Converter`（转换器）**。`src/lib/productionEngine.ts` 的 `selectRecipe` 为避免基础资源被 Converter 配方错误展开，过滤了所有 `Build_Converter` 配方（第 241 行附近）。暗物质残渣被误伤 → 引擎退回选择「把暗物质残渣当副产物」的配方（如 `Recipe_SyntheticPowerShard_C`，主产物是能量碎片），导致节点语义错乱（主/副产物颠倒）、产线结构错误。

**当前行为**：目标含暗物质链路时缺料、或主产物识别错误。

**深层表现（2026-08-03 补充）**：开启副产物循环时，「叠加态振荡器」等主目标节点本身也是暗物质残渣的产生方之一（配方 `Recipe_SuperpositionOscillator_C` 副产暗物质残渣 25）。`applyByproductRecycling` 回灌暗物质残渣时，把主目标节点也当作产生方，`reduceNodeRate` 递归缩减了主目标节点的上游（石英晶体、晶体振荡器、复合铝板等），导致缺料。修复前的引擎在此场景栈溢出崩溃（`RangeError`），修复后不崩溃但缺料——本质是暗物质系列同一问题的不同表现。

**候选方案**（未选）：
- 允许「主产物 == 目标物品」的 Converter 配方在无其他候选时使用（需要额外验证不会让基础资源被错误展开）
- 副产物回灌时，若产生方是主目标节点（`isOutputTarget` 或深度 0），不递归缩减其上游（副产部分单独处理）

**影响范围**：仅暗物质系列物品；其余含副产物产线已正常（见 5.2）。

### 5.2 已解决：副产物循环 + 桶装配方循环

**状态**：已解决（2026-08-03）

- **副产物循环**：铝产线（240 铝锭）开启「循环利用副产物」后，水自持 120 / 需补 240、石英产线补足二氧化硅、无多余副产物。修复点：`applyByproductRecycling` 多产生方处理、`applyInputItems` 执行顺序与分流、`reduceNodeRate` 防环 + 副产节点 rate 同步。
- **副产物图结构重构**（2026-08-03）：回灌边从产生方**直接连到消费方**（不经过副产物中转节点），副产物被全部利用时删除副产物节点，仅有多余时才保留展示。同时 `selectRecipe` 增加「优先选主产物配方」规则——外部补足二氧化硅时选 `Recipe_Silica_C`（粗石英）而非 `Recipe_AluminaSolution_C`（会把氧化铝溶液重新引入产线纠缠）。
- **双向边合并**（2026-08-03）：同对节点间的反向边（如 `氧化铝溶液 ⇄ 碎铝渣`：主料边 + 副产回灌边）在 `graphTransformer.ts` 合并为**一条双向箭头边**（`markerStart`+`markerEnd`），标签合并为一行。消除 dagre 布局把两条反向边交叉成 X 型、中间标签重叠的问题。
- **桶装配方循环**：`selectRecipe` 排除 `Recipe_Unpackage*` 解包配方（空桶/空瓶改用制造配方，不再选解包配方导致循环）。
- 验证：副产物扫描 32 个含副产物物品，30 通过；剩余 2 个为暗物质问题（见 5.1）。

### 5.3 已解决：输入原料替代后遗留上游节点

**状态**：已解决（2026-08-05）

**问题**：产出「复合铝板 + 铝制外壳」、原料输入 240 铝锭后，图中仍残留氧化铝溶液 → 碎铝渣 → 铝土矿/水/煤 整条上游产线。

**根因**：`removeNodeAndUpstream` 用逐点 BFS 判断「上游节点所有出边都指向待删节点」才能删除。两种场景下卡死：
1. **副产物边阻塞**（回灌关）：碎铝渣的出边含「→ 水（副产物）」，副产物节点不在待删集合，碎铝渣无法删除。
2. **双向依赖环**（回灌开）：副产物回灌把边改写成 `氧化铝溶液 ⇄ 碎铝渣` 互指环，BFS 在环上死锁，整条铝土矿产线残留。

**修复**：将 `removeNodeAndUpstream` 重写为「存活传播」算法。从保留锚点（目标产出 depth 0 根节点 / OUT 展示节点、用户输入 INP 节点）反向传播存活：普通节点存活 ⟺ 有出边指向存活节点；副产物节点存活 ⟺ 生产者存活。传播到收敛后删除 startNode 及所有不存活节点。天然处理回灌环（环内无通向锚点的出边则整体清除），共享上游节点因有出边指向存活节点而自然保留。

**验证**：输入 240 铝锭场景（回灌开/关）残留全部清除；depth0 副产物边界（输入替代橡胶产出，重油残渣随生产者删除）；无输入、部分覆盖、共享铁锭、重型框架、橡胶回灌等场景与修复前输出一致，无回归。

### 5.4 已解决：第二类叶子节点显示采集器图标

**状态**：已解决（2026-08-05）

**问题**：无配方但被引用为原料的手动采集物（木材/树叶/能量蛞蝓/尸体等，非 `isResource`）被 `resolveResourceExtractor` 当作固体矿分配采矿机（`Build_MinerMk1`），图中显示采矿机图标而非物品本身。

**修复**：`resolveResourceExtractor` 开头对 `!item.isResource` 直接返回 undefined（手动采集物无采集器）；`expand` 的无提取器分支把机器数改为 0（原为 1）。图转换层 `graphTransformer.ts` 对 `machineType=null` 节点自动回退到物品图标，节点类型仍为 `resource`（绿框）。

**验证**：生物质（木材）产线中树叶节点 machineType=null、0 台；铁/铝/橡胶产线中第一类资源（铁矿石/铝土矿/水/煤/原油）仍保留对应采集器，无回归。

### 5.6 已解决：产出页选非替代配方（原生/解包）不更新流程图

**状态**：已解决（2026-08-07）

**问题**：产出页每个 item 的配方下拉选择原生配方（如液态燃油的多个原生配方）或解包配方时，流程图不按所选配方更新；只有选替代配方才生效。

**根因**：`RightPanel.vue` 的 `buildAlternativeMap()` 在配置页「替代配方 + 转换器配方」均未选择时提前 `return` 空 Map，而产出下拉所选配方（含原生/解包）的并入逻辑在这行 early return 之后，被一并跳过。引擎 `selectRecipe` 收不到用户指定配方，退回默认评分选配方 → 图结果不变。替代配方因会同步进配置页 `selectedRecipes`（非空，不触发 early return）而正常生效。

**修复**：去掉 `buildAlternativeMap` 的 early return，改为「配置页已选配方正常构建（为空时跳过）+ 产出下拉已选配方无条件并入覆盖」。产出下拉选任何配方都会重算并按所选配方生产；替代配方仍按原逻辑同步到配置页下拉。

**验证**：`vue-tsc` 类型检查通过；修改文件 oxlint + eslint 无报错。

### 5.5 已解决：只有替代配方的物品被误当叶子节点

**状态**：已解决（2026-08-05）

**问题**：涡轮燃油（`Desc_LiquidTurboFuel_C`）在游戏内有原生配方（`Recipe_Alternate_Turbofuel_C`「涡轮燃油」等），但 `selectRecipe` 末尾「全是替代配方 → 视为资源」的规则把它当成叶子节点，无法展开产线。上一轮叶子图标修复（5.4）让这一既有问题暴露更明显（无采集器也无配方，变裸节点）。

**修复**：`selectRecipe` 末尾在无标准配方时，若存在替代配方则自动选一个展开（优先选「目标物品是主产物」的替代配方，避免把目标当副产物引入纠缠）。有标准配方的物品行为不变（仍优先标准配方）；`isResource` 物品仍在更早处拦截（除非用户显式选替代配方）。

**验证**：涡轮燃油自动展开为 `Alternate_TurboBlendFuel` 产线；煤+显式木炭替代展开为 木材→木炭；煤无替代仍是资源；铁板/铝制外壳/重油残渣等场景与修复前一致，无回归。
