import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from './definitions.js';

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
});
