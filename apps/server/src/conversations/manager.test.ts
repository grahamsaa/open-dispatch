import { describe, it, expect } from 'vitest';
import { conversationManager } from './manager.js';

describe('ConversationManager', () => {
  it('creates a conversation with defaults', async () => {
    const conv = await conversationManager.create({});
    expect(conv.id).toBeTruthy();
    expect(conv.title).toBe('New Conversation');
    expect(conv.model).toBeTruthy();
    expect(conv.createdAt).toBeGreaterThan(0);
  });

  it('creates a conversation with custom title', async () => {
    const conv = await conversationManager.create({ title: 'My Chat' });
    expect(conv.title).toBe('My Chat');
  });

  it('retrieves a conversation by ID', async () => {
    const created = await conversationManager.create({ title: 'Get Test' });
    const fetched = await conversationManager.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
  });

  it('returns undefined for nonexistent conversation', async () => {
    const conv = await conversationManager.get('nonexistent-id');
    expect(conv).toBeUndefined();
  });

  it('lists conversations', async () => {
    const conv = await conversationManager.create({ title: 'List Test' });
    const list = await conversationManager.list();
    expect(list.some(c => c.id === conv.id)).toBe(true);
  });

  it('gets empty messages for new conversation', async () => {
    const conv = await conversationManager.create({});
    const messages = await conversationManager.getMessages(conv.id);
    expect(messages).toEqual([]);
  });

  it('deletes a conversation and its messages', async () => {
    const conv = await conversationManager.create({ title: 'Delete Test' });
    await conversationManager.delete(conv.id);

    const deleted = await conversationManager.get(conv.id);
    expect(deleted).toBeUndefined();
  });

  it('respects model preference', async () => {
    const conv = await conversationManager.create({ model: 'llama-3.3-70b' });
    expect(conv.model).toBe('llama-3.3-70b');
  });

  it('respects working directory', async () => {
    const conv = await conversationManager.create({ workingDirectory: '/tmp/chat' });
    expect(conv.workingDirectory).toBe('/tmp/chat');
  });
});
