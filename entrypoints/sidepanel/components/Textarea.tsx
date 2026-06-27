export default function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', padding: '10px 14px', resize: 'vertical',
        background: 'var(--color-canvas)', color: 'var(--color-ink)',
        border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)',
        fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-mono)', ...props.style,
      }}
    />
  );
}
