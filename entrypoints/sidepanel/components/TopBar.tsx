export default function TopBar({ onHome }: { onHome?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: 'var(--space-md) var(--space-lg)',
      borderBottom: '1px solid var(--color-hairline-soft)',
    }}>
      <button onClick={onHome} style={{
        background: 'none', border: 'none', padding: 0,
        fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--color-ink)', cursor: 'pointer',
      }}>
        <span aria-hidden style={{ color: 'var(--color-ink)' }}>✲</span> AutoSEO
      </button>
    </div>
  );
}
