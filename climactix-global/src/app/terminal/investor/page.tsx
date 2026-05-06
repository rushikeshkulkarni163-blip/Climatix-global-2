"use client";

import { useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, ZAxis
} from "recharts";
import { TrendingUp, TrendingDown, Search, Filter, SortAsc } from "lucide-react";
import MetricCard from "@/components/terminal/MetricCard";
import DataPanel from "@/components/terminal/DataPanel";
import RiskBadgeT from "@/components/terminal/RiskBadgeT";

// ── Mock data ─────────────────────────────────────────────────────────────────

const PORTFOLIO = [
  { ticker: "XOM", name: "ExxonMobil", sector: "Oil & Gas", weight: 8.2, climateVar: -18.4, esg: 28, physRisk: "CRITICAL" as const, transRisk: "HIGH" as const, paris: "4°C+", sbti: false },
  { ticker: "NEE", name: "NextEra Energy", sector: "Utilities", weight: 6.8, climateVar: -4.2, esg: 74, physRisk: "MEDIUM" as const, transRisk: "LOW" as const, paris: "1.5°C", sbti: true },
  { ticker: "BHP", name: "BHP Group", sector: "Mining", weight: 5.4, climateVar: -14.1, esg: 42, physRisk: "HIGH" as const, transRisk: "HIGH" as const, paris: "3°C", sbti: false },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Automotive", weight: 4.9, climateVar: +3.8, esg: 68, physRisk: "LOW" as const, transRisk: "MINIMAL" as const, paris: "1.5°C", sbti: true },
  { ticker: "VWS", name: "Vestas Wind", sector: "Renewables", weight: 4.2, climateVar: +2.1, esg: 81, physRisk: "LOW" as const, transRisk: "MINIMAL" as const, paris: "1.5°C", sbti: true },
  { ticker: "BA", name: "Boeing Co.", sector: "Aerospace", weight: 3.8, climateVar: -8.7, esg: 38, physRisk: "MEDIUM" as const, transRisk: "HIGH" as const, paris: "3°C", sbti: false },
  { ticker: "ADM", name: "Archer-Daniels", sector: "Agriculture", weight: 3.5, climateVar: -11.2, esg: 44, physRisk: "HIGH" as const, transRisk: "MEDIUM" as const, paris: "2°C", sbti: false },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", weight: 7.1, climateVar: -6.4, esg: 52, physRisk: "LOW" as const, transRisk: "MEDIUM" as const, paris: "2°C", sbti: false },
  { ticker: "MSFT", name: "Microsoft Corp", sector: "Technology", weight: 9.4, climateVar: +1.4, esg: 86, physRisk: "LOW" as const, transRisk: "LOW" as const, paris: "1.5°C", sbti: true },
  { ticker: "REI", name: "Ring Energy Inc.", sector: "Oil & Gas", weight: 2.1, climateVar: -22.6, esg: 21, physRisk: "CRITICAL" as const, transRisk: "CRITICAL" as const, paris: "4°C+", sbti: false },
];

const ESG_RADAR = [
  { dimension: "Environmental", portfolio: 54, benchmark: 62 },
  { dimension: "Social", portfolio: 58, benchmark: 55 },
  { dimension: "Governance", portfolio: 61, benchmark: 67 },
  { dimension: "Climate Risk", portfolio: 42, benchmark: 58 },
  { dimension: "Disclosure", portfolio: 49, benchmark: 61 },
  { dimension: "Net Zero", portfolio: 38, benchmark: 54 },
];

const SECTOR_EXPOSURE = [
  { sector: "Technology", weight: 14.3, climateVar: -2.1, esg: 79 },
  { sector: "Financials", weight: 12.4, climateVar: -8.1, esg: 55 },
  { sector: "Oil & Gas", weight: 10.3, climateVar: -20.5, esg: 25 },
  { sector: "Utilities", weight: 8.9, climateVar: -6.2, esg: 68 },
  { sector: "Mining", weight: 6.2, climateVar: -13.4, esg: 42 },
  { sector: "Renewables", weight: 5.8, climateVar: +2.4, esg: 80 },
  { sector: "Agriculture", weight: 4.8, climateVar: -11.8, esg: 44 },
  { sector: "Aerospace", weight: 3.8, climateVar: -9.1, esg: 38 },
];

const VAR_TIMELINE = [
  { year: "2025", conservative: -4.2, moderate: -8.6, severe: -18.4 },
  { year: "2027", conservative: -5.8, moderate: -12.1, severe: -24.8 },
  { year: "2030", conservative: -8.4, moderate: -17.8, severe: -34.2 },
  { year: "2035", conservative: -11.2, moderate: -23.4, severe: -44.8 },
  { year: "2040", conservative: -14.8, moderate: -31.2, severe: -57.1 },
  { year: "2050", conservative: -19.4, moderate: -42.8, severe: -74.3 },
];

const PARIS_ALIGNMENT = [
  { label: "1.5°C Aligned", count: 3, pct: 24.5, color: "#10B981" },
  { label: "2°C Aligned", count: 2, pct: 10.6, color: "#F59E0B" },
  { label: "3°C Trajectory", count: 2, pct: 9.3, color: "#F97316" },
  { label: "4°C+ Trajectory", count: 3, pct: 10.3, color: "#EF4444" },
];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2">
      <div className="text-[9px] font-bold text-gray-500 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-bold text-gray-800">{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvestorDashboardPage() {
  const [searchQ, setSearchQ] = useState("");
  const [sortCol, setSortCol] = useState<"esg" | "climateVar" | "weight">("climateVar");

  const filteredPortfolio = PORTFOLIO
    .filter((h) =>
      h.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      h.ticker.toLowerCase().includes(searchQ.toLowerCase()) ||
      h.sector.toLowerCase().includes(searchQ.toLowerCase())
    )
    .sort((a, b) => {
      if (sortCol === "esg") return b.esg - a.esg;
      if (sortCol === "climateVar") return a.climateVar - b.climateVar;
      return b.weight - a.weight;
    });

  const totalClimateVar = PORTFOLIO.reduce((s, h) => s + h.climateVar * h.weight / 100, 0).toFixed(2);
  const avgEsg = Math.round(PORTFOLIO.reduce((s, h) => s + h.esg, 0) / PORTFOLIO.length);
  const sbtiCount = PORTFOLIO.filter((h) => h.sbti).length;
  const highRiskPct = (PORTFOLIO.filter((h) => h.physRisk === "CRITICAL" || h.physRisk === "HIGH").reduce((s, h) => s + h.weight, 0)).toFixed(1);

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            INVESTOR DASHBOARD / PORTFOLIO INTELLIGENCE
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Climate Portfolio Risk & ESG Intelligence
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Paris Alignment · Climate VaR · ESG Scoring · Stranded Asset Detection · Benchmarking
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Portfolio Climate VaR (2050)"
          value={`${totalClimateVar}%`}
          sub="Weighted avg"
          trend="down"
          change="-2.4pp vs Q3"
          upIsBad
        />
        <MetricCard
          label="Avg ESG Score"
          value={`${avgEsg}/100`}
          sub="Portfolio weighted"
          trend="up"
          change="+3.2 pts"
          upIsBad={false}
        />
        <MetricCard
          label="SBTi-Committed Holdings"
          value={`${sbtiCount}/${PORTFOLIO.length}`}
          sub={`${((sbtiCount / PORTFOLIO.length) * 100).toFixed(0)}% of holdings`}
          trend="up"
          change="+2 this quarter"
        />
        <MetricCard
          label="High+Critical Risk Exposure"
          value={`${highRiskPct}%`}
          sub="By portfolio weight"
          trend="up"
          change="+1.8pp"
          upIsBad
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Portfolio holdings table */}
        <div className="col-span-12 xl:col-span-8">
          <DataPanel
            label="PORTFOLIO HOLDINGS"
            title="Climate Risk Screening"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Search..."
                    className="pl-6 pr-3 py-1 text-[10px] border border-gray-200 bg-white w-32 focus:outline-none focus:border-gray-400"
                  />
                </div>
                <button className="flex items-center gap-1 px-2 py-1 text-[10px] border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors">
                  <SortAsc className="w-3 h-3" /> Sort
                </button>
              </div>
            }
            noPad
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      { key: "ticker", label: "Ticker" },
                      { key: "name", label: "Company" },
                      { key: "sector", label: "Sector" },
                      { key: "weight", label: "Weight" },
                      { key: "climateVar", label: "Climate VaR" },
                      { key: "esg", label: "ESG Score" },
                      { key: "physRisk", label: "Physical Risk" },
                      { key: "transRisk", label: "Transition Risk" },
                      { key: "paris", label: "Paris Align." },
                      { key: "sbti", label: "SBTi" },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => ["esg", "climateVar", "weight"].includes(key) && setSortCol(key as "esg" | "climateVar" | "weight")}
                        className={`text-left px-3 py-2.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest ${
                          ["esg", "climateVar", "weight"].includes(key) ? "cursor-pointer hover:text-gray-700" : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPortfolio.map((h) => (
                    <tr key={h.ticker} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-gray-900">{h.ticker}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-medium">{h.name}</td>
                      <td className="px-3 py-2.5 text-gray-500">{h.sector}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-700">{h.weight}%</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {h.climateVar > 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                          <span className={`font-bold ${h.climateVar > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {h.climateVar > 0 ? "+" : ""}{h.climateVar}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100">
                            <div
                              className={`h-1.5 ${h.esg >= 70 ? "bg-emerald-400" : h.esg >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${h.esg}%` }}
                            />
                          </div>
                          <span className="font-bold text-gray-700">{h.esg}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><RiskBadgeT level={h.physRisk} /></td>
                      <td className="px-3 py-2.5"><RiskBadgeT level={h.transRisk} /></td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[9px] font-bold ${
                          h.paris === "1.5°C" ? "text-emerald-600" :
                          h.paris === "2°C" ? "text-amber-600" :
                          h.paris === "3°C" ? "text-orange-600" : "text-red-600"
                        }`}>{h.paris}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {h.sbti ? (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5">YES</span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataPanel>
        </div>

        {/* ESG Radar + Paris alignment */}
        <div className="col-span-12 xl:col-span-4 space-y-4">

          {/* ESG Radar */}
          <DataPanel label="ESG BENCHMARKING" title="Portfolio vs. Benchmark">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={ESG_RADAR}>
                  <PolarGrid stroke="#F3F4F6" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 8, fill: "#9CA3AF" }} />
                  <Radar name="Portfolio" dataKey="portfolio" stroke="#0A1F44" fill="#0A1F44" fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Benchmark" dataKey="benchmark" stroke="#10B981" fill="#10B981" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                <div className="w-3 h-0.5 bg-[#0A1F44]" /><span>Portfolio</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                <div className="w-3 h-0.5 bg-[#10B981]" /><span>Benchmark</span>
              </div>
            </div>
          </DataPanel>

          {/* Paris Alignment */}
          <DataPanel label="PARIS ALIGNMENT" title="Portfolio Breakdown by Temperature Pathway">
            <div className="space-y-2.5">
              {PARIS_ALIGNMENT.map(({ label, count, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="font-semibold text-gray-700">{label}</span>
                    <span className="text-gray-500">{count} holdings · {pct}% AUM</span>
                  </div>
                  <div className="h-2 bg-gray-100">
                    <div className="h-2 transition-all" style={{ width: `${pct * 2}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

        {/* Climate VaR evolution */}
        <div className="col-span-12 lg:col-span-8">
          <DataPanel label="PORTFOLIO STRESS TEST" title="Climate Value-at-Risk — 3 Scenario Bands (2025–2050)">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={VAR_TIMELINE} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="conservative" name="Conservative" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="moderate" name="Moderate" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="6 2" />
                  <Line type="monotone" dataKey="severe" name="Severe" stroke="#EF4444" strokeWidth={2} dot={false} strokeDasharray="2 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>

        {/* Sector exposure */}
        <div className="col-span-12 lg:col-span-4">
          <DataPanel label="SECTOR BREAKDOWN" title="Climate Risk by Sector Allocation" noPad>
            <div className="divide-y divide-gray-50">
              {SECTOR_EXPOSURE.map((s) => (
                <div key={s.sector} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-gray-700">{s.sector}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-16 h-1 bg-gray-100">
                        <div className="h-1 bg-gray-400" style={{ width: `${s.weight * 4}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-400">{s.weight}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-bold ${s.climateVar > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {s.climateVar > 0 ? "+" : ""}{s.climateVar}%
                    </div>
                    <div className="text-[9px] text-gray-400">VaR</div>
                  </div>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>

      </div>
    </div>
  );
}
