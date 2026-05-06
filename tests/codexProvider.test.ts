import { describe, expect, test, vi } from 'vitest';
import { CodexProvider } from '../src/codex/codexProvider.js';

async function* events(threadId: string, text: string) {
  yield { type: 'thread.started', thread_id: threadId };
  yield { type: 'item.completed', item: { type: 'agent_message', text } };
  yield { type: 'turn.completed', usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0 } };
}

describe('CodexProvider', () => {
  test('starts a thread when no threadId exists', async () => {
    const runStreamed = vi.fn(async () => ({ events: events('019df6e5-5f84-7241-bd15-516a3e9704fc', 'done') }));
    const startThread = vi.fn(() => ({ runStreamed }));
    const resumeThread = vi.fn();
    class FakeCodex { startThread = startThread; resumeThread = resumeThread; }
    const provider = new CodexProvider({ Codex: FakeCodex as any });

    const result = await provider.run({
      task: 'hello',
      cwd: '/repo',
      threadId: '',
      sandboxMode: 'workspace-write',
      reasoningEffort: 'medium'
    });

    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({ workingDirectory: '/repo', sandboxMode: 'workspace-write' }));
    expect(resumeThread).not.toHaveBeenCalled();
    expect(result.threadId).toBe('019df6e5-5f84-7241-bd15-516a3e9704fc');
    expect(result.finalResponse).toBe('done');
  });

  test('resumes an existing thread', async () => {
    const runStreamed = vi.fn(async () => ({ events: events('019df6e5-5f84-7241-bd15-516a3e9704fc', 'continued') }));
    const startThread = vi.fn();
    const resumeThread = vi.fn(() => ({ runStreamed }));
    class FakeCodex { startThread = startThread; resumeThread = resumeThread; }
    const provider = new CodexProvider({ Codex: FakeCodex as any });

    const result = await provider.run({
      task: 'continue',
      cwd: '/repo',
      threadId: '019df6e5-5f84-7241-bd15-516a3e9704fc',
      sandboxMode: 'workspace-write',
      reasoningEffort: 'medium'
    });

    expect(resumeThread).toHaveBeenCalledWith('019df6e5-5f84-7241-bd15-516a3e9704fc', expect.objectContaining({ sandboxMode: 'workspace-write' }));
    expect(startThread).not.toHaveBeenCalled();
    expect(result.finalResponse).toBe('continued');
  });
});
