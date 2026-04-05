import { describe, it, expect, afterEach } from 'vitest';
import { executeChatTool } from './chat-tools.js';
import { taskManager } from '../queue/manager.js';

const createdTaskIds: string[] = [];

afterEach(async () => {
  for (const id of createdTaskIds) {
    await taskManager.deleteTask(id).catch(() => {});
  }
  createdTaskIds.length = 0;
});

describe('executeChatTool', () => {
  it('returns null for non-chat tools', async () => {
    const result = await executeChatTool({
      id: 'test-1',
      type: 'function',
      function: { name: 'shell_exec', arguments: '{"command":"echo hi"}' },
    });
    expect(result).toBeNull();
  });

  it('dispatches a background task', async () => {
    const result = await executeChatTool({
      id: 'test-2',
      type: 'function',
      function: { name: 'dispatch_background_task', arguments: '{"prompt":"test task from chat"}' },
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    const data = JSON.parse(result!.output);
    expect(data.taskId).toBeTruthy();
    expect(data.status).toBe('pending');
    createdTaskIds.push(data.taskId);
  });

  it('lists background tasks', async () => {
    const result = await executeChatTool({
      id: 'test-3',
      type: 'function',
      function: { name: 'list_background_tasks', arguments: '{}' },
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    const data = JSON.parse(result!.output);
    expect(data.tasks).toBeDefined();
    expect(Array.isArray(data.tasks)).toBe(true);
  });

  it('checks task status for nonexistent task', async () => {
    const result = await executeChatTool({
      id: 'test-4',
      type: 'function',
      function: { name: 'check_task_status', arguments: '{"taskId":"nonexistent"}' },
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('not found');
  });

  it('requires prompt for dispatch', async () => {
    const result = await executeChatTool({
      id: 'test-5',
      type: 'function',
      function: { name: 'dispatch_background_task', arguments: '{}' },
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('prompt');
  });

  it('handles invalid JSON', async () => {
    const result = await executeChatTool({
      id: 'test-6',
      type: 'function',
      function: { name: 'dispatch_background_task', arguments: 'bad json' },
    });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.error).toContain('Invalid JSON');
  });
});
