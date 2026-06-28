import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// chrome.storage.local 内存实现（兼容 callback 与 Promise 两种调用风格）
const memStore = new Map<string, unknown>();

// storage.onChanged 监听器（与 memStore 同作用域，便于 resetChromeMock 清理）
const onChangedListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = [];

const fireOnChanged = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
  for (const cb of onChangedListeners) {
    try { cb(changes as never, area); } catch { /* listener 容错 */ }
  }
};

const storageArea = {
  get(keys: string | string[] | null | object, cb?: (items: Record<string, unknown>) => void) {
    const out: Record<string, unknown> = {};
    const keyList = keys == null ? [...memStore.keys()] : Array.isArray(keys) ? keys : typeof keys === 'object' ? Object.keys(keys) : [keys];
    for (const k of keyList) if (memStore.has(k)) out[k] = memStore.get(k);
    const result = out;
    cb?.(result);
    return Promise.resolve(result);
  },
  set(items: Record<string, unknown>, cb?: () => void) {
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: memStore.get(k), newValue: v };
      memStore.set(k, v);
    }
    cb?.();
    fireOnChanged(changes, 'local');
    return Promise.resolve();
  },
  remove(keys: string | string[], cb?: () => void) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, { oldValue?: unknown; newValue: undefined }> = {};
    for (const k of keyList) { changes[k] = { oldValue: memStore.get(k), newValue: undefined }; memStore.delete(k); }
    cb?.();
    fireOnChanged(changes, 'local');
    return Promise.resolve();
  },
  clear(cb?: () => void) { memStore.clear(); cb?.(); return Promise.resolve(); },
};

// 每个测试前重置 storage 与 onChanged 监听器，避免用例间污染
function resetChromeMock() { memStore.clear(); onChangedListeners.length = 0; }

const chromeMock = {
  storage: {
    local: storageArea,
    session: storageArea,
    onChanged: {
      addListener: (cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => { onChangedListeners.push(cb); },
      removeListener: (cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => {
        const i = onChangedListeners.indexOf(cb);
        if (i >= 0) onChangedListeners.splice(i, 1);
      },
      hasListener: () => false,
    },
  },
  runtime: {
    id: 'test-extension-id',
    onMessage: { addListener: () => {}, removeListener: () => {} },
    connect: () => ({ postMessage: () => {}, onMessage: { addListener: () => {} }, onDisconnect: { addListener: () => {} }, disconnect: () => {} }),
    sendMessage: () => Promise.resolve(),
  },
  tabs: { create: () => Promise.resolve({ id: 1 }), query: () => Promise.resolve([]), remove: () => Promise.resolve() },
  debugger: { attach: () => Promise.resolve(), detach: () => Promise.resolve(), sendCommand: () => Promise.resolve({}) },
  sidePanel: { setPanelBehavior: () => Promise.resolve() },
};

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true, configurable: true });

// 每个测试前重置 storage，避免用例间污染
beforeEach(() => { resetChromeMock(); });

export { resetChromeMock };
