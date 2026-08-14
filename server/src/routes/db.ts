import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const dbRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

dbRouter.get('/workspaces', async (_req, res) => {
  try {
    res.json(await rpcClient.call('db.workspaces'));
  } catch (err) {
    sendError(res, err, 'Failed to list workspaces');
  }
});

dbRouter.get('/workspace/current', async (_req, res) => {
  try {
    res.json(await rpcClient.call('db.current_workspace'));
  } catch (err) {
    sendError(res, err, 'Failed to get current workspace');
  }
});

dbRouter.post('/workspace', async (req, res) => {
  try {
    const name = String(req.body?.name || '');
    res.json(await rpcClient.call('db.add_workspace', [name]));
  } catch (err) {
    sendError(res, err, 'Failed to add workspace');
  }
});

dbRouter.post('/workspace/set', async (req, res) => {
  try {
    const name = String(req.body?.name || '');
    res.json(await rpcClient.call('db.set_workspace', [name]));
  } catch (err) {
    sendError(res, err, 'Failed to set workspace');
  }
});

dbRouter.delete('/workspace/:name', async (req, res) => {
  try {
    res.json(await rpcClient.call('db.del_workspace', [req.params.name]));
  } catch (err) {
    sendError(res, err, 'Failed to delete workspace');
  }
});

dbRouter.get('/hosts', async (req, res) => {
  try {
    const opts: Record<string, unknown> = {};
    if (req.query.workspace) opts.workspace = String(req.query.workspace);
    if (req.query.limit) opts.limit = Number(req.query.limit);
    res.json(await rpcClient.call('db.hosts', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to list hosts');
  }
});

dbRouter.get('/services', async (req, res) => {
  try {
    const opts: Record<string, unknown> = {};
    if (req.query.workspace) opts.workspace = String(req.query.workspace);
    if (req.query.limit) opts.limit = Number(req.query.limit);
    res.json(await rpcClient.call('db.services', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to list services');
  }
});

dbRouter.get('/vulns', async (req, res) => {
  try {
    const opts: Record<string, unknown> = {};
    if (req.query.workspace) opts.workspace = String(req.query.workspace);
    if (req.query.limit) opts.limit = Number(req.query.limit);
    res.json(await rpcClient.call('db.vulns', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to list vulns');
  }
});

dbRouter.get('/creds', async (req, res) => {
  try {
    const opts: Record<string, unknown> = {};
    if (req.query.workspace) opts.workspace = String(req.query.workspace);
    if (req.query.limit) opts.limit = Number(req.query.limit);
    res.json(await rpcClient.call('db.creds', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to list creds');
  }
});

dbRouter.get('/loots', async (req, res) => {
  try {
    const opts: Record<string, unknown> = {};
    if (req.query.workspace) opts.workspace = String(req.query.workspace);
    if (req.query.limit) opts.limit = Number(req.query.limit);
    res.json(await rpcClient.call('db.loots', [opts]));
  } catch (err) {
    sendError(res, err, 'Failed to list loot');
  }
});
