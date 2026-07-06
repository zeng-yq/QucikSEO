import { useCallback, useEffect, useState } from 'react';
import { getSettings, updateSettings } from '@lib/storage/settings';
import { parseServiceAccount, getAccessToken } from '@lib/gsc/auth';

const SETTINGS_KEY = 'settings';

export type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

/**
 * GSC 服务账号凭证状态（对应 useIndexNowKey）。
 * - credentials：读 settings.gscCredentials，storage.onChanged 跨视图同步。
 * - save：写 gscCredentials 并清旧 gscToken（换密钥即作废缓存）。
 * - clear：清空两个字段。
 * - testConnection：强制清缓存后重换 token，验证密钥格式 + private_key 有效。
 */
export function useGscCredentials() {
  const [credentials, setCredentials] = useState<string | undefined>(undefined);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getSettings().then((s) => { if (active) setCredentials(s.gscCredentials); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const next = (changes[SETTINGS_KEY].newValue as { gscCredentials?: string } | undefined)?.gscCredentials;
      setCredentials(next);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const save = useCallback((text: string) => {
    void updateSettings({ gscCredentials: text, gscToken: undefined });
    setTestStatus('idle');
    setTestMessage(undefined);
  }, []);

  const clear = useCallback(() => {
    void updateSettings({ gscCredentials: undefined, gscToken: undefined });
    setTestStatus('idle');
    setTestMessage(undefined);
  }, []);

  const testConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage(undefined);
    try {
      const creds = parseServiceAccount(credentials ?? '');
      await updateSettings({ gscToken: undefined }); // 强制重换 token，避免缓存命中掩盖问题
      await getAccessToken(creds);
      setTestStatus('ok');
      setTestMessage(`密钥有效（服务账号：${creds.clientEmail}）`);
    } catch (e) {
      setTestStatus('fail');
      setTestMessage((e as Error).message ?? String(e));
    }
  }, [credentials]);

  return { credentials, save, clear, testConnection, testStatus, testMessage };
}
