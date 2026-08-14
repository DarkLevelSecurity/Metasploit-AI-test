type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

export function mediaRecorderSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export type SpeechSession = {
  stop: () => void;
};

/** Live browser speech recognition. Resolves with final transcript when recognition ends. */
export function startSpeechRecognition(opts: {
  onInterim?: (text: string) => void;
  lang?: string;
}): { session: SpeechSession; done: Promise<string> } {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return {
      session: { stop: () => undefined },
      done: Promise.reject(new Error('Speech recognition is not supported in this browser')),
    };
  }

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = opts.lang || 'en-US';

  let finalText = '';
  let settle: ((text: string) => void) | null = null;
  let rejectFn: ((err: Error) => void) | null = null;
  let finished = false;

  const done = new Promise<string>((resolve, reject) => {
    settle = resolve;
    rejectFn = reject;
  });

  const finish = (text: string, err?: Error) => {
    if (finished) return;
    finished = true;
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    if (err) rejectFn?.(err);
    else settle?.(text.trim());
  };

  recognition.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0]?.transcript || '';
      if (ev.results[i].isFinal) finalText += `${piece} `;
      else interim += piece;
    }
    opts.onInterim?.(`${finalText}${interim}`.trim());
  };

  recognition.onerror = (ev) => {
    const code = ev.error || 'speech-error';
    if (code === 'aborted' || code === 'no-speech') {
      finish(finalText);
      return;
    }
    finish('', new Error(`Speech recognition error: ${code}`));
  };

  recognition.onend = () => {
    finish(finalText);
  };

  recognition.start();

  return {
    session: {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          finish(finalText);
        }
      },
    },
    done,
  };
}

export type RecorderSession = {
  stop: () => void;
};

/** Record microphone audio until stop(); returns a Blob suitable for Whisper. */
export async function startMediaRecording(): Promise<{
  session: RecorderSession;
  done: Promise<Blob>;
}> {
  if (!mediaRecorderSupported()) {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  let settle: ((blob: Blob) => void) | null = null;
  let rejectFn: ((err: Error) => void) | null = null;
  let finished = false;

  const done = new Promise<Blob>((resolve, reject) => {
    settle = resolve;
    rejectFn = reject;
  });

  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  recorder.onerror = () => {
    if (finished) return;
    finished = true;
    stream.getTracks().forEach((t) => t.stop());
    rejectFn?.(new Error('MediaRecorder failed'));
  };

  recorder.onstop = () => {
    if (finished) return;
    finished = true;
    stream.getTracks().forEach((t) => t.stop());
    const type = recorder.mimeType || 'audio/webm';
    settle?.(new Blob(chunks, { type }));
  };

  recorder.start(250);

  return {
    session: {
      stop: () => {
        if (recorder.state !== 'inactive') recorder.stop();
        else {
          stream.getTracks().forEach((t) => t.stop());
          settle?.(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        }
      },
    },
    done,
  };
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  form.append('audio', blob, `recording.${ext}`);

  const res = await fetch('/api/ai/transcribe', {
    method: 'POST',
    body: form,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Transcription failed: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Transcription failed (${res.status})`;
    throw new Error(message);
  }

  const transcript =
    data && typeof data === 'object' && data !== null && 'text' in data
      ? String((data as { text: unknown }).text || '')
      : '';

  if (!transcript.trim()) throw new Error('Empty transcription');
  return transcript.trim();
}
