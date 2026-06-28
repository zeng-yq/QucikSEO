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
  const doneRef = useRef<(() => void) | null>(null);
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
      } else if (e.type === 'GSC_LOG') {
        setLogs((prev) => [...prev, { level: e.level, phase: e.phase, message: e.message, ts: Date.now() }]);
      } else if (e.type === 'GSC_DONE') {
        setState(IDLE);
        doneRef.current?.();
        doneRef.current = null;
      }
    });
    return () => port.disconnect();
  }, []);

  /**
   * 启动一次批量「请求编入索引」。
   * 返回一个在 background 推送 GSC_DONE 时 resolve 的 Promise（Task 8 orchestrator 串行 await 依赖此行为）。
   */
  const start = useCallback((domain: string, urls: string[]): Promise<void> => {
    setLogs([]);
    setResults([]);
    setState({ running: true, total: urls.length, done: 0 });
    portRef.current?.postMessage({ type: 'GSC_START', domain, urls });
    return new Promise<void>((resolve) => { doneRef.current = resolve; });
  }, []);

  const cancel = useCallback(() => {
    portRef.current?.postMessage({ type: 'GSC_CANCEL' });
  }, []);

  return { state, results, logs, start, cancel };
}
