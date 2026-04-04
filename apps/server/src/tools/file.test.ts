import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileRead, fileWrite, fileList } from './file.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join('/tmp', 'opendispatch-test-' + Date.now());

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, 'hello.txt'), 'line 1\nline 2\nline 3\nline 4\nline 5');
  writeFileSync(join(TEST_DIR, 'data.json'), '{"key": "value"}');
  mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'sub', 'nested.ts'), 'export const x = 1;');
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('fileRead', () => {
  it('reads a file with line numbers', async () => {
    const result = await fileRead({ path: join(TEST_DIR, 'hello.txt') });
    expect(result.success).toBe(true);
    expect(result.output).toContain('1\tline 1');
    expect(result.output).toContain('5 lines total');
  });

  it('respects offset and limit', async () => {
    const result = await fileRead({ path: join(TEST_DIR, 'hello.txt'), offset: 2, limit: 2 });
    expect(result.success).toBe(true);
    expect(result.output).toContain('3\tline 3');
    expect(result.output).toContain('4\tline 4');
    expect(result.output).not.toContain('1\tline 1');
  });

  it('returns error for missing file', async () => {
    const result = await fileRead({ path: join(TEST_DIR, 'nope.txt') });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read');
  });
});

describe('fileWrite', () => {
  it('writes a new file', async () => {
    const path = join(TEST_DIR, 'output.txt');
    const result = await fileWrite({ path, content: 'test content' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('12 bytes');

    const readResult = await fileRead({ path });
    expect(readResult.output).toContain('test content');
  });

  it('creates intermediate directories', async () => {
    const path = join(TEST_DIR, 'deep', 'nested', 'file.txt');
    const result = await fileWrite({ path, content: 'deep write' });
    expect(result.success).toBe(true);
  });
});

describe('fileList', () => {
  it('lists files matching a pattern', async () => {
    const result = await fileList({ pattern: '*.txt' }, TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello.txt');
  });

  it('supports recursive glob', async () => {
    const result = await fileList({ pattern: '**/*.ts' }, TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.output).toContain('nested.ts');
  });

  it('returns empty for no matches', async () => {
    const result = await fileList({ pattern: '*.xyz' }, TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.output).toContain('No files matched');
  });
});
