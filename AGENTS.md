# 项目说明

这是一个基于 `Vue 3 + Vite + Element Plus` 的多工具单页应用（工具集合站），当前架构已演进为：
`页面壳 + composables 业务逻辑 + features 纯函数解析 + workers 异步计算 + 全局样式分层`。

## 关键约束（必须遵守）

- 需要保留现有视觉风格，尤其是卡片相关样式：`card-grid` / `note-card` / `card-blob` / `card-body` / `card-footer` 等 class 不要随意改名或删除。
- 不要随意改名/删除工具页布局相关 class（例如 `pane-card` / `excel-*` / `account-*` 等），它们依赖全局样式皮肤。
- 全局样式入口固定为 `src/styles/global.css`：UI/视觉修改优先在样式层完成，不要在组件里散落大量 `scoped`/内联样式覆盖。
- `src/styles/global.css` 作为样式聚合入口，当前通过 `@import` 引入 `base.css` 与 `src/styles/tools/*.css`；新增样式按此分层组织。
- Element Plus 外观统一：优先复用现有 class（如 `dialog-input` / `mini-input` 等）并在全局样式中覆盖，避免在组件里写大量深层 `el-*` 选择器。
- 优先使用 Vue3/Element Plus 等成熟库，不从零造轮子；仅在现有能力不足时自定义实现。
- 不要把 Vue/Element Plus 改回 CDN；依赖统一由 `package.json` 管理。
- 字体：允许在 `index.html` 通过 `<link>` 引入 `https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css`，并在样式层配置系统字体兜底。
- 本地数据存储 key：`fixed_notes_clean_v5`（不要轻易改动，避免用户数据丢失）。
- 页面组件以“模板绑定 + 交互转发”为主，不要把大型业务逻辑回填到页面，避免再次出现超大文件。

## 架构与性能基线（必须保持）

- 路由保持 `hash` 模式，并使用懒加载页面组件（`import()`）。
- `vite.config.js` 中的 `manualChunks` 属于项目性能基线：`vue-vendor` / `element-plus` / `tool-account` / `tool-excel` / `tool-text`，不要随意删除或合并。
- `src/main.js` 保持 Element Plus 手动按需注册与样式按需引入，不回退为全量 `app.use(ElementPlus)`。
- 账号解析在大数据量场景依赖 `src/workers/accountParser.worker.js`，不要删除 worker 路径或退回主线程重计算。

## 目录结构（当前）

- `index.html`: Vite 入口（挂载点、main 入口、字体 CSS 引入）
- `vite.config.js`: Vite 配置与手动分包策略（manualChunks）
- `src/main.js`: 创建应用、注册 Router、按需注册 Element Plus、引入全局样式入口
- `src/App.vue`: 应用壳（`<router-view />`）
- `src/router/index.js`: 路由配置（hash 模式，`/` 重定向到 `/inspiration`）
- `src/components/TopNav.vue`: 顶部导航栏（各工具页统一入口）

- `src/pages/InspirationCards.vue`: 灵感碎片工具页（列表、弹窗、拖拽、复制、导入导出）
- `src/pages/ExcelExtract.vue`: Excel 粘贴解析/列提取/格式化工具页
- `src/pages/AccountFormatter.vue`: 账号卡密格式化工具页（含 2FA 原值复制与验证码生成复制）
- `src/pages/TextWorkbench.vue`: 文本工作台（多标签、清洗、正则替换、撤销重做）

- `src/composables/inspiration/useInspirationCards.js`: Inspiration 页业务逻辑
- `src/composables/excel/useExcelExtractor.js`: Excel 工具逻辑
- `src/composables/text/useTextWorkbench.js`: 文本工作台逻辑
- `src/composables/account/useAccountFormatter.js`: Account 聚合逻辑入口
- `src/composables/account/modules/constants.js`: Account 常量与默认配置
- `src/composables/account/modules/trimRules.js`: 字段前后缀过滤规则处理
- `src/composables/account/modules/useAccountParse.js`: Account 解析流程（主线程/worker）
- `src/composables/account/modules/useAccountOtp.js`: Account OTP 状态与交互逻辑

- `src/features/excel/parsers/shared.js`: Excel 解析共享工具
- `src/features/excel/parsers/htmlTable.js`: HTML 表格解析
- `src/features/excel/parsers/rtfTable.js`: RTF 表格解析
- `src/features/excel/parsers/plainTextTable.js`: 纯文本表格解析
- `src/features/excel/parsers/index.js`: Excel 解析器导出入口

- `src/workers/accountParser.worker.js`: Account 解析 worker
- `src/utils/accountParser.js`: 账号解析核心函数
- `src/utils/totp.js`: OTP 生成工具

- `src/styles/global.css`: 全局样式入口（import hub）
- `src/styles/base.css`: 基础样式与通用布局/组件皮肤
- `src/styles/tools/excel.css`: Excel 工具样式
- `src/styles/tools/account.css`: Account 工具样式
- `src/styles/tools/text.css`: Text Workbench 样式

## 统一风格约定（新增功能必须遵守）

- 页面结构：优先复用 `app-wrapper` / `header-bar` / `pane-card` / `card-grid` / `note-card` 等现有布局。
- 视觉语言：轻玻璃感、柔和渐变背景、轻荧光边（不刺眼）；避免突然更换整套配色/字体/阴影/圆角体系。
- 样式位置：优先写入 `src/styles/tools/*.css`，由 `src/styles/global.css` 统一挂载；不要在页面组件中堆积样式覆盖。
- 设计 token：颜色/阴影/圆角/间距优先复用 `:root` 变量；新增 token 先入 `:root` 再使用。
- 布局与滚动：桌面端尽量避免页面整体滚动；长内容优先使用卡片内滚动（`overflow: auto` + `min-height: 0` + flex），避免切换抖动。
- 字体：全站统一使用 `--font-stack`；仅局部必要场景使用等宽字体。

## 新功能接入流程（建议）

- 一个工具一个页面：在 `src/pages/*` 新建页面组件。
- 页面业务逻辑放 `src/composables/<tool>/useXxx.js`，页面只保留模板绑定与调用。
- 纯函数解析/转换逻辑放 `src/features/<tool>/...`，避免耦合 UI。
- 大计算或批处理优先放 `src/workers/*`，避免阻塞主线程。
- 工具样式放 `src/styles/tools/<tool>.css` 并在 `src/styles/global.css` 引入。
- 在 `src/router/index.js` 注册懒加载路由。

## 开发命令

- 安装依赖：`npm install`
- 启动开发：`npm run dev`
- 构建：`npm run build`
- 预览：`npm run preview`

## 提交流程建议

- 修改后至少执行一次 `npm run build`，确认懒加载/分包未被破坏。
- 若涉及样式改动，检查关键 class 是否保留（`card-grid` / `note-card` / `pane-card` / `excel-*` / `account-*`）。
- 若涉及 Account 解析链路，验证 worker 路径与 OTP 交互（2FA 原值复制、验证码生成/倒计时/休眠）正常。
