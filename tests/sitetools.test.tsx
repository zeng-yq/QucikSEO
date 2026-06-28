// tests/sitetools.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run: vi.fn(), cancel: vi.fn(), active: null,
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SiteTools from '../entrypoints/sidepanel/pages/SiteTools';

describe('SiteTools', () => {
  it('点击「网站提交」进入提交子面板（出现返回）', async () => {
    render(<SiteTools />);
    fireEvent.click(screen.getByText('网站提交'));
    expect(await screen.findByText('返回')).toBeTruthy();
  });
  it('选择有效网站后，点击 robots.txt 打开新标签', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    // 等待 useSite/useProjects 异步 refresh 落定，避免 act warning
    await act(async () => { /* flush async refresh */ });
    // 在网站选择器输入有效域名
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('robots.txt'));
    expect(createSpy).toHaveBeenCalled();
    const url = createSpy.mock.calls[0][0].url as string;
    expect(url).toBe('https://example.com/robots.txt');
    createSpy.mockRestore();
  });
  it('未选网站时 robots.txt 禁用', async () => {
    render(<SiteTools />);
    // 等待 useSite/useProjects 异步 refresh 落定，避免 act warning
    await act(async () => { /* flush async refresh */ });
    const robots = screen.getByText('robots.txt').closest('[role="button"], .tool-card');
    expect(robots?.getAttribute('aria-disabled')).toBe('true');
  });
});
