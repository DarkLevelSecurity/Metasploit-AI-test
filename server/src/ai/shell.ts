import { spawn } from 'node:child_process';
import path from 'node:path';
import { getWorkspaceRoot, resolveSafePath } from './workspace.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const HARD_CAP_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 32 * 1024;

const DENY_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/\b/i,
  /\bdel\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\breg\s+delete\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{\s*:\|:&\s*\}\s*;/i, // fork bomb
  /\bcurl\b[^|&;\n]*\|\s*(ba)?sh\b/i,
  /\bwget\b[^|&;\n]*\|\s*(ba)?sh\b/i,
  /\bcurl\b[^|&;\n]*\|\s*powershell\b/i,
  /\biwr\b[^|&;\n]*\|\s*iex\b/i,
  /\binvoke-expression\b/i,
  /\bRemove-Item\b[\s\S]*-Recurse[\s\S]*\\/i,
  /\bcd\s+\/d\s+[a-z]:/i,
  /\bpushd\s+[a-z]:/i,
];

export type RunCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  cwd: string;
  timedOut?: boolean;
  command: string;
};

function assertCommandAllowed(command: string): void {
  const cmd = String(command || '').trim();
  if (!cmd) throw new Error('command must not be empty');
  for (const re of DENY_PATTERNS) {
    if (re.test(cmd)) {
      throw new Error(`Command blocked by safety policy (matched ${re})`);
    }
  }
}

function truncate(buf: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(buf, 'utf8') <= MAX_OUTPUT_BYTES) {
    return { text: buf, truncated: false };
  }
  let out = buf;
  while (Buffer.byteLength(out, 'utf8') > MAX_OUTPUT_BYTES - 32) {
    out = out.slice(0, Math.floor(out.length * 0.9));
  }
  return { text: `${out}\n…[truncated]`, truncated: true };
}

export async function runCommand(
  command: string,
  cwdRel?: string,
  timeoutMs?: number
): Promise<RunCommandResult> {
  assertCommandAllowed(command);

  const root = getWorkspaceRoot();
  const { abs: cwdAbs, rel: cwdRelSafe } = resolveSafePath(cwdRel || '.');
  const timeout = Math.min(
    Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1_000),
    HARD_CAP_TIMEOUT_MS
  );

  const isWin = process.platform === 'win32';
  const shell = isWin ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
  const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shell, args, {
      cwd: cwdAbs,
      env: {
        ...process.env,
        // Keep PATH etc., but hint workspace
        MSF_GUI_WORKSPACE: root,
      },
      windowsHide: true,
    });

    const killTree = () => {
      if (child.killed) return;
      try {
        if (isWin && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        } else {
          child.kill('SIGKILL');
        }
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree();
    }, timeout);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT_BYTES * 2) {
        stdout = truncate(stdout).text;
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (Buffer.byteLength(stderr, 'utf8') > MAX_OUTPUT_BYTES * 2) {
        stderr = truncate(stderr).text;
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = truncate(stdout);
      const err = truncate(stderr);
      resolve({
        exitCode: timedOut ? null : code,
        stdout: out.text,
        stderr: err.text,
        truncated: out.truncated || err.truncated,
        cwd: cwdRelSafe,
        timedOut,
        command,
      });
    });
  });
}

export function summarizeRunCommand(result: RunCommandResult): string {
  if (result.timedOut) return `timeout · ${result.command.slice(0, 60)}`;
  const short = result.command.length > 48 ? `${result.command.slice(0, 48)}…` : result.command;
  return `exit ${result.exitCode ?? '?'} · ${short}`;
}

export function shellCwdDisplay(): string {
  return path.basename(getWorkspaceRoot()) || getWorkspaceRoot();
}
