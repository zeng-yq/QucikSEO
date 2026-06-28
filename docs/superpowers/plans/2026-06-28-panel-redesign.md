# 插件面板 UI 重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 sidepanel 从左侧 5 页平铺重构为「网站工具 / 关键词工具」顶部双 Tab，整合 GSC+Bing 提交、把 robots/sitemap 降级为直接动作、项目管理弹窗化，并升级 SVG logo。

**Architecture:** 自底向上重建组件层（图标 → 顶栏 → 工具卡 → hooks → 提交编排 → 板块页），最后重写 `App.tsx` 集成并删除旧页面。状态就近：`tab` 在 `App`，`site`/`siteView`/`projectModalOpen` 在 `SiteTools`。提交链路改为前端始终传 `domain`（combobox 选项目带 `project.domain`、手动填带输入值），background 直接用 `msg.domain` 拼 URL，省去 `getProjectById`。跨视图项目同步靠 `chrome.storage.onChanged`（`storage.set` 自动触发），不手动广播。

**Tech Stack:** WXT + React 19 + TypeScript，Vitest + jsdom + @testing-library/react + fake-indexeddb（chrome mock 在 `tests/setup.ts`）。样式为 inline style + `global.css` 组件类，沿用 `tokens.css` 变量。

## Global Constraints

- **样式**：沿用 `tokens.css` 变量（`--color-*` / `--radius-*` / `--space-*` / `--font-*`），inline style 为主、`global.css` 仅放需要伪类（`:hover`/`:active`）的类。**不引入** UI 库或 CSS-in-JS。
- **控件尺寸**：按钮/输入高度沿用 32px（与现有 `Button`/`TextInput`/`Select` 一致）。
- **字体**：标题 EB Garamond (`--font-serif`)、正文 Inter (`--font-sans`)、日志/链接 JetBrains Mono (`--font-mono`)。
- **导入别名**：`@lib/*` `@components/*` `@pages/*` `@hooks/*`（tsconfig + vitest + wxt 均已配置）。
- **平台 mark**：用抽象几何 SVG（放大镜/字母方块意象），**不使用** GSC/Bing 官方商标，规避商标风险。
- **测试**：`pnpm vitest run <file>` 跑单测，`pnpm test` 跑全部，`pnpm compile` 跑 `tsc --noEmit`。chrome API 由 `tests/setup.ts` 提供 mock。
- **Commit**：中文描述，`feat`/`refactor`/`test`/`chore` 前缀，每任务一次提交。

---

## 对 spec 的实现细化（不改变意图）

1. **messaging 用 `domain` 而非 `site={domain,projectId?}`**：background 只消费 domain 拼 URL，前端始终能产出 domain（选项目 = `project.domain`，手动填 = 输入值），故直接传 `domain`，删除 `getProjectById` 调用链。
2. **跨视图同步 = `chrome.storage.onChanged`**：真实环境 `storage.local.set` 自动触发 `onChanged`，`useProjects` 监听 `projects` key 即可，无需手动广播（解开 `storage/projects.ts` 现有「刻意不实现」注释）。
3. **状态就近**：`tab` 在 `App`；`site`/`siteView`/`projectModalOpen` 在 `SiteTools`（仅网站工具使用，无需上提到 App）。
4. **图标集单文件**：所有 SVG 图标集中在 `components/icons.tsx` 导出（小图标集无需每图标一文件）。

---

### Task 1: SVG 图标集

**Files:**
- Create: `entrypoints/sidepanel/components/icons.tsx`
- Test: `tests/icons.test.tsx`

**Interfaces:**
- Produces: `Logo({size?})`、`GscMark({size?})`、`BingMark({size?})`、`IconSubmit`、`IconRobots`、`IconSitemap`、`IconSettings`、`IconBack`、`IconClose`、`IconChevron` —— 每个 `{ size?: number }`，描边/填充用 `currentColor`，默认 size 见下。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/icons.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Logo, GscMark, BingMark, IconSubmit, IconRobots, IconSitemap, IconSettings, IconBack, IconClose, IconChevron } from '../entrypoints/sidepanel/components/icons';

describe('icons', () => {
  const all = { Logo, GscMark, BingMark, IconSubmit, IconRobots, IconSitemap, IconSettings, IconBack, IconClose, IconChevron };
  for (const [name, Comp] of Object.entries(all)) {
    it(`${name} 渲染一个 svg`, () => {
      const { container } = render(<Comp />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  }
  it('Logo 接受 size', () => {
    const { container } = render(<Logo size={24} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('24');
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/icons.test.tsx`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现图标集**

```tsx
// entrypoints/sidepanel/components/icons.tsx
interface IconProps { size?: number; }

/** 几何放射星形 — header 与品牌位使用，色取自父级 currentColor（珊瑚）。 */
export function Logo({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.5 L13.8 9.2 L21.5 11 L13.8 12.8 L12 22.5 L10.2 12.8 L2.5 11 L10.2 9.2 Z" fill="currentColor" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** GSC 抽象 mark — 放大镜几何（非官方商标）。 */
export function GscMark({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="10" cy="10" r="6" />
      <line x1="14.5" y1="14.5" x2="20" y2="20" />
    </svg>
  );
}

/** Bing 抽象 mark — 方块 + b 字母几何（非官方商标）。 */
export function BingMark({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9 16.5 V8 h4 a3 3 0 0 1 0 6 H9" fill="none" />
    </svg>
  );
}

export function IconSubmit({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" /><path d="M6 11l6-6 6 6" /><path d="M5 21h14" />
    </svg>
  );
}

export function IconRobots({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function IconSitemap({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-2h12v2" />
    </svg>
  );
}

export function IconSettings({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </svg>
  );
}

export function IconBack({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconClose({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconChevron({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/icons.test.tsx`
Expected: PASS（10 个图标 + size 断言）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/icons.tsx tests/icons.test.tsx
git commit -m "feat(icons): 新增 SVG 图标集（logo + 平台 mark + 工具图标）"
```

---

### Task 2: Header + TabBar 顶栏组件

**Files:**
- Create: `entrypoints/sidepanel/components/Header.tsx`
- Create: `entrypoints/sidepanel/components/TabBar.tsx`
- Modify: `entrypoints/sidepanel/styles/global.css`（追加 `.tab-bar` `.tab`）
- Test: `tests/tabbar.test.tsx`

**Interfaces:**
- Consumes: `Logo` from `./icons`
- Produces: `Header()`；`TabBar({ tab: 'site'|'keyword', onChange })`；`Tab` 类型导出。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/tabbar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar from '../entrypoints/sidepanel/components/TabBar';

describe('TabBar', () => {
  it('渲染两个 tab，点击切换', () => {
    const onChange = vi.fn();
    render(<TabBar tab="site" onChange={onChange} />);
    fireEvent.click(screen.getByText('关键词工具'));
    expect(onChange).toHaveBeenCalledWith('keyword');
  });
  it('当前 tab 标记 is-active', () => {
    const { container } = render(<TabBar tab="keyword" onChange={() => {}} />);
    const active = container.querySelector('.tab.is-active');
    expect(active?.textContent).toBe('关键词工具');
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/tabbar.test.tsx`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 实现 Header**

```tsx
// entrypoints/sidepanel/components/Header.tsx
import { Logo } from './icons';

export default function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--color-hairline)' }}>
      <span style={{ color: 'var(--color-primary)', display: 'inline-flex', lineHeight: 0 }}>
        <Logo size={18} />
      </span>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--color-ink)' }}>AutoSEO</span>
    </header>
  );
}
```

- [ ] **Step 4: 实现 TabBar**

```tsx
// entrypoints/sidepanel/components/TabBar.tsx
export type Tab = 'site' | 'keyword';

const TABS: { key: Tab; label: string }[] = [
  { key: 'site', label: '网站工具' },
  { key: 'keyword', label: '关键词工具' },
];

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="tab-bar">
      {TABS.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`tab${tab === it.key ? ' is-active' : ''}`}
          aria-current={tab === it.key ? 'page' : undefined}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: 追加 CSS 到 global.css**

在 `entrypoints/sidepanel/styles/global.css` 末尾追加：

```css
/* 顶部双 Tab（segmented 风） */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-hairline);
}
.tab {
  flex: 1;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .12s ease, color .12s ease;
}
.tab:hover { background: var(--color-surface-card); color: var(--color-ink); }
.tab.is-active {
  background: var(--color-surface-cream-strong);
  color: var(--color-primary);
  border-color: var(--color-hairline);
}
```

- [ ] **Step 6: 验证通过**

Run: `pnpm vitest run tests/tabbar.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add entrypoints/sidepanel/components/Header.tsx entrypoints/sidepanel/components/TabBar.tsx entrypoints/sidepanel/styles/global.css tests/tabbar.test.tsx
git commit -m "feat(sidepanel): 新增 Header 与顶部双 Tab 组件"
```

---

### Task 3: ToolCard 工具入口卡片

**Files:**
- Create: `entrypoints/sidepanel/components/ToolCard.tsx`
- Modify: `entrypoints/sidepanel/styles/global.css`（追加 `.tool-card`）
- Test: `tests/toolcard.test.tsx`

**Interfaces:**
- Consumes: `IconChevron` from `./icons`
- Produces: `ToolCard({ icon, title, subtitle?, onClick?, disabled? })`

- [ ] **Step 1: 写失败测试**

```tsx
// tests/toolcard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolCard from '../entrypoints/sidepanel/components/ToolCard';
import { IconSubmit } from '../entrypoints/sidepanel/components/icons';

describe('ToolCard', () => {
  it('点击触发 onClick', () => {
    const onClick = vi.fn();
    render(<ToolCard icon={<IconSubmit />} title="网站提交" subtitle="GSC · Bing" onClick={onClick} />);
    fireEvent.click(screen.getByText('网站提交'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('disabled 时不触发 onClick，Enter 仍可达性触发', () => {
    const onClick = vi.fn();
    render(<ToolCard icon={<IconSubmit />} title="robots.txt" onClick={onClick} disabled />);
    fireEvent.click(screen.getByText('robots.txt'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/toolcard.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 ToolCard**

```tsx
// entrypoints/sidepanel/components/ToolCard.tsx
import { IconChevron } from './icons';

export interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function ToolCard({ icon, title, subtitle, onClick, disabled }: ToolCardProps) {
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
      <span className="tool-card__icon">{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="tool-card__title">{title}</span>
        {subtitle && <span className="tool-card__subtitle">{subtitle}</span>}
      </span>
      {onClick && !disabled && <IconChevron size={16} />}
    </div>
  );
}
```

- [ ] **Step 4: 追加 CSS**

在 `global.css` 末尾追加：

```css
/* 工具入口卡片 */
.tool-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: var(--color-surface-card);
  border: none;
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  cursor: pointer;
  transition: background .12s ease;
}
.tool-card:hover { background: var(--color-surface-cream-strong); }
.tool-card.is-disabled { cursor: not-allowed; }
.tool-card.is-disabled:hover { background: var(--color-surface-card); }
.tool-card__icon { display: inline-flex; color: var(--color-primary); line-height: 0; }
.tool-card__title { display: block; font-family: var(--font-serif); font-size: 16px; color: var(--color-ink); }
.tool-card__subtitle { display: block; font-size: 12px; color: var(--color-muted); margin-top: 2px; }
```

- [ ] **Step 5: 验证通过**

Run: `pnpm vitest run tests/toolcard.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/components/ToolCard.tsx entrypoints/sidepanel/styles/global.css tests/toolcard.test.tsx
git commit -m "feat(sidepanel): 新增 ToolCard 工具入口卡片"
```

---

### Task 4: useSite hook（当前网站 + 记忆）

**Files:**
- Create: `entrypoints/sidepanel/hooks/useSite.ts`
- Test: `tests/useSite.test.tsx`

**Interfaces:**
- Produces: `Site = { domain: string; projectId?: string }`；`useSite()` → `{ site, setSite }`，`setSite` 写入 `chrome.storage.local['site:last']`。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/useSite.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSite } from '../entrypoints/sidepanel/hooks/useSite';

describe('useSite', () => {
  it('setSite 后写入 storage 并更新 state', async () => {
    const { result } = renderHook(() => useSite());
    expect(result.current.site.domain).toBe('');
    await act(async () => { result.current.setSite({ domain: 'example.com' }); });
    expect(result.current.site.domain).toBe('example.com');
    const stored = await chrome.storage.local.get('site:last');
    expect((stored['site:last'] as { domain: string }).domain).toBe('example.com');
  });
  it('挂载时读取上次的 site', async () => {
    await chrome.storage.local.set({ 'site:last': { domain: 'shop.example.com', projectId: 'p9' } });
    const { result } = renderHook(() => useSite());
    await act(async () => { /* 等待 useEffect 读取 */ });
    expect(result.current.site.domain).toBe('shop.example.com');
    expect(result.current.site.projectId).toBe('p9');
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/useSite.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 useSite**

```tsx
// entrypoints/sidepanel/hooks/useSite.ts
import { useCallback, useEffect, useState } from 'react';

export interface Site { domain: string; projectId?: string; }

const KEY = 'site:last';

export function useSite() {
  const [site, setSiteState] = useState<Site>({ domain: '' });

  useEffect(() => {
    chrome.storage.local.get(KEY, (items) => {
      const v = items[KEY] as Site | undefined;
      if (v && typeof v.domain === 'string') setSiteState(v);
    });
  }, []);

  const setSite = useCallback((s: Site) => {
    setSiteState(s);
    chrome.storage.local.set({ [KEY]: s });
  }, []);

  return { site, setSite };
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/useSite.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/hooks/useSite.ts tests/useSite.test.tsx
git commit -m "feat(hooks): 新增 useSite（当前网站 + storage 记忆）"
```

---

### Task 5: useProjects 跨视图同步（storage.onChanged）

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useProjects.ts`（监听 `chrome.storage.onChanged`）
- Modify: `tests/setup.ts`（chrome mock 增加 `storage.onChanged`，`set` 后触发）
- Test: `tests/useProjects-sync.test.tsx`

**Interfaces:**
- Consumes: `getProjects` from `@lib/storage/projects`（不变）
- Produces: `useProjects()` 增加跨实例自动同步行为（接口签名不变）。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/useProjects-sync.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects } from '../entrypoints/sidepanel/hooks/useProjects';
import { addProject } from '../lib/storage/projects';

describe('useProjects 跨视图同步', () => {
  it('一个实例 add 后，另一个实例通过 onChanged 收到更新', async () => {
    const a = renderHook(() => useProjects());
    const b = renderHook(() => useProjects());
    await act(async () => { await a.result.current.add('sync-test.com'); });
    // storage.set 已触发 onChanged → 两个实例都应刷新
    expect(a.result.current.projects.some((p) => p.domain === 'sync-test.com')).toBe(true);
    expect(b.result.current.projects.some((p) => p.domain === 'sync-test.com')).toBe(true);
  });
  it('直接 addProject（绕过 hook）也被监听到', async () => {
    const c = renderHook(() => useProjects());
    await act(async () => { await addProject('direct.com'); });
    expect(c.result.current.projects.some((p) => p.domain === 'direct.com')).toBe(true);
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/useProjects-sync.test.tsx`
Expected: FAIL（`onChanged` 未实现，b 实例不会刷新）。

- [ ] **Step 3: 给 setup.ts 的 chrome mock 增加 onChanged**

修改 `tests/setup.ts`：在 `storageArea` 定义之前/之后增加 onChanged 机制，并让 `set` 触发监听器。把 `storageArea` 改为：

```ts
// tests/setup.ts —— 替换原有 storageArea 与 chromeMock.storage
const onChangedListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

const fireOnChanged = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
  for (const cb of onChangedListeners) {
    try { cb(changes as never, area); } catch { /* listener 容错 */ }
  }
};

const storageArea = {
  get(keys: string | string[] | null | object, cb?: (items: Record<string, unknown>) => void) {
    const out: Record<string, unknown> = {};
    const keyList = keys == null ? [...memStore.keys()] : Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys];
    for (const k of keyList) if (memStore.has(k)) out[k] = memStore.get(k);
    cb?.(out);
    return Promise.resolve(out);
  },
  set(items: Record<string, unknown>, cb?: () => void) {
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: memStore.get(k), newValue: v };
      memStore.set(k, v);
    }
    cb?.();
    fireOnChanged(changes, 'local');
    return Promise.resolve();
  },
  remove(keys: string | string[], cb?: () => void) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, { oldValue?: unknown; newValue: undefined }> = {};
    for (const k of keyList) { changes[k] = { oldValue: memStore.get(k), newValue: undefined }; memStore.delete(k); }
    cb?.();
    fireOnChanged(changes, 'local');
    return Promise.resolve();
  },
  clear(cb?: () => void) { memStore.clear(); cb?.(); return Promise.resolve(); },
};
```

并在 `chromeMock.storage` 增加 `onChanged`：

```ts
const chromeMock = {
  storage: {
    local: storageArea,
    session: storageArea,
    onChanged: {
      addListener: (cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => { onChangedListeners.push(cb); },
      removeListener: (cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
        const i = onChangedListeners.indexOf(cb);
        if (i >= 0) onChangedListeners.splice(i, 1);
      },
      hasListener: () => false,
    },
  },
  // …（runtime / tabs / debugger / sidePanel 保持不变）
};
```

> 注：把 `resetChromeMock()` 改为同时清两个 store，使现有 `beforeEach(() => resetChromeMock())` 自动覆盖 listeners 清理。`onChangedListeners` 需定义在 `memStore` 之后、`storageArea` 之前（与 `memStore` 同模块作用域，`resetChromeMock` 可访问）：
>
> ```ts
> function resetChromeMock() { memStore.clear(); onChangedListeners.length = 0; }
> ```

- [ ] **Step 4: useProjects 监听 onChanged**

```tsx
// entrypoints/sidepanel/hooks/useProjects.ts （替换全文）
import { useCallback, useEffect, useState } from 'react';
import { getProjects, addProject, removeProject, updateProject, type Project } from '@lib/storage/projects';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const refresh = useCallback(() => { getProjects().then(setProjects); }, []);

  useEffect(() => {
    refresh();
    // 跨视图同步：真实环境 storage.local.set 自动触发 onChanged。
    const handler = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && 'projects' in changes) refresh();
    };
    // onChanged 在测试/某些环境可能缺失，容错。
    chrome.storage.onChanged?.addListener(handler);
    return () => chrome.storage.onChanged?.removeListener(handler);
  }, [refresh]);

  const add = useCallback((domain: string, label?: string) => addProject(domain, label).then(refresh), [refresh]);
  const remove = useCallback((id: string) => removeProject(id).then(refresh), [refresh]);
  const update = useCallback((id: string, patch: { domain?: string; label?: string }) => updateProject(id, patch).then(refresh), [refresh]);
  return { projects, refresh, add, remove, update };
}
```

同时把 `lib/storage/projects.ts` 里那段「刻意不实现 PROJECTS_CHANGED 广播」的注释更新为：

```ts
// 跨视图同步：依赖 chrome.storage.onChanged（storage.local.set 自动触发），
// useProjects 监听 'projects' key 变化自动 refresh，无需此处手动广播。
```

- [ ] **Step 5: 验证通过**

Run: `pnpm vitest run tests/useProjects-sync.test.tsx tests/useProjects.test.tsx`
Expected: 两个文件 PASS（新测试 + 原 useProjects 增删测试不回归）。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/hooks/useProjects.ts lib/storage/projects.ts tests/setup.ts tests/useProjects-sync.test.tsx
git commit -m "feat(hooks): useProjects 监听 storage.onChanged 实现跨视图同步"
```

---

### Task 6: messaging 协议 projectId → domain

**Files:**
- Modify: `lib/messaging/types.ts`（`GscStart.projectId`/`BingStart.projectId` → `domain`）
- Modify: `tests/messaging.test.ts`、`tests/bing-messaging.test.ts`（更新断言）

**Interfaces:**
- Produces: `GscStart = { type:'GSC_START'; domain: string; urls: string[] }`，`BingStart` 同理。

- [ ] **Step 1: 写失败测试（先改测试断言）**

`tests/messaging.test.ts` 第 19 行：

```ts
// 旧
const m: GscRequest = { type: 'GSC_START', projectId: 'p1', urls: ['https://x.com/'] };
// 新
const m: GscRequest = { type: 'GSC_START', domain: 'example.com', urls: ['https://x.com/'] };
```

`tests/bing-messaging.test.ts` 第 16 行同理：`projectId: 'p1'` → `domain: 'example.com'`。

- [ ] **Step 2: 验证失败（类型错误）**

Run: `pnpm vitest run tests/messaging.test.ts tests/bing-messaging.test.ts`
Expected: FAIL / tsc 报错 —— `domain` 不在 `GscStart` 上。

- [ ] **Step 3: 改 messaging/types.ts**

`lib/messaging/types.ts` —— `GscStart`：

```ts
export interface GscStart {
  type: 'GSC_START';
  /** 目标域名，background 用其拼 GSC URL（手动填或项目域名）。 */
  domain: string;
  urls: string[];
}
```

`BingStart`：

```ts
export interface BingStart {
  type: 'BING_START';
  /** 目标域名，background 用其拼 Bing URL Inspection 的 siteUrl 参数。 */
  domain: string;
  urls: string[];
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/messaging.test.ts tests/bing-messaging.test.ts`
Expected: PASS。

> ⚠️ 此时 `pnpm compile` 会报错：`background.ts` / `useGscRunner.ts` / `useBingRunner.ts` 仍用 `projectId`。这些在 Task 7 修复。本任务只动 messaging 类型与测试，保持 messaging 测试绿。

- [ ] **Step 5: 提交**

```bash
git add lib/messaging/types.ts tests/messaging.test.ts tests/bing-messaging.test.ts
git commit -m "refactor(messaging): GSC/Bing 启动消息用 domain 替代 projectId"
```

---

### Task 7: runner hooks + background 改用 domain

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useGscRunner.ts`、`useBingRunner.ts`（`start(domain, urls)` 且返回 Promise）
- Modify: `entrypoints/background.ts`（`handleStart`/`handleBingStart` 用 `msg.domain`，去 `getProjectById`）
- Modify: `entrypoints/sidepanel/pages/GscTool.tsx`、`BingTool.tsx`（调用改 `start(project.domain, urls)`，保持编译绿直到 Task 15 删除）
- Test: `tests/useGscRunner.test.tsx`

**Interfaces:**
- Consumes: `GscStart.domain` from `@lib/messaging/types`
- Produces: `useGscRunner().start(domain: string, urls: string[]): Promise<void>`（在 `GSC_DONE` 时 resolve）；`useBingRunner` 同理。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/useGscRunner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGscRunner } from '../entrypoints/sidepanel/hooks/useGscRunner';

describe('useGscRunner', () => {
  it('start 发送 domain 并在 GSC_DONE 后 resolve', async () => {
    let msgListener: ((e: unknown) => void) | undefined;
    const port = {
      postMessage: vi.fn(),
      onMessage: { addListener: (cb: (e: unknown) => void) => { msgListener = cb; } },
      onDisconnect: { addListener: () => {} },
      disconnect: () => {},
    };
    vi.spyOn(chrome.runtime, 'connect').mockReturnValue(port as never);

    const { result } = renderHook(() => useGscRunner());

    let resolved = false;
    await act(async () => {
      const p = result.current.start('example.com', ['https://x.com/']);
      // 模拟 background 推 DONE
      act(() => { msgListener?.({ type: 'GSC_DONE', ok: 1, failed: 0, skipped: 0 }); });
      await p;
      resolved = true;
    });

    expect(resolved).toBe(true);
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'GSC_START', domain: 'example.com', urls: ['https://x.com/'] });
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/useGscRunner.test.tsx`
Expected: FAIL（`start` 未返回在 DONE resolve 的 promise）。

- [ ] **Step 3: 改 useGscRunner**

```tsx
// entrypoints/sidepanel/hooks/useGscRunner.ts （关键改动）
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGscPort } from '@lib/messaging/protocol';
import type { GscEvent, SubmitResult } from '@lib/messaging/types';

interface RunnerState { running: boolean; total: number; done: number; currentUrl?: string; }
const IDLE: RunnerState = { running: false, total: 0, done: 0 };
interface LogEntry { level: 'info' | 'warn' | 'error'; phase: string; message: string; ts: number; }

export function useGscRunner() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const doneRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<RunnerState>(IDLE);
  const [results, setResults] = useState<SubmitResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const port = createGscPort();
    portRef.current = port;
    port.onMessage.addListener((e: GscEvent) => {
      if (e.type === 'GSC_STATE') {
        setState({ running: e.state === 'running', total: e.total, done: e.done, currentUrl: e.currentUrl });
        setResults(e.results);
      } else if (e.type === 'GSC_LOG') {
        setLogs((prev) => [...prev, { level: e.level, phase: e.phase, message: e.message, ts: Date.now() }]);
      } else if (e.type === 'GSC_DONE') {
        setState(IDLE);
        doneRef.current?.();
        doneRef.current = null;
      }
    });
    return () => port.disconnect();
  }, []);

  const start = useCallback((domain: string, urls: string[]): Promise<void> => {
    setLogs([]);
    setResults([]);
    setState({ running: true, total: urls.length, done: 0 });
    portRef.current?.postMessage({ type: 'GSC_START', domain, urls });
    return new Promise<void>((resolve) => { doneRef.current = resolve; });
  }, []);

  const cancel = useCallback(() => { portRef.current?.postMessage({ type: 'GSC_CANCEL' }); }, []);

  return { state, results, logs, start, cancel };
}
```

`useBingRunner.ts` 做对称改动：`doneRef` + `BING_DONE` resolve + `start(domain, urls): Promise<void>` + postMessage `{ type:'BING_START', domain, urls }`。

- [ ] **Step 4: 改 background 用 domain**

`entrypoints/background.ts`：
- 删除 `import { getProjectById } from '../lib/storage/projects';`（`getSettings` 保留）。
- `handleStart` 签名改为 `msg: { domain: string; urls: string[] }`，删除 `getProjectById` 调用与 `项目不存在` 分支，直接 `const gscUrl = buildGscUrl(msg.domain, accountIndex);`；`needsVerify` 错误信息里的 `project.domain` 改为 `msg.domain`。

```ts
// background.ts —— handleStart 开头改为：
async function handleStart(port: chrome.runtime.Port, msg: { domain: string; urls: string[] }): Promise<void> {
  stopRequested = false;
  const { accountIndex } = await getSettings();
  const gscUrl = buildGscUrl(msg.domain, accountIndex);
  // …其余不变（开 tab / attach / 就绪 / 登录检查 / runBatch / DONE / detach）
}
```

`handleBingStart` 同理：签名 `msg: { domain: string; urls: string[] }`，删除 `getProjectById`，`const bingUrl = buildBingUrl(msg.domain);`。

- [ ] **Step 5: 适配 GscTool / BingTool（保持编译绿，Task 15 删除）**

`GscTool.tsx`：把 `start(projectId, urls)` 改为从 `projects` 解析 domain：

```tsx
// GscTool.tsx
const project = projects.find((p) => p.id === projectId);
// …
<Button onClick={() => project && start(project.domain, urls)} disabled={!ready} style={{ flex: 1 }}>开始批量提交</Button>
```
`ready` 改为 `!!project && urls.length > 0 && !state.running`。

`BingTool.tsx` 同理。

- [ ] **Step 6: 验证**

Run: `pnpm vitest run tests/useGscRunner.test.tsx tests/messaging.test.ts tests/bing-messaging.test.ts tests/gsc-flow.test.ts tests/bing-flow.test.ts && pnpm compile`
Expected: 全 PASS，`pnpm compile` 无错（确认 background/runner/tool 类型对齐）。

- [ ] **Step 7: 提交**

```bash
git add entrypoints/sidepanel/hooks/useGscRunner.ts entrypoints/sidepanel/hooks/useBingRunner.ts entrypoints/background.ts entrypoints/sidepanel/pages/GscTool.tsx entrypoints/sidepanel/pages/BingTool.tsx tests/useGscRunner.test.tsx
git commit -m "refactor(runner): start 改用 domain 并返回 Promise；background 去 getProjectById"
```

---

### Task 8: useSubmitOrchestrator（串行编排）

**Files:**
- Create: `entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts`
- Test: `tests/useSubmitOrchestrator.test.tsx`

**Interfaces:**
- Consumes: `useGscRunner` / `useBingRunner`（`start: (domain, urls) => Promise<void>`）
- Produces: `useSubmitOrchestrator()` → `{ gsc, bing, active: 'gsc'|'bing'|null, run(platforms, domain, urls), cancel() }`，`platforms = { gsc: boolean; bing: boolean }`。串行：GSC 跑完（`await gsc.start`）再 Bing；某平台失败（background 也发 DONE→resolve）不影响下一个。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/useSubmitOrchestrator.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const gscStart = vi.fn();
const bingStart = vi.fn();
const baseRunner = (start: ReturnType<typeof vi.fn>) => ({
  start, cancel: vi.fn(),
  state: { running: false, total: 0, done: 0 },
  results: [], logs: [],
});

vi.mock('../entrypoints/sidepanel/hooks/useGscRunner', () => ({ useGscRunner: () => baseRunner(gscStart) }));
vi.mock('../entrypoints/sidepanel/hooks/useBingRunner', () => ({ useBingRunner: () => baseRunner(bingStart) }));

import { useSubmitOrchestrator } from '../entrypoints/sidepanel/hooks/useSubmitOrchestrator';

beforeEach(() => { gscStart.mockReset(); bingStart.mockReset(); });

describe('useSubmitOrchestrator', () => {
  it('串行：GSC 完成后才启动 Bing', async () => {
    let resolveGsc!: () => void;
    gscStart.mockImplementation(() => new Promise<void>((r) => { resolveGsc = r; }));
    bingStart.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSubmitOrchestrator());
    let done = false;
    act(() => { result.current.run({ gsc: true, bing: true }, 'example.com', ['https://x.com/']).then(() => { done = true; }); });

    expect(gscStart).toHaveBeenCalledWith('example.com', ['https://x.com/']);
    expect(bingStart).not.toHaveBeenCalled();

    await act(async () => { resolveGsc(); });
    await waitFor(() => expect(bingStart).toHaveBeenCalledWith('example.com', ['https://x.com/']));
    await waitFor(() => expect(done).toBe(true));
  });

  it('只勾选 Bing 时只调 bingStart', async () => {
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: false, bing: true }, 'example.com', ['https://x.com/']); });
    expect(gscStart).not.toHaveBeenCalled();
    expect(bingStart).toHaveBeenCalledOnce();
  });

  it('GSC 失败（reject）不影响 Bing 执行', async () => {
    gscStart.mockRejectedValue(new Error('boom'));
    bingStart.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubmitOrchestrator());
    await act(async () => { await result.current.run({ gsc: true, bing: true }, 'example.com', ['https://x.com/']); });
    expect(bingStart).toHaveBeenCalledOnce();
  });
});
```

> 注：真实 runner 的 start 在 background 报错时仍会发 `GSC_DONE` 并 resolve（见 background 的 catch 分支），不会 reject。orchestrator 同时兼容 reject（吞掉错误继续下一平台），双重保险。

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/useSubmitOrchestrator.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 useSubmitOrchestrator**

```tsx
// entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts
import { useCallback, useState } from 'react';
import { useGscRunner } from './useGscRunner';
import { useBingRunner } from './useBingRunner';

export interface Platforms { gsc: boolean; bing: boolean; }

export function useSubmitOrchestrator() {
  const gsc = useGscRunner();
  const bing = useBingRunner();
  const [active, setActive] = useState<'gsc' | 'bing' | null>(null);

  const run = useCallback(async (platforms: Platforms, domain: string, urls: string[]) => {
    if (platforms.gsc) {
      setActive('gsc');
      try { await gsc.start(domain, urls); } catch { /* 某平台失败不中断后续 */ }
    }
    if (platforms.bing) {
      setActive('bing');
      try { await bing.start(domain, urls); } catch { /* 同上 */ }
    }
    setActive(null);
  }, [gsc, bing]);

  const cancel = useCallback(() => { gsc.cancel(); bing.cancel(); }, [gsc, bing]);

  return { gsc, bing, active, run, cancel };
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/useSubmitOrchestrator.test.tsx`
Expected: PASS（串行、单选、失败不中断）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/hooks/useSubmitOrchestrator.ts tests/useSubmitOrchestrator.test.tsx
git commit -m "feat(hooks): 新增 useSubmitOrchestrator 串行编排 GSC→Bing"
```

---

### Task 9: Combobox 网站选择器

**Files:**
- Create: `entrypoints/sidepanel/components/Combobox.tsx`
- Test: `tests/combobox.test.tsx`

**Interfaces:**
- Produces: `Combobox({ value, options: string[], onChange, onManage?, placeholder? })` —— 输入时按 `includes` 过滤 `options` 显示建议；点建议 → `onChange(domain)` 并收起；齿轮按钮 → `onManage()`。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/combobox.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Combobox from '../entrypoints/sidepanel/components/Combobox';

describe('Combobox', () => {
  it('输入时按 includes 过滤建议', () => {
    const { container } = render(<Combobox value="" options={['example.com', 'shop.example.com', 'other.io']} onChange={() => {}} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'example' } });
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(screen.getByText('shop.example.com')).toBeTruthy();
    expect(screen.queryByText('other.io')).toBeNull();
  });
  it('点击建议触发 onChange', () => {
    const onChange = vi.fn();
    render(<Combobox value="ex" options={['example.com']} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('ex'), { target: { value: 'ex' } });
    fireEvent.mouseDown(screen.getByText('example.com'));
    expect(onChange).toHaveBeenCalledWith('example.com');
  });
  it('齿轮按钮触发 onManage', () => {
    const onManage = vi.fn();
    render(<Combobox value="" options={[]} onChange={() => {}} onManage={onManage} />);
    fireEvent.click(screen.getByLabelText('项目管理'));
    expect(onManage).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/combobox.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 Combobox**

```tsx
// entrypoints/sidepanel/components/Combobox.tsx
import { useState } from 'react';
import { IconSettings } from './icons';

export interface ComboboxProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onManage?: () => void;
  placeholder?: string;
}

export default function Combobox({ value, options, onChange, onManage, placeholder }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const suggestions = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 8);

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          style={{
            width: '100%', height: 32, padding: '0 10px',
            background: 'var(--color-canvas)', color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)',
            fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)',
          }}
        />
        {open && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 34, left: 0, right: 0, zIndex: 10,
            background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(20,20,19,0.08)', overflow: 'hidden',
          }}>
            {suggestions.map((o) => (
              <button
                key={o}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)', cursor: 'pointer' }}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
      {onManage && (
        <button type="button" aria-label="项目管理" onClick={onManage} style={{
          flexShrink: 0, width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)',
          color: 'var(--color-muted)', cursor: 'pointer', lineHeight: 0,
        }}>
          <IconSettings size={16} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/combobox.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/Combobox.tsx tests/combobox.test.tsx
git commit -m "feat(sidepanel): 新增 Combobox 网站选择器（输入建议 + 齿轮入口）"
```

---

### Task 10: ProjectModal 项目管理弹窗

**Files:**
- Create: `entrypoints/sidepanel/components/ProjectModal.tsx`
- Test: `tests/projectmodal.test.tsx`

**Interfaces:**
- Consumes: `useProjects`（add/remove）、`isValidDomain` from `@lib/storage/projects`
- Produces: `ProjectModal({ onClose })`。遮罩点击 / ✕ / ESC 关闭。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/projectmodal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectModal from '../entrypoints/sidepanel/components/ProjectModal';

describe('ProjectModal', () => {
  it('添加域名后列表更新', async () => {
    render(<ProjectModal onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('example.com'), { target: { value: 'modal-test.com' } });
    fireEvent.click(screen.getByText('添加'));
    const item = await screen.findByText('modal-test.com');
    expect(item).toBeTruthy();
  });
  it('遮罩点击触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<ProjectModal onClose={onClose} />);
    fireEvent.mouseDown(container.querySelector('.modal__overlay')!);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('ESC 触发 onClose', () => {
    const onClose = vi.fn();
    render(<ProjectModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/projectmodal.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 ProjectModal**

```tsx
// entrypoints/sidepanel/components/ProjectModal.tsx
import { useEffect, useState } from 'react';
import Button from './Button';
import TextInput from './TextInput';
import { IconClose } from './icons';
import { useProjects } from '../hooks/useProjects';
import { isValidDomain } from '@lib/storage/projects';

export default function ProjectModal({ onClose }: { onClose: () => void }) {
  const { projects, add, remove } = useProjects();
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    try { await add(domain); setDomain(''); setError(''); }
    catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="modal__overlay" onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(20,20,19,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{
        width: 'min(360px, 92vw)', background: 'var(--color-canvas)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-hairline)', padding: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}>项目管理</h2>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ border: 'none', background: 'none', color: 'var(--color-muted)', cursor: 'pointer', lineHeight: 0, padding: 4 }}>
            <IconClose size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <TextInput value={domain} placeholder="example.com" onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && isValidDomain(domain)) submit(); }} />
          <Button onClick={submit} disabled={!isValidDomain(domain)}>添加</Button>
        </div>
        {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 6 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {projects.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: 'var(--color-surface-card)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.domain}</span>
              <button onClick={() => remove(p.id).catch((e) => setError((e as Error).message ?? String(e)))} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          ))}
          {projects.length === 0 && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>还没有项目</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/projectmodal.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/ProjectModal.tsx tests/projectmodal.test.tsx
git commit -m "feat(sidepanel): 新增 ProjectModal 项目管理弹窗"
```

---

### Task 11: PlatformChip 平台开关

**Files:**
- Create: `entrypoints/sidepanel/components/PlatformChip.tsx`
- Modify: `entrypoints/sidepanel/styles/global.css`（追加 `.platform-chip`）
- Test: `tests/platformchip.test.tsx`

**Interfaces:**
- Produces: `PlatformChip({ label, icon, checked, onToggle })`。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/platformchip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlatformChip from '../entrypoints/sidepanel/components/PlatformChip';
import { GscMark } from '../entrypoints/sidepanel/components/icons';

describe('PlatformChip', () => {
  it('点击切换 onToggle', () => {
    const onToggle = vi.fn();
    render(<PlatformChip label="GSC" icon={<GscMark />} checked onToggle={onToggle} />);
    fireEvent.click(screen.getByText('GSC'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
  it('checked 时带 is-active 类', () => {
    const { container } = render(<PlatformChip label="Bing" icon={<span />} checked onToggle={() => {}} />);
    expect(container.querySelector('.platform-chip.is-active')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/platformchip.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 PlatformChip**

```tsx
// entrypoints/sidepanel/components/PlatformChip.tsx
export interface PlatformChipProps {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onToggle: () => void;
}

export default function PlatformChip({ label, icon, checked, onToggle }: PlatformChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`platform-chip${checked ? ' is-active' : ''}`}
    >
      <span style={{ display: 'inline-flex', lineHeight: 0 }}>{icon}</span>
      <span>{label}</span>
      <span aria-hidden style={{ fontSize: 11, opacity: checked ? 1 : 0.5 }}>{checked ? '✓' : '○'}</span>
    </button>
  );
}
```

- [ ] **Step 4: 追加 CSS**

在 `global.css` 末尾追加：

```css
/* 平台开关 chip */
.platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--radius-pill);
  background: var(--color-canvas);
  color: var(--color-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.platform-chip:hover { background: var(--color-surface-card); }
.platform-chip.is-active {
  background: var(--color-surface-cream-strong);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
```

- [ ] **Step 5: 验证通过**

Run: `pnpm vitest run tests/platformchip.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/components/PlatformChip.tsx entrypoints/sidepanel/styles/global.css tests/platformchip.test.tsx
git commit -m "feat(sidepanel): 新增 PlatformChip 平台开关"
```

---

### Task 12: SubmitPanel 提交子面板

**Files:**
- Create: `entrypoints/sidepanel/pages/SubmitPanel.tsx`
- Test: `tests/submitpanel.test.tsx`

**Interfaces:**
- Consumes: `Site` from `@hooks/useSite`；`useSubmitOrchestrator`；`isValidDomain` from `@lib/storage/projects`；`PlatformChip`、`Button`、`Textarea`、`LogPanel`、`IconBack`、`GscMark`、`BingMark`
- Produces: `SubmitPanel({ site, onBack })`。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/submitpanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const run = vi.fn();
vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run,
    cancel: vi.fn(),
    active: null,
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SubmitPanel from '../entrypoints/sidepanel/pages/SubmitPanel';

describe('SubmitPanel', () => {
  it('手动填非法域名提交时显示错误且不调用 run', () => {
    render(<SubmitPanel site={{ domain: 'not a domain' }} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com/' } });
    fireEvent.click(screen.getByText('一次提交'));
    expect(screen.getByText(/请先选择或填写有效网站/)).toBeTruthy();
    expect(run).not.toHaveBeenCalled();
  });
  it('有效域名 + 链接时点击提交调用 run', () => {
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com/es/' } });
    fireEvent.click(screen.getByText('一次提交'));
    expect(run).toHaveBeenCalledWith({ gsc: true, bing: true }, 'example.com', ['https://example.com/es/']);
  });
  it('返回按钮触发 onBack', () => {
    const onBack = vi.fn();
    render(<SubmitPanel site={{ domain: 'example.com' }} onBack={onBack} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/submitpanel.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 SubmitPanel**

```tsx
// entrypoints/sidepanel/pages/SubmitPanel.tsx
import { useState } from 'react';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import LogPanel from '../components/LogPanel';
import PlatformChip from '../components/PlatformChip';
import { IconBack, GscMark, BingMark } from '../components/icons';
import { useSubmitOrchestrator } from '../hooks/useSubmitOrchestrator';
import { isValidDomain } from '@lib/storage/projects';
import type { Site } from '../hooks/useSite';

export default function SubmitPanel({ site, onBack }: { site: Site; onBack: () => void }) {
  const orch = useSubmitOrchestrator();
  const [text, setText] = useState('');
  const [gsc, setGsc] = useState(true);
  const [bing, setBing] = useState(true);
  const [error, setError] = useState('');

  const urls = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const busy = orch.gsc.state.running || orch.bing.state.running;
  const ready = urls.length > 0 && (gsc || bing) && !busy;

  function submit() {
    if (!isValidDomain(site.domain)) { setError('请先选择或填写有效网站（如 example.com）'); return; }
    setError('');
    void orch.run({ gsc, bing }, site.domain.trim(), urls);
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <IconBack size={14} /> 返回
      </button>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>网站提交</h2>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>目标平台</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)' }}>
        <PlatformChip label="GSC" icon={<GscMark />} checked={gsc} onToggle={() => setGsc((v) => !v)} />
        <PlatformChip label="Bing" icon={<BingMark />} checked={bing} onToggle={() => setBing((v) => !v)} />
      </div>

      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>链接（每行一条）</label>
      <Textarea rows={6} value={text} placeholder={'https://example.com/es/\nhttps://example.com/de/'} onChange={(e) => setText(e.target.value)} />

      {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-md)' }}>
        <Button onClick={submit} disabled={!ready} style={{ flex: 1 }}>{busy ? '提交中…' : '一次提交'}</Button>
        {busy && <Button variant="secondary" onClick={orch.cancel}>取消</Button>}
      </div>

      <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(gsc || orch.gsc.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍GSC{orch.gsc.state.total > 0 ? `  ${orch.gsc.state.done}/${orch.gsc.state.total}` : ''}</div>
            <LogPanel logs={orch.gsc.logs} />
          </div>
        )}
        {(bing || orch.bing.logs.length > 0) && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>▍Bing{orch.bing.state.total > 0 ? `  ${orch.bing.state.done}/${orch.bing.state.total}` : ''}</div>
            <LogPanel logs={orch.bing.logs} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/submitpanel.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/SubmitPanel.tsx tests/submitpanel.test.tsx
git commit -m "feat(sidepanel): 新增 SubmitPanel 提交子面板（整合 GSC+Bing + 分区日志）"
```

---

### Task 13: SiteTools 网站工具板块

**Files:**
- Create: `entrypoints/sidepanel/pages/SiteTools.tsx`
- Test: `tests/sitetools.test.tsx`

**Interfaces:**
- Consumes: `useSite`、`useProjects`、`Combobox`、`ProjectModal`、`ToolCard`、`SubmitPanel`、`IconSubmit`/`IconRobots`/`IconSitemap`、`buildSeoFileUrl` from `@lib/seo-files/url`
- Produces: `SiteTools()` —— 顶部 Combobox（齿轮→ProjectModal）+ 工具列表（list）/ 提交子面板（submit）。robots/sitemap 用 `site.domain` 直接打开，未选网站禁用。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/sitetools.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run: vi.fn(), cancel: vi.fn(), active: null,
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import SiteTools from '../entrypoints/sidepanel/pages/SiteTools';

describe('SiteTools', () => {
  it('点击「网站提交」进入提交子面板（出现返回）', async () => {
    render(<SiteTools />);
    fireEvent.click(screen.getByText('网站提交'));
    expect(await screen.findByText('返回')).toBeTruthy();
  });
  it('选择有效网站后，点击 robots.txt 打开新标签', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    // 在网站选择器输入有效域名
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByText('robots.txt'));
    expect(createSpy).toHaveBeenCalled();
    const url = createSpy.mock.calls[0][0].url as string;
    expect(url).toBe('https://example.com/robots.txt');
    createSpy.mockRestore();
  });
  it('未选网站时 robots.txt 禁用', () => {
    render(<SiteTools />);
    const robots = screen.getByText('robots.txt').closest('[role="button"], .tool-card');
    expect(robots?.getAttribute('aria-disabled')).toBe('true');
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/sitetools.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 实现 SiteTools**

```tsx
// entrypoints/sidepanel/pages/SiteTools.tsx
import { useState } from 'react';
import Combobox from '../components/Combobox';
import ToolCard from '../components/ToolCard';
import ProjectModal from '../components/ProjectModal';
import SubmitPanel from './SubmitPanel';
import { IconSubmit, IconRobots, IconSitemap } from '../components/icons';
import { useSite } from '../hooks/useSite';
import { useProjects } from '../hooks/useProjects';
import { buildSeoFileUrl, type SeoFile } from '@lib/seo-files/url';
import { isValidDomain } from '@lib/storage/projects';

export default function SiteTools() {
  const { site, setSite } = useSite();
  const { projects } = useProjects();
  const [view, setView] = useState<'list' | 'submit'>('list');
  const [modalOpen, setModalOpen] = useState(false);

  const domains = projects.map((p) => p.domain);
  const hasSite = isValidDomain(site.domain);

  function openSeo(file: SeoFile) {
    if (!hasSite) return;
    try { chrome.tabs.create({ url: buildSeoFileUrl(site.domain, file) }); }
    catch { /* buildSeoFileUrl 校验失败静默（已由 hasSite 拦截） */ }
  }

  if (view === 'submit') return <SubmitPanel site={site} onBack={() => setView('list')} />;

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>网站</label>
      <Combobox value={site.domain} options={domains} placeholder="example.com" onChange={(v) => setSite({ domain: v })} onManage={() => setModalOpen(true)} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-lg)' }}>
        <ToolCard icon={<IconSubmit />} title="网站提交" subtitle="GSC · Bing" onClick={() => setView('submit')} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <ToolCard icon={<IconRobots />} title="robots.txt" onClick={hasSite ? () => openSeo('robots.txt') : undefined} disabled={!hasSite} />
          </div>
          <div style={{ flex: 1 }}>
            <ToolCard icon={<IconSitemap />} title="sitemap.xml" onClick={hasSite ? () => openSeo('sitemap.xml') : undefined} disabled={!hasSite} />
          </div>
        </div>
        {!hasSite && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>请先选择或填写网站以打开 SEO 文件</div>}
      </div>

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: 验证通过**

Run: `pnpm vitest run tests/sitetools.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/SiteTools.tsx tests/sitetools.test.tsx
git commit -m "feat(sidepanel): 新增 SiteTools 网站工具板块（选择器+工具列表+提交子面板）"
```

---

### Task 14: KeywordTools 关键词工具板块

**Files:**
- Create: `entrypoints/sidepanel/pages/KeywordTools.tsx`
- Modify: `entrypoints/sidepanel/pages/AhrefsTool.tsx`（去掉自带 h2，改由 KeywordTools 提供板块标题）
- Test: `tests/keywordtools.test.tsx`

**Interfaces:**
- Produces: `KeywordTools()` —— 板块标题 + 渲染 `AhrefsTool` 表单。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/keywordtools.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KeywordTools from '../entrypoints/sidepanel/pages/KeywordTools';

describe('KeywordTools', () => {
  it('渲染板块标题与国家/关键词输入', () => {
    render(<KeywordTools />);
    expect(screen.getByText('关键词工具')).toBeTruthy();
    expect(screen.getByPlaceholderText('如 apple')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/keywordtools.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 改 AhrefsTool（去 h2）**

把 `entrypoints/sidepanel/pages/AhrefsTool.tsx` 第 39 行的 `<h2 ...>Ahrefs KD 查询</h2>` 删除（整行），顶部直接从 `<label>国家</label>` 开始。其余逻辑（storage 记忆、buildAhrefsUrl、打开查询）不变。

- [ ] **Step 4: 实现 KeywordTools**

```tsx
// entrypoints/sidepanel/pages/KeywordTools.tsx
import AhrefsTool from './AhrefsTool';

export default function KeywordTools() {
  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h2 style={{ fontSize: 17, marginBottom: 'var(--space-md)' }}>关键词工具</h2>
      <AhrefsTool />
    </div>
  );
}
```

- [ ] **Step 5: 验证通过**

Run: `pnpm vitest run tests/keywordtools.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/pages/KeywordTools.tsx entrypoints/sidepanel/pages/AhrefsTool.tsx tests/keywordtools.test.tsx
git commit -m "feat(sidepanel): 新增 KeywordTools 板块（包裹 Ahrefs KD 表单）"
```

---

### Task 15: 重写 App.tsx + 删除旧页面

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`（Header + TabBar + 板块路由）
- Delete: `entrypoints/sidepanel/components/SideNav.tsx`
- Delete: `entrypoints/sidepanel/pages/SeoFiles.tsx`、`Projects.tsx`、`GscTool.tsx`、`BingTool.tsx`
- Test: `tests/app.test.tsx`

**Interfaces:**
- Consumes: `Header`、`TabBar`（`Tab`）、`SiteTools`、`KeywordTools`
- Produces: `App()` 渲染 `tab: 'site'|'keyword'` 路由。

- [ ] **Step 1: 写失败测试**

```tsx
// tests/app.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../entrypoints/sidepanel/hooks/useSubmitOrchestrator', () => ({
  useSubmitOrchestrator: () => ({
    run: vi.fn(), cancel: vi.fn(), active: null,
    gsc: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
    bing: { state: { running: false, total: 0, done: 0 }, logs: [], results: [] },
  }),
}));

import App from '../entrypoints/sidepanel/App';

describe('App', () => {
  it('默认显示网站工具板块，切到关键词工具显示 Ahrefs 表单', () => {
    render(<App />);
    expect(screen.getByText('网站工具')).toBeTruthy();
    expect(screen.getByText('网站提交')).toBeTruthy();
    fireEvent.click(screen.getByText('关键词工具'));
    expect(screen.getByText('关键词工具', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByPlaceholderText('如 apple')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 验证失败**

Run: `pnpm vitest run tests/app.test.tsx`
Expected: FAIL（App 仍是旧 SideNav 版）。

- [ ] **Step 3: 重写 App.tsx**

```tsx
// entrypoints/sidepanel/App.tsx
import { useState } from 'react';
import Header from './components/Header';
import TabBar, { type Tab } from './components/TabBar';
import SiteTools from './pages/SiteTools';
import KeywordTools from './pages/KeywordTools';

export default function App() {
  const [tab, setTab] = useState<Tab>('site');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <TabBar tab={tab} onChange={setTab} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {tab === 'site' ? <SiteTools /> : <KeywordTools />}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 删除旧文件**

```bash
git rm entrypoints/sidepanel/components/SideNav.tsx
git rm entrypoints/sidepanel/pages/SeoFiles.tsx
git rm entrypoints/sidepanel/pages/Projects.tsx
git rm entrypoints/sidepanel/pages/GscTool.tsx
git rm entrypoints/sidepanel/pages/BingTool.tsx
```

- [ ] **Step 5: 验证通过**

Run: `pnpm vitest run tests/app.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add entrypoints/sidepanel/App.tsx tests/app.test.tsx
git commit -m "refactor(sidepanel): App 改为 Header+TabBar 双板块路由，删除旧 SideNav/SeoFiles/Projects/GscTool/BingTool"
```

---

### Task 16: 全量验证 + 收尾

**Files:**
- Verify-only（无新增）

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS（含新增 13 个测试文件 + 原有测试，无回归）。

- [ ] **Step 2: 类型检查**

Run: `pnpm compile`
Expected: 无错误（确认删除旧文件后无悬空 import，messaging/background/runner 类型一致）。

- [ ] **Step 3: 构建**

Run: `pnpm build`
Expected: 构建成功（WXT 产物生成）。

- [ ] **Step 4: 手测清单（开发者本地，在真实 Chrome 加载 .output 验证）**

- [ ] 打开 sidepanel → 默认「网站工具」Tab，显示网站选择器 + 三个工具入口。
- [ ] 网站选择器输入 `example` → 出现项目建议；点建议填入；点齿轮 → 弹出项目管理弹窗。
- [ ] 项目管理弹窗：添加/删除域名 → 关闭后选择器建议列表更新（onChanged 同步）。
- [ ] 未选网站时 robots/sitemap 禁用；选网站后点击 → 新标签打开 `https://<domain>/robots.txt`、`/sitemap.xml`。
- [ ] 点「网站提交」→ 进入子面板；默认 GSC+Bing 勾选；粘贴链接点「一次提交」→ 先 GSC 后 Bing 串行，日志分区显示进度。
- [ ] 切「关键词工具」Tab → Ahrefs 表单，选国家+关键词点「打开查询」→ 新标签打开 Ahrefs。
- [ ] 关闭重开 sidepanel → 上次网站记忆恢复。

- [ ] **Step 5: 提交（如有手测发现的修复）**

```bash
# 若手测发现问题并修复后：
git add -A
git commit -m "fix(sidepanel): 手测修复（按实际填写）"
# 若无问题，无需提交。
```

---

## Self-Review 记录

- **Spec 覆盖**：
  - 顶部双 Tab → Task 2/15 ✓
  - 网站选择器 combobox + 齿轮弹窗 → Task 9/10/13 ✓
  - 网站提交整合 GSC+Bing + 平台开关 + 共用输入 + 分区日志 → Task 7/8/11/12 ✓
  - robots/sitemap 直接打开（删 SeoFiles）→ Task 13/15 ✓
  - 关键词工具仅 Ahrefs（无子面板）→ Task 14 ✓
  - 项目弹窗（删 Projects）→ Task 10/15 ✓
  - runner 改 domain → Task 6/7 ✓
  - ✲ 星形 logo + 线性图标集 → Task 1 ✓
  - 跨视图同步 → Task 5 ✓
  - 删除 SideNav → Task 15 ✓
- **占位符**：无 TBD/TODO，所有步骤含真实代码与命令。
- **类型一致**：`start(domain, urls): Promise<void>` 在 Task 7 定义、Task 8 orchestrator 消费一致；`Site = { domain; projectId? }` 在 Task 4 定义、Task 12/13 消费一致；messaging `domain` 在 Task 6 定义、Task 7 background/runner 消费一致。
- **已知简化**（spec 实现细化，已在本计划顶部「对 spec 的实现细化」说明）：messaging 用 `domain`、跨视图用 `onChanged`、状态就近、图标单文件。
