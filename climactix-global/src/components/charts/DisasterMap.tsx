"use client";

import type { DisasterEvent } from "@/types";
import { AlertTriangle, CloudLightning, Waves, Flame, Wind } from "lucide-react";
import { formatDate } from "@/lib/utils";

const DISASTER_ICONS: Record<string, React.ElementType> = {
  Flood: Waves,
  Storm: CloudLightning,
  Fire: Flame,
  Cyclone: Wind,
  default: AlertTriangle,
};

const DISASTER_COLORS: Record<string, string> = {
  Flood: "#3B82F6",
  Storm: "#8B5CF6",
  Fire: "#EF4444",
  Cyclone: "#F59E0B",
  default: "#6B7280",
};

interface DisasterMapProps {
  disasters: DisasterEvent[];
  country: string;
}

export default function DisasterMap({ disasters, country }: DisasterMapProps) {
  const typeCounts: Record<string, number> = {};
  disasters.forEach((d) => {
    typeCounts[d.type] = (typeCounts[d.type] ?? 0) + 1;
  });

  if (disasters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <AlertTriangle className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm">No recent disaster events for {country}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bubbles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(typeCounts).map(([type, count]) => {
          const color = DISASTER_COLORS[type] ?? DISASTER_COLORS.default;
          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {type} ({count})
            </span>
          );
        })}
      </div>

      {/* Event list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {disasters.slice(0, 10).map((event) => {
          const Icon = DISASTER_ICONS[event.type] ?? DISASTER_ICONS.default;
          const color = DISASTER_COLORS[event.type] ?? DISASTER_COLORS.default;
          return (
            <div
              key={event.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-navy truncate">{event.name}</p>
                <p className="text-xs text-gray-400">
                  {event.type} · {event.date ? event.date.split("T")[0] : "Date unknown"}
                </p>
              </div>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  color,
                  backgroundColor: `${color}15`,
                }}
              >
                {event.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
