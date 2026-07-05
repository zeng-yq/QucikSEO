# Sitemap 低价值链接过滤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 sitemap 抓取后、候选池构建前，用正则过滤账号/法务/用户中心三类低价值链接，让本地全量库保留、候选池与 UI 提示反映过滤结果。

**Architecture:** 方案 A——新增纯函数 `lib/submit/filter.ts`（正则 + `partitionLowValue`），在 `useSubmitOrchestrator` 第 ②.5 步对 `discovered.urls` 过滤、候选池用 `kept`、`dropped.length > 0` 时推一条系统日志；`SubmitPanel` sitemap 输入框下方加一行常驻说明。不触碰 sitemap 抓取、存储结构、background、查询进度面板。

**Tech Stack:** TypeScript、React 19、WXT、vitest 3 + @testing-library/react 16。

## Global Constraints

（每个任务的隐含前提，源自 `docs/superpowers/specs/2026-07-05-sitemap-lowvalue-filter-design.md`）

- **测试命令**：`pnpm test`（等价 `vitest run`）；单文件：`npx vitest run tests/submit-filter.test.ts`。
- **路径约定**：源码 import 用别名 `@lib/...`；测试 import 用相对路径 `../lib/...`（与 `tests/submit-strategies.test.ts` 一致）。
- **测试环境**：`tests/setup.ts` 已注入 `chrome.storage.local` 内存实现 + `fake-indexeddb`，每个 `it` 前 `resetChromeMock()` 清空，无需手动清理。
- **入库语义**：`mergeDiscovered` 必须收到**全量** fetched urls（含低价值项）——过滤只发生在它之后的候选池构建，绝不提前丢弃。
- **不改动文件**：`lib/sitemap/*`、`lib/storage/*`、`entrypoints/background.ts`、`lib/gsc/*`、`lib/bing/*`、`pick.ts`、`reasons.ts`、`wxt.config.ts`。
- **纯函数约束**：`lib/submit/filter.ts` 无 IO、无 `Date.now` / `Math.random`、不修改入参。
- **匹配粒度**：路径段精确匹配（前边界 `^|/`），STRICT 类后边界 `$/?#`（不含 `-`，防 `login-tips` 误伤），LOOSE 类后边界 `$/?#-`（容 `privacy-policy` 组合），`my[-_]` 前缀单独一支。
- **Commit 风格**：中文 + scope，如 `feat(submit): ...`。

---

## File Structure

| 文件 | 动作 | 责任 |
|---|---|---|
| `lib/submit/filter.ts` | 新增 | 导出 `LOW_VALUE_URL_RE` / `isLowValueUrl` / `partitionLowValue`，纯函数、零依赖 |
| `tests/submit-filter.test.ts` | 新增 | 三类命中 + 误伤防护 + 边界 + partition 行为 |
| `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts` | 改造 | 第 ②.5 步过滤 + 条件日志；第 ③ 步候选池用 `kept` |
| `tests/useSubmitOrchestrator.test.tsx` | 增补 | 全量入库 / 日志回显 / 候选池过滤 / dropped=0 静默 |
| `entrypoints/sidepanel/pages/SubmitPanel.tsx` | 改造 | sitemap `TextInput` 下方一行常驻说明 |
| `tests/submitpanel.test.tsx` | 增补 | 断言说明文字渲染 |

依赖顺序：Task 1（filter 纯函数）→ Task 2（orchestrator 接入，消费 filter）→ Task 3（UI 说明）。每个任务独立可测、独立 commit。

---

## Task 1: `lib/submit/filter.ts` 低价值过滤纯函数

**Files:**
- Create: `lib/submit/filter.ts`
- Test: `tests/submit-filter.test.ts`

**Interfaces:**
- Consumes: 无（零依赖纯函数）。
- Produces（后续任务依赖的签名，必须严格一致）:
  - `LOW_VALUE_URL_RE: RegExp`
  - `isLowValueUrl(url: string): boolean`
  - `partitionLowValue(urls: string[]): { kept: string[]; dropped: string[] }`

- [ ] **Step 1: 写失败测试 `tests/submit-filter.test.ts`**

创建文件，内容：

```ts
import { describe, it, expect } from 'vitest';
import { LOW_VALUE_URL_RE, isLowValueUrl, partitionLowValue } from '../lib/submit/filter';

describe('isLowValueUrl', () => {
  it.each([
    'https://example.com/login',
    'https://example.com/auth/login',
    'https://example.com/sign-in',
    'https://example.com/signup',
    'https://example.com/logout',
    'https://example.com/register',
    'https://example.com/auth',
  ])('账号认证命中：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/privacy',
    'https://example.com/privacy-policy',
    'https://example.com/terms',
    'https://example.com/terms-of-service',
    'https://example.com/cookie-statement',
    'https://example.com/legal',
    'https://example.com/gdpr',
    'https://example.com/disclaimer',
  ])('法务条款命中：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/account',
    'https://example.com/accounts',
    'https://example.com/dashboard',
    'https://example.com/profile',
    'https://example.com/cart',
    'https://example.com/checkout',
    'https://example.com/orders',
    'https://example.com/settings',
  ])('用户中心命中：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/my-account',
    'https://example.com/my-orders',
    'https://example.com/my_profile',
  ])('my- 前缀命中：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/blog/login-tips-for-beginners',
    'https://example.com/account-faq',
    'https://example.com/register-guide',
    'https://example.com/search?q=login',
    'https://example.com/loginator',
    'https://example.com/blog/seo-guide',
    'https://example.com/post/how-to-rank',
    'https://example.com/author',
  ])('内容页保留（不误伤）：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(false);
  });

  it.each([
    'https://example.com/LOGIN',
    'https://example.com/Privacy-Policy',
    'https://example.com/MY-Account',
  ])('大小写不敏感：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/login?next=/home',
    'https://example.com/login#section',
    'https://example.com/auth/login?return=/',
  ])('段尾边界（query / hash）命中：%s', (url) => {
    expect(isLowValueUrl(url)).toBe(true);
  });
});

describe('LOW_VALUE_URL_RE', () => {
  it('是全局可复用的 RegExp 实例', () => {
    expect(LOW_VALUE_URL_RE).toBeInstanceOf(RegExp);
    expect(LOW_VALUE_URL_RE.flags).toContain('i');
    // 同一实例多次 test 不互相干扰（lastIndex 不累积）
    LOW_VALUE_URL_RE.lastIndex = 0;
    expect(LOW_VALUE_URL_RE.test('https://x.com/login')).toBe(true);
    expect(LOW_VALUE_URL_RE.test('https://x.com/blog/post')).toBe(false);
  });
});

describe('partitionLowValue', () => {
  it('混合列表正确拆分 + 保序', () => {
    const urls = [
      'https://example.com/login',
      'https://example.com/blog/post-1',
      'https://example.com/privacy-policy',
      'https://example.com/blog/post-2',
      'https://example.com/cart',
    ];
    const { kept, dropped } = partitionLowValue(urls);
    expect(kept).toEqual([
      'https://example.com/blog/post-1',
      'https://example.com/blog/post-2',
    ]);
    expect(dropped).toEqual([
      'https://example.com/login',
      'https://example.com/privacy-policy',
      'https://example.com/cart',
    ]);
  });

  it('空列表返回两个空数组', () => {
    const { kept, dropped } = partitionLowValue([]);
    expect(kept).toEqual([]);
    expect(dropped).toEqual([]);
  });

  it('全保留', () => {
    const urls = ['https://example.com/a', 'https://example.com/b'];
    const { kept, dropped } = partitionLowValue(urls);
    expect(kept).toEqual(urls);
    expect(dropped).toEqual([]);
  });

  it('全过滤', () => {
    const urls = ['https://example.com/login', 'https://example.com/auth'];
    const { kept, dropped } = partitionLowValue(urls);
    expect(kept).toEqual([]);
    expect(dropped).toEqual(urls);
  });

  it('不修改入参', () => {
    const urls = ['https://example.com/login', 'https://example.com/a'];
    const snap = [...urls];
    partitionLowValue(urls);
    expect(urls).toEqual(snap);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/submit-filter.test.ts`
Expected: FAIL —— 报错 `Cannot find module '../lib/submit/filter'`（文件尚未创建）。

- [ ] **Step 3: 实现 `lib/submit/filter.ts`**

创建文件，内容：

```ts
/**
 * 低价值链接过滤（纯函数）。
 *
 * sitemap 抓取后、候选池构建前，剔除账号认证 / 法务条款 / 用户中心三类
 * 「提交无意义」的 URL。discovered 库仍保留全量，仅不参与提交候选。
 *
 * 匹配粒度：路径段精确匹配（前边界 ^|/，非子串），按类别分两个严格度：
 * - STRICT（账号 / 用户中心）：整段，后边界 $/?# 不含 -（防 login-tips 误伤）
 * - LOOSE（法务条款）：段首关键词，允许 - 后缀（容 privacy-policy / terms-of-service 等组合）
 * - my- / my_ 前缀单独一支（用户中心入口习惯）
 *
 * 单复数用 s? 合并（accounts? / orders? …），避免依赖正则回溯。
 *
 * 详见 docs/superpowers/specs/2026-07-05-sitemap-lowvalue-filter-design.md
 */

/** 严格段关键词（账号认证 + 用户中心）：整段精确匹配 */
const STRICT = [
  // 账号认证
  'login', 'sign[-_]?in', 'sign[-_]?up', 'log[-_]?out', 'log[-_]?off',
  'register', 'registration', 'auth',
  // 用户中心
  'accounts?', 'profiles?', 'dashboard', 'settings?', 'members?',
  'carts?', 'checkout', 'orders?',
].join('|');

/** 宽松段关键词（法务条款）：段首关键词即可，允许 - 后缀 */
const LOOSE = [
  'privacy', 'polic(?:y|ies)', 'terms', 'tos',
  'agreements?', 'disclaimers?', 'legal', 'cookies?', 'gdpr',
].join('|');

/**
 * 低价值链接匹配正则。i 标志：大小写不敏感。
 * 无 g 标志 —— 配合 .test() 不会累积 lastIndex，多次调用安全。
 */
export const LOW_VALUE_URL_RE = new RegExp(
  '(?:^|/)(?:' +
    'my[-_]' +                              // ① my- / my_ 前缀
    '|' + '(?:' + LOOSE + ')(?=$|[/?#-])' + // ② 法务：段首关键词
    '|' + '(?:' + STRICT + ')(?=$|[/?#])'   // ③ 账号 / 用户中心：整段
  + ')',
  'i',
);

/** 单条 URL 是否为低价值（不参与提交候选） */
export function isLowValueUrl(url: string): boolean {
  return LOW_VALUE_URL_RE.test(url);
}

/**
 * 把 URL 列表拆为「保留候选」与「被过滤」两段。
 * 保序、不去重、不修改入参。单次遍历 O(n)。
 * 调用方负责在 dropped.length > 0 时上报日志。
 */
export function partitionLowValue(urls: string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const u of urls) {
    if (isLowValueUrl(u)) dropped.push(u);
    else kept.push(u);
  }
  return { kept, dropped };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/submit-filter.test.ts`
Expected: PASS —— 全部用例绿。

如有用例意外失败，先核对：STRICT 类后边界是否漏了某关键词、LOOSE 类是否覆盖组合路径、`my[-_]` 是否覆盖 `_`。修正 `STRICT` / `LOOSE` 数组而非测试预期（测试预期源自 spec 误伤验证表，是源真）。

- [ ] **Step 5: 全量回归 + 类型检查**

Run: `pnpm test && pnpm compile`
Expected: 全部测试通过；`tsc --noEmit` 无报错。

- [ ] **Step 6: Commit**

```bash
git add lib/submit/filter.ts tests/submit-filter.test.ts
git commit -m "feat(submit): 新增 sitemap 低价值链接过滤纯函数

账号认证/法务条款/用户中心三类路径段精确匹配；STRICT 整段、LOOSE
允许组合、my- 前缀；partitionLowValue 保序拆分。discovered 库保留全量。"
```

---

## Task 2: `useSubmitOrchestrator` 接入过滤

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts`（import 区 + `run` 第 ②/③ 步）
- Test: `tests/useSubmitOrchestrator.test.tsx`（在现有 describe 块末尾增补用例）

**Interfaces:**
- Consumes: Task 1 的 `partitionLowValue(urls): { kept, dropped }`。
- Produces: 行为变化——`run` 现在会在系统日志多输出一行「已过滤 N 条…」（仅 dropped > 0 时）；候选池由 `kept` 构建。无新增导出。

- [ ] **Step 1: 增补失败测试**

打开 `tests/useSubmitOrchestrator.test.tsx`，在现有 `describe('useSubmitOrchestrator（sitemap 流程）', () => { ... })` 块**内部**、最后一个 `it` 之后追加三个用例（`});` 之前）：

```ts
  it('低价值链接被剔出候选池且系统日志回显数量', async () => {
    fetchSitemap.mockResolvedValue({
      urls: [
        'https://example.com/login',
        'https://example.com/privacy-policy',
        'https://example.com/blog/post-1',
      ],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    // 候选池只剩 blog/post-1
    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://example.com/blog/post-1']);
    // 系统日志含「已过滤 2 条」
    expect(result.current.logs.some((l) => /已过滤 2 条低价值链接/.test(l.message))).toBe(true);
  });

  it('mergeDiscovered 收到全量（低价值项未被提前丢弃）', async () => {
    fetchSitemap.mockResolvedValue({
      urls: ['https://example.com/login', 'https://example.com/blog/post-1'],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    const { getDiscovered } = await import('../lib/storage/discovered');
    const d = await getDiscovered('example.com');
    expect(d?.urls).toEqual(['https://example.com/login', 'https://example.com/blog/post-1']);
  });

  it('dropped 为 0 时不输出过滤日志', async () => {
    fetchSitemap.mockResolvedValue({
      urls: ['https://example.com/a', 'https://example.com/b'],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(result.current.logs.some((l) => /已过滤/.test(l.message))).toBe(false);
  });
```

- [ ] **Step 2: 运行测试，确认前两条失败**

Run: `npx vitest run tests/useSubmitOrchestrator.test.tsx`
Expected: 前两条 FAIL（候选池仍含 `/login`、日志无「已过滤」）；第三条 PASS（当前本就无日志）。

- [ ] **Step 3: 改 `useSubmitOrchestrator.ts` —— 加 import**

在 `import { pickRandom } from '@lib/submit/pick';` 下一行新增：

```ts
import { partitionLowValue } from '@lib/submit/filter';
```

- [ ] **Step 4: 改 `useSubmitOrchestrator.ts` —— `run` 第 ②/③ 步**

定位现有代码（约第 54-63 行）：

```ts
      // ② 增量合并入库
      const discovered = await mergeDiscovered(domain, sitemapUrl, fetched.urls);

      // ③ 候选池：对所有勾选平台都未 ok 的 URL（批量 ok-set，避免逐条查）
      const selected: Platform[] = [];
      if (platforms.gsc) selected.push('gsc');
      if (platforms.bing) selected.push('bing');
      const subs = await getSubmissions(domain);
      const okSet = new Set(subs.filter((r) => r.status === 'ok').map((r) => `${r.platform}|${r.url}`));
      const pool = discovered.urls.filter((u) => selected.every((p) => !okSet.has(`${p}|${u}`)));
```

整段替换为：

```ts
      // ② 增量合并入库（全量，含低价值链接 —— 库仍保全量）
      const discovered = await mergeDiscovered(domain, sitemapUrl, fetched.urls);

      // ②.5 低价值过滤：账号/法务/用户中心类不进候选池（discovered 库仍保全量）
      const { kept, dropped } = partitionLowValue(discovered.urls);
      if (dropped.length > 0) {
        pushLog('info', 'system', `已过滤 ${dropped.length} 条低价值链接（登录/注册/隐私/条款/账号等）`);
      }

      // ③ 候选池：kept 中对所有勾选平台都未 ok 的 URL（批量 ok-set，避免逐条查）
      const selected: Platform[] = [];
      if (platforms.gsc) selected.push('gsc');
      if (platforms.bing) selected.push('bing');
      const subs = await getSubmissions(domain);
      const okSet = new Set(subs.filter((r) => r.status === 'ok').map((r) => `${r.platform}|${r.url}`));
      const pool = kept.filter((u) => selected.every((p) => !okSet.has(`${p}|${u}`)));
```

> 关键差异：① 注释强化「全量」语义；② 中间插入 `②.5` 过滤 + 条件日志；③ `discovered.urls.filter` 改为 `kept.filter`。`mergeDiscovered` 调用**完全不动**，保证全量入库。

- [ ] **Step 5: 运行测试，确认全部通过**

Run: `npx vitest run tests/useSubmitOrchestrator.test.tsx`
Expected: 全部 PASS（含原有 6 条 + 新增 3 条）。

如「mergeDiscovered 收到全量」用例失败：检查 `mergeDiscovered` 是否被误改为接收 `kept`——必须仍是 `fetched.urls`。

- [ ] **Step 6: 全量回归 + 类型检查**

Run: `pnpm test && pnpm compile`
Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts tests/useSubmitOrchestrator.test.tsx
git commit -m "feat(submit): 候选池接入低价值过滤与系统日志回显

mergeDiscovered 后对 discovered.urls 调 partitionLowValue，kept 进候选池、
dropped.length>0 时推一条「已过滤 N 条」日志；入库仍为全量。"
```

---

## Task 3: `SubmitPanel` 常驻过滤说明

**Files:**
- Modify: `entrypoints/sidepanel/pages/SubmitPanel.tsx`（sitemap `TextInput` 下方一行）
- Test: `tests/submitpanel.test.tsx`（增补一条用例）

**Interfaces:**
- Consumes: 无（纯 UI 改动；不依赖 Task 1/2 的运行时数据，仅展示静态文案）。
- Produces: 面板多渲染一行 11px 灰字说明，submit / progress 两个 tab 下均可见。

- [ ] **Step 1: 增补失败测试**

打开 `tests/submitpanel.test.tsx`，在 `describe('SubmitPanel', () => { ... })` 内部追加：

```ts
  it('渲染低价值过滤常驻说明', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    expect(screen.getByText(/将自动过滤登录.*低价值链接/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run tests/submitpanel.test.tsx`
Expected: 新用例 FAIL —— `Unable to find an element with text: /将自动过滤登录.*低价值链接/`。

- [ ] **Step 3: 改 `SubmitPanel.tsx` —— 加常驻说明**

定位现有代码（约第 60-61 行）：

```tsx
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>站点地图（sitemap.xml）</label>
      <TextInput value={sitemapUrl} placeholder="https://example.com/sitemap.xml" onChange={(e) => { dirtyRef.current = true; setSitemapUrl(e.target.value); }} />
```

在 `<TextInput ... />` 之后（即该行之后、`{tab === 'submit' && (` 之前）插入：

```tsx
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
        将自动过滤登录 / 注册 / 隐私 / 条款 / 账号等低价值链接，不参与提交。
      </div>
```

> 位置在 tab 切换按钮组之外（sitemap 输入框正下方），所以「提交」与「查询进度」两个 tab 下都常驻可见，符合「事前告知」语义。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run tests/submitpanel.test.tsx`
Expected: 全部 PASS（含原有 8 条 + 新增 1 条）。

- [ ] **Step 5: 全量回归 + 类型检查**

Run: `pnpm test && pnpm compile`
Expected: 全部通过。

- [ ] **Step 6: Commit**

```bash
git add entrypoints/sidepanel/pages/SubmitPanel.tsx tests/submitpanel.test.tsx
git commit -m "feat(submit): sitemap 输入框下方常驻低价值过滤说明

事前告知用户登录/注册/隐私/条款/账号等链接不参与提交。"
```

---

## 完成标准

全部三个任务完成后：

1. `pnpm test` 全绿（原有用例 + 新增 ~25 条 filter 用例 + 3 条 orchestrator + 1 条 panel）。
2. `pnpm compile` 无类型错误。
3. 三个独立 commit，按 Task 1 → 2 → 3 顺序。
4. `lib/sitemap/*`、`lib/storage/*`、`entrypoints/background.ts`、`wxt.config.ts` 零改动（`git diff main` 验证）。
