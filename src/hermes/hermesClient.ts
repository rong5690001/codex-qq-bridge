import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { IncomingMessage } from '../types.js';

type HermesToolName = 'events_wait' | 'events_poll' | 'messages_send';

type HermesToolMap = Record<HermesToolName, string>;

export class HermesClient {
  private client: Client | null = null;
  private tools: Partial<HermesToolMap> = {};
  private cursor = 0;

  constructor(private readonly server: { command: string; args: string[] }) {}

  async connect(): Promise<void> {
    const transport = new StdioClientTransport({ command: this.server.command, args: this.server.args });
    const client = new Client({ name: 'codex-qq-bridge', version: '0.1.0' });
    await client.connect(transport);
    this.client = client;
    await this.probeTools();
  }

  async probeTools(): Promise<void> {
    const client = this.requireClient();
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    this.tools.events_wait = names.find((name) => name === 'events_wait');
    this.tools.events_poll = names.find((name) => name === 'events_poll');
    this.tools.messages_send = names.find((name) => name === 'messages_send');

    if (!this.tools.messages_send) throw new Error(`Hermes MCP tool messages_send not found. Available tools: ${names.join(', ')}`);
    if (!this.tools.events_wait && !this.tools.events_poll) {
      throw new Error(`Hermes MCP tool events_wait/events_poll not found. Available tools: ${names.join(', ')}`);
    }
  }

  async waitMessages(): Promise<IncomingMessage[]> {
    const client = this.requireClient();
    const toolName = this.tools.events_wait ?? this.tools.events_poll;
    if (!toolName) throw new Error('Hermes event tool is not available.');
    const result = await client.callTool({ name: toolName, arguments: { after_cursor: this.cursor, timeout_ms: 30000, limit: 20 } });
    const cursor = readNextCursor(result);
    if (cursor > this.cursor) this.cursor = cursor;
    return normalizeIncomingMessages(result);
  }

  async sendMessage(conversationId: string, text: string): Promise<void> {
    const client = this.requireClient();
    const toolName = this.tools.messages_send;
    if (!toolName) throw new Error('Hermes messages_send tool is not available.');
    await client.callTool({ name: toolName, arguments: { target: conversationId, message: text } });
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('Hermes client is not connected.');
    return this.client;
  }
}

export function normalizeIncomingMessages(result: unknown): IncomingMessage[] {
  const candidates = collectObjects(result);
  const messages: IncomingMessage[] = [];
  for (const candidate of candidates) {
    const currentEvent = normalizeCurrentMessageEvent(candidate);
    if (currentEvent) {
      messages.push(currentEvent);
      continue;
    }

    const text = readString(candidate, ['text', 'content', 'message', 'body']);
    const conversationId = readString(candidate, ['conversation_id', 'conversationId', 'channel_id', 'chat_id', 'chatId']);
    const senderId = readString(candidate, ['sender_id', 'senderId', 'user_id', 'userId', 'author_id', 'authorId']);
    if (!text || !conversationId || !senderId) continue;
    messages.push({
      id: readString(candidate, ['id', 'message_id', 'messageId', 'event_id', 'eventId']) || `${conversationId}:${Date.now()}:${messages.length}`,
      conversationId,
      senderId,
      groupId: readString(candidate, ['group_id', 'groupId', 'guild_id', 'guildId']) || undefined,
      text
    });
  }
  return messages;
}

function normalizeCurrentMessageEvent(candidate: Record<string, unknown>): IncomingMessage | null {
  if (candidate.type !== 'message' || candidate.role !== 'user') return null;
  const text = readString(candidate, ['content', 'text', 'message', 'body']);
  const sessionKey = readString(candidate, ['session_key', 'sessionKey']);
  if (!text || !sessionKey) return null;

  const target = targetFromSessionKey(sessionKey);
  if (!target) return null;

  return {
    id: readString(candidate, ['message_id', 'messageId', 'id', 'event_id', 'eventId']) || `${target}:${readString(candidate, ['cursor']) || Date.now()}`,
    conversationId: target.conversationId,
    senderId: target.senderId,
    groupId: target.groupId,
    text
  };
}

function targetFromSessionKey(sessionKey: string): { conversationId: string; senderId: string; groupId?: string } | null {
  const parts = sessionKey.split(':');
  const platform = parts[2];
  const kind = parts[3];
  const id = parts.slice(4).join(':');
  if (!platform || !kind || !id) return null;

  if (kind === 'dm') return { conversationId: `${platform}:${id}`, senderId: id };
  return { conversationId: `${platform}:${id}`, senderId: id, groupId: id };
}

function readNextCursor(result: unknown): number {
  let nextCursor = 0;
  for (const candidate of collectObjects(result)) {
    const value = candidate.next_cursor ?? candidate.nextCursor;
    if (typeof value === 'number' && value > nextCursor) nextCursor = value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > nextCursor) nextCursor = parsed;
    }
  }
  return nextCursor;
}

function readString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function collectObjects(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(collectObjects);
  const obj = value as Record<string, unknown>;
  const content = obj.content;
  if (Array.isArray(content)) {
    const textObjects = content.flatMap((item) => {
      if (item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text') {
        const text = (item as Record<string, unknown>).text;
        if (typeof text === 'string') {
          try {
            return collectObjects(JSON.parse(text));
          } catch {
            return [{ text }];
          }
        }
      }
      return collectObjects(item);
    });
    return [obj, ...textObjects];
  }
  return [obj, ...Object.values(obj).flatMap(collectObjects)];
}
