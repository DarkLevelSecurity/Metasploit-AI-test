import { Router } from 'express';
import { loadSettings, publicSettings, saveSettings, type AppSettings } from '../settings/store.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json(publicSettings());
});

settingsRouter.put('/', (req, res) => {
  try {
    const body = (req.body || {}) as Partial<AppSettings> & {
      ai?: Partial<AppSettings['ai']> & { apiKey?: string };
    };

    const current = loadSettings();
    const patch: Partial<AppSettings> = {};

    if (body.msf) patch.msf = { ...current.msf, ...body.msf };
    if (body.defaults) patch.defaults = { ...current.defaults, ...body.defaults };
    if (body.ai) {
      const nextAi = { ...current.ai, ...body.ai };
      // Keep existing key when UI sends masked placeholder
      if (!body.ai.apiKey || body.ai.apiKey === '********') {
        nextAi.apiKey = current.ai.apiKey;
      }
      patch.ai = nextAi;
    }

    const saved = saveSettings(patch);
    res.json(publicSettings(saved));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save settings' });
  }
});
