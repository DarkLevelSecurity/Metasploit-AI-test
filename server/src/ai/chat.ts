import { loadSettings } from '../settings/store.js';
import { AI_TOOLS, buildSystemPrompt, executeTool, summarizeRunCommand } from './tools.js';
import type { FileChange } from './workspace.js';
import type { RunCommandResult } from './shell.js';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatResult = {
  message: string;
  actions: Array<{
    type: string;
    label: string;
    href?: string;
    payload?: Record<string, unknown>;
  }>;
  toolTrace: Array<{ name: string; ok: boolean; summary: string }>;
  fileChanges: FileChange[];
  rawAssistant?: unknown;
};

const MAX_TOOL_ROUNDS = 12;

export async function runAssistantChat(userMessages: ChatMessage[]): Promise<ChatResult> {
  const settings = loadSettings();
  if (!settings.ai.enabled) {
    throw new Error('AI assistant is disabled in Settings.');
  }
  if (!settings.ai.apiKey) {
    throw new Error('AI API key is not set. Add it under Settings → AI.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(settings.ai.systemExtra) },
    ...userMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
  ];

  const toolTrace: ChatResult['toolTrace'] = [];
  const actions: ChatResult['actions'] = [];
  const fileChanges: FileChange[] = [];
  let lastAssistant: unknown = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await callChatApi(settings.ai.baseUrl, settings.ai.apiKey, settings.ai.model, messages);
    lastAssistant = completion;
    const choice = completion?.choices?.[0]?.message;
    if (!choice) {
      throw new Error('AI provider returned an empty response.');
    }

    messages.push({
      role: 'assistant',
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    });

    const toolCalls = (choice.tool_calls || []) as ToolCall[];
    if (!toolCalls.length) {
      const text = String(choice.content || '');
      // Heuristic deep-links from final answer
      if (/payload/i.test(text)) {
        actions.push({ type: 'link', label: 'Open Payloads', href: '/payloads' });
      }
      if (/listener|handler|LHOST|LPORT/i.test(text)) {
        actions.push({ type: 'link', label: 'Open Listeners', href: '/listeners' });
      }
      if (/module|exploit|auxiliary/i.test(text)) {
        actions.push({ type: 'link', label: 'Open Modules', href: '/modules' });
      }
      return { message: text, actions, toolTrace, fileChanges, rawAssistant: lastAssistant };
    }

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
      } catch {
        args = {};
      }

      const executed = await executeTool(call.function.name, args);
      toolTrace.push({
        name: call.function.name,
        ok: executed.ok,
        summary: summarizeToolResult(call.function.name, executed.result),
      });

      if (executed.fileChange) {
        fileChanges.push(executed.fileChange);
      }

      collectActions(call.function.name, executed.result, actions);

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(executed.result).slice(0, 12000),
      });
    }
  }

  return {
    message: 'I hit the tool-call limit before finishing. Check the tool trace and ask me to continue.',
    actions,
    toolTrace,
    fileChanges,
    rawAssistant: lastAssistant,
  };
}

async function callChatApi(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<{ choices?: Array<{ message?: ChatMessage & { tool_calls?: ToolCall[] } }> }> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`AI provider returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const errObj = data as { error?: { message?: string } };
    throw new Error(errObj?.error?.message || `AI provider error HTTP ${res.status}`);
  }

  return data as { choices?: Array<{ message?: ChatMessage & { tool_calls?: ToolCall[] } }> };
}

function summarizeToolResult(name: string, result: unknown): string {
  try {
    if (name === 'search_modules' && Array.isArray(result)) {
      return `${result.length} modules`;
    }
    if (name === 'upgrade_payload_plan' && result && typeof result === 'object') {
      const rec = (result as { recommended?: { payload?: string } }).recommended;
      return rec?.payload ? `recommend ${rec.payload}` : 'plan ready';
    }
    if (name === 'generate_payload' && result && typeof result === 'object') {
      return 'payload generated';
    }
    if (name === 'list_dir' && result && typeof result === 'object') {
      const entries = (result as { entries?: unknown[] }).entries;
      return `${Array.isArray(entries) ? entries.length : 0} entries`;
    }
    if (name === 'read_file' && result && typeof result === 'object') {
      const p = (result as { path?: string }).path;
      return p ? `read ${p}` : 'read';
    }
    if ((name === 'write_file' || name === 'edit_file' || name === 'delete_file') && result && typeof result === 'object') {
      const fc = result as FileChange;
      return `${fc.op} ${fc.path} — ${fc.summary}`;
    }
    if (name === 'run_command' && result && typeof result === 'object') {
      return summarizeRunCommand(result as RunCommandResult);
    }
    if (result && typeof result === 'object' && 'error' in (result as object)) {
      return String((result as { error: unknown }).error);
    }
    return 'ok';
  } catch {
    return 'ok';
  }
}

function collectActions(name: string, result: unknown, actions: ChatResult['actions']): void {
  if (!result || typeof result !== 'object') return;

  if (name === 'upgrade_payload_plan') {
    const plan = result as {
      recommended?: { payload?: string; format?: string; lhost?: string; lport?: number };
    };
    const rec = plan.recommended;
    if (rec?.payload) {
      const qs = new URLSearchParams({
        payload: rec.payload,
        format: String(rec.format || 'exe'),
        lhost: String(rec.lhost || ''),
        lport: String(rec.lport || ''),
      });
      actions.push({
        type: 'payload_plan',
        label: `Use ${rec.payload}`,
        href: `/payloads?${qs.toString()}`,
        payload: rec as Record<string, unknown>,
      });
      actions.push({
        type: 'link',
        label: 'Start matching listener',
        href: `/listeners?payload=${encodeURIComponent(rec.payload)}&lhost=${encodeURIComponent(String(rec.lhost || ''))}&lport=${encodeURIComponent(String(rec.lport || ''))}`,
      });
    }
  }

  if (name === 'search_modules' && Array.isArray(result) && result[0]) {
    const first = result[0] as { type?: string; fullname?: string; name?: string };
    const type = first.type || 'exploit';
    let modName = first.fullname || first.name || '';
    if (modName.startsWith(`${type}/`)) modName = modName.slice(type.length + 1);
    if (modName) {
      actions.push({
        type: 'link',
        label: `Open ${type}/${modName}`,
        href: `/modules/run?type=${encodeURIComponent(type)}&name=${encodeURIComponent(modName)}`,
      });
    }
  }
}
