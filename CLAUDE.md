# OpenDispatch

Local AI agent orchestration system. Dispatches tasks to local LLMs via LMStudio.

## Architecture

Turborepo monorepo with four packages:

- `apps/server` — Fastify API server (port 3456) with agent loop, tool execution, task queue, conversation manager, and WebSocket
- `apps/web` — Next.js 15 web UI (port 3000) with dark-mode dashboard, task management, and chat mode
- `packages/shared` — TypeScript types, model registry, routing logic, tool definitions
- `packages/db` — SQLite via Drizzle ORM (stored at ~/.opendispatch/opendispatch.db)

## Key Concepts

**Task mode**: Fire-and-forget. POST a prompt, get a task ID. The agent loop runs autonomously (plan/act/observe) until complete.

**Chat mode**: Interactive conversations with persistent history. The LLM has tool access and can execute multi-round tool calls per message.

**Model routing**: `packages/shared/src/models/router.ts` picks the right LMStudio model based on task complexity, capabilities needed (vision, reasoning, etc.), and user preference.

**Agent loop**: `apps/server/src/agent/loop.ts` — sends messages + tool definitions to LLM, executes returned tool_calls, feeds results back, repeats until done or max steps (25).

**Tools**: Defined in `packages/shared/src/tools/definitions.ts`, executed in `apps/server/src/tools/executor.ts`:
- `shell_exec`, `file_read`, `file_write`, `file_list`, `file_search`, `web_fetch` — core utilities
- `browser_navigate` — Playwright-based browser automation. Extracts DOM/accessibility tree, sends to local text LLM for action planning, executes click/fill/navigate/scroll. No vision model needed. Runs a visible Chromium window. Implemented in `apps/server/src/tools/browser.ts`.
- `browser_get_page` — snapshot of the current browser page (URL, title, interactive elements)
- `screen_control` — vision-based desktop automation. Takes screenshots with `screencapture`, sends to `qwen2.5-vl-72b` for analysis, executes mouse/keyboard via `cliclick` and AppleScript. For non-browser apps and browser fallback. Implemented in `apps/server/src/tools/screen.ts`.
- `task_complete` — signals the agent loop to finish

**Browser vs Screen**: The agent is prompted to prefer `browser_navigate` for web tasks (fast, DOM-based, no vision credits). `screen_control` is reserved for native macOS apps, CAPTCHAs, and complex auth flows where Playwright can't help.

## Commands

```bash
npm install                     # Install all deps
npm run dev                     # Start both server and web UI
npm run dev:server              # Start only the API server
npm run dev:web                 # Start only the web UI
node --import tsx packages/db/src/migrate.ts  # Run DB migrations
npm test                        # Run tests
```

## API Endpoints

### Tasks
- `POST /tasks` — Create a task (`{ prompt, model?, workingDirectory? }`)
- `GET /tasks` — List all tasks
- `GET /tasks/:id` — Get task details
- `GET /tasks/:id/steps` — Get agent steps for a task
- `POST /tasks/:id/pause` — Pause a running task
- `POST /tasks/:id/resume` — Resume a paused task
- `POST /tasks/:id/cancel` — Cancel a task

### Conversations
- `POST /conversations` — Create (`{ title?, model?, workingDirectory? }`)
- `GET /conversations` — List all
- `GET /conversations/:id/messages` — Get message history
- `POST /conversations/:id/messages` — Send message (`{ content }`)
- `DELETE /conversations/:id` — Delete conversation

### WebSocket
- `ws://localhost:3456/ws` — Real-time events for tasks and conversations

## Chrome CDP (authenticated browsing)

The browser tool connects to the user's actual Chrome via Chrome DevTools Protocol (CDP). This gives full access to authenticated sessions — Chase, Gmail, any site the user is logged into.

**Setup:**
```bash
npm run chrome              # Quit Chrome and relaunch with CDP on port 9222
npm run chrome:install      # Install launchd agent so Chrome always starts with CDP
```

**API:**
- `GET /chrome/status` — check if CDP is connected
- `POST /chrome/launch` — quit Chrome and relaunch with CDP enabled

**How it works:** `browser.ts` tries `chromium.connectOverCDP('http://localhost:9222')` first. If Chrome isn't running with CDP, it falls back to a standalone Chromium (no sessions). The `scripts/chrome-cdp.sh` helper handles the Chrome restart.

**Env var:** Override CDP endpoint with `CDP_URL` (default: `http://localhost:9222`).

## LMStudio

The server connects to LMStudio's OpenAI-compatible API at `http://localhost:1234/v1`. Override with `LMSTUDIO_URL` env var.

Models that don't support native tool_calls get a fallback where tool definitions are injected into the system prompt and the response is parsed for JSON tool call blocks.

## Integration with research-agent

research-agent (~/research-agent) has dispatch tools that call OpenDispatch's API:
- `dispatch_task` — Create a task
- `dispatch_status` — Check task status/result
- `dispatch_list` — List recent tasks
- `dispatch_cancel` — Cancel a task

These are in `research-agent/agent_web/tools.py` and activated by the "dispatch" tool group in `tool_context.py`.
