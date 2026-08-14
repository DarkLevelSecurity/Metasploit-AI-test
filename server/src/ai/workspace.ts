import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MAX_READ_BYTES = 200 * 1024;
const MAX_WRITE_BYTES = 500 * 1024;

const DENIED_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.cursor',
  '__pycache__',
  '.venv',
  'venv',
]);

const BINARY_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.o',
  '.a',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.7z',
  '.rar',
  '.wasm',
  '.pyc',
  '.class',
]);

export type FileChange = {
  path: string;
  op: 'write' | 'edit' | 'delete';
  summary: string;
};

let cachedRoot: string | null = null;

function looksLikeWorkspaceRoot(dir: string): boolean {
  const msfGuiPkg = path.join(dir, 'msf-gui', 'package.json');
  if (fs.existsSync(msfGuiPkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(msfGuiPkg, 'utf8')) as { name?: string };
      return pkg.name === 'msf-gui';
    } catch {
      return false;
    }
  }
  return false;
}

export function getWorkspaceRoot(): string {
  if (process.env.MSF_GUI_WORKSPACE) {
    return path.resolve(process.env.MSF_GUI_WORKSPACE);
  }
  if (cachedRoot) return cachedRoot;

  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (looksLikeWorkspaceRoot(dir)) {
      cachedRoot = dir;
      return dir;
    }
    // cwd may be msf-gui or msf-gui/server
    if (path.basename(dir) === 'msf-gui' || path.basename(dir) === 'server') {
      const parent = path.dirname(dir);
      if (looksLikeWorkspaceRoot(parent)) {
        cachedRoot = parent;
        return parent;
      }
      if (path.basename(parent) === 'msf-gui' && looksLikeWorkspaceRoot(path.dirname(parent))) {
        cachedRoot = path.dirname(parent);
        return cachedRoot;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cachedRoot = path.resolve(process.cwd());
  return cachedRoot;
}

function normalizeRel(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isDeniedRelative(relPosix: string): boolean {
  const parts = relPosix.split('/').filter(Boolean);
  for (const part of parts) {
    if (DENIED_SEGMENTS.has(part)) return true;
  }
  // deny client/dist and server/dist even if "dist" alone is already denied
  if (relPosix.includes('/dist/') || relPosix.endsWith('/dist') || relPosix === 'dist') return true;
  return false;
}

function isSettingsSecretsPath(absPath: string): boolean {
  const settingsFile = path.join(os.homedir(), '.msf-gui', 'settings.json');
  return path.resolve(absPath) === path.resolve(settingsFile);
}

export function resolveSafePath(
  relOrAbs: string,
  opts: { forWrite?: boolean } = {}
): { abs: string; rel: string } {
  const root = getWorkspaceRoot();
  const raw = String(relOrAbs || '').trim() || '.';
  const abs = path.resolve(root, raw);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace root: ${raw}`);
  }

  const relPosix = normalizeRel(rel || '.');
  if (relPosix !== '.' && isDeniedRelative(relPosix)) {
    throw new Error(`Path is denied by policy: ${relPosix}`);
  }

  if (opts.forWrite && isSettingsSecretsPath(abs)) {
    throw new Error('Writing settings.json (API keys) is not allowed via agent tools.');
  }

  // Symlink escape check when target exists
  try {
    if (fs.existsSync(abs)) {
      const real = fs.realpathSync(abs);
      const realRel = path.relative(fs.realpathSync(root), real);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
        throw new Error(`Symlink escapes workspace root: ${relPosix}`);
      }
    } else if (opts.forWrite) {
      // ensure parent is inside root
      let parent = path.dirname(abs);
      while (!fs.existsSync(parent) && parent.startsWith(root)) {
        parent = path.dirname(parent);
      }
      if (fs.existsSync(parent)) {
        const realParent = fs.realpathSync(parent);
        const realRel = path.relative(fs.realpathSync(root), realParent);
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
          throw new Error(`Parent path escapes workspace root: ${relPosix}`);
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && /escapes workspace|denied by policy|not allowed/.test(err.message)) {
      throw err;
    }
  }

  return { abs, rel: relPosix === '' ? '.' : relPosix };
}

function assertTextExtension(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    throw new Error(`Binary or non-text file type not allowed: ${ext || '(none)'}`);
  }
}

export function listDir(relPath: string): {
  path: string;
  entries: Array<{ name: string; type: 'file' | 'dir' | 'other'; size?: number }>;
} {
  const { abs, rel } = resolveSafePath(relPath || '.');
  if (!fs.existsSync(abs)) throw new Error(`Directory not found: ${rel}`);
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${rel}`);

  const entries = fs.readdirSync(abs, { withFileTypes: true }).map((d) => {
    const full = path.join(abs, d.name);
    let type: 'file' | 'dir' | 'other' = 'other';
    let size: number | undefined;
    if (d.isDirectory()) type = 'dir';
    else if (d.isFile()) {
      type = 'file';
      try {
        size = fs.statSync(full).size;
      } catch {
        /* ignore */
      }
    }
    return { name: d.name, type, size };
  });

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { path: rel, entries: entries.slice(0, 200) };
}

export function readFile(
  relPath: string,
  startLine?: number,
  endLine?: number
): { path: string; content: string; truncated: boolean; totalLines: number } {
  const { abs, rel } = resolveSafePath(relPath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${rel}`);
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new Error(`Not a file: ${rel}`);
  assertTextExtension(abs);
  if (stat.size > MAX_READ_BYTES) {
    throw new Error(`File too large to read (${stat.size} bytes; max ${MAX_READ_BYTES})`);
  }

  const raw = fs.readFileSync(abs, 'utf8');
  if (raw.includes('\u0000')) {
    throw new Error('File appears to be binary (NUL bytes found)');
  }

  const lines = raw.split(/\r?\n/);
  const totalLines = lines.length;
  let start = startLine && startLine > 0 ? startLine : 1;
  let end = endLine && endLine > 0 ? endLine : totalLines;
  if (start > totalLines) start = totalLines;
  if (end > totalLines) end = totalLines;
  if (end < start) end = start;

  const slice = lines.slice(start - 1, end).join('\n');
  const truncated = start > 1 || end < totalLines;
  return {
    path: rel,
    content: truncated ? `... lines ${start}-${end} of ${totalLines} ...\n${slice}` : slice,
    truncated,
    totalLines,
  };
}

export function writeFile(relPath: string, content: string): FileChange & { path: string } {
  const { abs, rel } = resolveSafePath(relPath, { forWrite: true });
  assertTextExtension(abs);
  const text = String(content ?? '');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_WRITE_BYTES) {
    throw new Error(`Content too large to write (${bytes} bytes; max ${MAX_WRITE_BYTES})`);
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const existed = fs.existsSync(abs);
  fs.writeFileSync(abs, text, 'utf8');
  return {
    path: rel,
    op: 'write',
    summary: existed ? `overwrote ${bytes} bytes` : `created ${bytes} bytes`,
  };
}

export function editFile(
  relPath: string,
  oldString: string,
  newString: string,
  replaceAll = false
): FileChange & { path: string; replacements: number } {
  const { abs, rel } = resolveSafePath(relPath, { forWrite: true });
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${rel}`);
  assertTextExtension(abs);
  const stat = fs.statSync(abs);
  if (stat.size > MAX_READ_BYTES) {
    throw new Error(`File too large to edit (${stat.size} bytes; max ${MAX_READ_BYTES})`);
  }

  const original = fs.readFileSync(abs, 'utf8');
  if (!oldString) throw new Error('old_string must not be empty');

  const count = original.split(oldString).length - 1;
  if (count === 0) throw new Error('old_string not found in file');
  if (!replaceAll && count > 1) {
    throw new Error(`old_string matches ${count} times; pass replace_all=true or make it unique`);
  }

  const next = replaceAll ? original.split(oldString).join(newString) : original.replace(oldString, newString);
  const bytes = Buffer.byteLength(next, 'utf8');
  if (bytes > MAX_WRITE_BYTES) {
    throw new Error(`Result too large to write (${bytes} bytes; max ${MAX_WRITE_BYTES})`);
  }

  fs.writeFileSync(abs, next, 'utf8');
  const replacements = replaceAll ? count : 1;
  return {
    path: rel,
    op: 'edit',
    summary: `${replacements} replacement(s)`,
    replacements,
  };
}

export function deleteFile(relPath: string): FileChange & { path: string } {
  const { abs, rel } = resolveSafePath(relPath, { forWrite: true });
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${rel}`);
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new Error(`Not a file (directories cannot be deleted): ${rel}`);
  fs.unlinkSync(abs);
  return { path: rel, op: 'delete', summary: 'deleted' };
}
