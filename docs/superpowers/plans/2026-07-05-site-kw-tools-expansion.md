# 网站工具扩展 + 关键词工具 UI 调整 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在网站工具新增 6 个第三方 SEO/分析工具(数据驱动重构),并按 `tmp.md` 调整三个关键词工具卡片的文案与布局(含为快捷搜索新增 Yandex 引擎)。

**Architecture:** 网站工具从硬编码迁到 `SITE_TOOLS` 数组(`lib/site-tools/tools.ts`)+ 纯函数 url builder(`lib/site-tools/url.ts`),`ToolCard` 新增可选 `logo` prop 支持图片 logo。关键词工具三个卡片各自局部改造,共享壳 `ToolPanel` 不动。全部新 logo 下载到本地 `assets/logos/`,`brand-logos.tsx` 新增/调整导出。

**Tech Stack:** WXT 0.20 + React 19 + TypeScript 5.9,Vitest 3 + @testing-library/react(jsdom),inline-style + CSS 变量,Manifest V3 sidepanel。

## Global Constraints

- 测试:`pnpm test`(全量 vitest run)/ `pnpm test <文件名片段>`(单文件)。所有 chrome API(`tabs.create`、`storage.local`、`storage.onChanged`)已在 `tests/setup.ts` mock,用例间自动 reset。
- 类型检查:`pnpm compile`(tsc --noEmit)。源码用别名 `@lib/*`、`@components/*`、`@pages/*`;测试用相对路径 `../`(见 `vitest.config.ts`)。
- 样式:只用 inline `style` + CSS 变量(`--color-*` / `--space-*` / `--radius-*`),不引入 CSS-in-JS。`--color-hairline`(分隔线)、`--color-muted`(次要文字)、`--space-xs/sm/md/lg`、`--radius-md` 均已存在。
- logo 静态资源:放 `entrypoints/sidepanel/assets/logos/`,`import x from '....svg'` 由 Vite 处理为 url 字符串;`vite/client` 已 `declare module '*.png'/'*.svg'`,无需额外类型声明。
- commit:conventional commits 中文,scope 用 `site-tools` / `keyword-tools` / `toolcard` / `assets` 等。每个 Task 末尾各 commit 一次。
- 不破坏既有测试:改造某文件后,同步更新其对应 `tests/*.test.tsx` 的文案/结构断言,确保 `pnpm test` 全绿。
- 已在 `feat/site-kw-tools-expansion` 分支上(设计文档已 commit)。

---

## 文件结构

**新增:**
- `lib/site-tools/url.ts` — 网站工具 url builder(`buildBacklinkCheckerUrl`、`buildWebsiteAuthorityCheckerUrl`)。
- `lib/site-tools/tools.ts` — `SITE_TOOLS` 数据数组 + `SiteTool` 类型(含图片 logo import)。
- `tests/site-tools-url.test.ts` — 上面两个 builder 的单测。
- 9 个 logo 文件到 `entrypoints/sidepanel/assets/logos/`。

**修改:**
- `entrypoints/sidepanel/components/ToolCard.tsx` — 加可选 `logo?: string` prop。
- `entrypoints/sidepanel/components/brand-logos.tsx` — `AhrefsLogo` 换源;新增 `QuickSearchLogo`、`YandexLogo`。
- `entrypoints/sidepanel/pages/SiteTools.tsx` — 重构为 `SITE_TOOLS` 数据驱动渲染。
- `entrypoints/sidepanel/pages/AhrefsTool.tsx` — 副标题英文 + 去标签 + 按钮下放 + 文案。
- `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx` — 去副标题/小标题 + 对比词下移 + 搜索按钮下放。
- `entrypoints/sidepanel/pages/QuickSearchTool.tsx` — 改名 + 换 logo + 标签文案 + Google 与 geo 同行 + 新增 Yandex + 分割线。
- `lib/quicksearch/url.ts` — 新增 `buildYandexSearchUrl`。
- 对应 7 个测试文件 + 1 个新建测试。

---

## Task 1: logo 资源下载 + brand-logos 扩展

**Files:**
- Create: `entrypoints/sidepanel/assets/logos/backlink-checker.svg`
- Create: `entrypoints/sidepanel/assets/logos/website-authority-checker.svg`
- Create: `entrypoints/sidepanel/assets/logos/keyword-difficulty-checker.svg`
- Create: `entrypoints/sidepanel/assets/logos/google-analytics.svg`
- Create: `entrypoints/sidepanel/assets/logos/clarity.svg`
- Create: `entrypoints/sidepanel/assets/logos/pagespeed.svg`
- Create: `entrypoints/sidepanel/assets/logos/google-search-console.png`
- Create: `entrypoints/sidepanel/assets/logos/quick-search.png`
- Create: `entrypoints/sidepanel/assets/logos/yandex.png`
- Modify: `entrypoints/sidepanel/components/brand-logos.tsx`
- Test: `tests/brand-logos.test.tsx`

**Interfaces:**
- Produces: `brand-logos.tsx` 导出新增 `QuickSearchLogo`、`YandexLogo`;`AhrefsLogo` 内部 import 源换为 `keyword-difficulty-checker.svg`(导出名与签名 `{ size?: number }` 不变,供 Task 5、Task 7 使用)。

- [ ] **Step 1: 下载 9 个 logo 资源**

```bash
cd entrypoints/sidepanel/assets/logos
# seo.box 的 6 个 SVG(命名整齐,主源)
curl -fsSL -o backlink-checker.svg "https://seo.box/static/img/backlink-checker.svg"
curl -fsSL -o website-authority-checker.svg "https://seo.box/static/img/website-authority-checker.svg"
curl -fsSL -o keyword-difficulty-checker.svg "https://seo.box/static/img/keyword-difficulty-checker.svg"
curl -fsSL -o google-analytics.svg "https://seo.box/static/img/google_analytics.svg"
curl -fsSL -o clarity.svg "https://seo.box/static/img/clarity.svg"
curl -fsSL -o pagespeed.svg "https://seo.box/static/img/pagespeed.svg"
# bing.net 缩略图 3 个(可能不稳定)
curl -fsSL -o google-search-console.png "https://ts2.tc.mm.bing.net/th/id/OIP-C.2ejl-ESSjv6SQlYx8yFjMgHaHa?w=108&h=108&c=1&bgcl=c61334&r=0&o=7&dpr=2&pid=ImgRC&rm=3"
curl -fsSL -o quick-search.png "https://ts1.tc.mm.bing.net/th/id/OIP-C.L83RAs_rGRGaX3BxmY2S-wHaDt?w=108&h=108&c=1&bgcl=001771&r=0&o=7&dpr=2&pid=ImgRC&rm=3"
curl -fsSL -o yandex.png "https://ts2.tc.mm.bing.net/th/id/OIP-C._Gf94XN6zoQxQ-Mrer8HgwHaI8?w=108&h=108&c=1&bgcl=8111e9&r=0&o=7&dpr=2&pid=ImgRC&rm=3"
cd -
```

校验全部下载成功(每个文件非空):

```bash
ls -l entrypoints/sidepanel/assets/logos/ | grep -E 'backlink-checker|website-authority-checker|keyword-difficulty-checker|google-analytics|clarity|pagespeed|google-search-console|quick-search|yandex'
```

**降级:** 若某个 `curl` 返回非 0(常见于 `bing.net` 缩略图被拦),用占位 SVG 顶替并加 TODO,例如:
```bash
curl ... -o google-search-console.png || cat > entrypoints/sidepanel/assets/logos/google-search-console.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#4285F4"/><text x="32" y="40" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">G</text></svg>
EOF
```
占位时记得把后续 `tools.ts` / `brand-logos.tsx` 里对应的 import 扩展名改成 `.svg`,并在交付说明里告知用户手动替换。优先尝试真实下载。

- [ ] **Step 2: 更新 `tests/brand-logos.test.tsx`(加新组件,先写失败测试)**

把 `cases` 数组替换为(新增 `QuickSearchLogo`、`YandexLogo`):

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleLogo, BingLogo, AhrefsLogo, GoogleTrendsLogo, QuickSearchLogo, YandexLogo } from '../entrypoints/sidepanel/components/brand-logos';

describe('brand-logos', () => {
  const cases = [
    ['GoogleLogo', GoogleLogo],
    ['BingLogo', BingLogo],
    ['AhrefsLogo', AhrefsLogo],
    ['GoogleTrendsLogo', GoogleTrendsLogo],
    ['QuickSearchLogo', QuickSearchLogo],
    ['YandexLogo', YandexLogo],
  ] as const;

  it.each(cases)('%s 渲染为 <img>,默认 size=16 且 src 非空', (_name, Comp) => {
    const { container } = render(<Comp />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('16');
    expect(img!.getAttribute('height')).toBe('16');
    expect(img!.getAttribute('src')).toBeTruthy();
  });

  it.each(cases)('%s 支持 size prop', (_name, Comp) => {
    const { container } = render(<Comp size={28} />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('28');
    expect(img.getAttribute('height')).toBe('28');
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test brand-logos`
Expected: FAIL —— `QuickSearchLogo` / `YandexLogo` 未导出(import error)。

- [ ] **Step 4: 更新 `entrypoints/sidepanel/components/brand-logos.tsx`**

完整新内容(注意 `ahrefsLogoUrl` 改指向 `keyword-difficulty-checker.svg`,新增两个 import 与两个组件):

```tsx
import ahrefsLogoUrl from '../assets/logos/keyword-difficulty-checker.svg';
import googleTrendsLogoUrl from '../assets/logos/google-trends.png';
import googleLogoUrl from '../assets/logos/google.png';
import bingLogoUrl from '../assets/logos/bing.png';
import quickSearchLogoUrl from '../assets/logos/quick-search.png';
import yandexLogoUrl from '../assets/logos/yandex.png';

interface LogoProps { size?: number; }

const logoStyle: React.CSSProperties = {
  objectFit: 'contain',
  display: 'inline-block',
  lineHeight: 0,
};

/** Google — 四色 G。 */
export function GoogleLogo({ size = 16 }: LogoProps) {
  return <img src={googleLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Bing — 青绿色 b。 */
export function BingLogo({ size = 16 }: LogoProps) {
  return <img src={bingLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Ahrefs 关键词难度。 */
export function AhrefsLogo({ size = 16 }: LogoProps) {
  return <img src={ahrefsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Google Trends — 四色趋势线。 */
export function GoogleTrendsLogo({ size = 16 }: LogoProps) {
  return <img src={googleTrendsLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** 快捷搜索 header logo(搜索引擎聚合)。 */
export function QuickSearchLogo({ size = 16 }: LogoProps) {
  return <img src={quickSearchLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}

/** Yandex。 */
export function YandexLogo({ size = 16 }: LogoProps) {
  return <img src={yandexLogoUrl} width={size} height={size} alt="" aria-hidden="true" style={logoStyle} />;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test brand-logos`
Expected: PASS(6 个组件 × 2 用例全过)。

- [ ] **Step 6: Commit**

```bash
git add entrypoints/sidepanel/assets/logos/ entrypoints/sidepanel/components/brand-logos.tsx tests/brand-logos.test.tsx
git commit -m "feat(assets): 补充网站/关键词工具 logo 资源,brand-logos 新增 QuickSearch/Yandex"
```

---

## Task 2: 网站工具 url builder + SITE_TOOLS 数据

**Files:**
- Create: `lib/site-tools/url.ts`
- Create: `lib/site-tools/tools.ts`
- Test: `tests/site-tools-url.test.ts`

**Interfaces:**
- Consumes: `normalizeOrigin` from `@lib/seo-files/url`;`buildSeoFileUrl`、`SeoFile` from `@lib/seo-files/url`。
- Produces:
  - `buildBacklinkCheckerUrl(input: string): string` → `https://ahrefs.com/backlink-checker/?input=<host>&mode=subdomains`
  - `buildWebsiteAuthorityCheckerUrl(input: string): string` → `https://ahrefs.com/website-authority-checker/?input=<host>`
  - `SITE_TOOLS: SiteTool[]`,其中 `SiteTool = { id: string; name: string; logo?: string; icon?: 'robots'|'sitemap'; buildUrl: (domain: string) => string }`
  - 供 Task 4 的 `SiteTools.tsx` 直接 `map` 渲染。

- [ ] **Step 1: 写 `tests/site-tools-url.test.ts`(失败测试)**

```ts
import { describe, it, expect } from 'vitest';
import { buildBacklinkCheckerUrl, buildWebsiteAuthorityCheckerUrl } from '../lib/site-tools/url';

describe('site-tools url', () => {
  it('Backlink Checker 拼接 input 与固定 mode=subdomains', () => {
    expect(buildBacklinkCheckerUrl('vercel.com'))
      .toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
  });
  it('Backlink Checker 规范化 origin(去协议/路径)', () => {
    expect(buildBacklinkCheckerUrl('https://vercel.com/foo/bar'))
      .toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
  });
  it('Backlink Checker 保留 www 子域', () => {
    expect(buildBacklinkCheckerUrl('www.example.com'))
      .toBe('https://ahrefs.com/backlink-checker/?input=www.example.com&mode=subdomains');
  });
  it('Website Authority Checker 拼 input,不带 mode', () => {
    expect(buildWebsiteAuthorityCheckerUrl('vercel.com'))
      .toBe('https://ahrefs.com/website-authority-checker/?input=vercel.com');
  });
  it('空输入抛错', () => {
    expect(() => buildBacklinkCheckerUrl('   ')).toThrow();
    expect(() => buildWebsiteAuthorityCheckerUrl('')).toThrow();
  });
  it('非法网址抛错', () => {
    expect(() => buildBacklinkCheckerUrl('not a url')).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test site-tools-url`
Expected: FAIL —— 模块 `../lib/site-tools/url` 不存在。

- [ ] **Step 3: 创建 `lib/site-tools/url.ts`**

```ts
import { normalizeOrigin } from '../seo-files/url';

/** 把用户输入规整为 host[:port](去协议/路径/查询)。失败时由 normalizeOrigin 抛错。 */
function toHost(input: string): string {
  return new URL(normalizeOrigin(input)).host;
}

/** Ahrefs Backlink Checker:固定 mode=subdomains。 */
export function buildBacklinkCheckerUrl(input: string): string {
  const host = toHost(input);
  return `https://ahrefs.com/backlink-checker/?input=${encodeURIComponent(host)}&mode=subdomains`;
}

/** Ahrefs Website Authority Checker。 */
export function buildWebsiteAuthorityCheckerUrl(input: string): string {
  const host = toHost(input);
  return `https://ahrefs.com/website-authority-checker/?input=${encodeURIComponent(host)}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test site-tools-url`
Expected: PASS(6 用例全过)。

- [ ] **Step 5: 创建 `lib/site-tools/tools.ts`(数据数组)**

```ts
import backlinkLogo from '../../entrypoints/sidepanel/assets/logos/backlink-checker.svg';
import authorityLogo from '../../entrypoints/sidepanel/assets/logos/website-authority-checker.svg';
import gscLogo from '../../entrypoints/sidepanel/assets/logos/google-search-console.png';
import gaLogo from '../../entrypoints/sidepanel/assets/logos/google-analytics.svg';
import clarityLogo from '../../entrypoints/sidepanel/assets/logos/clarity.svg';
import pagespeedLogo from '../../entrypoints/sidepanel/assets/logos/pagespeed.svg';
import { buildSeoFileUrl } from '../seo-files/url';
import { buildBacklinkCheckerUrl, buildWebsiteAuthorityCheckerUrl } from './url';

export interface SiteTool {
  id: string;
  name: string;
  /** 图片 logo url(与 icon 二选一)。 */
  logo?: string;
  /** SVG icon 标记(robots/sitemap 用,与 logo 二选一)。 */
  icon?: 'robots' | 'sitemap';
  /** 由当前 site.domain 构造打开 url;direct 类忽略 domain。 */
  buildUrl: (domain: string) => string;
}

export const SITE_TOOLS: SiteTool[] = [
  { id: 'robots', name: 'robots.txt', icon: 'robots', buildUrl: (d) => buildSeoFileUrl(d, 'robots.txt') },
  { id: 'sitemap', name: 'sitemap.xml', icon: 'sitemap', buildUrl: (d) => buildSeoFileUrl(d, 'sitemap.xml') },
  { id: 'backlink-checker', name: 'Backlink Checker', logo: backlinkLogo, buildUrl: buildBacklinkCheckerUrl },
  { id: 'authority-checker', name: 'Website Authority Checker', logo: authorityLogo, buildUrl: buildWebsiteAuthorityCheckerUrl },
  { id: 'gsc', name: 'Google Search Console', logo: gscLogo, buildUrl: () => 'https://search.google.com/search-console' },
  { id: 'ga', name: 'Google Analytics', logo: gaLogo, buildUrl: () => 'https://analytics.google.com/analytics/web' },
  { id: 'clarity', name: 'Microsoft Clarity', logo: clarityLogo, buildUrl: () => 'https://clarity.microsoft.com/projects/view' },
  { id: 'pagespeed', name: 'PageSpeed Insights', logo: pagespeedLogo, buildUrl: () => 'https://pagespeed.web.dev/' },
];
```

- [ ] **Step 6: 类型检查**

Run: `pnpm compile`
Expected: 无错误(SVG/PNG import 已由 `vite/client` 声明)。

- [ ] **Step 7: Commit**

```bash
git add lib/site-tools/ tests/site-tools-url.test.ts
git commit -m "feat(site-tools): 新增 backlink/authority url builder 与 SITE_TOOLS 数据"
```

---

## Task 3: ToolCard 支持 logo 图片 prop

**Files:**
- Modify: `entrypoints/sidepanel/components/ToolCard.tsx`
- Test: `tests/toolcard.test.tsx`

**Interfaces:**
- Produces: `ToolCard` props 新增可选 `logo?: string`;`icon` 改为可选。`logo` 与 `icon` 至少传一个。供 Task 4 使用。

- [ ] **Step 1: 更新 `tests/toolcard.test.tsx`(加 logo 用例)**

在文件末尾的 `describe` 内追加两个用例(保留现有两个):

```tsx
  it('传 logo 时渲染 <img>,不再渲染 icon', () => {
    const { container } = render(
      <ToolCard logo="/fake/logo.svg" title="Backlink Checker" onClick={() => {}} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/fake/logo.svg');
  });
  it('传 icon 时不渲染 <img>(向后兼容)', () => {
    const { container } = render(
      <ToolCard icon={<IconSubmit />} title="网站提交" onClick={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('网站提交')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test toolcard`
Expected: FAIL —— `logo` prop 不存在,传了会 TS 报错 / 不渲染 `<img>`。

- [ ] **Step 3: 更新 `entrypoints/sidepanel/components/ToolCard.tsx`**

完整新内容(`icon` 改可选,新增 `logo?`,渲染时 logo 优先):

```tsx
import { IconChevron } from './icons';

export interface ToolCardProps {
  icon?: React.ReactNode;
  logo?: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function ToolCard({ icon, logo, title, subtitle, onClick, disabled }: ToolCardProps) {
  const interactive = !!onClick && !disabled;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      className={`tool-card${disabled ? ' is-disabled' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="tool-card__icon">
        {logo
          ? <img src={logo} width={24} height={24} alt="" aria-hidden="true" style={{ objectFit: 'contain', borderRadius: 4 }} />
          : icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="tool-card__title">{title}</span>
        {subtitle && <span className="tool-card__subtitle">{subtitle}</span>}
      </span>
      {onClick && !disabled && <IconChevron size={16} />}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test toolcard`
Expected: PASS(4 用例全过)。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/components/ToolCard.tsx tests/toolcard.test.tsx
git commit -m "feat(toolcard): ToolCard 支持 logo 图片 prop"
```

---

## Task 4: SiteTools 改为数据驱动渲染

**Files:**
- Modify: `entrypoints/sidepanel/pages/SiteTools.tsx`
- Test: `tests/sitetools.test.tsx`

**Interfaces:**
- Consumes: `SITE_TOOLS` from `@lib/site-tools/tools`(Task 2);`ToolCard` 的 `logo`/`icon`(Task 3);`IconRobots`、`IconSitemap` from `../components/icons`。
- 保留:网站提交(全宽,跳 `SubmitPanel`)、网站选择器 Combobox、`hasSite` 禁用逻辑(无 site 时所有工具禁用,符合 spec §8.1 决策)。

- [ ] **Step 1: 更新 `tests/sitetools.test.tsx`**

在现有 `describe` 内追加新工具的用例(保留「网站提交」「robots.txt」「未选网站禁用」三个原有用例,但把原有 robots 用例里的 `screen.getByText('robots.txt')` 保持不变):

```tsx
  it('渲染 6 个新增工具卡片', async () => {
    render(<SiteTools />);
    await flush();
    expect(screen.getByText('Backlink Checker')).toBeInTheDocument();
    expect(screen.getByText('Website Authority Checker')).toBeInTheDocument();
    expect(screen.getByText('Google Search Console')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Clarity')).toBeInTheDocument();
    expect(screen.getByText('PageSpeed Insights')).toBeInTheDocument();
  });
  it('选网站后点 Backlink Checker 打开带 input 与 mode=subdomains 的链接', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'vercel.com' } });
    fireEvent.click(screen.getByText('Backlink Checker'));
    expect(spy).toHaveBeenCalled();
    const url = spy.mock.calls[0][0].url as string;
    expect(url).toBe('https://ahrefs.com/backlink-checker/?input=vercel.com&mode=subdomains');
    spy.mockRestore();
  });
  it('选网站后点 Google Search Console 打开直接链接(无查询参数)', async () => {
    const spy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('Google Search Console'));
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].url).toBe('https://search.google.com/search-console');
    spy.mockRestore();
  });
  it('未选网站时 PageSpeed Insights 禁用', async () => {
    render(<SiteTools />);
    await flush();
    const card = screen.getByText('PageSpeed Insights').closest('[role="button"], .tool-card');
    expect(card?.getAttribute('aria-disabled')).toBe('true');
  });
```

> 注:原有第一个用例「点击网站提交进入子面板」、第二个「robots.txt 打开」、第三个「未选网站 robots 禁用」**保持不变**,不要删。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test sitetools`
Expected: FAIL —— 找不到「Backlink Checker」等文案(SiteTools 尚未渲染新工具)。

- [ ] **Step 3: 重写 `entrypoints/sidepanel/pages/SiteTools.tsx`**

完整新内容:

```tsx
import { useState } from 'react';
import Combobox from '../components/Combobox';
import ToolCard from '../components/ToolCard';
import ProjectModal from '../components/ProjectModal';
import SubmitPanel from './SubmitPanel';
import { IconSubmit, IconRobots, IconSitemap } from '../components/icons';
import { useSite } from '../hooks/useSite';
import { useProjects } from '../hooks/useProjects';
import { isValidDomain } from '@lib/storage/projects';
import { SITE_TOOLS } from '@lib/site-tools/tools';

export default function SiteTools() {
  const { site, setSite } = useSite();
  const { projects } = useProjects();
  const [view, setView] = useState<'list' | 'submit'>('list');
  const [modalOpen, setModalOpen] = useState(false);

  const domains = projects.map((p) => p.domain);
  const hasSite = isValidDomain(site.domain);

  function openTool(buildUrl: (domain: string) => string) {
    if (!hasSite) return;
    try { chrome.tabs.create({ url: buildUrl(site.domain) }); }
    catch { /* buildUrl 校验失败静默(已由 hasSite 拦截) */ }
  }

  if (view === 'submit') return <SubmitPanel site={site} onBack={() => setView('list')} />;

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>网站</label>
      <Combobox value={site.domain} options={domains} placeholder="example.com" onChange={(v) => setSite({ domain: v })} onManage={() => setModalOpen(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-lg)' }}>
        <ToolCard icon={<IconSubmit />} title="网站提交" subtitle="GSC · Bing" onClick={() => setView('submit')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SITE_TOOLS.map((t) => {
            const icon = t.icon === 'robots' ? <IconRobots /> : t.icon === 'sitemap' ? <IconSitemap /> : undefined;
            return (
              <ToolCard
                key={t.id}
                icon={icon}
                logo={t.logo}
                title={t.name}
                onClick={hasSite ? () => openTool(t.buildUrl) : undefined}
                disabled={!hasSite}
              />
            );
          })}
        </div>

        {!hasSite && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>请先选择或填写网站以使用工具</div>}
      </div>

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test sitetools`
Expected: PASS(原有 3 + 新增 4 = 7 用例全过)。

- [ ] **Step 5: 类型检查**

Run: `pnpm compile`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add entrypoints/sidepanel/pages/SiteTools.tsx tests/sitetools.test.tsx
git commit -m "refactor(site-tools): SiteTools 改为 SITE_TOOLS 数据驱动渲染"
```

---

## Task 5: AhrefsTool UI 改造

**Files:**
- Modify: `entrypoints/sidepanel/pages/AhrefsTool.tsx`
- Test: `tests/ahrefs-tool.test.tsx`

**改动点(对照 spec §二):** subtitle `关键词难度查询`→`Keyword Difficulty Checker`;logo 已在 Task 1 换源;删「国家」标签(`rowLabelStyle` 整段删除);ToolPanel 去掉 `action`,「查询」按钮下放到与国家 Select 同行;按钮文案 `打开查询`→`查询`。

- [ ] **Step 1: 更新 `tests/ahrefs-tool.test.tsx`**

完整新内容(副标题英文、按钮文案「查询」、无「国家」标签):

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AhrefsTool from '../entrypoints/sidepanel/pages/AhrefsTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('AhrefsTool', () => {
  it('渲染标题与英文副标题,关键词非空时按钮可用', () => {
    render(<AhrefsTool keyword="apple" />);
    expect(screen.getByText('Ahrefs')).toBeInTheDocument();
    expect(screen.getByText('Keyword Difficulty Checker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeEnabled();
  });
  it('不再渲染「国家」标签', () => {
    render(<AhrefsTool keyword="apple" />);
    expect(screen.queryByText('国家')).toBeNull();
  });
  it('关键词为空时按钮禁用', () => {
    render(<AhrefsTool keyword="" />);
    expect(screen.getByRole('button', { name: '查询' })).toBeDisabled();
  });
  it('点击查询打开 ahrefs 关键词难度链接,含 input=apple', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<AhrefsTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0].url as string;
    expect(url.startsWith('https://ahrefs.com/keyword-difficulty/')).toBe(true);
    expect(url).toContain('input=apple');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test ahrefs-tool`
Expected: FAIL —— 找不到「Keyword Difficulty Checker」「查询」,且仍有「国家」。

- [ ] **Step 3: 重写 `entrypoints/sidepanel/pages/AhrefsTool.tsx`**

完整新内容(删 `rowLabelStyle`,去 `action`,按钮下放):

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { AhrefsLogo } from '../components/brand-logos';
import { COUNTRIES, buildAhrefsUrl, isValidCountryCode } from '@lib/ahrefs/url';

const STORAGE_KEY = 'ahrefs:last';
interface Last { country: string; }
interface Props { keyword: string; }

export default function AhrefsTool({ keyword }: Props) {
  const [country, setCountry] = useState('us');
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Last | undefined;
      if (last?.country) setCountry(last.country);
    });
  }, []);

  const options = [...COUNTRIES.map((c) => ({ value: c.code, label: c.label })), { value: '__custom', label: '自定义…' }];

  function open() {
    try {
      const url = buildAhrefsUrl(country, keyword);
      chrome.storage.local.set({ [STORAGE_KEY]: { country } });
      chrome.tabs.create({ url });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const canOpen = !keyword.trim() || !isValidCountryCode(country);

  return (
    <ToolPanel
      logo={<AhrefsLogo size={18} />}
      title="Ahrefs"
      subtitle="Keyword Difficulty Checker"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <Select
          value={country}
          options={options}
          onChange={(e) => {
            if (e.target.value === '__custom') { setCustom(true); setCountry(''); }
            else { setCustom(false); setCountry(e.target.value); }
          }}
          style={{ flex: 1, width: 'auto' }}
        />
        <Button onClick={open} disabled={canOpen} style={{ flexShrink: 0 }}>查询</Button>
      </div>
      {custom && (
        <TextInput
          value={country}
          placeholder="两位代码,如 us"
          onChange={(e) => setCountry(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test ahrefs-tool`
Expected: PASS(4 用例全过)。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/AhrefsTool.tsx tests/ahrefs-tool.test.tsx
git commit -m "refactor(keyword-tools): Ahrefs 卡片英文副标题、去国家标签、查询按钮下放"
```

---

## Task 6: GoogleTrendsTool UI 改造

**Files:**
- Modify: `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`
- Test: `tests/google-trends-tool.test.tsx`

**改动点(对照 spec §三):** 删 subtitle「谷歌趋势」;删「天数/地区/对比词」三个标签(`colLabelStyle`、`rowLabelStyle` 整段删除);对比词下移到天数/地区下方;搜索按钮从 `action` 下放到对比词行。

- [ ] **Step 1: 更新 `tests/google-trends-tool.test.tsx`**

完整新内容:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GoogleTrendsTool from '../entrypoints/sidepanel/pages/GoogleTrendsTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('GoogleTrendsTool', () => {
  it('渲染标题与搜索按钮,关键词非空时可用', () => {
    render(<GoogleTrendsTool keyword="apple" />);
    expect(screen.getByText('Google Trends')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '搜索' })).toBeEnabled();
  });
  it('不再渲染「谷歌趋势」副标题与三个小标题', () => {
    render(<GoogleTrendsTool keyword="apple" />);
    expect(screen.queryByText('谷歌趋势')).toBeNull();
    expect(screen.queryByText('天数')).toBeNull();
    expect(screen.queryByText('地区')).toBeNull();
    expect(screen.queryByText('对比词')).toBeNull();
  });
  it('关键词为空时按钮禁用', () => {
    render(<GoogleTrendsTool keyword="" />);
    expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled();
  });
  it('点击搜索以新标签打开趋势链接,含主词 apple', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<GoogleTrendsTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0].url as string;
    expect(url.startsWith('https://trends.google.com/explore')).toBe(true);
    expect(url).toContain('q=apple');
  });
  it('挂载时从 storage 恢复上次的天数/对比词/地区', () => {
    chrome.storage.local.set({ 'kw-tools:trends': { date: 'now 7-d', compare: 'chatgpt', geo: 'US' } });
    render(<GoogleTrendsTool keyword="apple" />);
    expect(screen.getByText('7 天')).toBeInTheDocument();           // date select 显示
    expect(screen.getByText('美国 (US)')).toBeInTheDocument();      // geo select 显示
    expect(screen.getByDisplayValue('chatgpt')).toBeInTheDocument(); // compare combobox input
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test google-trends-tool`
Expected: FAIL —— 仍渲染「谷歌趋势」「天数」等。

- [ ] **Step 3: 重写 `entrypoints/sidepanel/pages/GoogleTrendsTool.tsx`**

完整新内容:

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import Combobox from '../components/Combobox';
import ToolPanel from '../components/ToolPanel';
import { GoogleTrendsLogo } from '../components/brand-logos';
import { TRENDS_DATE_RANGES, TRENDS_GEOS, buildTrendsUrl } from '@lib/trends/url';

const STORAGE_KEY = 'kw-tools:trends';
const COMPARE_PRESETS = ['gpts', 'chatgpt', 'ai', 'ai tools'];

interface Props { keyword: string; }
interface Last { date: string; compare: string; geo: string; }

export default function GoogleTrendsTool({ keyword }: Props) {
  const [date, setDate] = useState<string>('today 1-m');
  const [compare, setCompare] = useState<string>('gpts');
  const [geo, setGeo] = useState<string>('Worldwide');

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      const last = items[STORAGE_KEY] as Partial<Last> | undefined;
      if (last) {
        if (typeof last.date === 'string') setDate(last.date);
        if (typeof last.compare === 'string') setCompare(last.compare);
        if (typeof last.geo === 'string') setGeo(last.geo);
      }
    });
  }, []);

  function persist(patch: Partial<Last>) {
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo, ...patch } });
  }

  function open() {
    const url = buildTrendsUrl(keyword, compare, date, geo);
    chrome.storage.local.set({ [STORAGE_KEY]: { date, compare, geo } });
    chrome.tabs.create({ url });
  }

  return (
    <ToolPanel logo={<GoogleTrendsLogo size={18} />} title="Google Trends">
      {/* 第 1 行:天数 + 地区(无标题) */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select
            value={date}
            options={TRENDS_DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))}
            onChange={(e) => { setDate(e.target.value); persist({ date: e.target.value }); }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select
            value={geo}
            options={TRENDS_GEOS.map((g) => ({ value: g.value, label: g.label }))}
            onChange={(e) => { setGeo(e.target.value); persist({ geo: e.target.value }); }}
          />
        </div>
      </div>
      {/* 第 2 行:对比词 + 搜索按钮(无标题) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Combobox
            value={compare}
            options={COMPARE_PRESETS}
            placeholder="如 gpts,可留空"
            onChange={(v) => { setCompare(v); persist({ compare: v }); }}
          />
        </div>
        <Button onClick={open} disabled={!keyword.trim()} style={{ flexShrink: 0 }}>搜索</Button>
      </div>
    </ToolPanel>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test google-trends-tool`
Expected: PASS(5 用例全过)。

- [ ] **Step 5: Commit**

```bash
git add entrypoints/sidepanel/pages/GoogleTrendsTool.tsx tests/google-trends-tool.test.tsx
git commit -m "refactor(keyword-tools): Google Trends 去副标题与小标题、对比词下移、搜索按钮下放"
```

---

## Task 7: QuickSearchTool 改名 + Yandex + 分割线

**Files:**
- Modify: `lib/quicksearch/url.ts`
- Modify: `entrypoints/sidepanel/pages/QuickSearchTool.tsx`
- Test: `tests/quicksearch-url.test.ts`
- Test: `tests/quick-search-tool.test.tsx`

**改动点(对照 spec §四):** title `快捷搜索`→`搜索引擎查询`;header logo 换 `QuickSearchLogo`;标签 `位置(仅 Google)`→`搜索定位`;geo Select 与 Google 按钮同一行;Google 行与 Bing+Yandex 行之间加不贯穿分割线;新增 Yandex(`buildYandexSearchUrl` + `YandexLogo`),Bing、Yandex 同行(Bing 在前)。

**Interfaces:**
- Produces: `buildYandexSearchUrl(keyword: string): string` → `https://yandex.com/search/?text=<kw>`。

- [ ] **Step 1: 更新 `tests/quicksearch-url.test.ts`(加 Yandex)**

在文件末尾 `describe` 内追加:

```ts
  it('Yandex 结果页', () => {
    expect(buildYandexSearchUrl('apple')).toBe('https://yandex.com/search/?text=apple');
  });
```

并把顶部 import 改为:

```ts
import { buildGoogleSearchUrl, buildBingSearchUrl, buildYandexSearchUrl } from '../lib/quicksearch/url';
```

同时给「空关键词抛错」用例补一条:`expect(() => buildYandexSearchUrl('')).toThrow();`

- [ ] **Step 2: 跑 url 测试确认失败**

Run: `pnpm test quicksearch-url`
Expected: FAIL —— `buildYandexSearchUrl` 未导出。

- [ ] **Step 3: 更新 `lib/quicksearch/url.ts`**

在文件末尾追加:

```ts
/** Yandex 结果页。 */
export function buildYandexSearchUrl(keyword: string): string {
  const kw = keyword.trim();
  if (!kw) throw new Error('keyword required');
  return `https://yandex.com/search/?text=${encodeURIComponent(kw)}`;
}
```

- [ ] **Step 4: 跑 url 测试确认通过**

Run: `pnpm test quicksearch-url`
Expected: PASS。

- [ ] **Step 5: 更新 `tests/quick-search-tool.test.tsx`**

完整新内容:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuickSearchTool from '../entrypoints/sidepanel/pages/QuickSearchTool';

afterEach(() => { vi.restoreAllMocks(); });

describe('QuickSearchTool', () => {
  it('渲染「搜索引擎查询」标题与 Google / Bing / Yandex 三个按钮', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText('搜索引擎查询')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '用 Yandex 搜' })).toBeEnabled();
  });
  it('关键词为空时三按钮均禁用', () => {
    render(<QuickSearchTool keyword="" />);
    expect(screen.getByRole('button', { name: '用 Google 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Bing 搜' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '用 Yandex 搜' })).toBeDisabled();
  });
  it('点击 Google / Bing / Yandex 分别打开对应结果页', () => {
    const spy = vi.spyOn(chrome.tabs, 'create');
    render(<QuickSearchTool keyword="apple" />);
    fireEvent.click(screen.getByRole('button', { name: '用 Google 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Bing 搜' }));
    fireEvent.click(screen.getByRole('button', { name: '用 Yandex 搜' }));
    expect(spy).toHaveBeenCalledTimes(3);
    expect((spy.mock.calls[0][0].url as string).startsWith('https://www.google.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[1][0].url as string).startsWith('https://cn.bing.com/search?q=apple')).toBe(true);
    expect((spy.mock.calls[2][0].url as string).startsWith('https://yandex.com/search/?text=apple')).toBe(true);
  });

  it('渲染「搜索定位」标签(不再有「仅 Google」)', () => {
    render(<QuickSearchTool keyword="apple" />);
    expect(screen.getByText('搜索定位')).toBeInTheDocument();
    expect(screen.queryByText(/仅 Google/)).toBeNull();
  });

  it('渲染分割线(首尾不贯穿)', () => {
    const { container } = render(<QuickSearchTool keyword="apple" />);
    const divider = container.querySelector('[data-testid="qs-divider"]');
    expect(divider).not.toBeNull();
  });

  it('渲染搜索位置下拉,默认选中美国', () => {
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
  });
});
```

- [ ] **Step 6: 跑组件测试确认失败**

Run: `pnpm test quick-search-tool`
Expected: FAIL —— 找不到「搜索引擎查询」「用 Yandex 搜」「搜索定位」、分割线 testid。

- [ ] **Step 7: 重写 `entrypoints/sidepanel/pages/QuickSearchTool.tsx`**

完整新内容:

```tsx
import { useEffect, useState } from 'react';
import Button from '../components/Button';
import Select from '../components/Select';
import ToolPanel from '../components/ToolPanel';
import { GoogleLogo, BingLogo, YandexLogo, QuickSearchLogo } from '../components/brand-logos';
import { buildGoogleSearchUrl, buildBingSearchUrl, buildYandexSearchUrl } from '@lib/quicksearch/url';
import { GEO_REGIONS, GEO_OFF, getGeoPref, setGeoPref, type GeoCode } from '@lib/quicksearch/geo';

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
    void setGeoPref(v); // background 监听 storage 变化,实时增删规则
  }

  const geoOptions = [
    { value: GEO_OFF, label: '🚪 关闭(用真实位置)' },
    ...GEO_REGIONS.map((r) => ({ value: r.code, label: `${r.flag} ${r.label}` })),
  ];

  return (
    <ToolPanel logo={<QuickSearchLogo size={18} />} title="搜索引擎查询">
      {/* 第 1 行:搜索定位 + Google 按钮(geo 仅作用于 Google) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>搜索定位</div>
          <Select value={geoCode} options={geoOptions} onChange={onGeoChange} />
        </div>
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildGoogleSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flexShrink: 0 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <GoogleLogo size={14} /> 用 Google 搜
          </span>
        </Button>
      </div>
      {/* 分割线:左右内缩 var(--space-xs),首尾不贯穿 */}
      <div data-testid="qs-divider" aria-hidden="true" style={{ borderTop: '1px solid var(--color-hairline)', margin: 'var(--space-sm) var(--space-xs)' }} />
      {/* 第 2 行:Bing + Yandex(Bing 在前) */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
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
        <Button
          variant="secondary"
          onClick={() => chrome.tabs.create({ url: buildYandexSearchUrl(keyword) })}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <YandexLogo size={14} /> 用 Yandex 搜
          </span>
        </Button>
      </div>
    </ToolPanel>
  );
}
```

- [ ] **Step 8: 跑组件测试确认通过**

Run: `pnpm test quick-search-tool`
Expected: PASS(7 用例全过)。

- [ ] **Step 9: Commit**

```bash
git add lib/quicksearch/url.ts entrypoints/sidepanel/pages/QuickSearchTool.tsx tests/quicksearch-url.test.ts tests/quick-search-tool.test.tsx
git commit -m "feat(keyword-tools): 快捷搜索改名搜索引擎查询、新增 Yandex、geo 与 Google 同行、分割线"
```

---

## Task 8: 全量验证 + 收尾

**Files:** 无新改动;仅运行验证命令。

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS(原有用例 + 本计划新增/修改用例)。若有用例失败,定位并修复后再继续。

- [ ] **Step 2: 类型检查**

Run: `pnpm compile`
Expected: 无错误。

- [ ] **Step 3: 视觉冒烟(可选,人工)**

Run: `pnpm dev` → 浏览器加载扩展 → 打开 sidepanel:
- 网站工具:9 个工具按 2 列网格排列(网站提交全宽),logo 正常显示;选网站后点 Backlink Checker / GSC 能正确开页。
- 关键词工具:Ahrefs 副标题英文、查询按钮与国家下拉同行;Google Trends 无副标题与小标题、对比词在下方;快捷搜索标题「搜索引擎查询」、Google 与 geo 同行、分割线不贯穿、Bing+Yandex 在下行。

- [ ] **Step 4: 检查工作区干净**

Run: `git status`
Expected: `nothing to commit, working tree clean`。若 `tmp.md` 仍 untracked,保留不动(用户的临时文件)。

---

## Self-Review 结论

**1. Spec 覆盖:**
- 网站工具 6 个新工具 + 数据驱动 → Task 2 + 3 + 4 ✓
- Ahrefs 文案/logo/布局 → Task 1(logo)+ 5 ✓
- Google Trends 去标题/重排 → Task 6 ✓
- QuickSearch 改名/换 logo/标签/Yandex/分割线 → Task 1(logo)+ 7 ✓
- logo 本地化 → Task 1 ✓
- 测试全绿 → 每个 Task 的测试步骤 + Task 8 ✓
- spec §8.1 决策(direct 类也受 hasSite 控制)→ Task 4 Step 3 的 `disabled={!hasSite}` 全量应用 ✓

**2. Placeholder 扫描:** 无 TBD/TODO;logo 下载降级方案给了具体占位代码。✓

**3. 类型一致:** `SiteTool.buildUrl`、`ToolCard.logo`、`buildYandexSearchUrl`、`QuickSearchLogo`、`YandexLogo` 在各 Task 间签名一致。✓

**4. 已知风险:**
- `bing.net` 缩略图(Task 1 Step 1)可能抓不到 → 用占位 SVG 降级,告知用户。
- `www.example.com` 经 `normalizeOrigin` → `toHost` 得 `www.example.com`(保留 www),与 seo-files 行为一致。✓
