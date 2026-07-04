import { describe, it, expect } from 'vitest';
import { classifyResult, SKIP_REASONS } from '../lib/submit/reasons';
import { pickRandom } from '../lib/submit/pick';

describe('classifyResult', () => {
  it('ok → ok', () => {
    expect(classifyResult({ status: 'ok' })).toBe('ok');
  });
  it('skipped + reason 命中 SKIP_REASONS → skipped', () => {
    for (const reason of SKIP_REASONS) {
      expect(classifyResult({ status: 'skipped', reason })).toBe('skipped');
    }
  });
  it('skipped + 动态 reason（Bing 诊断）→ failed（兜底）', () => {
    expect(classifyResult({ status: 'skipped', reason: '确认弹窗未出现(dialog=1,submit=0,deep=0)' })).toBe('failed');
  });
  it('skipped + 步骤异常文案 → failed', () => {
    expect(classifyResult({ status: 'skipped', reason: 'network error' })).toBe('failed');
  });
  it('skipped 无 reason → failed', () => {
    expect(classifyResult({ status: 'skipped' })).toBe('failed');
  });
});

describe('pickRandom', () => {
  it('n >= pool：返回全量副本', () => {
    const pool = [1, 2, 3];
    expect(pickRandom(pool, 5).sort()).toEqual([1, 2, 3]);
    expect(pickRandom(pool, 3).sort()).toEqual([1, 2, 3]);
  });
  it('n < pool：返回 n 个、均为 pool 元素、不重复', () => {
    const pool = [1, 2, 3, 4, 5];
    const out = pickRandom(pool, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect(pool).toContain(v);
  });
  it('空池返回空', () => {
    expect(pickRandom([], 10)).toEqual([]);
  });
  it('不修改原池', () => {
    const pool = [1, 2, 3, 4];
    const snap = [...pool];
    pickRandom(pool, 2);
    expect(pool).toEqual(snap);
  });
});
