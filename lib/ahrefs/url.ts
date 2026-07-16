// 国家数据统一由 lib/geo/countries.ts 维护（与 QuickSearch 地理伪装共用同一份列表）。
export { COUNTRIES, type Country } from '../geo/countries';

const CC_RE = /^[a-z]{2}$/i;
export function isValidCountryCode(c: string): boolean {
  return CC_RE.test(c);
}

export function buildAhrefsUrl(country: string, keyword: string): string {
  const cc = country.trim().toLowerCase();
  if (!isValidCountryCode(cc)) throw new Error('invalid country code');
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://ahrefs.com/keyword-difficulty/?country=${cc}&input=${encodeURIComponent(kw)}`;
}
