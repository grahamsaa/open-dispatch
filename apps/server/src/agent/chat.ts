import type { ChatMessage, ToolCall } from '@opendispatch/shared';
import { TOOL_DEFINITIONS } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import { executeTool } from '../tools/executor.js';
import { EventEmitter } from 'node:events';

const MAX_TOOL_ROUNDS = 10;

const CHAT_SYSTEM_PROMPT = `You are OpenDispatch, a local AI assistant running on a macOS machine. You have access to shell commands, file operations, web fetching, browser automation, and desktop screen control.

You are in conversation mode — the user is chatting with you interactively.

CRITICAL — how to make progress:
- Each turn, you MUST advance. Do NOT repeat tool calls you already made.
- After listing/exploring files, MOVE ON — read the actual files, then answer.
- Keep text responses SHORT. Use tools to gather info, then give a concise answer.
- Do NOT narrate what you plan to do — just do it.
- If you have enough information to answer, respond directly WITHOUT more tool calls.

Tools: shell_exec, file_read, file_write, file_list, file_search, web_fetch, browser_navigate, screen_control.
- Use browser_navigate for web tasks (fast, no vision model).
- Use screen_control only for native macOS apps or CAPTCHAs.
- Use file_read before modifying files.
- If a command fails, try an alternative.`;

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

  const recentToolCalls: string[] = [];

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

    // Loop detection
    const callSignatures = response.toolCalls.map(tc => `${tc.function.name}:${tc.function.arguments}`);
    const isLoop = callSignatures.some(sig => recentToolCalls.filter(s => s === sig).length >= 2);
    if (isLoop) {
      messages.push({
        role: 'user',
        content: `STOP: You are repeating the same tool calls. The results are already in the conversation above. Use them to answer the user's question directly. Do NOT call any more tools — just respond with your answer now.`,
      });
      recentToolCalls.length = 0;
      continue;
    }
    recentToolCalls.push(...callSignatures);
    while (recentToolCalls.length > 10) recentToolCalls.shift();

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
