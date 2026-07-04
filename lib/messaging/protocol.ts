/**
 * GSC runner 的 port 协议常量与连接辅助。
 *
 * side panel 通过 `createGscPort()` 拿到一条命名 port，发送 `GscRequest`，
 * 并监听 background 推送的 `GscEvent`。
 */

/** background 与 side panel 之间约定的 port 名。 */
export const GSC_PORT_NAME = 'gsc-runner';

/**
 * 建立到 background 的 GSC runner port。
 * 调用方负责 `port.onMessage.addListener` 接收 `GscEvent`、`port.postMessage` 发送 `GscRequest`。
 */
export function createGscPort(): chrome.runtime.Port {
  return chrome.runtime.connect({ name: GSC_PORT_NAME });
}

/** background 与 side panel 之间约定的 Bing runner port 名。 */
export const BING_PORT_NAME = 'bing-runner';

/**
 * 建立到 background 的 Bing runner port。
 * 调用方负责 `port.onMessage.addListener` 接收 `BingEvent`、`port.postMessage` 发送 `BingRequest`。
 */
export function createBingPort(): chrome.runtime.Port {
  return chrome.runtime.connect({ name: BING_PORT_NAME });
}

import type { SitemapRequest, SitemapEvent } from './types';

/** background 与 side panel 之间约定的 sitemap-fetcher port 名。 */
export const SITEMAP_PORT_NAME = 'sitemap-fetcher';

/**
 * 建立到 background 的 sitemap-fetcher port。
 * 调用方负责 onMessage.addListener 接收 SitemapEvent、postMessage 发送 SitemapRequest。
 */
export function createSitemapPort(): chrome.runtime.Port {
  return chrome.runtime.connect({ name: SITEMAP_PORT_NAME });
}
