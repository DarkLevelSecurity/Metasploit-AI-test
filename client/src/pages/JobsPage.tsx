import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { DataTable } from '../components/DataTable';
import { OutputPane } from '../components/OutputPane';
import { useConnection } from '../state/ConnectionContext';

export function JobsPage() {
  const { connected } = useConnection();
  const [jobs, setJobs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ jobs: Record<string, string> }>('/api/jobs');
      setJobs(data.jobs || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const rows = Object.entries(jobs).map(([jid, name]) => ({ jid, name }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Jobs</h1>
          <p>Running framework jobs (handlers, modules, etc.).</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={!connected || loading}>
          Refresh
        </button>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <DataTable
          columns={[
            { key: 'jid', label: 'ID' },
            { key: 'name', label: 'Name' },
          ]}
          rows={rows}
          empty={loading ? 'Loading…' : 'No running jobs'}
          onRowClick={async (row) => {
            try {
              const info = await api.get<Record<string, unknown>>(`/api/jobs/${row.jid}`);
              setSelected(info);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to load job');
            }
          }}
        />
        <div className="btn-row">
          {rows.map((row) => (
            <button
              key={row.jid}
              className="danger"
              type="button"
              onClick={async () => {
                await api.del(`/api/jobs/${row.jid}`);
                await refresh();
              }}
            >
              Stop {row.jid}
            </button>
          ))}
        </div>
      </div>

      {selected && <OutputPane title="Job info" data={selected} />}
    </div>
  );
}
