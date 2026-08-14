import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { OutputPane } from '../components/OutputPane';
import { useConnection } from '../state/ConnectionContext';
import { useSettings } from '../state/SettingsContext';

export function ListenersPage() {
  const { connected } = useConnection();
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const [payload, setPayload] = useState('windows/x64/meterpreter/reverse_tcp');
  const [lhost, setLhost] = useState('0.0.0.0');
  const [lport, setLport] = useState(4444);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setLhost(settings.defaults.lhost || '0.0.0.0');
      setLport(settings.defaults.lport);
    }
  }, [settings]);

  useEffect(() => {
    if (params.get('payload')) setPayload(String(params.get('payload')));
    if (params.get('lhost')) setLhost(String(params.get('lhost')));
    if (params.get('lport')) setLport(Number(params.get('lport')));
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/listeners/globals', { lhost, lport });
      const data = await api.post('/api/listeners/handler', { payload, lhost, lport });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start handler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Listeners</h1>
          <p>
            Start <span className="mono">exploit/multi/handler</span> as a background job. Manage it under{' '}
            <Link to="/jobs">Jobs</Link>.
          </p>
        </div>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}
      {result != null && <div className="success-banner">Handler start requested.</div>}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Payload
            <input className="mono" value={payload} onChange={(e) => setPayload(e.target.value)} required />
          </label>
          <label>
            LHOST
            <input value={lhost} onChange={(e) => setLhost(e.target.value)} required />
          </label>
          <label>
            LPORT
            <input
              type="number"
              value={lport}
              onChange={(e) => setLport(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <div className="btn-row">
          <button className="primary" type="submit" disabled={!connected || loading}>
            {loading ? 'Starting…' : 'Start multi/handler'}
          </button>
        </div>
      </form>

      {result != null && <OutputPane title="Handler result" data={result} />}
    </div>
  );
}
