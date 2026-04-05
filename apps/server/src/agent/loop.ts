import { nanoid } from 'nanoid';
import type { ChatMessage, ToolCall } from '@opendispatch/shared';
import { TOOL_DEFINITIONS } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import { executeTool } from '../tools/executor.js';
import { EventEmitter } from 'node:events';

const MAX_STEPS = 25;

const SYSTEM_PROMPT = `You are OpenDispatch, a local AI assistant that executes tasks by using tools. You run on macOS and have access to shell commands, file operations, web fetching, browser automation, and desktop screen control.

CRITICAL — how to make progress:
- Each turn, you MUST advance toward completing the task. Do NOT repeat actions you already took.
- After exploring/listing files, MOVE ON to the next step — read the actual files, make changes, produce output.
- Do NOT re-list or re-explore directories you have already seen. The results are in the conversation above — refer to them.
- Gather just enough context, then ACT. For a code review: list files once, then read the important ones, then write your review and call task_complete.
- Keep your text responses SHORT (1-2 sentences). Spend your turns on tool calls, not narration.
- When you have enough information to complete the task, call task_complete IMMEDIATELY with your full result.

Tools:
- shell_exec — run commands, builds, git operations
- file_read — read file contents (read code before modifying it)
- file_write — create or update files
- file_list / file_search — explore the codebase (do this ONCE, not repeatedly)
- web_fetch — HTTP requests to URLs or APIs
- browser_navigate — automate a real Chromium browser for web tasks (no vision model, fast)
- screen_control — control macOS desktop via vision model (slow, use only for native apps or CAPTCHAs)
- task_complete — CALL THIS when done, with your full result as the "result" parameter

Do not ask for clarification — make reasonable assumptions and proceed.`;

export interface AgentContext {
  taskId: string;
  model: string;
  workingDirectory: string;
  events: EventEmitter;
  abortSignal?: AbortSignal;
  pauseSignal?: PauseController;
}

export class PauseController {
  private _paused = false;
  private _resolveResume: (() => void) | null = null;

  get paused() { return this._paused; }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
    if (this._resolveResume) {
      this._resolveResume();
      this._resolveResume = null;
    }
  }

  async waitIfPaused(): Promise<void> {
    if (!this._paused) return;
    return new Promise<void>((resolve) => {
      this._resolveResume = resolve;
    });
  }
}

export interface AgentStepEvent {
  taskId: string;
  stepNumber: number;
  type: 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export interface AgentResult {
  status: 'completed' | 'failed' | 'max_steps' | 'cancelled';
  result?: string;
  error?: string;
  steps: number;
}

export async function runAgentLoop(prompt: string, ctx: AgentContext): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  let stepNumber = 0;
  const recentToolCalls: string[] = []; // track recent calls for loop detection

  for (let i = 0; i < MAX_STEPS; i++) {
    if (ctx.abortSignal?.aborted) {
      return { status: 'cancelled', steps: stepNumber };
    }

    // Wait if paused
    if (ctx.pauseSignal?.paused) {
      ctx.events.emit('paused', { taskId: ctx.taskId });
      await ctx.pauseSignal.waitIfPaused();
      ctx.events.emit('resumed', { taskId: ctx.taskId });
    }

    const response = await chatCompletion({
      model: ctx.model,
      messages,
      tools: TOOL_DEFINITIONS,
    });

    // Emit assistant message
    if (response.content) {
      stepNumber++;
      emitStep(ctx, {
        taskId: ctx.taskId,
        stepNumber,
        type: 'assistant',
        content: response.content,
      });
    }

    // No tool calls — model is done
    if (!response.toolCalls.length) {
      return {
        status: 'completed',
        result: response.content || 'Task completed (no output)',
        steps: stepNumber,
      };
    }

    // Build assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls,
    });

    // Loop detection: check if we're repeating the same tool calls
    const callSignatures = response.toolCalls.map(tc => `${tc.function.name}:${tc.function.arguments}`);
    const isLoop = callSignatures.some(sig => recentToolCalls.filter(s => s === sig).length >= 2);

    if (isLoop) {
      // Model is stuck — inject a nudge and skip executing the duplicate calls
      messages.push({
        role: 'user',
        content: `STOP: You are repeating tool calls you already made. You are stuck in a loop. The results from previous calls are already in the conversation above — use them. Either: (1) move to the NEXT step of the task using DIFFERENT tools or arguments, (2) produce your final output, or (3) call task_complete with what you have so far. Do NOT repeat the same action again.`,
      });
      recentToolCalls.length = 0; // reset so we give it a fresh chance
      continue; // skip to next iteration of the outer loop
    }

    recentToolCalls.push(...callSignatures);
    while (recentToolCalls.length > 10) recentToolCalls.shift();

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      if (ctx.abortSignal?.aborted) {
        return { status: 'cancelled', steps: stepNumber };
      }

      if (ctx.pauseSignal?.paused) {
        ctx.events.emit('paused', { taskId: ctx.taskId });
        await ctx.pauseSignal.waitIfPaused();
        ctx.events.emit('resumed', { taskId: ctx.taskId });
      }

      stepNumber++;
      emitStep(ctx, {
        taskId: ctx.taskId,
        stepNumber,
        type: 'tool_call',
        content: toolCall.function.arguments,
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      });

      // Check for task_complete
      if (toolCall.function.name === 'task_complete') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          return {
            status: 'completed',
            result: args.result || 'Task completed',
            steps: stepNumber,
          };
        } catch {
          return { status: 'completed', result: 'Task completed', steps: stepNumber };
        }
      }

      const result = await executeTool(toolCall, ctx.workingDirectory);

      stepNumber++;
      emitStep(ctx, {
        taskId: ctx.taskId,
        stepNumber,
        type: 'tool_result',
        content: result.output || result.error || '(empty)',
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      });

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  return { status: 'max_steps', result: 'Reached maximum step limit', steps: stepNumber };
}

function emitStep(ctx: AgentContext, step: AgentStepEvent) {
  ctx.events.emit('step', step);
}
