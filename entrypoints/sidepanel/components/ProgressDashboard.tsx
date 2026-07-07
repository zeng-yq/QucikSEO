import { useState } from 'react';
import { useProgressQuery } from '../hooks/useProgressQuery';
import type { ProgressItem } from '@lib/submit/progress';

const PAGE = 100;

type Filter = 'all' | 'gsc-pending' | 'bing-pending';

export interface ProgressDashboardProps {
  domain: string;
}

export default function ProgressDashboard({ domain }: ProgressDashboardProps) {
  const { state } = useProgressQuery(domain);
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);

  const report = state.report;

  let rows: ProgressItem[] = [];
  if (report) {
    rows = report.items;
    if (filter === 'gsc-pending') rows = rows.filter((i) => i.gsc === 'pending');
    else if (filter === 'bing-pending') rows = rows.filter((i) => i.bing === 'pending');
  }

  const gscPending = report?.platforms.find((p) => p.platform === 'gsc')?.pending ?? 0;
  const bingPending = report?.platforms.find((p) => p.platform === 'bing')?.pending ?? 0;
  const filters: Array<[Filter, string, number]> = [
    ['all', '全部', report?.items.length ?? 0],
    ['gsc-pending', 'GSC未提交', gscPending],
    ['bing-pending', 'Bing未提交', bingPending],
  ];

  return (
    <div>
      {report && report.total > 0 && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {filters.map(([key, label, count]) => (
              <button key={key} type="button" onClick={() => { setFilter(key); setVisible(PAGE); }} className={`platform-chip${filter === key ? ' is-active' : ''}`}>
                {label}
                <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.75 }}>{count}</span>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 8, maxHeight: 280, overflowY: 'auto',
            border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-xs)', fontSize: 12, lineHeight: 1.6,
          }}>
            {rows.slice(0, visible).map((r) => (
              <div key={r.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {r.url}</span>
                <span style={{ color: r.gsc === 'done' ? 'var(--color-primary)' : 'var(--color-muted-soft)', flexShrink: 0 }}>GSC{r.gsc === 'done' ? '✓' : '✗'}</span>
                <span style={{ color: r.bing === 'done' ? 'var(--color-success)' : 'var(--color-muted-soft)', flexShrink: 0 }}>Bing{r.bing === 'done' ? '✓' : '✗'}</span>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: 'var(--color-muted)' }}>无符合条件的链接</div>}
            {visible < rows.length && (
              <button type="button" onClick={() => setVisible((v) => v + PAGE)} style={{ marginTop: 8, border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                加载更多（剩余 {rows.length - visible}）
              </button>
            )}
          </div>
        </>
      )}

      {(!report || report.total === 0) && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          还没有进度数据，提交一次后将自动显示。
        </div>
      )}
    </div>
  );
}
