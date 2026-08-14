import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const pluginsRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

pluginsRouter.get('/', async (_req, res) => {
  try {
    res.json(await rpcClient.call('plugin.loaded'));
  } catch (err) {
    sendError(res, err, 'Failed to list plugins');
  }
});

pluginsRouter.post('/load', async (req, res) => {
  try {
    const name = String(req.body?.name || '');
    const options = req.body?.options || {};
    res.json(await rpcClient.call('plugin.load', [name, options]));
  } catch (err) {
    sendError(res, err, 'Failed to load plugin');
  }
});

pluginsRouter.post('/unload', async (req, res) => {
  try {
    const name = String(req.body?.name || '');
    res.json(await rpcClient.call('plugin.unload', [name]));
  } catch (err) {
    sendError(res, err, 'Failed to unload plugin');
  }
});
