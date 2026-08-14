import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SessionTerm } from '../components/SessionTerm';
import { useConnection } from '../state/ConnectionContext';

export function ConsolePage() {
  const { connected } = useConnection();
  const [cid, setCid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    async function ensureConsole() {
      setCreating(true);
      setError(null);
      try {
        const created = await api.post<{ id?: string; uuid?: string }>('/api/console', {});
        if (cancelled) return;
        setCid(String(created.id ?? created.uuid ?? ''));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to create console');
      } finally {
        if (!cancelled) setCreating(false);
      }
    }

    void ensureConsole();

    return () => {
      cancelled = true;
    };
  }, [connected]);

  useEffect(() => {
    return () => {
      if (cid) {
        void api.del(`/api/console/${cid}`).catch(() => undefined);
      }
    };
  }, [cid]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Console</h1>
          <p>Embedded msfconsole channel via `console.create` / read / write.</p>
        </div>
        <button
          type="button"
          disabled={!connected || creating}
          onClick={async () => {
            if (cid) await api.del(`/api/console/${cid}`).catch(() => undefined);
            const created = await api.post<{ id?: string }>('/api/console', {});
            setCid(String(created.id || ''));
          }}
        >
          New console
        </button>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}
      {creating && <div className="muted">Creating console…</div>}
      {cid && <SessionTerm kind="console" id={cid} />}
    </div>
  );
}
