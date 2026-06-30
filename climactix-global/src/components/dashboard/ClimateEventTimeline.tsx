"use client";

import { useState } from "react";
import { CloudRain, Gavel, TrendingUp, Truck, Building, ChevronDown } from "lucide-react";
import Card from "@/components/ds/Card";
import { cn } from "@/lib/utils";
import { TIMELINE_EVENTS, type TimelineEvent } from "@/lib/dashboard/mockData";

const CATEGORY_META: Record<TimelineEvent["category"], { icon: React.ElementType; color: string; label: string }> = {
  weather: { icon: CloudRain, color: "#0B3D91", label: "Extreme Weather" },
  policy: { icon: Gavel, color: "#1E8E3E", label: "Policy" },
  "carbon-price": { icon: TrendingUp, color: "#B45309", label: "Carbon Price" },
  "supply-chain": { icon: Truck, color: "#DC2626", label: "Supply Chain" },
  corporate: { icon: Building, color: "#6B7280", label: "Corporate" },
};

export default function ClimateEventTimeline() {
  const [activeId, setActiveId] = useState<string | null>(TIMELINE_EVENTS[0]?.id ?? null);
  const active = TIMELINE_EVENTS.find((e) => e.id === activeId) ?? null;

  return (
    <Card title="Climate Event Timeline" description="Weather, policy, carbon price, supply chain, and corporate events" padding="md">
      <div className="overflow-x-auto pb-2">
        <div className="relative flex min-w-max gap-0 pt-2">
          <div className="absolute left-0 right-0 top-[22px] h-px bg-ds-border" aria-hidden="true" />
          {TIMELINE_EVENTS.map((event) => {
            const meta = CATEGORY_META[event.category];
            const Icon = meta.icon;
            const isActive = event.id === activeId;
            return (
              <button
                key={event.id}
                onClick={() => setActiveId(isActive ? null : event.id)}
                aria-expanded={isActive}
                className="flex w-44 flex-shrink-0 flex-col items-center gap-2 px-2 pb-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent rounded-md"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform duration-150",
                    isActive && "scale-110"
                  )}
                  style={{ borderColor: meta.color, color: meta.color, background: isActive ? `${meta.color}1A` : "white" }}
                >
                  <Icon size={14} />
                </span>
                <span className="font-ds-body text-[11px] text-ds-muted">
                  {new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className={cn("font-ds-body text-[12px] leading-snug", isActive ? "font-semibold text-ds-text" : "text-ds-text2")}>
                  {event.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div className="mt-2 rounded-lg border border-ds-border bg-ds-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 font-ds-body text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: CATEGORY_META[active.category].color, background: `${CATEGORY_META[active.category].color}14` }}
                >
                  {CATEGORY_META[active.category].label}
                </span>
                <span className="font-ds-body text-[12px] text-ds-muted">
                  {new Date(active.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <h3 className="mt-1.5 font-ds-heading text-[16px] font-bold text-ds-text">{active.title}</h3>
            </div>
            <button
              onClick={() => setActiveId(null)}
              aria-label="Collapse detail"
              className="rounded-md p-1 text-ds-muted hover:bg-white"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <p className="mt-2 font-ds-body text-[14px] text-ds-text">{active.description}</p>
          <p className="mt-2 font-ds-body text-[13px] font-medium text-ds-accent">{active.impact}</p>
        </div>
      )}
    </Card>
  );
}
