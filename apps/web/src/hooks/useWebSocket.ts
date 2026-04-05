'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { wsUrl } from '@/lib/api';

interface WsMessage {
  event: string;
  data: unknown;
}

type Listener = (msg: WsMessage) => void;

// Singleton WebSocket manager — one connection shared across all hooks
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let wsConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
const connectedListeners = new Set<() => void>();

function notifyConnected() {
  connectedListeners.forEach(fn => fn());
}

function ensureConnection() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(wsUrl());
  ws.onopen = () => { wsConnected = true; notifyConnected(); };
  ws.onclose = () => {
    wsConnected = false;
    notifyConnected();
    reconnectTimer = setTimeout(ensureConnection, 2000);
  };
  ws.onerror = () => ws?.close();
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as WsMessage;
      listeners.forEach(fn => fn(msg));
    } catch {}
  };
}

export function useWebSocket(onMessage: Listener) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler: Listener = (msg) => onMessageRef.current(msg);
    listeners.add(handler);
    ensureConnection();
    return () => { listeners.delete(handler); };
  }, []);

  const connected = useSyncExternalStore(
    (cb) => { connectedListeners.add(cb); return () => connectedListeners.delete(cb); },
    () => wsConnected,
    () => false,
  );

  return { connected };
}
