"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import { useClimateStore } from "@/store";

function useAnimatedNumber(target: number, decimals = 1, duration = 800) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((start + diff * eased).toFixed(decimals)));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
      else prevRef.current = target;
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, decimals, duration]);

  return value;
}

interface StatCardProps {
  label: string;
  value: string;
  rawValue: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dir: "up" | "down" | "stable";
  live?: boolean;
}

function StatCard({ label, rawValue, decimals = 1, prefix = "", suffix = "", dir, live = false }: StatCardProps) {
  const animated = useAnimatedNumber(rawValue, decimals);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [rawValue]);

  return (
    <div className={`t-stat transition-all duration-300 ${flash ? "opacity-80" : "opacity-100"}`}>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-lg font-bold leading-none transition-colors duration-300 ${
            dir === "up" ? "text-white" : dir === "down" ? "text-[#10B981]" : "text-white"
          }`}
        >
          {prefix}{animated}{suffix}
        </span>
        {live && (
          <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse flex-shrink-0" />
        )}
      </div>
      <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-1 leading-tight">
        {label}
      </div>
    </div>
  );
}

interface LiveMetricsBarProps {
  layout?: "hero" | "strip";
}

export default function LiveMetricsBar({ layout = "hero" }: LiveMetricsBarProps) {
  useLiveMetrics(); // triggers polling
  const { dashboard, isStreamConnected } = useClimateStore();

  if (layout === "strip") {
    return (
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide py-1">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isStreamConnected ? "bg-[#10B981] animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
            {isStreamConnected ? "LIVE" : "CACHED"}
          </span>
        </div>
        {STRIP_METRICS.map(({ id, label, prefix, suffix, decimals, dir }) => (
          <div key={id} className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-[9px] font-bold ${
                dir === "up" ? "text-[#EF4444]" : "text-[#10B981]"
              }`}
            >
              {dir === "up" ? "▲" : "▼"}
            </span>
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">{label}:</span>
            <span className="text-[10px] font-bold text-white">
              {prefix}
              {parseFloat(
                (dashboard as unknown as Record<string, number>)[id]?.toFixed(decimals) ?? "0"
              )}
              {suffix}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      <StatCard
        label="CO₂ ppm"
        value={`${dashboard.co2ppm}`}
        rawValue={dashboard.co2ppm}
        decimals={1}
        dir="up"
        live={isStreamConnected}
      />
      <StatCard
        label="Temp Anomaly"
        value={`+${dashboard.globalTempAnomaly}°C`}
        rawValue={dashboard.globalTempAnomaly}
        decimals={2}
        prefix="+"
        suffix="°C"
        dir="up"
        live={isStreamConnected}
      />
      <StatCard
        label="Active Wildfires"
        value={`${dashboard.activeWildfires}`}
        rawValue={dashboard.activeWildfires}
        decimals={0}
        dir="up"
        live={isStreamConnected}
      />
      <StatCard
        label="Renewable %"
        value={`${dashboard.renewableSharePct}%`}
        rawValue={dashboard.renewableSharePct}
        decimals={1}
        suffix="%"
        dir="up"
        live={isStreamConnected}
      />
    </div>
  );
}

const STRIP_METRICS = [
  { id: "co2ppm", label: "CO₂", prefix: "", suffix: " ppm", decimals: 1, dir: "up" as const },
  { id: "globalTempAnomaly", label: "Temp Δ", prefix: "+", suffix: "°C", decimals: 2, dir: "up" as const },
  { id: "renewableSharePct", label: "Renewable", prefix: "", suffix: "%", decimals: 1, dir: "up" as const },
  { id: "activeWildfires", label: "Wildfires", prefix: "", suffix: "", decimals: 0, dir: "up" as const },
];
