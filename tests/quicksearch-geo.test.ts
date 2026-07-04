import { describe, it, expect } from 'vitest';
import {
  encodeXGeo,
  resolveGeo,
  GEO_REGIONS,
  DEFAULT_GEO_CODE,
  GEO_OFF,
} from '../lib/quicksearch/geo';

describe('encodeXGeo', () => {
  it('以 "a " 前缀开头，base64 解码后含正确的 e7 经纬度与 proto 字段', () => {
    const v = encodeXGeo(37.4224, -122.0842);
    expect(v.startsWith('a ')).toBe(true);
    const plain = atob(v.slice(2));
    expect(plain).toContain('role: CURRENT_LOCATION');
    expect(plain).toContain('producer: DEVICE_LOCATION');
    expect(plain).toContain('radius: 65000');
    expect(plain).toContain('latitude_e7: 374224000');
    expect(plain).toContain('longitude_e7: -1220842000');
  });
});

describe('resolveGeo', () => {
  it('已知 code 返回对应 region', () => {
    expect(resolveGeo('US')?.label).toBe('美国');
    expect(resolveGeo('DE')?.gl).toBe('DE');
    expect(resolveGeo('JP')?.code).toBe('JP');
  });
  it('OFF / undefined / 未知 code 返回 null', () => {
    expect(resolveGeo(GEO_OFF)).toBeNull();
    expect(resolveGeo(undefined)).toBeNull();
    expect(resolveGeo('XX')).toBeNull();
  });
});

describe('GEO_REGIONS 数据完整性', () => {
  it('恰好 8 条，code 唯一，字段齐全，坐标在合理范围', () => {
    expect(GEO_REGIONS).toHaveLength(8);
    const codes = GEO_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of GEO_REGIONS) {
      expect(typeof r.label).toBe('string');
      expect(r.flag.length).toBeGreaterThan(0);
      expect(r.gl).toHaveLength(2);
      expect(r.lat).toBeGreaterThanOrEqual(-90);
      expect(r.lat).toBeLessThanOrEqual(90);
      expect(r.lng).toBeGreaterThanOrEqual(-180);
      expect(r.lng).toBeLessThanOrEqual(180);
    }
  });
  it('默认值与关闭值常量', () => {
    expect(DEFAULT_GEO_CODE).toBe('US');
    expect(GEO_OFF).toBe('OFF');
  });
});
