import type { ToolDefinition } from '../types/agent.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'shell_exec',
      description: 'Execute a shell command and return stdout, stderr, and exit code. Use for running build commands, git operations, system utilities, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (optional, defaults to task working directory)' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Returns the file content as a string. For large files, use offset and limit to read a portion.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          offset: { type: 'number', description: 'Line number to start reading from (0-based)' },
          limit: { type: 'number', description: 'Maximum number of lines to read (default: 500)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write content to a file. Creates the file if it does not exist. Overwrites existing content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_list',
      description: 'List files matching a glob pattern. Returns an array of matching file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "src/**/*.ts", "*.json")' },
          cwd: { type: 'string', description: 'Base directory for the glob (optional)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_search',
      description: 'Search file contents using a regex pattern. Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'File or directory to search in' },
          glob: { type: 'string', description: 'Glob filter for files (e.g., "*.ts")' },
          maxResults: { type: 'number', description: 'Maximum number of results (default: 50)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and return its content. Useful for reading documentation, APIs, or web pages.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          method: { type: 'string', description: 'HTTP method (default: GET)', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          headers: { type: 'object', description: 'Request headers', additionalProperties: { type: 'string' } },
          body: { type: 'string', description: 'Request body (for POST/PUT)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description: 'Mark the current task as complete and provide the final result/summary to the user.',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'The final result or summary of the completed task' },
        },
        required: ['result'],
      },
    },
  },
];
