"use client";

import { Info } from "lucide-react";
import type { AssessmentFormData } from "@/types";
import { SECTOR_CONFIGS } from "@/lib/scoring/sectorConfig";

interface Step2Props {
  data: AssessmentFormData["emissions"];
  industry: AssessmentFormData["companyProfile"]["industry"];
  onChange: (d: AssessmentFormData["emissions"]) => void;
}

export default function Step2Emissions({ data, industry, onChange }: Step2Props) {
  const set = <K extends keyof typeof data>(key: K, val: typeof data[K]) =>
    onChange({ ...data, [key]: val });

  const sector = SECTOR_CONFIGS[industry];
  const benchmark = sector.carbonIntensityBenchmark;

  const totalEmissions = data.scope1 + data.scope2 + data.scope3;

  const handleEstimate = () => {
    const revenueBase = 50_000_000;
    const estimated = (benchmark * revenueBase) / 1_000_000;
    onChange({
      ...data,
      scope1: Math.round(estimated * 0.4),
      scope2: Math.round(estimated * 0.3),
      scope3: Math.round(estimated * 0.3),
      useEstimate: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <strong>Sector benchmark:</strong> {benchmark} tCO₂e per $1M revenue ({sector.label}).
          {" "}
          <button onClick={handleEstimate} className="underline font-semibold hover:text-blue-900">
            Auto-estimate from sector average
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="scope1">Scope 1 Emissions (tCO₂e)</label>
          <input
            id="scope1"
            type="number"
            className="input-field"
            placeholder="Direct emissions"
            value={data.scope1 || ""}
            onChange={(e) => set("scope1", parseFloat(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-gray-400 mt-1">Direct from owned operations</p>
        </div>
        <div>
          <label className="label" htmlFor="scope2">Scope 2 Emissions (tCO₂e)</label>
          <input
            id="scope2"
            type="number"
            className="input-field"
            placeholder="Purchased energy"
            value={data.scope2 || ""}
            onChange={(e) => set("scope2", parseFloat(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-gray-400 mt-1">Purchased electricity/heat</p>
        </div>
        <div>
          <label className="label" htmlFor="scope3">Scope 3 Emissions (tCO₂e)</label>
          <input
            id="scope3"
            type="number"
            className="input-field"
            placeholder="Value chain"
            value={data.scope3 || ""}
            onChange={(e) => set("scope3", parseFloat(e.target.value) || 0)}
            min={0}
          />
          <p className="text-xs text-gray-400 mt-1">Indirect value chain</p>
        </div>
      </div>

      {totalEmissions > 0 && (
        <div className="bg-brand-bg rounded-xl p-4">
          <div className="text-sm font-semibold text-brand-navy mb-2">Total GHG Footprint</div>
          <div className="text-3xl font-bold text-brand-teal">
            {totalEmissions.toLocaleString()} tCO₂e
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="fossil">Fossil Fuel Energy Share (%)</label>
          <input
            id="fossil"
            type="range"
            min={0}
            max={100}
            value={data.fossilFuelPercent}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              set("fossilFuelPercent", val);
              set("renewablePercent", 100 - val);
            }}
            className="w-full accent-brand-teal"
            aria-valuetext={`${data.fossilFuelPercent}%`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0% Fossil</span>
            <span className="font-semibold text-brand-teal">{data.fossilFuelPercent}%</span>
            <span>100% Fossil</span>
          </div>
        </div>

        <div>
          <label className="label">Renewable Energy Share</label>
          <div className="input-field bg-gray-50 flex items-center">
            <span className="text-brand-success font-bold text-lg">{data.renewablePercent}%</span>
            <span className="text-gray-400 ml-2 text-sm">renewable</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Year-over-Year Emissions Trend</label>
        <div className="flex gap-3">
          {(["decreasing", "stable", "increasing"] as const).map((trend) => (
            <button
              key={trend}
              type="button"
              onClick={() => set("emissionsTrend", trend)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                data.emissionsTrend === trend
                  ? trend === "decreasing"
                    ? "bg-green-100 border-green-500 text-green-700"
                    : trend === "stable"
                    ? "bg-amber-50 border-amber-400 text-amber-700"
                    : "bg-red-50 border-red-400 text-red-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {trend === "decreasing" ? "↓ Decreasing" : trend === "stable" ? "→ Stable" : "↑ Increasing"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="intensity">Energy Intensity (kWh per unit output)</label>
        <input
          id="intensity"
          type="number"
          className="input-field"
          placeholder="e.g. 450"
          value={data.energyIntensity || ""}
          onChange={(e) => set("energyIntensity", parseFloat(e.target.value) || 0)}
          min={0}
        />
      </div>
    </div>
  );
}
