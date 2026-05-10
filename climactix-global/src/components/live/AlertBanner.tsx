"use client";

import { useEffect, useState } from "react";
import { useAlertStore } from "@/store";
import type { ClimateAlert } from "@/types/live";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: {
    bg: "bg-[#EF4444]/5",
    border: "border-[#EF4444]/30",
    text: "text-[#EF4444]",
    badge: "bg-[#EF4444] text-white",
  },
  high: {
    bg: "bg-[#F97316]/5",
    border: "border-[#F97316]/30",
    text: "text-[#F97316]",
    badge: "bg-[#F97316] text-white",
  },
  medium: {
    bg: "bg-[#F59E0B]/5",
    border: "border-[#F59E0B]/30",
    text: "text-[#F59E0B]",
    badge: "bg-[#F59E0B] text-black",
  },
  low: {
    bg: "bg-[#10B981]/5",
    border: "border-[#10B981]/30",
    text: "text-[#10B981]",
    badge: "bg-[#10B981] text-black",
  },
};

const TYPE_ICON: Record<string, string> = {
  wildfire: "🔥",
  flood: "🌊",
  cyclone: "🌀",
  drought: "☀️",
  heatwave: "🌡️",
  emissions_spike: "🏭",
};

interface AlertBannerProps {
  maxVisible?: number;
  autoHide?: boolean;
  autoHideMs?: number;
}

export default function AlertBanner({
  maxVisible = 1,
  autoHide = true,
  autoHideMs = 12000,
}: AlertBannerProps) {
  const { alerts, dismissedIds, dismissAlert, setAlerts } = useAlertStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch alerts on mount
  useEffect(() => {
    let mounted = true;
    fetch("/api/live/alerts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (mounted && Array.isArray(data?.alerts)) {
          setAlerts(data.alerts);
        }
      })
      .catch(() => null);
    return () => { mounted = false; };
  }, [setAlerts]);

  const visible = alerts
    .filter((a) => a.active && !dismissedIds.has(a.id))
    .slice(0, maxVisible * 3);

  const current: ClimateAlert | undefined = visible[currentIndex % Math.max(visible.length, 1)];

  // Rotate through alerts
  useEffect(() => {
    if (!visible.length || !autoHide) return;
    const t = setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % visible.length);
    }, autoHideMs);
    return () => clearTimeout(t);
  }, [currentIndex, visible.length, autoHide, autoHideMs]);

  if (!current) return null;

  const styles = SEVERITY_STYLES[current.severity] ?? SEVERITY_STYLES.medium;

  return (
    <div
      className={`border-b ${styles.border} ${styles.bg} px-0 overflow-hidden`}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex-shrink-0 text-[8px] font-bold uppercase tracking-widest px-2 py-1 ${styles.badge}`}
          >
            {current.severity.toUpperCase()} ALERT
          </span>
          <span className="text-sm flex-shrink-0">{TYPE_ICON[current.type] ?? "⚠️"}</span>
          <span className={`text-xs font-semibold truncate ${styles.text}`}>
            {current.title}
          </span>
          <span className="text-gray-500 text-xs truncate hidden sm:block">
            — {current.region}
          </span>
          <span className="text-[9px] text-gray-600 hidden md:block flex-shrink-0">
            {current.source}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {visible.length > 1 && (
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">
              {(currentIndex % visible.length) + 1} / {visible.length}
            </span>
          )}
          <button
            onClick={() => dismissAlert(current.id)}
            className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
