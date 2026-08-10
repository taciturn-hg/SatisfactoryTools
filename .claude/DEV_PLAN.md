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

#### 3.3.3 索莫晶体增产（2026-08-09 新增）

- [x] 配置页「可用的索莫晶体」输入接入引擎（原为占位，现传递 `somerCount` 到 PlanOptions）
- [x] 引擎 `applySomerBoost`：仅加工建筑，逐颗贪心按每晶体边际收益（模拟装 1 颗的级联省总时钟）分配；机器数 ≥2 才考虑；装后入边按总时钟级联缩减上游原料需求
- [x] 建筑槽位硬编码 `src/config/buildingConfig.ts`（依据官方 wiki Production amplifier）：构筑站/冶炼站 1 槽、装配站/铸造站/精炼站(`Build_OilRefinery`)/转换器 2 槽、制造站/混料站/量子编码器 4 槽、罐装站/手搓工作台/自动化工作台不可增幅；未配置默认 1；集中管理硬编码参数
- [x] 部分增幅：一台机器每槽装 1 晶体，增幅 = 1 + k/slots（k=该台已装晶体数），装满足翻倍；分布按「先装满一台再开下一台」推导
- [x] 超频联合优化：`applyOverclock` 晶体机优先吃碎片精确顶频（不超产，碎片只抬上限），`calcNodeClocksWithSomer` 实现；超频压缩机器数后裁剪 `somerMachines` 至机器容量
- [x] 功率按 wiki 公式：`P = 基础功率 × (1 + 已填槽/总槽)² × 时钟^1.321928`（满增幅 ×4 功率），`useProductionPlan.totalPower` 实现
- [x] 视觉：装晶体节点紫色背景 + 时钟文本内嵌 `*NSM` 紫色标记（如 `1×200%*1SM`），FlowNode + `--node-somer` 变量
- [x] 收益度量（2026-08-09 修复）：从「省机器数」改为「省总时钟 Σclock」，解决整数台需求时装部分增幅收益为 0 导致永不装的贪心局部最优；`calcMachineGroupWithSomer` 改为晶体机按需求精确降频，避免级联缩减后产能虚高
- [x] 验证：铁板/马达/铝锭多场景产能全部精确匹配（含输入替代 + 晶体）、满增幅×2、部分增幅、碎片+晶体联合优化、铝/钢/铁回归无回归

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

- [x] 产线/发电数值显示统一为小数点后 3 位（2026-08-08）：公共 `formatRate` 从 1 位改为 3 位，消除 graphTransformer/FlowNode/useProductionPlan 三处重复定义，统一导入 `src/lib/recipeOptions.ts`；发电页模板内联 `toFixed` 全部改用 `formatRate`，解决总功率尾随零丢失
- [x] `formatRate` 尾随零裁剪（2026-08-08）：去掉 `toFixed(3)` 补零，改为四舍五入到 3 位后取浮点最短表示（3.5 → "3.5"、3.75 → "3.75"、仅 3.755 这类显示三位）
- [x] 引擎精度重构（2026-08-08）：productionEngine/powerEngine 全部内部 `toFixed(4)` 主动截断改为浮点原生精度，定义 `FUZZ=0.005`（可忽略阈值）与 `CLOCK_OVERSHOOT_FUZZ=0.001`（时钟超产阈值）常量，替换 13 处硬编码比较。`ratePerMinute` 去截断。格式化全部交由视图层 `formatRate`（3 位）。回归验证：铝/钢/铁产线、发电引擎核心输出与重构前一致
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

### 5.7 已解决：副产物回灌导致共享上游资源 rate 虚高

**状态**：已解决（2026-08-08）

**问题**：产出「涡轮燃油 375/min」（副产聚合树脂 337.5）并开启副产物循环后，新增产出「纤维织物 300/min」（替代配方：聚酯织物，原料聚合树脂+水）时，引擎为纤维织物的聚合树脂需求展开了一条新产线（原油→燃油→聚合树脂），聚合树脂 337.5 中有 300 被回灌替代这条新产线，但**原油叶子节点 rate 从 675 虚增到 1275**（多出 600，即被替代产线的原油需求）。聚合树脂剩 37.5 说明回灌本身正确，问题出在回灌扣减外部供应时对共享上游的处理。

**根因**：`reduceNodeRateInner` 的归零分支——当节点被回灌完全替代（`newRate <= FUZZ`）时直接 `removeNodeAndUpstream` 删除，**不沿入边递归缩减上游 rate**。`removeNodeAndUpstream` 的「存活传播」只决定节点去留：原油因还有出边指向存活节点（供涡轮燃油）而保留，但被替代产线占用的 600 rate 从未扣回。对照 `newRate > FUZZ` 的正常路径会沿入边递归缩减上游，归零路径漏掉了这一步。

**修复**：归零分支在删除前，先沿入边对每个源头（非副产物）递归调用 `reduceNodeRateInner` 缩减该边流量。资源节点归零时无入边，循环自然跳过，不影响原有逻辑。

**验证**：涡轮燃油 375 + 纤维织物 300 场景原油回到 675，聚合树脂剩 37.5；聚合树脂被完全利用（纤维织物 337.5）时副产物节点消失、原油 540 正确；铝/钢/铁产线、超频、关循环各场景无回归；type-check、oxlint 通过。

### 5.8 已解决：共享节点主产物出边被覆盖 + 归零递归缩减副产回灌边

**状态**：已解决（2026-08-10）

**场景**：产出「追踪步枪弹 37.5」，输入「步枪弹药 75 + 急速电线 1000」，开启副产物循环。两个症状：
1. 铜锭（同时供铜板与电线）两条出边都显示 52.5，应为 15（→铜板）+ 37.5（→电线）
2. 塑料缺前置叶子节点石油（原油），塑料 rate 从 15 被错降到 2.5

**根因 1（出边覆盖）**：`reduceNodeRateInner` 缩减节点 rate 时，把所有主产物出边都设成 `node.rate`。当一个节点有多条同物品出边（被多个消费者共享）时，任何入边缩减触发 rate 更新都会把所有出边覆盖成总产出，破坏分摊。正确语义是主产物出边由**消费者节点的入边**重算维护。

**根因 2（归零递归）**：`reduceNodeRateInner` 归零分支沿入边递归缩减上游时，把副产物回灌边（产生方→消费者，如塑料节点→无烟火药的重油残渣边）也当普通原料边递归，导致无烟火药被输入替代删除时连带扣减塑料节点 rate。

**修复**：
- 出边更新只处理副产物边（流量 = 总时钟 × 单机副产物率）；主产物出边不再覆盖，由消费者入边重算与 `applyInputItems` 按比例缩放维护。`applySomerToNode`（装晶体）同步修正。
- 归零递归跳过副产回灌边：判定 `sourceNode` 配方主产物 ≠ `edge.itemClass` 时跳过（副产边流量由产生方主产物需求决定，不随消费者缩减）。

**验证**：追踪步枪弹主场景铜锭出边 15/37.5、塑料 5 + 原油 7.5 均正确；铝锭循环 on/off、涡轮燃油、橡胶、塑料、铁板、马达、重型模块化框架、索莫晶体 8 场景全部无回归；type-check、oxlint 通过。

### 5.9 已解决：重油残渣被用塑料配方展开，副产塑料与真塑料线撞车

**状态**：已解决（2026-08-10）

**问题**：需要「重油残渣」（如无烟火药配方含重油残渣）时，`selectRecipe` 因重油残渣无「主产物原生配方」（只有 `Recipe_Alternate_HeavyOilResidue_C` 是主产物替代配方，而替代配方在游戏中需解锁、默认不可自动选用）回退选 `Recipe_Plastic_C`，创建「名义重油残渣、实际塑料产线」的假节点。副产循环开启时该节点副产的塑料与真塑料线（电路板需求）撞车，导致塑料供需错乱（缺料）。

**尝试过**（未采用）：在 `expand` 阶段拦截「选中配方主产物 ≠ 目标物品」的展开。在追踪步枪弹主场景有效，但无烟火药高需求（100，需重油残渣 50，图中无塑料线副产来源）时重油残渣被误拦成资源叶子节点，无法生产。根因是 expand 为 DFS 顺序展开，无法提前感知全局是否有同物品副产来源。

**修复**（全局折叠）：新增 `foldFakeNodes` 与副产重建 `rebuildByproductNodes`。在 `mergeDuplicateNodes` 之后、`applyByproductRecycling` 之前调用：识别「名义物品 ≠ 配方主产物」的假节点 → 检查真节点副产能否覆盖假节点名义需求（不足则跳过折叠保留假节点补料）→ 重建真节点副产物节点（复用已存在副产节点避免重复）→ 重接假节点名义出边到副产物节点 → 沿假节点入边缩减上游 rate → 删除假节点。无真节点时跳过（保留假节点让重油残渣仍可生产，如纯无烟火药产线）。折叠后重跑一次 `applyByproductRecycling` 让扩产后的副产正确回灌/溢出展示。

**关键时序**：折叠必须在副产回灌之前执行——若先回灌，假节点名义出边会被扣减到部分值（如无烟火药重油残渣需求从 5 降到 2.5），折叠重接后消费者需求缺失。

**code review 修复**（2026-08-10）：副产不足时跳过折叠避免虚假供需；移除死代码 `increaseNodeRate`/`increaseNodeRateInner`（假节点主产物出边恒指向副产节点，扩产分支不可达）；`rebuildByproductNodes` 复用已存在副产节点，消除多产生方（塑料+橡胶）重复副产节点导致的塑料误削。

**验证**：追踪步枪弹主场景（输入替代 × 循环 on/off）塑料全部修正为 15、原油 22.5（= 出边和，无虚高）、无烟火药重油残渣需求 5 完整（无输入时）、重油残渣副产节点 7.5 正确展示（有输入时无烟火药删除后溢出展示）、假节点消除；多目标（塑料+橡胶+无烟火药）塑料 15、原油 45、单副产节点；铝锭/涡轮燃油/橡胶/塑料/铁板/马达/重型模块化框架/无烟火药 100 全部无回归；索莫晶体 8 场景通过；type-check、oxlint 通过。

### 5.10 已解决：索莫晶体级联时共享节点出边与 rate 偏差

**状态**：已解决（2026-08-10）

**问题**：索莫晶体 + 输入替代场景（如追踪步枪弹 2 晶体 + 步枪弹药 75 输入）下，共享节点（铜锭同时供铜板与电线）的 rate 与出边和不匹配（somer=2 时 rate=27.5、出边和 22.5，差 5）。

**根因**：`reduceNodeRateInner` 的 visited 是「全局已访问」集合。装晶体后级联缩减沿多条入边路径传播到共享节点（如电缆→电线→铜锭 与 电路板→铜板→铜锭），铜锭先被第一条路径标记 visited，第二条路径的缩减被跳过 → 缩减不完整，rate 残留虚高。

**修复**：`reduceNodeRateInner` 的 visited 改为「当前递归路径」（进入添加、返回移除，用 try/finally 保证清理），拆分出 `reduceNodeRateInnerImpl` 承载原逻辑。共享节点可被多条入边路径各自缩减并正确累积；环（A→B→A）仍被路径检测终止。

**验证**：追踪步枪弹 somer=0/1/2/3 铜锭 rate 均 = 出边和（52.5/35/22.5/22.5，差 0）；主场景 6 组合含 2 晶体全通过（铜锭 22.5 = 10+12.5）；铝锭/铁板晶体场景、索莫晶体 8 场景、广泛产线全部无回归；type-check、oxlint 通过。

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
