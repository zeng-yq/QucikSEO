import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mock: { state: any } = { state: {} };
vi.mock('../entrypoints/sidepanel/hooks/useProgressQuery', () => ({
  useProgressQuery: () => mock,
}));

import ProgressDashboard from '../entrypoints/sidepanel/components/ProgressDashboard';

const REPORT = {
  total: 2,
  platforms: [
    { platform: 'gsc' as const, done: 1, total: 2, pending: 1 },
    { platform: 'bing' as const, done: 0, total: 2, pending: 2 },
  ],
  items: [
    { url: 'https://example.com/a', gsc: 'done' as const, bing: 'pending' as const },
    { url: 'https://example.com/b', gsc: 'pending' as const, bing: 'pending' as const },
  ],
  stale: [] as Array<{ url: string; platform: 'gsc' | 'bing' }>,
};

beforeEach(() => {
  mock.state = {};
});

describe('ProgressDashboard', () => {
  it('filter 标签显示对应数量', () => {
    mock.state = { report: REPORT };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText('全部').closest('button')?.textContent).toBe('全部2');
    expect(screen.getByText('GSC未提交').closest('button')?.textContent).toBe('GSC未提交1');
    expect(screen.getByText('Bing未提交').closest('button')?.textContent).toBe('Bing未提交2');
  });

  it('每条链接显示 GSC/Bing 提交状态', () => {
    mock.state = { report: REPORT };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText('GSC✓')).toBeInTheDocument();
    expect(screen.getByText('GSC✗')).toBeInTheDocument();
    expect(screen.getAllByText('Bing✗')).toHaveLength(2);
  });

  it('GSC 已提交用 primary、未提交灰', () => {
    mock.state = { report: REPORT };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText('GSC✓').style.color).toBe('var(--color-primary)');
    expect(screen.getByText('GSC✗').style.color).toBe('var(--color-muted-soft)');
  });

  it('Bing 已提交用 success、未提交灰', () => {
    mock.state = {
      report: {
        total: 1,
        platforms: [
          { platform: 'gsc' as const, done: 1, total: 1, pending: 0 },
          { platform: 'bing' as const, done: 1, total: 1, pending: 0 },
        ],
        items: [{ url: 'https://example.com/a', gsc: 'done' as const, bing: 'done' as const }],
        stale: [],
      },
    };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText('Bing✓').style.color).toBe('var(--color-success)');
  });

  it('无 report 时显示空态', () => {
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText(/还没有进度数据/)).toBeInTheDocument();
  });

  it('筛选「GSC未提交」只显示 gsc=pending 的子集', () => {
    mock.state = { report: REPORT };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText(/example\.com\/a/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('GSC未提交'));
    expect(screen.queryByText(/example\.com\/a/)).not.toBeInTheDocument();
    expect(screen.getByText(/example\.com\/b/)).toBeInTheDocument();
  });

  it('超过 100 条时显示「加载更多」并追加', () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ url: `https://example.com/p${i}`, gsc: 'pending' as const, bing: 'pending' as const }));
    mock.state = { report: { ...REPORT, items } };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.getByText(/加载更多（剩余 50）/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/加载更多/));
    expect(screen.queryByText(/加载更多/)).not.toBeInTheDocument();
  });

  it('链接列表渲染在可滚动矩形区域内（maxHeight + overflow + border）', () => {
    mock.state = { report: REPORT };
    const { container } = render(<ProgressDashboard domain="example.com" />);
    const scrollArea = container.querySelector('[style*="max-height"]') as HTMLElement | null;
    expect(scrollArea).not.toBeNull();
    expect(scrollArea!.style.overflowY).toBe('auto');
    expect(scrollArea!.style.border).toContain('var(--color-hairline)');
  });

  it('不渲染刷新按钮与搜索框', () => {
    mock.state = { report: REPORT };
    render(<ProgressDashboard domain="example.com" />);
    expect(screen.queryByText('刷新')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('搜索 URL')).not.toBeInTheDocument();
  });
});
