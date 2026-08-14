import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const jobsRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

jobsRouter.get('/', async (_req, res) => {
  try {
    const list = await rpcClient.call('job.list');
    res.json({ jobs: list });
  } catch (err) {
    sendError(res, err, 'Failed to list jobs');
  }
});

jobsRouter.get('/:jid', async (req, res) => {
  try {
    const info = await rpcClient.call('job.info', [Number(req.params.jid)]);
    res.json(info);
  } catch (err) {
    sendError(res, err, 'Failed to get job info');
  }
});

jobsRouter.delete('/:jid', async (req, res) => {
  try {
    const result = await rpcClient.call('job.stop', [Number(req.params.jid)]);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to stop job');
  }
});
