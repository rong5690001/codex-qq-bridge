import { describe, expect, test } from 'vitest';
import { normalizeIncomingMessages } from '../src/hermes/hermesClient.js';

describe('normalizeIncomingMessages', () => {
  test('normalizes current Hermes message events', () => {
    const result = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          events: [{
            cursor: 12,
            type: 'message',
            session_key: 'agent:main:qqbot:dm:chat-1',
            role: 'user',
            content: 'cx status',
            message_id: 'msg-1'
          }],
          next_cursor: 12
        })
      }]
    };

    expect(normalizeIncomingMessages(result)).toEqual([{
      id: 'msg-1',
      conversationId: 'qqbot:chat-1',
      senderId: 'chat-1',
      text: 'cx status'
    }]);
  });

  test('ignores assistant events', () => {
    const result = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          events: [{
            cursor: 12,
            type: 'message',
            session_key: 'agent:main:qqbot:dm:chat-1',
            role: 'assistant',
            content: 'hello',
            message_id: 'msg-1'
          }]
        })
      }]
    };

    expect(normalizeIncomingMessages(result)).toEqual([]);
  });
});
