import { describe, it, expect } from 'vitest';
import { getSubmissions, isSubmittedOk, appendSubmissions } from '../lib/storage/submissions';

describe('submissions 存储', () => {
  it('append 后可读回', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
    ]);
    const all = await getSubmissions('example.com');
    expect(all).toHaveLength(1);
    expect(all[0].url).toBe('https://example.com/a');
  });

  it('isSubmittedOk：仅 status=ok 命中', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'skipped', reason: '配额', ts: 1, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(false);
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 2, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(true);
  });

  it('按 platform 独立：gsc ok 不影响 bing 判定', async () => {
    await appendSubmissions('example.com', [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
    ]);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'gsc')).toBe(true);
    expect(await isSubmittedOk('example.com', 'https://example.com/a', 'bing')).toBe(false);
  });

  it('domain 隔离', async () => {
    await appendSubmissions('a.com', [{ url: 'https://a.com/1', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' }]);
    expect(await isSubmittedOk('b.com', 'https://a.com/1', 'gsc')).toBe(false);
  });
});
