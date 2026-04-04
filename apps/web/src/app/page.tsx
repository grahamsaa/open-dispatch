'use client';

import { useState } from 'react';
import { useTasks, useTaskSteps } from '@/hooks/useTasks';
import { useConversations, useConversationMessages } from '@/hooks/useConversations';
import { api } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300',
  running: 'bg-blue-900/50 text-blue-300',
  completed: 'bg-green-900/50 text-green-300',
  failed: 'bg-red-900/50 text-red-300',
  cancelled: 'bg-gray-800 text-gray-400',
  paused: 'bg-purple-900/50 text-purple-300',
};

type Mode = 'tasks' | 'chat';

export default function Home() {
  const [mode, setMode] = useState<Mode>('tasks');

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode('tasks')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'tasks' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setMode('chat')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'chat' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Chat
        </button>
      </div>

      {mode === 'tasks' ? <TasksView /> : <ChatView />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tasks View
// ═══════════════════════════════════════════════

function TasksView() {
  const { tasks, loading, connected, createTask, cancelTask } = useTasks();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [cwd, setCwd] = useState('');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask(prompt.trim(), model || undefined, cwd || undefined);
      setPrompt('');
      setSelectedTask(task.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function pauseTask(id: string) {
    await api(`/tasks/${id}/pause`, { method: 'POST' });
  }

  async function resumeTask(id: string) {
    await api(`/tasks/${id}/resume`, { method: 'POST' });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a task for your local AI agent..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            rows={4}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSubmit(e); }}
          />
          <div className="flex gap-3">
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="Model (auto-routed)"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
            <input type="text" value={cwd} onChange={(e) => setCwd(e.target.value)}
              placeholder="Working directory"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={!prompt.trim() || submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors">
            {submitting ? 'Creating...' : 'Dispatch Task'}
          </button>
        </form>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Tasks</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No tasks yet. Create one above.</p>
          ) : (
            tasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTask(task.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedTask === task.id ? 'border-blue-500 bg-gray-900' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-200 line-clamp-2">{task.prompt}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[task.status] || 'bg-gray-800 text-gray-400'}`}>
                    {task.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  {task.model && <span>{task.model}</span>}
                  <span>{new Date(task.createdAt).toLocaleTimeString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        {selectedTask ? (
          <TaskDetail taskId={selectedTask} onCancel={cancelTask} onPause={pauseTask} onResume={resumeTask} />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-600">
            Select a task to view details
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDetail({ taskId, onCancel, onPause, onResume }: {
  taskId: string;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const { steps } = useTaskSteps(taskId);
  const { tasks } = useTasks();
  const task = tasks.find(t => t.id === taskId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Task Detail</h2>
        <div className="flex gap-2">
          {task?.status === 'running' && (
            <>
              <button onClick={() => onPause(taskId)}
                className="text-sm px-3 py-1 bg-purple-900/50 text-purple-300 rounded-lg hover:bg-purple-900">
                Pause
              </button>
              <button onClick={() => onCancel(taskId)}
                className="text-sm px-3 py-1 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900">
                Cancel
              </button>
            </>
          )}
          {task?.status === 'paused' && (
            <>
              <button onClick={() => onResume(taskId)}
                className="text-sm px-3 py-1 bg-green-900/50 text-green-300 rounded-lg hover:bg-green-900">
                Resume
              </button>
              <button onClick={() => onCancel(taskId)}
                className="text-sm px-3 py-1 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {task && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-2">
          <p className="text-sm text-gray-300">{task.prompt}</p>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>{task.status}</span>
            {task.model && <span>Model: {task.model}</span>}
          </div>
          {task.result && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Result:</p>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap">{task.result}</pre>
            </div>
          )}
          {task.error && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-red-400 mb-1">Error:</p>
              <pre className="text-sm text-red-300 whitespace-pre-wrap">{task.error}</pre>
            </div>
          )}
        </div>
      )}

      <StepTimeline steps={steps} status={task?.status} />
    </div>
  );
}

function StepTimeline({ steps, status }: { steps: Array<{ id: string; stepNumber: number; type: string; content: string; toolName: string | null }>; status?: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Agent Steps</h3>
      {steps.length === 0 ? (
        <p className="text-gray-600 text-sm">
          {status === 'running' ? 'Waiting for first step...' : status === 'paused' ? 'Paused' : 'No steps recorded.'}
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.id}
              className={`rounded-lg p-3 border text-sm ${
                step.type === 'assistant' ? 'border-gray-700 bg-gray-900'
                : step.type === 'tool_call' ? 'border-blue-900 bg-blue-950/30'
                : 'border-gray-800 bg-gray-950'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono ${
                  step.type === 'assistant' ? 'text-gray-400' :
                  step.type === 'tool_call' ? 'text-blue-400' : 'text-gray-500'
                }`}>
                  {step.type === 'tool_call' && step.toolName ? `tool: ${step.toolName}`
                    : step.type === 'tool_result' ? `result: ${step.toolName}` : 'assistant'}
                </span>
                <span className="text-xs text-gray-600">#{step.stepNumber}</span>
              </div>
              <pre className="text-gray-300 whitespace-pre-wrap break-words text-xs leading-relaxed max-h-64 overflow-y-auto">
                {step.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Chat View
// ═══════════════════════════════════════════════

function ChatView() {
  const { conversations, createConversation, deleteConversation } = useConversations();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [cwd, setCwd] = useState('');

  async function handleNewConversation() {
    const conv = await createConversation(model || undefined, cwd || undefined);
    setSelectedConv(conv.id);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="Model"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          <input type="text" value={cwd} onChange={(e) => setCwd(e.target.value)}
            placeholder="CWD"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <button onClick={handleNewConversation}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors">
          New Conversation
        </button>

        <div className="space-y-1">
          {conversations.map((conv) => (
            <div key={conv.id} className="flex items-center gap-1">
              <button onClick={() => setSelectedConv(conv.id)}
                className={`flex-1 text-left p-3 rounded-lg border transition-colors ${
                  selectedConv === conv.id ? 'border-blue-500 bg-gray-900' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}>
                <p className="text-sm text-gray-200 truncate">{conv.title}</p>
                <p className="text-xs text-gray-500 mt-1">{conv.model} &middot; {new Date(conv.updatedAt).toLocaleTimeString()}</p>
              </button>
              <button onClick={() => deleteConversation(conv.id)}
                className="text-gray-600 hover:text-red-400 p-2 transition-colors" title="Delete">
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedConv ? (
          <ChatPanel conversationId={selectedConv} />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-600">
            Select or create a conversation
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ conversationId }: { conversationId: string }) {
  const { messages, sending, sendMessage } = useConversationMessages(conversationId);
  const [input, setInput] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg) => (
          <div key={msg.id}
            className={`rounded-lg p-3 text-sm ${
              msg.role === 'user' ? 'bg-blue-900/30 border border-blue-900 ml-12'
              : msg.role === 'assistant' ? 'bg-gray-900 border border-gray-700 mr-12'
              : msg.role === 'tool_call' ? 'bg-blue-950/30 border border-blue-900/50 mx-6 text-xs'
              : 'bg-gray-950 border border-gray-800 mx-6 text-xs'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono ${
                msg.role === 'user' ? 'text-blue-400'
                : msg.role === 'assistant' ? 'text-gray-400'
                : msg.role === 'tool_call' ? 'text-blue-400'
                : 'text-gray-500'
              }`}>
                {msg.role === 'tool_call' && msg.toolName ? `tool: ${msg.toolName}`
                  : msg.role === 'tool_result' ? `result: ${msg.toolName}` : msg.role}
              </span>
            </div>
            <pre className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto">
              {msg.content}
            </pre>
          </div>
        ))}
        {sending && (
          <div className="text-gray-500 text-sm animate-pulse pl-3">Thinking...</div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-3 pt-4 border-t border-gray-800">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message..."
          disabled={sending}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          autoFocus />
        <button type="submit" disabled={!input.trim() || sending}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 rounded-lg transition-colors">
          Send
        </button>
      </form>
    </div>
  );
}
