export type SandboxMode = 'workspace-write';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type ProjectConfig = {
  cwd: string;
  threadId: string;
  sharedWithCodexApp: boolean;
};

export type BridgeConfig = {
  hermes: { command: string; args: string[] };
  allowedUsers: string[];
  allowedGroups: string[];
  commandPrefix: string;
  defaultSandbox: SandboxMode;
  defaultReasoningEffort: ReasoningEffort;
  replyMaxChars: number;
  projects: Record<string, ProjectConfig>;
};

export type ParsedCommand =
  | { kind: 'ignored' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'run'; project: string; task: string }
  | { kind: 'status' }
  | { kind: 'session'; project: string }
  | { kind: 'new'; project: string }
  | { kind: 'attach'; project: string; threadId: string };

export type IncomingMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  groupId?: string;
  text: string;
};

export type RunStatus = 'idle' | 'running' | 'completed' | 'failed';

export type ProjectRuntimeState = {
  threadId: string;
  lastRunId?: string;
  status: RunStatus;
  updatedAt: string;
};

export type BridgeState = {
  projects: Record<string, ProjectRuntimeState>;
};
