# Google 搜索地理位置切换 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在关键词工具的「快捷搜索」卡片加一个国家下拉,选中即全局伪装 Google 搜索的地理位置(经 `x-geo` HTTP 头注入),默认开启美国,精选 8 国可切换。

**Architecture:** 新增纯逻辑模块 `lib/quicksearch/geo.ts`(数据 + UULE 编码 + `declarativeNetRequest` 规则引擎 + storage 读写);`background.ts` 在启动/安装/storage 变化时调用 `applyGeo` 增删会话规则并清 `UULE` cookie;`QuickSearchTool.tsx` 加一个 `Select` 下拉写偏好;`wxt.config.ts` 补 `declarativeNetRequestWithHostAccess` + `cookies` 权限。核心机制移植自 [gslocation](https://github.com/VorticonCmdr/gslocation) v3.9 的 `genUULE()`。

**Tech Stack:** TypeScript 5.9 · WXT 0.20 · React 19 · MV3 `declarativeNetRequest` · Vitest 3 + jsdom + @testing-library/react

## Global Constraints

- 严格 TypeScript(`npm run compile` = `tsc --noEmit` 必须零错)。
- 测试用 Vitest;**测试文件用相对路径 import**(`../lib/...`),跟随 `tests/quicksearch-url.test.ts` 惯例(尽管 vite alias `@lib` 存在)。
- UI 文案**硬编码中文**(项目无 i18n),跟随 `AhrefsTool.tsx` 的 `labelStyle` + `Select` 模式。
- chrome API 测试基础设施在 `tests/setup.ts`(已 mock `storage.local` 含 `onChanged`、`tabs`、`runtime` 等);**未 mock `declarativeNetRequest`/`cookies`**,需它们的测试自行补。
- 存储:`chrome.storage.local`,key 命名跟随关键词工具惯例(`kw-tools:*`)。
- commit 中文 `feat(scope):` / `test(scope):` 风格,小步频繁提交。
- 设计依据:`docs/superpowers/specs/2026-07-04-google-search-geo-design.md`。

## File Structure

| 动作 | 文件 | 责任 |
|---|---|---|
| 新建 | `lib/quicksearch/geo.ts` | `GeoCode`/`GeoRegion` 类型、`GEO_REGIONS`(8 国)、`encodeXGeo`、`resolveGeo`、`applyGeo`、`clearUuleCookies`、`getGeoPref`/`setGeoPref`、常量 |
| 新建 | `tests/quicksearch-geo.test.ts` | 纯函数 + 副作用(mock dnr/cookies)+ storage 用例 |
| 改 | `entrypoints/background.ts` | `onStartup`/`onInstalled` 重建规则 + `storage.onChanged` 实时切换 |
| 改 | `entrypoints/sidepanel/pages/QuickSearchTool.tsx` | `Select` 下拉 + label + geo state/effect |
| 改 | `tests/quick-search-tool.test.tsx` | 追加下拉渲染 + 切换写 storage 断言 |
| 改 | `wxt.config.ts` | `permissions` 加 `declarativeNetRequestWithHostAccess`、`cookies` |

---

## Task 1: geo.ts 纯函数层(类型 + 8 国数据 + UULE 编码 + resolveGeo)

**Files:**
- Create: `lib/quicksearch/geo.ts`
- Test: `tests/quicksearch-geo.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `type GeoCode`、`interface GeoRegion`、`const GEO_REGIONS`、`const DEFAULT_GEO_CODE`(`'US'`)、`const GEO_OFF`(`'OFF'`)、`encodeXGeo(lat: number, lng: number): string`、`resolveGeo(code: string | undefined): GeoRegion | null`

- [ ] **Step 1: 写失败测试(创建 `tests/quicksearch-geo.test.ts`)**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/quicksearch-geo.test.ts`
Expected: FAIL —— `Failed to resolve import "../lib/quicksearch/geo"`(文件不存在)。

- [ ] **Step 3: 实现 `lib/quicksearch/geo.ts` 纯函数部分**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/quicksearch-geo.test.ts`
Expected: PASS(3 个 describe 块全部绿)。

- [ ] **Step 5: 提交**

```bash
git add lib/quicksearch/geo.ts tests/quicksearch-geo.test.ts
git commit -m "feat(quicksearch): geo 纯函数层（8 国数据 + UULE 编码 + resolveGeo）"
```

---

## Task 2: geo.ts 副作用层(applyGeo + clearUuleCookies + getGeoPref/setGeoPref)

**Files:**
- Modify: `lib/quicksearch/geo.ts`(追加)
- Modify: `tests/quicksearch-geo.test.ts`(追加)

**Interfaces:**
- Consumes: `GEO_REGIONS`、`encodeXGeo`、`resolveGeo`、`DEFAULT_GEO_CODE`、`GeoRegion`、`GeoCode`(Task 1)
- Produces: `applyGeo(region: GeoRegion | null): Promise<void>`、`getGeoPref(): Promise<{ code: GeoCode }>`、`setGeoPref(code: GeoCode): Promise<void>`、`const GEO_STORAGE_KEY`(`'kw-tools:geo'`)

- [ ] **Step 1: 在测试文件追加 mock 工具与副作用/storage 用例**

把 `tests/quicksearch-geo.test.ts` 顶部的 import 行扩展为:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encodeXGeo,
  resolveGeo,
  applyGeo,
  getGeoPref,
  setGeoPref,
  GEO_REGIONS,
  GEO_STORAGE_KEY,
  DEFAULT_GEO_CODE,
  GEO_OFF,
} from '../lib/quicksearch/geo';
```

在文件末尾追加:

```ts
/**
 * chrome.declarativeNetRequest / cookies 在 tests/setup.ts 未 mock，
 * 本文件内补一个最小 mock，返回可断言的 spy。
 */
function installDnrCookieMocks(cookies: chrome.cookies.Cookie[] = []) {
  const dnr = {
    updateSessionRules: vi.fn(async (_opts: unknown) => {}),
  };
  const cookiesApi = {
    getAll: vi.fn(async (_filter: { name: string }) => cookies),
    remove: vi.fn(async (_details: { name: string; url: string }) => ({})),
  };
  (chrome as unknown as { declarativeNetRequest: unknown }).declarativeNetRequest = dnr;
  (chrome as unknown as { cookies: unknown }).cookies = cookiesApi;
  return { dnr, cookiesApi };
}

describe('applyGeo', () => {
  it('传 region：先删旧规则 + 清 UULE，再加含 x-geo / accept-language 的新规则', async () => {
    const { dnr, cookiesApi } = installDnrCookieMocks([
      { name: 'UULE', domain: '.google.com', path: '/' } as chrome.cookies.Cookie,
    ]);
    await applyGeo(resolveGeo('DE'));

    expect(dnr.updateSessionRules).toHaveBeenCalledTimes(2);
    expect(dnr.updateSessionRules).toHaveBeenNthCalledWith(1, { removeRuleIds: [1] });
    const addCall = (dnr.updateSessionRules as ReturnType<typeof vi.fn>).mock.calls[1][0] as {
      addRules: Array<{
        id: number;
        action: { requestHeaders: Array<{ header: string; operation: string; value: string }> };
        condition: { urlFilter: string; resourceTypes: string[] };
      }>;
    };
    expect(addCall.addRules).toHaveLength(1);
    const rule = addCall.addRules[0];
    expect(rule.id).toBe(1);
    expect(rule.condition.urlFilter).toBe('google.com');
    const xgeo = rule.action.requestHeaders.find((h) => h.header === 'x-geo');
    const al = rule.action.requestHeaders.find((h) => h.header === 'accept-language');
    expect(xgeo?.value.startsWith('a ')).toBe(true);
    expect(al?.value).toBe('en');
    expect(cookiesApi.getAll).toHaveBeenCalledWith({ name: 'UULE' });
    expect(cookiesApi.remove).toHaveBeenCalled();
  });

  it('传 null：只删规则 + 清 cookie，不 addRules', async () => {
    const { dnr } = installDnrCookieMocks([]);
    await applyGeo(null);
    expect(dnr.updateSessionRules).toHaveBeenCalledTimes(1);
    expect((dnr.updateSessionRules as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      removeRuleIds: [1],
    });
  });

  it('clearUuleCookies：domain 带前导点时拼出无点的合法 url', async () => {
    const { cookiesApi } = installDnrCookieMocks([
      { name: 'UULE', domain: '.google.com', path: '/' } as chrome.cookies.Cookie,
    ]);
    await applyGeo(null);
    expect(cookiesApi.remove).toHaveBeenCalledWith({
      name: 'UULE',
      url: 'https://google.com/',
    });
  });
});

describe('geo pref storage', () => {
  beforeEach(() => {
    // setup.ts 的 beforeEach 已清空 storage；这里无需额外操作，显式留空表明隔离意图。
  });

  it('空 storage → 默认 US', async () => {
    expect(await getGeoPref()).toEqual({ code: 'US' });
  });

  it('setGeoPref 后 getGeoPref 返回新值，且写入含 ts', async () => {
    await setGeoPref('DE');
    expect(await getGeoPref()).toEqual({ code: 'DE' });
    const items = (await chrome.storage.local.get(GEO_STORAGE_KEY)) as Record<string, { code: string; ts: number }>;
    expect(items[GEO_STORAGE_KEY].code).toBe('DE');
    expect(typeof items[GEO_STORAGE_KEY].ts).toBe('number');
  });

  it('脏数据（无 code 字段）→ 回落默认 US', async () => {
    await chrome.storage.local.set({ [GEO_STORAGE_KEY]: { foo: 'bar' } });
    expect(await getGeoPref()).toEqual({ code: DEFAULT_GEO_CODE });
  });
});
```

- [ ] **Step 2: 跑测试确认新增用例失败**

Run: `npx vitest run tests/quicksearch-geo.test.ts`
Expected: FAIL —— `applyGeo`/`getGeoPref`/`setGeoPref`/`GEO_STORAGE_KEY` 未导出(不存在)。

- [ ] **Step 3: 在 `lib/quicksearch/geo.ts` 末尾追加副作用层**

```ts

const RULE_ID = 1;
const ACCEPT_LANG = 'en';
const GEO_HOST_FILTER = 'google.com';

/** storage key（跟随关键词工具 kw-tools:* 命名惯例）。 */
export const GEO_STORAGE_KEY = 'kw-tools:geo';

interface GeoPref {
  code: GeoCode;
  ts: number;
}

/**
 * 应用地理位置：先移除旧会话规则 + 清 UULE cookie，再写新规则。
 * 传 null = 关闭（只清不加），恢复真实位置。
 */
export async function applyGeo(region: GeoRegion | null): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] });
  await clearUuleCookies();
  if (!region) return;
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'x-geo', operation: 'set', value: encodeXGeo(region.lat, region.lng) },
            { header: 'accept-language', operation: 'set', value: ACCEPT_LANG },
          ],
        },
        condition: {
          urlFilter: GEO_HOST_FILTER,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'image', 'ping'],
        },
      },
    ],
  });
}

/**
 * 删 Google 回写的 UULE cookie。
 * domain 可能带前导 '.'（如 .google.com），去掉才能拼合法 URL（gslocation 原版此处有隐患，修正）。
 */
async function clearUuleCookies(): Promise<void> {
  const cookies = await chrome.cookies.getAll({ name: 'UULE' });
  await Promise.all(
    cookies.map((c) => {
      const host = c.domain.replace(/^\./, '');
      return chrome.cookies.remove({ name: 'UULE', url: `https://${host}${c.path}` });
    }),
  );
}

/** 读取位置偏好；空/脏 storage → 默认 US。 */
export async function getGeoPref(): Promise<{ code: GeoCode }> {
  const items = (await chrome.storage.local.get(GEO_STORAGE_KEY)) as Record<string, Partial<GeoPref> | undefined>;
  const code = items[GEO_STORAGE_KEY]?.code;
  return { code: code ?? DEFAULT_GEO_CODE };
}

/** 写入位置偏好（含时间戳）。 */
export async function setGeoPref(code: GeoCode): Promise<void> {
  await chrome.storage.local.set({ [GEO_STORAGE_KEY]: { code, ts: Date.now() } satisfies GeoPref });
}
```

- [ ] **Step 4: 跑测试确认全部通过**

Run: `npx vitest run tests/quicksearch-geo.test.ts`
Expected: PASS(全部 describe 块绿,共约 9 个用例)。

- [ ] **Step 5: 类型检查**

Run: `npm run compile`
Expected: 无输出,退出码 0(`tsc --noEmit` 通过)。

- [ ] **Step 6: 提交**

```bash
git add lib/quicksearch/geo.ts tests/quicksearch-geo.test.ts
git commit -m "feat(quicksearch): geo 副作用层（applyGeo 规则引擎 + UULE 清理 + storage 读写）"
```

---

## Task 3: background.ts 接入(启动重建 + storage 变化实时切换)

**Files:**
- Modify: `entrypoints/background.ts`

**Interfaces:**
- Consumes: `getGeoPref`、`applyGeo`、`resolveGeo`、`GEO_STORAGE_KEY`、`DEFAULT_GEO_CODE`、`type GeoCode`(Task 1/2)
- Produces: 无(背景侧集成,不暴露新接口)

> 说明:`background.ts` 沿用项目"无背景脚本单测"惯例(现有 `tests/` 下无 `background.test.ts`)。本任务靠类型检查 + 现有测试回归 + Task 5 手动验证保证。

- [ ] **Step 1: 在 `entrypoints/background.ts` 的 import 区追加一行**

在现有 `import { handleSitemapRequest } from '../lib/sitemap/handler';`(第 32 行)之后追加:

```ts
import { getGeoPref, applyGeo, resolveGeo, GEO_STORAGE_KEY, DEFAULT_GEO_CODE, type GeoCode } from '../lib/quicksearch/geo';
```

- [ ] **Step 2: 在 `defineBackground(() => { ... })` 内顶部追加 geo 监听**

定位 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});`(约第 70 行),在其**之后**追加:

```ts
  /**
   * Google 搜索地理位置伪装：启动/安装时按 storage 重建 sessionRules；
   * UI 切换（写 'kw-tools:geo'）→ storage.onChanged → 实时增删规则 + 清 UULE。
   * 默认 storage 为空 → getGeoPref 返回 'US' → 即默认开启美国。
   * 设计：docs/superpowers/specs/2026-07-04-google-search-geo-design.md
   */
  chrome.runtime.onStartup.addListener(initGeo);
  chrome.runtime.onInstalled.addListener(initGeo);
  async function initGeo(): Promise<void> {
    const { code } = await getGeoPref();
    await applyGeo(resolveGeo(code));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[GEO_STORAGE_KEY]) return;
    const code = (changes[GEO_STORAGE_KEY].newValue as { code?: GeoCode } | undefined)?.code ?? DEFAULT_GEO_CODE;
    void applyGeo(resolveGeo(code));
  });
```

- [ ] **Step 3: 类型检查 + 全量测试回归**

Run: `npm run compile`
Expected: 无输出,退出码 0。

Run: `npx vitest run`
Expected: 全部既有测试绿(改动未破坏现有用例)。

- [ ] **Step 4: 提交**

```bash
git add entrypoints/background.ts
git commit -m "feat(background): 接入 Google 搜索地理位置伪装（onStartup/onInstalled + storage.onChanged）"
```

---

## Task 4: QuickSearchTool UI(搜索位置下拉)+ 组件测试

**Files:**
- Modify: `entrypoints/sidepanel/pages/QuickSearchTool.tsx`
- Modify: `tests/quick-search-tool.test.tsx`

**Interfaces:**
- Consumes: `GEO_REGIONS`、`GEO_OFF`、`getGeoPref`、`setGeoPref`、`type GeoCode`(Task 1/2);现有 `Select`、`Button`、`ToolPanel`、`buildGoogleSearchUrl`、`buildBingSearchUrl`
- Produces: `QuickSearchTool` 渲染一个额外 `<select>`(value=当前 `GeoCode`),切换时调 `setGeoPref`

- [ ] **Step 1: 在 `tests/quick-search-tool.test.tsx` 追加下拉用例**

在文件末尾(`describe` 块内最后)追加两个 `it`:

```ts
  it('渲染「搜索位置」下拉，默认选中美国', () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('US');
  });

  it('切换下拉写入 kw-tools:geo', async () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'DE' } });
    const items = (await chrome.storage.local.get('kw-tools:geo')) as Record<string, { code: string }>;
    expect(items['kw-tools:geo'].code).toBe('DE');

    fireEvent.change(select, { target: { value: 'OFF' } });
    const items2 = (await chrome.storage.local.get('kw-tools:geo')) as Record<string, { code: string }>;
    expect(items2['kw-tools:geo'].code).toBe('OFF');
  });
```

- [ ] **Step 2: 跑测试确认新增用例失败**

Run: `npx vitest run tests/quick-search-tool.test.tsx`
Expected: FAIL —— `container.querySelector('select')` 为 null(组件还没 Select)。

- [ ] **Step 3: 改造 `entrypoints/sidepanel/pages/QuickSearchTool.tsx`**

整文件替换为:

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl } from '@lib/quicksearch/url';
import { GEO_REGIONS, GEO_OFF, getGeoPref, setGeoPref, type GeoCode } from '@lib/quicksearch/geo';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 };

interface Props { keyword: string; }

export default function QuickSearchTool({ keyword }: Props) {
  const disabled = !keyword.trim();
  const [geoCode, setGeoCode] = useState<GeoCode>('US');

  useEffect(() => {
    void (async () => setGeoCode((await getGeoPref()).code))();
  }, []);

  function onGeoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as GeoCode;
    setGeoCode(v);
    void setGeoPref(v); // background 监听 storage 变化，实时增删规则
  }

  const geoOptions = [
    { value: GEO_OFF, label: '🚪 关闭（用真实位置）' },
    ...GEO_REGIONS.map((r) => ({ value: r.code, label: `${r.flag} ${r.label}` })),
  ];

  return (
    <ToolPanel logo={<GoogleLogo size={18} />} title="快捷搜索">
      <label style={labelStyle}>搜索位置</label>
      <div style={{ marginBottom: 8 }}>
        <Select value={geoCode} options={geoOptions} onChange={onGeoChange} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <GoogleLogo size={14} /> 用 Google 搜
          </span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildBingSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <BingLogo size={14} /> 用 Bing 搜
          </span>
        </Button>
      </div>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑组件测试确认通过**

Run: `npx vitest run tests/quick-search-tool.test.tsx`
Expected: PASS(原有 3 个 + 新增 2 个用例全绿)。

- [ ] **Step 5: 类型检查 + 全量回归**

Run: `npm run compile`
Expected: 无输出,退出码 0。

Run: `npx vitest run`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/pages/QuickSearchTool.tsx tests/quick-search-tool.test.tsx
git commit -m "feat(quicksearch): 快捷搜索加「搜索位置」下拉（8 国 + 关闭，默认美国）"
```

---

## Task 5: wxt.config.ts 权限 + 全量回归 + 手动验证

**Files:**
- Modify: `wxt.config.ts`

**Interfaces:**
- Consumes: 无
- Produces: manifest 声明 `declarativeNetRequestWithHostAccess` + `cookies` 权限(否则运行时 `chrome.declarativeNetRequest`/`chrome.cookies` 为 undefined)

- [ ] **Step 1: 改 `wxt.config.ts` 的 permissions**

把 `manifest.permissions` 数组(第 10 行):

```ts
    permissions: ['debugger', 'tabs', 'sidePanel', 'storage'],
```

替换为:

```ts
    permissions: ['debugger', 'tabs', 'sidePanel', 'storage', 'declarativeNetRequestWithHostAccess', 'cookies'],
```

(`host_permissions` 已含 `'<all_urls>'`,覆盖 `google.com`,无需改。)

- [ ] **Step 2: 类型检查 + 全量测试**

Run: `npm run compile`
Expected: 无输出,退出码 0。

Run: `npx vitest run`
Expected: 全绿(`tests/quicksearch-geo.test.ts` + `tests/quick-search-tool.test.tsx` + 所有既有用例)。

- [ ] **Step 3: 提交**

```bash
git add wxt.config.ts
git commit -m "feat(quicksearch): manifest 加 declarativeNetRequestWithHostAccess + cookies 权限"
```

- [ ] **Step 4: 手动验证(需真实浏览器,执行者或用户操作)**

> 前置:`web-ext.config.ts` 顶部注释要求 dev 前先 Cmd+Q 退出已运行的 Edge。运行 `npm run dev` 启动 WXT dev。

逐项验证:
1. 打开 Side Panel →「关键词工具」→「快捷搜索」,确认「搜索位置」下拉存在,默认选中 `🇺🇸 美国`。
2. 输入一个关键词(如 `pizza`),点「用 Google 搜」,确认打开的是美国视角结果(URL 仍是 `google.com/search`,但结果偏美国,可能含美国本地包)。
3. 打开该 Google tab 的 DevTools → Network → 点任一 `google.com` 请求 → Request Headers,确认存在:
   - `x-geo: a <base64>`(以 `a ` 开头)
   - `accept-language: en`
4. 回 Side Panel 把下拉切到 `🇩🇪 德国`,重新点「用 Google 搜」,确认结果是德国视角(德语本地结果、`.de` 站点靠前);DevTools 里 `x-geo` 值已变(经纬度换成柏林)。
5. 切到 `🇯🇵 日本`、`🇪🇸 西班牙`,重复确认结果视角随之变化。
6. 切到 `🚪 关闭(用真实位置)`,重新搜,确认 DevTools 里 `google.com` 请求**不再**有 `x-geo` 头,结果回到真实位置。
7. 完全退出并重启浏览器,重新打开 Side Panel:下拉应停在最后一次的选择(如德国),且 Google 搜索仍带 `x-geo`(`onStartup` 重建规则生效)。

- [ ] **Step 5: 收尾提交(如有验证中发现的微调)**

若手动验证中发现需微调(如文案、坐标),改完后再跑 `npx vitest run` + `npm run compile`,然后:

```bash
git add -A
git commit -m "fix(quicksearch): 手动验证后的微调"
```

若无需调整,跳过本步。

---

## 完成标志

- 5 个任务全部 commit;`npx vitest run` 与 `npm run compile` 均通过。
- 手动验证 7 项全部符合预期。
- 新增/改动文件与本计划「File Structure」一致。
