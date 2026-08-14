import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const listenersRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

listenersRouter.post('/handler', async (req, res) => {
  try {
    const {
      payload = 'windows/x64/meterpreter/reverse_tcp',
      lhost,
      lport = 4444,
      extras = {},
    } = req.body || {};

    if (!lhost) {
      res.status(400).json({ error: 'lhost is required' });
      return;
    }

    const options: Record<string, unknown> = {
      PAYLOAD: payload,
      LHOST: lhost,
      LPORT: Number(lport),
      ExitOnSession: false,
      ...extras,
    };

    const result = await rpcClient.call('module.execute', ['exploit', 'multi/handler', options]);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to start handler');
  }
});

listenersRouter.post('/globals', async (req, res) => {
  try {
    const { lhost, lport } = req.body || {};
    const results: Record<string, unknown> = {};
    if (lhost !== undefined) {
      results.lhost = await rpcClient.call('core.setg', ['LHOST', String(lhost)]);
    }
    if (lport !== undefined) {
      results.lport = await rpcClient.call('core.setg', ['LPORT', String(lport)]);
    }
    res.json(results);
  } catch (err) {
    sendError(res, err, 'Failed to set globals');
  }
});

listenersRouter.get('/globals/:name', async (req, res) => {
  try {
    res.json(await rpcClient.call('core.getg', [req.params.name]));
  } catch (err) {
    sendError(res, err, 'Failed to get global');
  }
});
