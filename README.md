# OpenDispatch

Local AI agent orchestration for your machine. Dispatch autonomous tasks to local LLMs running in [LMStudio](https://lmstudio.ai/).

## What is this?

OpenDispatch is a self-hosted alternative to cloud-based AI dispatch systems. It runs entirely on your hardware, using local language models to execute tasks autonomously — shell commands, file operations, web fetching, and more.

**Two modes:**
- **Task mode** — Fire-and-forget. Describe what you want done, and the agent works through it autonomously.
- **Chat mode** — Interactive conversations with tool access. Like having a local AI assistant that can actually do things on your machine.

## Requirements

- Node.js 22+
- [LMStudio](https://lmstudio.ai/) running with at least one model loaded
- macOS, Linux, or Windows

## Quick Start

```bash
# Clone and install
git clone https://github.com/grahamsaa/open-dispatch.git
cd open-dispatch
npm install

# Run database migrations
node --import tsx packages/db/src/migrate.ts

# Start everything
npm run dev
```

- **API server**: http://localhost:3456
- **Web UI**: http://localhost:3000
- **WebSocket**: ws://localhost:3456/ws

## Usage

### Web UI

Open http://localhost:3000. Use the **Tasks** tab to dispatch autonomous tasks, or the **Chat** tab for interactive conversations.

### API

```bash
# Dispatch a task
curl -X POST http://localhost:3456/tasks \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "List all TypeScript files in ~/myproject and summarize the architecture"}'

# Check task status
curl http://localhost:3456/tasks/<task-id>

# Start a conversation
curl -X POST http://localhost:3456/conversations \
  -H 'Content-Type: application/json' \
  -d '{}'

# Send a message
curl -X POST http://localhost:3456/conversations/<conv-id>/messages \
  -H 'Content-Type: application/json' \
  -d '{"content": "What files are in the current directory?"}'
```

## Model Routing

OpenDispatch automatically selects the best model for each task based on complexity and capabilities needed. Override with the `model` field in your request.

| Task Type | Default Model | Why |
|-----------|--------------|-----|
| Simple transforms | qwen3.5-122b-a10b (MoE) | Fast, 10B active params |
| General tasks | qwen3.5-122b-a10b | Good balance of speed/quality |
| Complex reasoning | qwen3.5-122b | Full 122B for harder problems |
| Vision tasks | qwen2.5-vl-72b | Only vision-capable model |
| Embeddings | nomic-embed-text-v1.5 | Purpose-built |

## Architecture

```
open-dispatch/
├── apps/
│   ├── server/          # Fastify API + agent loop + WebSocket
│   └── web/             # Next.js dashboard
├── packages/
│   ├── shared/          # Types, model registry, tool definitions
│   └── db/              # SQLite + Drizzle ORM
```

## License

MIT
