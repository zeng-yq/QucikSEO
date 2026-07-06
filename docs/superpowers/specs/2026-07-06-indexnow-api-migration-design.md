# Bing 提交链路从 CDP 迁移到 IndexNow API

- 日期:2026-07-06
- 状态:已通过设计评审,待编写实现计划
- 作者:zengyq
- 一手依据:[IndexNow 官方文档](https://www.indexnow.org/documentation)、[Bing IndexNow Get Started](https://www.bing.com/indexnow/getstarted#implementation)（VERIFIED 2026-07-06）

## 1. 背景与目标

当前「网站提交」面板里的 Bing 提交,走的是 **CDP 驱动 Bing Webmaster Tools 页面**的链路:`useBingRunner` → background `handleBingStart` → 开后台 tab → `chrome.debugger.attach` → 等 Bing SPA 就绪 → 检查登录态 → `bingRunBatch` 逐条用 `evalJs` 操控页面 DOM（填输入框 → 点 Inspect → 等结果 → 点 Request indexing → 等确认弹窗 → 点 Submit → 轮询成功提示）→ detach。

这条链路的问题:① 极其脆弱（依赖十几个 `data-tag` 选择器与页面文案,页面改版即坏）；② 慢（每条 URL 要走完整页面交互,约 10–30s）；③ 需要用户已登录 Bing Webmaster；④ 有每日配额,耗尽后连续失败要熔断。

Bing 同时是 [IndexNow](https://www.indexnow.org) 协议的联合发起方。IndexNow 提供一个简单的 HTTP API:一个 POST 即可把整批 URL 通知给所有参与搜索引擎（Bing、Yandex、Naver、Seznam、Yep）。本次把 Bing 提交链路从 CDP 整体替换为 IndexNow API。

### 目标

- 删除 Bing 的 CDP 提交链路（`lib/bing/flow.ts`、`lib/bing/selectors.ts`、`lib/bing/url.ts` 及 background 中对应编排）。
- 新增一个轻量的 `lib/indexnow/submit.ts`,由 background service worker 直接 `fetch` POST 到 IndexNow。
- 全局 IndexNow 密钥由插件自动生成、可在提交面板内下载密钥文件、可刷新。
- 保持消息协议（`BING_*` 事件）字段结构不变,UI 侧 `useBingRunner` 接口零改动。
- GSC 提交链路保持 CDP 不变（未来单独迁移到 API,不在本次范围）。

### 非目标(YAGNI)

- ❌ 改动 GSC 提交链路（用户明确:本次只改 Bing,GSC 暂保持 CDP）。
- ❌ 引入 'failed' 提交状态（`SubmitRecord.status` 仍为 `'ok' | 'skipped'`,失败复用 skipped + reason,契合现有「skipped 可重试」去重语义）。
- ❌ 每域名独立密钥（用户选择全局单密钥；前提是用户在每个站点根目录都放同一份 `<key>.txt`）。
- ❌ 独立「设置」tab（密钥配置区常驻在提交面板内）。
- ❌ 提交前主动 GET 校验 `<key>.txt` 可达性（依赖 IndexNow 的 403 返回码引导,避免增加请求与 CORS 误判复杂度）。
- ❌ 密钥配置区折叠/收起（用户选择常驻显示）。

## 2. IndexNow API 规格(一手依据)

来源:`indexnow.org/documentation` + `bing.com/indexnow/getstarted`（2026-07-06 curl 获取）。

- **参与搜索引擎**:Microsoft Bing、Naver、Seznam.cz、Yandex、Yep。
- **共享机制**(关键):「Search engines adopting the IndexNow protocol agree that submitted URLs will be automatically shared with all other participating search engines.」—— 即无论 POST 到通用 endpoint 还是某引擎专属 endpoint,URL 都会共享给所有参与引擎。
- **Endpoint**:`https://api.indexnow.org/IndexNow`（官方中立,本次采用）。
- **批量提交**:
  ```
  POST /IndexNow HTTP/1.1
  Content-Type: application/json; charset=utf-8
  Host: api.indexnow.org

  { "host": "www.example.org", "key": "<key>", "urlList": [ "https://..." ] }
  ```
- **密钥规则**:长度 8–128,仅含 `a-zA-Z0-9-`,至少一个字母或数字；需在站点根目录托管 `https://<host>/<key>.txt`,文件内容就是 key 本身。不传 `keyLocation` 时搜索引擎自动到根目录找 `<key>.txt`。
- **响应码**:`200` 成功 / `400` 格式错 / `403` key 无效(文件缺失或内容不匹配) / `422` URL 不属于该 host 或 key 不符合协议 / `429` 频率过高。

## 3. 调用链对比

```
【旧 · CDP】
UI(BING_START) → background: tabs.create → debugger.attach
  → 等 SPA → 检查登录 → bingRunBatch(逐条 evalJs 操控 DOM + 配额熔断) → detach → BING_DONE

【新 · API】
UI(BING_START) → background: 读 settings.indexnowKey 并校验
  → 按 host 分组 → 逐组 fetch POST api.indexnow.org/IndexNow
  → 按状态码映射单条结果 → BING_STATE(done=total) → BING_DONE
```

核心简化:删除 `lib/bing/flow.ts`(340 行 CDP 操控)、`lib/bing/selectors.ts`(脆弱 DOM 探测)、`lib/bing/url.ts`、background 的 CDP 编排段、配额熔断、登录态检查。新增 `lib/indexnow/submit.ts`(约 50 行,一个 fetch 函数)。

## 4. 数据模型与密钥管理

### 4.1 存储扩展(`lib/storage/settings.ts`)

`Settings` 接口加一个可选字段,复用现有 `getSettings/updateSettings`(已是 Partial 合并语义):

```ts
export interface Settings {
  accountIndex: number;
  indexnowKey?: string;   // 新增:IndexNow 全局密钥
}

const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;  // IndexNow 协议要求

export function isValidIndexNowKey(k: string): boolean {
  return KEY_PATTERN.test(k);
}

/** 生成符合 IndexNow 协议的随机 key(16 字节 → 32 位 hex)。 */
export function generateIndexNowKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
```

- 32 位 hex(`0-9a-f`)落在协议 8–128 区间,且全是字母数字,天然满足「至少一个字母或数字」。
- 生成在 sidepanel(React)层调用 `crypto.getRandomValues`,落库经 `updateSettings({ indexnowKey })`。background 不负责生成。

### 4.2 密钥文件下载(sidepanel 层)

MV3 service worker 无「下载到磁盘」UI 能力,下载逻辑放 React 组件,用 Blob + `<a download>` 触发浏览器原生下载:

```ts
function downloadKeyFile(key: string) {
  const blob = new Blob([key], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key}.txt`;   // 文件名 = <key>.txt
  a.click();
  URL.revokeObjectURL(url);
}
```

文件名 `<key>.txt`,内容为 key 字符串本身——正是协议对根目录验证文件的要求。

## 5. 提交流程

### 5.1 新增 `lib/indexnow/submit.ts`

```ts
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

export interface IndexNowResult {
  ok: boolean;
  status: number;
  reason?: string;
}

/** 按 IndexNow 协议整批提交。key 合法性由调用方负责。 */
export async function submitUrls(key: string, host: string, urls: string[]): Promise<IndexNowResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, urlList: urls }),
  });
  if (res.status === 200) return { ok: true, status: 200 };
  return { ok: false, status: res.status, reason: reasonFor(res.status) };
}

function reasonFor(s: number): string {
  switch (s) {
    case 400: return '请求格式错误';
    case 403: return '密钥无效:站点根目录未找到 <key>.txt,或文件内容与密钥不匹配';
    case 422: return 'URL 不属于该域名,或域名与密钥不匹配';
    case 429: return '提交过于频繁,请稍后再试';
    default: return `IndexNow 返回 ${s}`;
  }
}
```

不传 `keyLocation`:协议规定引擎自动找 `https://<host>/<key>.txt`。

### 5.2 host 边界与分组

IndexNow 要求 `body.host` 与 `urlList` 每条 URL 的 host 完全一致,否则 `422`。sitemap 可能混 `www` / 裸域名,故:

- **host 不取 `project.domain`,从 urlList 推导**。
- **按 hostname 分组提交**:把本批 URL 按 `new URL(u).hostname` 分组,每组一个 POST,结果合并回原顺序。避免个别 URL 跨 host 导致整批 422。

```ts
function groupByHost(urls: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const u of urls) {
    let h: string;
    try { h = new URL(u).hostname; } catch { continue; }  // 非法 URL 跳过
    if (!m.has(h)) m.set(h, []);
    m.get(h)!.push(u);
  }
  return m;
}
```

### 5.3 background `handleBingStart` 重写

删掉 CDP 编排(tabs.create / attach / waitForPredicate / 登录检查 / bingRunBatch / detach),替换为:

```ts
async function handleBingStart(port, msg: { domain: string; urls: string[] }, shouldStop: () => boolean): Promise<void> {
  const { indexnowKey } = await getSettings();
  if (!isValidIndexNowKey(indexnowKey ?? '')) {
    emit(port, { type: 'BING_LOG', level: 'error', phase: 'system',
      message: '未配置有效的 IndexNow 密钥,请在下方生成' });
    emit(port, { type: 'BING_DONE', ok: 0, failed: 0, skipped: msg.urls.length });
    return;
  }
  if (shouldStop()) return;

  emit(port, { type: 'BING_STATE', state: 'running',
    total: msg.urls.length, done: 0, results: [] });
  emit(port, { type: 'BING_LOG', level: 'info', phase: 'system',
    message: `提交 ${msg.urls.length} 条到 IndexNow…` });

  // 初始化全部为 skipped(未执行),成功者覆盖为 ok
  const results: SubmitResult[] = msg.urls.map((u) => ({ url: u, status: 'skipped', reason: '未执行' }));

  for (const [host, urls] of groupByHost(msg.urls)) {
    if (shouldStop()) break;
    let r: IndexNowResult;
    try {
      r = await submitUrls(indexnowKey!, host, urls);
    } catch (e) {
      r = { ok: false, status: 0, reason: `网络错误:${(e as Error).message ?? String(e)}` };
    }
    for (const u of urls) {
      const row = results.find((x) => x.url === u)!;
      if (r.ok) { row.status = 'ok'; row.reason = undefined; }
      else { row.reason = r.reason; }
    }
    emit(port, { type: 'BING_LOG', level: r.ok ? 'info' : 'error', phase: 'submit',
      message: r.ok ? `→ ${host}: 已提交 ${urls.length} 条` : `→ ${host}: ${r.reason}` });
  }

  emit(port, { type: 'BING_STATE', state: 'running',
    total: msg.urls.length, done: msg.urls.length, results });
  const ok = results.filter((r) => r.status === 'ok').length;
  emit(port, { type: 'BING_DONE', ok, failed: 0, skipped: msg.urls.length - ok });
}
```

**保留的 background import**:`attach/detach/evalJs/waitForPredicate` 仍由 GSC 的 `handleStart` 使用,不从 background 删除这些导入,只删 Bing 专属的 `bingRunBatch / buildBingUrl / BING_PROBES` 导入。

**消息协议不变**:`BING_START {domain,urls}` / `BING_CANCEL` / `BING_STATE {state,total,done,currentUrl?,results}` / `BING_LOG` / `BING_DONE {ok,failed,skipped}` 字段结构保持。`currentUrl` 不再推送(整批无单条概念),其字段可选,合法。

### 5.4 进度语义变化

`done` 从逐条递增(0→1→…→10)变成一次性跳变(0→10)。POST 通常 1–3s,`RunningOverlay` 短暂显示 `0/10` 后跳 `10/10`,可接受,不改 `RunningOverlay`/`SubmitBar`。日志「提交 N 条到 IndexNow… → 已提交 N 条」承载过程信息。

## 6. UI 改动

### 6.1 新增组件 `entrypoints/sidepanel/components/IndexNowKeySection.tsx`(常驻,约 60 行)

放在 `SubmitPanel` 主体内,sitemap 输入之后、报告区之前:

```
站点地图（sitemap.xml）
[ https://example.com/sitemap.xml ]

┌─ IndexNow 密钥(提交到 Bing/Yandex 等搜索引擎)──────────┐
│  [ a1b2c3d4e5f6...            ]   ← readonly TextInput   │
│  [生成密钥]  [下载密钥文件]  [刷新]                       │
│  请将 <key>.txt 上传到你【每个】站点的根目录:             │
│  https://<你的域名>/<key>.txt                              │
└──────────────────────────────────────────────────────────┘

[ 报告区 / 进度仪表盘 / 提交栏 ]
```

- 未配置:readonly 输入框占位 `未生成`,只显示 `[生成密钥]`。
- 已配置:输入框显示完整 key(mono 字体,readonly),下方 `[下载密钥文件]` `[刷新]`。
- `[刷新]`:`window.confirm('刷新会覆盖当前密钥,旧密钥文件立即作废,所有站点需重新上传。确认?')` 通过后才重新生成。

### 6.2 新增 hook `entrypoints/sidepanel/hooks/useIndexNowKey.ts`

```ts
export function useIndexNowKey() {
  const [key, setKey] = useState<string | undefined>();
  // 初次:getSettings().then(s => setKey(s.indexnowKey))
  // 跨视图同步:监听 chrome.storage.onChanged('settings'),与 useProjects 同范式

  const generate = useCallback(() => {
    const k = generateIndexNowKey();
    void updateSettings({ indexnowKey: k });   // onChanged 会回写 setKey
  }, []);
  const refresh = useCallback(() => {
    if (!window.confirm('刷新会覆盖当前密钥,旧密钥文件立即作废,所有站点需重新上传。确认?')) return;
    generate();
  }, [generate]);
  const download = useCallback(() => { if (key) downloadKeyFile(key); }, [key]);

  return { key, generate, refresh, download };
}
```

跨视图同步复用 `chrome.storage.onChanged`(与 `useProjects` 同范式)。

### 6.3 `SubmitPanel.tsx` 改动

- sitemap 输入与报告区之间插入 `<IndexNowKeySection />`。
- Bing 勾选框可用性不改:未配 key 时仍可勾选,提交时 background 推 error 日志引导,密钥配置区就在上方一目了然。
- 不改 `SubmitBar`、`RunningOverlay`、`useBingRunner`、`useSubmitOrchestrator`。

## 7. 错误处理矩阵

| 场景 | 处理 |
|------|------|
| 未配 key / key 格式非法 | background 推 error 日志「未配置有效密钥」+ `BING_DONE(ok:0, skipped:N)` |
| `fetch` 抛错(断网/DNS) | catch → 该组 URL 记 skipped + reason「网络错误:{msg}」 |
| 403(key 文件缺失/不匹配) | skipped + reason「密钥无效:…」 |
| 422(跨 host / key 不匹配) | skipped + reason「URL 不属于该域名…」 |
| 429(频率限制) | skipped + reason「提交过于频繁」 |
| 400(格式错) | skipped + reason「请求格式错误」 |
| 空 urlList | `useSubmitOrchestrator` 已在上游保证 picked 非空(空批次直接 return),不进入 background |

整批失败时所有 URL 记 skipped + reason;因 `isSubmittedOk` 只看 `status==='ok'`,skipped 不进黑名单,下次可重试。

## 8. 测试策略

### 删除

- `tests/bing-flow.test.ts`(测 CDP flow,已不存在)。
- `tests/bing-url.test.ts`(测 `buildBingUrl`,已删除)。

### 保留(不动)

- `tests/cdp-actions.test.ts`:测 `waitForStep/fmtMs`,GSC 仍用。
- `tests/bing-messaging.test.ts`:测消息协议字段结构,协议不变。`currentUrl` 字段可选,不推送也合法。
- `tests/cdp.test.ts`:测 CDP client,GSC 仍用。

### 新增

**`tests/indexnow-submit.test.ts`**(vitest mock `globalThis.fetch`):
- 验证请求:method `POST`、URL `https://api.indexnow.org/IndexNow`、body `{host,key,urlList}`、header `Content-Type: application/json`。
- `200 → {ok:true}`。
- `400/403/422/429 → {ok:false, reason 对应文案}`。
- 其它状态码(如 `500`)→ reason `IndexNow 返回 500`。
- `fetch` reject → 抛错(background 层 catch 兜底,submit.ts 自身透传抛出)。

**`tests/indexnow-key.test.ts`**:
- `generateIndexNowKey()` 输出匹配 `/^[a-zA-Z0-9-]{8,128}$/`。
- 两次调用结果不同(随机性)。
- `isValidIndexNowKey`:合法 key 返回 true,过短/非法字符返回 false。

## 9. 文件改动清单

### 新增

| 文件 | 说明 |
|------|------|
| `lib/indexnow/submit.ts` | `submitUrls` + `groupByHost` + `reasonFor` |
| `entrypoints/sidepanel/components/IndexNowKeySection.tsx` | 密钥配置区(readonly 输入 + 生成/下载/刷新) |
| `entrypoints/sidepanel/hooks/useIndexNowKey.ts` | key 状态 + 生成/刷新/下载 |
| `tests/indexnow-submit.test.ts` | submitUrls 单测 |
| `tests/indexnow-key.test.ts` | 密钥生成/校验单测 |

### 修改

| 文件 | 改动 |
|------|------|
| `lib/storage/settings.ts` | `Settings` 加 `indexnowKey?`;新增 `isValidIndexNowKey` / `generateIndexNowKey` |
| `entrypoints/background.ts` | 重写 `handleBingStart`(删 CDP 编排,换 IndexNow fetch);删 Bing CDP 专属 import(`bingRunBatch/buildBingUrl/BING_PROBES`),保留 GSC CDP import |
| `entrypoints/sidepanel/pages/SubmitPanel.tsx` | 插入 `<IndexNowKeySection />` |

### 删除

| 文件 | 原因 |
|------|------|
| `lib/bing/flow.ts` | CDP 逐条 DOM 操控,被 fetch 取代 |
| `lib/bing/selectors.ts` | Bing 页面 DOM 探测,不再需要 |
| `lib/bing/url.ts` | 拼 URL Inspection 页面 URL,不再开 tab |
| `tests/bing-flow.test.ts` | 测 CDP flow |
| `tests/bing-url.test.ts` | 测已删的 `buildBingUrl` |

### 不动

`lib/messaging/protocol.ts`、`lib/messaging/types.ts`、`lib/cdp/*`、`entrypoints/sidepanel/hooks/useBingRunner.ts`、`useSubmitOrchestrator.ts`、`RunningOverlay.tsx`、`SubmitBar.tsx`、`lib/storage/submissions.ts`、`wxt.config.ts`(host_permissions 已有 `<all_urls>`,manifest 无需改)。

## 10. 风险与已知边界

- **全局密钥的多站点前提**:用户须在每个要提交的站点根目录都放同一份 `<key>.txt`。UI 文案明确点出此约束。若某站未放,该站 URL 会收到 403,reason 引导用户上传。
- **sitemap 混 host**:按 hostname 分组提交,每组独立结果,避免整批 422。
- **MV3 service worker 生命周期**:IndexNow 单次 POST 通常 1–3s,远短于 SW keepalive 阈值,无 CDP 时代的 SW 回收风险。
- **CORS**:`api.indexnow.org` 跨域;MV3 service worker 的 `fetch` 在 host_permissions(`<all_urls>`)覆盖下不受页面 CORS 限制,可正常调用。
- **无单条索引状态**:IndexNow 只返回整批 HTTP 状态码,不告知单条是否已索引。原本 CDP 时代的「已索引跳过」语义消失——IndexNow 提交即记 ok(已通知),不区分是否已被索引。这是协议本质,可接受。
- **`failed` 字段名存实亡**:`BING_DONE.failed` 恒为 0(与现有 GSC runBatch 一致,该字段当前在 UI 侧 `useBingRunner` 不被消费,仅 `BING_STATE.results` 驱动落库与报告)。
