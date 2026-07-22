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
- [x] `production.ts` — `ProductionNode`, `ProductionEdge`, `ProductionGraph`, `PlanOptions`, `ByproductStrategy`
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
- [x] `planStore.ts` — 规划状态管理（target、替代配方、副产物策略、compute 骨架）
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
- [x] 副产物处理（discard / utilize）

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

- [ ] 增加 `src/types/power.ts`：
  - `GeneratorType`（生物质/煤炭/燃油/核电/地热）
  - `FuelInfo`（燃料 ClassName、能量值、辅助资源需求、副产物）
  - `PowerPlanOptions`（目标功率、发电机类型、燃料选择、能量碎片数量）
  - `PowerPlanResult`（所需发电机数量、燃料消耗速率、超频后功率）

#### 4.2 引擎模块 (`src/lib/powerEngine.ts`)

纯函数，不依赖 Vue：

- [ ] `calculateGenerators(options: PowerPlanOptions, index: DataIndex) → PowerPlanResult`
  - 输入：目标功率 + 发电机类型 + 燃料 + 超频倍率 + 能量碎片数量
  - 计算：`所需发电机数量 = ceil(目标功率 / 单台功率)`
  - 超频计算：`实际功率 = 基础功率 × 超频倍率^(1/1.6)`
  - 燃料消耗：`单台每分钟消耗 = 60 × 功率 / 燃料能量值`
- [ ] `listAvailableFuels(generatorClass: string, index: DataIndex) → FuelInfo[]`
  - 从发电机的 `mFuel` 字段提取可选燃料列表

#### 4.3 UI 组件 (`src/components/power-plan/`)

新目录，不与产线规划混在一起：

- [ ] `PowerPlanPanel.vue` — 发电计划面板容器
- [ ] `GeneratorSelector.vue` — 发电机类型选择（列表 + 功率展示）
- [ ] `FuelSelector.vue` — 燃料选择（依据发电机类型动态过滤）
- [ ] `PowerRateInput.vue` — 目标功率输入
- [ ] `OverclockConfig.vue` — 超频/降频配置（含能量碎片数量输入）
- [ ] `PowerResult.vue` — 计算结果展示（发电机数量、燃料消耗、实际功率）

#### 4.4 Store (`src/stores/powerStore.ts`)

- [ ] 管理当前发电计划状态
- [ ] 调用 `powerEngine`

#### 4.5 路由

- [ ] 新增路由 `/power` → `PowerPlanPage.vue`
- [ ] 顶部导航增加"发电计划"入口

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
