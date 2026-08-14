import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const consoleRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

consoleRouter.post('/', async (req, res) => {
  try {
    const opts = req.body?.options || {};
    res.json(await rpcClient.call('console.create', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to create console');
  }
});

consoleRouter.get('/', async (_req, res) => {
  try {
    res.json(await rpcClient.call('console.list'));
  } catch (err) {
    sendError(res, err, 'Failed to list consoles');
  }
});

consoleRouter.delete('/:cid', async (req, res) => {
  try {
    res.json(await rpcClient.call('console.destroy', [req.params.cid]));
  } catch (err) {
    sendError(res, err, 'Failed to destroy console');
  }
});

consoleRouter.get('/:cid/read', async (req, res) => {
  try {
    res.json(await rpcClient.call('console.read', [req.params.cid]));
  } catch (err) {
    sendError(res, err, 'Failed to read console');
  }
});

consoleRouter.post('/:cid/write', async (req, res) => {
  try {
    const data = String(req.body?.data ?? '');
    res.json(await rpcClient.call('console.write', [req.params.cid, data]));
  } catch (err) {
    sendError(res, err, 'Failed to write console');
  }
});
