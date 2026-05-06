export function truncateReply(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 80))}\n\n[已截断，完整内容请查看本机 run 日志]`;
}

export function formatSession(project: string, threadId: string): string {
  if (!threadId) return `项目 ${project} 还没有绑定 Codex thread。发送任务或使用 /codex attach ${project} <threadId>。`;
  return [
    `项目 ${project} 的 Codex threadId：`,
    threadId,
    '',
    '可在 Codex App/CLI 中用该 threadId 手动 resume。',
    '请不要同时从 App/CLI 和 QQ bridge 操作同一个 threadId。'
  ].join('\n');
}
