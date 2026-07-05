import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubmitBar from '../entrypoints/sidepanel/components/SubmitBar';

const noop = () => {};

describe('SubmitBar', () => {
  it('点击「一次提交」触发 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<SubmitBar gsc bing onToggleGsc={noop} onToggleBing={noop} onSubmit={onSubmit} onCancel={noop} busy={false} ready={true} />);
    fireEvent.click(screen.getByText('一次提交 10 个'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('ready=false 时提交禁用', () => {
    render(<SubmitBar gsc bing onToggleGsc={noop} onToggleBing={noop} onSubmit={noop} onCancel={noop} busy={false} ready={false} />);
    expect(screen.getByText('一次提交 10 个')).toBeDisabled();
  });

  it('busy 时文案「提交中…」并出现取消按钮', () => {
    render(<SubmitBar gsc bing onToggleGsc={noop} onToggleBing={noop} onSubmit={noop} onCancel={noop} busy={true} ready={false} />);
    expect(screen.getByText('提交中…')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('点击 GSC chip 触发 onToggleGsc', () => {
    const onToggleGsc = vi.fn();
    render(<SubmitBar gsc bing onToggleGsc={onToggleGsc} onToggleBing={noop} onSubmit={noop} onCancel={noop} busy={false} ready={true} />);
    fireEvent.click(screen.getByText('GSC'));
    expect(onToggleGsc).toHaveBeenCalledOnce();
  });

  it('取消按钮触发 onCancel', () => {
    const onCancel = vi.fn();
    render(<SubmitBar gsc bing onToggleGsc={noop} onToggleBing={noop} onSubmit={noop} onCancel={onCancel} busy={true} ready={false} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
