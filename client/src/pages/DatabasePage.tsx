import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { DataTable } from '../components/DataTable';
import { useConnection } from '../state/ConnectionContext';

type Tab = 'hosts' | 'services' | 'vulns' | 'creds' | 'loots';

export function DatabasePage() {
  const { connected } = useConnection();
  const [tab, setTab] = useState<Tab>('hosts');
  const [workspaces, setWorkspaces] = useState<Record<string, unknown>[]>([]);
  const [current, setCurrent] = useState('');
  const [newWs, setNewWs] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (!connected) return;
    try {
      const [ws, cur] = await Promise.all([
        api.get<{ workspaces?: Record<string, unknown>[] }>('/api/db/workspaces'),
        api.get<{ workspace?: string; name?: string }>('/api/db/workspace/current'),
      ]);
      setWorkspaces(ws.workspaces || (Array.isArray(ws) ? (ws as unknown as Record<string, unknown>[]) : []));
      setCurrent(String(cur.workspace || cur.name || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    }
  }, [connected]);

  const loadTab = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Record<string, unknown>>(`/api/db/${tab}`);
      const key = tab === 'loots' ? 'loots' : tab;
      const list = (data[key] || data[`${tab}`] || []) as Record<string, unknown>[];
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : `Failed to load ${tab}`);
    } finally {
      setLoading(false);
    }
  }, [connected, tab]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  const columns = inferColumns(rows);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Database</h1>
          <p>Workspaces and stored hosts, services, vulns, credentials, and loot.</p>
        </div>
        <button type="button" disabled={!connected || loading} onClick={() => void loadTab()}>
          Refresh
        </button>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <div className="form-grid">
          <label>
            Current workspace
            <select
              value={current}
              onChange={async (e) => {
                const name = e.target.value;
                await api.post('/api/db/workspace/set', { name });
                setCurrent(name);
                await loadTab();
              }}
            >
              <option value="">{current || '(unknown)'}</option>
              {(workspaces.length ? workspaces : [{ name: current }]).map((w, i) => {
                const name = String(w.name || w);
                return (
                  <option key={`${name}-${i}`} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            New workspace
            <div className="btn-row" style={{ marginTop: 0 }}>
              <input value={newWs} onChange={(e) => setNewWs(e.target.value)} placeholder="lab1" />
              <button
                type="button"
                onClick={async () => {
                  await api.post('/api/db/workspace', { name: newWs });
                  setNewWs('');
                  await loadWorkspaces();
                }}
              >
                Add
              </button>
            </div>
          </label>
        </div>
      </div>

      <div className="tabs">
        {(['hosts', 'services', 'vulns', 'creds', 'loots'] as Tab[]).map((t) => (
          <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="panel">
        <DataTable columns={columns} rows={rows} empty={loading ? 'Loading…' : `No ${tab}`} />
      </div>
    </div>
  );
}

function inferColumns(rows: Record<string, unknown>[]): { key: string; label: string }[] {
  if (!rows.length) return [{ key: 'id', label: 'id' }];
  const keys = Object.keys(rows[0]).slice(0, 8);
  return keys.map((key) => ({ key, label: key }));
}
