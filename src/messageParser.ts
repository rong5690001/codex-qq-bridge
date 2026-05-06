import type { ParsedCommand } from './types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type ParseCommandOptions = {
  defaultProject?: string;
  projectAliases?: string[];
};

export function parseCommand(text: string, commandPrefix: string, options: ParseCommandOptions = {}): ParsedCommand {
  const trimmed = text.trim();
  if (!trimmed.startsWith(commandPrefix)) return { kind: 'ignored' };

  const rest = trimmed.slice(commandPrefix.length).trim();
  if (!rest) return { kind: 'invalid', reason: `Missing command. Usage: ${commandPrefix} <project> <task>` };

  const [first, second, ...remaining] = rest.split(/\s+/);
  if (first === 'status') return { kind: 'status' };

  if (first === 'direct') {
    if (second === 'on') return { kind: 'direct', enabled: true };
    if (second === 'off') return { kind: 'direct', enabled: false };
    return { kind: 'invalid', reason: `Missing argument. Usage: ${commandPrefix} direct on|off` };
  }

  if (first === 'session') {
    if (!second) return { kind: 'invalid', reason: `Missing project. Usage: ${commandPrefix} session <project>` };
    return { kind: 'session', project: second };
  }

  if (first === 'new') {
    if (!second) return { kind: 'invalid', reason: `Missing project. Usage: ${commandPrefix} new <project>` };
    return { kind: 'new', project: second };
  }

  if (first === 'attach') {
    const threadId = remaining[0];
    if (!second || !threadId) return { kind: 'invalid', reason: `Missing arguments. Usage: ${commandPrefix} attach <project> <threadId>` };
    if (!isUuid(threadId)) return { kind: 'invalid', reason: 'Invalid threadId. Expected UUID format.' };
    return { kind: 'attach', project: second, threadId };
  }

  const explicitProject = options.projectAliases?.includes(first) ?? false;
  const project = explicitProject ? first : options.defaultProject ?? first;
  const taskParts = explicitProject || !options.defaultProject ? [second, ...remaining] : [first, second, ...remaining];
  const task = taskParts.filter(Boolean).join(' ').trim();
  if (!task) return { kind: 'invalid', reason: `Missing task. Usage: ${commandPrefix} <project> <task>` };
  return { kind: 'run', project, task };
}
