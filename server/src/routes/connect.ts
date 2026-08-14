import { Router } from 'express';
import { MsfRpcError, rpcClient } from '../msf/rpcClient.js';

export const connectRouter = Router();

connectRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'msf-gui-bridge' });
});

connectRouter.get('/status', (_req, res) => {
  res.json({
    connected: rpcClient.connected,
    connection: rpcClient.connectionInfo,
    // Cached at connect time — avoid an MSF RPC round-trip on every page open
    version: rpcClient.versionInfo,
  });
});

connectRouter.post('/connect', async (req, res) => {
  try {
    const {
      host = '127.0.0.1',
      port = 55553,
      ssl = true,
      username,
      password,
      uri = '/api/',
    } = req.body || {};

    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const version = await rpcClient.connect({
      host: String(host),
      port: Number(port),
      ssl: Boolean(ssl),
      username: String(username),
      password: String(password),
      uri: String(uri),
    });

    res.json({
      ok: true,
      version,
      connection: rpcClient.connectionInfo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connect failed';
    const code = err instanceof MsfRpcError && err.code && err.code < 600 ? err.code : 502;
    res.status(code === 401 ? 401 : 502).json({ error: message });
  }
});

connectRouter.post('/disconnect', (_req, res) => {
  rpcClient.disconnect();
  res.json({ ok: true });
});

connectRouter.get('/version', async (_req, res) => {
  try {
    const version = await rpcClient.call('core.version');
    res.json(version);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get version';
    res.status(502).json({ error: message });
  }
});
