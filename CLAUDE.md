# CLAUDE.md

本文档为 Claude Code 在此仓库中工作时的指引。

## 项目概述

**《幸福工厂》产线规划工具** — 一个纯前端 SPA，帮助玩家查询配方、通过反向推导规划生产链，并以交互式流程图展示。同时包含发电计划扩展模块。所有数据均在本地处理，无后端服务。

## 关键文档

| 文件                       | 说明                                         |
| -------------------------- | -------------------------------------------- |
| `.claude/PRD.md`           | 产品需求文档                                 |
| `.claude/TDD.md`           | 技术设计文档 — 类型、模块、组件、数据流      |
| `.claude/DEV_PLAN.md`      | 开发计划 — 分阶段拆解与任务清单              |
| `src/data/DATA_PARSING.md` | 游戏数据字典 — `zh-Hans.json` 各块的字段说明 |

## 技术栈

- **Vue 3** (Composition API, `<script setup>`)
- **Pinia** 状态管理
- **Vue Router** (当前使用 hash 模式 `createWebHashHistory` 兼容 GitHub Pages 静态部署；有 Nginx 等服务器时可切换为 history 模式 `createWebHistory`)
- **TypeScript** (TS 6, 启用 strict indexed access)
- **Vite 8** 构建工具
- **ESLint 10** + **Oxlint** + **Prettier** 代码规范
- **Ant Design Vue** 4.x (已安装)
- **Vue Flow** 1.x (已安装)
- **Dagre** 图布局算法 (已安装)
- **Dexie** IndexedDB 封装 (已安装)

## 常用命令

```sh
npm install          # 安装依赖
npm run dev          # 启动开发服务器（HMR）
npm run build        # 类型检查 + 生产构建
npm run deploy       # 构建并发布到 GitHub Pages（gh-pages）
npm run type-check   # 仅类型检查 (vue-tsc --build)
npm run lint         # 运行 oxlint 和 eslint（自动修复）
npm run format       # Prettier 格式化 src/
```

### Git 提交规范

提交信息使用以下前缀：

| 前缀        | 用途               | 示例                                                   |
| ----------- | ------------------ | ------------------------------------------------------ |
| `feat:`     | 新功能             | `feat: add production chain reverse derivation engine` |
| `fix:`      | Bug 修复           | `fix: incorrect _C suffix in item class name parsing`  |
| `docs:`     | 文档更新           | `docs: update README with setup instructions`          |
| `refactor:` | 代码重构           | `refactor: extract optional field parser helper`       |
| `perf:`     | 性能优化           | `perf: cache regex patterns in module-level constants` |
| `chore:`    | 杂项（依赖、配置） | `chore: install ant-design-vue and vue-flow`           |

提交信息主体使用中文，简要说明做了什么和为什么。不启用 GPG 签名。

**提交前必须先更新 `.claude/DEV_PLAN.md`，将已完成的任务章节从 `- [ ]` 勾选为 `- [x]`。**

### 代码审查

每完成一个阶段的一章，自行调用 `/code-review medium [对应文件]` 进行代码审查。等待开发者审核完所需修改的 bug，修改对应 bug 后，自行创建 git 提交（无需 push）。

每完成一个完整的阶段，自行调用 `/code-review high`（不指定文件，审核项目整体）。同样等待开发者审核并修复 bug，更新 DEV_PLAN.md 后自动提交。

## 项目约定

### 路径别名

`@` 映射到 `src/`。使用 `@/` 替代相对路径：

```ts
import { useDataStore } from '@/stores/dataStore'
```

### 代码风格

- 无分号 (`semi: false`)，单引号 (`singleQuote: true`)，行宽 100
- 缩进 2 空格，LF 换行，尾随空格修剪
- 最大行宽 100 字符
- **UI 样式和布局优先使用手写 CSS（配合 CSS 变量），只有 Tooltip、Select、Modal 等特殊交互功能才使用 Ant Design Vue 组件库。**

### TypeScript

- `tsconfig.json` 为项目引用根，不直接包含文件
- `tsconfig.app.json` 应用于 `src/**`（应用代码）
- `tsconfig.node.json` 应用于配置文件（`vite.config.*`、`eslint.config.*` 等）
- 启用 `noUncheckedIndexedAccess: true`，数组/对象访问需严格类型

### ESLint / Oxlint

两个 linter 同时运行。Oxlint 负责快速正确性检查（配置在 `.oxlintrc.json`），ESLint 负责 Vue 特定规则和 TypeScript 集成。ESLint 使用 flat config 格式 (`eslint.config.ts`)。

## 架构

这是一个深色主题的 Vue 3 SPA。入口 `src/main.ts` 引入全局样式、创建 Vue 实例、安装 Pinia 和 Vue Router，然后挂载到 `#app`。

### 目录结构

```
src/
├── main.ts                        # 入口
├── App.vue                        # 根组件（布局容器）
├── assets/                        # 静态资源（样式、图标）
├── components/                    # Vue 组件
├── views/                         # 页面级组件
├── router/                        # 路由定义
├── stores/                        # Pinia 状态管理
├── lib/                           # 纯业务逻辑（不依赖 Vue）
├── types/                         # TypeScript 类型定义
├── utils/                         # 工具函数
├── constants/                     # 常量定义
├── composables/                   # Vue 组合式函数
├── config/                        # 全局配置
└── data/                          # 游戏 JSON 数据 + 数据字典
```

> 各目录的具体文件清单请参考 `.claude/TDD.md` 第 13 章和 `.claude/DEV_PLAN.md` 的阶段拆解。项目处于早期阶段，按 DEV_PLAN.md 逐步填充。

### 关键设计决策

- **停车场**：`lib/` 模块为纯函数/类，不依赖 Vue，可脱离 UI 独立测试
- **UI 优先**：先用 mock 数据搭建 UI 骨架，再逐步替换为真实逻辑
- **CSS 变量**：所有主题值均定义为 `:root` 上的 CSS 自定义属性，后续可轻松支持浅色主题

### 数据流

1. 应用加载时解析 `zh-Hans.json` → 构建 `DataIndex` → 缓存到 IndexedDB
2. 用户搜索/选中物品 → 左侧面板展示物品详情
3. 用户设定目标产量 + 选项 → 点击"规划" → 引擎计算 `ProductionGraph`
4. 图数据流向 Vue Flow 画布 → 交互式流程图（拖拽/缩放/点击）
5. 发电计划：选择发电机类型 + 燃料 + 目标功率 → 计算发电机数量和燃料消耗

### 开发策略（来自 DEV_PLAN.md）

| 阶段 | 说明                                           |
| ---- | ---------------------------------------------- |
| 1    | 基础设施：类型定义、数据解析器、IndexedDB 缓存 |
| 2    | 产线规划 UI 骨架（mock 数据）                  |
| 3    | 产线规划业务逻辑                               |
| 4    | 发电计划                                       |
| 5    | 方案保存/加载/导出                             |
| 6    | 打磨与优化                                     |
