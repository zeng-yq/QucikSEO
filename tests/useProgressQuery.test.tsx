import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { mergeDiscovered } from '../lib/storage/discovered';
import { appendSubmissions, removeSubmissions } from '../lib/storage/submissions';

import { useProgressQuery } from '../entrypoints/sidepanel/hooks/useProgressQuery';

beforeEach(() => {
  // storage 在 setup.ts 的 beforeEach 已清空
});

describe('useProgressQuery', () => {
  it('load 读本地算 report', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a']);
    await appendSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' }]);
    const { result } = renderHook(() => useProgressQuery('example.com'));
    await waitFor(() => expect(result.current.state.report).toBeDefined());
    expect(result.current.state.report?.total).toBe(1);
    expect(result.current.state.report?.platforms[0]).toMatchObject({ platform: 'gsc', done: 1, total: 1 });
  });

  it('domain 为空时不加载', () => {
    const { result } = renderHook(() => useProgressQuery(''));
    expect(result.current.state.report).toBeUndefined();
  });

  it('discovered 变化时自动重算', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a']);
    const { result } = renderHook(() => useProgressQuery('example.com'));
    await waitFor(() => expect(result.current.state.report?.total).toBe(1));
    // 新增一条链接 → onChanged 触发自动 reload
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a', 'https://example.com/b']);
    await waitFor(() => expect(result.current.state.report?.total).toBe(2));
  });

  it('submissions 变化时自动重算', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a', 'https://example.com/b']);
    const { result } = renderHook(() => useProgressQuery('example.com'));
    await waitFor(() => expect(result.current.state.report?.platforms[0].done).toBe(0));
    await appendSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' }]);
    await waitFor(() => expect(result.current.state.report?.platforms[0].done).toBe(1));
  });

  it('removeSubmissions 变化时自动重算', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a']);
    await appendSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' }]);
    const { result } = renderHook(() => useProgressQuery('example.com'));
    await waitFor(() => expect(result.current.state.report?.platforms[0].done).toBe(1));
    await removeSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc' }]);
    await waitFor(() => expect(result.current.state.report?.platforms[0].done).toBe(0));
  });

  it('其他 domain 的 storage 变化不触发重算', async () => {
    await mergeDiscovered('example.com', 'https://example.com/sitemap.xml', ['https://example.com/a']);
    const { result } = renderHook(() => useProgressQuery('example.com'));
    await waitFor(() => expect(result.current.state.report?.total).toBe(1));
    // 另一个 domain 的数据变化
    await mergeDiscovered('other.com', 'https://other.com/sitemap.xml', ['https://other.com/x']);
    // 等待可能的误触发（不应变化）
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.state.report?.total).toBe(1);
  });
});
