"use client";

import { useState, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from "recharts";
import { Play, RefreshCw, Download, Info } from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";
import MetricCard from "@/components/terminal/MetricCard";

// ── Scenario engine ────────────────────────────────────────────────────────────

const NGFS_SCENARIOS = {
  "Net Zero 2050":  { tempBy2050: 1.5, carbonPrice2030: 145, fossilFuelPenalty: 0.85, renewableBonus: 0.92 },
  "Delayed Trans.": { tempBy2050: 1.8, carbonPrice2030: 98, fossilFuelPenalty: 0.72, renewableBonus: 0.80 },
  "Below 2°C":      { tempBy2050: 1.9, carbonPrice2030: 75, fossilFuelPenalty: 0.62, renewableBonus: 0.74 },
  "Current Policy": { tempBy2050: 3.0, carbonPrice2030: 30, fossilFuelPenalty: 0.25, renewableBonus: 0.45 },
  "Hot House World":{ tempBy2050: 4.2, carbonPrice2030: 10, fossilFuelPenalty: 0.08, renewableBonus: 0.20 },
};

type ScenarioKey = keyof typeof NGFS_SCENARIOS;

const SECTORS = [
  "Oil & Gas", "Utilities", "Real Estate", "Manufacturing",
  "Agriculture", "Financial Services", "Transportation", "Technology",
];

function generateTimeline(
  scenario: ScenarioKey,
  sector: string,
  revenue: number,
  ebitdaMargin: number,
  carbonIntensity: number
) {
  const cfg = NGFS_SCENARIOS[scenario];
  const baseFossilDep = sector === "Oil & Gas" ? 0.9 : sector === "Utilities" ? 0.55 : 0.25;
  const years = Array.from({ length: 11 }, (_, i) => 2025 + i * 2.5);

  return years.map((year) => {
    const t = (year - 2025) / 25; // 0..1 over 25 years
    const physicalHit = (cfg.tempBy2050 / 4.2) * t * 0.18;
    const transitionHit = baseFossilDep * t * (1 - cfg.fossilFuelPenalty) * 0.35;
    const opexHit = (carbonIntensity / 1000) * cfg.carbonPrice2030 * t * 0.001;
    const totalImpact = physicalHit + transitionHit + opexHit;
    const revenueAdj = revenue * (1 - totalImpact);
    const ebitdaAdj = revenueAdj * (ebitdaMargin / 100) * (1 - transitionHit * 0.5);

    return {
      year: Math.round(year).toString(),
      revenue: Math.round(revenueAdj),
      ebitda: Math.round(ebitdaAdj),
      physicalCost: Math.round(revenue * physicalHit),
      transitionCost: Math.round(revenue * transitionHit),
      carbonCost: Math.round(revenue * opexHit),
      carbonPrice: Math.round(cfg.carbonPrice2030 * t * 0.9 + 10),
    };
  });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2 min-w-[160px]">
      <div className="text-[9px] font-bold text-gray-500 mb-2">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-[10px] mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-600">{p.name}</span>
          </div>
          <span className="font-bold text-gray-900">
            {typeof p.value === "number" && p.name?.includes("$")
              ? `$${p.value.toLocaleString()}M`
              : typeof p.value === "number"
              ? p.value.toLocaleString()
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SimulationLabPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("Below 2°C");
  const [sector, setSector] = useState("Oil & Gas");
  const [revenue, setRevenue] = useState(5000);
  const [ebitdaMargin, setEbitdaMargin] = useState(24);
  const [carbonIntensity, setCarbonIntensity] = useState(420);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true);

  const cfg = NGFS_SCENARIOS[scenario];
  const timeline = generateTimeline(scenario, sector, revenue, ebitdaMargin, carbonIntensity);
  const last = timeline[timeline.length - 1];
  const first = timeline[0];

  const revenueAtRisk = (((first.revenue - last.revenue) / first.revenue) * 100).toFixed(1);
  const ebitdaAtRisk = (((first.ebitda - last.ebitda) / first.ebitda) * 100).toFixed(1);
  const totalCarbonCost = timeline.reduce((s, d) => s + d.carbonCost, 0);
  const totalTransCost = timeline.reduce((s, d) => s + d.transitionCost, 0);

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => { setIsRunning(false); setHasRun(true); }, 1200);
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            SIMULATION LAB / SCENARIO ENGINE
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Climate Scenario Financial Impact Simulator
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            NGFS-aligned · IPCC AR6 · Physical + Transition Risk · Financial Impact Modeling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            {isRunning ? (
              <><RefreshCw className="w-3 h-3 animate-spin" /> Running...</>
            ) : (
              <><Play className="w-3 h-3" /> Run Simulation</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">

        {/* ── Controls panel ── */}
        <div className="col-span-12 lg:col-span-3">
          <DataPanel label="SIMULATION PARAMETERS" title="Scenario Builder">
            <div className="space-y-5">

              {/* NGFS Scenario */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em] mb-2">
                  NGFS Scenario Pathway
                </label>
                <div className="space-y-1">
                  {(Object.keys(NGFS_SCENARIOS) as ScenarioKey[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScenario(s)}
                      className={`w-full text-left px-3 py-2 text-[10px] font-semibold border transition-all ${
                        scenario === s
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{s}</span>
                        <span className={`text-[8px] font-bold ${
                          NGFS_SCENARIOS[s].tempBy2050 <= 1.5 ? "text-emerald-500" :
                          NGFS_SCENARIOS[s].tempBy2050 <= 2 ? "text-amber-500" : "text-red-500"
                        }`}>
                          +{NGFS_SCENARIOS[s].tempBy2050}°C
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sector */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em] mb-2">
                  Sector
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-gray-900"
                >
                  {SECTORS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Revenue */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em] mb-2">
                  Revenue ($M): <span className="text-gray-800">{revenue.toLocaleString()}</span>
                </label>
                <input
                  type="range" min={100} max={50000} step={100}
                  value={revenue} onChange={(e) => setRevenue(Number(e.target.value))}
                  className="w-full h-1 accent-gray-900"
                />
                <div className="flex justify-between text-[8px] text-gray-400 mt-1">
                  <span>$100M</span><span>$50B</span>
                </div>
              </div>

              {/* EBITDA margin */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em] mb-2">
                  EBITDA Margin: <span className="text-gray-800">{ebitdaMargin}%</span>
                </label>
                <input
                  type="range" min={5} max={60}
                  value={ebitdaMargin} onChange={(e) => setEbitdaMargin(Number(e.target.value))}
                  className="w-full h-1 accent-gray-900"
                />
              </div>

              {/* Carbon intensity */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.14em] mb-2">
                  Carbon Intensity (tCO₂/$M): <span className="text-gray-800">{carbonIntensity}</span>
                </label>
                <input
                  type="range" min={10} max={2000} step={10}
                  value={carbonIntensity} onChange={(e) => setCarbonIntensity(Number(e.target.value))}
                  className="w-full h-1 accent-gray-900"
                />
              </div>

              {/* Scenario params preview */}
              <div className="bg-gray-50 border border-gray-100 p-3 space-y-2">
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Scenario Parameters
                </div>
                {[
                  { label: "Peak Temperature", value: `+${cfg.tempBy2050}°C` },
                  { label: "Carbon Price 2030", value: `$${cfg.carbonPrice2030}/t` },
                  { label: "Fossil Fuel Penalty", value: `${((1 - cfg.fossilFuelPenalty) * 100).toFixed(0)}% haircut` },
                  { label: "Time Horizon", value: "2025–2050" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-[10px]">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-bold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>

            </div>
          </DataPanel>
        </div>

        {/* ── Results ── */}
        <div className="col-span-12 lg:col-span-9 space-y-4">

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Revenue at Risk (2050)"
              value={`${revenueAtRisk}%`}
              sub={`$${Math.round(first.revenue - last.revenue).toLocaleString()}M`}
              trend="down"
              change={`vs baseline`}
              upIsBad
            />
            <MetricCard
              label="EBITDA Impact (2050)"
              value={`${ebitdaAtRisk}%`}
              sub={`$${Math.round(first.ebitda - last.ebitda).toLocaleString()}M`}
              trend="down"
              change={`vs baseline`}
              upIsBad
            />
            <MetricCard
              label="Cumulative Carbon Cost"
              value={`$${Math.round(totalCarbonCost / 1000).toFixed(1)}B`}
              sub="2025–2050 total"
              trend="up"
              change="+12% YoY"
              upIsBad
            />
            <MetricCard
              label="Transition Cost Exposure"
              value={`$${Math.round(totalTransCost / 1000).toFixed(1)}B`}
              sub="Policy + market"
              trend="up"
              change="+8% est."
              upIsBad
            />
          </div>

          {/* Revenue trajectory */}
          <DataPanel label="FINANCIAL IMPACT ENGINE" title="Revenue & EBITDA Trajectory — 2025–2050">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A1F44" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#0A1F44" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="M" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="$ Revenue" stroke="#0A1F44" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                  <Area type="monotone" dataKey="ebitda" name="$ EBITDA" stroke="#10B981" strokeWidth={2} fill="url(#ebitdaGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>

          {/* Cost breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataPanel label="COST WATERFALL" title="Climate Cost Decomposition by Year">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="M" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="physicalCost" name="Physical Cost" stackId="a" fill="#EF4444" maxBarSize={24} />
                    <Bar dataKey="transitionCost" name="Transition Cost" stackId="a" fill="#F97316" maxBarSize={24} />
                    <Bar dataKey="carbonCost" name="Carbon Cost" stackId="a" fill="#F59E0B" maxBarSize={24} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DataPanel>

            <DataPanel label="CARBON MARKET" title="Carbon Price Trajectory ($/tCO₂)">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="$/t" />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={50} stroke="#E5E7EB" strokeDasharray="3 3" label={{ value: "Policy Floor $50", fill: "#9CA3AF", fontSize: 9 }} />
                    <Line
                      type="monotone" dataKey="carbonPrice" name="Carbon Price"
                      stroke="#0A1F44" strokeWidth={2} dot={{ r: 3, fill: "#0A1F44" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DataPanel>
          </div>

        </div>
      </div>

      {/* Scenario comparison table */}
      <DataPanel label="SCENARIO COMPARISON" title="All NGFS Pathways — 2050 Impact Summary" noPad>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pathway</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Temp (2050)</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Carbon Price</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Revenue at Risk</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">EBITDA Impact</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Physical Cost</th>
                <th className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Transition Cost</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(NGFS_SCENARIOS) as ScenarioKey[]).map((s) => {
                const data = generateTimeline(s, sector, revenue, ebitdaMargin, carbonIntensity);
                const last2 = data[data.length - 1];
                const rar = (((data[0].revenue - last2.revenue) / data[0].revenue) * 100).toFixed(1);
                const ear = (((data[0].ebitda - last2.ebitda) / data[0].ebitda) * 100).toFixed(1);
                return (
                  <tr
                    key={s}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${scenario === s ? "bg-gray-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-bold ${scenario === s ? "text-gray-900" : "text-gray-600"}`}>{s}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${NGFS_SCENARIOS[s].tempBy2050 >= 3 ? "text-red-600" : NGFS_SCENARIOS[s].tempBy2050 >= 2 ? "text-amber-600" : "text-emerald-600"}`}>
                        +{NGFS_SCENARIOS[s].tempBy2050}°C
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">${NGFS_SCENARIOS[s].carbonPrice2030}/t</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${Number(rar) > 30 ? "text-red-600" : Number(rar) > 15 ? "text-orange-500" : "text-amber-500"}`}>
                        {rar}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${Number(ear) > 40 ? "text-red-600" : "text-orange-500"}`}>{ear}%</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">${(last2.physicalCost).toLocaleString()}M</td>
                    <td className="px-4 py-3 text-gray-700">${(last2.transitionCost).toLocaleString()}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataPanel>

    </div>
  );
}
