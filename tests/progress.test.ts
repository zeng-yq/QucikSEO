import { describe, it, expect } from 'vitest';
import { computeProgress } from '../lib/submit/progress';
import type { DiscoveredLinks } from '../lib/storage/discovered';
import type { SubmissionRecord } from '../lib/storage/submissions';

const disc = (urls: string[]): DiscoveredLinks => ({ domain: 'example.com', sitemapUrl: 'https://example.com/sitemap.xml', urls, updatedAt: 1 });

describe('computeProgress', () => {
  it('分平台 done/pending 计数正确', () => {
    const d = disc(['https://example.com/a', 'https://example.com/b']);
    const subs: SubmissionRecord[] = [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
      { url: 'https://example.com/a', platform: 'bing', status: 'ok', ts: 1, batchId: 'b1' },
    ];
    const r = computeProgress(d, subs);
    expect(r.total).toBe(2);
    expect(r.platforms).toEqual([
      { platform: 'gsc', done: 1, total: 2, pending: 1 },
      { platform: 'bing', done: 1, total: 2, pending: 1 },
    ]);
    expect(r.items[0]).toEqual({ url: 'https://example.com/a', gsc: 'done', bing: 'done' });
    expect(r.items[1]).toEqual({ url: 'https://example.com/b', gsc: 'pending', bing: 'pending' });
  });

  it('skipped 不计入 done', () => {
    const d = disc(['https://example.com/a']);
    const subs: SubmissionRecord[] = [
      { url: 'https://example.com/a', platform: 'gsc', status: 'skipped', reason: '配额', ts: 1, batchId: 'b1' },
    ];
    const r = computeProgress(d, subs);
    expect(r.platforms[0]).toMatchObject({ platform: 'gsc', done: 0, pending: 1 });
  });

  it('stale：submissions 中 url ∉ discovered 的 ok 记录', () => {
    const d = disc(['https://example.com/a']);
    const subs: SubmissionRecord[] = [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
      { url: 'https://example.com/gone', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
      { url: 'https://example.com/gone', platform: 'bing', status: 'ok', ts: 1, batchId: 'b1' },
    ];
    const r = computeProgress(d, subs);
    expect(r.stale).toEqual([
      { url: 'https://example.com/gone', platform: 'gsc' },
      { url: 'https://example.com/gone', platform: 'bing' },
    ]);
  });

  it('stale 按 platform|url 去重（同一组合多次 ok 只算一次）', () => {
    const d = disc(['https://example.com/a']);
    const subs: SubmissionRecord[] = [
      { url: 'https://example.com/gone', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
      { url: 'https://example.com/gone', platform: 'gsc', status: 'ok', ts: 2, batchId: 'b2' },
    ];
    const r = computeProgress(d, subs);
    expect(r.stale).toEqual([{ url: 'https://example.com/gone', platform: 'gsc' }]);
  });

  it('discovered === null：total=0，stale 含全部 ok', () => {
    const subs: SubmissionRecord[] = [
      { url: 'https://example.com/a', platform: 'gsc', status: 'ok', ts: 1, batchId: 'b1' },
      { url: 'https://example.com/a', platform: 'bing', status: 'skipped', reason: '配额', ts: 1, batchId: 'b1' },
    ];
    const r = computeProgress(null, subs);
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.platforms).toEqual([
      { platform: 'gsc', done: 0, total: 0, pending: 0 },
      { platform: 'bing', done: 0, total: 0, pending: 0 },
    ]);
    // bing 是 skipped 不进 stale；gsc 的 a 不在（空）discovered → stale
    expect(r.stale).toEqual([{ url: 'https://example.com/a', platform: 'gsc' }]);
  });

  it('submissions === []：全 pending，stale 空', () => {
    const r = computeProgress(disc(['https://example.com/a', 'https://example.com/b']), []);
    expect(r.platforms[0]).toMatchObject({ platform: 'gsc', done: 0, pending: 2 });
    expect(r.stale).toEqual([]);
  });
});
