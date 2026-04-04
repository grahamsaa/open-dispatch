import { describe, it, expect } from 'vitest';
import { executeTool } from './executor.js';

describe('executeTool', () => {
  it('dispatches shell_exec', async () => {
    const result = await executeTool({
      id: 'test-1',
      type: 'function',
      function: { name: 'shell_exec', arguments: '{"command": "echo dispatch"}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('dispatch');
  });

  it('dispatches file_read', async () => {
    const result = await executeTool({
      id: 'test-2',
      type: 'function',
      function: { name: 'file_read', arguments: `{"path": "${process.cwd()}/package.json"}` },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('open-dispatch');
  });

  it('handles invalid JSON arguments', async () => {
    const result = await executeTool({
      id: 'test-3',
      type: 'function',
      function: { name: 'shell_exec', arguments: 'not json' },
    }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('handles unknown tool', async () => {
    const result = await executeTool({
      id: 'test-4',
      type: 'function',
      function: { name: 'nonexistent_tool', arguments: '{}' },
    }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  it('handles task_complete', async () => {
    const result = await executeTool({
      id: 'test-5',
      type: 'function',
      function: { name: 'task_complete', arguments: '{"result": "all done"}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toBe('all done');
  });
});
