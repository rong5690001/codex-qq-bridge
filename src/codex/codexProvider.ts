import { Codex as DefaultCodex } from '@openai/codex-sdk';
import type { ReasoningEffort, SandboxMode } from '../types.js';

export type CodexRunInput = {
  task: string;
  cwd: string;
  threadId: string;
  sandboxMode: SandboxMode;
  reasoningEffort: ReasoningEffort;
  model?: string;
};

export type CodexRunEvent = {
  type: string;
  raw: unknown;
  summary?: string;
};

export type CodexRunResult = {
  threadId: string;
  finalResponse: string;
  events: CodexRunEvent[];
  changedFiles: boolean;
};

type CodexCtor = new (...args: any[]) => any;

export class CodexProvider {
  private readonly Codex: CodexCtor;

  constructor(deps: { Codex?: CodexCtor } = {}) {
    this.Codex = deps.Codex ?? (DefaultCodex as unknown as CodexCtor);
  }

  async run(input: CodexRunInput): Promise<CodexRunResult> {
    const codex = new this.Codex();
    const isResume = input.threadId.trim().length > 0;
    const threadOptions: Record<string, unknown> = {
      sandboxMode: input.sandboxMode,
      approvalPolicy: 'never',
      modelReasoningEffort: input.reasoningEffort,
      skipGitRepoCheck: false,
      maxTurns: 200
    };

    if (input.model?.trim()) threadOptions.model = input.model.trim();
    if (!isResume) threadOptions.workingDirectory = input.cwd;

    const thread = isResume
      ? codex.resumeThread(input.threadId, threadOptions)
      : codex.startThread(threadOptions);

    const streamed = await thread.runStreamed(input.task);
    const events: CodexRunEvent[] = [];
    let threadId = input.threadId;
    let finalResponse = '';
    let changedFiles = false;

    for await (const event of streamed.events as AsyncIterable<any>) {
      if (event.type === 'thread.started' && typeof event.thread_id === 'string') {
        threadId = event.thread_id;
        events.push({ type: event.type, raw: event, summary: `thread ${threadId}` });
        continue;
      }

      if (event.type === 'item.completed') {
        const item = event.item;
        if (item?.type === 'agent_message' && typeof item.text === 'string') {
          finalResponse = item.text;
          events.push({ type: event.type, raw: event, summary: item.text });
          continue;
        }
        if (item?.type === 'file_change') changedFiles = true;
      }

      events.push({ type: event.type, raw: event });
    }

    return { threadId, finalResponse, events, changedFiles };
  }
}
