import { describe, expect, test } from 'vitest';
import { createRunLock, validateMessagePolicy } from '../src/policy/policy.js';
import type { BridgeConfig } from '../src/types.js';

const config: BridgeConfig = {
  hermes: { command: 'hermes', args: ['mcp', 'serve'] },
  allowedUsers: ['10001'],
  allowedGroups: ['20001'],
  commandPrefix: '/codex',
  allowDirectPrivateMessage: false,
  defaultSandbox: 'workspace-write',
  defaultReasoningEffort: 'medium',
  replyMaxChars: 3500,
  projects: {
    'doudou-puzzle': {
      cwd: '/tmp/doudou-puzzle',
      threadId: '',
      sharedWithCodexApp: true
    }
  }
};

describe('validateMessagePolicy', () => {
  test('rejects non-whitelisted senders', () => {
    expect(validateMessagePolicy({ senderId: '9', groupId: undefined, text: '/codex status' }, config)).toEqual({
      allowed: false,
      reason: 'Sender is not whitelisted.'
    });
  });

  test('allows whitelisted groups even when sender is not listed', () => {
    expect(validateMessagePolicy({ senderId: '9', groupId: '20001', text: '/codex status' }, config)).toEqual({ allowed: true });
  });

  test('rejects unknown projects', () => {
    expect(validateMessagePolicy({ senderId: '10001', groupId: undefined, text: '/codex unknown hello', project: 'unknown' }, config)).toEqual({
      allowed: false,
      reason: 'Unknown project: unknown'
    });
  });

  test('rejects dangerous text', () => {
    expect(validateMessagePolicy({ senderId: '10001', groupId: undefined, text: '/codex doudou-puzzle cat .env', project: 'doudou-puzzle' }, config)).toEqual({
      allowed: false,
      reason: 'Request contains a blocked dangerous pattern: /\\.env\\b/i'
    });
  });
});

describe('createRunLock', () => {
  test('allows only one active run per project', () => {
    const lock = createRunLock();
    expect(lock.acquire('doudou-puzzle')).toBe(true);
    expect(lock.acquire('doudou-puzzle')).toBe(false);
    lock.release('doudou-puzzle');
    expect(lock.acquire('doudou-puzzle')).toBe(true);
  });
});
