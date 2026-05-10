"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTickerStore } from "@/store";
import type { TickerItem } from "@/types/live";

const POLL_INTERVAL = 45_000;

export function useTickerFeed() {
  const { items, setItems, prependItem } = useTickerStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/live/ticker", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data: { items: TickerItem[]; latestAlert?: TickerItem } = await res.json();
      if (mountedRef.current) {
        setItems(data.items);
        if (data.latestAlert) prependItem(data.latestAlert);
      }
    } catch {
      // No-op — ticker falls back to its current state
    }
  }, [setItems, prependItem]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTicker();
    timerRef.current = setInterval(fetchTicker, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { items };
}
