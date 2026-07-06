import { useCallback, useEffect, useRef, useState } from 'react';
import { createGscPort } from '@lib/messaging/protocol';
import type { GscEvent, SubmitResult } from '@lib/messaging/types';

interface RunnerState {
  running: boolean;
  total: number;
  done: number;
  currentUrl?: string;
}

const IDLE: RunnerState = { running: false, total: 0, done: 0 };

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  phase: string;
  message: string;
  ts: number;
}

export function useGscRunner() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  /** start 返回的 Promise 的 resolve；GSC_DONE 到达时调用并清空。供 Task 8 orchestrator 串行 await。 */
  const doneRef = useRef<((results: SubmitResult[]) => void) | null>(null);
  /** 缓存最后一次 GSC_STATE 的 results；GSC_DONE 时用它 resolve（避免 React state 异步导致读到旧值）。 */
  const latestResults = useRef<SubmitResult[]>([]);
  const [state, setState] = useState<RunnerState>(IDLE);
  const [results, setResults] = useState<SubmitResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const port = createGscPort();
    portRef.current = port;
    port.onMessage.addListener((e: GscEvent) => {
      if (e.type === 'GSC_STATE') {
        setState({
          running: e.state === 'running',
          total: e.total,
          done: e.done,
          currentUrl: e.currentUrl,
        });
        setResults(e.results);
        latestResults.current = e.results;
      } else if (e.type === 'GSC_LOG') {
        setLogs((prev) => [...prev, { level: e.level, phase: e.phase, message: e.message, ts: Date.now() }]);
      } else if (e.type === 'GSC_DONE') {
        setState(IDLE);
        doneRef.current?.(latestResults.current);
        doneRef.current = null;
      }
    });
    // 兜底：background service worker 在长串行提交期间被终止/重启时，port 会断开、
    // GSC_DONE 永不到达。若不处理，start() 的 Promise 永久 pending → orchestrator 卡死 →
    // 按钮永久"提交中"。此处兜底 resolve 已完成的结果并恢复 IDLE，让用户看到中断信号。
    port.onDisconnect.addListener(() => {
      if (!doneRef.current) return; // 无进行中的批次（如组件卸载），忽略
      setState(IDLE);
      setLogs((prev) => [...prev, { level: 'error', phase: 'system', message: '后台连接中断（service worker 可能已重启），本次提交未完成', ts: Date.now() }]);
      doneRef.current(latestResults.current);
      doneRef.current = null;
    });
    return () => port.disconnect();
  }, []);

  /**
   * 启动一次批量「请求编入索引」。
   * 返回一个在 background 推送 GSC_DONE 时 resolve 的 Promise，resolve 值为最终 SubmitResult[]（Task 9 orchestrator 落库依赖此行为）。
   */
  const start = useCallback((domain: string, urls: string[]): Promise<SubmitResult[]> => {
    setLogs([]);
    setResults([]);
    latestResults.current = [];
    setState({ running: true, total: urls.length, done: 0 });
    portRef.current?.postMessage({ type: 'GSC_START', domain, urls });
    return new Promise<SubmitResult[]>((resolve) => { doneRef.current = resolve; });
  }, []);

  const cancel = useCallback(() => {
    portRef.current?.postMessage({ type: 'GSC_CANCEL' });
  }, []);

  return { state, results, logs, start, cancel };
}
