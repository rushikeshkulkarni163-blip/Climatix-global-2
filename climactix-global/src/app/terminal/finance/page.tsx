"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from "recharts";
import { TrendingUp, DollarSign, Leaf, Building } from "lucide-react";
import DataPanel from "@/components/terminal/DataPanel";
import MetricCard from "@/components/terminal/MetricCard";

// ── Mock data ─────────────────────────────────────────────────────────────────

const GREEN_BOND_ISSUANCE = [
  { year: "2019", green: 258, social: 142, sustainability: 68, slb: 24 },
  { year: "2020", green: 290, social: 198, sustainability: 91, slb: 36 },
  { year: "2021", green: 522, social: 228, sustainability: 168, slb: 118 },
  { year: "2022", green: 487, social: 184, sustainability: 148, slb: 92 },
  { year: "2023", green: 574, social: 210, sustainability: 172, slb: 108 },
  { year: "2024", green: 612, social: 224, sustainability: 198, slb: 126 },
  { year: "2025E", green: 680, social: 248, sustainability: 218, slb: 148 },
];

const CAPITAL_FLOWS = [
  { region: "Europe", flow: 284, change: +8.2, color: "#10B981" },
  { region: "North America", flow: 186, change: +12.4, color: "#3B82F6" },
  { region: "Asia-Pacific", flow: 142, change: +18.6, color: "#F59E0B" },
  { region: "China", flow: 98, change: +24.2, color: "#EF4444" },
  { region: "Latin America", flow: 34, change: +4.8, color: "#8B5CF6" },
  { region: "MEA", flow: 18, change: +31.4, color: "#F97316" },
];

const CARBON_MARKET = [
  { date: "Jan", ets: 68.4, offset: 12.8, cca: 42.1 },
  { date: "Feb", ets: 71.2, offset: 13.4, cca: 44.8 },
  { date: "Mar", ets: 66.8, offset: 12.1, cca: 43.2 },
  { date: "Apr", ets: 74.6, offset: 14.2, cca: 46.8 },
  { date: "May", ets: 78.2, offset: 15.8, cca: 48.4 },
  { date: "Jun", ets: 72.4, offset: 14.6, cca: 45.6 },
  { date: "Jul", ets: 76.8, offset: 16.2, cca: 47.8 },
  { date: "Aug", ets: 82.4, offset: 17.4, cca: 50.2 },
  { date: "Sep", ets: 79.6, offset: 16.8, cca: 49.4 },
  { date: "Oct", ets: 84.2, offset: 18.2, cca: 52.6 },
];

const ACTIVE_DEALS = [
  { name: "European Green Deal Tranche IV", issuer: "EU Commission", type: "Sovereign Green", amount: 18.2, yield: 3.42, maturity: "2035", rating: "AAA", use: "Clean Energy" },
  { name: "Orsted Green Senior Bond", issuer: "Ørsted A/S", type: "Corporate Green", amount: 2.4, yield: 4.18, maturity: "2032", rating: "BBB+", use: "Offshore Wind" },
  { name: "World Bank IBRD Green Bond", issuer: "World Bank", type: "MDB Green", amount: 4.8, yield: 3.85, maturity: "2030", rating: "AAA", use: "Climate Adaptation" },
  { name: "NextEra Sustainability Bond", issuer: "NextEra Energy", type: "Corporate SLB", amount: 1.6, yield: 4.62, maturity: "2031", rating: "A-", use: "Solar/Wind" },
  { name: "JICA Climate Finance Note", issuer: "JICA", type: "MDB Climate", amount: 3.2, yield: 3.12, maturity: "2028", rating: "AAA", use: "Resilience" },
  { name: "Valeo EV Transition Bond", issuer: "Valeo SA", type: "Corporate Green", amount: 0.8, yield: 5.24, maturity: "2029", rating: "BBB", use: "EV Components" },
  { name: "Brazil Sovereign Green Bond", issuer: "Republic of Brazil", type: "Sovereign Green", amount: 6.4, yield: 7.82, maturity: "2033", rating: "BB-", use: "Amazon Protection" },
];

const SECTOR_ALLOCATION = [
  { name: "Energy", value: 32, color: "#10B981" },
  { name: "Buildings", value: 18, color: "#3B82F6" },
  { name: "Transport", value: 16, color: "#F59E0B" },
  { name: "Water", value: 12, color: "#0EA5E9" },
  { name: "Land Use", value: 10, color: "#22C55E" },
  { name: "Industry", value: 8, color: "#8B5CF6" },
  { name: "Other", value: 4, color: "#9CA3AF" },
];

const CLIMATE_FUNDS = [
  { name: "Green Climate Fund (GCF)", aum: "$13.7B", focus: "Adaptation & Mitigation", yield: "—", geography: "Global South" },
  { name: "Climate Investment Funds", aum: "$8.4B", focus: "Clean Technology", yield: "—", geography: "40+ Countries" },
  { name: "Breakthrough Energy Ventures II", aum: "$1.5B", focus: "Deep Decarbonisation", yield: "Market Rate", geography: "Global" },
  { name: "Brookfield Global Transition Fund", aum: "$15B", focus: "Clean Energy Transition", yield: "~12-15% IRR", geography: "Global" },
  { name: "BlackRock Climate Finance Fund", aum: "$4.2B", focus: "Infrastructure", yield: "8-12% IRR", geography: "OECD" },
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
          <span className="font-bold text-gray-900">{typeof p.value === "number" ? `$${p.value}B` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClimateFinancePage() {
  const [activeTab, setActiveTab] = useState<"bonds" | "carbon" | "funds">("bonds");

  const totalIssuance2025E = GREEN_BOND_ISSUANCE[GREEN_BOND_ISSUANCE.length - 1];
  const totalESG = (totalIssuance2025E.green + totalIssuance2025E.social + totalIssuance2025E.sustainability + totalIssuance2025E.slb);

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.18em] mb-1">
            CLIMATE FINANCE MONITOR / CAPITAL MARKETS
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Sustainable Finance & Climate Capital Flows
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Green Bonds · Carbon Markets · Climate Funds · ESG Capital Flows · CBI Standards
          </p>
        </div>
        <div className="flex gap-1">
          {(["bonds", "carbon", "funds"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                activeTab === tab
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {tab === "bonds" ? "Green Bonds" : tab === "carbon" ? "Carbon Markets" : "Climate Funds"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="ESG Bond Issuance 2025E" value={`$${totalESG}B`} sub="YTD projection" trend="up" change="+14% YoY" />
        <MetricCard label="EU-ETS Carbon Price" value="€84.2/t" sub="Oct 2025" trend="up" change="+23% YTD" />
        <MetricCard label="Climate Finance Gap" value="$4.3T/yr" sub="UNFCCC estimate" trend="up" change="vs $3.8T in 2023" upIsBad />
        <MetricCard label="Total Climate AUM" value="$42.8T" sub="Sustainable assets" trend="up" change="+$6.2T YoY" />
      </div>

      {/* Always visible: issuance chart */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <DataPanel label="MARKET ISSUANCE" title="Global ESG Bond Issuance by Type ($B) — 2019–2025E">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={GREEN_BOND_ISSUANCE} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="B" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="green" name="Green Bonds" stackId="a" fill="#10B981" maxBarSize={36} />
                  <Bar dataKey="social" name="Social Bonds" stackId="a" fill="#3B82F6" maxBarSize={36} />
                  <Bar dataKey="sustainability" name="Sustainability" stackId="a" fill="#F59E0B" maxBarSize={36} />
                  <Bar dataKey="slb" name="SLB" stackId="a" fill="#8B5CF6" maxBarSize={36} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataPanel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <DataPanel label="USE OF PROCEEDS" title="2025 Green Bond Sector Allocation">
            <div className="h-52 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SECTOR_ALLOCATION}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    stroke="none"
                  >
                    {SECTOR_ALLOCATION.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [`${val}%`, name]}
                    contentStyle={{ fontSize: 10, border: "1px solid #E5E7EB" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 min-w-[100px]">
                {SECTOR_ALLOCATION.map(({ name, value, color }) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[9px] text-gray-600">{name}</span>
                    <span className="text-[9px] font-bold text-gray-800 ml-auto">{value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </DataPanel>
        </div>
      </div>

      {/* ── GREEN BONDS TAB ── */}
      {activeTab === "bonds" && (
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <DataPanel label="ACTIVE DEALS" title="Live Green Bond Market — Primary Issuance" noPad>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Issue Name", "Issuer", "Type", "Size ($B)", "Yield", "Maturity", "Rating", "Use of Proceeds"].map((h) => (
                          <th key={h} className="text-left px-3 py-2.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIVE_DEALS.map((d) => (
                        <tr key={d.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-gray-800 max-w-[140px] truncate">{d.name}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{d.issuer}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 whitespace-nowrap">{d.type}</span>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-gray-800">${d.amount}B</td>
                          <td className="px-3 py-2.5 text-gray-700">{d.yield}%</td>
                          <td className="px-3 py-2.5 text-gray-600 font-mono">{d.maturity}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] font-bold ${
                              d.rating.startsWith("AAA") ? "text-emerald-600" :
                              d.rating.startsWith("A") ? "text-blue-600" :
                              d.rating.startsWith("BBB") ? "text-amber-600" : "text-red-600"
                            }`}>{d.rating}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 text-[10px]">{d.use}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataPanel>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <DataPanel label="GEOGRAPHIC CAPITAL FLOWS" title="Sustainable Finance Flows by Region ($B)" noPad>
                <div className="divide-y divide-gray-50">
                  {CAPITAL_FLOWS.map((r) => (
                    <div key={r.region} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-gray-800">{r.region}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-32 h-1.5 bg-gray-100">
                            <div className="h-1.5" style={{ width: `${(r.flow / 300) * 100}%`, backgroundColor: r.color }} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-600">${r.flow}B</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <TrendingUp className="w-3 h-3 text-emerald-500 mb-0.5 ml-auto" />
                        <span className="text-[10px] font-bold text-emerald-600">+{r.change}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DataPanel>
            </div>
          </div>
        </div>
      )}

      {/* ── CARBON MARKETS TAB ── */}
      {activeTab === "carbon" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <DataPanel label="CARBON MARKET PRICES" title="Multi-Market Carbon Price Tracker — 2025 YTD ($/tCO₂e)">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CARBON_MARKET} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="€" />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="ets" name="EU-ETS" stroke="#0A1F44" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="offset" name="Voluntary Offset" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="6 2" />
                    <Line type="monotone" dataKey="cca" name="CA CCA" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DataPanel>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <DataPanel label="MARKET SNAPSHOT" title="Carbon Markets — Live Data">
              <div className="space-y-3">
                {[
                  { market: "EU-ETS (EUA)", price: "€84.20/t", change: "+1.4%", volume: "4.2M lots" },
                  { market: "California CCA", price: "$42.60/t", change: "+0.8%", volume: "1.1M lots" },
                  { market: "RGGI Allowances", price: "$14.80/t", change: "-0.3%", volume: "480K lots" },
                  { market: "Gold Standard VCM", price: "$14.20/t", change: "+2.1%", volume: "280K lots" },
                  { market: "Verra VCS VCM", price: "$8.60/t", change: "-1.2%", volume: "620K lots" },
                  { market: "UK-ETS", price: "£46.40/t", change: "+3.2%", volume: "820K lots" },
                ].map(({ market, price, change, volume }) => (
                  <div key={market} className="p-2.5 border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-gray-800">{market}</span>
                      <span className={`text-[10px] font-bold ${change.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>{change}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-gray-900">{price}</span>
                      <span className="text-[9px] text-gray-400">{volume}</span>
                    </div>
                  </div>
                ))}
              </div>
            </DataPanel>
          </div>
        </div>
      )}

      {/* ── CLIMATE FUNDS TAB ── */}
      {activeTab === "funds" && (
        <DataPanel label="CLIMATE INVESTMENT FUNDS" title="Major Climate Finance Vehicles" noPad>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Fund", "AUM", "Investment Focus", "Target Return", "Geography"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLIMATE_FUNDS.map((f) => (
                  <tr key={f.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-800">{f.name}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{f.aum}</td>
                    <td className="px-4 py-3 text-gray-600">{f.focus}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{f.yield}</td>
                    <td className="px-4 py-3 text-gray-500">{f.geography}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      )}

    </div>
  );
}
