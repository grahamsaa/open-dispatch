import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { taskManager } from './queue/manager.js';
import { listAvailableModels } from './llm/client.js';
import { listModels } from '@opendispatch/shared';
import type { CreateTaskInput } from '@opendispatch/shared';

const PORT = Number(process.env.PORT) || 3456;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // ── REST Routes ──

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  app.get('/models', async () => {
    const [available, registry] = await Promise.all([
      listAvailableModels().catch(() => []),
      Promise.resolve(listModels()),
    ]);
    return { available, registry };
  });

  app.post<{ Body: CreateTaskInput }>('/tasks', async (req, reply) => {
    const { prompt, model, workingDirectory } = req.body;
    if (!prompt) {
      reply.code(400);
      return { error: 'prompt is required' };
    }

    const task = await taskManager.createTask({ prompt, model, workingDirectory });
    reply.code(201);
    return task;
  });

  app.get('/tasks', async () => {
    return taskManager.listTasks();
  });

  app.get<{ Params: { id: string } }>('/tasks/:id', async (req, reply) => {
    const task = await taskManager.getTask(req.params.id);
    if (!task) {
      reply.code(404);
      return { error: 'Task not found' };
    }
    return task;
  });

  app.get<{ Params: { id: string } }>('/tasks/:id/steps', async (req) => {
    return taskManager.getTaskSteps(req.params.id);
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/cancel', async (req) => {
    await taskManager.cancelTask(req.params.id);
    return { ok: true };
  });

  // ── WebSocket ──

  app.register(async function (app) {
    app.get('/ws', { websocket: true }, (socket) => {
      const events = [
        'task:created', 'task:started', 'task:step',
        'task:completed', 'task:failed', 'task:cancelled',
      ];

      const handlers = events.map(event => {
        const handler = (data: unknown) => {
          socket.send(JSON.stringify({ event, data }));
        };
        taskManager.on(event, handler);
        return { event, handler };
      });

      socket.on('close', () => {
        for (const { event, handler } of handlers) {
          taskManager.removeListener(event, handler);
        }
      });
    });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 OpenDispatch server running at http://localhost:${PORT}`);
  console.log(`   WebSocket at ws://localhost:${PORT}/ws`);
  console.log(`   Web UI at http://localhost:3000\n`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
