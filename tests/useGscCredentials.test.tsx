import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGscCredentials } from '../entrypoints/sidepanel/hooks/useGscCredentials';
import { getSettings, updateSettings } from '../lib/storage/settings';
import * as auth from '../lib/gsc/auth';

const VALID = JSON.stringify({
  type: 'service_account',
  client_email: 'sa@proj.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
  token_uri: 'https://oauth2.googleapis.com/token',
});

// 与 useIndexNowKey.test.tsx 一致：依赖 vitest 全局 chrome.storage.local polyfill，直接用真实 settings。
beforeEach(async () => {
  vi.restoreAllMocks();
  await updateSettings({ gscCredentials: undefined, gscToken: undefined });
});

describe('useGscCredentials', () => {
  it('初次读 settings.gscCredentials', async () => {
    await updateSettings({ gscCredentials: VALID });
    const { result } = renderHook(() => useGscCredentials());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.credentials).toBe(VALID);
  });

  it('save → 写 gscCredentials + 清 gscToken', async () => {
    const { result } = renderHook(() => useGscCredentials());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { result.current.save(VALID); await Promise.resolve(); await Promise.resolve(); });
    const s = await getSettings();
    expect(s.gscCredentials).toBe(VALID);
    expect(s.gscToken).toBeUndefined();
  });

  it('clear → 清空两个字段', async () => {
    await updateSettings({ gscCredentials: VALID, gscToken: { accessToken: 'x', expiresAt: 1 } });
    const { result } = renderHook(() => useGscCredentials());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { result.current.clear(); await Promise.resolve(); await Promise.resolve(); });
    const s = await getSettings();
    expect(s.gscCredentials).toBeUndefined();
    expect(s.gscToken).toBeUndefined();
  });

  it('testConnection 成功 → testStatus=ok + 服务账号邮箱', async () => {
    await updateSettings({ gscCredentials: VALID });
    vi.spyOn(auth, 'getAccessToken').mockResolvedValue('TOK');
    const { result } = renderHook(() => useGscCredentials());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await result.current.testConnection(); });
    expect(result.current.testStatus).toBe('ok');
    expect(result.current.testMessage).toContain('sa@proj.iam.gserviceaccount.com');
  });

  it('testConnection 失败（密钥非法）→ testStatus=fail + message', async () => {
    await updateSettings({ gscCredentials: 'not-json' });
    const { result } = renderHook(() => useGscCredentials());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await result.current.testConnection(); });
    expect(result.current.testStatus).toBe('fail');
    expect(result.current.testMessage).toMatch(/JSON/);
  });
});
