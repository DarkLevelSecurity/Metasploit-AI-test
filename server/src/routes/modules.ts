import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const modulesRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

function requireTypeName(req: import('express').Request, res: import('express').Response): { type: string; name: string } | null {
  const type = String(req.query.type || req.body?.type || '');
  const name = String(req.query.name || req.body?.name || '');
  if (!type || !name) {
    res.status(400).json({ error: 'type and name are required' });
    return null;
  }
  return { type, name };
}

modulesRouter.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    const results = await rpcClient.call('module.search', [q]);
    res.json({ results });
  } catch (err) {
    sendError(res, err, 'Search failed');
  }
});

modulesRouter.get('/info', async (req, res) => {
  try {
    const tn = requireTypeName(req, res);
    if (!tn) return;
    res.json(await rpcClient.call('module.info', [tn.type, tn.name]));
  } catch (err) {
    sendError(res, err, 'Failed to load module info');
  }
});

modulesRouter.get('/options', async (req, res) => {
  try {
    const tn = requireTypeName(req, res);
    if (!tn) return;
    res.json(await rpcClient.call('module.options', [tn.type, tn.name]));
  } catch (err) {
    sendError(res, err, 'Failed to load module options');
  }
});

modulesRouter.get('/payloads', async (req, res) => {
  try {
    const tn = requireTypeName(req, res);
    if (!tn) return;
    if (tn.type === 'exploit') {
      res.json(await rpcClient.call('module.compatible_payloads', [tn.name]));
      return;
    }
    if (tn.type === 'evasion') {
      res.json(await rpcClient.call('module.compatible_evasion_payloads', [tn.name]));
      return;
    }
    res.json({ payloads: [] });
  } catch (err) {
    sendError(res, err, 'Failed to load compatible payloads');
  }
});

modulesRouter.post('/execute', async (req, res) => {
  try {
    const tn = requireTypeName(req, res);
    if (!tn) return;
    const opts = req.body?.options || {};
    res.json(await rpcClient.call('module.execute', [tn.type, tn.name, opts]));
  } catch (err) {
    sendError(res, err, 'Module execute failed');
  }
});

modulesRouter.post('/check', async (req, res) => {
  try {
    const tn = requireTypeName(req, res);
    if (!tn) return;
    const opts = req.body?.options || {};
    res.json(await rpcClient.call('module.check', [tn.type, tn.name, opts]));
  } catch (err) {
    sendError(res, err, 'Module check failed');
  }
});

modulesRouter.get('/results/:uuid', async (req, res) => {
  try {
    res.json(await rpcClient.call('module.results', [req.params.uuid]));
  } catch (err) {
    sendError(res, err, 'Failed to load module results');
  }
});

modulesRouter.get('/meta/platforms', async (_req, res) => {
  try {
    res.json(await rpcClient.call('module.platforms'));
  } catch (err) {
    sendError(res, err, 'Failed to load platforms');
  }
});

modulesRouter.get('/meta/architectures', async (_req, res) => {
  try {
    res.json(await rpcClient.call('module.architectures'));
  } catch (err) {
    sendError(res, err, 'Failed to load architectures');
  }
});

modulesRouter.get('/meta/executable-formats', async (_req, res) => {
  try {
    res.json(await rpcClient.call('module.executable_formats'));
  } catch (err) {
    sendError(res, err, 'Failed to load executable formats');
  }
});

modulesRouter.get('/meta/encode-formats', async (_req, res) => {
  try {
    res.json(await rpcClient.call('module.encode_formats'));
  } catch (err) {
    sendError(res, err, 'Failed to load encode formats');
  }
});

modulesRouter.get('/meta/payload-list', async (req, res) => {
  try {
    const arch = req.query.arch ? String(req.query.arch) : null;
    const result = await rpcClient.call('module.payloads', arch ? [null, arch] : []);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to list payloads');
  }
});
