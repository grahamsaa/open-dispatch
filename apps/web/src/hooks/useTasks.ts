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
        setTasks(prev => prev.map(t =>
          t.id === (msg.data as { id: string }).id
            ? { ...t, ...(msg.data as Partial<Task>) }
            : t
        ));
        // Refetch to get full updated task
        fetchTasks();
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

  return { tasks, loading, connected, createTask, cancelTask, refetch: fetchTasks };
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

  useEffect(() => { fetchSteps(); }, [fetchSteps]);

  const { connected } = useWebSocket((msg) => {
    if (msg.event === 'task:step') {
      const step = msg.data as TaskStep;
      if (step.taskId === taskId) {
        setSteps(prev => [...prev, step]);
      }
    }
  });

  return { steps, connected, refetch: fetchSteps };
}
