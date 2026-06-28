export type SeoFile = 'robots.txt' | 'sitemap.xml';

/**
 * 将用户输入规整为站点 origin（协议 + 主机[+端口]），丢弃路径/查询/锚点。
 * 无协议时按 https 补齐；仅接受 http/https。
 */
export function normalizeOrigin(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error('请输入网址');
  const withProto = /:\/\//.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error('网址格式无效');
  }
  if (!url.hostname || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error('网址格式无效');
  }
  return url.origin;
}

export function buildSeoFileUrl(input: string, file: SeoFile): string {
  return `${normalizeOrigin(input)}/${file}`;
}
