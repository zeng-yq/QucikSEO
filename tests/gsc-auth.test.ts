import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseServiceAccount, base64url, getAccessToken } from '../lib/gsc/auth';
import * as settings from '../lib/storage/settings';

beforeEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const VALID_SA = JSON.stringify({
  type: 'service_account',
  client_email: 'sa@proj-42.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEwggE9AgE\n-----END PRIVATE KEY-----\n',
  token_uri: 'https://oauth2.googleapis.com/token',
});

describe('base64url', () => {
  it('字符串输入 → 去填充', () => {
    expect(base64url('hello')).toBe('aGVsbG8'); // btoa('hello')='aGVsbG8='
  });
  it('字节输入 → 与字符串等价', () => {
    expect(base64url(new Uint8Array([104, 101, 108, 108, 111]))).toBe('aGVsbG8');
  });
  it('URL 安全：+ → -、/ → _', () => {
    // 字节序列使 btoa 产生 + 和 / 与 =
    expect(base64url(new Uint8Array([255, 255, 255, 254]))).not.toMatch(/[+/=]/);
  });
});

describe('parseServiceAccount', () => {
  it('合法 JSON → 正确字段', () => {
    const r = parseServiceAccount(VALID_SA);
    expect(r.clientEmail).toBe('sa@proj-42.iam.gserviceaccount.com');
    expect(r.privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(r.tokenUri).toBe('https://oauth2.googleapis.com/token');
  });
  it('非法 JSON → 抛错', () => {
    expect(() => parseServiceAccount('{not json')).toThrow(/JSON/i);
  });
  it('type 非 service_account → 抛错', () => {
    expect(() => parseServiceAccount(JSON.stringify({ type: 'authorized_user' }))).toThrow(/service_account/);
  });
  it('缺 client_email → 抛错', () => {
    const o = JSON.parse(VALID_SA); delete o.client_email;
    expect(() => parseServiceAccount(JSON.stringify(o))).toThrow(/client_email/);
  });
  it('缺 private_key → 抛错', () => {
    const o = JSON.parse(VALID_SA); delete o.private_key;
    expect(() => parseServiceAccount(JSON.stringify(o))).toThrow(/private_key/);
  });
  it('缺 token_uri → 用默认', () => {
    const o = JSON.parse(VALID_SA); delete o.token_uri;
    expect(parseServiceAccount(JSON.stringify(o)).tokenUri).toBe('https://oauth2.googleapis.com/token');
  });
});

describe('getAccessToken', () => {
  const CREDS = parseServiceAccount(VALID_SA);

  it('缓存未过期 → 直接返回，不 fetch', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({
      gscToken: { accessToken: 'cached-token', expiresAt: Date.now() + 600_000 },
    } as any);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    expect(await getAccessToken(CREDS)).toBe('cached-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('缓存过期 → 签 JWT 换新 + 写缓存', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({
      gscToken: { accessToken: 'old', expiresAt: Date.now() - 1000 },
    } as any);
    const updateSpy = vi.spyOn(settings, 'updateSettings').mockResolvedValue();
    vi.stubGlobal('crypto', {
      subtle: {
        importKey: vi.fn().mockResolvedValue('key-handle'),
        sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      },
    } as any);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
    } as any);
    expect(await getAccessToken(CREDS)).toBe('new-token');
    expect(fetchMock).toHaveBeenCalledOnce();
    // 断言 assertion 三段式 + grant_type 正确
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    expect(body).toContain('assertion=');
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      gscToken: expect.objectContaining({ accessToken: 'new-token' }),
    }));
  });

  it('无缓存 → 签 JWT 换新', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({} as any);
    vi.spyOn(settings, 'updateSettings').mockResolvedValue();
    vi.stubGlobal('crypto', {
      subtle: { importKey: vi.fn().mockResolvedValue('k'), sign: vi.fn().mockResolvedValue(new Uint8Array([1]).buffer) },
    } as any);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ access_token: 'fresh', expires_in: 3600 }),
    } as any);
    expect(await getAccessToken(CREDS)).toBe('fresh');
  });

  it('换 token HTTP 非 200 → 抛错', async () => {
    vi.spyOn(settings, 'getSettings').mockResolvedValue({} as any);
    vi.stubGlobal('crypto', {
      subtle: { importKey: vi.fn().mockResolvedValue('k'), sign: vi.fn().mockResolvedValue(new Uint8Array([1]).buffer) },
    } as any);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' } as any);
    await expect(getAccessToken(CREDS)).rejects.toThrow(/换.*令牌.*失败|HTTP 400/);
  });
});
