"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AssessmentFormData, AssetType } from "@/types";

interface Step3Props {
  data: AssessmentFormData["physicalAssets"];
  lat: number;
  lng: number;
  onChange: (d: AssessmentFormData["physicalAssets"]) => void;
}

const ASSET_TYPES: { id: AssetType; label: string; icon: string }[] = [
  { id: "manufacturing", label: "Manufacturing", icon: "🏭" },
  { id: "office", label: "Office", icon: "🏢" },
  { id: "warehouse", label: "Warehouse", icon: "📦" },
  { id: "farm", label: "Agricultural", icon: "🌾" },
  { id: "coastal", label: "Coastal", icon: "🌊" },
  { id: "data-center", label: "Data Center", icon: "💻" },
  { id: "retail", label: "Retail", icon: "🏪" },
];

export default function Step3Assets({ data, lat, lng, onChange }: Step3Props) {
  const [fetching, setFetching] = useState(false);
  const set = <K extends keyof typeof data>(key: K, val: typeof data[K]) =>
    onChange({ ...data, [key]: val });

  const toggleAsset = (id: AssetType) => {
    const current = data.assetTypes;
    const updated = current.includes(id)
      ? current.filter((a) => a !== id)
      : [...current, id];
    set("assetTypes", updated);
  };

  const autoFetch = async () => {
    if (!lat || !lng) return;
    setFetching(true);
    try {
      const [tempRes, nasaRes] = await Promise.all([
        fetch(`/api/climate/temperature?lat=${lat}&lng=${lng}`),
        fetch(`/api/climate/nasa-power?lat=${lat}&lng=${lng}`),
      ]);
      const tempData = await tempRes.json() as { data: { daily?: { temperature_2m_max?: number[] } } };
      const nasaData = await nasaRes.json() as { data: { humidity: number } };

      const temps = tempData.data?.daily?.temperature_2m_max ?? [];
      const heatDays = temps.filter((t: number) => t > 35).length;
      const humidity = nasaData.data?.humidity ?? 65;
      const waterStress = humidity > 80 ? 0.2 : humidity > 50 ? 0.5 : 0.8;

      onChange({
        ...data,
        heatStressDays: heatDays,
        waterStressIndex: +waterStress.toFixed(2),
      });
    } catch {
      // Keep existing values
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="label">Asset Types (select all that apply)</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASSET_TYPES.map(({ id, label, icon }) => {
            const active = data.assetTypes.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleAsset(id)}
                className={`p-3 rounded-xl border-2 text-center transition-all text-sm font-medium ${
                  active
                    ? "border-brand-teal bg-brand-bg text-brand-teal"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
                aria-pressed={active}
              >
                <span className="text-xl block mb-1">{icon}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Physical Risk Flags</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "floodZone", label: "Located in Flood Zone", icon: "🌊" },
            { key: "coastalProximity", label: "Within 10km of Coast", icon: "🏖️" },
            { key: "wildfireZone", label: "Wildfire Risk Zone", icon: "🔥" },
            { key: "waterStressRegion", label: "Water-Stressed Region", icon: "💧" },
          ].map(({ key, label, icon }) => {
            const val = data[key as keyof typeof data] as boolean;
            return (
              <button
                key={key}
                type="button"
                onClick={() => set(key as keyof typeof data, !val as never)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  val
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                }`}
                aria-pressed={val}
              >
                <span className="text-lg">{icon}</span>
                {label}
                {val && <span className="ml-auto text-orange-500 font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0" htmlFor="heatDays">Heat Stress Days (days &gt;35°C/year)</label>
            <button
              type="button"
              onClick={autoFetch}
              disabled={fetching || !lat}
              className="text-xs text-brand-teal underline font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              {fetching && <Loader2 className="w-3 h-3 animate-spin" />}
              Auto-fetch from location
            </button>
          </div>
          <input
            id="heatDays"
            type="number"
            className="input-field"
            placeholder="e.g. 12"
            value={data.heatStressDays || ""}
            onChange={(e) => set("heatStressDays", parseInt(e.target.value) || 0)}
            min={0}
            max={365}
          />
        </div>

        <div>
          <label className="label" htmlFor="waterStress">Water Stress Index (0=low, 1=extreme)</label>
          <input
            id="waterStress"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={data.waterStressIndex}
            onChange={(e) => set("waterStressIndex", parseFloat(e.target.value))}
            className="w-full accent-brand-teal mt-3"
            aria-valuetext={`${(data.waterStressIndex * 100).toFixed(0)}%`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span>
            <span className={`font-semibold ${data.waterStressIndex > 0.7 ? "text-red-500" : data.waterStressIndex > 0.4 ? "text-amber-500" : "text-green-500"}`}>
              {(data.waterStressIndex * 100).toFixed(0)}%
            </span>
            <span>Extreme</span>
          </div>
        </div>
      </div>
    </div>
  );
}
