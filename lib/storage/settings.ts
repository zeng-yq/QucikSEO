export interface Settings {
  accountIndex: number;
  indexnowKey?: string;
  /** Google Indexing API 服务账号 JSON 整段文本（手动粘贴）。 */
  gscCredentials?: string;
  /** access_token 缓存（由 lib/gsc/auth.ts 读写）。 */
  gscToken?: { accessToken: string; expiresAt: number };
}
const KEY = 'settings';
const DEFAULT: Settings = { accountIndex: 0 };

/** IndexNow 协议密钥格式：8-128 字符，仅 a-zA-Z0-9-。 */
const INDEXNOW_KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

export function isValidIndexNowKey(k: string): boolean {
  return INDEXNOW_KEY_PATTERN.test(k);
}

/**
 * 生成符合 IndexNow 协议的随机密钥（16 字节 → 32 位 hex）。
 * hex 仅含 0-9a-f，天然满足协议「至少一个字母或数字」。
 */
export function generateIndexNowKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getSettings(): Promise<Settings> {
  const items = await chrome.storage.local.get(KEY);
  return { ...DEFAULT, ...(items[KEY] as Partial<Settings> | undefined) };
}
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await chrome.storage.local.set({ [KEY]: { ...cur, ...patch } });
}
