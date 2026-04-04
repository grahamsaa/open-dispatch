import { nanoid } from 'nanoid';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import { db, conversations, conversationMessages } from '@opendispatch/db';
import { routeTask } from '@opendispatch/shared';
import { runChatTurn, type ChatStepEvent } from '../agent/chat.js';
import type { Conversation, ConversationMessage, CreateConversationInput, ChatMessage } from '@opendispatch/shared';
import { homedir } from 'node:os';

export class ConversationManager extends EventEmitter {
  async create(input: CreateConversationInput): Promise<Conversation> {
    const now = Date.now();
    const routing = routeTask({ preferredModel: input.model, complexity: 'medium' });

    const conv: Conversation = {
      id: nanoid(),
      title: input.title || 'New Conversation',
      model: routing.modelId,
      workingDirectory: input.workingDirectory || homedir(),
      createdAt: now,
      updatedAt: now,
    };

    db.insert(conversations).values({
      id: conv.id,
      title: conv.title,
      model: conv.model,
      workingDirectory: conv.workingDirectory,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }).run();

    this.emit('conversation:created', conv);
    return conv;
  }

  async get(id: string): Promise<Conversation | undefined> {
    const row = db.select().from(conversations).where(eq(conversations.id, id)).get();
    return row as Conversation | undefined;
  }

  async list(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(conversations.updatedAt).all() as Conversation[];
  }

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    return db.select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt)
      .all() as ConversationMessage[];
  }

  async sendMessage(conversationId: string, content: string): Promise<string> {
    const conv = await this.get(conversationId);
    if (!conv) throw new Error('Conversation not found');

    // Save user message
    const userMsgId = nanoid();
    db.insert(conversationMessages).values({
      id: userMsgId,
      conversationId,
      role: 'user',
      content,
      toolName: null,
      toolCallId: null,
      createdAt: Date.now(),
    }).run();

    this.emit('conversation:message', {
      conversationId,
      id: userMsgId,
      role: 'user',
      content,
    });

    // Build message history for the LLM
    const dbMessages = await this.getMessages(conversationId);
    const history = this.buildChatHistory(dbMessages.slice(0, -1)); // exclude the message we just inserted (it's passed separately)

    const events = new EventEmitter();

    events.on('chat:step', (step: ChatStepEvent) => {
      const msgId = nanoid();
      db.insert(conversationMessages).values({
        id: msgId,
        conversationId: step.conversationId,
        role: step.type,
        content: step.content,
        toolName: step.toolName || null,
        toolCallId: step.toolCallId || null,
        createdAt: Date.now(),
      }).run();

      this.emit('conversation:message', {
        conversationId: step.conversationId,
        id: msgId,
        role: step.type,
        content: step.content,
        toolName: step.toolName,
        toolCallId: step.toolCallId,
      });
    });

    const response = await runChatTurn(history, content, {
      conversationId,
      model: conv.model || 'qwen3.5-122b-a10b',
      workingDirectory: conv.workingDirectory || homedir(),
      events,
    });

    // Update conversation title from first message if it's still "New Conversation"
    if (conv.title === 'New Conversation' && dbMessages.length <= 1) {
      const title = content.slice(0, 80) + (content.length > 80 ? '...' : '');
      db.update(conversations).set({ title, updatedAt: Date.now() }).where(eq(conversations.id, conversationId)).run();
    } else {
      db.update(conversations).set({ updatedAt: Date.now() }).where(eq(conversations.id, conversationId)).run();
    }

    return response;
  }

  async delete(id: string): Promise<void> {
    db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id)).run();
    db.delete(conversations).where(eq(conversations.id, id)).run();
    this.emit('conversation:deleted', { id });
  }

  private buildChatHistory(messages: ConversationMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        result.push({ role: 'assistant', content: msg.content });
      } else if (msg.role === 'tool_result' && msg.toolCallId) {
        result.push({ role: 'tool', content: msg.content, tool_call_id: msg.toolCallId });
      }
      // tool_call messages are reconstructed by the assistant message's tool_calls
    }
    return result;
  }
}

export const conversationManager = new ConversationManager();
