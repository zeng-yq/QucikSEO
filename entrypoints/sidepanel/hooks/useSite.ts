// entrypoints/sidepanel/hooks/useSite.ts
import { useCallback, useEffect, useState } from 'react';

export interface Site { domain: string; projectId?: string; }

const KEY = 'site:last';

export function useSite() {
  const [site, setSiteState] = useState<Site>({ domain: '' });

  useEffect(() => {
    chrome.storage.local.get(KEY, (items) => {
      const v = items[KEY] as Site | undefined;
      if (v && typeof v.domain === 'string') setSiteState(v);
    });
  }, []);

  const setSite = useCallback((s: Site) => {
    setSiteState(s);
    chrome.storage.local.set({ [KEY]: s });
  }, []);

  return { site, setSite };
}
