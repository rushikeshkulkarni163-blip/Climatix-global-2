"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle, Activity, Flame, Droplets, Wind,
  RefreshCw, WifiOff, Globe
} from "lucide-react";
import RiskBadgeT from "@/components/terminal/RiskBadgeT";

type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";

const TEMP_SERIES = [
  { year: "2000", anomaly: 0.42 }, { year: "2002", anomaly: 0.56 },
  { year: "2004", anomaly: 0.47 }, { year: "2006", anomaly: 0.61 },
  { year: "2008", anomaly: 0.54 }, { year: "2010", anomaly: 0.72 },
  { year: "2012", anomaly: 0.65 }, { year: "2014", anomaly: 0.75 },
  { year: "2016", anomaly: 1.01 }, { year: "2018", anomaly: 0.83 },
  { year: "2020", anomaly: 1.02 }, { year: "2022", anomaly: 0.89 },
  { year: "2024", anomaly: 1.45 }, { year: "2026", anomaly: 1.52 },
];

const SCENARIO_COMPARISON = [
  { name: "1.5°C", revenueRisk: 8.2,  ebitdaImpact: 12.4, assetImpairment: 5.1,  color: "#63C982" },
  { name: "2°C",   revenueRisk: 15.7, ebitdaImpact: 22.8, assetImpairment: 11.3, color: "#4DA3FF" },
  { name: "3°C",   revenueRisk: 31.4, ebitdaImpact: 48.6, assetImpairment: 24.7, color: "#D8913F" },
  { name: "4°C+",  revenueRisk: 56.1, ebitdaImpact: 84.2, assetImpairment: 48.9, color: "#FF5B5B" },
];

const FALLBACK_SECTOR_RISK = [
  { sector: "Oil & Gas",     physical: 82, transition: 91, esg: 28 },
  { sector: "Utilities",     physical: 74, transition: 68, esg: 52 },
  { sector: "Real Estate",   physical: 78, transition: 42, esg: 45 },
  { sector: "Agriculture",   physical: 85, transition: 38, esg: 35 },
  { sector: "Manufacturing", physical: 62, transition: 71, esg: 48 },
  { sector: "Financials",    physical: 34, transition: 58, esg: 62 },
  { sector: "Technology",    physical: 28, transition: 32, esg: 71 },
];

const FALLBACK_HOTSPOTS = [
  { region: "South & SE Asia",    risk: "CRITICAL" as RiskLevel, overallScore: 82, var: "$48.2B" },
  { region: "Sub-Saharan Africa", risk: "CRITICAL" as RiskLevel, overallScore: 76, var: "$22.7B" },
  { region: "MENA Region",        risk: "HIGH"     as RiskLevel, overallScore: 68, var: "$31.4B" },
  { region: "US Gulf Coast",      risk: "HIGH"     as RiskLevel, overallScore: 71, var: "$19.8B" },
  { region: "Mediterranean",      risk: "HIGH"     as RiskLevel, overallScore: 65, var: "$16.3B" },
  { region: "Amazon Basin",       risk: "MEDIUM"   as RiskLevel, overallScore: 54, var: "$8.4B"  },
];

const ASSET_EXPOSURE = [
  { name: "Thermal Power Plants",   value: 44.2, risk: "CRITICAL" as RiskLevel },
  { name: "Coastal Infrastructure", value: 31.8, risk: "HIGH"     as RiskLevel },
  { name: "Agricultural Land",      value: 22.6, risk: "HIGH"     as RiskLevel },
  { name: "Fossil Fuel Reserves",   value: 18.3, risk: "CRITICAL" as RiskLevel },
  { name: "Urban Real Estate",      value: 14.7, risk: "MEDIUM"   as RiskLevel },
];

const GLOBAL_METRICS = [
  { label: "GLOBAL PHYSICAL RISK",  value: "68.4", sub: "Index score",   color: "#FF5B5B", trend: "+2.1" },
  { label: "TRANSITION RISK",       value: "54.2", sub: "Index score",   color: "#D8913F", trend: "+5.8" },
  { label: "ESG INTEGRITY",         value: "41.7", sub: "Global avg",    color: "#4DA3FF", trend: "-1.3" },
  { label: "CLIMATE VaR",           value: "$2.4T",sub: "Portfolio",     color: "#FF5B5B", trend: "+$340B" },
  { label: "STRANDED ASSET RISK",   value: "23.8%",sub: "Global",        color: "#D8913F", trend: "+1.2pp" },
  { label: "CARBON BUDGET LEFT",    value: "380Gt",sub: "vs 1.5°C path", color: "#63C982", trend: "-22Gt/yr" },
];

function IntelTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; dataKey?: string; name?: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#111C2B", border: "1px solid #253649", padding: "8px 12px", fontSize: "11px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "#DDE7F2" }}>
          {p.name ?? p.dataKey}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function RiskTerminalPage() {
  const [activeScenario, setActiveScenario] = useState("2°C");
  const [offline, setOffline]               = useState(false);
  const [loading, setLoading]               = useState(false);

  const PHYS_HAZARDS = [
    { icon: Flame,    label: "HEAT STRESS",    score: 78, trend: "+4.2", color: "#FF5B5B" },
    { icon: Droplets, label: "FLOOD RISK",     score: 71, trend: "+2.8", color: "#4DA3FF" },
    { icon: Wind,     label: "STORM INTENSITY",score: 64, trend: "+1.9", color: "#70D8FF" },
    { icon: Activity, label: "WILDFIRE RISK",  score: 69, trend: "+5.1", color: "#D8913F" },
  ];

  return (
    <div style={{ padding: "0", minHeight: "100%" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>CLIMATE RISK TERMINAL — PHYSICAL + TRANSITION INTELLIGENCE</div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", margin: 0 }}>Global Climate Risk Command Center</h1>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["1.5°C", "2°C", "3°C", "4°C+"].map(s => (
            <button key={s} onClick={() => setActiveScenario(s)} style={{
              padding: "4px 10px",
              fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
              background: activeScenario === s ? "#4DA3FF" : "transparent",
              color: activeScenario === s ? "#000" : "#62758C",
              border: `1px solid ${activeScenario === s ? "#4DA3FF" : "#1E2C3D"}`,
              cursor: "pointer", transition: "all 0.12s ease",
            }}>
              {s}
            </button>
          ))}
          <button onClick={() => setLoading(l => !l)} style={{ padding: "5px", background: "#152235", border: "1px solid #1E2C3D", cursor: "pointer", color: "#62758C" }}>
            <RefreshCw size={13} />
          </button>
          {offline && (
            <div style={{ display: "flex", gap: 4, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#D8913F" }}>
              <WifiOff size={10} /> OFFLINE
            </div>
          )}
        </div>
      </div>

      {/* Global KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderBottom: "1px solid #1E2C3D" }}>
        {GLOBAL_METRICS.map((m, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRight: i < 5 ? "1px solid #1E2C3D" : "none", background: "#0F1722" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: m.color, fontWeight: 600 }}>{m.trend}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{m.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 260px", gap: 0, minHeight: "calc(100vh - 260px)" }}>

        {/* Left: Charts */}
        <div style={{ borderRight: "1px solid #1E2C3D", display: "flex", flexDirection: "column" }}>

          {/* Temperature anomaly */}
          <div style={{ padding: "0", borderBottom: "1px solid #1E2C3D" }}>
            <div className="intel-header">
              <Activity size={11} style={{ color: "#4DA3FF" }} />
              TEMPERATURE ANOMALY — HISTORICAL + NGFS PROJECTION
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>NASA GISS / HadCRUT5 · Baseline 1850–1900</span>
            </div>
            <div style={{ height: 200, padding: "12px 12px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TEMP_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#FF5B5B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#FF5B5B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1E2C3D" />
                  <XAxis dataKey="year" tick={{ fontSize: 8, fill: "#3D506A", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "#3D506A", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} unit="°C" />
                  <Tooltip content={<IntelTooltip />} />
                  <Area type="monotone" dataKey="anomaly" name="Temp Anomaly (°C)" stroke="#FF5B5B" strokeWidth={1.5} fill="url(#tempGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector risk */}
          <div style={{ flex: 1 }}>
            <div className="intel-header">
              <Globe size={11} style={{ color: "#4DA3FF" }} />
              SECTOR PHYSICAL vs. TRANSITION RISK
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>Climactix Intelligence Engine</span>
            </div>
            <div style={{ height: 200, padding: "12px 12px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FALLBACK_SECTOR_RISK} margin={{ top: 4, right: 8, bottom: 20, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 6" stroke="#1E2C3D" vertical={false} />
                  <XAxis dataKey="sector" tick={{ fontSize: 8, fill: "#3D506A", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 8, fill: "#3D506A", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip content={<IntelTooltip />} />
                  <Bar dataKey="physical"   name="Physical Risk"   fill="#FF5B5B" radius={[1,1,0,0]} maxBarSize={14} />
                  <Bar dataKey="transition" name="Transition Risk" fill="#D8913F" radius={[1,1,0,0]} maxBarSize={14} />
                  <Bar dataKey="esg"        name="ESG Score"       fill="#63C982" radius={[1,1,0,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Physical hazard row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid #1E2C3D" }}>
            {PHYS_HAZARDS.map((h, i) => (
              <div key={h.label} style={{ padding: "10px 14px", borderRight: i < 3 ? "1px solid #1E2C3D" : "none" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <h.icon size={12} style={{ color: h.color }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.12em" }}>{h.label}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: h.color }}>{h.score}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#FF5B5B", fontWeight: 600 }}>▲ {h.trend}</span>
                </div>
                <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden", marginTop: 6 }}>
                  <div style={{ width: `${h.score}%`, height: "100%", background: h.color, borderRadius: 1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Hotspots + Stranded */}
        <div style={{ borderRight: "1px solid #1E2C3D", display: "flex", flexDirection: "column" }}>
          <div className="intel-header">
            <AlertTriangle size={11} style={{ color: "#FF5B5B" }} />
            GEOGRAPHIC HOTSPOTS
          </div>
          {FALLBACK_HOTSPOTS.map(h => (
            <div key={h.region} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", transition: "background 0.12s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#DDE7F2" }}>{h.region}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>Score {h.overallScore} · VaR {h.var}</div>
              </div>
              <RiskBadgeT level={h.risk} />
            </div>
          ))}

          <div className="intel-header" style={{ marginTop: "auto" }}>
            <Activity size={11} style={{ color: "#D8913F" }} />
            STRANDED ASSET RISK
          </div>
          {ASSET_EXPOSURE.map(a => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #1E2C3D" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "#8CA3BA", marginBottom: 3 }}>{a.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ width: `${(a.value / 50) * 100}%`, height: "100%", background: a.risk === "CRITICAL" ? "#FF5B5B" : "#D8913F", borderRadius: 1 }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: a.risk === "CRITICAL" ? "#FF5B5B" : "#D8913F", whiteSpace: "nowrap" }}>${a.value}B</span>
                </div>
              </div>
              <RiskBadgeT level={a.risk} />
            </div>
          ))}
        </div>

        {/* Right: Scenario comparison */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="intel-header">
            <Activity size={11} style={{ color: "#4DA3FF" }} />
            SCENARIO COMPARISON
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>NGFS P.IV</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", padding: "8px 12px", borderBottom: "1px solid #1E2C3D" }}>
            IPCC AR6 / NGFS Phase IV · NiGEM macro model
          </div>

          {SCENARIO_COMPARISON.map(s => (
            <div key={s.name} onClick={() => setActiveScenario(s.name)} style={{
              padding: "12px 14px",
              borderBottom: "1px solid #1E2C3D",
              cursor: "pointer",
              background: activeScenario === s.name ? "#152235" : "transparent",
              borderLeft: activeScenario === s.name ? `2px solid ${s.color}` : "2px solid transparent",
              transition: "all 0.12s ease",
            }}
              onMouseEnter={e => { if (activeScenario !== s.name) (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { if (activeScenario !== s.name) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: s.color }}>{s.name} Pathway</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {[
                  { label: "REV RISK", val: `${s.revenueRisk}%`,     color: "#FF5B5B" },
                  { label: "EBITDA",   val: `${s.ebitdaImpact}%`,    color: "#D8913F" },
                  { label: "ASSET",    val: `${s.assetImpairment}%`, color: "#C9A227" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "#0F1722", border: "1px solid #1E2C3D", padding: "4px 6px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.10em" }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Source attribution */}
          <div style={{ padding: "12px 14px", marginTop: "auto", borderTop: "1px solid #1E2C3D" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 8 }}>DATA SOURCES</div>
            {[
              "Physical risk: IPCC AR6 · NGFS P.IV",
              "Temp anomaly: NASA GISS / HadCRUT5",
              "Sector risk: Climactix Engine",
              "Alerts: Regulatory Intelligence Layer",
            ].map(s => (
              <div key={s} style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 4 }}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
