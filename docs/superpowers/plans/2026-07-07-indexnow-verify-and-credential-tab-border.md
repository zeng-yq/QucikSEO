# IndexNow 测试连接 + 凭证 Tab 边框 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给凭证设置的 IndexNow Tab 增加「测试连接」功能（GET 验证 `<host>/<key>.txt`），并给非激活 Tab 加浅边框轮廓。

**Architecture:** host 从 `SubmitPanel` 的 `site.domain` 经 `CredentialsSection` → `IndexNowKeySection` prop drilling 透传到 `useIndexNowKey.testConnection(host)`，最终调用 `lib/indexnow/submit.ts` 新增的 `verifyKeyFile(key, host)`（GET `<origin>/<key>.txt`，校验内容匹配）。Tab 边框改一处全局 CSS。

**Tech Stack:** React 19、TypeScript、WXT（MV3 扩展）、Vitest + @testing-library/react、内联 style + `global.css`。

## Global Constraints

- 不新增 host 输入框：测试只用 `site.domain`，多站点时切换选中站点再测。
- 不做 IndexNow API 端到端提交测试（避免真实提交副作用与 429）。
- 不引入 Context/全局 store 传递域名：用 prop drilling（3 层）。
- 不改 GSC Tab 的任何行为。
- `TestStatus` 语义复用 GSC：`'idle' | 'testing' | 'ok' | 'fail'`，在 `useIndexNowKey.ts` 本地声明（与 GSC 对称、各自独立，不跨 hook 导入）。
- 测试用 vitest + @testing-library/react；mock fetch 用 `vi.spyOn(globalThis, 'fetch')`，读 body 时 mock `text()`。
- lib 内部 import 用相对路径（如 `../seo-files/url`）；组件/import lib 用 `@lib` alias。
- 按钮复用 `Button` 组件 `variant="secondary"`；提交信息走中文 + scope（如 `feat(indexnow): ...`）。

---

## Task 1: `verifyKeyFile` —— lib 层密钥文件验证

**Files:**
- Modify: `lib/indexnow/submit.ts`（末尾追加 `VerifyResult` 类型、`verifyKeyFile`、私有 `verifyReasonFor`；顶部新增 `import { normalizeOrigin } from '../seo-files/url';`）
- Test: `tests/indexnow-submit.test.ts`（顶部 import 加 `verifyKeyFile`；文件末尾追加一个 `describe`）

**Interfaces:**
- Consumes: `normalizeOrigin(input: string): string`（来自 `lib/seo-files/url.ts`，输入 `example.com` → `https://example.com`；输入无效/空时抛 `Error('网址格式无效')` / `Error('请输入网址')`）
- Produces:
  ```ts
  export interface VerifyResult { ok: boolean; status: number; reason?: string }
  export async function verifyKeyFile(key: string, host: string): Promise<VerifyResult>
  ```
  行为：GET `https://<host>/<key>.txt`；200 且 `body.trim() === key` → `{ok:true,status:200}`；200 内容不符 → `{ok:false,status:200,reason:'密钥文件内容与密钥不匹配'}`；404 → `{ok:false,status:404,reason:'站点根目录未找到 <key>.txt，请先上传密钥文件'}`；其他 status → `{ok:false,status,reason:'<host> 返回 HTTP <status>'}`；fetch 抛错或 host 无效 → `{ok:false,status:0,reason:'无法访问 <host>：网络错误或域名无效'}`。**永不抛错。**

- [ ] **Step 1: 写失败测试**

在 `tests/indexnow-submit.test.ts` 顶部把 import 改为：

```ts
import { submitUrls, reasonFor, groupByHost, verifyKeyFile } from '../lib/indexnow/submit';
```

在文件末尾追加：

```ts
describe('verifyKeyFile', () => {
  it('GET <origin>/<key>.txt，200 + 内容匹配 → ok:true', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('abc123def456abc123def456'),
    } as unknown as Response);
    const r = await verifyKeyFile('abc123def456abc123def456', 'example.com');
    expect(r).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/abc123def456abc123def456.txt');
  });

  it('内容前后空白 trim 后匹配 → ok:true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('\n  abc123def456abc123def456 \n'),
    } as unknown as Response);
    expect((await verifyKeyFile('abc123def456abc123def456', 'example.com')).ok).toBe(true);
  });

  it('200 但内容不符 → ok:false + 不匹配原因', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('wrong-content'),
    } as unknown as Response);
    const r = await verifyKeyFile('abc123def456abc123def456', 'example.com');
    expect(r).toEqual({ ok: false, status: 200, reason: '密钥文件内容与密钥不匹配' });
  });

  it('404 → ok:false + 未找到原因（含 <key>.txt）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 404 } as Response);
    const r = await verifyKeyFile('abc123def456abc123def456', 'example.com');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.reason).toMatch(/未找到/);
    expect(r.reason).toContain('abc123def456abc123def456.txt');
  });

  it('其他状态（500）→ ok:false + 兜底文案', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 500 } as Response);
    const r = await verifyKeyFile('abc123def456abc123def456', 'example.com');
    expect(r).toEqual({ ok: false, status: 500, reason: 'example.com 返回 HTTP 500' });
  });

  it('fetch 抛错 → ok:false + 无法访问，且不向上抛出', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const r = await verifyKeyFile('abc123def456abc123def456', 'example.com');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(r.reason).toMatch(/无法访问/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/indexnow-submit.test.ts`
Expected: FAIL，错误信息含 `verifyKeyFile is not a function`（import 未导出）。

- [ ] **Step 3: 写最小实现**

在 `lib/indexnow/submit.ts` 顶部（第 1 行注释块之后）加 import：

```ts
import { normalizeOrigin } from '../seo-files/url';
```

在文件末尾追加：

```ts
export interface VerifyResult {
  ok: boolean;
  status: number;
  reason?: string;
}

/**
 * 验证 IndexNow 密钥文件是否正确部署到 <host> 根目录。
 * 复刻 IndexNow 协议的验证方式：GET https://<host>/<key>.txt，校验内容与密钥匹配。
 * 用于「测试连接」——在不产生真实提交的前提下定位 403 根因。
 * fetch 抛错（DNS/网络）或 host 无效时归为"无法访问"，不向上抛出。
 */
export async function verifyKeyFile(key: string, host: string): Promise<VerifyResult> {
  try {
    const origin = normalizeOrigin(host);
    const res = await fetch(`${origin}/${key}.txt`);
    if (res.status !== 200) {
      return { ok: false, status: res.status, reason: verifyReasonFor(res.status, host, key) };
    }
    const body = (await res.text()).trim();
    if (body !== key) return { ok: false, status: 200, reason: '密钥文件内容与密钥不匹配' };
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 0, reason: `无法访问 ${host}：网络错误或域名无效` };
  }
}

function verifyReasonFor(status: number, host: string, key: string): string {
  if (status === 404) return `站点根目录未找到 ${key}.txt，请先上传密钥文件`;
  return `${host} 返回 HTTP ${status}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/indexnow-submit.test.ts`
Expected: PASS（全部用例，含原有 submitUrls/reasonFor/groupByHost）。

- [ ] **Step 5: 提交**

```bash
git add lib/indexnow/submit.ts tests/indexnow-submit.test.ts
git commit -m "feat(indexnow): 新增 verifyKeyFile 验证密钥文件部署"
```

---

## Task 2: `useIndexNowKey.testConnection` —— hook 层

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useIndexNowKey.ts`
- Test: `tests/useIndexNowKey.test.tsx`（末尾追加一个 `describe`）

**Interfaces:**
- Consumes: `verifyKeyFile(key, host)` from Task 1。
- Produces: hook 返回值新增三个字段：
  ```ts
  export type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';
  // 返回值新增：
  testConnection: (host: string) => Promise<void>;
  testStatus: TestStatus;       // 初始 'idle'
  testMessage: string | undefined;  // 初始 undefined
  ```
  `testConnection(host)` 行为：无 key 时直接 return；否则 `testStatus='testing'` → 调 `verifyKeyFile` → ok 时 `testStatus='ok'` + `testMessage='密钥文件已正确部署到 <host>，可正常提交'`；否则 `testStatus='fail'` + `testMessage=r.reason`。

- [ ] **Step 1: 写失败测试**

在 `tests/useIndexNowKey.test.tsx` 末尾追加：

```ts
describe('useIndexNowKey - testConnection', () => {
  it('预置 key 后 testConnection 成功 → testStatus:ok + 成功消息含 host', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('preconfigured-key-1234567890'),
    } as unknown as Response);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.testStatus).toBe('idle');
    await act(async () => { await result.current.testConnection('example.com'); });
    expect(result.current.testStatus).toBe('ok');
    expect(result.current.testMessage).toMatch(/已正确部署/);
    expect(result.current.testMessage).toContain('example.com');
    vi.restoreAllMocks();
  });

  it('testConnection 失败（404）→ testStatus:fail + 原因', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 404 } as Response);
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await result.current.testConnection('example.com'); });
    expect(result.current.testStatus).toBe('fail');
    expect(result.current.testMessage).toMatch(/未找到/);
    vi.restoreAllMocks();
  });

  it('testing 期间 testStatus 为 testing', async () => {
    const { updateSettings } = await import('../lib/storage/settings');
    await updateSettings({ indexnowKey: 'preconfigured-key-1234567890' });
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useIndexNowKey());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => {
      result.current.testConnection('example.com'); // 不 await，让 fetch 挂起
      await Promise.resolve();
    });
    expect(result.current.testStatus).toBe('testing');
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/useIndexNowKey.test.tsx`
Expected: FAIL，`result.current.testConnection is not a function`。

- [ ] **Step 3: 写最小实现**

把 `entrypoints/sidepanel/hooks/useIndexNowKey.ts` 改为（在现有 import 下加 verifyKeyFile，新增 TestStatus/testStatus/testMessage/testConnection）：

```ts
import { useCallback, useEffect, useState } from 'react';
import { getSettings, updateSettings, generateIndexNowKey } from '@lib/storage/settings';
import { verifyKeyFile } from '@lib/indexnow/submit';

const SETTINGS_KEY = 'settings';

export type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

/**
 * IndexNow 全局密钥状态：读 settings.indexnowKey，跨视图同步（storage.onChanged）。
 * - generate：生成随机 key 并落库（onChanged 回写 state）。
 * - refresh：confirm 通过后 generate（覆盖旧 key → 各站需重新上传 <key>.txt）。
 * - download：用 Blob 触发浏览器下载 <key>.txt（内容=key），供用户上传到站点根目录。
 * - testConnection(host)：GET <host>/<key>.txt 验证密钥文件部署，结果写入 testStatus/testMessage。
 */
export function useIndexNowKey() {
  const [key, setKey] = useState<string | undefined>(undefined);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);

  // 初次读
  useEffect(() => {
    let active = true;
    getSettings().then((s) => { if (active) setKey(s.indexnowKey); });
    return () => { active = false; };
  }, []);

  // 跨视图同步
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const next = (changes[SETTINGS_KEY].newValue as { indexnowKey?: string } | undefined)?.indexnowKey;
      setKey(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const generate = useCallback(() => {
    void updateSettings({ indexnowKey: generateIndexNowKey() });  // onChanged 回写
  }, []);

  const refresh = useCallback(() => {
    if (!window.confirm('刷新会覆盖当前密钥，旧密钥文件立即作废，所有站点需重新上传。确认？')) return;
    generate();
  }, [generate]);

  const download = useCallback(() => {
    if (!key) return;
    const blob = new Blob([key], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [key]);

  const testConnection = useCallback(async (host: string) => {
    if (!key) return;
    setTestStatus('testing');
    setTestMessage(undefined);
    const r = await verifyKeyFile(key, host);
    if (r.ok) {
      setTestStatus('ok');
      setTestMessage(`密钥文件已正确部署到 ${host}，可正常提交`);
    } else {
      setTestStatus('fail');
      setTestMessage(r.reason);
    }
  }, [key]);

  return { key, generate, refresh, download, testConnection, testStatus, testMessage };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/useIndexNowKey.test.tsx`
Expected: PASS（含原有 generate/refresh/download 用例）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/hooks/useIndexNowKey.ts tests/useIndexNowKey.test.tsx
git commit -m "feat(indexnow): useIndexNowKey 增加 testConnection"
```

---

## Task 3: `IndexNowKeySection` —— 测试按钮 + 消息区 + domain prop

**Files:**
- Modify: `entrypoints/sidepanel/components/IndexNowKeySection.tsx`
- Test: `tests/indexnow-key-section.test.tsx`（更新 mock + 现有 render 调用，追加测试）

**Interfaces:**
- Consumes: hook 返回的 `testConnection/testStatus/testMessage`（Task 2）；`isValidDomain(d: string): boolean`（来自 `@lib/storage/projects`）。
- Produces: `export default function IndexNowKeySection({ domain }: { domain: string })`。`domain` 为必填 prop，由 `CredentialsSection` 透传。

- [ ] **Step 1: 更新 mock 并写失败测试**

把 `tests/indexnow-key-section.test.tsx` 整体替换为：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let mockKey: string | undefined = undefined;
let mockTestStatus: 'idle' | 'testing' | 'ok' | 'fail' = 'idle';
let mockTestMessage: string | undefined = undefined;
const mockGenerate = vi.fn();
const mockRefresh = vi.fn();
const mockDownload = vi.fn();
const mockTestConnection = vi.fn();
vi.mock('../entrypoints/sidepanel/hooks/useIndexNowKey', () => ({
  useIndexNowKey: () => ({
    key: mockKey,
    generate: mockGenerate,
    refresh: mockRefresh,
    download: mockDownload,
    testConnection: mockTestConnection,
    testStatus: mockTestStatus,
    testMessage: mockTestMessage,
  }),
}));

import IndexNowKeySection from '../entrypoints/sidepanel/components/IndexNowKeySection';

beforeEach(() => {
  mockKey = undefined;
  mockTestStatus = 'idle';
  mockTestMessage = undefined;
  mockGenerate.mockReset();
  mockRefresh.mockReset();
  mockDownload.mockReset();
  mockTestConnection.mockReset();
});

describe('IndexNowKeySection', () => {
  it('未配置：显示「生成密钥」，不显示下载/刷新/测试连接', () => {
    render(<IndexNowKeySection domain="example.com" />);
    expect(screen.getByText('生成密钥')).toBeInTheDocument();
    expect(screen.queryByText('下载密钥文件')).not.toBeInTheDocument();
    expect(screen.queryByText('刷新')).not.toBeInTheDocument();
    expect(screen.queryByText('测试连接')).not.toBeInTheDocument();
  });

  it('未配置：点「生成密钥」调 generate', () => {
    render(<IndexNowKeySection domain="example.com" />);
    fireEvent.click(screen.getByText('生成密钥'));
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('已配置：readonly 输入框显示 key，显示下载/刷新/测试连接，不显示生成', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    render(<IndexNowKeySection domain="example.com" />);
    expect((screen.getByLabelText('IndexNow 密钥') as HTMLInputElement).value).toBe(mockKey);
    expect((screen.getByLabelText('IndexNow 密钥') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByText('下载密钥文件')).toBeInTheDocument();
    expect(screen.getByText('刷新')).toBeInTheDocument();
    expect(screen.getByText('测试连接')).toBeInTheDocument();
    expect(screen.queryByText('生成密钥')).not.toBeInTheDocument();
  });

  it('已配置：点下载调 download、点刷新调 refresh', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    render(<IndexNowKeySection domain="example.com" />);
    fireEvent.click(screen.getByText('下载密钥文件'));
    expect(mockDownload).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('刷新'));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('提示上传到每个站点根目录', () => {
    render(<IndexNowKeySection domain="example.com" />);
    expect(screen.getByText(/上传到你【每个】站点的根目录/)).toBeInTheDocument();
  });

  it('已配置时文案含 <key>.txt 文件名', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    render(<IndexNowKeySection domain="example.com" />);
    expect(screen.getByText(/abc123def456abc123def456abc123de\.txt/)).toBeInTheDocument();
  });
});

describe('IndexNowKeySection - 测试连接', () => {
  it('已配置 + 有效 domain：点「测试连接」调 testConnection(domain)', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    render(<IndexNowKeySection domain="example.com" />);
    fireEvent.click(screen.getByText('测试连接'));
    expect(mockTestConnection).toHaveBeenCalledOnce();
    expect(mockTestConnection).toHaveBeenCalledWith('example.com');
  });

  it('testing 时按钮文案为「测试中…」且禁用', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    mockTestStatus = 'testing';
    render(<IndexNowKeySection domain="example.com" />);
    const btn = screen.getByText('测试中…') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('domain 无效：按钮禁用 + 出现「请先在上方选择有效站点」', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    render(<IndexNowKeySection domain="" />);
    const btn = screen.getByText('测试连接') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText('请先在上方选择有效站点')).toBeInTheDocument();
  });

  it('testMessage 存在时渲染消息文案', () => {
    mockKey = 'abc123def456abc123def456abc123de';
    mockTestStatus = 'ok';
    mockTestMessage = '密钥文件已正确部署到 example.com，可正常提交';
    render(<IndexNowKeySection domain="example.com" />);
    expect(screen.getByText('密钥文件已正确部署到 example.com，可正常提交')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/indexnow-key-section.test.tsx`
Expected: FAIL（组件未接收 domain、未渲染测试按钮/消息）。

- [ ] **Step 3: 写最小实现**

把 `entrypoints/sidepanel/components/IndexNowKeySection.tsx` 整体替换为：

```tsx
import Button from './Button';
import TextInput from './TextInput';
import { useIndexNowKey } from '../hooks/useIndexNowKey';
import { isValidDomain } from '@lib/storage/projects';

/**
 * IndexNow 密钥配置表单（嵌入 CredentialsSection 的 Tab 内）。
 * 未配置：显示「生成密钥」。
 * 已配置：readonly 输入框展示 key + 「下载密钥文件」「刷新」「测试连接」。
 * 测试连接：GET <domain>/<key>.txt 验证密钥文件是否正确部署到当前选中站点根目录。
 * 文案提示用户把 <key>.txt 上传到每个站点根目录。
 */
export default function IndexNowKeySection({ domain }: { domain: string }) {
  const { key, generate, refresh, download, testConnection, testStatus, testMessage } = useIndexNowKey();
  const fileName = key ? `${key}.txt` : '<key>.txt';
  const urlExample = 'https://<你的域名>/<key>.txt';
  const domainOk = isValidDomain(domain);
  const testColor = testStatus === 'ok' ? 'var(--color-success)'
    : testStatus === 'fail' ? 'var(--color-error)'
    : 'var(--color-muted)';

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>密钥将提交到 Bing / Yandex 等搜索引擎</div>
      <TextInput
        value={key ?? ''}
        readOnly
        placeholder="未生成"
        aria-label="IndexNow 密钥"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {!key && <Button onClick={generate}>生成密钥</Button>}
        {key && <Button onClick={download}>下载密钥文件</Button>}
        {key && <Button variant="secondary" onClick={refresh}>刷新</Button>}
        {key && (
          <Button
            variant="secondary"
            onClick={() => testConnection(domain)}
            disabled={!domainOk || testStatus === 'testing'}
          >
            {testStatus === 'testing' ? '测试中…' : '测试连接'}
          </Button>
        )}
      </div>
      {key && !domainOk && (
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>请先在上方选择有效站点</div>
      )}
      {testMessage && <div style={{ fontSize: 11, color: testColor, marginTop: 8 }}>{testMessage}</div>}
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>
        请将 <span style={{ fontFamily: 'var(--font-mono)' }}>{fileName}</span> 上传到你【每个】站点的根目录：
        <span style={{ fontFamily: 'var(--font-mono)' }}>{urlExample}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/indexnow-key-section.test.tsx`
Expected: PASS（全部用例）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/IndexNowKeySection.tsx tests/indexnow-key-section.test.tsx
git commit -m "feat(indexnow): IndexNowKeySection 增加测试连接按钮与消息区"
```

---

## Task 4: `CredentialsSection` —— 透传 domain

**Files:**
- Modify: `entrypoints/sidepanel/components/CredentialsSection.tsx`（函数签名加 `domain` prop；tabpanel 里 `<IndexNowKeySection domain={domain} />`）
- Test: `tests/credentials-section.test.tsx`（改 IndexNowKeySection 的 mock 以捕获 props；现有 render 加 domain；追加透传断言）

**Interfaces:**
- Consumes: `IndexNowKeySection({ domain })` from Task 3。
- Produces: `export default function CredentialsSection({ domain }: { domain: string })`。`domain` 必填，由 `SubmitPanel` 传入。

- [ ] **Step 1: 更新 mock 并写失败测试**

把 `tests/credentials-section.test.tsx` 顶部 mock 与 import 区改为：

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let lastIndexNowProps: { domain?: string } = {};
vi.mock('../entrypoints/sidepanel/components/IndexNowKeySection', () => ({
  default: (props: { domain?: string }) => {
    lastIndexNowProps = props;
    return <div data-testid="indexnow-form">IndexNow 表单</div>;
  },
}));
vi.mock('../entrypoints/sidepanel/components/GscCredentialsSection', () => ({
  default: () => <div data-testid="gsc-form">GSC 表单</div>,
}));

import CredentialsSection from '../entrypoints/sidepanel/components/CredentialsSection';

describe('CredentialsSection', () => {
  it('默认折叠：显示标题与「未配置」摘要，不渲染表单', () => {
    render(<CredentialsSection domain="example.com" />);
    expect(screen.getByText('凭证设置')).toBeInTheDocument();
    expect(screen.getByText('未配置')).toBeInTheDocument();
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('点击 header 展开，默认显示 IndexNow 表单', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.getByText('IndexNow 表单')).toBeInTheDocument();
    expect(screen.queryByText('GSC 表单')).not.toBeInTheDocument();
  });

  it('切到 GSC tab 显示 GSC 表单', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    fireEvent.click(screen.getByText('GSC'));
    expect(screen.getByText('GSC 表单')).toBeInTheDocument();
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('已配置 GSC 时摘要显示「GSC 已就绪」', async () => {
    await chrome.storage.local.set({ settings: { gscCredentials: '{"type":"service_account"}' } });
    render(<CredentialsSection domain="example.com" />);
    await waitFor(() => expect(screen.getByText('GSC 已就绪')).toBeInTheDocument());
  });

  it('两套都配置时摘要显示「GSC · IndexNow 已就绪」', async () => {
    await chrome.storage.local.set({ settings: { gscCredentials: '{}', indexnowKey: 'abcdef0123456789' } });
    render(<CredentialsSection domain="example.com" />);
    await waitFor(() => expect(screen.getByText('GSC · IndexNow 已就绪')).toBeInTheDocument());
  });

  it('再次点击 header 收起', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.getByText('IndexNow 表单')).toBeInTheDocument();
    fireEvent.click(screen.getByText('凭证设置'));
    expect(screen.queryByText('IndexNow 表单')).not.toBeInTheDocument();
  });

  it('展开后把 domain 透传给 IndexNowKeySection', () => {
    render(<CredentialsSection domain="example.com" />);
    fireEvent.click(screen.getByText('凭证设置'));
    expect(lastIndexNowProps.domain).toBe('example.com');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/credentials-section.test.tsx`
Expected: FAIL（最后一条"透传"用例：`expected undefined to be 'example.com'`；其余用例因 mock 已匹配也应通过——若因 `domain` 必填致 TS 报错，运行时仍能跑过，先看运行结果）。

- [ ] **Step 3: 写最小实现**

在 `entrypoints/sidepanel/components/CredentialsSection.tsx`：

把签名（第 25 行附近）：
```tsx
export default function CredentialsSection() {
```
改为：
```tsx
export default function CredentialsSection({ domain }: { domain: string }) {
```

把 tabpanel（第 81 行附近）：
```tsx
<div role="tabpanel">{tab === 'indexnow' ? <IndexNowKeySection /> : <GscCredentialsSection />}</div>
```
改为：
```tsx
<div role="tabpanel">{tab === 'indexnow' ? <IndexNowKeySection domain={domain} /> : <GscCredentialsSection />}</div>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/credentials-section.test.tsx`
Expected: PASS（全部 7 条）。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/components/CredentialsSection.tsx tests/credentials-section.test.tsx
git commit -m "feat(credentials): CredentialsSection 透传 domain 给 IndexNowKeySection"
```

---

## Task 5: `SubmitPanel` 接线 + Tab 边框 CSS

**Files:**
- Modify: `entrypoints/sidepanel/pages/SubmitPanel.tsx`（`<CredentialsSection />` → `<CredentialsSection domain={site.domain.trim()} />`）
- Modify: `entrypoints/sidepanel/styles/global.css`（`.tab` 的 `border` 从 `transparent` 改 `var(--color-hairline)`）

**Interfaces:**
- Consumes: `CredentialsSection({ domain })` from Task 4。
- Produces: 无新接口；端到端打通 host 透传链路 + 全局 Tab 视觉修复。

> 本任务无新单测（CSS 无单测；SubmitPanel 改动是单行接线，由 compile + 全量 test + 手动目视兜底）。

- [ ] **Step 1: SubmitPanel 接线**

在 `entrypoints/sidepanel/pages/SubmitPanel.tsx` 第 78 行：
```tsx
<CredentialsSection />
```
改为：
```tsx
<CredentialsSection domain={site.domain.trim()} />
```

- [ ] **Step 2: Tab 非激活态加浅边框**

在 `entrypoints/sidepanel/styles/global.css` 的 `.tab` 规则（约 63-74 行），把：
```css
  border: 1px solid transparent;
```
改为：
```css
  border: 1px solid var(--color-hairline);
```

（`.tab:hover` 与 `.tab.is-active` 保持不变。）

- [ ] **Step 3: 类型检查 + 全量测试**

Run: `npm run compile && npm test`
Expected:
- `tsc --noEmit` 无错（含所有新增/改动的 prop 类型）。
- vitest 全量 PASS。

- [ ] **Step 4: 手动目视验证（CSS）**

加载扩展到 Chrome（`npm run build` 后 `wxt` 加载 `.output/chrome-mv3`），打开 sidepanel 进入提交面板：
- 展开「凭证设置」：非激活 Tab 有浅边框轮廓，激活 Tab 外观不变。
- 切换顶部双 Tab：同样获得浅边框。
- IndexNow 已生成密钥且选中有效站点：点「测试连接」能触发请求并显示绿色/红色结果；未选有效站点时按钮禁用并提示。
- GSC Tab 行为不变。

- [ ] **Step 5: 提交**

```bash
git add entrypoints/sidepanel/pages/SubmitPanel.tsx entrypoints/sidepanel/styles/global.css
git commit -m "feat(submit-panel): 接通 IndexNow 测试连接域名 + 凭证 Tab 浅边框"
```

---

## 完成标准

- `npm run compile && npm test` 全绿。
- 五个提交（每 Task 一个），信息均为中文 + scope。
- 展开凭证设置后非激活 Tab 有清晰浅边框；激活 Tab 不变。
- IndexNow 测试连接四类结果（成功 / 内容不符 / 404 / 网络错）文案正确；未选站点时禁用并提示。
- GSC Tab 与顶部双 Tab 行为/外观不被破坏。
