type OptionMeta = {
  type?: string;
  required?: boolean;
  desc?: string;
  default?: unknown;
  enums?: string[];
};

type Props = {
  options: Record<string, OptionMeta>;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
};

export function OptionForm({ options, values, onChange }: Props) {
  const entries = Object.entries(options || {}).sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    return <div className="muted">No options for this module.</div>;
  }

  return (
    <div className="form-grid">
      {entries.map(([name, meta]) => (
        <label key={name}>
          <span>
            {name}
            {meta.required ? ' *' : ''}
            <span className="chip" style={{ marginLeft: 6 }}>
              {meta.type || 'string'}
            </span>
          </span>
          {meta.enums?.length ? (
            <select value={values[name] ?? ''} onChange={(e) => onChange(name, e.target.value)}>
              <option value="">(default)</option>
              {meta.enums.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={values[name] ?? ''}
              placeholder={meta.default != null ? String(meta.default) : ''}
              onChange={(e) => onChange(name, e.target.value)}
            />
          )}
          {meta.desc && <span className="muted" style={{ fontSize: '0.78rem' }}>{meta.desc}</span>}
        </label>
      ))}
    </div>
  );
}
