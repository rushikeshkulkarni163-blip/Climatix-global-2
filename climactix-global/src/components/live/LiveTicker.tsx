"use client";

import { useEffect, useRef } from "react";
import { useTickerStore } from "@/store";
import { useTickerFeed } from "@/hooks/useTickerFeed";

const SPEED_MAP = { slow: 60, normal: 40, fast: 22 };

export default function LiveTicker() {
  const { items, isPaused, speed } = useTickerStore();
  const { items: _ } = useTickerFeed(); // triggers polling
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !items.length) return;

    const duration = items.length * SPEED_MAP[speed] * 1000;

    animRef.current?.cancel();
    animRef.current = track.animate(
      [
        { transform: "translateX(0%)" },
        { transform: "translateX(-50%)" },
      ],
      { duration, iterations: Infinity, easing: "linear" }
    );

    return () => animRef.current?.cancel();
  }, [items, speed]);

  useEffect(() => {
    if (!animRef.current) return;
    if (isPaused) animRef.current.pause();
    else animRef.current.play();
  }, [isPaused]);

  const displayed = items.length ? [...items, ...items] : FALLBACK_ITEMS;

  return (
    <div className="bg-[#0A0A0A] border-b border-[#1F1F1F] overflow-hidden">
      <div className="flex items-stretch">
        {/* LIVE badge */}
        <div className="flex-shrink-0 flex items-center bg-[#0A1F44] px-5 border-r border-[#1F1F1F] gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse flex-shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white whitespace-nowrap">
            LIVE DATA
          </span>
        </div>

        {/* Scrolling track */}
        <div
          className="flex-1 py-2.5 overflow-hidden cursor-pointer"
          onMouseEnter={() => useTickerStore.getState().setPaused(true)}
          onMouseLeave={() => useTickerStore.getState().setPaused(false)}
        >
          <div ref={trackRef} className="flex gap-10 whitespace-nowrap w-max">
            {displayed.map((item, i) => (
              <span key={`${item.id}-${i}`} className="inline-flex items-center gap-2 flex-shrink-0">
                <span
                  className={
                    item.dir === "up"
                      ? "text-[#EF4444] font-bold"
                      : item.dir === "down"
                      ? "text-[#10B981] font-bold"
                      : "text-gray-400 font-bold"
                  }
                >
                  {item.dir === "up" ? "▲" : item.dir === "down" ? "▼" : "◆"}
                </span>
                <span className="text-gray-500 uppercase tracking-wider text-[10px]">
                  {item.label}:
                </span>
                <span className="text-white font-semibold text-[11px]">{item.value}</span>
                {item.priority === "critical" && (
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#EF4444] border border-[#EF4444]/30 px-1.5 py-0.5">
                    ALERT
                  </span>
                )}
                <span className="text-[#1F1F1F] mx-2">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback while API loads
const FALLBACK_ITEMS = [
  { id: "f1", label: "Global Avg Temp Anomaly", value: "+1.48°C", dir: "up" as const, category: "physical", priority: "critical" as const },
  { id: "f2", label: "Arctic Sea Ice Loss", value: "-13%/decade", dir: "down" as const, category: "physical", priority: "high" as const },
  { id: "f3", label: "CO₂ Concentration", value: "424 ppm", dir: "up" as const, category: "carbon", priority: "high" as const },
  { id: "f4", label: "Sea Level Rise", value: "+3.7mm/yr", dir: "up" as const, category: "physical", priority: "high" as const },
  { id: "f5", label: "Extreme Weather Events", value: "+5× since 1970", dir: "up" as const, category: "physical", priority: "critical" as const },
  { id: "f6", label: "Global Carbon Budget Remaining", value: "~380 GtCO₂", dir: "down" as const, category: "carbon", priority: "critical" as const },
  { id: "f7", label: "Renewable Energy Share", value: "30.3% global", dir: "up" as const, category: "economic", priority: "medium" as const },
  { id: "f8", label: "Climate Finance Gap", value: "$4.3T/year needed", dir: "up" as const, category: "economic", priority: "high" as const },
];
