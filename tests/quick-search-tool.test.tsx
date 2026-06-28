import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickSearchTool from '../entrypoints/sidepanel/pages/QuickSearchTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('QuickSearchTool', () => {
  it('渲染 Google / Bing 两个按钮，关键词非空时可用', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeEnabled();
  });
  it('关键词为空时两按钮均禁用', () => {
    render(<QuickSearchTool keyword="" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeDisabled();
  });
  it('点击 Google / Bing 分别打开对应结果页', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<QuickSearchTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '用 Google 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Bing 搜' }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[0][0].url as string).startsWith('https://www.google.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[1][0].url as string).startsWith('https://cn.bing.com/search?q=apple')).toBe(true);
  });
});
