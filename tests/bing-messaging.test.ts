import { describe, it, expect } from 'vitest';
import { BING_PORT_NAME, createBingPort } from '../lib/messaging/protocol';
import type { BingRequest, BingEvent } from '../lib/messaging/types';

/**
 * Bing 消息协议单测（与 messaging.test.ts 对称）。
 *
 * 仅做静态契约校验：
 *  - BING_START / BING_CANCEL 请求结构。
 *  - BingEvent（BING_STATE / BING_LOG / BING_DONE）字段可与 background 推送的对齐。
 *  - port 名固定为 'bing-runner'，createBingPort 返回 chrome.runtime.Port。
 */

describe('bing messaging types', () => {
  it('BING_START 结构', () => {
    const m: BingRequest = { type: 'BING_START', domain: 'example.com', urls: ['https://x.com/'] };
    expect(m.type).toBe('BING_START');
  });

  it('BING_CANCEL 结构', () => {
    const m: BingRequest = { type: 'BING_CANCEL' };
    expect(m.type).toBe('BING_CANCEL');
  });

  it('BingEvent BING_LOG 可赋值', () => {
    const e: BingEvent = { type: 'BING_LOG', level: 'info', phase: 'inspect', message: 'ok' };
    expect(e.type).toBe('BING_LOG');
  });

  it('BingEvent BING_STATE 可赋值', () => {
    const e: BingEvent = {
      type: 'BING_STATE',
      state: 'running',
      total: 3,
      done: 1,
      currentUrl: 'https://x.com/',
      results: [{ url: 'https://x.com/', status: 'ok' }],
    };
    expect(e.type).toBe('BING_STATE');
  });

  it('BingEvent BING_DONE 可赋值', () => {
    const e: BingEvent = { type: 'BING_DONE', ok: 2, failed: 0, skipped: 1 };
    expect(e.type).toBe('BING_DONE');
  });

  it('port 名固定', () => {
    expect(BING_PORT_NAME).toBe('bing-runner');
  });

  it('createBingPort 返回 chrome.runtime.Port', () => {
    const port = createBingPort();
    expect(typeof port.postMessage).toBe('function');
    expect(typeof port.onMessage.addListener).toBe('function');
  });
});
