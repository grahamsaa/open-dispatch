import { describe, it, expect } from 'vitest';
import { executeTool } from './executor.js';

describe('executeTool — full tool routing', () => {
  it('routes shell_exec', async () => {
    const result = await executeTool({
      id: 'r-1', type: 'function',
      function: { name: 'shell_exec', arguments: '{"command": "echo routed"}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('routed');
  });

  it('routes file_read', async () => {
    const result = await executeTool({
      id: 'r-2', type: 'function',
      function: { name: 'file_read', arguments: `{"path": "${process.cwd()}/package.json"}` },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('open-dispatch');
  });

  it('routes file_write and file_read round-trip', async () => {
    const path = `/tmp/opendispatch-exec-test-${Date.now()}.txt`;
    const writeResult = await executeTool({
      id: 'r-3', type: 'function',
      function: { name: 'file_write', arguments: JSON.stringify({ path, content: 'round trip' }) },
    }, '/tmp');
    expect(writeResult.success).toBe(true);

    const readResult = await executeTool({
      id: 'r-4', type: 'function',
      function: { name: 'file_read', arguments: JSON.stringify({ path }) },
    }, '/tmp');
    expect(readResult.success).toBe(true);
    expect(readResult.output).toContain('round trip');
  });

  it('routes file_list', async () => {
    const result = await executeTool({
      id: 'r-5', type: 'function',
      function: { name: 'file_list', arguments: '{"pattern": "*.json"}' },
    }, process.cwd());
    expect(result.success).toBe(true);
    expect(result.output).toContain('package.json');
  });

  it('routes web_fetch', async () => {
    const result = await executeTool({
      id: 'r-6', type: 'function',
      function: { name: 'web_fetch', arguments: '{"url": "http://localhost:1234/v1/models"}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('HTTP 200');
  });

  it('routes browser_status', async () => {
    const result = await executeTool({
      id: 'r-7', type: 'function',
      function: { name: 'browser_status', arguments: '{}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toMatch(/CDP|Chrome/);
  });

  it('routes task_complete', async () => {
    const result = await executeTool({
      id: 'r-8', type: 'function',
      function: { name: 'task_complete', arguments: '{"result": "all done"}' },
    }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toBe('all done');
  });

  it('returns error for unknown tool', async () => {
    const result = await executeTool({
      id: 'r-9', type: 'function',
      function: { name: 'nonexistent', arguments: '{}' },
    }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  it('returns error for invalid JSON', async () => {
    const result = await executeTool({
      id: 'r-10', type: 'function',
      function: { name: 'shell_exec', arguments: '{bad json' },
    }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });
});
