import { rpcClient } from '../msf/rpcClient.js';
import { loadSettings } from '../settings/store.js';
import { runCommand, summarizeRunCommand } from './shell.js';
import {
  deleteFile,
  editFile,
  getWorkspaceRoot,
  listDir,
  readFile,
  writeFile,
  type FileChange,
} from './workspace.js';

export type ToolSpec = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolExecution = {
  ok: boolean;
  result: unknown;
  fileChange?: FileChange;
};

export const AI_TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'search_modules',
      description:
        'Search Metasploit modules by query (supports filters like type:exploit, platform, CVE, protocol).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'MSF search query string' },
          limit: { type: 'number', description: 'Max results to return (default 15)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_module_info',
      description: 'Get detailed info for a Metasploit module.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Module type: exploit, auxiliary, post, payload, encoder, evasion, nop',
          },
          name: {
            type: 'string',
            description: 'Module name without type prefix, e.g. windows/smb/ms17_010_eternalblue',
          },
        },
        required: ['type', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_module_options',
      description: 'Get datastore options for a module.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['type', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_compatible_payloads',
      description: 'List payloads compatible with an exploit (or evasion) module.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['exploit', 'evasion'] },
          name: { type: 'string' },
        },
        required: ['type', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upgrade_payload_plan',
      description:
        'Build an upgraded payload plan from user needs (platform, arch, transport, staged/stageless, format). Returns recommended payload name, format, LHOST/LPORT, encoder hints, and why.',
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: 'windows, linux, osx, android, python, php, java, etc.',
          },
          arch: { type: 'string', description: 'x86, x64, aarch64, etc.' },
          transport: {
            type: 'string',
            description: 'reverse_tcp, reverse_https, reverse_http, bind_tcp, etc.',
          },
          staged: {
            type: 'boolean',
            description: 'true for staged (smaller stager), false for stageless',
          },
          format: { type: 'string', description: 'exe, elf, raw, powershell, etc.' },
          meterpreter: { type: 'boolean', description: 'Prefer Meterpreter if true' },
          notes: { type: 'string', description: 'Extra constraints from the user' },
        },
        required: ['platform', 'transport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_payload',
      description:
        'Generate a payload via Metasploit RPC using chosen options. Returns generation metadata (and base64 payload when available).',
      parameters: {
        type: 'object',
        properties: {
          payload: { type: 'string' },
          format: { type: 'string' },
          lhost: { type: 'string' },
          lport: { type: 'number' },
          encoder: { type: 'string' },
          iterations: { type: 'number' },
          extra: { type: 'object', additionalProperties: { type: 'string' } },
        },
        required: ['payload', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_defaults',
      description: 'Read configured GUI defaults (LHOST/LPORT and MSF connection prefs).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description:
        'List files and directories under a path relative to the workspace root (D:\\Test Offsec or MSF_GUI_WORKSPACE).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative directory path (default ".")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace (optional line range).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          start_line: { type: 'number', description: '1-based start line (optional)' },
          end_line: { type: 'number', description: '1-based end line (optional)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a text file in the workspace. Creates parent directories.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          content: { type: 'string', description: 'Full file contents' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Apply an exact string replacement in a workspace file. Prefer this for small edits. Fails if old_string is not unique unless replace_all is true.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a single file under the workspace root (not directories).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a one-shot shell command with cwd under the workspace root. Use for builds, tests, npm, git status — not as a substitute for write/edit file tools.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
          cwd: { type: 'string', description: 'Working directory relative to workspace (default ".")' },
          timeout_ms: {
            type: 'number',
            description: 'Timeout in ms (default 30000, max 120000)',
          },
        },
        required: ['command'],
      },
    },
  },
];

function requireMsf(): void {
  if (!rpcClient.connected) {
    throw new Error('Not connected to Metasploit RPC. Ask the user to Connect first.');
  }
}

function pickPayloadName(opts: {
  platform: string;
  arch?: string;
  transport: string;
  staged?: boolean;
  meterpreter?: boolean;
}): string {
  const platform = opts.platform.toLowerCase();
  const arch = (opts.arch || '').toLowerCase();
  const transport = opts.transport.toLowerCase().replace(/^reverse_/, 'reverse_');
  const wantMeterp = opts.meterpreter !== false;
  const staged = opts.staged !== false;

  if (platform.includes('python')) {
    return wantMeterp
      ? `python/meterpreter/${transport}`
      : `python/shell_${transport.replace('reverse_', 'reverse_')}`;
  }
  if (platform.includes('php')) {
    return wantMeterp ? `php/meterpreter/${transport}` : `php/reverse_${transport.replace('reverse_', '')}`;
  }
  if (platform.includes('java')) {
    return wantMeterp ? `java/meterpreter/${transport}` : `java/jsp_shell_${transport}`;
  }
  if (platform.includes('android')) {
    return `android/meterpreter/${transport}`;
  }
  if (platform.includes('osx') || platform.includes('mac')) {
    const a = arch.includes('arm') || arch.includes('aarch') ? 'arm64' : 'x64';
    if (wantMeterp) return `osx/${a}/meterpreter_${transport}`;
    return `osx/${a}/shell_${transport}`;
  }
  if (platform.includes('linux')) {
    const a = arch.includes('x86') || arch === 'x86' ? 'x86' : 'x64';
    if (wantMeterp) {
      return staged ? `linux/${a}/meterpreter/${transport}` : `linux/${a}/meterpreter_${transport}`;
    }
    return staged ? `linux/${a}/shell/${transport}` : `linux/${a}/shell_${transport}`;
  }

  // default windows
  const a = arch.includes('x86') && !arch.includes('x64') ? '' : 'x64/';
  if (wantMeterp) {
    return staged
      ? `windows/${a}meterpreter/${transport}`.replace('//', '/')
      : `windows/${a}meterpreter_${transport}`.replace('//', '/');
  }
  return staged
    ? `windows/${a}shell/${transport}`.replace('//', '/')
    : `windows/${a}shell_${transport}`.replace('//', '/');
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecution> {
  try {
    switch (name) {
      case 'get_defaults': {
        const s = loadSettings();
        return {
          ok: true,
          result: {
            lhost: s.defaults.lhost,
            lport: s.defaults.lport,
            msf: { ...s.msf, password: undefined },
            msfConnected: rpcClient.connected,
            workspaceRoot: getWorkspaceRoot(),
          },
        };
      }
      case 'list_dir': {
        return { ok: true, result: listDir(String(args.path || '.')) };
      }
      case 'read_file': {
        return {
          ok: true,
          result: readFile(
            String(args.path),
            args.start_line != null ? Number(args.start_line) : undefined,
            args.end_line != null ? Number(args.end_line) : undefined
          ),
        };
      }
      case 'write_file': {
        const change = writeFile(String(args.path), String(args.content ?? ''));
        return { ok: true, result: change, fileChange: change };
      }
      case 'edit_file': {
        const change = editFile(
          String(args.path),
          String(args.old_string ?? ''),
          String(args.new_string ?? ''),
          Boolean(args.replace_all)
        );
        return { ok: true, result: change, fileChange: change };
      }
      case 'delete_file': {
        const change = deleteFile(String(args.path));
        return { ok: true, result: change, fileChange: change };
      }
      case 'run_command': {
        const result = await runCommand(
          String(args.command || ''),
          args.cwd != null ? String(args.cwd) : undefined,
          args.timeout_ms != null ? Number(args.timeout_ms) : undefined
        );
        return { ok: !result.timedOut && result.exitCode === 0, result };
      }
      case 'search_modules': {
        requireMsf();
        const query = String(args.query || '');
        const limit = Number(args.limit || 15);
        const results = (await rpcClient.call('module.search', [query])) as unknown[];
        return { ok: true, result: Array.isArray(results) ? results.slice(0, limit) : results };
      }
      case 'get_module_info': {
        requireMsf();
        const type = String(args.type);
        const modName = String(args.name);
        return { ok: true, result: await rpcClient.call('module.info', [type, modName]) };
      }
      case 'get_module_options': {
        requireMsf();
        return {
          ok: true,
          result: await rpcClient.call('module.options', [String(args.type), String(args.name)]),
        };
      }
      case 'list_compatible_payloads': {
        requireMsf();
        const type = String(args.type);
        const modName = String(args.name);
        if (type === 'evasion') {
          return {
            ok: true,
            result: await rpcClient.call('module.compatible_evasion_payloads', [modName]),
          };
        }
        return {
          ok: true,
          result: await rpcClient.call('module.compatible_payloads', [modName]),
        };
      }
      case 'upgrade_payload_plan': {
        const settings = loadSettings();
        const platform = String(args.platform || 'windows');
        const arch = args.arch ? String(args.arch) : undefined;
        const transport = String(args.transport || 'reverse_tcp');
        const staged = args.staged !== false;
        const meterpreter = args.meterpreter !== false;
        const format = String(args.format || (platform.includes('linux') ? 'elf' : 'exe'));
        const payload = pickPayloadName({ platform, arch, transport, staged, meterpreter });
        const lhost = settings.defaults.lhost;
        const lport = settings.defaults.lport;

        let verified: string[] = [];
        if (rpcClient.connected) {
          try {
            const listed = (await rpcClient.call('module.payloads', [])) as string[] | { payloads?: string[] };
            const all = Array.isArray(listed) ? listed : listed.payloads || [];
            verified = all.filter((p) => p.includes(payload.split('/').slice(-2).join('/'))).slice(0, 12);
            if (all.includes(payload)) verified = [payload, ...verified.filter((p) => p !== payload)];
          } catch {
            /* ignore */
          }
        }

        return {
          ok: true,
          result: {
            recommended: {
              payload,
              format,
              lhost,
              lport,
              staged,
              meterpreter,
              encoder: null,
              datastore: { LHOST: lhost, LPORT: lport },
            },
            alternatives: verified.slice(0, 8),
            guiLinks: {
              payloadsPage: '/payloads',
              listenersPage: '/listeners',
              openRunnerHint: 'Use Payloads page or Listeners with this payload',
            },
            rationale: [
              `Platform=${platform}, arch=${arch || 'default'}, transport=${transport}`,
              staged ? 'Staged payload chosen (smaller initial stage).' : 'Stageless payload chosen (single stage).',
              meterpreter ? 'Meterpreter preferred for post-exploitation flexibility.' : 'Shell payload preferred.',
              `Defaults from Settings: LHOST=${lhost}, LPORT=${lport}`,
              args.notes ? `User notes: ${String(args.notes)}` : null,
            ].filter(Boolean),
          },
        };
      }
      case 'generate_payload': {
        requireMsf();
        const settings = loadSettings();
        const payload = String(args.payload);
        const format = String(args.format || 'raw');
        const lhost = String(args.lhost || settings.defaults.lhost);
        const lport = Number(args.lport || settings.defaults.lport);
        const opts: Record<string, unknown> = {
          Format: format,
          LHOST: lhost,
          LPORT: lport,
          ...(args.extra && typeof args.extra === 'object' ? args.extra : {}),
        };
        if (args.encoder) opts.Encoder = String(args.encoder);
        if (args.iterations) opts.Iterations = Number(args.iterations);

        const result = (await rpcClient.call('module.execute', ['payload', payload, opts])) as Record<
          string,
          unknown
        >;
        const normalized: Record<string, unknown> = { ...result, payloadName: payload, format, lhost, lport };
        if (normalized.payload instanceof Uint8Array) {
          normalized.payload = Buffer.from(normalized.payload).toString('base64');
          normalized.encoding = 'base64';
        }
        return { ok: true, result: normalized };
      }
      default:
        return { ok: false, result: { error: `Unknown tool: ${name}` } };
    }
  } catch (err) {
    return { ok: false, result: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export function buildSystemPrompt(extra: string): string {
  const root = getWorkspaceRoot();
  return [
    'You are the Metasploit Web GUI coding agent for authorized penetration testing labs.',
    'You have two jobs: (1) Metasploit ops — modules, payloads, listeners; (2) coding agent for the local workspace filesystem.',
    `IMPORTANT: You DO have local filesystem and shell tools. Never claim you only have Metasploit RPC or that you cannot read/edit local files.`,
    `Workspace root: ${root}`,
    'Available coding tools (use them): list_dir, read_file, write_file, edit_file, delete_file, run_command.',
    'Available Metasploit tools: search_modules, get_module_info, get_module_options, list_compatible_payloads, upgrade_payload_plan, generate_payload, get_defaults.',
    'Coding: always read_file before editing existing files. Prefer edit_file for small changes; write_file for new files; delete_file only when asked.',
    'Scripts and modules ARE editable: Ruby (.rb) under metasploit-framework-master/modules, resource scripts (.rc), Python/PowerShell/shell helpers, and msf-gui source.',
    'When the user asks to read/explain/edit a script: call list_dir/read_file/edit_file immediately. Ask for a path only if you cannot find a reasonable candidate.',
    'When the user asks to inject/customize code related to a payload/module: do NOT stop at generate_payload. Edit or create source scripts (.rb/.rc/.py/.ps1/.sh) in the workspace. generate_payload only builds a standard MSF blob from options.',
    'If they want custom logic, prefer editing/adding source scripts and note that MSF may need reload/restart for framework module changes.',
    'Use run_command for builds, tests, npm, git status — not as a substitute for write/edit when changing source.',
    'Paths for file tools are relative to the workspace root. Denied paths (node_modules, .git, dist, etc.) will fail.',
    'Help find modules, choose/configure payloads, and upgrade payload plans. Prefer concrete module/payload names. Offer GUI next steps.',
    'Do not invent module paths when search tools are available — verify with search_modules / list_compatible_payloads.',
    'For payload upgrades: call upgrade_payload_plan, explain, then offer generate_payload only if the user wants a file generated.',
    'Do not keep long-lived interactive processes open via run_command; use the GUI console/session pages instead.',
    'Keep answers concise and operational.',
    extra ? `Operator notes: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export { summarizeRunCommand };
