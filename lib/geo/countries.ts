/**
 * 统一国家数据源（关键词工具的唯一真相来源）。
 * - Ahrefs Difficulty Checker：取 code 拼 URL 参数（任意两位代码可用）。
 * - QuickSearch 地理伪装：取 lat/lng 经 UULE 编码注入 x-geo 头，故每国必须带坐标。
 * code 统一用 ISO 3166-1 alpha-2 小写；geo.ts 派生 GEO_REGIONS 时转大写以兼容旧 storage。
 */
export interface Country {
  code: string; // ISO alpha-2 小写，如 'us'
  label: string; // 中文名，如 '美国'
  en: string; // 英文名（搜索用），如 'United States'
  flag: string; // emoji 国旗
  lat: number; // 代表城市纬度
  lng: number; // 代表城市经度
}

/** 40 个常用市场。原有 8 国坐标保持不变；其余取首都/代表城市公开坐标。 */
export const COUNTRIES: Country[] = [
  { code: 'us', label: '美国', en: 'United States', flag: '🇺🇸', lat: 37.4224, lng: -122.0842 }, // 山景城
  { code: 'gb', label: '英国', en: 'United Kingdom', flag: '🇬🇧', lat: 51.5074, lng: -0.1278 }, // 伦敦
  { code: 'ca', label: '加拿大', en: 'Canada', flag: '🇨🇦', lat: 43.6532, lng: -79.3832 }, // 多伦多
  { code: 'au', label: '澳大利亚', en: 'Australia', flag: '🇦🇺', lat: -33.8688, lng: 151.2093 }, // 悉尼
  { code: 'de', label: '德国', en: 'Germany', flag: '🇩🇪', lat: 52.52, lng: 13.405 }, // 柏林
  { code: 'fr', label: '法国', en: 'France', flag: '🇫🇷', lat: 48.8566, lng: 2.3522 }, // 巴黎
  { code: 'jp', label: '日本', en: 'Japan', flag: '🇯🇵', lat: 35.6762, lng: 139.6503 }, // 东京
  { code: 'es', label: '西班牙', en: 'Spain', flag: '🇪🇸', lat: 40.4168, lng: -3.7038 }, // 马德里
  { code: 'it', label: '意大利', en: 'Italy', flag: '🇮🇹', lat: 41.9028, lng: 12.4964 }, // 罗马
  { code: 'nl', label: '荷兰', en: 'Netherlands', flag: '🇳🇱', lat: 52.3676, lng: 4.9041 }, // 阿姆斯特丹
  { code: 'be', label: '比利时', en: 'Belgium', flag: '🇧🇪', lat: 50.8503, lng: 4.3517 }, // 布鲁塞尔
  { code: 'ch', label: '瑞士', en: 'Switzerland', flag: '🇨🇭', lat: 47.3769, lng: 8.5417 }, // 苏黎世
  { code: 'at', label: '奥地利', en: 'Austria', flag: '🇦🇹', lat: 48.2082, lng: 16.3738 }, // 维也纳
  { code: 'se', label: '瑞典', en: 'Sweden', flag: '🇸🇪', lat: 59.3293, lng: 18.0686 }, // 斯德哥尔摩
  { code: 'no', label: '挪威', en: 'Norway', flag: '🇳🇴', lat: 59.9139, lng: 10.7522 }, // 奥斯陆
  { code: 'ie', label: '爱尔兰', en: 'Ireland', flag: '🇮🇪', lat: 53.3498, lng: -6.2603 }, // 都柏林
  { code: 'pt', label: '葡萄牙', en: 'Portugal', flag: '🇵🇹', lat: 38.7223, lng: -9.1393 }, // 里斯本
  { code: 'gr', label: '希腊', en: 'Greece', flag: '🇬🇷', lat: 37.9838, lng: 23.7275 }, // 雅典
  { code: 'pl', label: '波兰', en: 'Poland', flag: '🇵🇱', lat: 52.2297, lng: 21.0122 }, // 华沙
  { code: 'ru', label: '俄罗斯', en: 'Russia', flag: '🇷🇺', lat: 55.7558, lng: 37.6173 }, // 莫斯科
  { code: 'tr', label: '土耳其', en: 'Turkey', flag: '🇹🇷', lat: 41.0082, lng: 28.9784 }, // 伊斯坦布尔
  { code: 'cn', label: '中国', en: 'China', flag: '🇨🇳', lat: 39.9042, lng: 116.4074 }, // 北京
  { code: 'kr', label: '韩国', en: 'South Korea', flag: '🇰🇷', lat: 37.5665, lng: 126.978 }, // 首尔
  { code: 'in', label: '印度', en: 'India', flag: '🇮🇳', lat: 19.076, lng: 72.8777 }, // 孟买
  { code: 'id', label: '印度尼西亚', en: 'Indonesia', flag: '🇮🇩', lat: -6.2088, lng: 106.8456 }, // 雅加达
  { code: 'th', label: '泰国', en: 'Thailand', flag: '🇹🇭', lat: 13.7563, lng: 100.5018 }, // 曼谷
  { code: 'vn', label: '越南', en: 'Vietnam', flag: '🇻🇳', lat: 10.8231, lng: 106.6297 }, // 胡志明市
  { code: 'my', label: '马来西亚', en: 'Malaysia', flag: '🇲🇾', lat: 3.139, lng: 101.6869 }, // 吉隆坡
  { code: 'ph', label: '菲律宾', en: 'Philippines', flag: '🇵🇭', lat: 14.5995, lng: 120.9842 }, // 马尼拉
  { code: 'sg', label: '新加坡', en: 'Singapore', flag: '🇸🇬', lat: 1.3521, lng: 103.8198 },
  { code: 'nz', label: '新西兰', en: 'New Zealand', flag: '🇳🇿', lat: -36.8485, lng: 174.7633 }, // 奥克兰
  { code: 'sa', label: '沙特阿拉伯', en: 'Saudi Arabia', flag: '🇸🇦', lat: 24.7136, lng: 46.6753 }, // 利雅得
  { code: 'ae', label: '阿联酋', en: 'United Arab Emirates', flag: '🇦🇪', lat: 25.2048, lng: 55.2708 }, // 迪拜
  { code: 'br', label: '巴西', en: 'Brazil', flag: '🇧🇷', lat: -23.5558, lng: -46.6396 }, // 圣保罗
  { code: 'mx', label: '墨西哥', en: 'Mexico', flag: '🇲🇽', lat: 19.4326, lng: -99.1332 }, // 墨西哥城
  { code: 'ar', label: '阿根廷', en: 'Argentina', flag: '🇦🇷', lat: -34.6037, lng: -58.3816 }, // 布宜诺斯艾利斯
  { code: 'cl', label: '智利', en: 'Chile', flag: '🇨🇱', lat: -33.4489, lng: -70.6693 }, // 圣地亚哥
  { code: 'za', label: '南非', en: 'South Africa', flag: '🇿🇦', lat: -26.2041, lng: 28.0473 }, // 约翰内斯堡
  { code: 'ng', label: '尼日利亚', en: 'Nigeria', flag: '🇳🇬', lat: 6.5244, lng: 3.3792 }, // 拉各斯
  { code: 'eg', label: '埃及', en: 'Egypt', flag: '🇪🇬', lat: 30.0444, lng: 31.2357 }, // 开罗
];

/** code（大小写不敏感）→ Country。 */
export function findCountry(code: string): Country | undefined {
  const cc = code.toLowerCase();
  return COUNTRIES.find((c) => c.code === cc);
}
