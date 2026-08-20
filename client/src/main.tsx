import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionProvider } from './state/ConnectionContext';
import { SettingsProvider } from './state/SettingsContext';
import './styles.css';

// Bootstrap the app with providers for routing, connection state, and saved settings.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SettingsProvider>
          <ConnectionProvider>
            <App />
          </ConnectionProvider>
        </SettingsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
