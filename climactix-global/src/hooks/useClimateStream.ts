"use client";

import { useEffect, useCallback, useRef } from "react";
import { useClimateStore, useTickerStore, useAlertStore } from "@/store";
import type { WebSocketMessage, ClimateAlert, TickerItem } from "@/types/live";

const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/stream")
    : "";

export function useClimateStream() {
  const { setDashboard, setStreamConnected } = useClimateStore();
  const { setItems: setTickerItems } = useTickerStore();
  const { addAlert } = useAlertStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const retries = useRef(0);
  const MAX_RETRIES = 6;

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.type === "data") {
        if (msg.channel === "live_metrics" && msg.payload) {
          setDashboard(msg.payload as Parameters<typeof setDashboard>[0]);
          setStreamConnected(true);
        }
        if (msg.channel === "ticker" && (msg.payload as { items?: TickerItem[] })?.items) {
          setTickerItems((msg.payload as { items: TickerItem[] }).items);
        }
      } else if (msg.type === "alert" && msg.payload) {
        addAlert(msg.payload as ClimateAlert);
      }
    },
    [setDashboard, setStreamConnected, setTickerItems, addAlert]
  );

  const connect = useCallback(() => {
    if (!WS_URL || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retries.current = 0;
        setStreamConnected(true);
        // Subscribe to all channels
        ws.send(JSON.stringify({ type: "subscribe", channel: "live_metrics", timestamp: new Date().toISOString() }));
        ws.send(JSON.stringify({ type: "subscribe", channel: "ticker", timestamp: new Date().toISOString() }));
        ws.send(JSON.stringify({ type: "subscribe", channel: "alerts", timestamp: new Date().toISOString() }));
      };

      ws.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data));
        } catch {
          // Non-JSON frame
        }
      };

      ws.onerror = () => setStreamConnected(false);

      ws.onclose = () => {
        wsRef.current = null;
        setStreamConnected(false);
        if (mountedRef.current && retries.current < MAX_RETRIES) {
          const delay = Math.min(2000 * Math.pow(2, retries.current), 30000);
          retries.current++;
          reconnectRef.current = setTimeout(connect, delay);
        }
      };
    } catch {
      setStreamConnected(false);
    }
  }, [handleMessage, setStreamConnected]);

  useEffect(() => {
    mountedRef.current = true;
    // Attempt WebSocket connection — falls back gracefully if unavailable
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected: useClimateStore((s) => s.isStreamConnected) };
}
