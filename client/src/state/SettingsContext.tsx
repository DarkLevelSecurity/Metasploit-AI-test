import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export type AppSettings = {
  msf: {
    host: string;
    port: number;
    ssl: boolean;
    username: string;
    uri: string;
  };
  defaults: {
    lhost: string;
    lport: number;
  };
  ai: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    transcriptionModel: string;
    systemExtra: string;
    apiKeySet?: boolean;
  };
};

type SettingsState = {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<AppSettings>;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<AppSettings>('/api/settings', { timeoutMs: 3000 });
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (patch: Partial<AppSettings>) => {
    const data = await api.put<AppSettings>('/api/settings', patch);
    setSettings(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({ settings, loading, error, refresh, save }),
    [settings, loading, error, refresh, save]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
