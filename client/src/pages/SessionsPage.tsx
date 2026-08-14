import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { DataTable } from '../components/DataTable';
import { SessionTerm } from '../components/SessionTerm';
import { useConnection } from '../state/ConnectionContext';

type SessionInfo = {
  type?: string;
  tunnel_peer?: string;
  via_exploit?: string;
  info?: string;
  desc?: string;
  session_host?: string;
};

export function SessionsPage() {
  const { connected } = useConnection();
  const [sessions, setSessions] = useState<Record<string, SessionInfo>>({});
  const [activeSid, setActiveSid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await api.get<{ sessions: Record<string, SessionInfo> }>('/api/sessions');
      setSessions(data.sessions || {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list sessions');
    }
  }, [connected]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const rows = Object.entries(sessions).map(([sid, s]) => ({
    sid,
    type: s.type || '',
    host: s.session_host || '',
    peer: s.tunnel_peer || '',
    via: s.via_exploit || '',
    info: s.info || s.desc || '',
  }));

  const activeType = activeSid ? sessions[activeSid]?.type || 'meterpreter' : 'meterpreter';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sessions</h1>
          <p>Active shells and Meterpreter sessions. Click a row to open a terminal.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={!connected}>
          Refresh
        </button>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <DataTable
          columns={[
            { key: 'sid', label: 'ID' },
            { key: 'type', label: 'Type' },
            { key: 'host', label: 'Host' },
            { key: 'peer', label: 'Peer' },
            { key: 'via', label: 'Via' },
            { key: 'info', label: 'Info' },
          ]}
          rows={rows}
          empty="No sessions"
          onRowClick={(row) => setActiveSid(String(row.sid))}
        />
        <div className="btn-row">
          {rows.map((row) => (
            <button
              key={row.sid}
              className="danger"
              type="button"
              onClick={async () => {
                await api.del(`/api/sessions/${row.sid}`);
                if (activeSid === row.sid) setActiveSid(null);
                await refresh();
              }}
            >
              Stop {row.sid}
            </button>
          ))}
        </div>
      </div>

      {activeSid && (
        <SessionTerm kind="session" id={activeSid} sessionType={activeType === 'shell' ? 'shell' : 'meterpreter'} />
      )}
    </div>
  );
}
