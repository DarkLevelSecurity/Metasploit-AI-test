import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const payloadsRouter = Router();

function sendError(res: import('express').Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const code = err instanceof MsfRpcError && err.code ? err.code : 502;
  res.status(typeof code === 'number' && code >= 400 && code < 600 ? code : 502).json({ error: message });
}

payloadsRouter.post('/generate', async (req, res) => {
  try {
    const {
      payload,
      format = 'raw',
      options = {},
      encoder,
      iterations,
      badchars,
      datastore = {},
    } = req.body || {};

    if (!payload) {
      res.status(400).json({ error: 'payload is required' });
      return;
    }

    const opts: Record<string, unknown> = {
      ...datastore,
      ...options,
      Format: format,
    };

    if (encoder) opts.Encoder = encoder;
    if (iterations) opts.Iterations = Number(iterations);
    if (badchars) opts.BadChars = badchars;

    // module.execute for payload type returns generated payload data
    const result = (await rpcClient.call('module.execute', ['payload', payload, opts])) as Record<
      string,
      unknown
    >;

    const normalized = { ...result };
    if (normalized.payload instanceof Uint8Array) {
      normalized.payload = Buffer.from(normalized.payload).toString('base64');
      normalized.encoding = 'base64';
    } else if (typeof normalized.payload === 'string') {
      // Keep text formats as-is; binary-looking strings still downloadable
      normalized.encoding = 'utf8';
    }

    res.json(normalized);
  } catch (err) {
    sendError(res, err, 'Payload generation failed');
  }
});

payloadsRouter.post('/encode', async (req, res) => {
  try {
    const { data, encoder, options = {} } = req.body || {};
    if (!data || !encoder) {
      res.status(400).json({ error: 'data and encoder are required' });
      return;
    }
    const result = await rpcClient.call('module.encode', [data, encoder, options]);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Encode failed');
  }
});
