/**
 * GSC（Google Search Console）「请求编入索引」流程。
 *
 * 实现依据：docs/superpowers/notes/gsc-probe.md §2（VERIFIED 2026-06-28）。
 * 关键运行事实（来自真实页面探测）：
 *  - GSC 的检查输入框是 **React 受控组件**：直接 `input.value=` 会被覆盖，
 *    必须用 `HTMLInputElement.prototype` 的 native value setter + 派发 `input` 事件，
 *    然后派发 `keydown` Enter 事件触发检查（没有放大镜按钮可点）。见 §2.2。
 *  - 「请求编入索引」按钮是 **`DIV[role=button]`**（不是 `<button>`），没有 `disabled`
 *    属性，启用状态由 `aria-disabled="false"` 表征。见 §2.3。
 *  - 点击后是 **单按钮流程**：弹出「正在测试实际网址可否编入索引」进度弹窗（1-2 分钟），
 *    自动完成后出现成功 toast（无需点第二个提交按钮）。见 §2.7。
 *
 * 因此 Task 12 的 flow = 等输入就绪 → native setter 填值 + Enter → 等结果信号 →
 * 分类（已索引/不属于/配额）→ 找按钮并校验 aria-disabled → 真实手势点击 →
 * 轮询成功 toast（180s）→ 清空输入框（供下一条复用）。
 */

import { clickReal, evalJs, waitForPredicate } from '../cdp/actions';
import { type Target } from '../cdp/client';
import { PROBES } from './selectors';

export type SubmitStatus = 'ok' | 'skipped';

export interface SubmitResult {
  url: string;
  status: SubmitStatus;
  reason?: string;
}

export interface FlowCallbacks {
  onProgress?: (s: { total: number; done: number; currentUrl?: string; results: SubmitResult[] }) => void;
  onLog?: (e: { level: 'info' | 'warn' | 'error'; phase: string; message: string }) => void;
  shouldStop?: () => boolean;
}

/** 检查结果区出现的最长等待（gsc-probe §2.3：实测 ~10-15s，留余量到 30s）。 */
const INSPECT_TIMEOUT = 30000;
/** 输入框就绪等待（页面初次加载）。 */
const INPUT_READY_TIMEOUT = 30000;
/**
 * 成功 toast 轮询超时。gsc-probe §2.7：点按钮后先弹「实时测试进度弹窗」1-2 分钟，
 * 之后才出现成功 toast。给到 180s（3 分钟）兜底，每 6s 轮询一次。
 */
const SUCCESS_TIMEOUT = 180000;
const SUCCESS_INTERVAL = 6000;
/** 连续配额命中达到该阈值即熔断剩余批次。 */
const QUOTA_THRESHOLD = 3;

/**
 * 单条 URL 的「请求编入索引」步骤机。
 *
 * 步骤（对应 gsc-probe.md §2）：
 *  1. 等输入框就绪（§2.1）。
 *  2. native setter 填值 + 派发 input/keydown Enter（§2.2）。
 *  3. 等待检查结果信号出现（按钮 / 已索引 / 配额 / 不属于，任一命中即就绪）。
 *  4. 分类：isAlreadyIndexed→已索引；isNotOwned→不属于此域名；isQuota→配额。
 *  5. 找「请求编入索引」按钮 + 校验 aria-disabled（§2.3）。
 *  6. 给按钮打 `data-autoseo` 标记后用真实手势点击（§2.3）。
 *  7. 轮询成功 toast（§2.7，单按钮流程，180s）。
 *  8. native setter 清空输入框（§2.8，供下一条复用）。
 */
export async function submitOne(target: Target, url: string): Promise<SubmitResult> {
  // ① 等输入框就绪（§2.1）
  await waitForPredicate(target, `!!(${PROBES.inspectInput})`, { timeoutMs: INPUT_READY_TIMEOUT });

  // ② native setter 填值 + Enter（§2.2 verbatim，URL 经 JSON.stringify 注入避免引号注入）
  const fillExpr =
    `(() => {` +
    `const i = ${PROBES.inspectInput};` +
    `if (!i) return false;` +
    `const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;` +
    `setter.call(i, ${JSON.stringify(url)});` +
    `i.dispatchEvent(new Event('input', { bubbles: true }));` +
    `i.focus();` +
    `i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));` +
    `return true;` +
    `})()`;
  await evalJs<boolean>(target, fillExpr);

  // ③ 等待检查结果信号（任一命中即视为结果区已加载）
  const resultReady =
    `(${PROBES.requestIndexingButton}) || (${PROBES.isAlreadyIndexed}) || (${PROBES.isQuota}) || (${PROBES.isNotOwned})`;
  await waitForPredicate(target, resultReady, { timeoutMs: INSPECT_TIMEOUT });

  // ④ 分类（注意顺序：先排除「已索引/不属于/配额」再去找按钮）
  if (await evalJs<boolean>(target, PROBES.isAlreadyIndexed)) {
    return { url, status: 'skipped', reason: '已索引' };
  }
  if (await evalJs<boolean>(target, PROBES.isNotOwned)) {
    return { url, status: 'skipped', reason: '不属于此域名' };
  }
  if (await evalJs<boolean>(target, PROBES.isQuota)) {
    return { url, status: 'skipped', reason: '配额' };
  }

  // ⑤ 找按钮 + 读 aria-disabled（§2.3：DIV[role=button]，无 disabled 属性）
  const btnInfo = await evalJs<{ button: boolean; ariaDisabled: string } | null>(target, btnProbeExpr());
  if (!btnInfo || !btnInfo.button) {
    return { url, status: 'skipped', reason: '无请求编入索引按钮' };
  }
  // aria-disabled 可能是 'false' / 'true' / 缺省（缺省视为启用）
  const disabled = btnInfo.ariaDisabled != null && btnInfo.ariaDisabled !== 'false';
  if (disabled) {
    return { url, status: 'skipped', reason: '按钮禁用' };
  }

  // ⑥ 给按钮打标记，再用真实手势点击（§2.3）
  await tagProbeElement(target, 'requestIndexingButton');
  await clickReal(target, '[data-autoseo="1"]');

  // ⑦ 单按钮流程：轮询成功 toast（§2.7，180s / 6s 间隔）
  const ok = await waitForPredicate(target, PROBES.successIndicator, {
    timeoutMs: SUCCESS_TIMEOUT,
    intervalMs: SUCCESS_INTERVAL,
  });
  if (!ok) return { url, status: 'skipped', reason: '提交未确认' };

  // ⑧ 清空输入框（§2.8，供下一条 URL 复用，best-effort，不阻塞结果）
  await resetInput(target).catch(() => undefined);

  return { url, status: 'ok' };
}

/**
 * 批量执行 + 配额熔断。
 *
 * - 逐条调用 submitOne，通过 onProgress/onLog 上报状态。
 * - 连续 QUOTA_THRESHOLD 条命中「配额」即熔断，剩余 URL 计为 skipped(未执行)。
 * - cb.shouldStop() 为 true 时立即终止，剩余同样计为 skipped。
 */
export async function runBatch(
  target: Target,
  urls: string[],
  cb: FlowCallbacks = {},
): Promise<{ ok: number; failed: number; skipped: number }> {
  const results: SubmitResult[] = [];
  let quotaStreak = 0;
  let stopped = false;

  for (let i = 0; i < urls.length; i++) {
    if (cb.shouldStop?.()) {
      stopped = true;
      break;
    }
    const url = urls[i];
    cb.onLog?.({ level: 'info', phase: 'inspect', message: `[${i + 1}/${urls.length}] ${url}` });

    let r: SubmitResult;
    try {
      r = await submitOne(target, url);
    } catch (e) {
      r = { url, status: 'skipped', reason: (e as Error).message };
    }
    results.push(r);
    cb.onProgress?.({ total: urls.length, done: i + 1, currentUrl: url, results });

    if (r.reason === '配额') {
      quotaStreak += 1;
      if (quotaStreak >= QUOTA_THRESHOLD) {
        cb.onLog?.({ level: 'warn', phase: 'system', message: '连续配额信号，熔断剩余' });
        stopped = true;
        break;
      }
    } else {
      // 非配额结果（含 ok 与其他 skipped 原因）重置连续计数
      quotaStreak = 0;
    }
  }

  // 熔断或取消时，剩余 URL 计为 skipped(未执行)
  if (stopped) {
    for (const u of urls.slice(results.length)) {
      results.push({ url: u, status: 'skipped', reason: '未执行（批次终止）' });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  return { ok, failed: 0, skipped };
}

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

/**
 * 探测「请求编入索引」按钮并读取其 aria-disabled。
 * §2.3：按钮是 DIV[role=button]，没有 disabled 属性，启用状态由 aria-disabled="false" 表征。
 * 返回 { button: 是否存在, ariaDisabled: aria-disabled 属性值（可能为 null） }。
 */
function btnProbeExpr(): string {
  return (
    `(() => {` +
    `const b = ${PROBES.requestIndexingButton};` +
    `if (!b) return { button: false, ariaDisabled: null };` +
    `return { button: true, ariaDisabled: b.getAttribute('aria-disabled') };` +
    `})()`
  );
}

/**
 * 给 PROBES 中「返回元素」的表达式对应的目标打 `data-autoseo="1"` 标记，
 * 随后即可用 `[data-autoseo="1"]` 作为 CSS selector 供 clickReal 定位。
 * 每次先清除旧标记，避免误定位到上一个目标。
 */
async function tagProbeElement(target: Target, key: 'requestIndexingButton' | 'inspectInput'): Promise<void> {
  await evalJs<boolean>(
    target,
    `(() => {` +
      `document.querySelectorAll('[data-autoseo]').forEach((e) => e.removeAttribute('data-autoseo'));` +
      `const el = ${PROBES[key]};` +
      `if (el) el.setAttribute('data-autoseo', '1');` +
      `return true;` +
      `})()`,
  );
}

/**
 * 清空检查输入框（§2.8）。同样需要 native setter —— React 受控组件直接赋 '' 会被覆盖。
 * best-effort：失败时不影响已得出的结果。
 */
async function resetInput(target: Target): Promise<void> {
  await evalJs<boolean>(
    target,
    `(() => {` +
      `const i = ${PROBES.inspectInput};` +
      `if (!i) return false;` +
      `i.focus();` +
      `try { i.select(); } catch (e) {}` +
      `const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;` +
      `setter.call(i, '');` +
      `i.dispatchEvent(new Event('input', { bubbles: true }));` +
      `return true;` +
      `})()`,
  );
}
