# OpenDispatch

Local AI agent orchestration system. Dispatches tasks to local LLMs via LMStudio.

## Architecture

Turborepo monorepo with four packages:

- `apps/server` — Fastify API server (port 3456) with agent loop, tool execution, task queue, conversation manager, and WebSocket
- `apps/web` — Next.js 15 web UI (port 3001 default) with unified chat-first mobile interface
- `packages/shared` — TypeScript types, model registry, routing logic, tool definitions
- `packages/db` — SQLite via Drizzle ORM (stored at ~/.opendispatch/opendispatch.db)

## Key Concepts

**Chat-first UI**: The web interface is a three-panel layout (threads | chat | tasks). Chat is the primary interface — users converse naturally and the LLM decides whether to answer directly or dispatch a background task. Accessible from iPad/mobile.

**Task mode**: Fire-and-forget. POST a prompt, get a task ID. The agent loop runs autonomously (plan/act/observe) until complete. Tasks can be paused, resumed, cancelled, archived, or deleted.

**Chat mode**: Interactive conversations with persistent history. The chat LLM has all standard tools PLUS chat-specific tools for dispatching background tasks, checking task status, loading models, etc.

**Model routing**: `packages/shared/src/models/router.ts` picks the right LMStudio model based on task complexity, capabilities needed (vision, reasoning, etc.), and user preference.

**Model management**: Users can load/unload models and set context window size via the UI model bar, chat natural language ("load gemma with 64k context"), or API (`POST /models/load`). Uses the `lms` CLI under the hood.

**Agent loop**: `apps/server/src/agent/loop.ts` — sends messages + tool definitions to LLM, executes returned tool_calls, feeds results back, repeats until done or max steps (25). Includes loop detection that injects a STOP nudge if the model repeats the same tool call 3+ times.

**Tools — standard** (defined in `packages/shared/src/tools/definitions.ts`, executed in `apps/server/src/tools/executor.ts`):
- `shell_exec`, `file_read`, `file_write`, `file_list`, `file_search`, `web_fetch` — core utilities
- `browser_navigate` — Playwright-based browser automation. Extracts DOM/accessibility tree, sends to local text LLM for action planning. No vision model needed. Connects to user's Chrome via CDP for authenticated sessions, falls back to standalone Chromium. Implemented in `apps/server/src/tools/browser.ts`.
- `browser_get_page` — snapshot of the current browser page
- `browser_status` — check CDP connection state
- `screen_control` — vision-based desktop automation via screencapture + qwen2.5-vl-72b + cliclick/AppleScript. For non-browser apps and browser fallback. Implemented in `apps/server/src/tools/screen.ts`.
- `task_complete` — signals the agent loop to finish

**Tools — chat-only** (defined in `CHAT_EXTRA_TOOLS`, executed in `apps/server/src/tools/chat-tools.ts`):
- `dispatch_background_task` — spawn an autonomous task from chat with optional model, contextLength, workingDirectory. Loads the requested model first if needed.
- `check_task_status` — inspect a task by ID (status, result, recent steps)
- `list_background_tasks` — see all active and recent tasks
- `load_model` — switch LMStudio models or change context window

**Natural language model selection**: The chat system prompt teaches the LLM to parse model references from user messages:
- "use the big model" → qwen3.5-122b
- "use the fast model" → qwen3.5-9b-mlx
- "use gemma" → gemma-4-31b-it@q8_0
- "64k context" → contextLength: 65536
- "max context" → contextLength: 262144

## Commands

```bash
npm install                     # Install all deps
npm run dev                     # Start both server and web UI
npm run dev:server              # Start only the API server
npm run dev:web                 # Start only the web UI
npm run chrome                  # Restart Chrome with CDP for authenticated browsing
npm run chrome:install          # Auto-launch Chrome with CDP on login
node --import tsx packages/db/src/migrate.ts  # Run DB migrations
npm test                        # Run tests (124 tests across 16 files)
```

## API Endpoints

### Tasks
- `POST /tasks` — Create a task (`{ prompt, model?, workingDirectory? }`)
- `GET /tasks` — List active tasks (excludes archived)
- `GET /tasks/:id` — Get task details
- `GET /tasks/:id/steps` — Get agent steps for a task
- `POST /tasks/:id/pause` — Pause a running task
- `POST /tasks/:id/resume` — Resume a paused task
- `POST /tasks/:id/cancel` — Cancel a task
- `POST /tasks/:id/archive` — Archive a completed task (hidden from list)
- `DELETE /tasks/:id` — Permanently delete a task and its steps

### Conversations
- `POST /conversations` — Create (`{ title?, model?, workingDirectory? }`)
- `GET /conversations` — List all
- `GET /conversations/:id/messages` — Get message history
- `POST /conversations/:id/messages` — Send message (`{ content }`)
- `DELETE /conversations/:id` — Delete conversation and messages

### Models
- `GET /models` — List all models with state, context lengths, capabilities
- `POST /models/load` — Load a model (`{ model, contextLength? }`)
- `POST /models/unload` — Unload a model (`{ model }`)

### Chrome
- `GET /chrome/status` — Check CDP connection
- `POST /chrome/launch` — Restart Chrome with CDP enabled

### WebSocket
- `ws://localhost:3456/ws` — Real-time events for tasks, conversations, and model changes

## Chrome CDP (authenticated browsing)

The browser tool connects to the user's Chrome via CDP. This gives full access to authenticated sessions.

```bash
npm run chrome              # Quit Chrome and relaunch with CDP on port 9222
npm run chrome:install      # Install launchd agent for auto-start
```

`browser.ts` tries `chromium.connectOverCDP('http://localhost:9222')` first, falls back to standalone Chromium. Override with `CDP_URL` env var.

## LMStudio

The server connects to LMStudio's OpenAI-compatible API at `http://localhost:1234/v1`. Override with `LMSTUDIO_URL` env var. Model loading/unloading uses the `lms` CLI at `~/.lmstudio/bin/lms`. Override with `LMS_PATH` env var.

Models without native tool_call support get a fallback: tool definitions are injected into the system prompt and the response is parsed for JSON tool call blocks in ```json code fences.

## Integration with research-agent

research-agent (~/research-agent) has dispatch tools that call OpenDispatch's API:
- `dispatch_task`, `dispatch_status`, `dispatch_list`, `dispatch_cancel`
- Located in `research-agent/agent_web/tools.py`, activated by the "dispatch" tool group in `tool_context.py`

## Testing

124 unit tests across 16 files covering:
- Model registry and routing (17 tests)
- Tool definitions and schemas (11 tests)
- Shell, file, web tool execution (17 tests)
- Browser action parsing and CDP status (13 tests)
- Screen action parsing (12 tests)
- Tool executor routing (15 tests)
- Chat-specific tools — dispatch, status, list (6 tests)
- Task manager — create, archive, delete, cancel (10 tests)
- Conversation manager — CRUD, messages (9 tests)
- LLM completion fallback parsing (5 tests)
- PauseController (5 tests)
- Agent loop detection (4 tests)

Run with `npm test`.
