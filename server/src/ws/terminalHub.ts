import type { WebSocket, WebSocketServer } from 'ws';
import { rpcClient } from '../msf/rpcClient.js';

type ChannelKind = 'session' | 'console';

type ClientState = {
  kind: ChannelKind;
  id: string;
  sessionType: string;
  timer?: ReturnType<typeof setInterval>;
};

const clients = new WeakMap<WebSocket, ClientState>();

async function readOnce(state: ClientState): Promise<string> {
  if (state.kind === 'console') {
    const result = (await rpcClient.call('console.read', [state.id])) as { data?: string };
    return result?.data || '';
  }

  const sid = Number(state.id);
  const type = state.sessionType;
  let result: { data?: string } = {};
  if (type === 'shell') {
    result = (await rpcClient.call('session.shell_read', [sid])) as { data?: string };
  } else if (type === 'meterpreter') {
    result = (await rpcClient.call('session.meterpreter_read', [sid])) as { data?: string };
  } else {
    result = (await rpcClient.call('session.interactive_read', [sid])) as { data?: string };
  }
  return result?.data || '';
}

async function writeOnce(state: ClientState, data: string): Promise<void> {
  if (state.kind === 'console') {
    await rpcClient.call('console.write', [state.id, data]);
    return;
  }

  const sid = Number(state.id);
  const type = state.sessionType;
  if (type === 'shell') {
    await rpcClient.call('session.shell_write', [sid, data]);
  } else if (type === 'meterpreter') {
    await rpcClient.call('session.meterpreter_write', [sid, data]);
  } else {
    await rpcClient.call('session.interactive_write', [sid, data]);
  }
}

function stopPolling(ws: WebSocket): void {
  const state = clients.get(ws);
  if (state?.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
}

function startPolling(ws: WebSocket): void {
  const state = clients.get(ws);
  if (!state) return;
  stopPolling(ws);

  state.timer = setInterval(async () => {
    if (ws.readyState !== ws.OPEN) {
      stopPolling(ws);
      return;
    }
    if (!rpcClient.connected) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not connected to MSF RPC' }));
      return;
    }
    try {
      const data = await readOnce(state);
      if (data) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Read failed';
      ws.send(JSON.stringify({ type: 'error', message }));
    }
  }, 400);
}

export function attachTerminalHub(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'ready', message: 'Send attach message to begin.' }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type: string;
          kind?: ChannelKind;
          id?: string | number;
          sessionType?: string;
          data?: string;
        };

        if (msg.type === 'attach') {
          stopPolling(ws);
          const state: ClientState = {
            kind: msg.kind === 'console' ? 'console' : 'session',
            id: String(msg.id),
            sessionType: msg.sessionType || 'meterpreter',
          };
          clients.set(ws, state);
          startPolling(ws);
          ws.send(JSON.stringify({ type: 'attached', kind: state.kind, id: state.id }));
          return;
        }

        if (msg.type === 'write') {
          const state = clients.get(ws);
          if (!state) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not attached' }));
            return;
          }
          await writeOnce(state, String(msg.data ?? ''));
          return;
        }

        if (msg.type === 'detach') {
          stopPolling(ws);
          clients.delete(ws);
          ws.send(JSON.stringify({ type: 'detached' }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid message';
        ws.send(JSON.stringify({ type: 'error', message }));
      }
    });

    ws.on('close', () => {
      stopPolling(ws);
      clients.delete(ws);
    });
  });
}
