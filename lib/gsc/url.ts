/**
 * 拼接 Google Search Console 资源首页 URL。
 *
 * 形如：`https://search.google.com/u/{i}/search-console?resource_id=sc-domain%3A{domain}`
 *
 * @param domain 资源域名（如 `bottleneck-checker.com`），会被 trim。
 * @param accountIndex 多账号场景下的 `/u/{i}/` 序号，默认 0（首个登录账号）。
 */
export function buildGscUrl(domain: string, accountIndex = 0): string {
  const d = domain.trim();
  if (!d) throw new Error('domain required');
  return `https://search.google.com/u/${accountIndex}/search-console?resource_id=${encodeURIComponent('sc-domain:' + d)}`;
}
