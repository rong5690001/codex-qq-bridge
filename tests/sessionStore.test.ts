import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SessionStore } from '../src/store/sessionStore.js';

let dir: string;
let statePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codex-qq-store-'));
  statePath = join(dir, 'state.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('SessionStore', () => {
  test('saves and reads project thread IDs', async () => {
    const store = new SessionStore(statePath);
    await store.setThreadId('doudou-puzzle', '019df6e5-5f84-7241-bd15-516a3e9704fc');
    expect((await store.getProject('doudou-puzzle')).threadId).toBe('019df6e5-5f84-7241-bd15-516a3e9704fc');
  });

  test('updates last run status', async () => {
    const store = new SessionStore(statePath);
    await store.setRunStatus('doudou-puzzle', 'run-1', 'running');
    expect(await store.getProject('doudou-puzzle')).toMatchObject({ lastRunId: 'run-1', status: 'running' });
  });

  test('saves and reads runtime settings', async () => {
    const store = new SessionStore(statePath);
    expect(await store.getAllowDirectPrivateMessage()).toBeUndefined();
    await store.setAllowDirectPrivateMessage(true);
    expect(await store.getAllowDirectPrivateMessage()).toBe(true);
  });

  test('throws a clear error for corrupt state JSON', async () => {
    await writeFile(statePath, '{not json', 'utf8');
    const store = new SessionStore(statePath);
    await expect(store.read()).rejects.toThrow('Failed to parse bridge state');
  });
});
