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
      setConversations(prev => {
        const conv = msg.data as Conversation;
        if (prev.some(c => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
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
    // Optimistic removal — don't wait for WebSocket
    setConversations(prev => prev.filter(c => c.id !== id));
    try {
      await api(`/conversations/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      // Refetch to restore if delete failed
      fetchConversations();
    }
  }, [fetchConversations]);

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
        // Deduplicate by message ID
        setMessages(prev => {
          if (prev.some(existing => existing.id === m.id)) return prev;
          return [...prev, m];
        });
      }
    }
  });

  // Track when the LLM is actively generating a response
  useWebSocket((msg) => {
    if (msg.event === 'conversation:turn_complete' || msg.event === 'conversation:error') {
      const data = msg.data as { conversationId: string };
      if (data.conversationId === conversationId) {
        setSending(false);
      }
    }
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || sending) return;
    setSending(true);
    try {
      const result = await api<{ status?: string; error?: string }>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      // If already processing (409), reset sending state
      if (result.error) {
        setSending(false);
      }
      // Otherwise, sending stays true until turn_complete or error arrives via WebSocket
    } catch {
      setSending(false);
    }
  }, [conversationId, sending]);

  return { messages, sending, sendMessage, refetch: fetchMessages };
}
