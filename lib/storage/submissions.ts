export type Platform = 'gsc' | 'bing';

export interface SubmissionRecord {
  url: string;
  platform: Platform;
  status: 'ok' | 'skipped';
  reason?: string;
  ts: number;
  batchId: string;
}

const key = (domain: string) => `submissions:${domain}`;

export async function getSubmissions(domain: string): Promise<SubmissionRecord[]> {
  const items = await chrome.storage.local.get(key(domain));
  return (items[key(domain)] as SubmissionRecord[] | undefined) ?? [];
}

/**
 * 去重判定：是否存在 (url, platform) 且 status==='ok' 的记录。
 * skipped（配额/已索引/…）不计入黑名单——可重试。
 */
export async function isSubmittedOk(
  domain: string,
  url: string,
  platform: Platform,
): Promise<boolean> {
  const all = await getSubmissions(domain);
  return all.some((r) => r.url === url && r.platform === platform && r.status === 'ok');
}

/**
 * 追加提交记录（全量留作审计，不去重）。
 */
export async function appendSubmissions(domain: string, records: SubmissionRecord[]): Promise<void> {
  if (records.length === 0) return;
  const all = await getSubmissions(domain);
  all.push(...records);
  await chrome.storage.local.set({ [key(domain)]: all });
}

/**
 * 删除指定 (url, platform) 的全部提交记录（用于清理已下线链接的 stale 记录）。
 */
export async function removeSubmissions(
  domain: string,
  toRemove: { url: string; platform: Platform }[],
): Promise<void> {
  if (toRemove.length === 0) return;
  const all = await getSubmissions(domain);
  const removeSet = new Set(toRemove.map((r) => `${r.platform}|${r.url}`));
  const next = all.filter((r) => !removeSet.has(`${r.platform}|${r.url}`));
  await chrome.storage.local.set({ [key(domain)]: next });
}
