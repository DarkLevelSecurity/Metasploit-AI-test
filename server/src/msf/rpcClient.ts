import http from 'node:http';
import https from 'node:https';
import { encode, decode } from '@msgpack/msgpack';

const textDecoder = new TextDecoder();

export type MsfConnectionConfig = {
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  password: string;
  uri?: string;
};

export class MsfRpcError extends Error {
  code?: number;
  details?: unknown;

  constructor(message: string, code?: number, details?: unknown) {
    super(message);
    this.name = 'MsfRpcError';
    this.code = code;
    this.details = details;
  }
}

/** Ruby MessagePack often uses bin-type keys; convert them to strings for JS objects. */
function mapKeyConverter(key: unknown): string | number {
  if (typeof key === 'string' || typeof key === 'number') {
    return key;
  }
  if (key instanceof Uint8Array) {
    return textDecoder.decode(key);
  }
  if (Buffer.isBuffer(key)) {
    return key.toString('utf8');
  }
  throw new Error(`Unsupported MessagePack map key type: ${typeof key}`);
}

function decodeMsfResponse(buffer: Buffer): unknown {
  if (!buffer.length) {
    throw new MsfRpcError(
      'Empty response from msfrpcd. Is RPC running, and is SSL matching (try toggling Use SSL)?',
      502
    );
  }

  try {
    return decode(buffer, { mapKeyConverter });
  } catch (err) {
    const preview = buffer.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ');
    const detail = err instanceof Error ? err.message : 'decode failed';
    throw new MsfRpcError(
      `Invalid MessagePack from msfrpcd (${detail}). Check host/port/SSL. Preview: ${preview}`,
      502
    );
  }
}

export class MsfRpcClient {
  private config: MsfConnectionConfig | null = null;
  private token: string | null = null;
  private cachedVersion: Record<string, unknown> | null = null;

  get connected(): boolean {
    return Boolean(this.config && this.token);
  }

  get connectionInfo(): Omit<MsfConnectionConfig, 'password'> | null {
    if (!this.config) return null;
    const { host, port, ssl, username, uri } = this.config;
    return { host, port, ssl, username, uri };
  }

  get versionInfo(): Record<string, unknown> | null {
    return this.cachedVersion;
  }

  async connect(config: MsfConnectionConfig): Promise<Record<string, unknown>> {
    this.config = {
      uri: '/api/',
      ...config,
    };
    this.token = null;
    this.cachedVersion = null;

    const login = (await this.rawCall('auth.login', [config.username, config.password], false)) as {
      result?: string;
      token?: string;
    };

    if (login.result !== 'success' || !login.token) {
      this.config = null;
      throw new MsfRpcError('Authentication failed');
    }

    this.token = login.token;
    const version = (await this.call('core.version')) as Record<string, unknown>;
    this.cachedVersion = version;
    return version;
  }

  disconnect(): void {
    this.token = null;
    this.config = null;
    this.cachedVersion = null;
  }

  requireConnected(): void {
    if (!this.connected) {
      throw new MsfRpcError('Not connected to Metasploit RPC', 401);
    }
  }

  async call(method: string, args: unknown[] = []): Promise<unknown> {
    this.requireConnected();
    try {
      return await this.rawCall(method, args, true);
    } catch (err) {
      if (
        err instanceof MsfRpcError &&
        /Invalid Authentication Token/i.test(err.message) &&
        this.config
      ) {
        await this.connect(this.config);
        return this.rawCall(method, args, true);
      }
      throw err;
    }
  }

  private async rawCall(method: string, args: unknown[], withToken: boolean): Promise<unknown> {
    if (!this.config) {
      throw new MsfRpcError('RPC client not configured', 400);
    }

    const payloadArgs: unknown[] = withToken ? [method, this.token, ...args] : [method, ...args];
    const body = Buffer.from(encode(payloadArgs));

    const responseBody = await this.httpPost(body);
    const decoded = decodeMsfResponse(responseBody) as Record<string, unknown>;

    // Coerce Ruby bin-typed scalar strings (e.g. token) without touching binary blobs
    const normalized = coerceTextFields(decoded);

    if (normalized && typeof normalized === 'object' && (normalized as Record<string, unknown>).error === true) {
      const obj = normalized as Record<string, unknown>;
      throw new MsfRpcError(
        String(obj.error_message || obj.error_string || 'RPC error'),
        Number(obj.error_code || 500),
        obj
      );
    }

    return normalized;
  }

  private httpPost(body: Buffer): Promise<Buffer> {
    if (!this.config) {
      return Promise.reject(new MsfRpcError('RPC client not configured', 400));
    }

    const { host, port, ssl, uri = '/api/' } = this.config;
    const transport = ssl ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          host,
          port,
          path: uri,
          method: 'POST',
          headers: {
            'Content-Type': 'binary/message-pack',
            'Content-Length': body.length,
            Accept: 'binary/message-pack',
          },
          rejectUnauthorized: false,
          timeout: 20_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            const code = res.statusCode || 0;
            if (![200, 401, 403, 500].includes(code)) {
              reject(new MsfRpcError(`Unexpected HTTP status ${code}`, code, buf.toString('utf8')));
              return;
            }
            resolve(buf);
          });
        }
      );

      req.on('error', (err) => reject(new MsfRpcError(err.message, 502)));
      req.on('timeout', () => {
        req.destroy();
        reject(new MsfRpcError('RPC request timed out', 504));
      });
      req.write(body);
      req.end();
    });
  }
}

function asTextIfPossible(value: unknown): unknown {
  const bytes =
    value instanceof Uint8Array ? value : Buffer.isBuffer(value) ? value : null;
  if (!bytes) return value;
  // Heuristic: treat short, null-free sequences as UTF-8 text (tokens, messages)
  if (bytes.length > 16_384) return value;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return value;
  }
  try {
    return textDecoder.decode(bytes);
  } catch {
    return value;
  }
}

function coerceTextFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => coerceTextFields(item));
  }
  if (value && typeof value === 'object' && !(value instanceof Uint8Array) && !Buffer.isBuffer(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
        out[k] = asTextIfPossible(v);
      } else {
        out[k] = coerceTextFields(v);
      }
    }
    return out;
  }
  return asTextIfPossible(value);
}

export const rpcClient = new MsfRpcClient();
