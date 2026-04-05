# OpenDispatch

Local AI agent orchestration for your machine. Dispatch autonomous tasks to local LLMs running in [LMStudio](https://lmstudio.ai/).

## What is this?

OpenDispatch is a self-hosted alternative to cloud-based AI dispatch systems. It runs entirely on your hardware, using local language models to execute tasks autonomously — shell commands, file operations, browser automation, desktop control, and more.

**Chat-first interface**: Talk to it naturally from your iPad or phone. It decides whether to answer directly or spin up a background task. You can manage models, dispatch work, and check on running tasks — all through conversation.

**Background tasks**: Long-running work (code reviews, refactoring, data extraction) runs autonomously while you keep chatting. Pause, resume, cancel, or archive tasks anytime.

## Requirements

- Node.js 22+
- [LMStudio](https://lmstudio.ai/) running with at least one model loaded
- macOS (required for screen control; browser automation works cross-platform)
- `cliclick` for desktop automation: `brew install cliclick`

## Quick Start

```bash
git clone https://github.com/grahamsaa/open-dispatch.git
cd open-dispatch
npm install
node --import tsx packages/db/src/migrate.ts

# Optional: enable authenticated browsing
npm run chrome

# Start server + web UI
npm run dev
```

Open the web UI from any device on your network:
- **From the Mac**: http://localhost:3001
- **From iPad/phone**: http://YOUR_MAC_IP:3001

API server runs on port 3456. WebSocket at ws://YOUR_MAC_IP:3456/ws.

## Usage

### Chat (primary interface)

Create a new thread and talk naturally:

- *"Review the code in ~/research-agent"* → dispatches a background task
- *"What's in package.json?"* → reads the file directly and answers
- *"Load gemma with 64k context"* → switches the loaded model
- *"How's that code review going?"* → checks the background task status
- *"Run a full test suite in ~/workspace using the big model with 128k context"* → dispatches with specific model/context

### API

```bash
# Dispatch a task
curl -X POST http://localhost:3456/tasks \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Summarize the architecture of ~/myproject"}'

# Load a model with specific context
curl -X POST http://localhost:3456/models/load \
  -H 'Content-Type: application/json' \
  -d '{"model": "qwen3.5-122b", "contextLength": 65536}'

# Check task status
curl http://localhost:3456/tasks/<task-id>
```

## Authenticated Browsing

OpenDispatch can control your actual Chrome browser with your existing logins:

```bash
npm run chrome              # Restart Chrome with CDP on port 9222
npm run chrome:install      # Auto-start Chrome with CDP on login
```

The agent opens new tabs in your real browser — Chase, Gmail, any site you're logged into. Falls back to standalone Chromium if CDP isn't available.

## Model Management

Manage models from the UI (model bar at top) or via chat:

| Natural language | What happens |
|-----------------|-------------|
| "use the big model" | Loads qwen3.5-122b |
| "use the fast model" | Loads qwen3.5-9b-mlx |
| "use gemma" | Loads gemma-4-31b-it@q8_0 |
| "64k context" | Sets context window to 65536 |
| "max context" | Sets context to model's maximum (up to 256k) |

## Tools

| Tool | What it does | Cost |
|------|-------------|------|
| `shell_exec` | Run shell commands | — |
| `file_read/write/list/search` | File operations | — |
| `web_fetch` | HTTP requests | — |
| `browser_navigate` | Automate Chrome via DOM analysis | Local text model |
| `screen_control` | Control macOS desktop via vision | qwen2.5-vl-72b |
| `dispatch_background_task` | Spawn autonomous background work | — |
| `check_task_status` | Monitor running tasks | — |
| `load_model` | Switch models/context from chat | — |

## Architecture

```
open-dispatch/
├── apps/
│   ├── server/          # Fastify API + agent loops + WebSocket
│   │   └── src/
│   │       ├── agent/   # Task loop, chat loop, pause control
│   │       ├── llm/     # LMStudio client, model management
│   │       ├── tools/   # Shell, file, web, browser, screen, chat
│   │       ├── queue/   # Task manager with concurrency control
│   │       └── conversations/
│   └── web/             # Next.js — threads | chat | tasks panels
├── packages/
│   ├── shared/          # Types, model registry, tool definitions
│   └── db/              # SQLite + Drizzle ORM
└── scripts/             # Chrome CDP launcher + launchd plist
```

## Testing

```bash
npm test    # 124 tests across 16 files
```

Covers: model routing, tool schemas, all tool executors (shell, file, web, browser, screen), chat tools (dispatch, status, list), task lifecycle (create, archive, delete, cancel), conversation CRUD, LLM fallback parsing, pause control, loop detection.

## License

MIT
