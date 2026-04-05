import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { glob } from 'node:fs/promises';
import type { ToolResult } from '@opendispatch/shared';

const MAX_READ = 50_000;

function expandHome(p: string): string {
  if (p.startsWith('~/')) return homedir() + p.slice(1);
  if (p === '~') return homedir();
  return p;
}

interface FileReadArgs {
  path: string;
  offset?: number;
  limit?: number;
}

interface FileWriteArgs {
  path: string;
  content: string;
}

interface FileListArgs {
  pattern: string;
  cwd?: string;
}

interface FileSearchArgs {
  pattern: string;
  path?: string;
  glob?: string;
  maxResults?: number;
}

export async function fileRead(args: FileReadArgs): Promise<ToolResult> {
  try {
    const content = await readFile(expandHome(args.path), 'utf-8');
    const lines = content.split('\n');
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 500;
    const sliced = lines.slice(offset, offset + limit);
    const numbered = sliced.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');

    const output = numbered.length > MAX_READ
      ? numbered.slice(0, MAX_READ) + '\n... (truncated)'
      : numbered;

    return {
      success: true,
      output: `${args.path} (${lines.length} lines total, showing ${offset + 1}-${offset + sliced.length}):\n${output}`,
    };
  } catch (err) {
    return { success: false, output: '', error: `Failed to read file: ${(err as Error).message}` };
  }
}

export async function fileWrite(args: FileWriteArgs): Promise<ToolResult> {
  try {
    const path = expandHome(args.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, args.content, 'utf-8');
    return { success: true, output: `Wrote ${args.content.length} bytes to ${args.path}` };
  } catch (err) {
    return { success: false, output: '', error: `Failed to write file: ${(err as Error).message}` };
  }
}

export async function fileList(args: FileListArgs, defaultCwd: string): Promise<ToolResult> {
  try {
    const cwd = expandHome(args.cwd || defaultCwd);
    const matches: string[] = [];
    for await (const entry of glob(args.pattern, { cwd })) {
      matches.push(entry as string);
      if (matches.length >= 200) break;
    }
    return {
      success: true,
      output: matches.length
        ? `Found ${matches.length} files:\n${matches.join('\n')}`
        : 'No files matched the pattern.',
    };
  } catch (err) {
    return { success: false, output: '', error: `Glob failed: ${(err as Error).message}` };
  }
}

export async function fileSearch(args: FileSearchArgs, defaultCwd: string): Promise<ToolResult> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const searchPath = expandHome(args.path || defaultCwd);
    const maxResults = args.maxResults ?? 50;
    const globFlag = args.glob ? `--glob '${args.glob}'` : '';

    const { stdout } = await execAsync(
      `rg --no-heading --line-number --max-count ${maxResults} ${globFlag} '${args.pattern.replace(/'/g, "\\'")}' '${searchPath}'`,
      { maxBuffer: 1024 * 1024, timeout: 15000 }
    );

    const lines = stdout.trim().split('\n').slice(0, maxResults);
    return {
      success: true,
      output: lines.length ? lines.join('\n') : 'No matches found.',
    };
  } catch (err) {
    const error = err as Error & { stdout?: string; code?: number };
    if (error.code === 1) {
      return { success: true, output: 'No matches found.' };
    }
    return { success: false, output: '', error: `Search failed: ${error.message}` };
  }
}
