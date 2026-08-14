import { useEffect, useRef, useState } from 'react';

type Props = {
  kind: 'session' | 'console';
  id: string | number;
  sessionType?: string;
};

export function SessionTerm({ kind, id, sessionType = 'meterpreter' }: Props) {
  const [output, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('connecting…');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOutput('');
    setError(null);
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('attached');
      ws.send(
        JSON.stringify({
          type: 'attach',
          kind,
          id,
          sessionType,
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; data?: string; message?: string };
        if (msg.type === 'data' && msg.data) {
          setOutput((prev) => prev + msg.data);
        } else if (msg.type === 'error') {
          setError(msg.message || 'Terminal error');
        } else if (msg.type === 'attached') {
          setStatus(`${kind} ${id}`);
        }
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => setStatus('disconnected');

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [kind, id, sessionType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  function sendLine() {
    const line = input.endsWith('\n') ? input : `${input}\n`;
    wsRef.current?.send(JSON.stringify({ type: 'write', data: line }));
    setOutput((prev) => prev + (input.endsWith('\n') ? input : `${input}\n`));
    setInput('');
  }

  return (
    <div className="panel">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: '1rem', margin: 0 }}>Terminal</h1>
          <p className="mono">{status}</p>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="terminal">
        {output || <span className="muted">Waiting for output…</span>}
        <div ref={bottomRef} />
      </div>
      <div className="btn-row" style={{ alignItems: 'center' }}>
        <input
          style={{ flex: 1 }}
          className="mono"
          value={input}
          placeholder="Type a command and press Enter"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendLine();
          }}
        />
        <button className="primary" type="button" onClick={sendLine}>
          Send
        </button>
      </div>
    </div>
  );
}
