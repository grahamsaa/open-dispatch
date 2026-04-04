'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from './useWebSocket';

interface Conversation {
  id: string;
  title: string;
  model: string | null;
  workingDirectory: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  createdAt: number;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api<Conversation[]>('/conversations');
      setConversations(data.reverse());
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useWebSocket((msg) => {
    if (msg.event === 'conversation:created') {
      setConversations(prev => [msg.data as Conversation, ...prev]);
    } else if (msg.event === 'conversation:deleted') {
      setConversations(prev => prev.filter(c => c.id !== (msg.data as { id: string }).id));
    }
  });

  const createConversation = useCallback(async (model?: string, workingDirectory?: string) => {
    return api<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ model, workingDirectory }),
    });
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await api(`/conversations/${id}`, { method: 'DELETE' });
  }, []);

  return { conversations, loading, createConversation, deleteConversation, refetch: fetchConversations };
}

export function useConversationMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api<ConversationMessage[]>(`/conversations/${conversationId}/messages`);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  useWebSocket((msg) => {
    if (msg.event === 'conversation:message') {
      const m = msg.data as ConversationMessage & { conversationId: string };
      if (m.conversationId === conversationId) {
        setMessages(prev => [...prev, m]);
      }
    }
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || sending) return;
    setSending(true);
    try {
      await api(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    } finally {
      setSending(false);
    }
  }, [conversationId, sending]);

  return { messages, sending, sendMessage, refetch: fetchMessages };
}
