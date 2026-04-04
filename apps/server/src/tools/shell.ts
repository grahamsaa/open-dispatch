import { exec } from 'node:child_process';
import type { ToolResult } from '@opendispatch/shared';

const MAX_OUTPUT = 50_000;
const DEFAULT_TIMEOUT = 30_000;

interface ShellExecArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

export async function shellExec(args: ShellExecArgs, defaultCwd: string): Promise<ToolResult> {
  const cwd = args.cwd || defaultCwd;
  const timeout = args.timeout || DEFAULT_TIMEOUT;

  return new Promise((resolve) => {
    exec(args.command, { cwd, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const output = truncate(stdout || '', MAX_OUTPUT);
      const errOutput = truncate(stderr || '', MAX_OUTPUT);

      if (error && error.killed) {
        resolve({
          success: false,
          output: `Command timed out after ${timeout}ms\n${output}`,
          error: errOutput,
        });
        return;
      }

      const exitCode = error?.code ?? 0;
      const combined = [
        output && `stdout:\n${output}`,
        errOutput && `stderr:\n${errOutput}`,
        `exit code: ${exitCode}`,
      ].filter(Boolean).join('\n\n');

      resolve({
        success: exitCode === 0,
        output: combined,
        error: exitCode !== 0 ? errOutput : undefined,
      });
    });
  });
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n... (truncated, ${str.length - max} bytes omitted)`;
}
