"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Shield, Building2,
  Zap, Droplets, Flame, Wind, Activity, ArrowRight, Info,
  ChevronDown, RefreshCw, BarChart2, Globe
} from "lucide-react";

const COMMAND_METRICS = [
  { label: "PORTFOLIO CLIMATE VaR",    value: "$2.84B",   sub: "95th pct / 1-yr horizon",   color: "#FF5B5B", trend: "+12.3%" },
  { label: "REVENUE AT RISK",          value: "18.4%",    sub: "Across 248 active entities", color: "#D8913F", trend: "+3.1pp" },
  { label: "PHYSICAL RISK EXPOSURE",   value: "ELEVATED", sub: "3 active extreme events",    color: "#D8913F", trend: null },
  { label: "NET-ZERO CREDIBILITY AVG", value: "BBB",      sub: "Across tracked portfolio",   color: "#D8913F", trend: "-1 notch" },
  { label: "CARBON PRICE SENSITIVITY", value: "$180M",    sub: "@$100/t scenario impact",    color: "#4DA3FF", trend: null },
  { label: "STRANDED ASSET RISK",      value: "$0.94B",   sub: "Coal + O&G exposure",        color: "#FF5B5B", trend: "+8.7%" },
];

const PHYSICAL_EVENTS = [
  { id: "E001", type: "FLOOD",    region: "Brahmaputra Basin",        severity: "CRITICAL", entities: 12, impact: "$340M",  status: "ACTIVE" },
  { id: "E002", type: "HEATWAVE", region: "Deccan Plateau",           severity: "HIGH",     entities: 31, impact: "$120M",  status: "ACTIVE" },
  { id: "E003", type: "CYCLONE",  region: "Bay of Bengal",            severity: "HIGH",     entities: 8,  impact: "$210M",  status: "WATCH"  },
  { id: "E004", type: "DROUGHT",  region: "Vidarbha Agriculture Zone",severity: "ELEVATED", entities: 19, impact: "$88M",   status: "ACTIVE" },
  { id: "E005", type: "SEA LEVEL",region: "Mumbai Coastal Strip",     severity: "ELEVATED", entities: 24, impact: "$450M",  status: "MONITOR"},
];

const PORTFOLIO_COMPANIES = [
  { name: "Tata Steel",          sector: "STEEL",       rating: "BBB", physical: 64, transition: 71, clScore: 49, rar: "22.1%", trend: "down" },
  { name: "NTPC Limited",        sector: "POWER",       rating: "BB",  physical: 78, transition: 83, clScore: 38, rar: "31.4%", trend: "down" },
  { name: "Infosys",             sector: "IT SERVICES", rating: "AA",  physical: 28, transition: 22, clScore: 81, rar: "4.2%",  trend: "up"   },
  { name: "Reliance Industries", sector: "ENERGY",      rating: "B",   physical: 71, transition: 88, clScore: 33, rar: "38.7%", trend: "down" },
  { name: "HDFC Bank",           sector: "BANKING",     rating: "A",   physical: 42, transition: 38, clScore: 68, rar: "9.8%",  trend: "flat" },
  { name: "L&T Limited",         sector: "ENGINEERING", rating: "BBB", physical: 55, transition: 61, clScore: 54, rar: "17.3%", trend: "down" },
  { name: "Adani Green",         sector: "RENEWABLES",  rating: "AA",  physical: 38, transition: 18, clScore: 76, rar: "6.1%",  trend: "up"   },
  { name: "Coal India",          sector: "MINING",      rating: "CCC", physical: 82, transition: 95, clScore: 14, rar: "64.2%", trend: "down" },
];

const SCENARIO_DELTA = [
  { scenario: "NGFS 1.5°C NZ 2050",   ebitda: "-8.2%",  rev: "-5.1%",  capex: "+24%", stranded: "$0.4B", color: "#63C982" },
  { scenario: "NGFS 2.0°C Orderly",   ebitda: "-14.7%", rev: "-9.3%",  capex: "+18%", stranded: "$0.9B", color: "#4DA3FF" },
  { scenario: "NGFS 3.0°C Delayed",   ebitda: "-22.1%", rev: "-15.8%", capex: "+11%", stranded: "$1.7B", color: "#D8913F" },
  { scenario: "NGFS Disorderly Trans.",ebitda: "-31.4%", rev: "-23.2%", capex: "+8%",  stranded: "$2.6B", color: "#FF5B5B" },
];

const ACTIONS = [
  { priority: "P1", label: "Divest Coal India — CCC rated, 64% revenue-at-risk",            sector: "PORTFOLIO" },
  { priority: "P1", label: "Brahmaputra flood contingency for 12 exposed entities",          sector: "PHYSICAL"  },
  { priority: "P2", label: "Request NTPC transition plan — BB→B migration risk",             sector: "TRANSITION"},
  { priority: "P2", label: "Engage Reliance on carbon tax — 38.7% RaR at $100/t",           sector: "CARBON"    },
  { priority: "P3", label: "Schedule HDFC supply-chain climate assessment",                  sector: "SUPPLY"    },
];

const RIGHT_PANEL = [
  { key: "REVENUE AT RISK",    val: "$520M",  label: "12-month horizon",          color: "#FF5B5B" },
  { key: "ASSET VULNERABILITY",val: "31.8%",  label: "Assets at elevated risk",   color: "#D8913F" },
  { key: "REG. TRIGGERS",      val: "7",      label: "Regulatory triggers active",color: "#D8913F" },
  { key: "CARBON SENSITIVITY", val: "$180M",  label: "@$100/t carbon price",      color: "#4DA3FF" },
  { key: "SUPPLY CHAIN RISK",  val: "HIGH",   label: "4 critical dependencies",   color: "#FF5B5B" },
  { key: "INSURANCE EXPOSURE", val: "$1.2B",  label: "Uninsurable exposure",      color: "#D8913F" },
];

function RatingBadge({ rating }: { rating: string }) {
  const map: Record<string, string> = {
    AAA: "risk-aaa", AA: "risk-aa", A: "risk-a",
    BBB: "risk-bbb", BB: "risk-bb", B: "risk-b", CCC: "risk-ccc",
  };
  return <span className={map[rating] ?? "risk-bbb"}>{rating}</span>;
}

function SeverityBadge({ sev }: { sev: string }) {
  const col: Record<string, string> = { CRITICAL: "#FF5B5B", HIGH: "#D8913F", ELEVATED: "#C9A227", MONITOR: "#4DA3FF" };
  const bg:  Record<string, string> = { CRITICAL: "#2A0F0F", HIGH: "#2A1A08", ELEVATED: "#1F1800", MONITOR: "#0D2040" };
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", padding: "2px 6px", color: col[sev] ?? "#8CA3BA", background: bg[sev] ?? "transparent", border: `1px solid ${col[sev] ?? "#8CA3BA"}33` }}>
      {sev}
    </span>
  );
}

function RiskBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 1 }} />
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 600, color: "#62758C", width: "22px", textAlign: "right" }}>
        {pct}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "physical" | "transition" | "regulatory">("overview");

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>
            CLIMATE RISK INTELLIGENCE OPERATING SYSTEM
          </div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", letterSpacing: "-0.01em", margin: 0 }}>
            Unified Intelligence Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.12em" }}>UPDATED 28s AGO</span>
          <button className="btn-intel" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={10} />
            Generate Report
          </button>
        </div>
      </div>

      {/* Command Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", borderBottom: "1px solid #1E2C3D" }}>
        {COMMAND_METRICS.map((m, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRight: i < 5 ? "1px solid #1E2C3D" : "none", background: "#0F1722" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>{m.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color: m.color }}>{m.value}</span>
              {m.trend && <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: m.color, fontWeight: 600 }}>{m.trend}</span>}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginTop: "3px" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 260px", minHeight: "calc(100vh - 240px)" }}>

        {/* LEFT: Portfolio */}
        <div style={{ borderRight: "1px solid #1E2C3D", display: "flex", flexDirection: "column" }}>
          <div className="intel-header">
            <Globe size={11} style={{ color: "#4DA3FF" }} />
            PORTFOLIO CLIMATE EXPOSURE
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{PORTFOLIO_COMPANIES.length} ENTITIES</span>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
            {(["overview", "physical", "transition", "regulatory"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: activeTab === tab ? "#4DA3FF" : "#3D506A", borderBottom: activeTab === tab ? "2px solid #4DA3FF" : "2px solid transparent", background: "transparent", cursor: "pointer" }}>
                {tab}
              </button>
            ))}
          </div>

          <div style={{ overflowY: "auto" }}>
            <table className="intel-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>ENTITY</th><th>SECTOR</th><th>RATING</th><th>PHYS.</th><th>TRANS.</th><th>CL</th><th>RaR</th>
                </tr>
              </thead>
              <tbody>
                {PORTFOLIO_COMPANIES.map(co => (
                  <tr key={co.name} style={{ cursor: "pointer" }}>
                    <td><span style={{ color: "#DDE7F2", fontWeight: 600, fontSize: "11px" }}>{co.name}</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.08em" }}>{co.sector}</span></td>
                    <td><RatingBadge rating={co.rating} /></td>
                    <td><RiskBar pct={co.physical}    color={co.physical    > 70 ? "#FF5B5B" : co.physical    > 50 ? "#D8913F" : "#63C982"} /></td>
                    <td><RiskBar pct={co.transition}  color={co.transition  > 70 ? "#FF5B5B" : co.transition  > 50 ? "#D8913F" : "#63C982"} /></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: co.clScore >= 70 ? "#63C982" : co.clScore >= 50 ? "#4DA3FF" : co.clScore >= 30 ? "#D8913F" : "#FF5B5B" }}>{co.clScore}</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: parseFloat(co.rar) > 25 ? "#FF5B5B" : parseFloat(co.rar) > 12 ? "#D8913F" : "#63C982" }}>{co.rar}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER: Events + Scenarios + Actions */}
        <div style={{ borderRight: "1px solid #1E2C3D", display: "flex", flexDirection: "column" }}>
          <div className="intel-header">
            <AlertTriangle size={11} style={{ color: "#FF5B5B" }} />
            ACTIVE PHYSICAL RISK EVENTS
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#FF5B5B", fontWeight: 700 }}>
              {PHYSICAL_EVENTS.filter(e => e.status === "ACTIVE").length} ACTIVE
            </span>
          </div>

          {PHYSICAL_EVENTS.map(ev => (
            <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "44px 90px 1fr 65px 75px", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #1E2C3D", gap: 8, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{ev.id}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.10em", color: ev.type === "FLOOD" ? "#4DA3FF" : ev.type === "HEATWAVE" ? "#FF5B5B" : ev.type === "CYCLONE" ? "#D8913F" : "#8CA3BA" }}>{ev.type}</span>
              <span style={{ fontSize: "11px", color: "#8CA3BA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.region}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#FF5B5B", fontWeight: 600 }}>{ev.impact}</span>
              <SeverityBadge sev={ev.severity} />
            </div>
          ))}

          <div className="intel-header">
            <Activity size={11} style={{ color: "#4DA3FF" }} />
            NGFS SCENARIO DELTA ANALYSIS
          </div>

          {SCENARIO_DELTA.map((sc, i) => (
            <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid #1E2C3D", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: sc.color }}>{sc.scenario}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#3D506A" }}>Stranded: <span style={{ color: sc.color, fontWeight: 700 }}>{sc.stranded}</span></span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {[["EBITDA", sc.ebitda], ["REVENUE", sc.rev], ["CAPEX", sc.capex]].map(([l, v]) => (
                  <div key={l} style={{ background: "#0F1722", border: "1px solid #1E2C3D", padding: "5px 8px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.12em" }}>{l}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: sc.color }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="intel-header">
            <Shield size={11} style={{ color: "#63C982" }} />
            RECOMMENDED ACTIONS
          </div>

          {ACTIONS.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 12px", borderBottom: "1px solid #1E2C3D", alignItems: "flex-start", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, padding: "1px 5px", flexShrink: 0, color: a.priority === "P1" ? "#FF5B5B" : a.priority === "P2" ? "#D8913F" : "#4DA3FF", border: `1px solid ${a.priority === "P1" ? "#FF5B5B" : a.priority === "P2" ? "#D8913F" : "#4DA3FF"}33`, background: `${a.priority === "P1" ? "#FF5B5B" : a.priority === "P2" ? "#D8913F" : "#4DA3FF"}0D`, marginTop: "2px" }}>{a.priority}</span>
              <span style={{ fontSize: "11px", color: "#8CA3BA", lineHeight: 1.4, flex: 1 }}>{a.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.10em", flexShrink: 0, marginTop: "2px" }}>{a.sector}</span>
            </div>
          ))}
        </div>

        {/* RIGHT: Intelligence Panel */}
        <div style={{ display: "flex", flexDirection: "column", borderTop: "none" }}>
          <div className="intel-header">
            <Zap size={11} style={{ color: "#4DA3FF" }} />
            INTELLIGENCE SUMMARY
          </div>

          {RIGHT_PANEL.map(({ key, val, label, color }) => (
            <div key={key} style={{ padding: "10px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "3px" }}>{key}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color }}>{val}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginTop: "2px" }}>{label}</div>
            </div>
          ))}

          <div style={{ padding: "10px 14px", borderBottom: "1px solid #1E2C3D" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>METHODOLOGY</div>
            {[["Model", "NGFS 2.0 + IPCC AR6"], ["Confidence", "91% (Ensemble)"], ["Horizon", "1Y / 5Y / 2050"], ["Updated", "Daily refresh"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #1E2C3D" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#3D506A" }}>{l}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>QUICK ACTIONS</div>
            {[
              { label: "Run Stress Test",    href: "/terminal/simulation"   },
              { label: "View Climate IDs",   href: "/climate-identity"      },
              { label: "Generate TCFD",      href: "/report"                },
              { label: "Supply Chain Map",   href: "/terminal/supply-chain" },
            ].map(({ label, href }) => (
              <a key={href} href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1E2C3D", color: "#4DA3FF", fontSize: "11px", textDecoration: "none" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#7BBEFF"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4DA3FF"; }}>
                {label}
                <ArrowRight size={10} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
