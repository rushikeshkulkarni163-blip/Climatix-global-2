"use client";

import { useState, useEffect } from "react";
import type { TickerItem } from "@/types/live";

const DEFAULT_ITEMS: TickerItem[] = [
  { id: "co2", label: "CO₂ Concentration", value: "424.7 ppm", dir: "up", category: "carbon", priority: "high", source: "NOAA GML" },
  { id: "temp_anomaly", label: "Global Avg Temp Anomaly", value: "+1.48°C", dir: "up", category: "physical", priority: "critical", source: "NASA GISS" },
  { id: "arctic_ice", label: "Arctic Sea Ice Loss", value: "-13%/decade", dir: "down", category: "physical", priority: "high", source: "NSIDC" },
  { id: "sea_level", label: "Sea Level Rise", value: "+3.7mm/yr", dir: "up", category: "physical", priority: "high", source: "Copernicus" },
  { id: "carbon_budget", label: "Global Carbon Budget Remaining", value: "~380 GtCO₂", dir: "down", category: "carbon", priority: "critical", source: "IPCC AR6" },
  { id: "renewable", label: "Renewable Energy Share", value: "30.3% global", dir: "up", category: "economic", priority: "medium", source: "IEA" },
  { id: "climate_finance", label: "Climate Finance Gap", value: "$4.3T/year needed", dir: "up", category: "economic", priority: "high", source: "UNEP" },
  { id: "extreme_weather", label: "Extreme Weather Events", value: "+5× since 1970", dir: "up", category: "physical", priority: "critical", source: "WMO" },
];

export default function TickerAdminPage() {
  const [items, setItems] = useState<TickerItem[]>(DEFAULT_ITEMS);
  const [editing, setEditing] = useState<TickerItem | null>(null);
  const [saved, setSaved] = useState(false);

  function handleEdit(item: TickerItem) {
    setEditing({ ...item });
  }

  function handleSaveEdit() {
    if (!editing) return;
    setItems((prev) =>
      prev.map((i) => (i.id === editing.id ? editing : i))
    );
    setEditing(null);
    flashSaved();
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    flashSaved();
  }

  function handleAdd() {
    const newItem: TickerItem = {
      id: `item_${Date.now()}`,
      label: "New Metric",
      value: "0",
      dir: "up",
      category: "physical",
      priority: "medium",
      source: "Manual",
    };
    setItems((prev) => [...prev, newItem]);
    setEditing(newItem);
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const PRIORITY_COLORS: Record<string, string> = {
    critical: "text-[#EF4444]",
    high: "text-[#F97316]",
    medium: "text-[#F59E0B]",
    low: "text-[#10B981]",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">CONTENT MANAGEMENT</p>
          <h1 className="text-2xl font-bold text-white">Live Ticker Editor</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage the Bloomberg-style intelligence ticker. Changes reflect on the live site.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-[#10B981] text-xs font-bold uppercase tracking-wider animate-pulse">
              ✓ Saved
            </span>
          )}
          <button
            onClick={handleAdd}
            className="bg-white text-black px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Ticker preview */}
      <div className="bg-[#0A0A0A] border border-[#1F1F1F] p-4 overflow-hidden">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">PREVIEW</p>
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
          {items.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-2 flex-shrink-0">
              <span className={item.dir === "up" ? "text-[#EF4444]" : "text-[#10B981]"}>
                {item.dir === "up" ? "▲" : "▼"}
              </span>
              <span className="text-gray-500 text-[10px] uppercase">{item.label}:</span>
              <span className="text-white text-[11px] font-semibold">{item.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Items table */}
      <div className="border border-[#1F1F1F]">
        <div className="grid grid-cols-12 bg-[#0A0A0A] px-4 py-3 border-b border-[#1F1F1F]">
          {["Label", "Value", "Dir", "Priority", "Source", "Actions"].map((h) => (
            <div key={h} className={`text-[9px] font-bold uppercase tracking-widest text-gray-500 ${h === "Label" ? "col-span-3" : h === "Value" ? "col-span-3" : h === "Source" ? "col-span-2" : h === "Actions" ? "col-span-2" : "col-span-1"}`}>
              {h}
            </div>
          ))}
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-12 px-4 py-3 border-b border-[#0D0D0D] hover:bg-[#0A0A0A] transition-colors items-center"
          >
            <div className="col-span-3 text-xs text-white truncate">{item.label}</div>
            <div className="col-span-3 text-xs text-gray-300 font-mono truncate">{item.value}</div>
            <div className="col-span-1">
              <span className={`text-[10px] font-bold ${item.dir === "up" ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                {item.dir === "up" ? "▲ UP" : "▼ DN"}
              </span>
            </div>
            <div className="col-span-1">
              <span className={`text-[9px] font-bold uppercase ${PRIORITY_COLORS[item.priority] ?? "text-gray-400"}`}>
                {item.priority}
              </span>
            </div>
            <div className="col-span-2 text-[9px] text-gray-500 truncate">{item.source}</div>
            <div className="col-span-2 flex items-center gap-3">
              <button
                onClick={() => handleEdit(item)}
                className="text-[9px] text-[#3B82F6] hover:text-white transition-colors uppercase tracking-wider font-bold"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-[9px] text-[#EF4444] hover:text-white transition-colors uppercase tracking-wider font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-[#0A0A0A] border border-[#2A2A2A] w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-white">Edit Ticker Item</h2>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              {(["label", "value", "source"] as const).map((field) => (
                <div key={field}>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                    {field}
                  </label>
                  <input
                    value={(editing as unknown as Record<string, string>)[field] ?? ""}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value } as TickerItem)}
                    className="w-full bg-black border border-[#2A2A2A] text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">Direction</label>
                  <select
                    value={editing.dir}
                    onChange={(e) => setEditing({ ...editing, dir: e.target.value as "up" | "down" | "stable" })}
                    className="w-full bg-black border border-[#2A2A2A] text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="up">▲ Up</option>
                    <option value="down">▼ Down</option>
                    <option value="stable">◆ Stable</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1.5">Priority</label>
                  <select
                    value={editing.priority}
                    onChange={(e) => setEditing({ ...editing, priority: e.target.value as TickerItem["priority"] })}
                    className="w-full bg-black border border-[#2A2A2A] text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-white text-black text-xs font-bold uppercase tracking-widest py-2.5 hover:bg-gray-100 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-6 border border-[#2A2A2A] text-gray-400 text-xs font-bold uppercase tracking-widest py-2.5 hover:border-[#444] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
