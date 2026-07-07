/**
 * IndexNow API 提交。
 *
 * 实现依据：docs/superpowers/specs/2026-07-06-indexnow-api-migration-design.md §2/§5。
 * 一次 POST 把整批 URL 通知给 IndexNow 网络（Bing/Yandex/Naver/Seznam/Yeep 自动共享）。
 * 替代旧版 CDP 驱动 Bing Webmaster 页面的逐条提交链路。
 */

import { normalizeOrigin } from '../seo-files/url';

const ENDPOINT = 'https://api.indexnow.org/IndexNow';

export interface IndexNowResult {
  ok: boolean;
  status: number;
  reason?: string;
}

/**
 * 按 IndexNow 协议整批提交。key 合法性由调用方负责。
 * 不传 keyLocation：协议规定引擎自动到 https://<host>/<key>.txt 找验证文件。
 * fetch 抛错时透传（调用方 catch 兜底成「网络错误」）。
 */
export async function submitUrls(key: string, host: string, urls: string[]): Promise<IndexNowResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, urlList: urls }),
  });
  // IndexNow 协议：200 已立即处理、202 已接收稍后处理，均为成功（Bing 端点常返回 202）。
  if (res.status === 200 || res.status === 202) return { ok: true, status: res.status };
  return { ok: false, status: res.status, reason: reasonFor(res.status) };
}

/** 把 IndexNow HTTP 状态码映射为可读原因（供 UI 日志展示）。 */
export function reasonFor(status: number): string {
  switch (status) {
    case 400: return '请求格式错误';
    case 403: return '密钥无效：站点根目录未找到 <key>.txt，或文件内容与密钥不匹配';
    case 422: return 'URL 不属于该域名，或域名与密钥不匹配';
    case 429: return '提交过于频繁，请稍后再试';
    default: return `IndexNow 返回 ${status}`;
  }
}

/**
 * 按 hostname 分组 URL。IndexNow 要求 body.host 与 urlList 每条 URL 的 host 完全一致，
 * 否则 422；sitemap 可能混 www/裸域名，分组后逐组提交避免整批失败。
 * 非法 URL（new URL 抛错）跳过。
 */
export function groupByHost(urls: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const u of urls) {
    let h: string;
    try { h = new URL(u).hostname; } catch { continue; }
    if (!m.has(h)) m.set(h, []);
    m.get(h)!.push(u);
  }
  return m;
}

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
