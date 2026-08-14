import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const sessionsRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

sessionsRouter.get('/', async (_req, res) => {
  try {
    const list = await rpcClient.call('session.list');
    res.json({ sessions: list });
  } catch (err) {
    sendError(res, err, 'Failed to list sessions');
  }
});

sessionsRouter.delete('/:sid', async (req, res) => {
  try {
    const result = await rpcClient.call('session.stop', [Number(req.params.sid)]);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to stop session');
  }
});

sessionsRouter.post('/:sid/write', async (req, res) => {
  try {
    const sid = Number(req.params.sid);
    const data = String(req.body?.data ?? '');
    const type = String(req.body?.type || 'meterpreter');
    let result: unknown;
    if (type === 'shell') {
      result = await rpcClient.call('session.shell_write', [sid, data]);
    } else if (type === 'meterpreter') {
      result = await rpcClient.call('session.meterpreter_write', [sid, data]);
    } else {
      result = await rpcClient.call('session.interactive_write', [sid, data]);
    }
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to write to session');
  }
});

sessionsRouter.get('/:sid/read', async (req, res) => {
  try {
    const sid = Number(req.params.sid);
    const type = String(req.query.type || 'meterpreter');
    let result: unknown;
    if (type === 'shell') {
      result = await rpcClient.call('session.shell_read', [sid]);
    } else if (type === 'meterpreter') {
      result = await rpcClient.call('session.meterpreter_read', [sid]);
    } else {
      result = await rpcClient.call('session.interactive_read', [sid]);
    }
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to read session');
  }
});

sessionsRouter.post('/:sid/run', async (req, res) => {
  try {
    const sid = Number(req.params.sid);
    const command = String(req.body?.command ?? '');
    const result = await rpcClient.call('session.meterpreter_run_single', [sid, command]);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to run meterpreter command');
  }
});
