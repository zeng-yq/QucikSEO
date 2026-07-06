/**
 * Google Indexing API 服务账号认证。
 *
 * OAuth2 server-to-server：用服务账号 JSON 的 private_key 签 JWT 换 access_token。
 * access_token 带过期缓存（settings.gscToken），避免每次提交都换 token。
 * Web Crypto 实现 RS256 签名，零依赖（MV3 service worker 支持 crypto.subtle）。
 *
 * 依据：docs/superpowers/specs/2026-07-06-gsc-indexing-api-migration-design.md §5.1
 */

import { getSettings, updateSettings, type Settings } from '../storage/settings';

const SCOPE = 'https://www.googleapis.com/auth/indexing';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
/** 提前过期边界：避免提交途中恰好失效。 */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

export interface ServiceAccount {
  clientEmail: string;
  privateKeyPem: string;
  tokenUri: string;
}

/** 解析服务账号 JSON 文本。失败抛错（供 UI 保存/测试连接反馈）。 */
export function parseServiceAccount(jsonText: string): ServiceAccount {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    throw new Error('不是合法的 JSON');
  }
  if (obj.type !== 'service_account') {
    throw new Error('JSON 不是服务账号（type !== "service_account"）');
  }
  const clientEmail = typeof obj.client_email === 'string' ? obj.client_email : undefined;
  const privateKeyPem = typeof obj.private_key === 'string' ? obj.private_key : undefined;
  const tokenUri = typeof obj.token_uri === 'string' ? obj.token_uri : DEFAULT_TOKEN_URI;
  if (!clientEmail) throw new Error('缺少 client_email');
  if (!privateKeyPem) throw new Error('缺少 private_key');
  return { clientEmail, privateKeyPem, tokenUri };
}

/** base64url 编码（无填充）。SW 无 Buffer，手写。 */
export function base64url(input: Uint8Array | string): string {
  const bin = typeof input === 'string' ? input : bytesToBinaryString(input);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** PEM(PKCS#8) → DER 的 ArrayBuffer。剥离头尾与换行后 atob 解码。 */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function signRsaSha256(privateKeyPem: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data).buffer as ArrayBuffer);
  return base64url(new Uint8Array(sig));
}

async function buildAssertion(creds: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: creds.tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const signInput = `${header}.${payload}`;
  const signature = await signRsaSha256(creds.privateKeyPem, signInput);
  return `${signInput}.${signature}`;
}

async function fetchAccessToken(creds: ServiceAccount): Promise<{ accessToken: string; expiresIn: number }> {
  const assertion = await buildAssertion(creds);
  const res = await fetch(creds.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`换取访问令牌失败（HTTP ${res.status}）：${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** access_token 缓存条目。Task 3 将把此类型正式加入 Settings。 */
interface GscTokenCache {
  accessToken: string;
  expiresAt: number;
}

/** 取 access_token：命中缓存则返回，否则签 JWT 换新并写缓存。 */
export async function getAccessToken(creds: ServiceAccount): Promise<string> {
  // TODO(Task 3): 移除断言——Settings 将正式声明 gscToken?: GscTokenCache
  const { gscToken } = await getSettings() as Settings & { gscToken?: GscTokenCache };
  if (gscToken && gscToken.expiresAt > Date.now() + TOKEN_SAFETY_MARGIN_MS) {
    return gscToken.accessToken;
  }
  const { accessToken, expiresIn } = await fetchAccessToken(creds);
  await updateSettings({
    gscToken: { accessToken, expiresAt: Date.now() + expiresIn * 1000 },
  } as Partial<Parameters<typeof updateSettings>[0]>);
  return accessToken;
}
