import type { DiscoveredLinks } from '@lib/storage/discovered';
import type { SubmissionRecord, Platform } from '@lib/storage/submissions';

export interface PlatformProgress {
  platform: Platform;
  done: number;
  total: number;
  pending: number;
}

export interface ProgressItem {
  url: string;
  gsc: 'done' | 'pending';
  bing: 'done' | 'pending';
}

export interface StaleSubmission {
  url: string;
  platform: Platform;
}

export interface ProgressReport {
  total: number;
  platforms: PlatformProgress[];
  items: ProgressItem[];
  stale: StaleSubmission[];
}

/**
 * 基于 discovered（当前有效链接）× submissions（历史提交）算分平台进度。
 * - 「已提交」只看 status === 'ok'（与现有去重口径一致；skipped 可重试，不计入）。
 * - stale = submissions 中 ok 且 url 已不在 discovered 的 (url, platform)，按 platform|url 去重。
 *   用于「已不在 sitemap」标灰展示，排除出 done/total 统计（它们不在 items 里）。
 * - discovered 是 single source of truth；submissions 的「是否过期」由它反查，不落库。
 */
export function computeProgress(
  discovered: DiscoveredLinks | null,
  submissions: SubmissionRecord[],
): ProgressReport {
  const okGsc = new Set<string>();
  const okBing = new Set<string>();
  for (const s of submissions) {
    if (s.status !== 'ok') continue;
    if (s.platform === 'gsc') okGsc.add(s.url);
    else if (s.platform === 'bing') okBing.add(s.url);
  }

  const urls = discovered?.urls ?? [];
  const urlSet = new Set(urls);
  const total = urls.length;

  const items: ProgressItem[] = urls.map((url) => ({
    url,
    gsc: okGsc.has(url) ? 'done' : 'pending',
    bing: okBing.has(url) ? 'done' : 'pending',
  }));

  const gscDone = items.filter((i) => i.gsc === 'done').length;
  const bingDone = items.filter((i) => i.bing === 'done').length;

  const stale: StaleSubmission[] = [];
  const staleSeen = new Set<string>();
  for (const s of submissions) {
    if (s.status !== 'ok') continue;
    if (urlSet.has(s.url)) continue;
    const k = `${s.platform}|${s.url}`;
    if (staleSeen.has(k)) continue;
    staleSeen.add(k);
    stale.push({ url: s.url, platform: s.platform });
  }

  const platforms: PlatformProgress[] = [
    { platform: 'gsc', done: gscDone, total, pending: total - gscDone },
    { platform: 'bing', done: bingDone, total, pending: total - bingDone },
  ];

  return { total, platforms, items, stale };
}
