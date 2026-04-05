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
      name: 'browser_navigate',
      description: 'Automate a web browser to complete a task. Opens a real Chromium browser, navigates pages, clicks elements, fills forms, extracts data. Uses DOM analysis — no vision model needed. Prefer this for any web-based task. The browser runs with a visible window.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Detailed description of what to do in the browser (e.g., "Go to github.com/grahamsaa, find the open-dispatch repo, and read the README")' },
          startUrl: { type: 'string', description: 'URL to navigate to before starting (optional)' },
          model: { type: 'string', description: 'Model to use for browser action planning (optional, defaults to fast MoE model)' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_page',
      description: 'Get a snapshot of the currently open browser page — its URL, title, main content, and interactive elements. Useful for inspecting what the browser is currently showing.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_script',
      description: 'Run JavaScript code directly on the current browser page. Much more reliable than browser_navigate for complex web apps like Gmail. Use this when you know the exact DOM operations needed (clicking buttons, selecting checkboxes, reading text). Returns the result of the script.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code to execute in the page context. Has access to document, window, etc. Return a value to get it back.' },
          url: { type: 'string', description: 'Navigate to this URL first before running the script (optional)' },
        },
        required: ['script'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_status',
      description: 'Check whether the browser is connected to Chrome (with authenticated sessions) or running standalone. Shows CDP connection status.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'screen_control',
      description: 'Control the macOS desktop by seeing the screen and performing mouse/keyboard actions. Uses a vision model (qwen2.5-vl-72b) to understand screenshots and decide actions. Use this for non-browser apps (Finder, Mail, system dialogs, native apps) or when browser automation cannot handle something (CAPTCHAs, complex auth flows). More expensive than browser_navigate — prefer browser_navigate for web tasks.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Detailed description of the desktop task (e.g., "Open Finder, navigate to ~/Documents, and create a new folder called Reports")' },
          maxSteps: { type: 'number', description: 'Maximum number of screenshot-action cycles (default: 15)' },
        },
        required: ['task'],
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

// Tools only available in chat mode (not in fire-and-forget task mode)
export const CHAT_EXTRA_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'dispatch_background_task',
      description: 'Dispatch a task to run autonomously in the background. Use this when the user asks you to do something that will take a while (code reviews, refactoring, builds, data extraction, etc.) and they want to keep chatting while it runs. The task runs independently with its own agent loop. You can check on it later with check_task_status.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed description of the task. Be specific — the background agent has no context from this conversation.' },
          model: { type: 'string', description: 'Model to use. Examples: "qwen3.5-122b-a10b" (fast MoE, default), "qwen3.5-122b" (full 122B, complex tasks), "qwen3.5-9b-mlx" (fast small), "gemma-4-31b-it@q8_0", "llama-3.3-70b". Leave empty for auto-routing.' },
          contextLength: { type: 'number', description: 'Context window size in tokens. Examples: 32768 (32k), 65536 (64k), 131072 (128k). Leave empty for current loaded context.' },
          workingDirectory: { type: 'string', description: 'Working directory for the task (default: user home)' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_task_status',
      description: 'Check the status and result of a background task. Returns status (pending/running/completed/failed), result if done, error if failed, and step count.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task ID returned by dispatch_background_task' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_background_tasks',
      description: 'List all active and recent background tasks with their statuses.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'load_model',
      description: 'Load a specific LLM model in LMStudio with a given context window size. Use when the user asks to switch models or change the context window. Unloads the current model first.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model ID to load. Available: qwen3.5-122b-a10b, qwen3.5-122b, qwen3.5-9b-mlx, qwen3-32b-mlx, gemma-4-31b-it@q8_0, llama-3.3-70b, hermes-3-70b, qwen3-235b-thinking, qwen2.5-vl-72b, wizardlm-2-8x22b' },
          contextLength: { type: 'number', description: 'Context window in tokens. Common values: 32768 (32k), 65536 (64k), 131072 (128k), 262144 (256k)' },
        },
        required: ['model'],
      },
    },
  },
];
