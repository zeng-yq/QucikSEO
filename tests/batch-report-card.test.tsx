import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchReportCard from '../entrypoints/sidepanel/components/BatchReportCard';
import type { ReportItem } from '../entrypoints/sidepanel/hooks/useSubmitOrchestrator';

const R = (over: Partial<ReportItem>): ReportItem => ({ url: '', platform: 'gsc', status: 'ok', ...over });

describe('BatchReportCard', () => {
  it('汇总条计数成功/失败/跳过', () => {
    render(<BatchReportCard report={[
      R({ url: 'https://x/a', status: 'ok' }),
      R({ url: 'https://x/b', status: 'skipped', reason: '已索引' }),
      R({ url: 'https://x/c', status: 'skipped', reason: '检查结果未出现' }),
    ]} onClose={() => {}} />);
    expect(screen.getByText(/本批 3 · 成功 1 · 失败 1 · 跳过 1/)).toBeInTheDocument();
  });

  it('失败明细带 reason', () => {
    render(<BatchReportCard report={[R({ url: 'https://x/p1', platform: 'gsc', status: 'skipped', reason: '检查结果未出现' })]} onClose={() => {}} />);
    expect(screen.getByText(/p1（gsc：检查结果未出现）/)).toBeInTheDocument();
  });

  it('× 触发 onClose', () => {
    const onClose = vi.fn();
    render(<BatchReportCard report={[R({ url: '/a', status: 'ok' })]} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('跳过不列详情', () => {
    render(<BatchReportCard report={[R({ url: 'https://x/a', status: 'skipped', reason: '已索引' })]} onClose={() => {}} />);
    expect(screen.queryByText(/https:\/\/x\/a/)).not.toBeInTheDocument();
  });

  it('成功不列详情仅计数', () => {
    render(<BatchReportCard report={[R({ url: 'https://x/a', status: 'ok' })]} onClose={() => {}} />);
    expect(screen.getByText(/成功 1/)).toBeInTheDocument();
    expect(screen.queryByText('✗')).not.toBeInTheDocument();
  });
});
