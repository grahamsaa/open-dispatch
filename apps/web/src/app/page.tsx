'use client';

import { useState, useRef, useEffect } from 'react';
import { useTasks, useTaskSteps } from '@/hooks/useTasks';
import { useConversations, useConversationMessages } from '@/hooks/useConversations';
import { useModels } from '@/hooks/useModels';
import { api } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300',
  running: 'bg-blue-900/50 text-blue-300',
  completed: 'bg-green-900/50 text-green-300',
  failed: 'bg-red-900/50 text-red-300',
  cancelled: 'bg-gray-800 text-gray-400',
  paused: 'bg-purple-900/50 text-purple-300',
  archived: 'bg-gray-800/50 text-gray-600',
};

const INPUT_PROPS = {
  autoComplete: 'off' as const,
  autoCorrect: 'off' as const,
  autoCapitalize: 'off' as const,
  spellCheck: false,
};

type Panel = 'threads' | 'chat' | 'tasks';

export default function Home() {
  const [panel, setPanel] = useState<Panel>('chat');
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  function selectThread(id: string) {
    setSelectedConv(id);
    setPanel('chat');
  }

  function viewTask(id: string) {
    setSelectedTask(id);
    setPanel('tasks');
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-gray-100">
      <ModelBar />

      {/* Mobile nav */}
      <div className="flex border-b border-gray-800 md:hidden">
        {(['threads', 'chat', 'tasks'] as Panel[]).map(p => (
          <button key={p} onClick={() => setPanel(p)}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide ${
              panel === p ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500'
            }`}>
            {p}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Threads sidebar */}
        <div className={`${panel === 'threads' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-72 md:min-w-[18rem] border-r border-gray-800 bg-gray-950`}>
          <ThreadList selectedId={selectedConv} onSelect={selectThread} />
        </div>

        {/* Chat panel */}
        <div className={`${panel === 'chat' ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
          {selectedConv ? (
            <ChatPanel conversationId={selectedConv} onViewTask={viewTask} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm p-4 text-center">
              Select a thread or create a new one
            </div>
          )}
        </div>

        {/* Tasks panel */}
        <div className={`${panel === 'tasks' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 md:min-w-[20rem] border-l border-gray-800 bg-gray-950`}>
          <TasksPanel selectedId={selectedTask} onSelect={viewTask} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Thread List (left sidebar)
// ═══════════════════════════════════════════════

function ThreadList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { conversations, createConversation, deleteConversation } = useConversations();
  const { connected } = useTasks();

  async function handleNew() {
    const conv = await createConversation();
    onSelect(conv.id);
  }

  return (
    <>
      <div className="p-3 border-b border-gray-800 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-xs text-gray-500 flex-1">{connected ? 'Connected' : 'Disconnected'}</span>
        <button onClick={handleNew}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium">
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <div key={conv.id}
            className={`flex items-center border-b border-gray-800/50 ${
              selectedId === conv.id ? 'bg-gray-900' : 'hover:bg-gray-900/50'
            }`}>
            <button onClick={() => onSelect(conv.id)} className="flex-1 text-left p-3 min-w-0">
              <p className="text-sm text-gray-200 truncate">{conv.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{conv.model || 'auto'}</p>
            </button>
            <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
              className="text-gray-700 hover:text-red-400 px-4 py-3 text-lg min-w-[44px] min-h-[44px] flex items-center justify-center">&times;</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// Chat Panel (center)
// ═══════════════════════════════════════════════

function ChatPanel({ conversationId, onViewTask }: { conversationId: string; onViewTask: (id: string) => void }) {
  const { messages, sending, sendMessage } = useConversationMessages(conversationId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { tasks, createTask } = useTasks();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  }

  // Collapse tool calls/results into a single summary line
  const displayMessages = collapseToolMessages(messages);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMessages.map((msg) => (
          <div key={msg.id}
            className={`rounded-lg p-3 text-sm max-w-[90%] group relative ${
              msg.role === 'user' ? 'bg-blue-900/30 border border-blue-800/50 ml-auto'
              : msg.role === 'assistant' ? 'bg-gray-900 border border-gray-800'
              : 'bg-gray-900/50 border border-gray-800/50 text-xs text-gray-500'
            }`}>
            <CopyButton text={msg.content} />
            {msg.role === 'tool_summary' ? (
              <details>
                <summary className="cursor-pointer text-gray-500 text-xs">
                  {msg.toolName} ({msg.stepCount} steps)
                </summary>
                <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {msg.content}
                </pre>
              </details>
            ) : (
              <pre className="whitespace-pre-wrap break-words leading-relaxed text-gray-200">
                {msg.content}
              </pre>
            )}
          </div>
        ))}
        {sending && (
          <div className="text-gray-500 text-sm animate-pulse">Thinking...</div>
        )}
      </div>

      {/* Active tasks indicator */}
      {tasks.filter(t => t.status === 'running' || t.status === 'pending').length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {tasks.filter(t => t.status === 'running').length} running, {tasks.filter(t => t.status === 'pending').length} queued
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="p-3 border-t border-gray-800 flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Message, or describe a task to dispatch..."
          disabled={sending}
          {...INPUT_PROPS}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm" />
        <button type="submit" disabled={!input.trim() || sending}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-5 rounded-lg transition-colors text-sm">
          Send
        </button>
      </form>
    </div>
  );
}

interface DisplayMessage {
  id: string;
  role: string;
  content: string;
  toolName?: string;
  stepCount?: number;
}

function collapseToolMessages(messages: Array<{ id: string; role: string; content: string; toolName: string | null }>): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role === 'tool_call' || msg.role === 'tool_result') {
      // Collect consecutive tool messages into one collapsed group
      const toolMsgs: typeof messages = [];
      while (i < messages.length && (messages[i].role === 'tool_call' || messages[i].role === 'tool_result')) {
        toolMsgs.push(messages[i]);
        i++;
      }
      const names = [...new Set(toolMsgs.filter(m => m.toolName).map(m => m.toolName))];
      const details = toolMsgs.map(m => `[${m.role}${m.toolName ? `: ${m.toolName}` : ''}]\n${m.content}`).join('\n\n');
      result.push({
        id: toolMsgs[0].id,
        role: 'tool_summary',
        content: details,
        toolName: names.join(', ') || 'tools',
        stepCount: toolMsgs.length,
      });
    } else {
      result.push({ id: msg.id, role: msg.role, content: msg.content });
      i++;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════
// Tasks Panel (right sidebar)
// ═══════════════════════════════════════════════

function TasksPanel({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { tasks, cancelTask, archiveTask, deleteTask } = useTasks();

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending' || t.status === 'paused');
  const doneTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">Tasks</span>
        {doneTasks.length > 0 && (
          <button onClick={() => doneTasks.forEach(t => archiveTask(t.id))}
            className="text-xs text-gray-500 hover:text-gray-300">
            Archive all done
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTasks.length > 0 && (
          <div className="border-b border-gray-800">
            <div className="px-3 py-1.5 text-xs text-gray-600 uppercase tracking-wide">Active</div>
            {activeTasks.map(task => (
              <TaskRow key={task.id} task={task} selected={selectedId === task.id}
                onSelect={onSelect} onCancel={cancelTask} onArchive={archiveTask} onDelete={deleteTask} />
            ))}
          </div>
        )}
        {doneTasks.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-gray-600 uppercase tracking-wide">Completed</div>
            {doneTasks.map(task => (
              <TaskRow key={task.id} task={task} selected={selectedId === task.id}
                onSelect={onSelect} onCancel={cancelTask} onArchive={archiveTask} onDelete={deleteTask} />
            ))}
          </div>
        )}
        {tasks.length === 0 && (
          <div className="p-4 text-xs text-gray-600 text-center">No tasks yet</div>
        )}
      </div>

      {/* Task detail drawer */}
      {selectedId && <TaskDetail taskId={selectedId} />}
    </div>
  );
}

function TaskRow({ task, selected, onSelect, onCancel, onArchive, onDelete }: {
  task: { id: string; prompt: string; status: string; model: string | null; createdAt: number };
  selected: boolean;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`border-b border-gray-800/50 ${selected ? 'bg-gray-900' : 'hover:bg-gray-900/30'}`}>
      <button onClick={() => onSelect(task.id)} className="w-full text-left p-3">
        <div className="flex items-start gap-2">
          <p className="text-xs text-gray-300 line-clamp-2 flex-1">{task.prompt}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[task.status]}`}>
            {task.status}
          </span>
        </div>
      </button>
      {selected && (
        <div className="flex gap-1 px-3 pb-2">
          {(task.status === 'running' || task.status === 'pending') && (
            <button onClick={() => onCancel(task.id)} className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded">Cancel</button>
          )}
          {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
            <>
              <button onClick={() => onArchive(task.id)} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded">Archive</button>
              <button onClick={() => onDelete(task.id)} className="text-[10px] px-2 py-0.5 bg-red-900/30 text-red-400 rounded">Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetail({ taskId }: { taskId: string }) {
  const { steps } = useTaskSteps(taskId);
  const { tasks } = useTasks();
  const task = tasks.find(t => t.id === taskId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps]);

  if (!task) return null;

  return (
    <div className="border-t border-gray-800 flex flex-col max-h-[50vh]">
      {task.result && (
        <div className="p-3 border-b border-gray-800 bg-gray-900/50">
          <p className="text-xs text-gray-500 mb-1">Result:</p>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{task.result}</pre>
        </div>
      )}
      {task.error && (
        <div className="p-3 border-b border-gray-800 bg-red-950/20">
          <pre className="text-xs text-red-300 whitespace-pre-wrap max-h-24 overflow-y-auto">{task.error}</pre>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {steps.map(step => (
          <div key={step.id} className={`rounded p-2 text-[11px] ${
            step.type === 'tool_call' ? 'bg-blue-950/20 text-blue-300'
            : step.type === 'tool_result' ? 'bg-gray-900/50 text-gray-500'
            : 'text-gray-400'
          }`}>
            {step.toolName && <span className="font-mono text-[10px] text-gray-600">{step.toolName} </span>}
            <span className="break-words">{step.content.slice(0, 200)}{step.content.length > 200 ? '...' : ''}</span>
          </div>
        ))}
        {steps.length === 0 && task.status === 'running' && (
          <div className="text-xs text-gray-600 animate-pulse p-2">Working...</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Copy Button
// ═══════════════════════════════════════════════

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for iPad/Safari where clipboard API may be restricted
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button onClick={handleCopy}
      className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] transition-all min-w-[44px] min-h-[28px] ${
        copied
          ? 'bg-green-900/50 text-green-400'
          : 'bg-gray-800/80 text-gray-500 md:opacity-0 md:group-hover:opacity-100'
      }`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ═══════════════════════════════════════════════
// Model Bar
// ═══════════════════════════════════════════════

function ModelBar() {
  const { models, loadedModel, globalMaxContext, loadModel, unloadModel } = useModels();
  const [expanded, setExpanded] = useState(false);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [ctxInput, setCtxInput] = useState('32768');
  const [chromeStatus, setChromeStatus] = useState<{ connected: boolean; browser?: string } | null>(null);
  const [chromeLaunching, setChromeLaunching] = useState(false);

  useEffect(() => {
    async function checkChrome() {
      try {
        const data = await api<{ connected: boolean; browser?: string }>('/chrome/status');
        setChromeStatus(data);
      } catch { setChromeStatus({ connected: false }); }
    }
    checkChrome();
    const interval = setInterval(checkChrome, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleChromeLaunch() {
    setChromeLaunching(true);
    try {
      await api('/chrome/launch', { method: 'POST' });
      // Re-check status after a moment
      setTimeout(async () => {
        try {
          const data = await api<{ connected: boolean; browser?: string }>('/chrome/status');
          setChromeStatus(data);
        } catch {}
        setChromeLaunching(false);
      }, 3000);
    } catch {
      setChromeLaunching(false);
    }
  }

  // Build context options dynamically from available models
  const ctxOptions = [4096, 8192, 16384, 32768, 65536, 131072, 262144].filter(v => v <= globalMaxContext);

  async function handleLoad(modelId: string) {
    setLoadingModel(modelId);
    try { await loadModel(modelId, parseInt(ctxInput) || undefined); }
    finally { setLoadingModel(null); }
  }

  async function handleUnload(modelId: string) {
    setLoadingModel(modelId);
    try { await unloadModel(modelId); }
    finally { setLoadingModel(null); }
  }

  function fmtCtx(n?: number): string {
    if (!n) return '-';
    return n >= 1024 ? `${Math.round(n / 1024)}k` : String(n);
  }

  return (
    <div className="border-b border-gray-800 bg-gray-950 relative z-10">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-900/50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${loadedModel ? 'bg-green-500' : 'bg-red-500'}`} />
          {loadedModel ? (
            <span className="text-gray-300 truncate text-xs">
              <span className="font-medium">{loadedModel.id}</span>
              <span className="text-gray-500 ml-2">
                {fmtCtx(loadedModel.loadedContextLength)} / {fmtCtx(loadedModel.maxContextLength)}
              </span>
            </span>
          ) : (
            <span className="text-gray-500 text-xs">No model loaded</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {chromeStatus && (
            <span className={`text-[10px] ${chromeStatus.connected ? 'text-green-600' : 'text-gray-600'}`}>
              {chromeStatus.connected ? 'Chrome' : 'No Chrome'}
            </span>
          )}
          <span className="text-gray-600 text-[10px]">{expanded ? 'close' : 'models'}</span>
        </div>
      </button>

      {expanded && (
        <div className="absolute left-0 right-0 top-full bg-gray-900 border border-gray-800 rounded-b-lg shadow-xl max-h-80 overflow-y-auto z-20">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2 sticky top-0 bg-gray-900">
            <label className="text-[10px] text-gray-500">Context:</label>
            <select value={ctxInput} onChange={(e) => setCtxInput(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
              {ctxOptions.map(v => (
                <option key={v} value={v}>{fmtCtx(v)}</option>
              ))}
            </select>
          </div>
          <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between sticky top-8 bg-gray-900">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${chromeStatus?.connected ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="text-[10px] text-gray-400">
                {chromeStatus?.connected ? `Chrome CDP connected` : 'Chrome CDP not connected'}
              </span>
            </div>
            <button onClick={handleChromeLaunch} disabled={chromeLaunching}
              className="text-[10px] px-2 py-1 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 disabled:opacity-50">
              {chromeLaunching ? 'Launching...' : chromeStatus?.connected ? 'Relaunch' : 'Launch Chrome'}
            </button>
          </div>
          {models.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.state === 'loaded' ? 'bg-green-500' : 'bg-gray-700'}`} />
                <span className={`truncate ${m.state === 'loaded' ? 'text-gray-200' : 'text-gray-500'}`}>{m.id}</span>
                {m.state === 'loaded' && <span className="text-gray-600">{fmtCtx(m.loadedContextLength)}</span>}
                <span className="text-gray-700">max {fmtCtx(m.maxContextLength)}</span>
              </div>
              <button onClick={() => m.state === 'loaded' ? handleUnload(m.id) : handleLoad(m.id)}
                disabled={loadingModel !== null}
                className={`ml-2 px-2 py-1 rounded text-[10px] whitespace-nowrap ${
                  m.state === 'loaded'
                    ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                    : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                } disabled:opacity-50`}>
                {loadingModel === m.id ? '...' : m.state === 'loaded' ? 'Unload' : 'Load'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
