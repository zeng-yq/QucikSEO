# 域名输入自动清洗与校验提示 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让两个域名输入入口（网站选择框、项目管理添加框）在失焦时自动把 `https://example.com/path` 这类脏值清洗为 `example.com` 并回填，清洗后仍无效时给出具体提示。

**Architecture:** 新增纯函数 `normalizeDomain`（用 `new URL().hostname` 剥离 scheme/path/query/userinfo/端口，转小写；非 ASCII 判空）。调用处把 `isValidDomain(x)` 改为 `isValidDomain(normalizeDomain(x))`，清洗是前置层、校验语义不变。失焦回填由各入口的 `onBlur` 触发。

**Tech Stack:** TypeScript、React 19、WXT、vitest（jsdom + globals）、@testing-library/react。测试别名 `@lib` → `lib/`。

## Global Constraints

- **不改 `isValidDomain` 正则** `/^([a-z0-9-]+\.)+[a-z]{2,}$/i`——其他调用方行为不变。
- 清洗统一用 `new URL(withScheme).hostname.toLowerCase()`；**hostname 不含端口**（区别于 `host`）。
- 输入含非 ASCII（中文域名 / IDN）→ `normalizeDomain` 返回 `''`（不支持，避免 Punycode 透出）。
- **www 保留**（不主动去裸域）；端口必去。
- **失焦清洗**，不在输入过程中实时回填（避免打断打字）。
- 测试用 `vitest`，jsdom 环境，`globals: true`（`describe/it/expect/beforeEach` 全局可用，但现有测试仍显式 `import { describe, it, expect, vi } from 'vitest'`，保持一致）。
- 单文件跑：`pnpm test <path>`（等价 `vitest run <path>`）。
- commit message 用中文 conventional commit（`feat(scope):` / `test(scope):` 等），与现有 git log 一致。

## File Structure

| 文件 | 责任 | 本计划改动 |
|---|---|---|
| `lib/storage/projects.ts` | 域名工具：`isValidDomain`、`DOMAIN_RE` | 新增 `normalizeDomain` 导出 |
| `entrypoints/sidepanel/components/Combobox.tsx` | 通用下拉输入组件 | 新增可选 `onBlur` 透传 |
| `entrypoints/sidepanel/pages/SiteTools.tsx` | 网站 tab 页 | `hasSite` 前置 normalize、`onBlur` 清洗回填、三态提示 |
| `entrypoints/sidepanel/components/ProjectModal.tsx` | 项目管理弹窗 | `onBlur` 清洗回填、按钮/Enter 判定前置 normalize、本地校验提示 |
| `tests/domain-normalize.test.ts` | `normalizeDomain` 纯函数单测 | 新建 |
| `tests/combobox.test.tsx` | Combobox 组件测试 | 加 `onBlur` 透传用例 |
| `tests/sitetools.test.tsx` | SiteTools 集成测试 | 加失焦清洗 + 无效提示用例 |
| `tests/projectmodal.test.tsx` | ProjectModal 测试 | 加失焦清洗 + 无效提示用例 |

---

## Task 1: `normalizeDomain` 纯函数

**Files:**
- Modify: `lib/storage/projects.ts`（在 `isValidDomain` 之后新增 `normalizeDomain`）
- Test: `tests/domain-normalize.test.ts`（新建）

**Interfaces:**
- Produces: `normalizeDomain(input: string): string` —— 剥离 scheme/path/query/fragment/userinfo/端口、转小写；空串或含非 ASCII 或解析失败时返回 `''`。Task 2、Task 3 消费此函数。

- [ ] **Step 1: 写失败测试（新建 `tests/domain-normalize.test.ts`）**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeDomain, isValidDomain } from '../lib/storage/projects';

describe('normalizeDomain', () => {
  it('剥离 scheme / path / query / fragment', () => {
    expect(normalizeDomain('https://example.com/path?x=1#frag')).toBe('example.com');
    expect(normalizeDomain('http://example.com/')).toBe('example.com');
  });
  it('剥离 userinfo 与端口', () => {
    expect(normalizeDomain('http://user:pass@example.com')).toBe('example.com');
    expect(normalizeDomain('example.com:8080')).toBe('example.com');
  });
  it('转小写 + trim', () => {
    expect(normalizeDomain('  HTTPS://WWW.Example.COM/  ')).toBe('www.example.com');
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });
  it('保留 www（不主动去裸域）', () => {
    expect(normalizeDomain('www.example.com')).toBe('www.example.com');
  });
  it('空串 / 纯空白返回空', () => {
    expect(normalizeDomain('')).toBe('');
    expect(normalizeDomain('   ')).toBe('');
  });
  it('含非 ASCII（中文域名 / 重音字符）返回空，不支持 IDN', () => {
    expect(normalizeDomain('例子.中国')).toBe('');
    expect(normalizeDomain('café.com')).toBe('');
  });
  it('无点的裸词返回原样（交由 isValidDomain 判定无效）', () => {
    expect(normalizeDomain('notadomain')).toBe('notadomain');
  });
});

describe('isValidDomain(normalizeDomain(x)) 组合', () => {
  const valid = (x: string) => isValidDomain(normalizeDomain(x));
  it('脏输入清洗后判有效', () => {
    expect(valid('https://example.com/path')).toBe(true);
    expect(valid('example.com:8080')).toBe(true);
    expect(valid('HTTPS://WWW.Example.COM/')).toBe(true);
  });
  it('无效输入仍判无效', () => {
    expect(valid('notadomain')).toBe(false);
    expect(valid('192.168.1.1')).toBe(false); // 末段非 [a-z]{2,}
    expect(valid('例子.中国')).toBe(false);
    expect(valid('')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/domain-normalize.test.ts`
Expected: FAIL —— `normalizeDomain is not a function`（尚未导出）。

- [ ] **Step 3: 实现 `normalizeDomain`（修改 `lib/storage/projects.ts`）**

在 `isValidDomain` 那一行之后插入：

```ts
/**
 * 把用户输入清洗为裸域名主机名（小写）。剥离 scheme / path / query / fragment /
 * userinfo / 端口。输入含非 ASCII（中文域名 / IDN）或解析失败时返回空串，
 * 交由 isValidDomain 判定无效并触发提示。
 *
 * 实现：补 https:// 前缀让 URL 能解析，取 hostname（不含端口；host 才含端口）。
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/[^\x00-\x7F]/.test(trimmed)) return '';        // 非 ASCII → 不支持 IDN
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test tests/domain-normalize.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add lib/storage/projects.ts tests/domain-normalize.test.ts
git commit -m "feat(storage): 新增 normalizeDomain 域名清洗函数"
```

---

## Task 2: 网站选择框失焦清洗 + 三态提示（Combobox + SiteTools）

**Files:**
- Modify: `entrypoints/sidepanel/components/Combobox.tsx`（新增 `onBlur` prop 透传）
- Modify: `entrypoints/sidepanel/pages/SiteTools.tsx`（`hasSite` 前置 normalize、`onBlur` 清洗回填、三态提示）
- Test: `tests/combobox.test.tsx`（加 `onBlur` 用例）
- Test: `tests/sitetools.test.tsx`（加失焦清洗 + 无效提示用例）

**Interfaces:**
- Consumes: `normalizeDomain`（Task 1）。
- Produces: `Combobox` 新增可选 prop `onBlur?: () => void`（input 失焦时立即触发，先于关下拉的 `setTimeout`）。

- [ ] **Step 1: 写 Combobox `onBlur` 透传失败测试（追加到 `tests/combobox.test.tsx` 的 `describe` 内）**

```tsx
  it('失焦触发 onBlur', () => {
    const onBlur = vi.fn();
    const { container } = render(<Combobox value="example.com" options={[]} onChange={() => {}} onBlur={onBlur} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledOnce();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/combobox.test.tsx`
Expected: FAIL —— Combobox 不接受 `onBlur` prop（TypeScript 报错 / 回调未调用）。

- [ ] **Step 3: 改 `Combobox.tsx` 透传 `onBlur`**

把 `ComboboxProps` 与组件签名、input `onBlur` 三处改掉：

```tsx
export interface ComboboxProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onManage?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

export default function Combobox({ value, options, onChange, onManage, onBlur, placeholder }: ComboboxProps) {
```

input 的 `onBlur` 改为（外部回调立即触发，关下拉仍延时 120ms 让下拉项 `onMouseDown` 先处理）：

```tsx
          onBlur={() => { onBlur?.(); setTimeout(() => setOpen(false), 120); }}
```

- [ ] **Step 4: 跑 Combobox 测试确认通过**

Run: `pnpm test tests/combobox.test.tsx`
Expected: PASS（含新用例 + 既有用例不回归）。

- [ ] **Step 5: 写 SiteTools 集成失败测试（追加到 `tests/sitetools.test.tsx` 的 `describe` 内）**

```tsx
  it('脏域名 change 后即启用按钮（hasSite 前置 normalize），失焦后清洗回填', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create').mockResolvedValue({ id: 1 } as never);
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    // 输入脏值（未失焦）
    fireEvent.change(input, { target: { value: 'https://example.com/path' } });
    // change 后即启用：hasSite = isValidDomain(normalizeDomain(...))
    const robots = screen.getByText('robots.txt').closest('[role="button"], .tool-card');
    expect(robots?.getAttribute('aria-disabled')).not.toBe('true');
    // 失焦后回填清洗值
    fireEvent.blur(input);
    expect((screen.getByPlaceholderText('example.com') as HTMLInputElement).value).toBe('example.com');
    // 点击使用清洗后的域名
    fireEvent.click(screen.getByText('robots.txt'));
    expect(createSpy.mock.calls[0][0].url).toBe('https://example.com/robots.txt');
    createSpy.mockRestore();
  });
  it('无效输入显示红字提示', async () => {
    render(<SiteTools />);
    await flush();
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'notadomain' } });
    await flush();
    expect(screen.getByText('请输入有效域名，如 example.com')).toBeInTheDocument();
  });
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm test tests/sitetools.test.tsx`
Expected: FAIL —— 脏值 change 后按钮仍 `aria-disabled="true"`（未前置 normalize），无回填，无提示文案。

- [ ] **Step 7: 改 `SiteTools.tsx`**

7a. 改 import（加 `normalizeDomain`）：

```tsx
import { isValidDomain, normalizeDomain } from '@lib/storage/projects';
```

7b. 改 `hasSite` 为前置 normalize，并新增 `handleSiteBlur`（放在 `hasSite` 那一行附近）：

```tsx
  const domains = projects.map((p) => p.domain);
  const hasSite = isValidDomain(normalizeDomain(site.domain));
  const showInvalid = !!site.domain && !hasSite; // 输入了但清洗后仍无效

  function handleSiteBlur() {
    const n = normalizeDomain(site.domain);
    if (n !== site.domain) setSite({ domain: n });
  }

  function openTool(buildUrl: (domain: string) => string) {
    if (!hasSite) return;
    try { chrome.tabs.create({ url: buildUrl(site.domain) }); }
    catch { /* tabs.create 失败静默(扩展上下文异常等,不阻塞 UI) */ }
  }
```

7c. 给 Combobox 传 `onBlur`：

```tsx
      <Combobox value={site.domain} options={domains} placeholder="example.com" onChange={(v) => setSite({ domain: v })} onBlur={handleSiteBlur} onManage={() => setModalOpen(true)} />
```

7d. 把底部那行灰字提示升级为三态（空 → 灰字引导；无效 → 红字具体原因；有效 → 不显示）：

```tsx
      {!hasSite && (
        <div style={{ color: showInvalid ? 'var(--color-error)' : 'var(--color-muted)', fontSize: 12, marginTop: 'var(--space-sm)' }}>
          {showInvalid ? '请输入有效域名，如 example.com' : '请先选择或填写网站以使用工具'}
        </div>
      )}
```

- [ ] **Step 8: 跑 SiteTools 测试确认通过 + 无回归**

Run: `pnpm test tests/sitetools.test.tsx`
Expected: PASS（新用例 + 既有 7 个用例全部通过——既有"选网站后点 X"用例用的是干净域名 `example.com`/`vercel.com`，前置 normalize 不改变其结果）。

- [ ] **Step 9: 提交**

```bash
git add entrypoints/sidepanel/components/Combobox.tsx entrypoints/sidepanel/pages/SiteTools.tsx tests/combobox.test.tsx tests/sitetools.test.tsx
git commit -m "feat(site-tools): 网站选择框失焦清洗域名并给出校验提示"
```

---

## Task 3: 项目管理添加框失焦清洗 + 本地校验提示（ProjectModal）

**Files:**
- Modify: `entrypoints/sidepanel/components/ProjectModal.tsx`
- Test: `tests/projectmodal.test.tsx`（加用例）

**Interfaces:**
- Consumes: `normalizeDomain`（Task 1）。`TextInput` 已 `{...props}` + `onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}` 透传，无需改 TextInput。

- [ ] **Step 1: 写失败测试（追加到 `tests/projectmodal.test.tsx` 的 `describe` 内）**

```tsx
  it('脏域名失焦后清洗回填', async () => {
    render(<ProjectModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com/path' } });
    fireEvent.blur(input);
    expect(input.value).toBe('example.com');
  });
  it('无效输入显示提示且添加按钮禁用', async () => {
    render(<ProjectModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'notadomain' } });
    expect(screen.getByText('请输入有效域名，如 example.com')).toBeInTheDocument();
    expect(screen.getByText('添加')).toBeDisabled();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test tests/projectmodal.test.tsx`
Expected: FAIL —— 失焦不回填、无提示文案、按钮 disabled 仍基于原始 `domain`（`notadomain` 本就 disabled，但无提示；脏值 `https://...` 未清洗导致按钮禁用、无法添加干净域名）。

- [ ] **Step 3: 改 `ProjectModal.tsx`**

3a. 改 import（加 `normalizeDomain`）：

```tsx
import { isValidDomain, normalizeDomain } from '@lib/storage/projects';
```

3b. 在组件内加派生量 `valid` 与 `handleBlur`，并把 `submit` 改为传清洗后的值。下面是从 `const [domain...]` 到 `submit` 结束的完整替换区域（**`useEffect`（ESC 关闭）原样保留**，位于 `handleBlur` 与 `submit` 之间，不要删）：

```tsx
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  const valid = isValidDomain(normalizeDomain(domain));

  function handleBlur() {
    const n = normalizeDomain(domain);
    if (n !== domain) setDomain(n);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    try { await add(normalizeDomain(domain)); setDomain(''); setError(''); }
    catch (e) { setError((e as Error).message); }
  }
```

3c. `TextInput` 加 `onBlur`，`onKeyDown` 与「添加」按钮的判定改用 `valid`：

```tsx
          <TextInput value={domain} placeholder="example.com" onChange={(e) => setDomain(e.target.value)} onBlur={handleBlur} onKeyDown={(e) => { if (e.key === 'Enter' && valid) submit(); }} />
          <Button onClick={submit} disabled={!valid}>添加</Button>
```

3d. 在既有 `error` 红字位之后，补本地校验提示（`error` 优先：本地无效时按钮已禁用、不会触发 `add`，二者不并存）：

```tsx
        {error && <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 6 }}>{error}</div>}
        {!error && !!domain && !valid && <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 6 }}>请输入有效域名，如 example.com</div>}
```

- [ ] **Step 4: 跑 ProjectModal 测试确认通过 + 无回归**

Run: `pnpm test tests/projectmodal.test.tsx`
Expected: PASS（新用例 + 既有"添加域名后列表更新""遮罩点击""ESC"三例通过——既有用例用干净域名 `modal-test.com`，不受影响）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/ProjectModal.tsx tests/projectmodal.test.tsx
git commit -m "feat(project-modal): 添加框失焦清洗域名并给出校验提示"
```

---

## 收尾验证

- [ ] **Step 1: 跑全套测试**

Run: `pnpm test`
Expected: 全部 PASS，无回归。

- [ ] **Step 2: 类型检查**

Run: `pnpm compile`（= `tsc --noEmit`）
Expected: 无错误（重点确认 `normalizeDomain` 类型、Combobox 新 prop、SiteTools/ProjectModal 派生量无未使用报错）。

- [ ] **Step 3: 手测（可选，需 `pnpm run build` 装载扩展）**

- 网站 tab 输入 `https://www.example.com/a` → Tab 离开 → 框内变 `www.example.com`，工具按钮可点。
- 网站 tab 输入 `notadomain` → 框下显示红字「请输入有效域名，如 example.com」。
- 项目管理弹窗重复上述两项。
