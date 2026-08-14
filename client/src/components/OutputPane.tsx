type Props = {
  title?: string;
  data: unknown;
};

export function OutputPane({ title = 'Output', data }: Props) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className="panel">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: '1rem', margin: 0 }}>{title}</h1>
      </div>
      <pre className="terminal">{text || '—'}</pre>
    </div>
  );
}
