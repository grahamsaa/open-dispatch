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

**Tools**: shell_exec, file_read, file_write, file_list, file_search, web_fetch, task_complete. Defined in `packages/shared/src/tools/definitions.ts`, executed in `apps/server/src/tools/executor.ts`.

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
