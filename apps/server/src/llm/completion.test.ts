import { describe, it, expect } from 'vitest';

// Test the fallback tool call parsing logic by importing internals
// The module exports chatCompletion which calls LMStudio, but the
// parsing functions are internal. We test them via the module's behavior
// by checking the exported types are correct.

// Since we can't unit test chatCompletion without LMStudio, we test
// the JSON parsing patterns that the fallback uses.

describe('completion fallback parsing patterns', () => {
  function parseFallbackToolCalls(content: string): Array<{ name: string; arguments: string }> {
    const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (!jsonMatch) return [];
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (!parsed.tool_calls || !Array.isArray(parsed.tool_calls)) return [];
      return parsed.tool_calls.map((tc: { name: string; arguments: Record<string, unknown> }) => ({
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      }));
    } catch {
      return [];
    }
  }

  it('parses tool calls from code block', () => {
    const content = 'I will read the file.\n```json\n{"tool_calls": [{"name": "file_read", "arguments": {"path": "/tmp/test.txt"}}]}\n```';
    const calls = parseFallbackToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('file_read');
    expect(JSON.parse(calls[0].arguments)).toEqual({ path: '/tmp/test.txt' });
  });

  it('parses multiple tool calls', () => {
    const content = '```json\n{"tool_calls": [{"name": "shell_exec", "arguments": {"command": "ls"}}, {"name": "file_read", "arguments": {"path": "/tmp/a"}}]}\n```';
    const calls = parseFallbackToolCalls(content);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('shell_exec');
    expect(calls[1].name).toBe('file_read');
  });

  it('returns empty for no code block', () => {
    expect(parseFallbackToolCalls('Just some text')).toHaveLength(0);
  });

  it('returns empty for invalid JSON', () => {
    expect(parseFallbackToolCalls('```json\n{bad json}\n```')).toHaveLength(0);
  });

  it('returns empty for missing tool_calls field', () => {
    expect(parseFallbackToolCalls('```json\n{"result": "hello"}\n```')).toHaveLength(0);
  });
});
