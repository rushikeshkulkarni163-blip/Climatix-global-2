"use client";

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/store";
import type { ScenarioKey } from "@/lib/dashboard/mockData";

const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "1.5", label: "1.5°C" },
  { key: "2.0", label: "2°C (Current)" },
  { key: "3.0", label: "3°C" },
  { key: "4.0", label: "4°C" },
];

export default function ScenarioControl() {
  const scenario = useSimulationStore((s) => s.scenario);
  const setScenario = useSimulationStore((s) => s.setScenario);

  return (
    <section id="scenario" className="rounded-lg border border-ds-border bg-ds-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-ds-accent" />
          <h2 className="font-ds-heading text-[15px] font-bold text-ds-text">Scenario Analysis</h2>
          <span className="font-ds-body text-[12px] text-ds-muted">
            Recomputes KPIs, map shading, and charts in real time
          </span>
        </div>

        <div role="radiogroup" aria-label="Climate scenario" className="flex items-center gap-1 rounded-lg border border-ds-border bg-ds-surface p-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              role="radio"
              aria-checked={scenario === s.key}
              onClick={() => setScenario(s.key)}
              className={cn(
                "rounded-md px-3 py-1.5 font-ds-body text-[13px] font-medium transition-colors duration-150",
                scenario === s.key ? "bg-ds-accent text-white" : "text-ds-text2 hover:text-ds-text"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
