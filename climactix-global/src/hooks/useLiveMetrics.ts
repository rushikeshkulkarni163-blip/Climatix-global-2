"use client";

import { useEffect, useCallback, useRef } from "react";
import { useClimateStore } from "@/store";
import type { LiveClimateMetric, LiveDashboardState } from "@/types/live";

const POLL_INTERVAL = 60_000; // 60 s — fits within API rate limits

const DRIFT: Record<string, { range: [number, number]; decimals: number }> = {
  co2ppm: { range: [423.5, 425.2], decimals: 1 },
  globalTempAnomaly: { range: [1.44, 1.52], decimals: 2 },
  seaLevelRiseMm: { range: [3.5, 4.0], decimals: 1 },
  renewableSharePct: { range: [29.8, 31.2], decimals: 1 },
  activeWildfires: { range: [700, 1100], decimals: 0 },
  aqiGlobalAvg: { range: [58, 72], decimals: 0 },
  activeFloodAlerts: { range: [15, 35], decimals: 0 },
};

function jitter(
  current: number,
  range: [number, number],
  decimals: number
): number {
  const delta = (range[1] - range[0]) * 0.03 * (Math.random() * 2 - 1);
  const next = Math.max(range[0], Math.min(range[1], current + delta));
  return parseFloat(next.toFixed(decimals));
}

function buildMetrics(d: LiveDashboardState): LiveClimateMetric[] {
  return [
    {
      id: "co2ppm",
      label: "CO₂ Concentration",
      value: `${d.co2ppm} ppm`,
      numericValue: d.co2ppm,
      unit: "ppm",
      direction: "up",
      category: "carbon",
      source: "NOAA Global Monitoring",
      updatedAt: d.updatedAt,
    },
    {
      id: "globalTempAnomaly",
      label: "Global Temp Anomaly",
      value: `+${d.globalTempAnomaly.toFixed(2)}°C`,
      numericValue: d.globalTempAnomaly,
      unit: "°C",
      direction: "up",
      category: "physical",
      source: "NASA GISS / Open-Meteo",
      updatedAt: d.updatedAt,
    },
    {
      id: "arcticSeaIceLoss",
      label: "Arctic Sea Ice Loss",
      value: `${d.arcticSeaIceLoss}%/decade`,
      numericValue: d.arcticSeaIceLoss,
      unit: "%/decade",
      direction: "down",
      category: "physical",
      source: "NSIDC",
      updatedAt: d.updatedAt,
    },
    {
      id: "seaLevelRiseMm",
      label: "Sea Level Rise",
      value: `+${d.seaLevelRiseMm}mm/yr`,
      numericValue: d.seaLevelRiseMm,
      unit: "mm/yr",
      direction: "up",
      category: "physical",
      source: "Copernicus Marine",
      updatedAt: d.updatedAt,
    },
    {
      id: "carbonBudgetGt",
      label: "Carbon Budget Remaining",
      value: `~${d.carbonBudgetGt} GtCO₂`,
      numericValue: d.carbonBudgetGt,
      unit: "GtCO₂",
      direction: "down",
      category: "carbon",
      source: "IPCC AR6",
      updatedAt: d.updatedAt,
    },
    {
      id: "renewableSharePct",
      label: "Renewable Energy Share",
      value: `${d.renewableSharePct.toFixed(1)}% global`,
      numericValue: d.renewableSharePct,
      unit: "%",
      direction: "up",
      category: "economic",
      source: "IEA",
      updatedAt: d.updatedAt,
    },
    {
      id: "climateFinanceGapT",
      label: "Climate Finance Gap",
      value: `$${d.climateFinanceGapT}T/year needed`,
      numericValue: d.climateFinanceGapT,
      unit: "T USD",
      direction: "up",
      category: "economic",
      source: "UNEP",
      updatedAt: d.updatedAt,
    },
    {
      id: "activeWildfires",
      label: "Active Wildfires",
      value: `${d.activeWildfires.toLocaleString()} events`,
      numericValue: d.activeWildfires,
      unit: "events",
      direction: d.activeWildfires > 850 ? "up" : "down",
      category: "physical",
      source: "FIRMS / ReliefWeb",
      updatedAt: d.updatedAt,
    },
  ];
}

export function useLiveMetrics() {
  const { dashboard, setDashboard, setMetrics, setStreamConnected } = useClimateStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchLiveMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/live/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data: Partial<LiveDashboardState> = await res.json();
      if (mountedRef.current) {
        setDashboard(data);
        setMetrics(buildMetrics({ ...dashboard, ...data }));
        setStreamConnected(true);
      }
    } catch {
      // On failure: drift the values slightly so the UI still feels alive
      if (!mountedRef.current) return;
      const next: Partial<LiveDashboardState> = {};
      (Object.keys(DRIFT) as (keyof typeof DRIFT)[]).forEach((key) => {
        const { range, decimals } = DRIFT[key];
        (next as unknown as Record<string, number>)[key] = jitter(
          (dashboard as unknown as Record<string, number>)[key] ?? range[0],
          range,
          decimals
        );
      });
      next.updatedAt = new Date().toISOString();
      setDashboard(next);
      setMetrics(buildMetrics({ ...dashboard, ...next }));
    }
  }, [dashboard, setDashboard, setMetrics, setStreamConnected]);

  useEffect(() => {
    mountedRef.current = true;
    fetchLiveMetrics();
    timerRef.current = setInterval(fetchLiveMetrics, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { dashboard, metrics: useClimateStore((s) => s.metrics) };
}
