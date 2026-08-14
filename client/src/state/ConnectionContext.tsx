import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type ConnectPayload } from '../api/client';

type ConnectionState = {
  connected: boolean;
  loading: boolean;
  error: string | null;
  version: Record<string, unknown> | null;
  connection: {
    host: string;
    port: number;
    ssl: boolean;
    username: string;
  } | null;
  connect: (payload: ConnectPayload) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const ConnectionContext = createContext<ConnectionState | null>(null);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<Record<string, unknown> | null>(null);
  const [connection, setConnection] = useState<ConnectionState['connection']>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.get<{
        connected: boolean;
        connection: ConnectionState['connection'];
        version?: Record<string, unknown> | null;
      }>('/api/status', { timeoutMs: 3000 });
      setConnected(status.connected);
      setConnection(status.connection);
      setVersion(status.version || null);
      setError(null);
    } catch (err) {
      // Don't block the UI if status is slow/unreachable
      setError(err instanceof Error ? err.message : 'Status check failed');
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 30000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const connect = useCallback(async (payload: ConnectPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{
        ok: boolean;
        version: Record<string, unknown>;
        connection: ConnectionState['connection'];
      }>('/api/connect', payload, { timeoutMs: 25000 });
      setConnected(true);
      setVersion(result.version);
      setConnection(result.connection);
    } catch (err) {
      setConnected(false);
      setVersion(null);
      setError(err instanceof Error ? err.message : 'Connect failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await api.post('/api/disconnect', {}, { timeoutMs: 5000 });
    setConnected(false);
    setVersion(null);
    setConnection(null);
  }, []);

  const value = useMemo(
    () => ({
      connected,
      loading,
      error,
      version,
      connection,
      connect,
      disconnect,
      refreshStatus,
    }),
    [connected, loading, error, version, connection, connect, disconnect, refreshStatus]
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionState {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider');
  return ctx;
}
