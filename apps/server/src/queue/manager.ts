import { nanoid } from 'nanoid';
import { EventEmitter } from 'node:events';
import { eq, ne } from 'drizzle-orm';
import { db, tasks, taskSteps } from '@opendispatch/db';
import { routeTask } from '@opendispatch/shared';
import { getRegistry } from '../llm/registry.js';
import { runAgentLoop, PauseController, type AgentStepEvent } from '../agent/loop.js';
import type { Task, CreateTaskInput } from '@opendispatch/shared';
import { homedir } from 'node:os';

const MAX_CONCURRENT = 1;

export class TaskManager extends EventEmitter {
  private running = 0;
  private abortControllers = new Map<string, AbortController>();
  private pauseControllers = new Map<string, PauseController>();

  constructor() {
    super();
    // On startup, reset any orphaned "running" tasks to "failed".
    // These are leftovers from a previous server instance that crashed or was restarted.
    const orphaned = db.select().from(tasks).where(eq(tasks.status, 'running')).all();
    if (orphaned.length > 0) {
      for (const t of orphaned) {
        db.update(tasks).set({ status: 'failed', error: 'Server restarted while task was running', updatedAt: Date.now() }).where(eq(tasks.id, t.id)).run();
      }
      console.log(`Reset ${orphaned.length} orphaned running task(s) to failed.`);
    }
    // Kick off queue processing for any pending tasks from a previous session
    setTimeout(() => this.processQueue(), 1000);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = Date.now();
    const registry = await getRegistry();
    const routing = routeTask({
      preferredModel: input.model,
      complexity: 'medium',
    }, registry);

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

  async listTasks(includeArchived = false): Promise<Task[]> {
    if (includeArchived) {
      return db.select().from(tasks).orderBy(tasks.createdAt).all() as Task[];
    }
    return db.select().from(tasks).where(ne(tasks.status, 'archived')).orderBy(tasks.createdAt).all() as Task[];
  }

  async getTaskSteps(taskId: string) {
    return db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId)).orderBy(taskSteps.stepNumber).all();
  }

  async pauseTask(id: string): Promise<boolean> {
    const pause = this.pauseControllers.get(id);
    if (!pause) return false;

    pause.pause();
    db.update(tasks).set({ status: 'paused', updatedAt: Date.now() }).where(eq(tasks.id, id)).run();
    this.emit('task:paused', { id });
    return true;
  }

  async resumeTask(id: string): Promise<boolean> {
    const pause = this.pauseControllers.get(id);
    if (!pause) return false;

    pause.resume();
    db.update(tasks).set({ status: 'running', updatedAt: Date.now() }).where(eq(tasks.id, id)).run();
    this.emit('task:resumed', { id });
    return true;
  }

  async cancelTask(id: string): Promise<boolean> {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    const pause = this.pauseControllers.get(id);
    if (pause) {
      pause.resume(); // unblock if paused so the loop can exit
      this.pauseControllers.delete(id);
    }

    db.update(tasks).set({ status: 'cancelled', updatedAt: Date.now() }).where(eq(tasks.id, id)).run();
    this.emit('task:cancelled', { id });
    return true;
  }

  async archiveTask(id: string): Promise<void> {
    db.update(tasks).set({ status: 'archived', updatedAt: Date.now() }).where(eq(tasks.id, id)).run();
    this.emit('task:archived', { id });
  }

  async deleteTask(id: string): Promise<void> {
    db.delete(taskSteps).where(eq(taskSteps.taskId, id)).run();
    db.delete(tasks).where(eq(tasks.id, id)).run();
    this.emit('task:deleted', { id });
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
    const pauseCtrl = new PauseController();
    this.pauseControllers.set(taskId, pauseCtrl);

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
        pauseSignal: pauseCtrl,
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
      this.pauseControllers.delete(taskId);
      this.running--;
      this.processQueue();
    }
  }
}

export const taskManager = new TaskManager();
