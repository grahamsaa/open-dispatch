import { nanoid } from 'nanoid';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import { db, tasks, taskSteps } from '@opendispatch/db';
import { routeTask } from '@opendispatch/shared';
import { runAgentLoop, type AgentStepEvent } from '../agent/loop.js';
import type { Task, CreateTaskInput } from '@opendispatch/shared';
import { homedir } from 'node:os';

const MAX_CONCURRENT = 1;

export class TaskManager extends EventEmitter {
  private running = 0;
  private abortControllers = new Map<string, AbortController>();

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = Date.now();
    const routing = routeTask({
      preferredModel: input.model,
      complexity: 'medium',
    });

    const task: Task = {
      id: nanoid(),
      prompt: input.prompt,
      status: 'pending',
      model: routing.modelId,
      preferredModel: input.model || null,
      workingDirectory: input.workingDirectory || homedir(),
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
    };

    db.insert(tasks).values({
      id: task.id,
      prompt: task.prompt,
      status: task.status,
      model: task.model,
      preferredModel: task.preferredModel,
      workingDirectory: task.workingDirectory,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }).run();

    this.emit('task:created', task);
    this.processQueue();

    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const row = db.select().from(tasks).where(eq(tasks.id, id)).get();
    return row as Task | undefined;
  }

  async listTasks(): Promise<Task[]> {
    const rows = db.select().from(tasks).orderBy(tasks.createdAt).all();
    return rows as Task[];
  }

  async getTaskSteps(taskId: string) {
    return db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(taskSteps.stepNumber).all();
  }

  async cancelTask(id: string): Promise<boolean> {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    db.update(tasks).set({ status: 'cancelled', updatedAt: Date.now() }).where(eq(tasks.id, id)).run();
    this.emit('task:cancelled', { id });
    return true;
  }

  private async processQueue() {
    if (this.running >= MAX_CONCURRENT) return;

    const pending = db.select().from(tasks).where(eq(tasks.status, 'pending')).get();
    if (!pending) return;

    this.running++;
    const taskId = pending.id;

    db.update(tasks).set({ status: 'running', updatedAt: Date.now() }).where(eq(tasks.id, taskId)).run();
    this.emit('task:started', { id: taskId, model: pending.model });

    const controller = new AbortController();
    this.abortControllers.set(taskId, controller);

    try {
      const events = new EventEmitter();

      events.on('step', (step: AgentStepEvent) => {
        db.insert(taskSteps).values({
          id: nanoid(),
          taskId: step.taskId,
          stepNumber: step.stepNumber,
          type: step.type,
          content: step.content,
          toolName: step.toolName || null,
          toolCallId: step.toolCallId || null,
          createdAt: Date.now(),
        }).run();

        this.emit('task:step', step);
      });

      const result = await runAgentLoop(pending.prompt, {
        taskId,
        model: pending.model || 'qwen3.5-122b-a10b',
        workingDirectory: pending.workingDirectory || homedir(),
        events,
        abortSignal: controller.signal,
      });

      const status = result.status === 'completed' ? 'completed' : 'failed';
      db.update(tasks).set({
        status,
        result: result.result || null,
        error: result.error || null,
        updatedAt: Date.now(),
      }).where(eq(tasks.id, taskId)).run();

      this.emit(`task:${status}`, { id: taskId, result: result.result, error: result.error });
    } catch (err) {
      db.update(tasks).set({
        status: 'failed',
        error: (err as Error).message,
        updatedAt: Date.now(),
      }).where(eq(tasks.id, taskId)).run();

      this.emit('task:failed', { id: taskId, error: (err as Error).message });
    } finally {
      this.abortControllers.delete(taskId);
      this.running--;
      this.processQueue();
    }
  }
}

export const taskManager = new TaskManager();
