// tests/sitetools.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run: vi.fn(), cancel: vi.fn(), active: null,
    report: [], logs: [], clearReport: vi.fn(),
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SiteTools from '../entrypoints/sidepanel/pages/SiteTools';

// flush 排空 useSite/useProjects 异步 refresh，避免 act warning
const flush = () => act(async () => {});

describe('SiteTools', () => {
  it('点击「网站提交」进入提交子面板（出现返回）', async () => {
    render(<SiteTools />);
    fireEvent.click(screen.getByText('网站提交'));
    expect(await screen.findByText('返回')).toBeInTheDocument();
  });
  it('选择有效网站后，点击 robots.txt 打开新标签', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    // 等待 useSite/useProjects 异步 refresh 落定，避免 act warning
    await flush();
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
    await flush();
    const robots = screen.getByText('robots.txt').closest('[role="button"], .tool-card');
    expect(robots?.getAttribute('aria-disabled')).toBe('true');
  });
  it('渲染 6 个新增工具卡片', async () => {
    render(<SiteTools />);
    await flush();
    expect(screen.getByText('Backlink Checker')).toBeInTheDocument();
    expect(screen.getByText('Website Authority Checker')).toBeInTheDocument();
    expect(screen.getByText('Google Search Console')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Clarity')).toBeInTheDocument();
    expect(screen.getByText('PageSpeed Insights')).toBeInTheDocument();
  });
  it('选网站后点 Backlink Checker 打开带 input 与 mode=subdomains 的链接', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'vercel.com' } });
    fireEvent.click(screen.getByText('Backlink Checker'));
    expect(spy).toHaveBeenCalled();
    const url = spy.mock.calls[0][0].url as string;
    expect(url).toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
    spy.mockRestore();
  });
  it('选网站后点 Google Search Console 打开直接链接（无查询参数）', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('Google Search Console'));
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].url).toBe('https://search.google.com/search-console');
    spy.mockRestore();
  });
  it('未选网站时 PageSpeed Insights 禁用', async () => {
    render(<SiteTools />);
    await flush();
    const card = screen.getByText('PageSpeed Insights').closest('[role="button"], .tool-card');
    expect(card?.getAttribute('aria-disabled')).toBe('true');
  });
});
