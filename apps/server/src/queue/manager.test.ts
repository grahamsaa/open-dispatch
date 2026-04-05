import { describe, it, expect, afterEach } from 'vitest';
import { taskManager } from './manager.js';

const createdIds: string[] = [];

afterEach(async () => {
  for (const id of createdIds) {
    await taskManager.deleteTask(id).catch(() => {});
  }
  createdIds.length = 0;
});

async function createAndTrack(input: { prompt: string; model?: string; workingDirectory?: string }) {
  const task = await taskManager.createTask(input);
  createdIds.push(task.id);
  return task;
}

describe('TaskManager', () => {
  it('creates a task with correct defaults', async () => {
    const task = await createAndTrack({ prompt: 'test create task' });
    expect(task.id).toBeTruthy();
    expect(task.prompt).toBe('test create task');
    expect(task.status).toBe('pending');
    expect(task.model).toBeTruthy();
    expect(task.createdAt).toBeGreaterThan(0);
  });

  it('retrieves a task by ID', async () => {
    const created = await createAndTrack({ prompt: 'test get task' });
    const fetched = await taskManager.getTask(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.prompt).toBe('test get task');
  });

  it('returns undefined for nonexistent task', async () => {
    const task = await taskManager.getTask('nonexistent-id');
    expect(task).toBeUndefined();
  });

  it('lists tasks excluding archived', async () => {
    const task = await createAndTrack({ prompt: 'test list task' });
    const tasks = await taskManager.listTasks();
    expect(tasks.some(t => t.id === task.id)).toBe(true);
  });

  it('archives a task', async () => {
    const task = await createAndTrack({ prompt: 'test archive task' });
    await taskManager.archiveTask(task.id);

    const tasks = await taskManager.listTasks();
    expect(tasks.some(t => t.id === task.id)).toBe(false);

    const archived = await taskManager.getTask(task.id);
    expect(archived!.status).toBe('archived');
  });

  it('deletes a task and its steps', async () => {
    const task = await createAndTrack({ prompt: 'test delete task' });
    await taskManager.deleteTask(task.id);
    createdIds.pop(); // already deleted

    const deleted = await taskManager.getTask(task.id);
    expect(deleted).toBeUndefined();
  });

  it('cancels a task', async () => {
    const task = await createAndTrack({ prompt: 'test cancel task' });
    await taskManager.cancelTask(task.id);

    const cancelled = await taskManager.getTask(task.id);
    expect(cancelled!.status).toBe('cancelled');
  });

  it('respects preferred model', async () => {
    const task = await createAndTrack({ prompt: 'test model', model: 'llama-3.3-70b' });
    expect(task.model).toBe('llama-3.3-70b');
    expect(task.preferredModel).toBe('llama-3.3-70b');
  });

  it('respects working directory', async () => {
    const task = await createAndTrack({ prompt: 'test cwd', workingDirectory: '/tmp/test' });
    expect(task.workingDirectory).toBe('/tmp/test');
  });

  it('getTaskSteps returns empty for new task', async () => {
    const task = await createAndTrack({ prompt: 'test steps' });
    const steps = await taskManager.getTaskSteps(task.id);
    expect(steps).toEqual([]);
  });
});
