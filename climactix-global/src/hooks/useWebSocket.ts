"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WebSocketMessage } from "@/types/live";

type WSStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (msg: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
  maxReconnects?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectDelay = 3000,
  maxReconnects = 5,
  autoConnect = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        reconnectCount.current = 0;
        onConnectRef.current?.();
        ws.send(JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }));
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(msg);
          onMessageRef.current?.(msg);
        } catch {
          // Non-JSON frame — ignore
        }
      };

      ws.onerror = () => setStatus("error");

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;
        onDisconnectRef.current?.();
        if (reconnectCount.current < maxReconnects) {
          reconnectCount.current += 1;
          reconnectTimer.current = setTimeout(connect, reconnectDelay);
        }
      };
    } catch {
      setStatus("error");
    }
  }, [url, maxReconnects, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
  }, []);

  const send = useCallback((msg: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) =>
      send({ type: "subscribe", channel, timestamp: new Date().toISOString() }),
    [send]
  );

  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [autoConnect, connect]);

  return { status, lastMessage, send, subscribe, connect, disconnect };
}
