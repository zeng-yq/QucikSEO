import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects } from '../entrypoints/sidepanel/hooks/useProjects';
import { addProject } from '../lib/storage/projects';

describe('useProjects 跨视图同步', () => {
  it('一个实例 add 后，另一个实例通过 onChanged 收到更新', async () => {
    const a = renderHook(() => useProjects());
    const b = renderHook(() => useProjects());
    await act(async () => { await a.result.current.add('sync-test.com'); });
    // storage.set 已触发 onChanged → 两个实例都应刷新
    // 注意：a 靠 add().then(refresh) 刷新；b 才真正验证 onChanged 跨实例同步
    expect(a.result.current.projects.some((p) => p.domain === 'sync-test.com')).toBe(true);
    expect(b.result.current.projects.some((p) => p.domain === 'sync-test.com')).toBe(true);
  });
  it('直接 addProject（绕过 hook）也被监听到', async () => {
    const c = renderHook(() => useProjects());
    await act(async () => { await addProject('direct.com'); });
    expect(c.result.current.projects.some((p) => p.domain === 'direct.com')).toBe(true);
  });
});
