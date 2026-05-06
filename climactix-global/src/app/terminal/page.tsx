"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { AlertTriangle, ArrowUpRight, Activity, Flame, Droplets, Wind } from "lucide-react";
import MetricCard from "@/components/terminal/MetricCard";
import DataPanel from "@/components/terminal/DataPanel";
import SectionHeader from "@/components/terminal/SectionHeader";
import RiskBadgeT from "@/components/terminal/RiskBadgeT";

// ── Mock data ─────────────────────────────────────────────────────────────────

const GLOBAL_RISK_METRICS = [
  { label: "Global Physical Risk Index", value: "68.4", change: "+2.1 YoY", trend: "up" as const, upIsBad: true },
  { label: "Transition Risk Score", value: "54.2", change: "+5.8 YoY", trend: "up" as const, upIsBad: true },
  { label: "ESG Integrity Score", value: "41.7", change: "-1.3 QoQ", trend: "down" as const, upIsBad: false },
  { label: "Climate VaR (Portfolio)", value: "$2.4T", change: "+$340B", trend: "up" as const, upIsBad: true },
  { label: "Stranded Asset Risk", value: "23.8%", change: "+1.2pp", trend: "up" as const, upIsBad: true },
  { label: "Carbon Budget Remaining", value: "380 Gt", change: "-22 Gt/yr", trend: "down" as const, upIsBad: false },
];

const TEMP_SERIES = [
  { year: "2000", anomaly: 0.42 }, { year: "2002", anomaly: 0.56 },
  { year: "2004", anomaly: 0.47 }, { year: "2006", anomaly: 0.61 },
  { year: "2008", anomaly: 0.54 }, { year: "2010", anomaly: 0.72 },
  { year: "2012", anomaly: 0.65 }, { year: "2014", anomaly: 0.75 },
  { year: "2016", anomaly: 1.01 }, { year: "2018", anomaly: 0.83 },
  { year: "2020", anomaly: 1.02 }, { year: "2022", anomaly: 0.89 },
  { year: "2024", anomaly: 1.48 }, { year: "2026", anomaly: 1.55 },
];

const SECTOR_RISK = [
  { sector: "Oil & Gas", physical: 82, transition: 91, esg: 28 },
  { sector: "Utilities", physical: 74, transition: 68, esg: 52 },
  { sector: "Real Estate", physical: 78, transition: 42, esg: 45 },
  { sector: "Agriculture", physical: 85, transition: 38, esg: 35 },
  { sector: "Manufacturing", physical: 62, transition: 71, esg: 48 },
  { sector: "Financials", physical: 34, transition: 58, esg: 62 },
  { sector: "Technology", physical: 28, transition: 32, esg: 71 },
  { sector: "Healthcare", physical: 31, transition: 29, esg: 68 },
];

const ALERTS = [
  {
    id: 1,
    level: "CRITICAL" as const,
    title: "Flood Risk Escalation — South & SE Asia",
    body: "3-sigma deviation in monsoon intensity projections. 847 assets exposed across 12 portfolios. Estimated VaR: $18.4B.",
    time: "4m ago",
    source: "Physical Risk Engine",
  },
  {
    id: 2,
    level: "HIGH" as const,
    title: "EU Carbon Price Breach — €72/t Threshold",
    body: "EU-ETS carbon allowances crossed the €72/t level. Transition cost exposure update required for 23 industrial holdings.",
    time: "18m ago",
    source: "Transition Engine",
  },
  {
    id: 3,
    level: "HIGH" as const,
    title: "CSRD Non-Compliance Gap — Reporting Deadline T-90",
    body: "8 portfolio companies missing mandatory CSRD value-chain data. Regulatory risk score elevated to HIGH.",
    time: "1h ago",
    source: "Disclosure Engine",
  },
  {
    id: 4,
    level: "MEDIUM" as const,
    title: "Water Stress Escalation — Colorado River Basin",
    body: "NOAA drought severity index at D3 (extreme). 14 agricultural assets in the affected corridor flagged.",
    time: "3h ago",
    source: "Physical Risk Engine",
  },
];

const ASSET_EXPOSURE = [
  { name: "Thermal Power Plants", value: 44.2, risk: "CRITICAL" as const },
  { name: "Coastal Infrastructure", value: 31.8, risk: "HIGH" as const },
  { name: "Agricultural Land", value: 22.6, risk: "HIGH" as const },
  { name: "Fossil Fuel Reserves", value: 18.3, risk: "CRITICAL" as const },
  { name: "Urban Real Estate", value: 14.7, risk: "MEDIUM" as const },
  { name: "Water Infrastructure", value: 9.4, risk: "MEDIUM" as const },
];

const SCENARIO_COMPARISON = [
  { name: "1.5°C", revenueRisk: 8.2, ebitdaImpact: 12.4, assetImpairment: 5.1 },
  { name: "2°C", revenueRisk: 15.7, ebitdaImpact: 22.8, assetImpairment: 11.3 },
  { name: "3°C", revenueRisk: 31.4, ebitdaImpact: 48.6, assetImpairment: 24.7 },
  { name: "4°C+", revenueRisk: 56.1, ebitdaImpact: 84.2, assetImpairment: 48.9 },
];

const GEOGRAPHIC_HOTSPOTS = [
  { region: "South & SE Asia", risk: "CRITICAL" as const, assets: 1240, var: "$48.2B" },
  { region: "Sub-Saharan Africa", risk: "CRITICAL" as const, assets: 890, var: "$22.7B" },
  { region: "MENA Region", risk: "HIGH" as const, assets: 1120, var: "$31.4B" },
  { region: "US Gulf Coast", risk: "HIGH" as const, assets: 640, var: "$19.8B" },
  { region: "Mediterranean Basin", risk: "HIGH" as const, assets: 780, var: "$16.3B" },
  { region: "Amazon Basin", risk: "MEDIUM" as const, assets: 420, var: "$8.4B" },
];

const PHYS_RISK_TYPES = [
  { icon: Flame, label: "Heat Stress", score: 78, trend: "+4.2", up: true },
  { icon: Droplets, label: "Flood Risk", score: 71, trend: "+2.8", up: true },
  { icon: Wind, label: "Storm Intensity", score: 64, trend: "+1.9", up: true },
  { icon: Activity, label: "Wildfire Risk", score: 69, trend: "+5.1", up: true },
];

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey?: string; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2">
      <div className="text-[10px] font-bold text-gray-500 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-xs font-semibold text-gray-800">
          {p.name ?? p.dataKey}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiskTerminalPage() {
  const [activeScenario, setActiveScenario] = useState("2°C");

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            RISK TERMINAL / LIVE INTELLIGENCE
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Global Climate Risk Command Center
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time physical + transition risk intelligence across 140 countries · TCFD-aligned · NGFS Scenarios
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["1.5°C", "2°C", "3°C", "4°C+"].map((s) => (
            <button
              key={s}
              onClick={() => setActiveScenario(s)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                activeScenario === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {GLOBAL_RISK_METRICS.map((m) => (
          <MetricCard key={m.label} {...m} size="sm" />
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Temperature anomaly chart */}
        <div className="col-span-12 lg:col-span-8">
          <DataPanel label="PHYSICAL RISK" title="Global Temperature Anomaly — Historical + Projection">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TEMP_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="°C" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="anomaly"
                    name="Temp Anomaly"
                    stroke="#EF4444"
                    strokeWidth={2}
                    fill="url(#tempGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>

        {/* Physical risk types */}
        <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3 content-start">
          {PHYS_RISK_TYPES.map(({ icon: Icon, label, score, trend, up }) => (
            <div key={label} className="bg-white border border-gray-200 p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className={`text-[9px] font-bold ${up ? "text-red-500" : "text-emerald-500"}`}>
                  {up ? "▲" : "▼"} {trend}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{score}</div>
              <div className="text-[9px] text-gray-400 uppercase tracking-widest">{label}</div>
              <div className="mt-2 h-1 bg-gray-100">
                <div
                  className="h-1 bg-red-400 transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Alerts panel */}
        <div className="col-span-12 lg:col-span-5">
          <DataPanel
            label="RISK ALERTS"
            title="Active Intelligence Signals"
            action={
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">
                {ALERTS.length} ACTIVE
              </span>
            }
            noPad
          >
            <div className="divide-y divide-gray-100">
              {ALERTS.map((alert) => (
                <div key={alert.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                      alert.level === "CRITICAL" ? "text-red-500" :
                      alert.level === "HIGH" ? "text-orange-500" : "text-amber-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-800 leading-snug">{alert.title}</span>
                        <RiskBadgeT level={alert.level} />
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed mb-1.5">{alert.body}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-400">{alert.source}</span>
                        <span className="text-[9px] text-gray-300">·</span>
                        <span className="text-[9px] text-gray-400">{alert.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        {/* Geographic hotspots */}
        <div className="col-span-12 lg:col-span-4">
          <DataPanel label="GEOGRAPHIC EXPOSURE" title="Highest-Risk Regions" noPad>
            <div className="divide-y divide-gray-100">
              {GEOGRAPHIC_HOTSPOTS.map((g) => (
                <div key={g.region} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-gray-800">{g.region}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {g.assets.toLocaleString()} assets · VaR {g.var}
                    </div>
                  </div>
                  <RiskBadgeT level={g.risk} />
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        {/* Scenario comparison */}
        <div className="col-span-12 lg:col-span-3">
          <DataPanel label="SCENARIO ANALYSIS" title="Financial Impact by Pathway">
            <div className="space-y-3">
              {SCENARIO_COMPARISON.map((s) => (
                <div
                  key={s.name}
                  className={`p-3 border transition-all cursor-pointer ${
                    activeScenario === s.name
                      ? "border-gray-900 bg-gray-900"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveScenario(s.name)}
                >
                  <div className={`text-xs font-bold mb-2 ${activeScenario === s.name ? "text-white" : "text-gray-700"}`}>
                    {s.name} Warming Pathway
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className={`text-lg font-bold leading-none ${activeScenario === s.name ? "text-red-400" : "text-red-600"}`}>
                        {s.revenueRisk}%
                      </div>
                      <div className={`text-[8px] uppercase tracking-widest mt-0.5 ${activeScenario === s.name ? "text-gray-400" : "text-gray-400"}`}>
                        Rev Risk
                      </div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold leading-none ${activeScenario === s.name ? "text-orange-400" : "text-orange-600"}`}>
                        {s.ebitdaImpact}%
                      </div>
                      <div className={`text-[8px] uppercase tracking-widest mt-0.5 ${activeScenario === s.name ? "text-gray-400" : "text-gray-400"}`}>
                        EBITDA
                      </div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold leading-none ${activeScenario === s.name ? "text-amber-400" : "text-amber-600"}`}>
                        {s.assetImpairment}%
                      </div>
                      <div className={`text-[8px] uppercase tracking-widest mt-0.5 ${activeScenario === s.name ? "text-gray-400" : "text-gray-400"}`}>
                        Impair.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        {/* Sector risk chart */}
        <div className="col-span-12 lg:col-span-8">
          <DataPanel label="SECTOR INTELLIGENCE" title="Physical vs. Transition Risk by Sector">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={SECTOR_RISK}
                  margin={{ top: 4, right: 8, bottom: 20, left: 0 }}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="sector"
                    tick={{ fontSize: 8, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-30}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="physical" name="Physical Risk" fill="#EF4444" radius={[1, 1, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="transition" name="Transition Risk" fill="#F97316" radius={[1, 1, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="esg" name="ESG Score" fill="#10B981" radius={[1, 1, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>

        {/* Asset exposure */}
        <div className="col-span-12 lg:col-span-4">
          <DataPanel label="STRANDED ASSET RISK" title="Asset Class Exposure ($B)" noPad>
            <div className="divide-y divide-gray-100">
              {ASSET_EXPOSURE.map((a) => (
                <div key={a.name} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 mb-1">{a.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100">
                        <div
                          className={`h-1 ${a.risk === "CRITICAL" ? "bg-red-500" : a.risk === "HIGH" ? "bg-orange-400" : "bg-amber-400"}`}
                          style={{ width: `${(a.value / 50) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 w-12 text-right">
                        ${a.value}B
                      </span>
                    </div>
                  </div>
                  <RiskBadgeT level={a.risk} />
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

      </div>

      {/* ── Risk map placeholder ── */}
      <DataPanel label="GEOSPATIAL INTELLIGENCE" title="Global Asset Risk Map — Live">
        <div className="h-72 bg-[#0A1628] flex items-center justify-center relative overflow-hidden">
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Risk dots */}
          {[
            { top: "35%", left: "72%", size: 14, color: "#EF4444", opacity: 1 }, // SE Asia
            { top: "55%", left: "52%", size: 12, color: "#EF4444", opacity: 0.9 }, // Africa
            { top: "30%", left: "55%", size: 10, color: "#F97316", opacity: 0.85 }, // MENA
            { top: "28%", left: "24%", size: 8, color: "#F97316", opacity: 0.8 }, // US Gulf
            { top: "32%", left: "48%", size: 8, color: "#F97316", opacity: 0.75 }, // Mediterranean
            { top: "60%", left: "32%", size: 7, color: "#F59E0B", opacity: 0.7 }, // Amazon
            { top: "20%", left: "58%", size: 6, color: "#10B981", opacity: 0.6 }, // Europe
            { top: "22%", left: "80%", size: 6, color: "#10B981", opacity: 0.6 }, // East Asia
          ].map((dot, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
                backgroundColor: dot.color,
                opacity: dot.opacity,
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 ${dot.size * 3}px ${dot.color}`,
              }}
            />
          ))}
          <div className="text-center z-10">
            <div className="text-white/30 text-xs font-bold uppercase tracking-widest mb-2">
              Geospatial Risk Map
            </div>
            <div className="text-white/20 text-[10px]">
              Mapbox GL / Deck.gl integration — configure API key in .env.local
            </div>
          </div>
          {/* Legend */}
          <div className="absolute bottom-4 left-4 flex items-center gap-4">
            {[
              { color: "#EF4444", label: "Critical" },
              { color: "#F97316", label: "High" },
              { color: "#F59E0B", label: "Medium" },
              { color: "#10B981", label: "Low" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-white/50 font-semibold uppercase tracking-widest">{label}</span>
              </div>
            ))}
          </div>
          {/* Scenario label */}
          <div className="absolute top-4 right-4">
            <div className="bg-white/10 border border-white/10 px-3 py-1.5">
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
                Scenario: {activeScenario} · 2050
              </span>
            </div>
          </div>
        </div>
      </DataPanel>

    </div>
  );
}
