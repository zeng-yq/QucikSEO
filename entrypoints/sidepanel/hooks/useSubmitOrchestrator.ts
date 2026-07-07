import { useCallback, useRef, useState } from 'react';
import { useGscRunner } from './useGscRunner';
import { useBingRunner } from './useBingRunner';
import { fetchSitemapViaBackground, type SitemapFetched } from '@lib/messaging/sitemap-client';
import { syncDiscovered } from '@lib/storage/discovered';
import { getSubmissions, appendSubmissions, removeSubmissions, type Platform } from '@lib/storage/submissions';
import { pickRandom } from '@lib/submit/pick';
import { partitionLowValue } from '@lib/submit/filter';

export interface Platforms { gsc: boolean; bing: boolean; }

export interface ReportItem {
  url: string;
  platform: Platform;
  status: 'ok' | 'skipped';
  reason?: string;
}

export interface SysLogEntry { level: 'info' | 'warn' | 'error'; phase: string; message: string; ts: number; }

const BATCH_SIZE = 10;

export function useSubmitOrchestrator() {
  const gsc = useGscRunner();
  const bing = useBingRunner();
  const [active, setActive] = useState<'sitemap' | 'gsc' | 'bing' | null>(null);
  const [report, setReport] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<SysLogEntry[]>([]);
  const runningRef = useRef(false);

  const pushLog = useCallback((level: SysLogEntry['level'], phase: string, message: string) => {
    setLogs((prev) => [...prev, { level, phase, message, ts: Date.now() }]);
  }, []);

  const run = useCallback(async (
    platforms: Platforms,
    domain: string,
    sitemapUrl: string,
    deps?: { fetchSitemap?: typeof fetchSitemapViaBackground },
  ) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setReport([]);
    const fetchSitemap = deps?.fetchSitemap ?? fetchSitemapViaBackground;

    try {
      // ① 抓 sitemap
      setActive('sitemap');
      pushLog('info', 'system', `抓取 sitemap: ${sitemapUrl}`);
      let fetched: SitemapFetched;
      try { fetched = await fetchSitemap(sitemapUrl); }
      catch (e) { pushLog('error', 'system', `sitemap 抓取失败: ${(e as Error).message}`); return; }
      pushLog('info', 'system', `发现 ${fetched.urls.length} 条链接（深度 ${fetched.stats.indexDepth}${fetched.stats.truncated ? '，已截断' : ''}）`);

      // ② 低价值过滤：账号/法务/用户中心类不进候选池，也不缓存（discovered 只保留有效链接）
      const { kept, dropped } = partitionLowValue(fetched.urls);
      if (dropped.length > 0) {
        pushLog('info', 'system', `已过滤 ${dropped.length} 条低价值链接（登录/注册/隐私/条款/账号等）`);
      }

      // ③ 全量对齐 discovered：只缓存有效链接，并自动剔除已不在 sitemap 的旧链接
      await syncDiscovered(domain, sitemapUrl, kept);

      const subs = await getSubmissions(domain);

      // ④ 清理已下线链接的提交记录：url 不在本次 sitemap 的 ok 记录直接删除
      const validSet = new Set(kept);
      const staleRecords = subs.filter((s) => s.status === 'ok' && !validSet.has(s.url));
      if (staleRecords.length > 0) {
        await removeSubmissions(domain, staleRecords.map((s) => ({ url: s.url, platform: s.platform })));
      }

      // ⑤ 候选池：kept 中对所有勾选平台都未 ok 的 URL（批量 ok-set，避免逐条查）
      const selected: Platform[] = [];
      if (platforms.gsc) selected.push('gsc');
      if (platforms.bing) selected.push('bing');
      const okSet = new Set(subs.filter((r) => r.status === 'ok').map((r) => `${r.platform}|${r.url}`));
      const pool = kept.filter((u) => selected.every((p) => !okSet.has(`${p}|${u}`)));

      // ⑥ 随机选 BATCH_SIZE
      const picked = pickRandom(pool, BATCH_SIZE);
      if (picked.length === 0) { pushLog('info', 'system', '无可提交链接，全部已提交'); return; }
      pushLog('info', 'system', `候选 ${pool.length}，本批选中 ${picked.length}`);

      // ⑦ 批次 id
      const batchId = crypto.randomUUID();
      const collected: ReportItem[] = [];

      // ⑧/⑨ 逐平台提交 + 落库
      // early-DONE：若 background 在任何 STATE 之前就发 GSC_DONE/BING_DONE（页面加载超时 / 登录失败 / 权限失败），
      // start 将 resolve 成 []，此处 results 为空，因此不会向 submissions 追加、也不会写报告——这是有意的（无操作即无记录），错误信号由该平台 LogPanel 承载。
      if (platforms.gsc) {
        setActive('gsc');
        try {
          const results = await gsc.start(domain, picked);
          collected.push(...results.map((r) => ({ url: r.url, platform: 'gsc' as const, status: r.status, reason: r.reason })));
          await appendSubmissions(domain, results.map((r) => ({ url: r.url, platform: 'gsc' as const, status: r.status, reason: r.reason, ts: Date.now(), batchId })));
        } catch { /* 某平台失败不中断后续 */ }
      }
      if (platforms.bing) {
        setActive('bing');
        try {
          const results = await bing.start(domain, picked);
          collected.push(...results.map((r) => ({ url: r.url, platform: 'bing' as const, status: r.status, reason: r.reason })));
          await appendSubmissions(domain, results.map((r) => ({ url: r.url, platform: 'bing' as const, status: r.status, reason: r.reason, ts: Date.now(), batchId })));
        } catch { /* 同上 */ }
      }

      // ⑩ 报告
      setReport(collected);
      pushLog('info', 'system', `批次完成：${collected.length} 条结果`);
    } finally {
      setActive(null);
      runningRef.current = false;
    }
  }, [gsc.start, bing.start, pushLog]);

  const cancel = useCallback(() => { gsc.cancel(); bing.cancel(); }, [gsc.cancel, bing.cancel]);
  const clearReport = useCallback(() => setReport([]), []);

  return { gsc, bing, active, run, cancel, report, logs, clearReport };
}
