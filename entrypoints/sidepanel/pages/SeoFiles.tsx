import { useEffect, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import { buildSeoFileUrl, type SeoFile } from '@lib/seo-files/url';

const STORAGE_KEY = 'seo-files:last';

export default function SeoFiles() {
  const [site, setSite] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as string | undefined;
      if (last) setSite(last);
    });
  }, []);

  function open(file: SeoFile) {
    try {
      const url = buildSeoFileUrl(site, file);
      chrome.storage.local.set({ [STORAGE_KEY]: site.trim() });
      chrome.tabs.create({ url });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const disabled = !site.trim();

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>SEO 文件</h2>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>网址</label>
      <TextInput
        value={site}
        placeholder="如 bottleneck-checker.com"
        onChange={(e) => setSite(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) open('robots.txt'); }}
      />

      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <Button variant="secondary" disabled={disabled} onClick={() => open('robots.txt')} style={{ flex: 1 }}>
          打开 robots.txt
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => open('sitemap.xml')} style={{ flex: 1 }}>
          打开 sitemap.xml
        </Button>
      </div>
    </div>
  );
}
