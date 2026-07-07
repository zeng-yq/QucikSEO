import { useEffect, useRef, useState } from 'react';
import type { UnifiedLogEntry, LogPlatform } from '@lib/submit/logs';

/** 级别圆点颜色（信息灰 / 警告黄 / 错误红）。 */
const LEVEL_DOT: Record<UnifiedLogEntry['level'], string> = {
  info: 'var(--color-muted-soft)',
  warn: 'var(--color-warning)',
  error: 'var(--color-error)',
};

/** 消息文字色：info/warn 用正常正文色（靠圆点区分），error 着红。 */
const MESSAGE_COLOR: Record<UnifiedLogEntry['level'], string> = {
  info: 'var(--color-body)',
  warn: 'var(--color-body)',
  error: 'var(--color-error)',
};

const PLATFORM_COLOR: Record<LogPlatform, string> = {
  sys: 'var(--color-muted)',
  gsc: 'var(--color-primary)',
  bing: 'var(--color-success)',
};

const PLATFORM_LABEL: Record<LogPlatform, string> = { sys: 'SYS', gsc: 'GSC', bing: 'BING' };

const LEVELS = ['all', 'info', 'warn', 'error'] as const;
type Filter = (typeof LEVELS)[number];
const LABEL: Record<Filter, string> = { all: '全部', info: 'info', warn: 'warn', error: 'error' };

function tsLabel(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function UnifiedLogPanel({ logs }: { logs: UnifiedLogEntry[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length]);

  const visible = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  return (
    <div style={{
      background: 'var(--color-surface-card)', border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-xs)',
      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-body)',
    }}>
      <div role="group" aria-label="日志级别筛选" style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {LEVELS.map((lv) => (
          <button key={lv} aria-pressed={filter === lv} onClick={() => { setFilter(lv); setExpanded({}); }} style={{
            padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-hairline)',
            background: filter === lv ? 'var(--color-primary)' : 'transparent',
            color: filter === lv ? 'var(--color-on-primary)' : 'var(--color-muted)',
            cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
          }}>{LABEL[lv]}</button>
        ))}
      </div>
      <div style={{ maxHeight: 260, overflow: 'auto' }}>
        {visible.length === 0 && <div style={{ color: 'var(--color-muted)' }}>暂无日志</div>}
        {visible.map((l, i) => {
          const detail = l.level === 'warn' || l.level === 'error';
          const open = !!expanded[i];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.6, cursor: detail ? 'pointer' : 'default' }}
              onClick={() => detail && setExpanded((p) => ({ ...p, [i]: !p[i] }))}>
              <span aria-hidden style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: LEVEL_DOT[l.level], flexShrink: 0, marginTop: 6,
              }} />
              <span style={{ color: 'var(--color-muted-soft)', flexShrink: 0 }}>[{tsLabel(l.ts)}]</span>
              <span style={{ color: PLATFORM_COLOR[l.platform], flexShrink: 0 }}>[{PLATFORM_LABEL[l.platform]}]</span>
              <span style={{
                color: MESSAGE_COLOR[l.level],
                ...(detail && !open ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
              }}>
                {l.message}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
