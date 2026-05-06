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
  commandPrefix: 'cx',
  defaultProject: 'doudou-puzzle',
  allowDirectPrivateMessage: false,
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
      text: 'cx doudou-puzzle hello'
    });

    expect(sendMessage).toHaveBeenCalledWith('conv-1', expect.stringContaining('已接收任务'));
    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('任务完成：doudou-puzzle'));
    expect(codex.run).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/Users/rong/workspace/doudou-puzzle', threadId: '' }));
    expect((await store.getProject('doudou-puzzle')).threadId).toBe('019df6e5-5f84-7241-bd15-516a3e9704fc');
  });

  test('runs Codex with the default project when the command omits the project', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const codex = {
      run: vi.fn(async () => ({
        threadId: '019df6e5-5f84-7241-bd15-516a3e9704fc',
        finalResponse: 'done',
        events: [],
        changedFiles: false
      }))
    };
    const store = new SessionStore(join(dir, 'state.json'));
    const app = new BridgeApp({ ...config, commandPrefix: 'cx' }, store, { sendMessage }, codex as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: 'cx hello'
    });

    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('任务完成：doudou-puzzle'));
    expect(codex.run).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/Users/rong/workspace/doudou-puzzle',
      task: '[Remote QQ message from allowed sender 10001]\nhello'
    }));
  });

  test('runs direct private messages when the runtime switch is enabled', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const codex = {
      run: vi.fn(async () => ({
        threadId: '019df6e5-5f84-7241-bd15-516a3e9704fc',
        finalResponse: 'done',
        events: [],
        changedFiles: false
      }))
    };
    const store = new SessionStore(join(dir, 'state.json'));
    await store.setAllowDirectPrivateMessage(true);
    const app = new BridgeApp(config, store, { sendMessage }, codex as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: '修复构建报错'
    });

    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('任务完成：doudou-puzzle'));
    expect(codex.run).toHaveBeenCalledWith(expect.objectContaining({
      task: '[Remote QQ message from allowed sender 10001]\n修复构建报错'
    }));
  });

  test('does not run direct group messages even when the runtime switch is enabled', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const codex = { run: vi.fn() };
    const store = new SessionStore(join(dir, 'state.json'));
    await store.setAllowDirectPrivateMessage(true);
    const app = new BridgeApp({ ...config, allowedGroups: ['20001'] }, store, { sendMessage }, codex as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      groupId: '20001',
      text: '修复构建报错'
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(codex.run).not.toHaveBeenCalled();
  });

  test('toggles direct private messages at runtime', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const store = new SessionStore(join(dir, 'state.json'));
    const app = new BridgeApp(config, store, { sendMessage }, { run: vi.fn() } as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: 'cx direct on'
    });

    expect(await store.getAllowDirectPrivateMessage()).toBe(true);
    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('directPrivateMessage=on'));

    await app.handleMessage({
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: '10001',
      text: 'cx direct off'
    });

    expect(await store.getAllowDirectPrivateMessage()).toBe(false);
    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('directPrivateMessage=off'));
  });

  test('attaches and reports an existing threadId', async () => {
    const sendMessage = vi.fn(async () => undefined);
    const store = new SessionStore(join(dir, 'state.json'));
    const app = new BridgeApp(config, store, { sendMessage }, { run: vi.fn() } as any, join(dir, 'runs'));

    await app.handleMessage({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: '10001',
      text: 'cx attach doudou-puzzle 019df6e5-5f84-7241-bd15-516a3e9704fc'
    });
    await app.handleMessage({
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: '10001',
      text: 'cx session doudou-puzzle'
    });

    expect(sendMessage).toHaveBeenLastCalledWith('conv-1', expect.stringContaining('019df6e5-5f84-7241-bd15-516a3e9704fc'));
  });
});
