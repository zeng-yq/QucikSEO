# 插件面板 UI 重构设计

- **日期**：2026-06-28
- **状态**：已确认（待实现）
- **主题**：panel-redesign

## 背景与目标

当前 sidepanel 面板采用左侧 `SideNav`（148px）+ 右侧 `main` 平铺 5 个页面的结构：GSC 批量提交、Bing 批量提交、Ahrefs KD 查询、SEO 文件、项目管理。存在三个问题：

1. **信息架构扁平**：工具按"实现平台"而非"使用场景"组织，用户心智上是"网站相关操作"和"关键词相关操作"两类，却散落在 5 个并列入口。
2. **提交功能重复**：`GscTool` 与 `BingTool` 结构几乎一致（项目下拉 + 链接 textarea + 开始 + 日志），同一个网站的两批链接要分别在两个页面提交两次。
3. **轻量功能占独立页**：robots.txt / sitemap.xml 只是"打开网页"，却独占一个面板页；项目管理也只是增删域名，却独占一个页面。

**目标**：把面板核心围绕「网站工具」和「关键词工具」两个板块重组，整合重复的提交流程，把轻量功能降级为直接动作，并提升整体设计感。

## 已确认的关键决策

经澄清确认，以下四项为本次重构的定调决策：

1. **顶层布局 —— 顶部双 Tab**：`Header`（logo + 品牌名）+ 水平 `TabBar`（网站工具 / 关键词工具）+ 内容区。不再用左侧侧栏，释放 sidepanel 宽度。
2. **提交目标 —— 每平台一个开关 chip**：网站提交面板顶部一排带 mark 的 `PlatformChip`，默认 GSC + Bing 勾选；点一次「提交」按勾选平台依次提交。未来加引擎只需加一个 chip。
3. **网站选择器 —— combobox + 齿轮弹窗**：一个输入框 + 下拉建议（可直接打字填任意域名，临时使用不入库），旁边齿轮按钮打开项目管理弹窗。
4. **logo 方向 —— 精炼 ✲ 星形 SVG**：把现有珊瑚色 ✲ 字符升级为正式的几何放射星形 SVG，header 与 favicon 同源，工具入口配线性 SVG 图标集。

## 信息架构

```
Header（logo + 衬线品牌名 "AutoSEO"）
└─ TabBar：[网站工具]  [关键词工具]
   ├─ 网站工具板块（SiteTools）
   │   ├─ 网站选择器（Combobox + 齿轮按钮 → ProjectModal）
   │   └─ 子视图（siteView）
   │       · list：工具入口（网站提交 → 进 submit；robots / sitemap → 直接打开）
   │       · submit：提交子面板（带 ← 返回）
   └─ 关键词工具板块（KeywordTools）
       └─ Ahrefs KD 查询表单（直接展示，无子视图）

ProjectModal（全局浮层，由齿轮触发）：项目管理增删域名
```

### 路由与状态

全部状态收敛到 `App.tsx`：

| 状态 | 类型 | 说明 |
|---|---|---|
| `tab` | `'site' \| 'keyword'` | 当前板块 |
| `siteView` | `'list' \| 'submit'` | 网站工具内部子视图 |
| `site` | `{ domain: string; projectId?: string }` | 当前网站；选已有项目带 `projectId`，手动填仅 `domain` |
| `projectModalOpen` | `boolean` | 项目弹窗开关 |

`site` 由 `useSite` hook 管理，记忆到 `chrome.storage.local`。

## 网站工具板块

### 网站选择器（Combobox）

- `TextInput` + 下拉建议浮层。输入时按 domain 包含关系筛选 `projects`。
- 选中已有项目 → `site = { domain: p.domain, projectId: p.id }`。
- 直接输入新域名 → `site = { domain: text, projectId: undefined }`，临时使用、不写入库。
- 右侧齿轮 `IconButton` → 打开 `ProjectModal`。
- 记忆上次（`chrome.storage.local`，key `site:last`）。

### 工具列表（list 视图）

- **网站提交** —— `ToolCard`，副标题 "GSC · Bing"，点击 → `siteView = 'submit'`。
- **robots.txt / sitemap.xml** —— 两个直接动作卡片，点击调用 `buildSeoFileUrl(site.domain, file)` + `chrome.tabs.create`。用当前选中网站；未选网站时禁用并提示。

> **删除 `SeoFiles` 页**：其 `buildSeoFileUrl` 逻辑保留在 `lib/seo-files/url.ts`，调用收敛到 `SiteTools`。

## 网站提交子面板（SubmitPanel）

```
← 返回        网站提交
─────────────────────────
目标平台
[✓ GSC]   [✓ Bing]   （未来 +…）     ← PlatformChip，带抽象 mark + 勾选
─────────────────────────
链接（每行一条）
┌──────────────────────┐
│ https://example.com  │              ← 共用一个 Textarea
│ …                    │
└──────────────────────┘
[        一 次 提 交          ]
─────────────────────────
▍GSC  3/5                              ← 日志区（surface-dark 深色卡片
 ✓ https://…                            + JetBrains Mono，呼应 Claude 代码窗）
▍Bing  待开始
 …
```

- 点「一次提交」后，按勾选平台**串行**执行：先 GSC（跑完）再 Bing，未来加引擎同理。
- 复用 `useGscRunner` / `useBingRunner`，外层包 `useSubmitOrchestrator` 串行编排，日志**按平台分区**展示。
- 日志区用 `surface-dark` + JetBrains Mono，制造 cream/dark 节奏，提升设计感。
- **runner 适配**：现有 `start(projectId, urls)` 改为 `start(site, urls)`（`site = { domain, projectId? }`）。runner 优先用 `projectId` 解析 domain，无 `projectId`（手动填）时直接用 `domain` 作 property 查询；orchestrator 把当前 `site` 透传给两个 runner。

## 关键词工具板块

- 直接复用现有 `AhrefsTool` 表单（国家 + 关键词 + 打开查询），样式微调（去 h2、收紧间距、按钮全宽），**不设子面板**。
- 记忆上次（`ahrefs:last`）保持不变。
- 不涉及网站/项目。

## 项目管理弹窗（ProjectModal）

- `fixed` 遮罩 + 居中卡片；遮罩点击 / ✕ / ESC 关闭。
- 内容直接搬现有 `Projects` 页逻辑：添加域名（`TextInput` + 按钮，`isValidDomain` 校验）+ 列表（每项 domain + 删除）。
- 沿用 `useProjects`。增删后，已打开的网站选择器建议列表实时更新（同一数据源）。

> **删除 `Projects` 页**：逻辑收敛进 `ProjectModal`。

## 视觉 / logo / 图标

沿用现有 `tokens.css`（暖米 canvas + 珊瑚 primary + EB Garamond 衬线 + Inter + JetBrains Mono），新增组件类写入 `global.css`。

- **品牌 logo**：现有 `✲` 字符 → 正式**几何放射星形 SVG**（4 角 spike，与 Anthropic mark 同源、为 AutoSEO 定制），珊瑚色。Header 用 `logo + 衬线 "AutoSEO"`，favicon 复用同款 SVG。
- **平台 chip mark**：GSC / Bing 用**抽象化几何 mark**（GSC≈四色方块/放大镜意象、Bing≈b/方块意象），**不直接套官方商标**，规避商标风险。`PlatformChip` 留 `icon` 插槽，未来引擎各自配一个。
- **工具入口图标**：配套线性 SVG 图标集 —— 提交 `↑`、robots `📄`、sitemap `🗺`、设置 `⚙`、返回 `←`、关闭 `✕`。统一 1.5px 描边、`currentColor`。
- 图标集中放 `components/icons/`，每个一个 `.tsx` 组件。

## 代码结构（增删改）

### 删除
- `entrypoints/sidepanel/components/SideNav.tsx`
- `entrypoints/sidepanel/pages/SeoFiles.tsx`（逻辑并入 SiteTools）
- `entrypoints/sidepanel/pages/Projects.tsx`（逻辑并入 ProjectModal）

### 新增
- `components/Header.tsx` — logo + 品牌名
- `components/TabBar.tsx` — 顶部双 Tab
- `components/Combobox.tsx` — 网站选择器（输入 + 下拉建议）
- `components/ProjectModal.tsx` — 项目管理弹窗
- `components/PlatformChip.tsx` — 平台开关 chip
- `components/ToolCard.tsx` — 工具入口卡片
- `components/icons/*.tsx` — SVG 图标集（Logo、GscMark、BingMark、Submit、Robots、Sitemap、Settings、Back、Close）
- `pages/SiteTools.tsx` — 网站工具板块（选择器 + 工具列表 + list/submit 子视图）
- `pages/SubmitPanel.tsx` — 提交子面板（平台 chip + 共用输入 + 分区日志）
- `pages/KeywordTools.tsx` — 关键词工具板块（含 Ahrefs 表单）
- `hooks/useSite.ts` — 当前网站状态 + storage 记忆
- `hooks/useSubmitOrchestrator.ts` — 串行编排 GSC→Bing，按平台分区日志

### 修改
- `App.tsx` — Tab 路由 + `site` / `siteView` / `projectModalOpen` 状态 + 渲染 Header / TabBar / 板块
- `pages/AhrefsTool.tsx` — 样式微调（被 KeywordTools 包裹）
- `hooks/useGscRunner.ts` / `hooks/useBingRunner.ts` — `start(projectId, urls)` 改为 `start(site, urls)`，`site = { domain, projectId? }`
- `styles/global.css` — 新增 `.tab`、`.combobox`、`.platform-chip`、`.modal`、`.tool-card`、`.submit-log` 等组件类

## 错误处理

- **combobox 手动填非法域名**：提交前校验，错误 inline 提示。
- **robots/sitemap 未选网站**：按钮禁用 + 提示"请先选择网站"。
- **提交时某平台失败**：在该平台日志区记录错误，**不中断后续平台**（串行继续），全部结束后汇总状态。

## 测试

- 更新 `tests/components.test.tsx`：SideNav / SeoFiles / Projects 相关用例替换为 TabBar / Combobox / ProjectModal / SubmitPanel。
- 新增 `useSubmitOrchestrator` 串行编排单测：GSC 完成后才启动 Bing、某平台失败不影响下一个、日志按平台分区。
- 新增 combobox 行为测试：输入筛选、选手动填、齿轮开弹窗。
- 保留现有单测：`seo-files-url`、`ahrefs-url`、`storage`、`gsc-flow`、`bing-flow`、`useProjects` 等。

## 范围外（YAGNI）

- 不新增搜索引擎接入（仅保留 GSC + Bing 的整合框架，留好 chip 扩展位）。
- 不做暗色模式切换（沿用现有 cream 主题；深色仅用于日志区等局部强调）。
- 不引入外部 UI 组件库或 CSS-in-JS 方案（沿用 inline style + `global.css` 组件类的现有模式）。
- 不重写 runner 的提交业务逻辑，只做 `domain` 参数适配与外层编排。
