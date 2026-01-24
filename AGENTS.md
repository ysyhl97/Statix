# 项目说明

这是一个基于 `Vue 3 + Vite + Element Plus` 的单页应用，逐步扩展为“工具集合类网站”（多页面/多工具，统一视觉风格）。

## 关键约束（必须遵守）

- 需要保留现有视觉风格，尤其是卡片相关样式：`card-grid` / `note-card` / `card-blob` / `card-body` / `card-footer` 等 class 不要随意改名或删除。
- 全局样式集中在 `src/styles/global.css`：任何 UI/视觉修改优先在这里做；避免把同一套样式拆散到多个组件的 `scoped`/内联样式里，防止后续页面风格走样。
- 不要随意改名/删除工具页布局相关 class（例如 `pane-card` / `excel-*` 等），它们依赖 `src/styles/global.css` 做统一皮肤与布局。
- Element Plus 外观统一：优先复用现有 class（如 `dialog-input` / `mini-input` 等）+ 在 `src/styles/global.css` 里集中覆盖；避免在组件里写大量深层选择器去覆盖 `el-*` 内部结构。
- 不要把 Vue/Element Plus 改回 CDN；依赖通过 `package.json` 管理。
- 字体：允许在 `index.html` 通过 `<link>` 引入 `https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-web/style.css`，并在 `src/styles/global.css` 里配置系统字体兜底（不要在组件里到处写 font-family）。
- 本地数据存储 key：`fixed_notes_clean_v5`（不要轻易改动，避免用户数据丢失）。

## 目录结构

- `index.html`: Vite 入口（挂载点与 main 入口；额外允许引入字体 CSS）
- `src/main.js`: 创建应用、注册 Vue Router/Element Plus、引入全局样式
- `src/App.vue`: 应用壳（`<router-view />`）
- `src/router/index.js`: 路由配置（默认 `hash` 模式，便于静态部署；`/` 重定向到 `/inspiration`）
- `src/components/TopNav.vue`: 顶部导航栏（工具切换入口，保持各页一致）
- `src/pages/InspirationCards.vue`: “灵感碎片”工具页（卡片列表、弹窗、拖拽、复制、导入导出）
- `src/pages/ExcelExtract.vue`: Excel 内容提取/格式化工具页（监听 paste，解析剪贴板 HTML 表格）
- `src/styles/global.css`: 全局样式（包含 card 样式，必须保留）

## 统一风格约定（后续新增功能遵守）

- 页面结构：优先复用 `app-wrapper` / `header-bar` / `pane-card` / `card-grid` / `note-card` 等现有布局。
- 视觉语言：轻玻璃感、柔和渐变背景、轻荧光边（不刺眼）；避免突然换一套配色/字体/阴影/圆角体系。
- 样式位置：新增/调整样式优先写在 `src/styles/global.css`，并按功能块注释归类（例如 `/* Tool: Excel Extract */`）；避免在组件里散落大量局部样式。
- 设计 token：颜色/阴影/圆角/间距优先复用 `:root` 里的 CSS 变量；如需新增 token，先在 `:root` 加变量再使用，避免页面各写各的色值。
- 布局与滚动：桌面端尽量避免页面整体滚动（`body`/`app-wrapper`）；如果内容较长，采用卡片内部滚动（`overflow: auto` + `min-height: 0` + flex 布局），并避免 Tab 切换导致整体高度跳动（必要时使用固定高度或 `scrollbar-gutter: stable`）。
- 字体：全站统一使用 `--font-stack`（由 global.css 管理）；如需等宽，仅在局部使用等宽字体并保持克制。

## 开发命令

- 安装依赖：`npm install`
- 启动开发：`npm run dev`
- 构建：`npm run build`
- 预览：`npm run preview`

## 修改建议

- 新功能优先做成 `src/pages/*` 下的独立页面（一个工具一个页面），通过 `src/router/index.js` 注册路由。
- 避免重构导致 card 或工具页 class 变更，从而破坏全局样式与统一视觉。
