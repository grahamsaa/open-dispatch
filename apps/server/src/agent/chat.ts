import type { ChatMessage, ToolCall, ToolDefinition } from '@opendispatch/shared';
import { TOOL_DEFINITIONS, CHAT_EXTRA_TOOLS } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import { executeTool } from '../tools/executor.js';
import { executeChatTool } from '../tools/chat-tools.js';
import { getRelevantSkills } from '../skills/loader.js';
import { EventEmitter } from 'node:events';

const MAX_TOOL_ROUNDS = 10;

// Chat tools = all standard tools (minus task_complete) + chat-specific tools
const CHAT_TOOLS: ToolDefinition[] = [
  ...TOOL_DEFINITIONS.filter(t => t.function.name !== 'task_complete'),
  ...CHAT_EXTRA_TOOLS,
];

const CHAT_SYSTEM_PROMPT = `You are OpenDispatch, a local AI assistant running on a macOS machine. The user is chatting with you from their iPad. You have tools to do work directly AND to dispatch background tasks.

WHEN TO USE BACKGROUND TASKS vs DIRECT TOOLS:
- If the user wants something quick (read a file, run a command, answer a question) — do it directly with tools.
- If the user wants something that will take many steps or a long time (code review, refactoring, test suite, data extraction, build) — use dispatch_background_task so they can keep chatting while it runs.
- If the user says "run this in the background", "dispatch this", or similar — always use dispatch_background_task.
- If the user asks about a running task — use check_task_status.
- If the user asks to switch models or change context window — use load_model.

NATURAL LANGUAGE MODEL/CONTEXT PARSING:
When the user mentions a model or context window in their message, extract it:
- "use qwen3.5 with 64k context" → model: "qwen3.5-122b-a10b", contextLength: 65536
- "use the big model" or "use the full model" → model: "qwen3.5-122b"
- "use the fast model" or "use the small model" → model: "qwen3.5-9b-mlx"
- "use gemma" → model: "gemma-4-31b-it@q8_0"
- "use llama" → model: "llama-3.3-70b"
- "128k context" → contextLength: 131072
- "max context" → contextLength: 262144
- If they don't specify, leave model/contextLength empty (uses current defaults).

LEARNING FROM EXPERIENCE:
- After completing a browser/app task (success OR failure), ALWAYS call skill_update to record what you learned.
- Record specific selectors that worked or failed, URLs, timing issues, workarounds.
- This improves the skill for next time. Even failures are valuable learning.
- Example: skill_update({skill: "gmail", entry: "div[aria-label='Select'] checkbox works for select-all in search results", type: "success"})
- Example: skill_update({skill: "gmail", entry: "document.querySelector('span.T-Jo-auh') no longer exists in current Gmail", type: "selector_update"})

PROGRESS RULES:
- Each turn, ADVANCE. Do NOT repeat tool calls.
- After exploring files, MOVE ON — read them, then answer.
- Keep text SHORT. Act, don't narrate.
- If you have enough info, answer directly without more tools.
- For browser tasks, prefer browser_script with specific JS over browser_navigate when you know the exact DOM operations needed.

Available tools: shell_exec, file_read, file_write, file_list, file_search, web_fetch, browser_navigate, browser_get_page, browser_script, browser_status, screen_control, dispatch_background_task, check_task_status, list_background_tasks, load_model, skill_update.`;

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
  // Check for relevant skills based on the user's message
  const skillDocs = getRelevantSkills(userMessage);
  const skillPrompt = skillDocs.length > 0
    ? `\n\nRELEVANT SKILLS (follow these step-by-step instructions):\n${skillDocs.join('\n\n---\n\n')}`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT + skillPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const recentToolCalls: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatCompletion({
      model: ctx.model,
      messages,
      tools: CHAT_TOOLS,
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
        content: `STOP: You are repeating the same tool calls. The results are already above. Answer the user directly now.`,
      });
      recentToolCalls.length = 0;
      continue;
    }
    recentToolCalls.push(...callSignatures);
    while (recentToolCalls.length > 10) recentToolCalls.shift();

    // Emit assistant text if any
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

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      ctx.events.emit('chat:step', {
        conversationId: ctx.conversationId,
        type: 'tool_call',
        content: toolCall.function.arguments,
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      } satisfies ChatStepEvent);

      // Try chat-specific tools first, fall back to regular executor
      let result = await executeChatTool(toolCall);
      if (!result) {
        result = await executeTool(toolCall, ctx.workingDirectory);
      }

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
