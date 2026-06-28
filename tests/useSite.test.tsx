// tests/useSite.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSite } from '../entrypoints/sidepanel/hooks/useSite';

describe('useSite', () => {
  it('setSite 后写入 storage 并更新 state', async () => {
    const { result } = renderHook(() => useSite());
    expect(result.current.site.domain).toBe('');
    await act(async () => { result.current.setSite({ domain: 'example.com' }); });
    expect(result.current.site.domain).toBe('example.com');
    const stored = await chrome.storage.local.get('site:last');
    expect((stored['site:last'] as { domain: string }).domain).toBe('example.com');
  });
  it('挂载时读取上次的 site', async () => {
    await chrome.storage.local.set({ 'site:last': { domain: 'shop.example.com', projectId: 'p9' } });
    const { result } = renderHook(() => useSite());
    await act(async () => { /* 等待 useEffect 读取 */ });
    expect(result.current.site.domain).toBe('shop.example.com');
    expect(result.current.site.projectId).toBe('p9');
  });
});
