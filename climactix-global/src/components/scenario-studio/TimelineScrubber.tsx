"use client";

import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScenarioStudioStore } from "@/store";
import { PROJECTION_YEARS, type ProjectionYear } from "@/types/scenario-studio";

export default function TimelineScrubber() {
  const horizon = useScenarioStudioStore((s) => s.horizon);
  const setHorizon = useScenarioStudioStore((s) => s.setHorizon);
  const playing = useScenarioStudioStore((s) => s.timelinePlaying);
  const setPlaying = useScenarioStudioStore((s) => s.setTimelinePlaying);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    timer.current = setTimeout(() => {
      const idx = PROJECTION_YEARS.indexOf(horizon);
      const next = PROJECTION_YEARS[(idx + 1) % PROJECTION_YEARS.length];
      setHorizon(next);
      if (next === PROJECTION_YEARS[PROJECTION_YEARS.length - 1]) setPlaying(false);
    }, 1400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, horizon, setHorizon, setPlaying]);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-ds-border bg-ds-card px-4 py-3">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "Pause timeline" : "Play timeline"}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ds-accent text-white transition-colors duration-150 hover:bg-ds-accent-hi"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <div className="flex flex-1 items-center justify-between">
        {PROJECTION_YEARS.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => setHorizon(year as ProjectionYear)}
            className={cn(
              "flex flex-col items-center gap-1.5 font-ds-body text-[12px] font-medium transition-colors duration-150",
              year === horizon ? "text-ds-accent" : "text-ds-muted hover:text-ds-text"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border-2 transition-colors duration-150",
                year === horizon ? "border-ds-accent bg-ds-accent" : "border-ds-border bg-white"
              )}
            />
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}
