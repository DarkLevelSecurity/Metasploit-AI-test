import { Router } from 'express';
import multer from 'multer';
import { runAssistantChat, type ChatMessage } from '../ai/chat.js';
import { loadSettings, publicSettings } from '../settings/store.js';

export const aiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

aiRouter.get('/status', (_req, res) => {
  const s = loadSettings();
  res.json({
    enabled: s.ai.enabled,
    configured: Boolean(s.ai.apiKey),
    model: s.ai.model,
    baseUrl: s.ai.baseUrl,
    transcriptionModel: s.ai.transcriptionModel,
    settings: publicSettings(s).ai,
  });
});

aiRouter.post('/chat', async (req, res) => {
  try {
    const messages = (req.body?.messages || []) as ChatMessage[];
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const sanitized = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? ''),
      })) as ChatMessage[];

    const result = await runAssistantChat(sanitized);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'AI chat failed' });
  }
});

aiRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const settings = loadSettings();
    if (!settings.ai.enabled) {
      res.status(400).json({ error: 'AI assistant is disabled in Settings.' });
      return;
    }
    if (!settings.ai.apiKey) {
      res.status(400).json({ error: 'AI API key is not set. Add it under Settings → AI.' });
      return;
    }
    if (!req.file?.buffer?.length) {
      res.status(400).json({ error: 'audio file is required (field name: audio)' });
      return;
    }

    const model = settings.ai.transcriptionModel || 'whisper-1';
    const url = `${settings.ai.baseUrl.replace(/\/$/, '')}/audio/transcriptions`;
    const form = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], {
      type: req.file.mimetype || 'application/octet-stream',
    });
    const filename = req.file.originalname || 'audio.webm';
    form.append('file', blob, filename);
    form.append('model', model);

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.ai.apiKey}`,
      },
      body: form,
    });

    const text = await upstream.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      res.status(502).json({
        error: `Transcription provider returned non-JSON (${upstream.status}): ${text.slice(0, 200)}`,
      });
      return;
    }

    if (!upstream.ok) {
      const errObj = data as { error?: { message?: string } };
      res.status(502).json({
        error: errObj?.error?.message || `Transcription failed HTTP ${upstream.status}`,
      });
      return;
    }

    const transcript =
      data && typeof data === 'object' && data !== null && 'text' in data
        ? String((data as { text: unknown }).text || '')
        : '';

    if (!transcript.trim()) {
      res.status(502).json({ error: 'Transcription returned empty text' });
      return;
    }

    res.json({ text: transcript.trim(), model });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Transcription failed' });
  }
});
