import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { OptionForm } from '../components/OptionForm';
import { OutputPane } from '../components/OutputPane';
import { useConnection } from '../state/ConnectionContext';

type OptionMeta = {
  type?: string;
  required?: boolean;
  desc?: string;
  default?: unknown;
  enums?: string[];
};

export function ModuleRunnerPage() {
  const { connected } = useConnection();
  const [params] = useSearchParams();
  const type = params.get('type') || 'exploit';
  const name = params.get('name') || '';

  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [options, setOptions] = useState<Record<string, OptionMeta>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [payloads, setPayloads] = useState<string[]>([]);
  const [payload, setPayload] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<unknown>(null);
  const [resultUuid, setResultUuid] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !name) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = `type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`;
        const [infoRes, optRes, payRes] = await Promise.all([
          api.get<Record<string, unknown>>(`/api/modules/info?${q}`),
          api.get<Record<string, OptionMeta>>(`/api/modules/options?${q}`),
          type === 'exploit' || type === 'evasion'
            ? api.get<{ payloads?: string[] }>(`/api/modules/payloads?${q}`)
            : Promise.resolve({ payloads: [] as string[] }),
        ]);
        if (cancelled) return;

        setInfo(infoRes);
        setOptions(optRes || {});
        const defaults: Record<string, string> = {};
        Object.entries(optRes || {}).forEach(([k, meta]) => {
          if (meta.default != null && meta.default !== '') {
            defaults[k] = String(meta.default);
          }
        });
        setValues(defaults);
        const list = payRes.payloads || [];
        setPayloads(list);
        setPayload(list[0] || '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load module');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [connected, type, name]);

  const builtOptions = useMemo(() => {
    const opts: Record<string, string> = { ...values };
    Object.keys(opts).forEach((k) => {
      if (opts[k] === '') delete opts[k];
    });
    if (payload) opts.PAYLOAD = payload;
    return opts;
  }, [values, payload]);

  async function runAction(action: 'check' | 'execute') {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<Record<string, unknown>>(`/api/modules/${action}`, {
        type,
        name,
        options: builtOptions,
      });
      setOutput(result);
      if (typeof result.uuid === 'string') setResultUuid(result.uuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setLoading(false);
    }
  }

  async function pollResults() {
    if (!resultUuid) return;
    setLoading(true);
    try {
      const result = await api.get(`/api/modules/results/${encodeURIComponent(resultUuid)}`);
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to poll results');
    } finally {
      setLoading(false);
    }
  }

  if (!name) {
    return (
      <div>
        <div className="error-banner">
          No module selected. <Link to="/modules">Search modules</Link> first.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Module runner</h1>
          <p className="mono">
            {type}/{name}
          </p>
        </div>
        <Link to="/modules">Back to search</Link>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{String(info?.name || name)}</h2>
          <p className="muted">{String(info?.description || (loading ? 'Loading…' : ''))}</p>
          {!!info?.references && (
            <pre className="terminal" style={{ minHeight: 120, maxHeight: 220 }}>
              {JSON.stringify(info.references, null, 2)}
            </pre>
          )}
        </div>

        <div className="panel">
          {(type === 'exploit' || type === 'evasion') && (
            <label style={{ marginBottom: 12 }}>
              Payload
              <select value={payload} onChange={(e) => setPayload(e.target.value)}>
                <option value="">(none)</option>
                {payloads.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}
          <OptionForm
            options={options}
            values={values}
            onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
          />
          <div className="btn-row">
            <button type="button" disabled={loading || !connected} onClick={() => void runAction('check')}>
              Check
            </button>
            <button
              className="primary"
              type="button"
              disabled={loading || !connected}
              onClick={() => void runAction('execute')}
            >
              Run
            </button>
            <button type="button" disabled={!resultUuid || loading} onClick={() => void pollResults()}>
              Poll results
            </button>
          </div>
        </div>
      </div>

      {output != null && <OutputPane title="Result" data={output} />}
    </div>
  );
}
