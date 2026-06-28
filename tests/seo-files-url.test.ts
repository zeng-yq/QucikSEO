import { describe, it, expect } from 'vitest';
import { buildSeoFileUrl, normalizeOrigin } from '../lib/seo-files/url';

describe('seo-files url', () => {
  it('无协议时自动补 https 并拼接 robots.txt', () => {
    expect(buildSeoFileUrl('bottleneck-checker.com', 'robots.txt'))
      .toBe('https://bottleneck-checker.com/robots.txt');
  });

  it('拼接 sitemap.xml', () => {
    expect(buildSeoFileUrl('bottleneck-checker.com', 'sitemap.xml'))
      .toBe('https://bottleneck-checker.com/sitemap.xml');
  });

  it('已带 https 与结尾斜杠时正常工作', () => {
    expect(buildSeoFileUrl('https://bottleneck-checker.com/', 'robots.txt'))
      .toBe('https://bottleneck-checker.com/robots.txt');
  });

  it('丢弃输入的路径，只取域名根', () => {
    expect(buildSeoFileUrl('https://bottleneck-checker.com/foo/bar', 'robots.txt'))
      .toBe('https://bottleneck-checker.com/robots.txt');
  });

  it('保留 www 子域', () => {
    expect(buildSeoFileUrl('www.bottleneck-checker.com', 'robots.txt'))
      .toBe('https://www.bottleneck-checker.com/robots.txt');
  });

  it('保留 http 协议', () => {
    expect(buildSeoFileUrl('http://example.com', 'robots.txt'))
      .toBe('http://example.com/robots.txt');
  });

  it('normalizeOrigin 丢弃路径、查询与锚点', () => {
    expect(normalizeOrigin('https://example.com/a?b=1#x')).toBe('https://example.com');
  });

  it('trim 输入两端空白', () => {
    expect(normalizeOrigin('  bottleneck-checker.com  ')).toBe('https://bottleneck-checker.com');
  });

  it('空输入抛错', () => {
    expect(() => buildSeoFileUrl('   ', 'robots.txt')).toThrow();
  });

  it('非法网址抛错', () => {
    // 含空格等非法字符，补 https:// 后 URL 解析失败
    expect(() => buildSeoFileUrl('not a url', 'robots.txt')).toThrow();
  });
});
