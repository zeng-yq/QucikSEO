import { useCallback, useEffect, useState } from 'react';
import { getDiscovered } from '@lib/storage/discovered';
import { getSubmissions } from '@lib/storage/submissions';
import { computeProgress, type ProgressReport } from '@lib/submit/progress';

export interface ProgressState {
  report?: ProgressReport;
  updatedAt?: number;
}

/**
 * 提交进度查询 hook（无需手动刷新）。
 * - mount 时 load（domain 非空）：读本地 discovered/submissions → computeProgress，立即可见上次进度。
 * - 监听 discovered/submissions 的 storage 变化自动重算：提交流程会 syncDiscovered / appendSubmissions /
 *   removeSubmissions，三者触发 onChanged → 自动刷新。提交即对账，无需独立刷新动作。
 */
export function useProgressQuery(domain: string) {
  const [state, setState] = useState<ProgressState>({});

  const load = useCallback(async () => {
    const discovered = await getDiscovered(domain);
    const submissions = await getSubmissions(domain);
    setState({ report: computeProgress(discovered, submissions), updatedAt: Date.now() });
  }, [domain]);

  useEffect(() => {
    if (!domain) return;
    void load();
  }, [domain, load]);

  useEffect(() => {
    if (!domain) return;
    const discoveredKey = `discovered:${domain}`;
    const submissionsKey = `submissions:${domain}`;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if (changes[discoveredKey] || changes[submissionsKey]) void load();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [domain, load]);

  return { state };
}
