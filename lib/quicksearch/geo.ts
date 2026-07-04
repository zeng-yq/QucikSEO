/**
 * Google 搜索地理位置伪装 —— 核心：通过 declarativeNetRequest 注入 x-geo 头
 * (UULE 编码经纬度) + accept-language 头，让 Google 返回目标国家视角的结果。
 * 机制移植自 gslocation v3.9 genUULE()。
 * 设计：docs/superpowers/specs/2026-07-04-google-search-geo-design.md
 */

export type GeoCode = 'US' | 'DE' | 'JP' | 'ES' | 'GB' | 'FR' | 'CA' | 'AU' | 'OFF';

export interface GeoRegion {
  code: Exclude<GeoCode, 'OFF'>;
  label: string; // UI 显示名
  flag: string; // emoji
  gl: string; // ISO alpha-2，语义保留
  lat: number;
  lng: number;
}

/** 精选 8 国（首都/代表城市坐标）。 */
export const GEO_REGIONS: GeoRegion[] = [
  { code: 'US', label: '美国', flag: '🇺🇸', gl: 'US', lat: 37.4224, lng: -122.0842 }, // 山景城（gslocation 默认坐标）
  { code: 'DE', label: '德国', flag: '🇩🇪', gl: 'DE', lat: 52.52, lng: 13.405 }, // 柏林
  { code: 'JP', label: '日本', flag: '🇯🇵', gl: 'JP', lat: 35.6762, lng: 139.6503 }, // 东京
  { code: 'ES', label: '西班牙', flag: '🇪🇸', gl: 'ES', lat: 40.4168, lng: -3.7038 }, // 马德里
  { code: 'GB', label: '英国', flag: '🇬🇧', gl: 'GB', lat: 51.5074, lng: -0.1278 }, // 伦敦
  { code: 'FR', label: '法国', flag: '🇫🇷', gl: 'FR', lat: 48.8566, lng: 2.3522 }, // 巴黎
  { code: 'CA', label: '加拿大', flag: '🇨🇦', gl: 'CA', lat: 43.6532, lng: -79.3832 }, // 多伦多
  { code: 'AU', label: '澳大利亚', flag: '🇦🇺', gl: 'AU', lat: -33.8688, lng: 151.2093 }, // 悉尼
];

export const DEFAULT_GEO_CODE: GeoCode = 'US';
export const GEO_OFF: GeoCode = 'OFF';

/** UULE 编码：lat/lng × 1e7 → proto-text → base64，前缀 "a "。移植自 gslocation genUULE()。 */
export function encodeXGeo(lat: number, lng: number): string {
  const latE7 = Math.floor(lat * 1e7);
  const lngE7 = Math.floor(lng * 1e7);
  const plain =
    'role: CURRENT_LOCATION\nproducer: DEVICE_LOCATION\nradius: 65000\n' +
    'latlng <\n' +
    `  latitude_e7: ${latE7}\n  longitude_e7: ${lngE7}\n>`;
  return 'a ' + btoa(plain);
}

/** code → GeoRegion；OFF / 未知 / 缺省 → null（等同关闭）。 */
export function resolveGeo(code: string | undefined): GeoRegion | null {
  if (!code || code === GEO_OFF) return null;
  return GEO_REGIONS.find((r) => r.code === code) ?? null;
}
