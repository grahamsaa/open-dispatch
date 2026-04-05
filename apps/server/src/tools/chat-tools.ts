import type { ToolCall, ToolResult } from '@opendispatch/shared';
import { taskManager } from '../queue/manager.js';
import { loadModel } from '../llm/models.js';

export async function executeChatTool(call: ToolCall): Promise<ToolResult | null> {
  const name = call.function.name;
  let args: Record<string, unknown>;

  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return { success: false, output: '', error: `Invalid JSON arguments: ${call.function.arguments}` };
  }

  switch (name) {
    case 'dispatch_background_task':
      return await dispatchTask(args);
    case 'check_task_status':
      return await checkTaskStatus(args);
    case 'list_background_tasks':
      return await listTasks();
    case 'load_model':
      return await handleLoadModel(args);
    default:
      return null; // Not a chat tool — let the regular executor handle it
  }
}

async function dispatchTask(args: Record<string, unknown>): Promise<ToolResult> {
  const prompt = args.prompt as string;
  if (!prompt) return { success: false, output: '', error: 'prompt is required' };

  const model = (args.model as string) || undefined;
  const contextLength = args.contextLength as number | undefined;
  const workingDirectory = (args.workingDirectory as string) || undefined;

  // If a specific model + context was requested, load it first
  if (model && contextLength) {
    const loadResult = await loadModel(model, contextLength);
    if (!loadResult.ok) {
      return { success: false, output: '', error: `Failed to load model: ${loadResult.message}` };
    }
  } else if (model) {
    // Load the model with whatever context is already set
    const loadResult = await loadModel(model);
    if (!loadResult.ok) {
      return { success: false, output: '', error: `Failed to load model: ${loadResult.message}` };
    }
  }

  const task = await taskManager.createTask({ prompt, model, workingDirectory });

  return {
    success: true,
    output: JSON.stringify({
      taskId: task.id,
      status: task.status,
      model: task.model,
      message: `Background task dispatched. Task ID: ${task.id}. Use check_task_status to monitor progress.`,
    }),
  };
}

async function checkTaskStatus(args: Record<string, unknown>): Promise<ToolResult> {
  const taskId = args.taskId as string;
  if (!taskId) return { success: false, output: '', error: 'taskId is required' };

  const task = await taskManager.getTask(taskId);
  if (!task) return { success: false, output: '', error: `Task ${taskId} not found` };

  const steps = await taskManager.getTaskSteps(taskId);

  const info: Record<string, unknown> = {
    taskId: task.id,
    status: task.status,
    model: task.model,
    prompt: task.prompt.slice(0, 200),
    stepCount: steps.length,
  };

  if (task.result) info.result = task.result;
  if (task.error) info.error = task.error;

  // Show last few steps for context
  if (steps.length > 0) {
    info.recentSteps = steps.slice(-5).map(s => ({
      type: s.type,
      tool: s.toolName,
      content: s.content.slice(0, 200),
    }));
  }

  return { success: true, output: JSON.stringify(info) };
}

async function listTasks(): Promise<ToolResult> {
  const tasks = await taskManager.listTasks();
  const summary = tasks.slice(-15).reverse().map(t => ({
    taskId: t.id,
    status: t.status,
    model: t.model,
    prompt: t.prompt.slice(0, 80),
  }));

  return {
    success: true,
    output: JSON.stringify({
      tasks: summary,
      total: tasks.length,
      active: tasks.filter(t => t.status === 'running' || t.status === 'pending').length,
    }),
  };
}

async function handleLoadModel(args: Record<string, unknown>): Promise<ToolResult> {
  const model = args.model as string;
  if (!model) return { success: false, output: '', error: 'model is required' };

  const contextLength = args.contextLength as number | undefined;
  const result = await loadModel(model, contextLength);

  return {
    success: result.ok,
    output: result.message,
    error: result.ok ? undefined : result.message,
  };
}
