import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let lastIndexNowProps: { domain?: string } = {};
vi.mock('../entrypoints/sidepanel/components/IndexNowKeySection', () => ({
  default: (props: { domain?: string }) => {
    lastIndexNowProps = props;
    return <div data-testid="indexnow-form">IndexNow 表单</div>;
  },
}));
vi.mock('../entrypoints/sidepanel/components/GscCredentialsSection', () => ({
  default: () => <div data-testid="gsc-form">GSC 表单</div>,
}));

import CredentialsSection from '../entrypoints/sidepanel/components/CredentialsSection';

describe('CredentialsSection', () => {
  it('默认折叠：显示标题与「未配置」摘要，不渲染表单', () => {
    render(<CredentialsSection domain="example.com" />);
    expect(screen.getByText('凭证设置')).toBeInTheDocument();
    expect(screen.getByText('未配置')).toBeInTheDocument();
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('点击 header 展开，默认显示 IndexNow 表单', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.getByText('IndexNow 表单')).toBeInTheDocument();
    expect(screen.queryByText('GSC 表单')).not.toBeInTheDocument();
  });

  it('切到 GSC tab 显示 GSC 表单', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    fireEvent.click(screen.getByText('GSC'));
    expect(screen.getByText('GSC 表单')).toBeInTheDocument();
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('已配置 GSC 时摘要显示「GSC 已就绪」', async () => {
    await chrome.storage.local.set({ settings: { gscCredentials: '{"type":"service_account"}' } });
    render(<CredentialsSection domain="example.com" />);
    await waitFor(() => expect(screen.getByText('GSC 已就绪')).toBeInTheDocument());
  });

  it('两套都配置时摘要显示「GSC · IndexNow 已就绪」', async () => {
    await chrome.storage.local.set({ settings: { gscCredentials: '{}', indexnowKey: 'abcdef0123456789' } });
    render(<CredentialsSection domain="example.com" />);
    await waitFor(() => expect(screen.getByText('GSC · IndexNow 已就绪')).toBeInTheDocument());
  });

  it('再次点击 header 收起', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.getByText('IndexNow 表单')).toBeInTheDocument();
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('展开后把 domain 透传给 IndexNowKeySection', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(lastIndexNowProps.domain).toBe('example.com');
  });
});
