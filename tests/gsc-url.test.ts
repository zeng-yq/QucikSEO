import { describe, it, expect } from 'vitest';
import { buildGscUrl } from '../lib/gsc/url';
import { PROBES } from '../lib/gsc/selectors';

describe('gsc url', () => {
  it('拼接示例域名', () => {
    expect(buildGscUrl('bottleneck-checker.com')).toBe(
      'https://search.google.com/u/0/search-console?resource_id=sc-domain%3Abottleneck-checker.com',
    );
  });
  it('accountIndex 可改', () => {
    expect(buildGscUrl('excelcompare.org', 1)).toContain('/u/1/');
  });
  it('空域名抛错', () => {
    expect(() => buildGscUrl('   ')).toThrow();
  });
  it('域名首尾空白会被 trim', () => {
    expect(buildGscUrl('  bottleneck-checker.com  ')).toContain(
      'sc-domain%3Abottleneck-checker.com',
    );
  });
  it('resource_id 已 URL 编码（冒号→%3A）', () => {
    expect(buildGscUrl('example.com')).toContain('resource_id=sc-domain%3Aexample.com');
  });
});

describe('selectors', () => {
  const REQUIRED_KEYS = [
    'inspectInput',
    'requestIndexingButton',
    'isAlreadyIndexed',
    'isQuota',
    'isNotOwned',
    'successIndicator',
  ] as const;

  it('PROBES 字段齐全', () => {
    for (const k of REQUIRED_KEYS) {
      expect(typeof PROBES[k]).toBe('string');
    }
  });

  it('每个 PROBES 是非空字符串', () => {
    for (const k of REQUIRED_KEYS) {
      expect(PROBES[k].length).toBeGreaterThan(0);
    }
  });

  it('inspectInput 用 aria-label 匹配（不依赖动态 class）', () => {
    expect(PROBES.inspectInput).toContain('aria-label');
    expect(PROBES.inspectInput).toContain('检查');
  });

  it('requestIndexingButton 匹配 DIV[role=button]（不是 <button>）', () => {
    expect(PROBES.requestIndexingButton).toMatch(/\[role\s*=\s*button\]/);
    expect(PROBES.requestIndexingButton).toContain('请求编入索引');
  });

  it('isAlreadyIndexed 排除「尚未收录」文案', () => {
    expect(PROBES.isAlreadyIndexed).toContain('网址尚未收录到 Google');
    expect(PROBES.isAlreadyIndexed).toContain('已编入索引');
  });

  it('successIndicator 匹配真实成功 toast 文案', () => {
    expect(PROBES.successIndicator).toContain('已将网址添加到优先抓取队列');
  });
});
