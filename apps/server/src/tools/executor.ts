import type { ToolCall, ToolResult } from '@opendispatch/shared';
import { shellExec } from './shell.js';
import { fileRead, fileWrite, fileList, fileSearch } from './file.js';
import { webFetch } from './web.js';

export async function executeTool(call: ToolCall, defaultCwd: string): Promise<ToolResult> {
  const name = call.function.name;
  let args: Record<string, unknown>;

  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return { success: false, output: '', error: `Invalid JSON arguments: ${call.function.arguments}` };
  }

  try {
    switch (name) {
      case 'shell_exec':
        return await shellExec(args as { command: string; cwd?: string; timeout?: number }, defaultCwd);
      case 'file_read':
        return await fileRead(args as { path: string; offset?: number; limit?: number });
      case 'file_write':
        return await fileWrite(args as { path: string; content: string });
      case 'file_list':
        return await fileList(args as { pattern: string; cwd?: string }, defaultCwd);
      case 'file_search':
        return await fileSearch(args as { pattern: string; path?: string; glob?: string; maxResults?: number }, defaultCwd);
      case 'web_fetch':
        return await webFetch(args as { url: string; method?: string; headers?: Record<string, string>; body?: string });
      case 'task_complete':
        return { success: true, output: (args as { result: string }).result };
      default:
        return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { success: false, output: '', error: `Tool execution error: ${(err as Error).message}` };
  }
}
