'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from './useWebSocket';

interface Task {
  id: string;
  prompt: string;
  status: string;
  model: string | null;
  workingDirectory: string | null;
  createdAt: number;
  updatedAt: number;
  result: string | null;
  error: string | null;
}

interface TaskStep {
  id: string;
  taskId: string;
  stepNumber: number;
  type: string;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  createdAt: number;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api<Task[]>('/tasks');
      setTasks(data.reverse());
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const { connected } = useWebSocket((msg) => {
    switch (msg.event) {
      case 'task:created':
        setTasks(prev => [msg.data as Task, ...prev]);
        break;
      case 'task:started':
      case 'task:completed':
      case 'task:failed':
      case 'task:cancelled':
      case 'task:paused':
      case 'task:resumed':
        fetchTasks();
        break;
      case 'task:archived':
      case 'task:deleted':
        setTasks(prev => prev.filter(t => t.id !== (msg.data as { id: string }).id));
        break;
    }
  });

  const createTask = useCallback(async (prompt: string, model?: string, workingDirectory?: string) => {
    return api<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt, model, workingDirectory }),
    });
  }, []);

  const cancelTask = useCallback(async (id: string) => {
    await api(`/tasks/${id}/cancel`, { method: 'POST' });
  }, []);

  const archiveTask = useCallback(async (id: string) => {
    await api(`/tasks/${id}/archive`, { method: 'POST' });
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await api(`/tasks/${id}`, { method: 'DELETE' });
  }, []);

  return { tasks, loading, connected, createTask, cancelTask, archiveTask, deleteTask, refetch: fetchTasks };
}

export function useTaskSteps(taskId: string | null) {
  const [steps, setSteps] = useState<TaskStep[]>([]);

  const fetchSteps = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await api<TaskStep[]>(`/tasks/${taskId}/steps`);
      setSteps(data);
    } catch (err) {
      console.error('Failed to fetch steps:', err);
    }
  }, [taskId]);

  useEffect(() => {
    setSteps([]);
    fetchSteps();
  }, [fetchSteps]);

  useWebSocket((msg) => {
    if (msg.event === 'task:step') {
      const step = msg.data as TaskStep;
      if (step.taskId === taskId) {
        // Deduplicate by step ID
        setSteps(prev => {
          if (prev.some(s => s.id === step.id)) return prev;
          return [...prev, step];
        });
      }
    }
  });

  return { steps, refetch: fetchSteps };
}
