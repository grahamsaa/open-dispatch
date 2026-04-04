import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
  }).notNull().default('pending'),
  model: text('model'),
  preferredModel: text('preferred_model'),
  workingDirectory: text('working_directory'),
  result: text('result'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const taskSteps = sqliteTable('task_steps', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  stepNumber: integer('step_number').notNull(),
  type: text('type', {
    enum: ['assistant', 'tool_call', 'tool_result'],
  }).notNull(),
  content: text('content').notNull(),
  toolName: text('tool_name'),
  toolCallId: text('tool_call_id'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  model: text('model'),
  workingDirectory: text('working_directory'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const conversationMessages = sqliteTable('conversation_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  role: text('role', {
    enum: ['user', 'assistant', 'tool_call', 'tool_result'],
  }).notNull(),
  content: text('content').notNull(),
  toolName: text('tool_name'),
  toolCallId: text('tool_call_id'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
});
