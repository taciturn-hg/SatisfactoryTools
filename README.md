# SatisfactoryTools — 《幸福工厂》产线规划工具

一个纯前端 SPA，帮助《幸福工厂》玩家查询配方、规划生产链、计算发电方案，并以交互式流程图展示。

## 功能

- **物品查询** — 搜索任一物品，查看其配方（作为产出）与用途（作为原料）
- **产线规划** — 设定目标产量，自动反向推导所需原材料、中间产物和机器数量
- **流程图可视化** — 以可交互的节点图展示生产链，支持拖拽、缩放、点击详情
- **替代配方** — 同一物品有多个配方时可自由选择
- **副产物处理** — 支持丢弃或利用配方副产物
- **发电计划** (规划中) — 选择发电机类型与燃料，计算所需数量与消耗
- **方案管理** (规划中) — 本地保存/加载/导出/导入规划方案

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API, `<script setup>`) |
| 语言 | TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| UI 组件库 | Ant Design Vue 4.x |
| 流程图 | Vue Flow 1.x |
| 图布局 | Dagre |
| 数据持久化 | Dexie (IndexedDB) / localStorage |
| 代码规范 | ESLint + Oxlint + Prettier |

## 快速开始

```sh
npm install
npm run dev        # 开发服务器（热更新）
npm run build      # 类型检查 + 生产构建
npm run type-check # 仅类型检查
npm run lint       # 代码检查
npm run format     # 代码格式化
```

## 项目结构

```
src/
├── main.ts                  # 应用入口
├── App.vue                  # 根组件（布局容器）
├── assets/styles/           # 全局样式与主题变量
├── components/              # Vue 组件
├── views/                   # 页面级组件
├── router/                  # 路由定义
├── stores/                  # Pinia 状态管理
├── lib/                     # 纯业务逻辑（不依赖 Vue）
├── types/                   # TypeScript 类型定义
├── utils/                   # 工具函数
├── constants/               # 常量定义
├── composables/             # Vue 组合式函数
├── config/                  # 全局配置
└── data/                    # 游戏数据
    ├── zh-Hans.json         # Satisfactory 游戏数据
    ├── raw/                 # 官方原始 JSON（UTF-16 LE）
    └── convert.py           # UTF-16 → UTF-8 转换脚本
```

## 数据更新

当游戏更新时：

1. 将新的官方 `zh-Hans.json`（UTF-16 LE）放入 `src/data/raw/`
2. 运行 `python src/data/convert.py`
3. 重启开发服务器

## 图标更新

当游戏更新导致新增或修改物品/建筑图标时：

1. 使用最新版游戏资源打开 FModel。
2. 在 Asset Search 中启用 Regex，并根据资源类型搜索对应的 `_UI` 目录。

| 类型            | Regex                                                        |
| --------------- | ------------------------------------------------------------ |
| 物品（Parts）   | `^FactoryGame/Content/FactoryGame/Resource/Parts/.+/_UI/.+$`<br />`^FactoryGame/Content/FactoryGame/Resource/Parts/.+/UI/.+$` |
| 矿物（Ores）    | `^FactoryGame/Content/FactoryGame/Resource/RawResources/.+/UI/.+$` |
| 工厂（Factory） | `^FactoryGame/Content/FactoryGame/Buildable/Factory/.+/UI/.+$` |

3. 筛选 `Texture2D` 资源，批量导出(`save texture`)为 PNG。
4. 将导出的图片覆盖到 `src/assets/icons/` 对应目录。
5. 若新增了物品或建筑，同时更新对应的数据文件（如 `items.json`、`buildings.json`）。

## 设计文档

- [PRD](./.claude/PRD.md) — 产品需求文档
- [TDD](./.claude/TDD.md) — 技术设计文档
- [DEV_PLAN](./.claude/DEV_PLAN.md) — 开发计划与进度
- [DATA_PARSING](./src/data/DATA_PARSING.md) — 游戏数据字典
