import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConnectPage } from './pages/ConnectPage';
import { ModulesPage } from './pages/ModulesPage';
import { ModuleRunnerPage } from './pages/ModuleRunnerPage';
import { JobsPage } from './pages/JobsPage';
import { SessionsPage } from './pages/SessionsPage';
import { DatabasePage } from './pages/DatabasePage';
import { PayloadsPage } from './pages/PayloadsPage';
import { ListenersPage } from './pages/ListenersPage';
import { PluginsPage } from './pages/PluginsPage';
import { ConsolePage } from './pages/ConsolePage';
import { SettingsPage } from './pages/SettingsPage';
import { AssistantPage } from './pages/AssistantPage';

// Top-level routes map the UI to the primary Metasploit workflows.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ConnectPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="modules/run" element={<ModuleRunnerPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="payloads" element={<PayloadsPage />} />
        <Route path="listeners" element={<ListenersPage />} />
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="console" element={<ConsolePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
