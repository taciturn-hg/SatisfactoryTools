# 产品需求文档（PRD）

## 《幸福工厂》产线规划工具

**版本**：v1.0
**日期**：2026-07-27
**作者**：开发团队

------

## 1. 项目概述

### 1.1 背景

《幸福工厂》（Satisfactory）是一款包含复杂生产链的第一人称工厂建设游戏。玩家需要从原材料出发，通过多级加工制造出高级部件。游戏内置的配方系统庞大且存在多种替代配方，玩家在规划产线时往往需要反复查阅配方、计算原料需求与机器数量。目前虽有在线工具（如 [satisfactory-calculator.com](https://satisfactory-calculator.com/)），但国内访问速度不稳定，且部分功能不够灵活。

### 1.2 目标

构建一个**纯前端、轻量、快速**的产线规划工具，帮助玩家：

- 快速查询任一物品的制造配方与用途
- 设定目标产量（如"每分钟10个智能嵌板"），自动推导所需原材料与中间产物
- 以**流程图（节点图）** 形式直观展示整个生产链，便于玩家理解和布局
- 计算发电厂配置（发电机类型、燃料选择、超频/降频、所需机器数量）

### 1.3 范围

**包含**：

- 物品、配方、建筑、发电机数据的解析与索引
- 物品搜索与详情展示
- 基于目标产量的反向推导计算引擎
- 可交互的生产链流程图（节点拖拽、缩放、点击详情）
- 支持替代配方选择
- 支持副产物处理策略（丢弃/利用）
- 发电计划计算（发电机选型、燃料消耗、超频与能量碎片计算）
- 规划方案的本地保存与加载

**不包含**：

- 用户账号/云端存储
- 多语言切换（固定使用简体中文数据）
- 3D工厂布局模拟
- 真实游戏存档解析

------

## 2. 目标用户

- **核心用户**：《幸福工厂》的活跃玩家，尤其是中后期需要设计复杂产线的用户。
- **次要用户**：刚接触游戏的玩家，用于学习配方和基础产线搭建。

用户可通过浏览器直接访问，无需安装。

------

## 3. 核心功能（用户故事）

### 3.1 数据加载与索引

- **用户故事**：作为用户，我希望打开网页就能自动加载所有物品和配方数据，无需手动操作。
- **说明**：从内嵌的 `zh-Hans.json` 数据中解析出 `FGItemDescriptor`、`FGResourceDescriptor`、`FGRecipe`、`FGBuildingDescriptor`、`FGGameGenerator` 等关键信息，构建内存索引（`Map<ClassName, Item>`），并持久化到 IndexedDB 以加速二次访问。

### 3.2 物品搜索与详情

- **用户故事**：作为用户，我可以通过输入中文名称快速找到某个物品，并查看它的所有配方（作为产品）和所有用途（作为原料）。
- **说明**：提供搜索框，支持模糊匹配。点击搜索结果，右侧展示该物品的：
  - 基本属性（堆叠大小、能量值、放射性等）
  - 作为产出的配方（列出所有能制造它的配方，包括替代配方）
  - 作为原料的配方（列出所有需要它作为原料的配方）

### 3.3 生产规划（反向推导）

- **用户故事**：作为用户，我希望输入目标物品和每分钟产量（如"模块化引擎"每分钟5个），系统能自动计算出所需的所有原材料、中间产物、以及每个步骤所需的机器数量，并能选择是否使用替代配方。
- **说明**：
  - 用户选择目标物品（从搜索结果或收藏列表），输入目标产量（单位：个/分钟）。
  - 点击"规划"按钮，引擎执行深度优先搜索：
    - 从目标物品出发，查找其生产配方。
    - 将配方中的原料作为下一层目标，继续展开，直至到达基础资源（矿石、水、原油等）。
    - 对每个配方，根据目标产量计算所需机器台数（考虑制造时长和单次产出量）。
  - 支持替代配方切换：若某物品有多个配方，用户可选择优先使用哪个（默认使用标准配方）。
  - 支持副产物处理策略：若配方产出多种物品，用户可选择"丢弃副产物"或"将副产物作为额外产出加入计算"。

### 3.4 生产链流程图可视化

- **用户故事**：作为用户，我希望看到生产链以节点图形式展示，节点间连线表示物料流动，每个节点显示物品名称、图标和流量（每分钟），并且可以自由拖拽和缩放。
- **说明**：
  - 将规划引擎输出的树形结构转换为图（节点与连线）。
  - 节点样式：矩形，内部包含物品图标（如果有）、名称、流量数值。
  - 连线样式：带箭头，线上标注流量值。
  - 交互：支持鼠标拖拽平移画布、滚轮缩放、拖拽节点调整位置。
  - 点击节点：弹出详情弹窗，显示该步骤的配方详情（所需原料、产出、机器类型与数量）。
  - 布局：使用自动布局算法（Dagre）生成初始排列，用户可手动调整。

### 3.5 发电计划

- **用户故事**：作为用户，我希望选择发电机类型和燃料，设定目标发电功率，系统能自动计算所需发电机数量和燃料消耗量。
- **说明**：
  - 支持多种发电机类型（燃煤发电机、燃油发电机、涡轮发电机等）。
  - 支持多种燃料选择（煤炭、燃油、涡轮燃料、火箭燃料等）。
  - 支持超频/降频设置与能量碎片数量输入。
  - 计算结果包括：所需发电机台数、燃料总消耗量、单台发电机功率等。

### 3.6 规划方案的保存与加载

- **用户故事**：作为用户，我希望将当前的规划方案（包括生产规划和发电计划）保存到浏览器本地，以便日后继续编辑或参考。
- **说明**：使用 `localStorage` 存储规划方案（包括目标物品、产量、所选的替代配方、副产物策略、节点布局坐标等）。提供"加载方案"列表，点击即可恢复。

------

## 4. 数据模型

### 4.1 核心实体

| 实体               | 关键字段                                                     | 说明                                           |
| :----------------- | :----------------------------------------------------------- | :--------------------------------------------- |
| **Item**           | `className`, `displayName`, `description`, `stackSize`, `energyValue`, `form` (固态/液态/气态), `smallIcon` | 代表一个物品或资源                             |
| **Recipe**         | `className`, `displayName`, `ingredients` (ItemClass+Amount[]), `products` (ItemClass+Amount[]), `manufactoringDuration`, `producedIn` (BuildingClass[]) | 代表一种制造配方，含原料、产物、耗时、生产建筑 |
| **Building**       | `className`, `displayName`, `description`, `powerConsumption` (可变的) | 代表一种生产建筑，如构造机、装配机等           |
| **GameGenerator**  | `className`, `displayName`, `description`, `powerProduction`, `fuelClasses` (可用燃料列表) | 代表一种发电机，用于发电计划模块               |
| **ProductionNode** | `id`, `itemClass`, `rate` (每分钟产量), `recipeUsed`, `machineCount`, `machineType`, `depth` (层级) | 用于流程图中的节点数据                         |
| **ProductionEdge** | `sourceNodeId`, `targetNodeId`, `flowRate`                   | 用于流程图中的连线数据                         |

### 4.2 索引结构

typescript

```
interface DataIndex {
  items: Map<string, Item>;                 // className -> Item
  recipes: Map<string, Recipe>;             // className -> Recipe（按配方的 className 索引）
  recipesByIngredient: Map<string, Recipe[]>; // 按原料className索引配方（用于查找用途）
  buildings: Map<string, Building>;
  generators: Map<string, GameGenerator>;
}
```



------

## 5. 用户界面设计

### 5.1 整体布局（左右分栏）

- **左侧面板（宽度 ~350px）**：
  - 顶部：Logo + 标题
  - 搜索框（带自动补全下拉列表）
  - 物品详情区（显示选中物品的信息）
  - 规划参数设置区（目标产量输入、替代配方选择、副产物处理策略）
  - "规划"按钮
  - 保存/加载方案按钮
  - 发电计划标签页（发电机选择、燃料、超频参数）
- **右侧主区域**：
  - 流程图画布（Vue Flow 占据全部剩余空间）
  - 顶部工具栏（缩放控制、重置视图、截图导出等）

### 5.2 关键交互流程

1. **搜索物品** → 左侧显示物品详情。
2. **设置产量** → 输入数字，选择替代配方（若该物品有多个配方）。
3. **点击"规划"** → 计算引擎运行，右侧画布生成生产链图。
4. **发电计划** → 选择发电机类型和燃料，设定目标功率，点击计算显示结果。
5. **与流程图交互** → 拖拽节点、缩放、点击节点查看详情。

### 5.3 视觉风格

- 采用深色主题（与游戏风格匹配），通过 CSS 自定义属性实现。
- 节点颜色区分资源类型（基础资源、中间产物、最终产品）。
- UI 样式和布局以手写 CSS 为主，配合 CSS 变量实现主题统一。Ant Design Vue 仅用于 Tooltip、Select、Modal 等特殊交互组件。

------

## 6. 技术架构

### 6.1 技术栈

| 层级       | 技术                             | 版本 |
| :--------- | :------------------------------- | :--- |
| 构建工具   | Vite                             | 8.x  |
| 框架       | Vue 3                            | 3.4+ |
| 编程语言   | TypeScript                       | 6.x  |
| 状态管理   | Pinia                            | 2.x  |
| UI组件库   | Ant Design Vue（仅特殊交互组件） | 4.x  |
| 流程图库   | Vue Flow                         | 1.x  |
| 图布局算法 | Dagre                            | -    |
| 数据持久化 | IndexedDB (Dexie) / localStorage | -    |

### 6.2 项目结构（简化）

text

```
src/
├── main.ts
├── App.vue
├── assets/              # 图片、样式
├── components/
│   ├── LeftPanel.vue     # 左侧面板（搜索、详情、参数）
│   ├── FlowChart.vue     # 右侧流程图（Vue Flow 容器）
│   ├── NodeDetailModal.vue # 节点详情弹窗
│   └── ...
├── views/                # 页面级组件
├── stores/               # Pinia stores
│   ├── dataStore.ts      # 加载和存储索引数据
│   ├── planStore.ts      # 当前规划状态（目标、产量、节点数据）
│   └── uiStore.ts        # UI状态（选中物品、弹窗等）
├── lib/                  # 纯业务逻辑（不依赖UI框架）
│   ├── dataParser.ts     # 解析JSON并构建索引
│   ├── productionEngine.ts # 反向推导算法（DFS）
│   ├── powerCalculator.ts  # 发电计划计算
│   └── layoutHelper.ts   # 图布局辅助（Dagre）
├── router/               # 路由定义（hash 模式，兼容 GitHub Pages）
├── types/                # TypeScript 类型定义
│   └── index.ts
├── constants/            # 常量定义
├── composables/          # Vue 组合式函数
├── config/               # 全局配置
└── utils/                # 工具函数
    └── index.ts
```



### 6.3 核心算法伪代码

typescript

```
function planProduction(targetItemClass: string, targetRate: number, options: PlanOptions): ProductionGraph {
  const graph = new ProductionGraph();
  const visited = new Set();

  function expand(node: Node) {
    visited.add(node.itemClass);
    const recipe = selectRecipe(node.itemClass, options.alternativeRecipes);
    if (!recipe) {
      // 基础资源，标记为叶子节点
      return;
    }
    // 计算所需机器数
    const machineCount = Math.ceil(targetRate / (recipe.productsPerMin));
    node.machineCount = machineCount;
    node.recipeUsed = recipe;
    node.machineType = recipe.producedIn[0];

    // 处理副产物
    recipe.products.forEach(p => {
      if (p.itemClass === targetItemClass) return; // 主产物
      if (options.byproductHandling === 'discard') return;
      // 将副产物作为额外输出添加
      const byproductNode = graph.addNode(p.itemClass, p.rate);
      graph.addEdge(node, byproductNode, p.rate);
    });

    // 对每个原料递归
    recipe.ingredients.forEach(ing => {
      if (!visited.has(ing.itemClass)) {
        const childNode = graph.addNode(ing.itemClass, ing.amount * machineCount / recipe.duration * 60);
        expand(childNode);
        graph.addEdge(childNode, node, ing.amount * machineCount / recipe.duration * 60);
      }
    });
  }

  const root = graph.addNode(targetItemClass, targetRate);
  expand(root);
  return graph;
}
```



### 6.4 数据持久化

- **IndexedDB**：用于存储整个索引数据（`items`, `recipes`），避免每次刷新重新解析 JSON（首次加载后写入，后续直接从 DB 读取）。
- **localStorage**：用于存储用户的规划方案（`planName`, `target`, `rate`, `selectedRecipes`, `graphLayout` 等），因为方案数量通常不会太多（< 10 MB）。

------

## 7. 非功能性需求

### 7.1 性能

- 首次加载：页面完全可交互时间 ≤ 3 秒（视网络及设备性能）。
- 搜索响应：输入后 200ms 内给出下拉建议。
- 规划计算：对于不超过 200 个节点的生产链，计算时间 ≤ 1 秒。
- 流程图渲染：支持 500+ 节点的流畅拖拽与缩放（使用 Vue Flow 的懒加载优化）。

### 7.2 浏览器兼容

- 支持最新版本的 Chrome、Firefox、Edge 和 Safari（基于 Vue 3 的兼容性要求）。

### 7.3 可维护性

- 代码分层清晰，业务逻辑与 UI 解耦。
- 使用 TypeScript 提供完整类型定义，降低维护成本。
- 遵循 ESLint + Oxlint + Prettier 规范。
- 每完成一个阶段自动执行代码审查。

### 7.4 数据安全

- 所有数据仅在本地处理，不上传任何用户数据至服务器。

------

## 8. 里程碑与交付物

| 阶段  | 内容                                                         | 预计时间 |
| :---- | :----------------------------------------------------------- | :------- |
| 第1周 | 项目初始化、JSON 数据解析与索引模块、搜索功能                | 1周      |
| 第2周 | 反向推导计算引擎开发与测试                                   | 1周      |
| 第3周 | 集成 Vue Flow，实现生产链可视化（节点/连线渲染）             | 1周      |
| 第4周 | 完善用户交互：节点拖拽、缩放、点击详情弹窗、副产物处理       | 1周      |
| 第5周 | 本地存储（IndexedDB 缓存 + localStorage 方案保存）、UI 细节打磨、性能优化 | 1周      |
| 第6周 | 完整测试（功能、性能、兼容性）、文档与示例规划方案           | 1周      |

**交付物**：可部署的静态网站源码（GitHub 仓库）、在线预览链接（GitHub Pages）。

> 注：以上里程碑为初始规划，当前进度参见 `.claude/DEV_PLAN.md`。

------

## 9. 风险与缓解

| 风险                             | 影响                   | 缓解措施                                                     |
| :------------------------------- | :--------------------- | :----------------------------------------------------------- |
| JSON 数据结构变化（游戏更新）    | 解析失败，无法加载数据 | 设计灵活的解析器，仅依赖关键字段；定期关注游戏更新，及时适配 |
| 计算引擎出现循环依赖（配方成环） | 递归死循环             | 算法中增加 visited 检测，遇到已访问节点时停止，并提示用户    |
| 大规模生产链导致页面卡顿         | 用户体验差             | 使用 Vue Flow 的按需渲染；对节点数 > 200 的图提供精简模式（仅显示主链，隐藏细节） |
| 流程图布局混乱（重叠）           | 难以阅读               | 采用成熟的 dagre 布局算法，并提供手动调整功能；允许用户选择不同的布局方向（垂直/水平） |
| 用户数据丢失（浏览器清除缓存）   | 规划方案丢失           | 提醒用户导出方案为 JSON 文件，并提供导入功能                 |

------

## 10. 附录

### 10.1 参考资源

- [satisfactory-calculator.com](https://satisfactory-calculator.com/zh) – 界面与功能参考
- [Vue Flow 官方文档](https://vueflow.dev/)
- [Ant Design Vue 组件库](https://next.antdv.com/)

### 10.2 术语表

- **产线**：从原材料到最终产品的完整生产流程。
- **反向推导**：从目标产品出发，逐层向上追溯所需原料的过程。
- **替代配方**：游戏中部分物品除标准配方外的其他制造方式，通常效率不同或使用不同原料。
- **副产物**：生产过程中伴随主要产品而产出的次要物品，如精炼原油产出燃油和聚合物树脂。
- **超频（Overclock）**：通过能量碎片提升机器运行速度，使单个机器产量超过 100%。
- **能量碎片（Power Shard）**：用于超频机器的消耗品，由合成树脂合成。
