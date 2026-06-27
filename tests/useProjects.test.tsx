import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects } from '../entrypoints/sidepanel/hooks/useProjects';

describe('useProjects', () => {
  it('增删后刷新列表', async () => {
    const { result } = renderHook(() => useProjects());
    await act(async () => { await result.current.add('bottleneck-checker.com'); });
    expect(result.current.projects).toHaveLength(1);
    const id = result.current.projects[0].id;
    await act(async () => { await result.current.remove(id); });
    expect(result.current.projects).toHaveLength(0);
  });
});
