export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  model: string | null;
  preferredModel: string | null;
  workingDirectory: string | null;
  createdAt: number;
  updatedAt: number;
  result: string | null;
  error: string | null;
}

export interface TaskStep {
  id: string;
  taskId: string;
  stepNumber: number;
  type: 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  createdAt: number;
}

export interface CreateTaskInput {
  prompt: string;
  model?: string;
  workingDirectory?: string;
}

// ── Conversations (chat mode) ──

export interface Conversation {
  id: string;
  title: string;
  model: string | null;
  workingDirectory: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  createdAt: number;
}

export interface CreateConversationInput {
  title?: string;
  model?: string;
  workingDirectory?: string;
}

export interface SendMessageInput {
  content: string;
}
