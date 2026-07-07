import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { appendSubmissions } from '../lib/storage/submissions';

const gscStart = vi.fn();
const bingStart = vi.fn();
const fetchSitemap = vi.fn();
const baseRunner = (start: ReturnType<typeof vi.fn>) => ({
  start, cancel: vi.fn(),
  state: { running: false, total: 0, done: 0 },
  results: [], logs: [],
});

vi.mock('../entrypoints/sidepanel/hooks/useGscRunner', () => ({ useGscRunner: () => baseRunner(gscStart) }));
vi.mock('../entrypoints/sidepanel/hooks/useBingRunner', () => ({ useBingRunner: () => baseRunner(bingStart) }));

import { useSubmitOrchestrator } from '../entrypoints/sidepanel/hooks/useSubmitOrchestrator';

const SITEMAP = 'https://example.com/sitemap.xml';

beforeEach(() => {
  gscStart.mockReset(); bingStart.mockReset(); fetchSitemap.mockReset();
  fetchSitemap.mockResolvedValue({ urls: ['https://example.com/a', 'https://example.com/b'], stats: { indexDepth: 0, truncated: false } });
  gscStart.mockResolvedValue([{ url: 'https://example.com/a', status: 'ok' }, { url: 'https://example.com/b', status: 'ok' }]);
  bingStart.mockResolvedValue([{ url: 'https://example.com/a', status: 'ok' }, { url: 'https://example.com/b', status: 'ok' }]);
});

describe('useSubmitOrchestrator（sitemap 流程）', () => {
  it('fetch 失败时不调用 runner', async () => {
    fetchSitemap.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).not.toHaveBeenCalled();
  });

  it('候选池排除已 ok 的 URL', async () => {
    // 预置 a 在 gsc 已 ok
    await appendSubmissions('example.com', [{ url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' }]);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://example.com/b']);
  });

  it('不足 10 全选（这里 pool=2）', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    const picked = gscStart.mock.calls[0][1] as string[];
    expect(picked).toHaveLength(2);
  });

  it('results 落库带 platform/batchId', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', SITEMAP, { fetchSitemap }); });
    const { getSubmissions } = await import('../lib/storage/submissions');
    const all = await getSubmissions('example.com');
    expect(all.filter(r => r.platform === 'gsc')).toHaveLength(2);
    expect(all.filter(r => r.platform === 'bing')).toHaveLength(2);
    const ids = new Set(all.map(r => r.batchId));
    expect(ids.size).toBe(1); // 同一批次同一 batchId
  });

  it('report 汇总 gsc+bing', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', SITEMAP, { fetchSitemap }); });
    await waitFor(() => expect(result.current.report).toHaveLength(4));
    expect(result.current.report.filter(r => r.status === 'ok')).toHaveLength(4);
  });

  it('池空时不提交', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' },
      { url: 'https://example.com/b', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' },
    ]);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(gscStart).not.toHaveBeenCalled();
  });

  it('低价值链接被剔出候选池且系统日志回显数量', async () => {
    fetchSitemap.mockResolvedValue({
      urls: [
        'https://example.com/login',
        'https://example.com/privacy-policy',
        'https://example.com/blog/post-1',
      ],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    // 候选池只剩 blog/post-1
    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://example.com/blog/post-1']);
    // 系统日志含「已过滤 2 条」
    expect(result.current.logs.some((l) => /已过滤 2 条低价值链接/.test(l.message))).toBe(true);
  });

  it('discovered 只缓存过滤后的有效链接（低价值项不入库）', async () => {
    fetchSitemap.mockResolvedValue({
      urls: ['https://example.com/login', 'https://example.com/blog/post-1'],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    const { getDiscovered } = await import('../lib/storage/discovered');
    const d = await getDiscovered('example.com');
    expect(d?.urls).toEqual(['https://example.com/blog/post-1']);
  });

  it('已下线链接的 ok 提交记录被自动清理', async () => {
    // 预置 /old 已 ok（模拟历史提交），本次 sitemap 不含 /old
    await appendSubmissions('example.com', [{ url: 'https://example.com/old', platform: 'gsc', status: 'ok', ts: 1, batchId: 'old' }]);
    fetchSitemap.mockResolvedValue({ urls: ['https://example.com/a', 'https://example.com/b'], stats: { indexDepth: 0, truncated: false } });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    const { getSubmissions } = await import('../lib/storage/submissions');
    const all = await getSubmissions('example.com');
    expect(all.some((r) => r.url === 'https://example.com/old')).toBe(false);
  });

  it('dropped 为 0 时不输出过滤日志', async () => {
    fetchSitemap.mockResolvedValue({
      urls: ['https://example.com/a', 'https://example.com/b'],
      stats: { indexDepth: 0, truncated: false },
    });
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: false }, 'example.com', SITEMAP, { fetchSitemap }); });
    expect(result.current.logs.some((l) => /已过滤/.test(l.message))).toBe(false);
  });
});
