import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { requireAuth } from './middleware/requireAuth.js';
import { connectRouter } from './routes/connect.js';
import { modulesRouter } from './routes/modules.js';
import { jobsRouter } from './routes/jobs.js';
import { sessionsRouter } from './routes/sessions.js';
import { dbRouter } from './routes/db.js';
import { payloadsRouter } from './routes/payloads.js';
import { pluginsRouter } from './routes/plugins.js';
import { consoleRouter } from './routes/console.js';
import { listenersRouter } from './routes/listeners.js';
import { settingsRouter } from './routes/settings.js';
import { aiRouter } from './routes/ai.js';
import { attachTerminalHub } from './ws/terminalHub.js';

// Local bridge server: exposes the browser UI and routes Metasploit RPC requests.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Public endpoints are available before authentication; the rest require a connected session.
app.use('/api', connectRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiRouter);

app.use('/api', (req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/status' ||
    req.path === '/connect' ||
    req.path === '/disconnect' ||
    req.path.startsWith('/settings') ||
    req.path.startsWith('/ai')
  ) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

// Protected routes are tied to the live Metasploit RPC connection.
app.use('/api/modules', modulesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/db', dbRouter);
app.use('/api/payloads', payloadsRouter);
app.use('/api/plugins', pluginsRouter);
app.use('/api/console', consoleRouter);
app.use('/api/listeners', listenersRouter);

// Serve the built client when the app is run in production mode.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    next();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// Terminal sessions are exposed through a dedicated WebSocket channel.
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/terminal' });
attachTerminalHub(wss);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MSF GUI bridge listening on http://127.0.0.1:${PORT}`);
});
