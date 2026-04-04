import { nanoid } from 'nanoid';
import type { ChatMessage, ToolCall } from '@opendispatch/shared';
import { TOOL_DEFINITIONS } from '@opendispatch/shared';
import { chatCompletion } from '../llm/completion.js';
import { executeTool } from '../tools/executor.js';
import { EventEmitter } from 'node:events';

const MAX_STEPS = 25;

const SYSTEM_PROMPT = `You are OpenDispatch, a local AI assistant that executes tasks by using tools. You have access to shell commands, file operations, and web fetching.

Guidelines:
- Break complex tasks into steps and execute them one at a time
- Use shell_exec for running commands, builds, git operations, etc.
- Use file_read to understand existing code before modifying it
- Use file_write to create or update files
- Use file_list and file_search to explore the codebase
- Use web_fetch to retrieve information from URLs
- When your task is complete, call task_complete with a summary of what you did
- Be concise in your reasoning — focus on actions, not explanations
- If a command fails, diagnose the error and try a different approach
- Do not ask for clarification — make reasonable assumptions and proceed`;

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
