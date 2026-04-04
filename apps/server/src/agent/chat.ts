import type { ChatMessage, ToolCall } from '@opendispatch/shared';
import { TOOL_DEFINITIONS } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import { executeTool } from '../tools/executor.js';
import { EventEmitter } from 'node:events';

const MAX_TOOL_ROUNDS = 10;

const CHAT_SYSTEM_PROMPT = `You are OpenDispatch, a local AI assistant running on a macOS machine. You have access to shell commands, file operations, web fetching, browser automation, and desktop screen control.

You are in conversation mode — the user is chatting with you interactively. Respond naturally and use tools when helpful. You don't need to call task_complete in chat mode.

Guidelines:
- Use tools proactively when they'd help answer the user's question
- Be conversational but concise
- If the user asks you to do something, do it — don't just describe what you would do
- Use file_read before modifying files
- Use browser_navigate for web tasks (searching, form filling, data extraction). It opens a real Chromium browser and is fast with no vision model.
- Use screen_control for non-browser desktop tasks or when browser automation can't handle it (CAPTCHAs, auth flows, native apps).
- If a command fails, explain what went wrong and try alternatives`;

export interface ChatContext {
  conversationId: string;
  model: string;
  workingDirectory: string;
  events: EventEmitter;
}

export interface ChatStepEvent {
  conversationId: string;
  type: 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export async function runChatTurn(
  history: ChatMessage[],
  userMessage: string,
  ctx: ChatContext,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  // Allow multiple tool rounds per user message
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatCompletion({
      model: ctx.model,
      messages,
      tools: TOOL_DEFINITIONS.filter(t => t.function.name !== 'task_complete'),
    });

    // No tool calls — return the final response
    if (!response.toolCalls.length) {
      const content = response.content || '';
      ctx.events.emit('chat:step', {
        conversationId: ctx.conversationId,
        type: 'assistant',
        content,
      } satisfies ChatStepEvent);
      return content;
    }

    // Has tool calls — execute them and continue
    if (response.content) {
      ctx.events.emit('chat:step', {
        conversationId: ctx.conversationId,
        type: 'assistant',
        content: response.content,
      } satisfies ChatStepEvent);
    }

    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls,
    });

    for (const toolCall of response.toolCalls) {
      ctx.events.emit('chat:step', {
        conversationId: ctx.conversationId,
        type: 'tool_call',
        content: toolCall.function.arguments,
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      } satisfies ChatStepEvent);

      const result = await executeTool(toolCall, ctx.workingDirectory);

      ctx.events.emit('chat:step', {
        conversationId: ctx.conversationId,
        type: 'tool_result',
        content: result.output || result.error || '(empty)',
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      } satisfies ChatStepEvent);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  return 'Reached maximum tool rounds for this message.';
}
