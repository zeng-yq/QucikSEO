import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

function mockPort() {
  let msgCb: ((e: any) => void) | null = null;
  let discCb: (() => void) | null = null;
  const port = {
    postMessage: vi.fn(),
    onMessage: { addListener: (cb: (e: any) => void) => { msgCb = cb; } },
    onDisconnect: { addListener: (cb: () => void) => { discCb = cb; } },
    disconnect: vi.fn(),
  };
  (chrome as any).runtime.connect = vi.fn(() => port);
  return {
    port,
    emit: (e: any) => msgCb!(e),
    /** 模拟 background service worker 终止 → port 断开，GSC_DONE 永不到达。 */
    fireDisconnect: () => { if (discCb) discCb(); },
  };
}

describe('useGscRunner', () => {
  it('start 返回最终 results（DONE 时）', async () => {
    const { emit } = mockPort();
    const { useGscRunner } = await import('../entrypoints/sidepanel/hooks/useGscRunner');
    const { result } = renderHook(() => useGscRunner());
    let resolved: any;
    await act(async () => {
      const p = result.current.start('example.com', ['https://example.com/a']);
      resolved = undefined;
      emit({ type: 'GSC_STATE', state: 'running', total: 1, done: 1, currentUrl: 'https://example.com/a', results: [{ url: 'https://example.com/a', status: 'ok' }] });
      emit({ type: 'GSC_DONE', ok: 1, failed: 0, skipped: 0 });
      resolved = await p;
    });
    expect(resolved).toEqual([{ url: 'https://example.com/a', status: 'ok' }]);
  });

  it('port 意外断开（SW 终止）时 start 兜底 resolve，避免按钮永久卡在"提交中"', async () => {
    const { fireDisconnect } = mockPort();
    const { useGscRunner } = await import('../entrypoints/sidepanel/hooks/useGscRunner');
    const { result } = renderHook(() => useGscRunner());
    let done = false;
    await act(async () => {
      const p = result.current.start('example.com', ['https://example.com/a']);
      p.then(() => { done = true; });
      // background SW 终止 → port 断开，GSC_DONE 永不到达
      fireDisconnect();
      await Promise.resolve();
    });
    expect(done).toBe(true); // start 不再永久 pending
    expect(result.current.state.running).toBe(false); // 按钮恢复
  });
});
