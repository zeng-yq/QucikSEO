interface ToolPanelProps {
  logo: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** 工具卡片壳：统一 logo + 标题 header，下方放各工具特有的表单控件。 */
export default function ToolPanel({ logo, title, subtitle, children }: ToolPanelProps) {
  return (
    <section
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-canvas)',
        padding: 'var(--space-sm) var(--space-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-sm)' }}>
        <span style={{ display: 'inline-flex', lineHeight: 0 }}>{logo}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
