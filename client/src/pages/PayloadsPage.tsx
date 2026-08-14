import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { OutputPane } from '../components/OutputPane';
import { useConnection } from '../state/ConnectionContext';
import { useSettings } from '../state/SettingsContext';

export function PayloadsPage() {
  const { connected } = useConnection();
  const { settings } = useSettings();
  const [params] = useSearchParams();
  const [payload, setPayload] = useState('windows/x64/meterpreter/reverse_tcp');
  const [format, setFormat] = useState('exe');
  const [lhost, setLhost] = useState('127.0.0.1');
  const [lport, setLport] = useState('4444');
  const [formats, setFormats] = useState<string[]>([]);
  const [payloadList, setPayloadList] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setLhost(settings.defaults.lhost);
      setLport(String(settings.defaults.lport));
    }
  }, [settings]);

  useEffect(() => {
    if (params.get('payload')) setPayload(String(params.get('payload')));
    if (params.get('format')) setFormat(String(params.get('format')));
    if (params.get('lhost')) setLhost(String(params.get('lhost')));
    if (params.get('lport')) setLport(String(params.get('lport')));
  }, [params]);

  useEffect(() => {
    if (!connected) return;
    void (async () => {
      try {
        const [fmt, list] = await Promise.all([
          api.get<string[] | { formats?: string[] }>('/api/modules/meta/executable-formats'),
          api.get<string[] | { payloads?: string[] }>('/api/modules/meta/payload-list'),
        ]);
        setFormats(Array.isArray(fmt) ? fmt : fmt.formats || []);
        const payloads = Array.isArray(list) ? list : list.payloads || [];
        setPayloadList(payloads.slice(0, 400));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payload metadata');
      }
    })();
  }, [connected]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<Record<string, unknown>>('/api/payloads/generate', {
        payload,
        format,
        datastore: {
          LHOST: lhost,
          LPORT: lport,
        },
      });
      setResult(data);

      // If payload bytes / base64 present, offer download
      const raw = data.payload || data.data;
      if (typeof raw === 'string' && raw.length > 0) {
        const encoding = String(data.encoding || '');
        const treatAsB64 =
          encoding === 'base64' || ['exe', 'elf', 'macho', 'dll', 'msi', 'vba-exe'].includes(format);
        const blob = treatAsB64
          ? b64toBlob(raw)
          : new Blob([raw], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payload.${format || 'bin'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payloads</h1>
          <p>Generate payloads through Metasploit RPC (msfvenom-style).</p>
        </div>
      </div>

      {!connected && <div className="error-banner">Not connected.</div>}
      {error && <div className="error-banner">{error}</div>}

      <form className="panel" onSubmit={onGenerate}>
        <div className="form-grid">
          <label>
            Payload
            <input
              className="mono"
              list="payload-list"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              required
            />
            <datalist id="payload-list">
              {payloadList.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {(formats.length ? formats : ['exe', 'raw', 'elf', 'macho', 'powershell']).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            LHOST
            <input value={lhost} onChange={(e) => setLhost(e.target.value)} required />
          </label>
          <label>
            LPORT
            <input value={lport} onChange={(e) => setLport(e.target.value)} required />
          </label>
        </div>
        <div className="btn-row">
          <button className="primary" type="submit" disabled={!connected || loading}>
            {loading ? 'Generating…' : 'Generate & download'}
          </button>
        </div>
      </form>

      {result && <OutputPane title="Generate result" data={result} />}
    </div>
  );
}

function b64toBlob(b64: string): Blob {
  try {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'application/octet-stream' });
  } catch {
    return new Blob([b64], { type: 'application/octet-stream' });
  }
}
