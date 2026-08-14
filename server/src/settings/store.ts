import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
  };
};

const DEFAULT_SETTINGS: AppSettings = {
  msf: {
    host: '127.0.0.1',
    port: 55553,
    ssl: true,
    username: 'msf',
    uri: '/api/',
  },
  defaults: {
    lhost: '127.0.0.1',
    lport: 4444,
  },
  ai: {
    enabled: true,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    transcriptionModel: 'whisper-1',
    systemExtra: '',
  },
};

function settingsPath(): string {
  const dir = path.join(os.homedir(), '.msf-gui');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'settings.json');
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key as keyof T] === 'object' &&
      base[key as keyof T] !== null
    ) {
      out[key] = deepMerge(
        base[key as keyof T] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function loadSettings(): AppSettings {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) {
      return structuredClone(DEFAULT_SETTINGS);
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppSettings>;
    return deepMerge(structuredClone(DEFAULT_SETTINGS), raw);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = deepMerge(loadSettings(), patch);
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function publicSettings(settings: AppSettings = loadSettings()): AppSettings & {
  ai: AppSettings['ai'] & { apiKeySet: boolean };
} {
  return {
    ...settings,
    ai: {
      ...settings.ai,
      apiKey: settings.ai.apiKey ? '********' : '',
      apiKeySet: Boolean(settings.ai.apiKey),
    },
  };
}
