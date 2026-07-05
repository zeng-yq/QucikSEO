import { classifyResult, type Outcome } from '@lib/submit/reasons';
import type { ReportItem } from '../hooks/useSubmitOrchestrator';

export interface BatchReportCardProps {
  report: ReportItem[];
  onClose: () => void;
}

export default function BatchReportCard({ report, onClose }: BatchReportCardProps) {
  const counts: Record<Outcome, number> = { ok: 0, failed: 0, skipped: 0 };
  const failures: ReportItem[] = [];
  for (const r of report) {
    const o = classifyResult(r);
    counts[o]++;
    if (o === 'failed') failures.push(r);
  }

  return (
    <div style={{
      border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)',
      padding: 'var(--space-sm)', background: 'var(--color-surface-soft)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: failures.length > 0 ? 6 : 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' }}>
          本批 {report.length} · 成功 {counts.ok} · 失败 {counts.failed} · 跳过 {counts.skipped}
        </div>
        <button type="button" aria-label="关闭" onClick={onClose} style={{
          border: 'none', background: 'none', color: 'var(--color-muted)', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>
      {failures.length > 0 && (
        <div style={{ color: 'var(--color-error)', fontSize: 12, lineHeight: 1.6 }}>
          {failures.map((r) => (
            <div key={`${r.platform}-${r.url}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ✗ {r.url}（{r.platform}{r.reason ? `：${r.reason}` : ''}）
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
