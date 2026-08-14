import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  mediaRecorderSupported,
  speechRecognitionSupported,
  startMediaRecording,
  startSpeechRecognition,
  transcribeAudio,
} from '../lib/voiceInput';
import { useConnection } from '../state/ConnectionContext';
import { useSettings } from '../state/SettingsContext';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type Action = {
  type: string;
  label: string;
  href?: string;
  payload?: Record<string, unknown>;
};

type ToolTrace = { name: string; ok: boolean; summary: string };

type FileChange = { path: string; op: 'write' | 'edit' | 'delete'; summary: string };

type VoiceMode = 'idle' | 'listening' | 'recording' | 'transcribing';

const SUGGESTIONS = [
  'Find exploits related to SMB on Windows',
  'Upgrade my payload: Windows x64 reverse HTTPS Meterpreter, stageless, exe',
  'List Ruby payload modules under metasploit-framework-master/modules/payloads',
  'Read and explain a script I name, then edit it when I ask',
];

export function AssistantPage() {
  const { connected } = useConnection();
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'I can search Metasploit modules, edit scripts/modules in your workspace (.rb, .rc, .py, etc.), run shell commands, and take voice messages. For custom code changes, point me at a script path (or ask me to find the module) — I edit source files, not binary payload blobs. Configure the API key under Settings first.',
    },
  ]);
  const [actions, setActions] = useState<Action[]>([]);
  const [trace, setTrace] = useState<ToolTrace[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('idle');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const voiceStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      voiceStopRef.current?.();
    };
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setError(null);
    setActions([]);
    setTrace([]);
    setFileChanges([]);

    try {
      const result = await api.post<{
        message: string;
        actions?: Action[];
        toolTrace?: ToolTrace[];
        fileChanges?: FileChange[];
      }>(
        '/api/ai/chat',
        {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        },
        { timeoutMs: 180_000 }
      );

      setMessages((prev) => [...prev, { role: 'assistant', content: result.message || '(no reply)' }]);
      setActions(result.actions || []);
      setTrace(result.toolTrace || []);
      setFileChanges(result.fileChanges || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  async function startWhisperRecording() {
    if (!mediaRecorderSupported()) {
      throw new Error('Microphone recording is not supported in this browser');
    }
    setVoiceMode('recording');
    const { session, done } = await startMediaRecording();
    voiceStopRef.current = () => session.stop();
    const blob = await done;
    voiceStopRef.current = null;
    setVoiceMode('transcribing');
    const text = await transcribeAudio(blob);
    setInput(text);
    setVoiceMode('idle');
    await send(text);
  }

  async function toggleVoice() {
    if (busy || !aiReady) return;

    if (voiceMode === 'listening' || voiceMode === 'recording') {
      voiceStopRef.current?.();
      voiceStopRef.current = null;
      return;
    }
    if (voiceMode === 'transcribing') return;

    setError(null);

    if (speechRecognitionSupported()) {
      try {
        setVoiceMode('listening');
        const { session, done } = startSpeechRecognition({
          onInterim: (t) => setInput(t),
        });
        voiceStopRef.current = () => session.stop();
        const text = await done;
        voiceStopRef.current = null;
        setVoiceMode('idle');
        if (text.trim()) {
          setInput(text);
          await send(text);
        }
        return;
      } catch (err) {
        voiceStopRef.current = null;
        setError(
          err instanceof Error
            ? `${err.message} — falling back to Whisper recording…`
            : 'Speech recognition failed — falling back to Whisper…'
        );
      }
    }

    try {
      await startWhisperRecording();
    } catch (err) {
      setVoiceMode('idle');
      voiceStopRef.current = null;
      setError(err instanceof Error ? err.message : 'Voice input failed');
    }
  }

  const aiReady = settings?.ai.enabled && settings.ai.apiKeySet;
  const voiceBusy = voiceMode !== 'idle';
  const micLabel =
    voiceMode === 'listening'
      ? 'Stop'
      : voiceMode === 'recording'
        ? 'Stop'
        : voiceMode === 'transcribing'
          ? '…'
          : 'Mic';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>AI Agent</h1>
          <p>
            Metasploit ops, workspace coding (read/write/edit), shell commands, and voice input.{' '}
            <Link to="/settings">Settings</Link>
          </p>
        </div>
        <div className="mono muted" style={{ textAlign: 'right' }}>
          <div className={aiReady ? 'ok' : 'bad'}>{aiReady ? 'AI configured' : 'AI not configured'}</div>
          <div className={connected ? 'ok' : 'bad'}>{connected ? 'MSF connected' : 'MSF offline'}</div>
        </div>
      </div>

      {!aiReady && (
        <div className="error-banner">
          Set an AI API key in <Link to="/settings">Settings</Link> before chatting.
        </div>
      )}
      {!connected && (
        <div className="error-banner">
          Connect to msfrpcd for live module search / payload generation. Coding and planning still work.
        </div>
      )}
      {error && <div className="error-banner">{error}</div>}

      <div className="grid-2">
        <div className="panel chat-panel">
          <div className="chat-log">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                <div className="chat-role">{m.role === 'user' ? 'You' : 'Agent'}</div>
                <div className="chat-content">{m.content}</div>
              </div>
            ))}
            {busy && <div className="muted">Thinking / tools…</div>}
            {voiceMode === 'listening' && <div className="muted">Listening… click Mic again to send.</div>}
            {voiceMode === 'recording' && <div className="muted">Recording… click Mic again to transcribe.</div>}
            {voiceMode === 'transcribing' && <div className="muted">Transcribing with Whisper…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="suggestion-row">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={busy || !aiReady || voiceBusy} onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>

          <form className="btn-row" onSubmit={onSubmit} style={{ alignItems: 'stretch' }}>
            <input
              style={{ flex: 1 }}
              value={input}
              disabled={busy || !aiReady || voiceMode === 'transcribing'}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for modules, code edits, shell commands… or use the mic"
            />
            <button
              type="button"
              className={`mic-btn ${voiceMode === 'listening' || voiceMode === 'recording' ? 'mic-active' : ''}`}
              disabled={busy || !aiReady || voiceMode === 'transcribing'}
              onClick={() => void toggleVoice()}
              title={
                speechRecognitionSupported()
                  ? 'Voice input (browser speech, Whisper fallback)'
                  : mediaRecorderSupported()
                    ? 'Voice input via Whisper transcription'
                    : 'Voice input not supported'
              }
            >
              {micLabel}
            </button>
            <button className="primary" type="submit" disabled={busy || !aiReady || voiceBusy || !input.trim()}>
              Send
            </button>
          </form>
        </div>

        <div>
          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Suggested actions</h2>
            {!actions.length && <div className="muted">Actions from tool results appear here.</div>}
            <div className="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {actions.map((a, i) =>
                a.href ? (
                  <Link key={`${a.label}-${i}`} to={a.href} className="action-link">
                    {a.label}
                  </Link>
                ) : (
                  <div key={`${a.label}-${i}`} className="muted">
                    {a.label}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Files changed</h2>
            {!fileChanges.length && <div className="muted">File edits from this turn appear here.</div>}
            <ul className="trace-list">
              {fileChanges.map((f, i) => (
                <li key={`${f.path}-${i}`} className="mono">
                  <span className="ok">{f.op}</span> {f.path} — {f.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Tool trace</h2>
            {!trace.length && <div className="muted">No tools used yet.</div>}
            <ul className="trace-list">
              {trace.map((t, i) => (
                <li key={`${t.name}-${i}`} className="mono">
                  <span className={t.ok ? 'ok' : 'bad'}>{t.ok ? 'ok' : 'err'}</span> {t.name} — {t.summary}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
