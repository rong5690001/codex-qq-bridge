import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BridgeState, ProjectRuntimeState, RunStatus } from '../types.js';

function emptyState(): BridgeState {
  return { projects: {} };
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultProjectState(): ProjectRuntimeState {
  return { threadId: '', status: 'idle', updatedAt: nowIso() };
}

export class SessionStore {
  constructor(private readonly statePath: string) {}

  async read(): Promise<BridgeState> {
    let raw: string;
    try {
      raw = await readFile(this.statePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw error;
    }

    try {
      const parsed = JSON.parse(raw) as BridgeState;
      return { projects: parsed.projects ?? {} };
    } catch (error) {
      throw new Error(`Failed to parse bridge state at ${this.statePath}: ${(error as Error).message}`);
    }
  }

  async write(state: BridgeState): Promise<void> {
    await mkdir(dirname(this.statePath), { recursive: true });
    const tmpPath = `${this.statePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(tmpPath, this.statePath);
  }

  async getProject(project: string): Promise<ProjectRuntimeState> {
    const state = await this.read();
    return state.projects[project] ?? defaultProjectState();
  }

  async setThreadId(project: string, threadId: string): Promise<void> {
    const state = await this.read();
    const current = state.projects[project] ?? defaultProjectState();
    state.projects[project] = { ...current, threadId, updatedAt: nowIso() };
    await this.write(state);
  }

  async setRunStatus(project: string, runId: string, status: RunStatus): Promise<void> {
    const state = await this.read();
    const current = state.projects[project] ?? defaultProjectState();
    state.projects[project] = { ...current, lastRunId: runId, status, updatedAt: nowIso() };
    await this.write(state);
  }
}
