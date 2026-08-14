import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useConnection } from '../state/ConnectionContext';

export function PluginsPage() {
  const { connected } = useConnection();
  const [plugins, setPlugins] = useState<string[]>([]);
  const [name, setName] = useState('alias');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await api.get<{ plugins?: string[] }>('/api/plugins');
      setPlugins(data.plugins || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list plugins');
    }
  }, [connected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onLoad(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const result = await api.post<{ result?: string }>('/api/plugins/load', { name });
      setMessage(`Load ${name}: ${result.result || 'done'}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Plugins</h1>
          <p>Load and unload msfconsole plugins via RPC.</p>
        </div>
        <button type="button" disabled={!connected} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <form className="panel" onSubmit={onLoad}>
        <label>
          Plugin name
          <input className="mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="alias" />
        </label>
        <div className="btn-row">
          <button className="primary" type="submit" disabled={!connected}>
            Load
          </button>
        </div>
      </form>

      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Loaded plugins</h2>
        {!plugins.length && <div className="muted">None loaded</div>}
        <ul>
          {plugins.map((p) => (
            <li key={p} className="mono" style={{ marginBottom: 8 }}>
              {p}{' '}
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  await api.post('/api/plugins/unload', { name: p });
                  await refresh();
                }}
              >
                Unload
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
