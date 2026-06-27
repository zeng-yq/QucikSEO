/**
 * GSC（Google Search Console）页面探测表达式。
 *
 * ⚠️ 来源：docs/superpowers/notes/gsc-probe.md §2（VERIFIED 2026-06-28）。
 * 已对照真实 GSC DOM 验证，**不要**改用通用/猜测正则。
 *
 * 设计原则：
 * - Google 的 class 名是动态 hash，**切勿依赖 class**。下面所有表达式都用
 *   `aria-label` / `role` / 可见文本匹配，且对中英文双语兼容。
 * - 每个字段是一段**在页面执行的 JS 表达式**（文本优先匹配），返回元素或 boolean。
 * - Task 12 的 flow 负责轮询、点击、fill/reset 操作；本文件只提供**检测/判定**表达式。
 */
export const PROBES = {
  /**
   * 顶部「检查网址」输入框。
   * 真实 aria-label（中文账号）：`检查 bottleneck-checker.com 中的任何网址`
   * （英文账号应为 `Inspect any URL in bottleneck-checker.com`）。
   * placeholder 为空字符串，故按 aria-label 匹配最稳。
   */
  inspectInput:
    `[...document.querySelectorAll('input')].find(i => ` +
    `/检查.*任何网址|inspect any/i.test(i.getAttribute('aria-label') || '')` +
    `)`,

  /**
   * 「请求编入索引」按钮。
   * ⚠️ 元素类型是 **`DIV[role=button]`**（不是 `<button>`！）→ selector 必须含 `[role=button]`。
   * 按钮整体文本为「请求编入索引再次提交请求」，需用正则子串匹配。
   * DIV 没有 `disabled` 属性，启用状态由 `aria-disabled="false"` 表征。
   */
  requestIndexingButton:
    `[...document.querySelectorAll('[role=button]')].find(b => ` +
    `/请求编入索引|request indexing/i.test((b.textContent || '').trim())` +
    `)`,

  /**
   * URL 已被编入索引。
   * 注意反向排除：测试 URL 处于「未编入索引」状态时文案为「网址尚未收录到 Google」，
   * 需排除该文案以避免误判。
   * Task 12 应同时满足「正向文案命中 且 按钮不存在」再判 isAlreadyIndexed。
   */
  isAlreadyIndexed:
    `/此网页已编入索引|网址已被.*收录|URL is on Google|已编入索引/i.test(document.body.innerText)` +
    ` && !document.body.innerText.includes('网址尚未收录到 Google')`,

  /**
   * 配额耗尽提示。⚠️ 未触发，保留推断兜底。
   * 若 successIndicator 未出现且匹配到此类文案，判 isQuota。
   */
  isQuota:
    `/已达.*上限|配额|quota|try again later|稍后.*再试|无法.*更多/i.test(document.body.innerText)`,

  /**
   * 当前账号无该资源权限。流程上理论上不会发生（URL 属于已选资源），保留兜底。
   */
  isNotOwned:
    `/您没有.*权限|don't have (access|permission)|无权访问|verify that you own/i.test(document.body.innerText)`,

  /**
   * 提交成功 toast。
   * 真实成功 toast 文案（点「请求编入索引」后约 1-2 分钟自动出现）：
   *   ✓ 已请求编入索引
   *   已将网址添加到优先抓取队列中。多次提交同一网页并不能改变该网页的队列顺序或优先级。
   * GSC 用自定义 snackbar（非标准 `[role=alert]`），用 body innerText 正则匹配最稳。
   */
  successIndicator:
    `/已请求编入索引|已将网址添加到优先抓取队列|requested|added to.*queue/i.test(document.body.innerText)`,
} as const;

export type ProbeKey = keyof typeof PROBES;
