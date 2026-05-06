import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type RunLogInput = {
  runsDir: string;
  runId: string;
  message: unknown;
};

export class RunLog {
  readonly dir: string;

  constructor(input: RunLogInput) {
    this.dir = join(input.runsDir, input.runId);
  }

  async init(message: unknown): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, 'message.json'), `${JSON.stringify(message, null, 2)}\n`, 'utf8');
  }

  async writeEvents(events: unknown[]): Promise<void> {
    const jsonl = events.map((event) => JSON.stringify(event)).join('\n');
    await writeFile(join(this.dir, 'events.jsonl'), jsonl ? `${jsonl}\n` : '', 'utf8');
  }

  async writeFinal(result: unknown): Promise<void> {
    await writeFile(join(this.dir, 'final.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  async writeError(error: unknown): Promise<void> {
    const message = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    await writeFile(join(this.dir, 'error.json'), `${JSON.stringify(message, null, 2)}\n`, 'utf8');
  }
}
