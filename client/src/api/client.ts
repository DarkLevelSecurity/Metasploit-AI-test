export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
      signal: init?.signal || controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      const message =
        data && typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status);
    }

    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 504);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), ...opts }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}), ...opts }),
  del: <T>(path: string, opts?: RequestOptions) => request<T>(path, { method: 'DELETE', ...opts }),
};

export type ConnectPayload = {
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  password: string;
};

export type ModuleShort = {
  type?: string;
  name?: string;
  fullname?: string;
  rank?: string;
  disclosuredate?: string;
};
