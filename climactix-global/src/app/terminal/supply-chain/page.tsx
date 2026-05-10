"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { CheckCircle2, Clock, ArrowRight, RefreshCw } from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";
import MetricCard from "@/components/terminal/MetricCard";
import RiskBadgeT from "@/components/terminal/RiskBadgeT";

// ── Reference data (GHG Protocol category definitions) ────────────────────────

const SCOPE3_BREAKDOWN = [
  { category: "Purchased Goods & Services", emissions: 485000, pct: 38.2, status: "measured", cat: "Upstream" },
  { category: "Capital Goods", emissions: 142000, pct: 11.2, status: "estimated", cat: "Upstream" },
  { category: "Fuel & Energy (Scope 3)", emissions: 98000, pct: 7.7, status: "measured", cat: "Upstream" },
  { category: "Transportation (Upstream)", emissions: 87000, pct: 6.8, status: "measured", cat: "Upstream" },
  { category: "Waste Generated", emissions: 24000, pct: 1.9, status: "estimated", cat: "Upstream" },
  { category: "Business Travel", emissions: 31000, pct: 2.4, status: "measured", cat: "Upstream" },
  { category: "Employee Commuting", emissions: 18000, pct: 1.4, status: "estimated", cat: "Upstream" },
  { category: "Use of Sold Products", emissions: 312000, pct: 24.6, status: "estimated", cat: "Downstream" },
  { category: "End-of-Life Treatment", emissions: 68000, pct: 5.4, status: "gap", cat: "Downstream" },
  { category: "Processing of Sold Products", emissions: 5000, pct: 0.4, status: "gap", cat: "Downstream" },
];

const TOP_VENDORS = [
  { name: "SteelCorp International", country: "India", spend: 142, scope1: 48200, scope3Contrib: 12.4, risk: "HIGH" as const, verified: false, sbti: false },
  { name: "ChemTech Solutions", country: "China", spend: 98, scope1: 31400, scope3Contrib: 8.1, risk: "CRITICAL" as const, verified: false, sbti: false },
  { name: "Pacific Logistics Group", country: "Singapore", spend: 67, scope1: 18900, scope3Contrib: 4.9, risk: "HIGH" as const, verified: true, sbti: false },
  { name: "Nordic Components AS", country: "Norway", spend: 54, scope1: 6200, scope3Contrib: 1.6, risk: "LOW" as const, verified: true, sbti: true },
  { name: "Midwest Mining Co.", country: "USA", spend: 88, scope1: 42100, scope3Contrib: 10.8, risk: "CRITICAL" as const, verified: false, sbti: false },
  { name: "GreenPackaging Ltd", country: "Germany", spend: 31, scope1: 4100, scope3Contrib: 1.1, risk: "MINIMAL" as const, verified: true, sbti: true },
  { name: "AgriSupply Brazil", country: "Brazil", spend: 76, scope1: 28700, scope3Contrib: 7.4, risk: "HIGH" as const, verified: false, sbti: false },
  { name: "TechMaterials Co.", country: "Taiwan", spend: 45, scope1: 9800, scope3Contrib: 2.5, risk: "MEDIUM" as const, verified: true, sbti: false },
];

const EMISSION_BY_TIER = [
  { tier: "Tier 1 Suppliers", measured: 68, estimated: 22, gap: 10 },
  { tier: "Tier 2 Suppliers", measured: 32, estimated: 38, gap: 30 },
  { tier: "Tier 3 Suppliers", measured: 8, estimated: 28, gap: 64 },
  { tier: "Raw Materials", measured: 4, estimated: 18, gap: 78 },
];

const LOGISTICS_HOTSPOTS = [
  { route: "Shanghai → Rotterdam", mode: "Sea", distance: 19420, emissions: 8420, risk: "MEDIUM" as const },
  { route: "Mumbai → Hamburg", mode: "Sea", distance: 11800, emissions: 5120, risk: "LOW" as const },
  { route: "Chicago → London", mode: "Air", distance: 6370, emissions: 14200, risk: "HIGH" as const },
  { route: "São Paulo → Miami", mode: "Sea", distance: 7800, emissions: 3390, risk: "LOW" as const },
  { route: "Dubai → Singapore", mode: "Sea", distance: 5980, emissions: 2610, risk: "LOW" as const },
  { route: "Beijing → Los Angeles", mode: "Air", distance: 9800, emissions: 21400, risk: "CRITICAL" as const },
];

const TREEMAP_DATA = SCOPE3_BREAKDOWN.slice(0, 7).map((d) => ({
  name: d.category.split(" ").slice(0, 3).join(" "),
  emissions: d.emissions,
  pct: d.pct,
  fill: d.status === "measured" ? "#10B981" : d.status === "estimated" ? "#F59E0B" : "#EF4444",
}));

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2">
      <div className="text-[9px] font-bold text-gray-500 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-[10px] font-semibold text-gray-700">
          {p.name}: {p.value}%
        </div>
      ))}
    </div>
  );
}

function EmissionsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2">
      <div className="text-[10px] font-bold text-gray-800 mb-1">{label}</div>
      <div className="text-[10px] text-gray-500">{payload[0]?.value?.toLocaleString()} tCO₂e</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupplyChainPage() {
  const [activeTab, setActiveTab] = useState<"scope3" | "vendors" | "logistics">("scope3");
  const [liveData, setLiveData]   = useState<{ total_scope3_t?: number; methodology?: string } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [asOf, setAsOf]           = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    fetch("/api/terminal/supply-chain?sector=manufacturing", { cache: "no-store" })
      .then(r => r.json())
      .then((d: { ok?: boolean; data?: { total_scope3_t?: number; methodology?: string }; asOf?: string }) => {
        if (d.ok && d.data) { setLiveData(d.data); setAsOf(d.asOf ?? null); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalScope3 = liveData?.total_scope3_t
    ? liveData.total_scope3_t
    : SCOPE3_BREAKDOWN.reduce((s, d) => s + d.emissions, 0);
  const measuredPct = Math.round(
    SCOPE3_BREAKDOWN.filter(d => d.status === "measured").reduce((s, d) => s + d.pct, 0)
  );
  const highRiskVendors = TOP_VENDORS.filter(v => v.risk === "HIGH" || v.risk === "CRITICAL").length;
  const verifiedVendors = TOP_VENDORS.filter(v => v.verified).length;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            SUPPLY CHAIN INTELLIGENCE / SCOPE 3 ENGINE
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Supply Chain Climate Risk & Scope 3 Mapping
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            GHG Protocol Scope 3 · Vendor Risk Scoring · Logistics Emissions · Tier-2/3 Mapping
            {asOf && <span className="text-emerald-600 font-semibold">· Live · {new Date(asOf).toLocaleTimeString()}</span>}
            {liveData?.methodology && <span className="text-gray-400">· {liveData.methodology}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading} className="p-1.5 border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-all disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        <div className="flex gap-1">
          {(["scope3", "vendors", "logistics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                activeTab === tab
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {tab === "scope3" ? "Scope 3 Map" : tab === "vendors" ? "Vendor Risk" : "Logistics"}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Scope 3 Emissions" value={`${(totalScope3 / 1000).toFixed(0)}K tCO₂e`} sub="All 15 categories" trend="up" change="+4.2% YoY" upIsBad />
        <MetricCard label="Measured Coverage" value={`${measuredPct}%`} sub="of Scope 3 total" trend="up" change="+8pp vs target" />
        <MetricCard label="High-Risk Vendors" value={`${highRiskVendors}/${TOP_VENDORS.length}`} sub="Require action" trend="up" change="+2 flagged" upIsBad />
        <MetricCard label="Verified Suppliers" value={`${verifiedVendors}/${TOP_VENDORS.length}`} sub="Third-party verified" trend="up" change="+1 this month" />
      </div>

      {/* ── SCOPE 3 TAB ── */}
      {activeTab === "scope3" && (
        <div className="grid grid-cols-12 gap-4">

          {/* Scope 3 bar chart */}
          <div className="col-span-12 lg:col-span-7">
            <DataPanel label="SCOPE 3 VISUALIZATION" title="Top Emission Categories (tCO₂e)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TREEMAP_DATA} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 120 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#6B7280" }} axisLine={false} tickLine={false} width={118} />
                    <Tooltip content={<EmissionsTooltip />} />
                    <Bar dataKey="emissions" name="Emissions (tCO₂e)" radius={[0, 2, 2, 0]} maxBarSize={28}>
                      {TREEMAP_DATA.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3">
                {[{ color: "#10B981", label: "Measured" }, { color: "#F59E0B", label: "Estimated" }, { color: "#EF4444", label: "Data Gap" }].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[9px] text-gray-500">
                    <div className="w-3 h-3" style={{ backgroundColor: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>

          {/* Category table */}
          <div className="col-span-12 lg:col-span-5">
            <DataPanel label="CATEGORY BREAKDOWN" title="GHG Protocol Scope 3 Categories" noPad>
              <div className="divide-y divide-gray-50 max-h-[370px] overflow-y-auto">
                {SCOPE3_BREAKDOWN.map((d) => (
                  <div key={d.category} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-gray-700 truncate">{d.category}</div>
                      <div className="text-[9px] text-gray-400">{d.cat} · {d.emissions.toLocaleString()} tCO₂e</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-800">{d.pct}%</div>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${
                        d.status === "measured" ? "text-emerald-700 bg-emerald-50" :
                        d.status === "estimated" ? "text-amber-700 bg-amber-50" :
                        "text-red-700 bg-red-50"
                      }`}>{d.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>

          {/* Tier coverage */}
          <div className="col-span-12">
            <DataPanel label="TIER COVERAGE" title="Emission Measurement by Supply Chain Tier">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={EMISSION_BY_TIER} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 80 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <YAxis type="category" dataKey="tier" tick={{ fontSize: 9, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="measured" name="Measured" stackId="a" fill="#10B981" maxBarSize={20} />
                    <Bar dataKey="estimated" name="Estimated" stackId="a" fill="#F59E0B" maxBarSize={20} />
                    <Bar dataKey="gap" name="Data Gap" stackId="a" fill="#EF4444" maxBarSize={20} radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* ── VENDOR RISK TAB ── */}
      {activeTab === "vendors" && (
        <DataPanel label="VENDOR RISK INTELLIGENCE" title="Supplier Climate Risk Screening" noPad>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Supplier", "Country", "Annual Spend ($M)", "Scope 1 (tCO₂e)", "Scope 3 Contrib.", "Risk Level", "3P Verified", "SBTi"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_VENDORS.map((v) => (
                  <tr key={v.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{v.name}</td>
                    <td className="px-4 py-3 text-gray-500">{v.country}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">${v.spend}M</td>
                    <td className="px-4 py-3 text-gray-700">{v.scope1.toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{v.scope3Contrib}%</td>
                    <td className="px-4 py-3"><RiskBadgeT level={v.risk} /></td>
                    <td className="px-4 py-3">
                      {v.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-300" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.sbti ? (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5">YES</span>
                      ) : (
                        <span className="text-[9px] font-bold text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}

      {/* ── LOGISTICS TAB ── */}
      {activeTab === "logistics" && (
        <div className="space-y-4">
          <DataPanel label="LOGISTICS EMISSIONS" title="High-Emission Transport Routes" noPad>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Route", "Mode", "Distance (km)", "Emissions (kg CO₂)", "Risk Level", "Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LOGISTICS_HOTSPOTS.map((l) => (
                    <tr key={l.route} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800">{l.route}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                          l.mode === "Air" ? "text-red-600 bg-red-50 border border-red-200" : "text-blue-600 bg-blue-50 border border-blue-200"
                        }`}>{l.mode}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{l.distance.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${l.emissions > 10000 ? "text-red-600" : l.emissions > 5000 ? "text-orange-500" : "text-gray-600"}`}>
                          {l.emissions.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3"><RiskBadgeT level={l.risk} /></td>
                      <td className="px-4 py-3">
                        <button className="flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">
                          Optimize <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataPanel>
        </div>
      )}

    </div>
  );
}
