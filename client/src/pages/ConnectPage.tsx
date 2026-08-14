import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConnection } from '../state/ConnectionContext';
import { useSettings } from '../state/SettingsContext';
import { OutputPane } from '../components/OutputPane';

export function ConnectPage() {
  const { connect, disconnect, connected, loading, error, version, connection } = useConnection();
  const { settings } = useSettings();
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(55553);
  const [ssl, setSsl] = useState(true);
  const [username, setUsername] = useState('msf');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setHost(settings.msf.host);
    setPort(settings.msf.port);
    setSsl(settings.msf.ssl);
    setUsername(settings.msf.username);
  }, [settings]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await connect({ host, port, ssl, username, password });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Connect failed');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Connect</h1>
          <p>
            Authenticate to a running Metasploit `msfrpcd` instance. Defaults come from{' '}
            <Link to="/settings">Settings</Link>.
          </p>
        </div>
      </div>

      {(localError || error) && <div className="error-banner">{localError || error}</div>}
      {connected && <div className="success-banner">Connected to Metasploit RPC.</div>}

      <div className="grid-2">
        <form className="panel" onSubmit={onSubmit}>
          <div className="form-grid">
            <label>
              Host
              <input value={host} onChange={(e) => setHost(e.target.value)} required />
            </label>
            <label>
              Port
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!connected}
              />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={ssl} onChange={(e) => setSsl(e.target.checked)} />
              Use SSL
            </label>
          </div>
          <div className="btn-row">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Working…' : connected ? 'Reconnect' : 'Connect'}
            </button>
            <button type="button" disabled={!connected || loading} onClick={() => void disconnect()}>
              Disconnect
            </button>
          </div>
        </form>

        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Current session</h2>
          {connection ? (
            <div className="mono muted">
              <div>User: {connection.username}</div>
              <div>
                Endpoint: {connection.ssl ? 'https' : 'http'}://{connection.host}:{connection.port}
              </div>
            </div>
          ) : (
            <p className="muted">Not connected. Start msfrpcd first, then connect here.</p>
          )}
          <pre className="terminal" style={{ marginTop: 12, minHeight: 160 }}>
            {`# Example
./msfrpcd -U msf -P yourpassword -a 127.0.0.1 -p 55553`}
          </pre>
        </div>
      </div>

      {version && <OutputPane title="core.version" data={version} />}
    </div>
  );
}
