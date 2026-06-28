import { useCallback, useState } from 'react';
import { useGscRunner } from './useGscRunner';
import { useBingRunner } from './useBingRunner';

export interface Platforms { gsc: boolean; bing: boolean; }

export function useSubmitOrchestrator() {
  const gsc = useGscRunner();
  const bing = useBingRunner();
  const [active, setActive] = useState<'gsc' | 'bing' | null>(null);

  const run = useCallback(async (platforms: Platforms, domain: string, urls: string[]) => {
    if (active) return; // 重入 guard：SubmitPanel !busy 按钮禁用为主防护，这里双重保险
    if (platforms.gsc) {
      setActive('gsc');
      try { await gsc.start(domain, urls); } catch { /* 某平台失败不中断后续 */ }
    }
    if (platforms.bing) {
      setActive('bing');
      try { await bing.start(domain, urls); } catch { /* 同上 */ }
    }
    setActive(null);
  }, [gsc.start, bing.start, active]);

  const cancel = useCallback(() => { gsc.cancel(); bing.cancel(); setActive(null); }, [gsc.cancel, bing.cancel]);

  return { gsc, bing, active, run, cancel };
}
