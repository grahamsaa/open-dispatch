import { describe, it, expect } from 'vitest';
import { shellExec } from './shell.js';

describe('shellExec', () => {
  it('executes a simple command', async () => {
    const result = await shellExec({ command: 'echo hello' }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('captures exit code on failure', async () => {
    const result = await shellExec({ command: 'exit 1' }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.output).toContain('exit code: 1');
  });

  it('uses provided working directory', async () => {
    const result = await shellExec({ command: 'pwd' }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('/tmp');
  });

  it('respects cwd override', async () => {
    const result = await shellExec({ command: 'pwd', cwd: '/usr' }, '/tmp');
    expect(result.success).toBe(true);
    expect(result.output).toContain('/usr');
  });

  it('handles stderr output', async () => {
    const result = await shellExec({ command: 'echo err >&2' }, '/tmp');
    expect(result.output).toContain('err');
  });

  it('times out long commands', async () => {
    const result = await shellExec({ command: 'sleep 10', timeout: 500 }, '/tmp');
    expect(result.success).toBe(false);
    expect(result.output).toContain('timed out');
  });
});
