# GSC/Bing 执行日志精度增强

## 背景

GSC / Bing 批量提交的日志链路为：`flow.ts (onLog)` → `background.ts emit(port, *_LOG)` → port → `useGscRunner/useBingRunner setLogs` → `LogPanel` 渲染 `[{phase}] message`。

当前日志只在批次级与每条 URL 开始处可见：打开页面、前置失败（项目不存在 / 加载超时 / 未登录 / 无权限）、`[i/N] url`、配额熔断；Bing 额外有每条结果 `→ reason`（`lib/bing/flow.ts:175`），**GSC 缺失**。

核心 debug 痛点：

1. **`submitOne` 内部是黑盒**：单条 URL 的步骤机（GSC 8 步 / Bing 11 步）全程无日志。卡在某步——尤其 GSC 等成功 toast 最长 180s、Bing 等「Indexing requested」60s——时只看到最终 reason，无法判断卡在哪一步、已等多久。
2. **超时静默**：`waitForPredicate` 超时仅返回 `false`（`lib/cdp/actions.ts:35`），且 GSC ①③ 两处不检查返回值（`lib/gsc/flow.ts:69/88`），超时会静默滑入下一步，给出意料外的分类结果。
3. **异常信息单薄**：`runBatch` 的 `catch` 只取 `(e as Error).message`，无步骤上下文；`LogPanel` 无时间戳 / 筛选 / 详情展开。

## 目标

让单条 URL 的执行全程可观测：每个关键步骤「进入 / 完成 / 超时(步骤名+耗时)」均产出日志；`waitForPredicate` 超时不再静默；UI 支持时间戳、按 level 筛选、错误详情展开。**不改消息协议**。

## 关键决策（已与用户确认）

- **范围**：深埋点 + UI 增强。
- **方向**：方案 A——执行端深埋点 + 轻量 `waitForStep` helper 收敛超时日志 + UI 增强，不改协议。`waitForStep` 即 stepLogger 的轻量形态，不过度抽象；日后想要 GSC/Bing 完全统一格式可无痛升级。
- **不做**（YAGNI / 超出范围）：统一 logger 模块、协议字段结构化、background SW console 双写、日志导出。

## 详细设计

### §1 埋点节点（phase 沿用现有 `system` / `inspect` / `submit`）

**GSC `submitOne`**（当前 8 步全黑盒 → 逐步可见）：

| 步骤 | 进入 | 完成 / 超时 | level | phase |
|---|---|---|---|---|
| ① 等输入框 | `等输入框就绪…` | `✓ (1.2s)` / `超时 (30s)` | info / warn | inspect |
| ② native setter 填值 + 回车 | — | `已填值并回车` | info | inspect |
| ③ 等检查结果信号 | `等检查结果…` | `✓` / `超时 (30s)` | info / warn | inspect |
| ④ 读按钮 aria-disabled | — | `按钮 aria-disabled=false` | info | inspect |
| ⑥ 页面内 `el.click()` | — | `点击「请求编入索引」` | info | submit |
| ⑦ 轮询成功 toast | `等成功提示（最长180s）…` | `✓ (95s)` / `超时 (180s)` | info / warn | submit |

⑤ 分类（已索引 / 不属于 / 配额 / 无按钮 / 按钮禁用）与 ⑧ 清空输入框：归入 `runBatch` 的结果日志（⑤）或 best-effort 静默（⑧）。

**Bing `submitOne`**：与 GSC 同构，按其 11 步换名：`点击 Inspect`（inspect）、`等结果区…`（inspect）、`点击「Request indexing」`（submit）、`等确认弹窗…`（submit）、`点击 Submit`（submit）、`等 Indexing requested（60s）…`（submit）。失败诊断计数（`dialog=/submit=/deep=`）并入对应超时 / 未找到的 message。

**`runBatch`**：
- GSC **补齐**每条结果日志，对齐 Bing：`→ 已提交`（info）/ `→ 已索引`（info）/ `→ 配额 / 不属于此域名 / 无请求编入索引按钮 / 按钮禁用 / 提交未确认`（warn），phase = `submit`。
- GSC / Bing 的 `catch` 分支补一条 `error` 日志：`步骤异常: <msg>`（phase = `submit`）。

### §2 `waitForStep` helper（`lib/cdp/actions.ts`，新增）

收敛所有「等某信号」步骤，自动产出进入 / 完成 / 超时日志并测耗时；**内部仍调用 `waitForPredicate`**（现有测试 mock 的是 `cdp.waitForPredicate`，断言 `toHaveBeenCalledWith(...)` 不受影响）。

```ts
export type StepLog = (e: { level: 'info' | 'warn' | 'error'; phase: string; message: string }) => void;

export async function waitForStep(
  target: Target,
  jsPredicate: string,
  opts: { name: string; timeoutMs?: number; intervalMs?: number; phase?: string; log?: StepLog },
): Promise<boolean> {
  const phase = opts.phase ?? 'submit';
  opts.log?.({ level: 'info', phase, message: `${opts.name}…` });
  const start = Date.now();
  const ok = await waitForPredicate(target, jsPredicate, {
    timeoutMs: opts.timeoutMs,
    intervalMs: opts.intervalMs,
  });
  const ms = Date.now() - start;
  opts.log?.({
    level: ok ? 'info' : 'warn',
    phase,
    message: `${opts.name} ${ok ? '✓' : '超时'} (${fmtMs(ms)})`,
  });
  return ok;
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
```

**顺带修隐患**：GSC ①③ 改用 `waitForStep` 后强制检查返回值 → 超时即返回 `skipped`（reason `输入框未就绪` / `检查结果未出现`），不再静默滑入分类逻辑。

### §3 `submitOne` 签名

`submitOne(target, url)` → `submitOne(target, url, log?: StepLog)`；`runBatch` 把 `cb.onLog` 透传进去。**`log` 可选 → 现有 `tests/bing-flow.test.ts` 中 `submitOne({tabId:1}, url)` 调用零改动**；内部所有埋点用 `log?.()` 防御。

### §4 UI 增强（`components/LogPanel.tsx` + `useGscRunner` / `useBingRunner`）

- `LogEntry` 增加 `ts: number`，**接收端**（`useRunner` 的 `onMessage`）用 `Date.now()` 打点。SW 与 UI 同机本地时钟，一致；无需改协议。
- 每行渲染：`[HH:mm:ss] [phase] message`。
- 顶部筛选 chips：`全部 / info / warn / error`（`LogPanel` 内部 `useState`，自包含，不污染 `GscTool` / `BingTool`）。
- `warn` / `error` 行默认 `line-clamp:2`，点击展开全文（诊断 reason 不被截断）。
- 新日志自动滚动到底（`useEffect` 依赖 `logs.length`，底部 ref `scrollIntoView`）。
- 面板 `maxHeight` 160 → 约 260，debug 时可见更多行。

### §5 background 轻量补点（`entrypoints/background.ts`）

在 `打开 GSC/Bing…` 之后、`runBatch` 之前补两条 `info`（phase = `system`）：
- SPA 就绪后：`页面就绪 ✓ (Xs)`。
- 登录 / 权限前置检查通过后：`登录态正常`。

让加载与登录阶段也可追溯。

### §6 协议不变

`GscLog` / `BingLog` 字段（`level` / `phase` / `message`）不变：耗时塞 message 文本，时间戳 UI 本地打。`lib/messaging/types.ts` 与 `tests/bing-messaging.test.ts` 零影响。

## 测试策略

- **现有 `tests/bing-flow.test.ts` 零破坏**：`log` 可选、`waitForStep` 内部调用 `waitForPredicate`，故 `expect(cdp.waitForPredicate).toHaveBeenCalledWith(...)` 断言（⑧ 确认弹窗 30s、成功提示 60s/3s）依旧成立。
- **新增断言**（并入 `bing-flow.test.ts`）：ok 路径下 `onLog` 被调用且调用记录中同时存在 `phase: 'inspect'` 与 `phase: 'submit'`；超时路径产出 `level: 'warn'` 的超时日志。
- **建议新建 `tests/gsc-flow.test.ts`**：本次 GSC 改动含超时隐患修复（①③），值得覆盖 ok / 已索引 / 输入框超时 / 检查结果超时 / 成功提示超时 等路径。可选项，不阻塞。

## 改动文件清单

| 文件 | 改动 |
|---|---|
| `lib/cdp/actions.ts` | 新增 `waitForStep` / `fmtMs` / `StepLog` 类型 |
| `lib/gsc/flow.ts` | `submitOne` 加 `log` 参数 + 逐步埋点 + `waitForStep` + 修 ①③ 超时隐患；`runBatch` 补结果日志 / 透传 `onLog` / `catch` 补 error |
| `lib/bing/flow.ts` | `submitOne` 加 `log` 参数 + 逐步埋点 + `waitForStep`；`runBatch` 透传 `onLog` / `catch` 补 error |
| `entrypoints/sidepanel/components/LogPanel.tsx` | 时间戳 + level 筛选 + 自动滚动 + warn/error 展开 + 加高 |
| `entrypoints/sidepanel/hooks/useGscRunner.ts`、`useBingRunner.ts` | `LogEntry` 加 `ts`，接收时 `Date.now()` |
| `entrypoints/background.ts` | 补 `页面就绪 ✓` / `登录态正常` info |
| `tests/bing-flow.test.ts`（+ 建议 `tests/gsc-flow.test.ts`） | 新增埋点 / 超时断言 |

## 验证

- `pnpm test`（vitest）全绿，含新增断言；现有 bing-flow / bing-messaging / bing-url 用例不回归。
- `wxt build` + `tsc` 类型检查通过。
- 手测：GSC / Bing 各跑一条 URL，LogPanel 能看到每步 `[时间] [phase] …`、超时步骤出现 `超时 (Xs)` warn、筛选与展开可用。
