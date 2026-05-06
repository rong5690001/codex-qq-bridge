import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BridgeApp } from '../src/bridge.js';
import { SessionStore } from '../src/store/sessionStore.js';
import type { BridgeConfig } from '../src/types.js';

let dir: string;

const config: BridgeConfig = {
  hermes: { command: 'hermes', args: ['mcp', 'serve'] },
  allowedUsers: ['10001'],
  allowedGroups: [],
  commandPrefix: '/codex',
  defaultSandbox: 'workspace-write',
  defaultReasoningEffort: 'medium',
  replyMaxChars: 3500,
  projects: {
    'doudou-puzzle': {
      cwd: '/Users/rong/workspace/doudou-puzzle',
      threadId: '',
      sharedWithCodexApp: true
    }
  }
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codex-qq-bridge-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('BridgeApp', () => {
  test('runs Codex for a whitelisted QQ command and stores the threadId', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const codex = {
      run: vi.fn(async () => ({
        threadId: '019df6e5-5f84-7241-bd15-516a3e9704fc',
        finalResponse: 'done',
        events: [{ type: 'thread.started' }],
        changedFiles: false
      }))
    };
    const store = new SessionStore(join(dir, 'state.json'));
    const app = new BridgeApp(config, store, { sendMessage }, codex as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: '/codex doudou-puzzle hello'
    });

    expect(sendMessage).toHaveBeenCalledWith('conv-1', expect.stringContaining('已接收任务'));
    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('任务完成：doudou-puzzle'));
    expect(codex.run).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/Users/rong/workspace/doudou-puzzle', threadId: '' }));
    expect((await store.getProject('doudou-puzzle')).threadId).toBe('019df6e5-5f84-7241-bd15-516a3e9704fc');
  });

  test('attaches and reports an existing threadId', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const store = new SessionStore(join(dir, 'state.json'));
    const app = new BridgeApp(config, store, { sendMessage }, { run: vi.fn() } as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: '/codex attach doudou-puzzle 019df6e5-5f84-7241-bd15-516a3e9704fc'
    });
    await app.handleMessage({
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: '10001',
      text: '/codex session doudou-puzzle'
    });

    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('019df6e5-5f84-7241-bd15-516a3e9704fc'));
  });
});
