import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { taskManager } from './queue/manager.js';
import { conversationManager } from './conversations/manager.js';
import { listAvailableModels } from './llm/client.js';
import { listModels } from '@opendispatch/shared';
import type { CreateTaskInput, CreateConversationInput, SendMessageInput } from '@opendispatch/shared';

const PORT = Number(process.env.PORT) || 3456;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // ── Health & Models ──

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  app.get('/models', async () => {
    const [available, registry] = await Promise.all([
      listAvailableModels().catch(() => []),
      Promise.resolve(listModels()),
    ]);
    return { available, registry };
  });

  // ── Tasks (fire-and-forget mode) ──

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

  app.post<{ Params: { id: string } }>('/tasks/:id/pause', async (req) => {
    const ok = await taskManager.pauseTask(req.params.id);
    return { ok };
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/resume', async (req) => {
    const ok = await taskManager.resumeTask(req.params.id);
    return { ok };
  });

  app.post<{ Params: { id: string } }>('/tasks/:id/cancel', async (req) => {
    await taskManager.cancelTask(req.params.id);
    return { ok: true };
  });

  // ── Conversations (chat mode) ──

  app.post<{ Body: CreateConversationInput }>('/conversations', async (req, reply) => {
    const conv = await conversationManager.create(req.body || {});
    reply.code(201);
    return conv;
  });

  app.get('/conversations', async () => {
    return conversationManager.list();
  });

  app.get<{ Params: { id: string } }>('/conversations/:id', async (req, reply) => {
    const conv = await conversationManager.get(req.params.id);
    if (!conv) {
      reply.code(404);
      return { error: 'Conversation not found' };
    }
    return conv;
  });

  app.get<{ Params: { id: string } }>('/conversations/:id/messages', async (req) => {
    return conversationManager.getMessages(req.params.id);
  });

  app.post<{ Params: { id: string }; Body: SendMessageInput }>('/conversations/:id/messages', async (req, reply) => {
    const { content } = req.body;
    if (!content) {
      reply.code(400);
      return { error: 'content is required' };
    }

    const response = await conversationManager.sendMessage(req.params.id, content);
    return { response };
  });

  app.delete<{ Params: { id: string } }>('/conversations/:id', async (req) => {
    await conversationManager.delete(req.params.id);
    return { ok: true };
  });

  // ── WebSocket ──

  app.register(async function (app) {
    app.get('/ws', { websocket: true }, (socket) => {
      const taskEvents = [
        'task:created', 'task:started', 'task:step',
        'task:completed', 'task:failed', 'task:cancelled',
        'task:paused', 'task:resumed',
      ];
      const convEvents = [
        'conversation:created', 'conversation:message', 'conversation:deleted',
      ];

      const handlers: Array<{ source: typeof taskManager; event: string; handler: (data: unknown) => void }> = [];

      for (const event of taskEvents) {
        const handler = (data: unknown) => socket.send(JSON.stringify({ event, data }));
        taskManager.on(event, handler);
        handlers.push({ source: taskManager, event, handler });
      }

      for (const event of convEvents) {
        const handler = (data: unknown) => socket.send(JSON.stringify({ event, data }));
        conversationManager.on(event, handler);
        handlers.push({ source: conversationManager, event, handler });
      }

      socket.on('close', () => {
        for (const { source, event, handler } of handlers) {
          source.removeListener(event, handler);
        }
      });
    });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\nOpenDispatch server running at http://localhost:${PORT}`);
  console.log(`  WebSocket at ws://localhost:${PORT}/ws`);
  console.log(`  Web UI at http://localhost:3000\n`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
