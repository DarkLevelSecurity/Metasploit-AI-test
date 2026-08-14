import { NavLink, Outlet } from 'react-router-dom';
import { useConnection } from '../state/ConnectionContext';

const links = [
  { to: '/', label: 'Connect', end: true },
  { to: '/assistant', label: 'AI Agent' },
  { to: '/modules', label: 'Modules' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/database', label: 'Database' },
  { to: '/payloads', label: 'Payloads' },
  { to: '/listeners', label: 'Listeners' },
  { to: '/plugins', label: 'Plugins' },
  { to: '/console', label: 'Console' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const { connected, connection, version } = useConnection();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Metasploit Web GUI</strong>
          <span>RPC bridge UI</span>
        </div>
        <nav className="nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="status-pill">
          <div className={connected ? 'ok' : 'bad'}>{connected ? 'Connected' : 'Disconnected'}</div>
          {connection && (
            <div className="muted mono" style={{ marginTop: 6 }}>
              {connection.username}@{connection.host}:{connection.port}
            </div>
          )}
          {version?.version != null && (
            <div className="muted mono" style={{ marginTop: 4 }}>
              MSF {String(version.version)}
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
