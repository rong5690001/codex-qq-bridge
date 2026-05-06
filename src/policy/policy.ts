import type { BridgeConfig } from '../types.js';

export type PolicyInput = {
  senderId: string;
  groupId?: string;
  text: string;
  project?: string;
};

export type PolicyResult = { allowed: true } | { allowed: false; reason: string };

const DANGEROUS_PATTERNS = [
  /sudo\b/i,
  /rm\s+-rf\s+\//i,
  /\.env\b/i,
  /token/i,
  /api[_-]?key/i,
  /password/i
];

export function validateMessagePolicy(input: PolicyInput, config: BridgeConfig): PolicyResult {
  const userAllowed = config.allowedUsers.includes(input.senderId);
  const groupAllowed = input.groupId ? config.allowedGroups.includes(input.groupId) : false;
  if (!userAllowed && !groupAllowed) return { allowed: false, reason: 'Sender is not whitelisted.' };

  if (input.project && !config.projects[input.project]) {
    return { allowed: false, reason: `Unknown project: ${input.project}` };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input.text)) {
      return { allowed: false, reason: `Request contains a blocked dangerous pattern: ${pattern.toString()}` };
    }
  }

  return { allowed: true };
}

export function createRunLock() {
  const activeProjects = new Set<string>();
  return {
    acquire(project: string): boolean {
      if (activeProjects.has(project)) return false;
      activeProjects.add(project);
      return true;
    },
    release(project: string): void {
      activeProjects.delete(project);
    },
    isActive(project: string): boolean {
      return activeProjects.has(project);
    },
    active(): string[] {
      return [...activeProjects];
    }
  };
}
