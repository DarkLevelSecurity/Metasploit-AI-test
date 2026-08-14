type Props = {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  empty?: string;
};

export function DataTable({ columns, rows, onRowClick, empty = 'No rows' }: Props) {
  if (!rows.length) {
    return <div className="muted">{empty}</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className="mono">
                  {formatCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
