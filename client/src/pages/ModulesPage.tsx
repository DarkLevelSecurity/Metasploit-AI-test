import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ModuleShort } from '../api/client';
import { useConnection } from '../state/ConnectionContext';
import { DataTable } from '../components/DataTable';

export function ModulesPage() {
  const navigate = useNavigate();
  const { connected } = useConnection();
  const [q, setQ] = useState('type:exploit smb');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ModuleShort[]>([]);

  async function onSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!connected) {
      setError('Connect to MSF RPC first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ results: ModuleShort[] }>(
        `/api/modules/search?q=${encodeURIComponent(q)}`
      );
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  const rows = results.map((m) => {
    const fullname = m.fullname || '';
    const type = m.type || guessType(fullname);
    return {
      type,
      name: stripTypePrefix(fullname, type),
      fullname,
      title: m.name || '',
      rank: m.rank || '',
      disclosuredate: m.disclosuredate || '',
    };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Modules</h1>
          <p>Search the module cache, then open a module to configure and run it.</p>
        </div>
      </div>

      {!connected && <div className="error-banner">Not connected. Go to Connect first.</div>}
      {error && <div className="error-banner">{error}</div>}

      <form className="panel" onSubmit={onSearch}>
        <label>
          Search query
          <input
            className="mono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="type:exploit eternalblue"
          />
        </label>
        <div className="btn-row">
          <button className="primary" type="submit" disabled={loading || !connected}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      <div className="panel">
        <DataTable
          columns={[
            { key: 'type', label: 'Type' },
            { key: 'title', label: 'Title' },
            { key: 'fullname', label: 'Full name' },
            { key: 'rank', label: 'Rank' },
            { key: 'disclosuredate', label: 'Disclosure' },
          ]}
          rows={rows}
          empty={loading ? 'Searching…' : 'No modules yet. Run a search.'}
          onRowClick={(row) => {
            const type = String(row.type);
            const name = String(row.name);
            navigate(`/modules/run?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`);
          }}
        />
        {rows[0] && (
          <p className="muted" style={{ marginTop: 8 }}>
            Tip: click a row to open the runner, or{' '}
            <Link to={`/modules/run?type=${rows[0].type}&name=${encodeURIComponent(String(rows[0].name))}`}>
              open the first result
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function guessType(fullname: string): string {
  const prefix = fullname.split('/')[0];
  if (['exploit', 'auxiliary', 'post', 'payload', 'encoder', 'nop', 'evasion'].includes(prefix)) {
    return prefix;
  }
  return 'exploit';
}

function stripTypePrefix(fullname: string, type?: string): string {
  const t = type || guessType(fullname);
  if (fullname.startsWith(`${t}/`)) return fullname.slice(t.length + 1);
  return fullname;
}
