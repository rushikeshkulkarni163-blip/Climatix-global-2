"use client";

import type { AssessmentFormData } from "@/types";
import { WARMING_SCENARIOS } from "@/lib/scoring/sectorConfig";

interface Step5Props {
  data: AssessmentFormData["scenario"];
  onChange: (d: AssessmentFormData["scenario"]) => void;
}

export default function Step5Scenario({ data, onChange }: Step5Props) {
  const set = <K extends keyof typeof data>(key: K, val: typeof data[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <div>
        <label className="label">Time Horizon</label>
        <div className="grid grid-cols-3 gap-3">
          {([2030, 2040, 2050] as const).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => set("timeHorizon", yr)}
              className={`p-4 rounded-xl border-2 text-center font-bold transition-all ${
                data.timeHorizon === yr
                  ? "border-brand-teal bg-brand-bg text-brand-teal"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
              aria-pressed={data.timeHorizon === yr}
            >
              <div className="text-2xl">{yr}</div>
              <div className="text-xs font-normal text-gray-400 mt-1">
                {yr - new Date().getFullYear()} years
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Warming Scenario (IPCC)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(WARMING_SCENARIOS).map(([key, scenario]) => (
            <button
              key={key}
              type="button"
              onClick={() => set("warmingScenario", key as typeof data.warmingScenario)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                data.warmingScenario === key
                  ? "border-current"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={
                data.warmingScenario === key
                  ? { borderColor: scenario.color, backgroundColor: `${scenario.color}15`, color: scenario.color }
                  : { color: "#6b7280" }
              }
              aria-pressed={data.warmingScenario === key}
            >
              <div className="font-bold text-lg">{key}°C</div>
              <div className="text-xs mt-1 font-medium">{scenario.rcp}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Paris Agreement target: 1.5°C. Current trajectory: ~2.7°C by 2100.
        </p>
      </div>

      <div>
        <label className="label">Report Type</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "executive", label: "Executive Summary", desc: "High-level insights, 2–3 pages" },
            { value: "technical", label: "Technical Report", desc: "Full methodology, all sections" },
            { value: "investor", label: "Investor Disclosure", desc: "TCFD-format for investors" },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("reportType", value as typeof data.reportType)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                data.reportType === value
                  ? "border-brand-teal bg-brand-bg text-brand-teal"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
              aria-pressed={data.reportType === value}
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs mt-1 opacity-70">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Preferred Units</label>
        <div className="flex gap-3">
          {(["metric", "imperial"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => set("units", unit)}
              className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm capitalize transition-all ${
                data.units === unit
                  ? "border-brand-teal bg-brand-bg text-brand-teal"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
              aria-pressed={data.units === unit}
            >
              {unit} ({unit === "metric" ? "°C, tCO₂e, km" : "°F, tons, miles"})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-brand-bg rounded-xl p-4">
        <h3 className="font-semibold text-brand-navy text-sm mb-2">Analysis Summary</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {[
            ["Time Horizon", `${data.timeHorizon}`],
            ["Warming Scenario", `${data.warmingScenario}°C`],
            ["RCP Pathway", WARMING_SCENARIOS[data.warmingScenario].rcp],
            ["Report Type", data.reportType],
          ].map(([k, v]) => (
            <>
              <dt key={`k-${k}`} className="text-gray-500">{k}</dt>
              <dd key={`v-${k}`} className="font-semibold text-brand-navy">{v}</dd>
            </>
          ))}
        </dl>
      </div>
    </div>
  );
}
