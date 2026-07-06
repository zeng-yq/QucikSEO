/**
 * Background service worker：GSC 批量「请求编入索引」编排。
 *
 * 职责：
 *  - 监听命名 port（`gsc-runner`），接收 UI 的 GSC_START / GSC_CANCEL 请求。
 *  - GSC_START：读 settings.gscCredentials → parseServiceAccount → getAccessToken
 *    → submitBatch（串行逐条 POST urlNotifications:publish，推 GSC_STATE / GSC_LOG）
 *    → GSC_DONE 汇总。
 *  - GSC_CANCEL：置闭包 stop 标志；submitBatch 在下一条 URL 前自检（shouldStop）。
 *
 * 替代旧版 CDP 编排（开 tab / attach / 等 SPA / 检查登录 / 逐条 evalJs 操控 DOM / detach）。
 * 一次 POST 通常 1-3s，无 SW 回收风险；host_permissions(<all_urls>) 覆盖跨域 fetch。
 *
 * ⚠️ Indexing API 官方仅支持 JobPosting/BroadcastEvent 页面；普通网页调用返回 200
 *   但 Google 不保证抓取。用户已知情并选择迁移（spec §2）。
 */

import { getSettings, isValidIndexNowKey } from '../lib/storage/settings';
import { parseServiceAccount, getAccessToken, type ServiceAccount } from '../lib/gsc/auth';
import { submitBatch } from '../lib/gsc/submit';
import { submitUrls, groupByHost } from '../lib/indexnow/submit';
import { GSC_PORT_NAME, BING_PORT_NAME, SITEMAP_PORT_NAME } from '../lib/messaging/protocol';
import type { GscRequest, GscEvent, BingRequest, BingEvent, SitemapRequest, SitemapEvent, SubmitResult } from '../lib/messaging/types';
import { handleSitemapRequest } from '../lib/sitemap/handler';
import { getGeoPref, applyGeo, resolveGeo, GEO_STORAGE_KEY, DEFAULT_GEO_CODE, type GeoCode } from '../lib/quicksearch/geo';

export default defineBackground(() => {
  // 点击工具栏图标打开 sidepanel（MV3 sidePanel API）。失败静默：旧 Chrome 无此 API。
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  /**
   * Google 搜索地理位置伪装：启动/安装时按 storage 重建 sessionRules；
   * UI 切换（写 'kw-tools:geo'）→ storage.onChanged → 实时增删规则 + 清 UULE。
   * 默认 storage 为空 → getGeoPref 返回 'US' → 即默认开启美国。
   * 设计：docs/superpowers/specs/2026-07-04-google-search-geo-design.md
   */
  chrome.runtime.onStartup.addListener(initGeo);
  chrome.runtime.onInstalled.addListener(initGeo);
  async function initGeo(): Promise<void> {
    const { code } = await getGeoPref();
    await applyGeo(resolveGeo(code));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[GEO_STORAGE_KEY]) return;
    const code = (changes[GEO_STORAGE_KEY].newValue as { code?: GeoCode } | undefined)?.code ?? DEFAULT_GEO_CODE;
    void applyGeo(resolveGeo(code));
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === GSC_PORT_NAME) {
      // 闭包 stop 标志（与 Bing runner 一致）：GSC_CANCEL 置位，submitBatch 下一条前自检。
      let gscStop = false;
      port.onMessage.addListener((msg: GscRequest) => {
        if (msg.type === 'GSC_START') {
          void handleStart(port, msg, () => gscStop);
        } else if (msg.type === 'GSC_CANCEL') {
          gscStop = true;
        }
      });
    } else if (port.name === BING_PORT_NAME) {
      // Bing runner：闭包持有独立 stop 标志（与 GSC 互不干扰）。
      let bingStop = false;
      port.onMessage.addListener((msg: BingRequest) => {
        if (msg.type === 'BING_START') {
          void handleBingStart(port, msg, () => bingStop);
        } else if (msg.type === 'BING_CANCEL') {
          bingStop = true;
        }
      });
    } else if (port.name === SITEMAP_PORT_NAME) {
      port.onMessage.addListener(async (msg: SitemapRequest) => {
        if (msg.type !== 'SITEMAP_FETCH') return;
        const e: SitemapEvent = await handleSitemapRequest(msg);
        emit(port, e);
      });
    }
  });

  /**
   * 编排一次 GSC 批量提交（Indexing API 版）。
   *
   * 流程：读 settings.gscCredentials → parseServiceAccount → getAccessToken（命中缓存或 JWT 换取）
   *   → submitBatch（串行逐条 POST urlNotifications:publish，推 GSC_STATE/GSC_LOG）→ GSC_DONE。
   * 未配密钥 / 解析失败 / 换 token 失败：推 error 日志 + GSC_DONE(全 skipped)。
   *
   * 替代旧版 CDP 编排（开 tab / attach / 等 SPA / 登录检查 / 逐条 evalJs 操控 DOM / detach）。
   * 单次 POST 通常 1-3s；遇 429 立即停止剩余（submitBatch 内 quotaHit）。
   *
   * ⚠️ Indexing API 官方仅支持 JobPosting/BroadcastEvent 页面；普通网页调用返回 200 但 Google
   *   不保证抓取。用户已知情并选择迁移（spec §2）。
   */
  async function handleStart(
    port: chrome.runtime.Port,
    msg: { domain: string; urls: string[] },
    shouldStop: () => boolean,
  ): Promise<void> {
    const { gscCredentials } = await getSettings();
    if (!gscCredentials) {
      emit(port, { type: 'GSC_LOG', level: 'error', phase: 'system', message: '未配置 GSC 服务账号密钥，请在下方粘贴' });
      emit(port, { type: 'GSC_DONE', ok: 0, failed: 0, skipped: msg.urls.length });
      return;
    }

    let creds: ServiceAccount;
    try {
      creds = parseServiceAccount(gscCredentials);
    } catch (e) {
      emit(port, { type: 'GSC_LOG', level: 'error', phase: 'system', message: `密钥解析失败：${(e as Error).message}` });
      emit(port, { type: 'GSC_DONE', ok: 0, failed: 0, skipped: msg.urls.length });
      return;
    }

    let token: string;
    try {
      token = await getAccessToken(creds);
    } catch (e) {
      emit(port, { type: 'GSC_LOG', level: 'error', phase: 'system', message: `换取访问令牌失败：${(e as Error).message}` });
      emit(port, { type: 'GSC_DONE', ok: 0, failed: 0, skipped: msg.urls.length });
      return;
    }

    emit(port, { type: 'GSC_STATE', state: 'running', total: msg.urls.length, done: 0, results: [] });
    emit(port, { type: 'GSC_LOG', level: 'info', phase: 'system', message: `提交 ${msg.urls.length} 条到 Indexing API…` });

    const { results, ok, skipped } = await submitBatch(token, msg.urls, {
      shouldStop,
      onProgress: (s) => emit(port, {
        type: 'GSC_STATE',
        state: 'running',
        total: s.total,
        done: s.done,
        currentUrl: s.currentUrl,
        results: s.results,
      }),
      onLog: (e) => emit(port, { type: 'GSC_LOG', level: e.level, phase: e.phase, message: e.message }),
    });

    void results; // results 已随 GSC_STATE 推送；GSC_DONE 仅汇总计数
    emit(port, { type: 'GSC_DONE', ok, failed: 0, skipped });
  }

  /** 经 port 推送一个 GscEvent / BingEvent / SitemapEvent；若 port 已断开则静默忽略。 */
  function emit(port: chrome.runtime.Port, e: GscEvent | BingEvent | SitemapEvent): void {
    try {
      port.postMessage(e);
    } catch {
      // port 已断开（UI 关闭/刷新），忽略。
    }
  }

  /**
   * 编排一次 Bing 批量提交（IndexNow API 版）。
   *
   * 流程：读 settings.indexnowKey 并校验 → 按 hostname 分组 → 逐组 fetch POST 到 IndexNow
   *   → 按状态码把每条 URL 映射为 SubmitResult（ok / skipped+reason）→ 推 BING_STATE/BING_LOG/BING_DONE。
   * 未配 key / key 非法：推 error 日志 + BING_DONE(全 skipped)。
   * fetch 抛错（断网/DNS）：该组记 skipped + reason「网络错误:…」。
   *
   * 替代旧版 CDP 编排（开 tab / attach / 等 SPA / 检查登录 / 逐条 evalJs 操控 DOM / detach）。
   * 一次 POST 通常 1-3s，无 SW 回收风险；host_permissions(<all_urls>) 覆盖跨域 fetch。
   */
  async function handleBingStart(
    port: chrome.runtime.Port,
    msg: { domain: string; urls: string[] },
    shouldStop: () => boolean,
  ): Promise<void> {
    const { indexnowKey } = await getSettings();
    if (!indexnowKey || !isValidIndexNowKey(indexnowKey)) {
      emit(port, { type: 'BING_LOG', level: 'error', phase: 'system', message: '未配置有效的 IndexNow 密钥，请在下方生成' });
      emit(port, { type: 'BING_DONE', ok: 0, failed: 0, skipped: msg.urls.length });
      return;
    }
    if (shouldStop()) return;

    emit(port, { type: 'BING_STATE', state: 'running', total: msg.urls.length, done: 0, results: [] });
    emit(port, { type: 'BING_LOG', level: 'info', phase: 'system', message: `提交 ${msg.urls.length} 条到 IndexNow…` });

    // 初始化全部 skipped(未执行)；成功者覆盖为 ok
    const results: SubmitResult[] = msg.urls.map((u): SubmitResult => ({ url: u, status: 'skipped', reason: '未执行' }));

    for (const [host, urls] of groupByHost(msg.urls)) {
      if (shouldStop()) break;
      let r: { ok: boolean; status: number; reason?: string };
      try {
        r = await submitUrls(indexnowKey, host, urls);
      } catch (e) {
        r = { ok: false, status: 0, reason: `网络错误：${(e as Error).message ?? String(e)}` };
      }
      for (const u of urls) {
        const row = results.find((x) => x.url === u);
        if (!row) continue;
        if (r.ok) { row.status = 'ok'; row.reason = undefined; }
        else { row.reason = r.reason; }
      }
      emit(port, {
        type: 'BING_LOG',
        level: r.ok ? 'info' : 'error',
        phase: 'submit',
        message: r.ok ? `→ ${host}：已提交 ${urls.length} 条` : `→ ${host}：${r.reason}`,
      });
    }

    emit(port, { type: 'BING_STATE', state: 'running', total: msg.urls.length, done: msg.urls.length, results });
    const ok = results.filter((r) => r.status === 'ok').length;
    emit(port, { type: 'BING_DONE', ok, failed: 0, skipped: msg.urls.length - ok });
  }
});
