import { describe, expect, test } from 'vitest';
import { parseCommand } from '../src/messageParser.js';

describe('parseCommand', () => {
  test('ignores messages without the command prefix', () => {
    expect(parseCommand('hello', '/codex')).toEqual({ kind: 'ignored' });
  });

  test('uses the default project when a run command omits the project', () => {
    expect(parseCommand('cx 修复构建报错', 'cx', {
      defaultProject: 'doudou-puzzle',
      projectAliases: ['doudou-puzzle']
    })).toEqual({
      kind: 'run',
      project: 'doudou-puzzle',
      task: '修复构建报错'
    });
  });

  test('keeps explicit projects ahead of the default project', () => {
    expect(parseCommand('cx other-project 修复构建报错', 'cx', {
      defaultProject: 'doudou-puzzle',
      projectAliases: ['doudou-puzzle', 'other-project']
    })).toEqual({
      kind: 'run',
      project: 'other-project',
      task: '修复构建报错'
    });
  });

  test('parses a project run command', () => {
    expect(parseCommand('/codex doudou-puzzle 修复构建报错', '/codex')).toEqual({
      kind: 'run',
      project: 'doudou-puzzle',
      task: '修复构建报错'
    });
  });

  test('rejects a run command with an empty task', () => {
    expect(parseCommand('/codex doudou-puzzle', '/codex')).toEqual({
      kind: 'invalid',
      reason: 'Missing task. Usage: /codex <project> <task>'
    });
  });

  test('requires an explicit project when no default project is configured', () => {
    expect(parseCommand('cx 修复构建报错', 'cx')).toEqual({
      kind: 'invalid',
      reason: 'Missing task. Usage: cx <project> <task>'
    });
  });

  test('parses status, session, new, and attach commands', () => {
    expect(parseCommand('/codex status', '/codex')).toEqual({ kind: 'status' });
    expect(parseCommand('cx direct on', 'cx')).toEqual({ kind: 'direct', enabled: true });
    expect(parseCommand('cx direct off', 'cx')).toEqual({ kind: 'direct', enabled: false });
    expect(parseCommand('/codex session doudou-puzzle', '/codex')).toEqual({ kind: 'session', project: 'doudou-puzzle' });
    expect(parseCommand('/codex new doudou-puzzle', '/codex')).toEqual({ kind: 'new', project: 'doudou-puzzle' });
    expect(parseCommand('/codex attach doudou-puzzle 019df6e5-5f84-7241-bd15-516a3e9704fc', '/codex')).toEqual({
      kind: 'attach',
      project: 'doudou-puzzle',
      threadId: '019df6e5-5f84-7241-bd15-516a3e9704fc'
    });
  });

  test('rejects attach commands with non UUID thread IDs', () => {
    expect(parseCommand('/codex attach doudou-puzzle latest', '/codex')).toEqual({
      kind: 'invalid',
      reason: 'Invalid threadId. Expected UUID format.'
    });
  });
});
