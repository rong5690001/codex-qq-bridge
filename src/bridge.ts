import { join, resolve } from 'node:path';
import { CodexProvider } from './codex/codexProvider.js';
import { formatSession, truncateReply } from './format.js';
import type { HermesClient } from './hermes/hermesClient.js';
import { parseCommand } from './messageParser.js';
import { createRunLock, validateMessagePolicy } from './policy/policy.js';
import { createRunId } from './runId.js';
import { RunLog } from './runLog.js';
import { SessionStore } from './store/sessionStore.js';
import type { BridgeConfig, IncomingMessage, ParsedCommand } from './types.js';

export class BridgeApp {
  private readonly lock = createRunLock();

  constructor(
    private readonly config: BridgeConfig,
    private readonly store: SessionStore,
    private readonly hermes: Pick<HermesClient, 'sendMessage'>,
    private readonly codex: CodexProvider,
    private readonly runsDir: string
  ) {}

  async handleMessage(message: IncomingMessage): Promise<void> {
    const parsed = parseCommand(message.text, this.config.commandPrefix);
    if (parsed.kind === 'ignored') return;

    const project = projectOf(parsed);
    const policy = validateMessagePolicy({ senderId: message.senderId, groupId: message.groupId, text: message.text, project }, this.config);
    if (!policy.allowed) {
      await this.hermes.sendMessage(message.conversationId, policy.reason);
      return;
    }

    if (parsed.kind === 'invalid') {
      await this.hermes.sendMessage(message.conversationId, parsed.reason);
      return;
    }

    await this.dispatch(parsed, message);
  }

  async statusText(): Promise<string> {
    const active = this.lock.active();
    if (active.length === 0) return '当前没有正在运行的 Codex 任务。';
    return `正在运行：${active.join(', ')}`;
  }

  private async dispatch(command: Exclude<ParsedCommand, { kind: 'ignored' | 'invalid' }>, message: IncomingMessage): Promise<void> {
    if (command.kind === 'status') {
      await this.hermes.sendMessage(message.conversationId, await this.statusText());
      return;
    }

    const projectConfig = this.config.projects[command.project];
    if (!projectConfig) {
      await this.hermes.sendMessage(message.conversationId, `Unknown project: ${command.project}`);
      return;
    }

    if (command.kind === 'session') {
      const stored = await this.store.getProject(command.project);
      await this.hermes.sendMessage(message.conversationId, formatSession(command.project, stored.threadId || projectConfig.threadId));
      return;
    }

    if (command.kind === 'attach') {
      await this.store.setThreadId(command.project, command.threadId);
      await this.hermes.sendMessage(message.conversationId, `已绑定 ${command.project} 到 Codex thread：${command.threadId}\n请不要同时从 App/CLI 和 QQ bridge 操作该 thread。`);
      return;
    }

    if (command.kind === 'new') {
      await this.store.setThreadId(command.project, '');
      await this.hermes.sendMessage(message.conversationId, `已清空 ${command.project} 的 threadId，下一次任务会创建新 Codex thread。`);
      return;
    }

    await this.runCodex(command.project, command.task, message);
  }

  private async runCodex(project: string, task: string, message: IncomingMessage): Promise<void> {
    if (!this.lock.acquire(project)) {
      await this.hermes.sendMessage(message.conversationId, `${project} 已有任务正在运行，请稍后再试。`);
      return;
    }

    const runId = createRunId();
    const runLog = new RunLog({ runsDir: this.runsDir, runId, message });
    await runLog.init(message);
    await this.store.setRunStatus(project, runId, 'running');
    await this.hermes.sendMessage(message.conversationId, `已接收任务，runId=${runId}`);

    try {
      const projectConfig = this.config.projects[project];
      const stored = await this.store.getProject(project);
      const result = await this.codex.run({
        task: `[Remote QQ message from allowed sender ${message.senderId}]\n${task}`,
        cwd: projectConfig.cwd,
        threadId: stored.threadId || projectConfig.threadId,
        sandboxMode: this.config.defaultSandbox,
        reasoningEffort: this.config.defaultReasoningEffort
      });
      await this.store.setThreadId(project, result.threadId);
      await this.store.setRunStatus(project, runId, 'completed');
      await runLog.writeEvents(result.events);
      await runLog.writeFinal(result);

      const reply = [
        `任务完成：${project}`,
        `runId=${runId}`,
        `threadId=${result.threadId}`,
        `修改文件：${result.changedFiles ? '是' : '未检测到'}`,
        `日志：${resolve(join(this.runsDir, runId))}`,
        '',
        result.finalResponse || '(Codex 未返回文本摘要)'
      ].join('\n');
      await this.hermes.sendMessage(message.conversationId, truncateReply(reply, this.config.replyMaxChars));
    } catch (error) {
      await this.store.setRunStatus(project, runId, 'failed');
      await runLog.writeError(error);
      const errorText = error instanceof Error ? error.message : String(error);
      await this.hermes.sendMessage(message.conversationId, truncateReply(`任务失败：${project}\nrunId=${runId}\n错误：${errorText}\n日志：${resolve(join(this.runsDir, runId))}`, this.config.replyMaxChars));
    } finally {
      this.lock.release(project);
    }
  }
}

function projectOf(command: ParsedCommand): string | undefined {
  if ('project' in command) return command.project;
  return undefined;
}
