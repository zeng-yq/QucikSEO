import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AhrefsTool from '../entrypoints/sidepanel/pages/AhrefsTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('AhrefsTool', () => {
  it('渲染标题与副标题，关键词非空时按钮可用', () => {
    render(<AhrefsTool keyword="apple" />);
    expect(screen.getByText('Ahrefs')).toBeInTheDocument();
    expect(screen.getByText('关键词难度查询')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开查询' })).toBeEnabled();
  });
  it('关键词为空时按钮禁用', () => {
    render(<AhrefsTool keyword="" />);
    expect(screen.getByRole('button', { name: '打开查询' })).toBeDisabled();
  });
  it('点击打开 ahrefs 关键词难度链接，含 input=apple', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<AhrefsTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '打开查询' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0].url as string;
    expect(url.startsWith('https://ahrefs.com/keyword-difficulty/')).toBe(true);
    expect(url).toContain('input=apple');
  });
});
