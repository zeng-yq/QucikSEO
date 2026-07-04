# Sitemap 批量提交：自动抓取链接 + 本地去重 + 批次报告

- **日期**：2026-07-04
- **状态**：已确认（待实现）
- **主题**：sitemap-batch-submit

## 背景与目标

当前「网站提交」面板（`SubmitPanel.tsx`）的流程是：手动粘贴 URL（`Textarea` 每行一条）→ 勾选 GSC / Bing → 一次性提交。存在三个问题：

1. **手动粘贴费时且易错**：用户要自己去拼 URL 列表，容易遗漏新页面或重复粘贴。
2. **无本地提交记录**：跨会话无法知道哪些 URL 已经提交过，每次都要凭记忆，导致重复提交（GSC 手动提交有日配额，重复提交浪费配额）。
3. **无批次报告**：批次结束只推 `ok/failed/skipped` 计数（`GSC_DONE` / `BING_DONE`），没有「本批成功 / 失败的 URL 列表」，用户看不到具体哪些失败了、为什么。

**目标**：删掉链接输入框，改为 sitemap.xml 输入框（默认 `<origin>/sitemap.xml`，可手改）；点击「一次提交」时自动抓取并递归解析 sitemap，全量链接落本地；从未提交池随机选 10 个 URL，对勾选平台循环提交；提交记录落本地用于去重；提交过程保留实时日志；批次结束列出成功 / 失败报告。

> 网站信息当前已全部保存在本地（`chrome.storage.local`：`projects` 站点列表、`site:last` 当前站点、`settings` 账号索引）。本次新增的链接库与提交记录沿用同一存储，按 `domain` 隔离。

## 已确认的关键决策

经澄清确认，以下为本次改造的定调决策：

1. **存储位置**：全部 `chrome.storage.local`，按 `domain` 隔离（沿用现有 `projects` / `site:last` / `settings` 模式）。
2. **随机范围**：从未提交池随机选 10 个；不足 10 个则提交全部剩余。
3. **sitemap index**：递归合并所有子 sitemap 的 `<loc>`。
4. **去重粒度**：按 URL × 平台——同一 URL 在 GSC / Bing 各可提交一次。
5. **抓取时机**：每次点提交都重抓 sitemap，与本地链接库增量合并（已提交记录保留）。
6. **架构（方案 A）**：background 抓 sitemap（fetch + 解析），sidepanel 持策略与状态（随机 / 去重 / 报告）。
7. **多平台名额（URL 维度）**：选 10 个 URL，对每个跑所有勾选平台；候选池 = 「对所有勾选平台都未 ok」的 URL，保证双平台都真提交、无平台侧跳过浪费。
8. **10 固定**：v1 固定 10 个，不做可配（YAGNI）。
9. **报告**：v1 仅当次显示；提交记录落库用于去重 + 审计，不做历史回看 UI。
10. **同 host 过滤**：sitemap 解析只保留与入口同 host 的 `<loc>`，丢弃跨域外链。
11. **失败口径**：现有 `SubmitResult.status` 只有 `'ok' | 'skipped'`，靠 `reason` 区分「失败」（非预期 skipped）与「跳过」（预期 skipped）。

## 架构与数据流

```
SubmitPanel（UI）
  └─ useSubmitOrchestrator.run({ gsc, bing }, domain, sitemapUrl)
       ① port → background: SITEMAP_FETCH { sitemapUrl }
            background: fetchSitemapTree（递归 + 同host过滤 + 守卫）
          ← SITEMAP_RESULT { urls, stats } | SITEMAP_ERROR { message }
       ② mergeDiscovered(domain, sitemapUrl, urls)        // 增量合并进本地链接库
       ③ 候选池 = 库 urls.filter(u => 勾选平台.every(p => !isSubmittedOk(domain, u, p)))
       ④ picked = pickRandom(候选池, 10)                   // 不足 10 则全选
       ⑤ batchId = crypto.randomUUID()
       ⑥ gsc.start(domain, picked) → [现有 background CDP 流程] → results
          bing.start(domain, picked) → results
       ⑦ appendSubmissions(domain, results → SubmissionRecord[])  // 带 platform / batchId / ts
       ⑧ 汇总本批报告（成功 / 失败 / 跳过 + URL 列表）
```

background 的 GSC / Bing CDP 提交逻辑（`entrypoints/background.ts` 的 `handleStart` / `handleBingStart`、`lib/gsc/flow.ts`、`lib/bing/flow.ts`）**完全不动**；只新增 sitemap 抓取这条独立 port。

## 组件结构

```
SubmitPanel.tsx（改造）
├─ 返回按钮 + <h2>网站提交</h2>
├─ 目标平台 PlatformChip × 2（GSC / Bing）            —— 保留
├─ sitemap TextInput（默认 <origin>/sitemap.xml，可手改）—— 替换原 Textarea
├─ 〔一次提交〕 / 〔取消〕                              —— 保留
├─ GSC LogPanel / Bing LogPanel（实时过程日志）        —— 保留
└─ 本批报告区（批次结束出现）                           —— 新增
   ├─ 汇总条  本批 N · 成功 X · 失败 Y · 跳过 Z
   ├─ 成功列表（URL）
   └─ 失败列表（URL + reason）
```

## 新增 / 改动文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `lib/sitemap/parse.ts` | 新增 | `parseSitemapXml(text)` 纯函数：识别 index / urlset，抽取 `<loc>`。 |
| `lib/sitemap/fetch.ts` | 新增 | `fetchSitemapTree(entryUrl, opts)`：递归抓取 + 深度 / 数量守卫 + 同 host 过滤（background 专用）。 |
| `lib/storage/discovered.ts` | 新增 | 链接库：`getDiscovered` / `mergeDiscovered`，key `discovered:${domain}`。 |
| `lib/storage/submissions.ts` | 新增 | 提交记录：`isSubmittedOk` / `appendSubmissions`，key `submissions:${domain}`。 |
| `lib/messaging/types.ts` | 改造 | 新增 `SitemapRequest` / `SitemapEvent` 类型。 |
| `lib/messaging/protocol.ts` | 改造 | 新增 `SITEMAP_PORT_NAME = 'sitemap-fetcher'` + `createSitemapPort`。 |
| `entrypoints/background.ts` | 改造 | 新增 `sitemap-fetcher` port 监听，调 `fetchSitemapTree`。 |
| `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts` | 改造 | 新 `run` 流程：fetch → merge → pool → pick → start → append → report。 |
| `entrypoints/sidepanel/pages/SubmitPanel.tsx` | 改造 | 删 `Textarea`、加 sitemap 输入、加报告区。 |
| `wxt.config.ts` | 改造 | `host_permissions` 追加 `"<all_urls>"`。 |
| `lib/gsc/flow.ts` / `lib/bing/flow.ts` | 不动 | 保留现有 `submitOne` / `runBatch` 与 reason 产出。 |

## 数据模型

### 链接库 discovered（按 domain）

```ts
// lib/storage/discovered.ts
interface DiscoveredLinks {
  domain: string;
  sitemapUrl: string;   // 上次抓取的 sitemap 入口
  urls: string[];       // 去重后的全量同 host 链接
  updatedAt: number;
}
// storage key: `discovered:${domain}`
```

- `getDiscovered(domain): Promise<DiscoveredLinks | null>`
- `mergeDiscovered(domain, sitemapUrl, fetched: string[]): Promise<DiscoveredLinks>` —— `fetched` 与已有 `urls` 取并集，更新 `sitemapUrl` / `updatedAt`。

### 提交记录 submissions（按 domain）

```ts
// lib/storage/submissions.ts
type Platform = 'gsc' | 'bing';
interface SubmissionRecord {
  url: string;
  platform: Platform;
  status: 'ok' | 'skipped';
  reason?: string;      // skipped 原因（已索引 / 配额 / 检查未出现 / …）
  ts: number;           // 落库时刻（Date.now()）
  batchId: string;      // 一次「一次提交」对应一个 batchId
}
// storage key: `submissions:${domain}` → SubmissionRecord[]
```

- `isSubmittedOk(domain, url, platform): Promise<boolean>` —— 是否存在 `status === 'ok'` 的记录（去重判定）。
- `appendSubmissions(domain, records: SubmissionRecord[]): Promise<void>` —— 追加（不去重，全量留作审计）。

> **去重只看 `ok`**：成功过的 `(url, platform)` 不再选。「配额」「已索引」等 skipped 不进黑名单，下次仍可选（重试无害）。

## sitemap 抓取与解析规格

### 解析（纯函数）

```ts
// lib/sitemap/parse.ts
type SitemapKind = 'index' | 'urlset';
function parseSitemapXml(text: string): { kind: SitemapKind; locs: string[] };
```

- 根元素 `<sitemapindex>` → `kind = 'index'`，`locs` = 所有 `<sitemap><loc>` 文本。
- 根元素 `<urlset>` → `kind = 'urlset'`，`locs` = 所有 `<url><loc>` 文本。
- **解析方式：正则**（**MV3 service worker 无 DOM API，`DOMParser` 不可用**）。判定 kind 看根标签 `<sitemapindex` / `<urlset>`；提取 `<loc>…</loc>` 时一并剥离 `<![CDATA[…]]>` 包裹与首尾空白。
- 空文档 / 无任何 `<loc>` → 抛错（交由上层报「sitemap 未包含任何同站链接」）。
- 正则在 SW 与单测里行为一致（纯字符串进出），无需 DOM 环境。

### 递归抓取（background）

```ts
// lib/sitemap/fetch.ts
interface FetchOpts { maxDepth?: number; maxUrls?: number; perReqTimeoutMs?: number; }
async function fetchSitemapTree(entryUrl: string, opts?: FetchOpts): Promise<{
  urls: string[];        // 扁平、去重、同 host 过滤后的全部 <loc>
  indexDepth: number;    // 实际递归深度
  truncated: boolean;    // 是否因 maxUrls 截断
}>;
```

默认 `maxDepth = 3`、`maxUrls = 50000`、`perReqTimeoutMs = 30000`。

算法：

1. 队列 `= [{ url: entryUrl, depth: 0 }]`，`visited = Set`，`urls = []`。
2. 出队一项；`depth > maxDepth` 或 `visited.has(url)` → 跳过。
3. `fetch(url)`（`AbortController` 超时 `perReqTimeoutMs`）；非 2xx → 抛错。
4. `parseSitemapXml(text)`：`index` → 子 `loc` 入队（`depth + 1`）；`urlset` → `loc` 加入 `urls`。
5. **同 host 过滤**：只保留 `new URL(loc).host === new URL(entryUrl).host` 的 `loc`。
6. `urls.length ≥ maxUrls` → `truncated = true`，停止。
7. 去重后返回。

防失控：`visited` 防止循环 index；`maxDepth` / `maxUrls` 双上限。

### background port

- port 名：`sitemap-fetcher`。
- UI → bg：`{ type: 'SITEMAP_FETCH'; sitemapUrl: string }`。
- bg → UI：`{ type: 'SITEMAP_RESULT'; urls: string[]; stats: { indexDepth: number; truncated: boolean } }` 或 `{ type: 'SITEMAP_ERROR'; message: string }`。

## 提交流程规格

`useSubmitOrchestrator.run({ gsc, bing }, domain, sitemapUrl)`：

1. **抓 sitemap**：经 `sitemap-fetcher` port 发 `SITEMAP_FETCH`；收 `SITEMAP_RESULT` 拿 `urls`；`SITEMAP_ERROR` → error 日志 + `return`。
2. **合并入库**：`mergeDiscovered(domain, sitemapUrl, urls)`。
3. **候选池**：`discovered.urls.filter(u => 勾选平台.every(p => !isSubmittedOk(domain, u, p)))`。
4. **随机选 10**：`pickRandom(pool, 10)`；pool 空 → info「无可提交链接，全部已提交」+ `return`；不足 10 → 全选。
5. **批次 id**：`batchId = crypto.randomUUID()`。
6. **提交**：`if (gsc) await gsc.start(domain, picked)`（现有 runner，串行 await `GSC_DONE`）；`if (bing) await bing.start(domain, picked)`。
7. **落记录**：每平台 DONE 后，把 `results` 映射为 `SubmissionRecord[]`（`platform`、`batchId`、`ts = Date.now()`、`url` / `status` / `reason` 来自 `results`）→ `appendSubmissions`。
8. **报告**：合并 gsc + bing 的 `results`（按 `url × platform`），分类汇总。

### pickRandom 规格

```ts
function pickRandom<T>(pool: T[], n: number): T[];
```

Fisher-Yates 洗牌取前 `n`（`n > pool.length` 则全选）。无副作用。随机源用 `crypto.getRandomValues`。

### 多平台名额语义

- 选 10 个 **URL**（不是 10 个 URL×平台组合）。
- 候选池 = 「对所有勾选平台都未 ok」的 URL → 保证选中后双平台都真提交、无平台侧跳过浪费。
- 对每个选中 URL，依次跑勾选平台；各平台独立 `runBatch`。

## UI 规格（SubmitPanel）

### 改动

- **删除** 链接 `<Textarea>` 及其 `text` state。
- **新增** sitemap `<TextInput>`：
  - 默认值 = `normalizeOrigin(domain) + '/sitemap.xml'`（复用 `lib/seo-files/url.ts` 的 `normalizeOrigin`）。
  - `domain` 变化时重新生成默认值；用户手改过则用 dirty 标记保护，不被覆盖。
  - 可手改（支持完整 URL，如带路径的 sitemap index）。
- 平台 `PlatformChip`、提交 / 取消按钮保留；提交按钮逻辑改走新 `run`。
- GSC / Bing 实时 `LogPanel` 保留（即「当前链接提交过程」日志）。
- **新增本批报告区**（`orch.report` 存在时显示）。

### 报告分类口径

合并 gsc + bing 的 `results`（每条 = `{ url, platform, status, reason }`）后：

| 类别 | 判定 | 报告位置 |
|---|---|---|
| 成功 | `status === 'ok'` | 成功列表 |
| 失败 | `status === 'skipped'` 且 `reason ∈ FAILURE_REASONS` | 失败列表（带 `reason`） |
| 跳过 | `status === 'skipped'` 且 `reason ∈ SKIP_REASONS` | 仅计数，不列详情 |

```
FAILURE_REASONS = ['检查结果未出现', '提交未确认', '步骤异常', '输入框未就绪', '按钮禁用', '无请求编入索引按钮']
SKIP_REASONS    = ['已索引', '不属于此域名', '配额', '未执行（批次终止）']
```

> `reason` 字符串须与 `lib/gsc/flow.ts` / `lib/bing/flow.ts` 现有产出对齐——实现时以 flow 产出为准。建议把 reason 抽成常量集（如 `lib/submit/reasons.ts`），避免 UI 与 flow 硬编码漂移；Bing 侧的 reason 文案实现时一并核对归入 FAILURE / SKIP。

汇总条：`本批 N 个 · 成功 X · 失败 Y · 跳过 Z`。

## 错误处理

| 场景 | 行为 |
|---|---|
| sitemap 404 / 非 2xx | `SITEMAP_ERROR`「sitemap 拉取失败: <status>」+ 不提交，输入框保留 |
| sitemap 超时 | `SITEMAP_ERROR`「sitemap 请求超时」+ 不提交 |
| sitemap 非 XML / 解析失败 | `SITEMAP_ERROR`「sitemap 解析失败」+ 不提交 |
| sitemap 过滤后 0 链接 | `SITEMAP_ERROR`「sitemap 未包含任何同站链接」+ 不提交 |
| `host_permissions` 拦截 fetch | fetch reject → 同 404 路径，error 日志 |
| 全量已提交（候选池空） | info「无可提交链接，全部已提交」+ `return` |
| 配额熔断（现有 `runBatch` 已有） | 剩余 URL 计 `skipped(未执行)` → 报告归「跳过」 |
| 用户取消 | 现有 `cancel` 流程；已产生的 `results` 仍落库 |

## 权限变更

`wxt.config.ts`：

```ts
host_permissions: ['https://search.google.com/*', 'https://www.bing.com/*', 'https://ahrefs.com/*', '<all_urls>'],
```

**必需**：fetch 用户任意站点的 `sitemap.xml` 需要跨域读权限。

**代价**：Chrome Web Store 审核需声明用途（「读取站点 sitemap 以提交至搜索引擎」）；用户安装时多一个「读取并更改所有网站数据」权限提示。

## 测试策略

沿用 vitest + TDD（对齐 `tests/` 现有范式）：

| 模块 | 用例 |
|---|---|
| `parseSitemapXml` | index / urlset / 混合 / 空 loc / 非 XML 抛错 / 命名空间变体 |
| `fetchSitemapTree`（mock fetch） | 单层 urlset / 两层 index→urlset / 深度超限截断 / `maxUrls` 截断 / 同 host 过滤跨域 / 循环 index 防失控（visited）/ 单请求超时 |
| `discovered` 存储 | merge 并集 / 空 fetched / `domain` 隔离 |
| `submissions` 存储 | `isSubmittedOk` 命中 / 未命中 / `append` 累积 / 按 `platform` 独立 / 按 `domain` 隔离 |
| `pickRandom` | `n < pool` 取前 n / `n ≥ pool` 全选 / 结果是 pool 子集 |
| `useSubmitOrchestrator` 新 run | mock sitemap port + 两 runner：断言 ①sitemap 失败不提交 ②merge → pool → pick → start → append 顺序 ③候选池排除 ok ④不足 10 全选 ⑤results 落库带 `batchId` / `platform` |
| background sitemap handler | mock `fetch` → 断言 `SITEMAP_RESULT` / `SITEMAP_ERROR` 分支 |

`chrome.storage.local` 用现有测试里的 fake 实现（见 `tests/storage.test.ts` / `tests/useProjects.test.tsx` 范式）。

## 范围与非目标（YAGNI）

v1 不做：

- 10 数量可配置（固定 10）。
- 历史提交记录回看 UI（落库仅用于去重 + 审计）。
- 提交记录过期清理 / GSC「14 天后可重提」窗口。
- sitemap gzip / RSS / Atom 等其他格式支持。
- 多 sitemap 入口（仅单一 sitemap URL 输入）。
- 链接库手动编辑 / 删除。
