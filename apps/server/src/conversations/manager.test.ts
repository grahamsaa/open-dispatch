import { describe, it, expect, afterEach } from 'vitest';
import { conversationManager } from './manager.js';

const createdIds: string[] = [];

afterEach(async () => {
  for (const id of createdIds) {
    await conversationManager.delete(id).catch(() => {});
  }
  createdIds.length = 0;
});

async function createAndTrack(input: { title?: string; model?: string; workingDirectory?: string }) {
  const conv = await conversationManager.create(input);
  createdIds.push(conv.id);
  return conv;
}

describe('ConversationManager', () => {
  it('creates a conversation with defaults', async () => {
    const conv = await createAndTrack({});
    expect(conv.id).toBeTruthy();
    expect(conv.title).toBe('New Conversation');
    expect(conv.model).toBeTruthy();
    expect(conv.createdAt).toBeGreaterThan(0);
  });

  it('creates a conversation with custom title', async () => {
    const conv = await createAndTrack({ title: 'My Chat' });
    expect(conv.title).toBe('My Chat');
  });

  it('retrieves a conversation by ID', async () => {
    const created = await createAndTrack({ title: 'Get Test' });
    const fetched = await conversationManager.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
  });

  it('returns undefined for nonexistent conversation', async () => {
    const conv = await conversationManager.get('nonexistent-id');
    expect(conv).toBeUndefined();
  });

  it('lists conversations', async () => {
    const conv = await createAndTrack({ title: 'List Test' });
    const list = await conversationManager.list();
    expect(list.some(c => c.id === conv.id)).toBe(true);
  });

  it('gets empty messages for new conversation', async () => {
    const conv = await createAndTrack({});
    const messages = await conversationManager.getMessages(conv.id);
    expect(messages).toEqual([]);
  });

  it('deletes a conversation and its messages', async () => {
    const conv = await createAndTrack({ title: 'Delete Test' });
    await conversationManager.delete(conv.id);
    createdIds.pop(); // already deleted

    const deleted = await conversationManager.get(conv.id);
    expect(deleted).toBeUndefined();
  });

  it('respects model preference', async () => {
    const conv = await createAndTrack({ model: 'llama-3.3-70b' });
    expect(conv.model).toBe('llama-3.3-70b');
  });

  it('respects working directory', async () => {
    const conv = await createAndTrack({ workingDirectory: '/tmp/chat' });
    expect(conv.workingDirectory).toBe('/tmp/chat');
  });
});
