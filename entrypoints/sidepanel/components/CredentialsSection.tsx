import { useEffect, useState } from 'react';
import { IconChevron } from './icons';
import { getSettings } from '@lib/storage/settings';
import IndexNowKeySection from './IndexNowKeySection';
import GscCredentialsSection from './GscCredentialsSection';

const SETTINGS_KEY = 'settings';

function summarize(s: { indexnowKey?: string; gscCredentials?: string } | undefined): string {
  const hasIn = !!s?.indexnowKey;
  const hasGsc = !!s?.gscCredentials;
  if (hasIn && hasGsc) return 'GSC · IndexNow 已就绪';
  if (hasGsc) return 'GSC 已就绪';
  if (hasIn) return 'IndexNow 已就绪';
  return '未配置';
}

type Tab = 'indexnow' | 'gsc';

/**
 * 凭证配置折叠区（常驻提交面板）。
 * 默认折叠为一行状态摘要（GSC / IndexNow 是否就绪）；展开后用 Tab 在两套配置间切换。
 * 状态摘要自行读 settings（getSettings + storage.onChanged），不干扰子组件各自的 hook。
 */
export default function CredentialsSection() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('indexnow');
  const [summary, setSummary] = useState('未配置');

  useEffect(() => {
    let active = true;
    getSettings().then((s) => { if (active) setSummary(summarize(s)); });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const v = changes[SETTINGS_KEY].newValue as { indexnowKey?: string; gscCredentials?: string } | undefined;
      if (active) setSummary(summarize(v));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => { active = false; chrome.storage.onChanged.removeListener(listener); };
  }, []);

  const unconfigured = summary === '未配置';

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', border: '1px solid var(--color-hairline)',
          borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          background: 'var(--color-surface-card)', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          display: 'inline-flex', lineHeight: 0, color: 'var(--color-muted)',
          transition: 'transform .15s ease', transform: open ? 'rotate(90deg)' : 'none',
        }}>
          <IconChevron size={14} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>凭证设置</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11,
          color: unconfigured ? 'var(--color-error)' : 'var(--color-muted-soft)',
        }}>{summary}</span>
      </button>

      {open && (
        <div style={{
          marginTop: -1, padding: 12,
          border: '1px solid var(--color-hairline)', borderTop: 'none',
          borderRadius: '0 0 var(--radius-md) var(--radius-md)',
          background: 'var(--color-canvas)',
        }}>
          <div role="tablist" aria-label="凭证类型" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            <button type="button" role="tab" aria-selected={tab === 'indexnow'} onClick={() => setTab('indexnow')} className={`tab${tab === 'indexnow' ? ' is-active' : ''}`} style={{ flex: 1, height: 28, fontSize: 12 }}>IndexNow</button>
            <button type="button" role="tab" aria-selected={tab === 'gsc'} onClick={() => setTab('gsc')} className={`tab${tab === 'gsc' ? ' is-active' : ''}`} style={{ flex: 1, height: 28, fontSize: 12 }}>GSC</button>
          </div>
          <div role="tabpanel">{tab === 'indexnow' ? <IndexNowKeySection /> : <GscCredentialsSection />}</div>
        </div>
      )}
    </div>
  );
}
