import { FormEvent, useEffect, useState } from 'react';
import { useSettings } from '../state/SettingsContext';

export function SettingsPage() {
  const { settings, loading, error, save, refresh } = useSettings();
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(55553);
  const [ssl, setSsl] = useState(true);
  const [username, setUsername] = useState('msf');
  const [lhost, setLhost] = useState('127.0.0.1');
  const [lport, setLport] = useState(4444);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [transcriptionModel, setTranscriptionModel] = useState('whisper-1');
  const [systemExtra, setSystemExtra] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setHost(settings.msf.host);
    setPort(settings.msf.port);
    setSsl(settings.msf.ssl);
    setUsername(settings.msf.username);
    setLhost(settings.defaults.lhost);
    setLport(settings.defaults.lport);
    setAiEnabled(settings.ai.enabled);
    setBaseUrl(settings.ai.baseUrl);
    setApiKey('');
    setModel(settings.ai.model);
    setTranscriptionModel(settings.ai.transcriptionModel || 'whisper-1');
    setSystemExtra(settings.ai.systemExtra || '');
    setApiKeySet(Boolean(settings.ai.apiKeySet));
  }, [settings]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setLocalError(null);
    try {
      await save({
        msf: { host, port, ssl, username, uri: settings?.msf.uri || '/api/' },
        defaults: { lhost, lport },
        ai: {
          enabled: aiEnabled,
          baseUrl,
          apiKey: apiKey || '********',
          model,
          transcriptionModel,
          systemExtra,
        },
      });
      setMessage('Settings saved.');
      setApiKey('');
      await refresh();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Connection defaults, listener defaults, and AI assistant provider config. Stored in ~/.msf-gui/settings.json.</p>
        </div>
      </div>

      {loading && <div className="muted">Loading settings…</div>}
      {(localError || error) && <div className="error-banner">{localError || error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <form className="panel" onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Metasploit RPC defaults</h2>
        <div className="form-grid">
          <label>
            Host
            <input value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
          <label>
            Port
            <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </label>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={ssl} onChange={(e) => setSsl(e.target.checked)} />
            Use SSL by default
          </label>
        </div>

        <h2 style={{ fontSize: '1.05rem' }}>Payload / listener defaults</h2>
        <div className="form-grid">
          <label>
            Default LHOST
            <input value={lhost} onChange={(e) => setLhost(e.target.value)} />
          </label>
          <label>
            Default LPORT
            <input type="number" value={lport} onChange={(e) => setLport(Number(e.target.value))} />
          </label>
        </div>

        <h2 style={{ fontSize: '1.05rem' }}>AI assistant</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          OpenAI-compatible API (OpenAI, Azure OpenAI-compatible proxies, local gateways, etc.).
        </p>
        <div className="form-grid">
          <label className="checkbox">
            <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
            Enable AI assistant
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          </label>
          <label>
            Transcription model
            <input
              value={transcriptionModel}
              onChange={(e) => setTranscriptionModel(e.target.value)}
              placeholder="whisper-1"
            />
          </label>
          <label>
            Base URL
            <input
              className="mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label>
            API key {apiKeySet ? <span className="chip">saved</span> : <span className="chip">missing</span>}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? '******** (leave blank to keep)' : 'sk-...'}
            />
          </label>
        </div>
        <label style={{ marginTop: 12 }}>
          Extra system instructions
          <textarea
            rows={3}
            value={systemExtra}
            onChange={(e) => setSystemExtra(e.target.value)}
            placeholder="e.g. Prefer reverse_https on Windows engagements; lab subnet is 10.10.0.0/24"
          />
        </label>

        <div className="btn-row">
          <button className="primary" type="submit" disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            Reload
          </button>
        </div>
      </form>
    </div>
  );
}
