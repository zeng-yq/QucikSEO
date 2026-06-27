interface CardProps {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}
export default function Card({ title, subtitle, onClick, children }: CardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--color-surface-card)', color: 'var(--color-ink)',
        border: 'none', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500 }}>{title}</div>
      {subtitle && <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
      {children}
    </button>
  );
}
