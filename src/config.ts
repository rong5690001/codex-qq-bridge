import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { BridgeConfig } from './types.js';

const ConfigSchema = z.object({
  hermes: z.object({ command: z.string().min(1), args: z.array(z.string()).default([]) }),
  allowedUsers: z.array(z.string()),
  allowedGroups: z.array(z.string()).default([]),
  commandPrefix: z.string().min(1).default('/codex'),
  defaultSandbox: z.literal('workspace-write').default('workspace-write'),
  defaultReasoningEffort: z.enum(['low', 'medium', 'high', 'xhigh']).default('medium'),
  replyMaxChars: z.number().int().positive().default(3500),
  projects: z.record(z.string(), z.object({
    cwd: z.string().min(1),
    threadId: z.string().default(''),
    sharedWithCodexApp: z.boolean().default(true)
  }))
});

export async function loadConfig(path: string): Promise<BridgeConfig> {
  const raw = await readFile(path, 'utf8');
  return ConfigSchema.parse(JSON.parse(raw));
}

export function parseArgs(argv: string[]): { configPath: string } {
  const configIndex = argv.findIndex((arg) => arg === '--config');
  if (configIndex >= 0) {
    const configPath = argv[configIndex + 1];
    if (!configPath) throw new Error('Missing value for --config');
    return { configPath };
  }
  return { configPath: './config.json' };
}
