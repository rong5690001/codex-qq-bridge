import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codex-qq-bridge-config-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  test('defaults the command prefix to cx', async () => {
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hermes: { command: 'hermes', args: [] },
      allowedUsers: ['10001'],
      projects: { 'doudou-puzzle': { cwd: '/tmp/doudou-puzzle' } }
    }));

    await expect(loadConfig(configPath)).resolves.toMatchObject({ commandPrefix: 'cx', allowDirectPrivateMessage: false });
  });

  test('rejects a default project that is not configured', async () => {
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hermes: { command: 'hermes', args: [] },
      allowedUsers: ['10001'],
      defaultProject: 'missing-project',
      projects: { 'doudou-puzzle': { cwd: '/tmp/doudou-puzzle' } }
    }));

    await expect(loadConfig(configPath)).rejects.toThrow('defaultProject must match a configured project: missing-project');
  });
});
