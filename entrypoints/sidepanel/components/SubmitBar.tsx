import Button from './Button';
import PlatformChip from './PlatformChip';
import { GscMark, BingMark } from './icons';

export interface SubmitBarProps {
  gsc: boolean;
  bing: boolean;
  onToggleGsc: () => void;
  onToggleBing: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  ready: boolean;
}

export default function SubmitBar({ gsc, bing, onToggleGsc, onToggleBing, onSubmit, onCancel, busy, ready }: SubmitBarProps) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', marginTop: 'var(--space-sm)',
    }}>
      <PlatformChip label="GSC" icon={<GscMark />} checked={gsc} onToggle={onToggleGsc} />
      <PlatformChip label="Bing" icon={<BingMark />} checked={bing} onToggle={onToggleBing} />
      <Button onClick={onSubmit} disabled={!ready} style={{ flex: 1 }}>
        {busy ? '提交中…' : '一次提交 10 个'}
      </Button>
      {busy && <Button variant="secondary" onClick={onCancel}>取消</Button>}
    </div>
  );
}
