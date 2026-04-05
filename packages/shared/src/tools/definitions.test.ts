import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, CHAT_EXTRA_TOOLS } from './definitions.js';

describe('TOOL_DEFINITIONS', () => {
  it('has the expected tools', () => {
    const names = TOOL_DEFINITIONS.map(t => t.function.name);
    expect(names).toContain('shell_exec');
    expect(names).toContain('file_read');
    expect(names).toContain('file_write');
    expect(names).toContain('file_list');
    expect(names).toContain('file_search');
    expect(names).toContain('web_fetch');
    expect(names).toContain('task_complete');
  });

  it('all tools have required fields', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toBeDefined();
    }
  });

  it('all tools have required parameters list', () => {
    for (const tool of TOOL_DEFINITIONS) {
      const params = tool.function.parameters as { required?: string[] };
      expect(Array.isArray(params.required)).toBe(true);
      // Each required param should exist in properties
      for (const req of params.required || []) {
        expect((tool.function.parameters as Record<string, unknown>).properties).toHaveProperty(req);
      }
    }
  });

  it('tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map(t => t.function.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes browser and screen tools', () => {
    const names = TOOL_DEFINITIONS.map(t => t.function.name);
    expect(names).toContain('browser_navigate');
    expect(names).toContain('browser_get_page');
    expect(names).toContain('browser_status');
    expect(names).toContain('screen_control');
  });
});

describe('CHAT_EXTRA_TOOLS', () => {
  it('has the expected chat tools', () => {
    const names = CHAT_EXTRA_TOOLS.map(t => t.function.name);
    expect(names).toContain('dispatch_background_task');
    expect(names).toContain('check_task_status');
    expect(names).toContain('list_background_tasks');
    expect(names).toContain('load_model');
  });

  it('all chat tools have valid schemas', () => {
    for (const tool of CHAT_EXTRA_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
    }
  });

  it('chat tool names do not overlap with standard tools', () => {
    const standardNames = new Set(TOOL_DEFINITIONS.map(t => t.function.name));
    for (const tool of CHAT_EXTRA_TOOLS) {
      expect(standardNames.has(tool.function.name)).toBe(false);
    }
  });

  it('dispatch_background_task requires prompt', () => {
    const dispatch = CHAT_EXTRA_TOOLS.find(t => t.function.name === 'dispatch_background_task')!;
    const params = dispatch.function.parameters as { required?: string[] };
    expect(params.required).toContain('prompt');
  });

  it('check_task_status requires taskId', () => {
    const check = CHAT_EXTRA_TOOLS.find(t => t.function.name === 'check_task_status')!;
    const params = check.function.parameters as { required?: string[] };
    expect(params.required).toContain('taskId');
  });

  it('load_model requires model', () => {
    const load = CHAT_EXTRA_TOOLS.find(t => t.function.name === 'load_model')!;
    const params = load.function.parameters as { required?: string[] };
    expect(params.required).toContain('model');
  });
});
