import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGscRunner } from '../entrypoints/sidepanel/hooks/useGscRunner';

/**
 * useGscRunner 行为契约：
 *  - start(domain, urls) 经 port 发送 GSC_START（带 domain）。
 *  - start 返回一个 Promise，在 background 推送 GSC_DONE 时 resolve。
 *    Task 8 的 orchestrator 依赖该 Promise 做串行 await。
 */
describe('useGscRunner', () => {
  it('start 发送 domain 并在 GSC_DONE 后 resolve', async () => {
    let msgListener: ((e: unknown) => void) | undefined;
    const port = {
      postMessage: vi.fn(),
      onMessage: { addListener: (cb: (e: unknown) => void) => { msgListener = cb; } },
      onDisconnect: { addListener: () => {} },
      disconnect: () => {},
    };
    vi.spyOn(chrome.runtime, 'connect').mockReturnValue(port as never);

    const { result } = renderHook(() => useGscRunner());

    let resolved = false;
    await act(async () => {
      const p = result.current.start('example.com', ['https://x.com/']);
      // 模拟 background 推 DONE
      act(() => { msgListener?.({ type: 'GSC_DONE', ok: 1, failed: 0, skipped: 0 }); });
      await p;
      resolved = true;
    });

    expect(resolved).toBe(true);
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'GSC_START', domain: 'example.com', urls: ['https://x.com/'] });
  });
});
