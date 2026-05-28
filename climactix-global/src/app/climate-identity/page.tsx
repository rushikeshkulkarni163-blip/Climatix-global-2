"use client";

import { useState } from "react";
import {
  Fingerprint, Globe, Zap, Shield, AlertTriangle,
  TrendingDown, TrendingUp, Package, BookOpen, ArrowRight,
  MapPin, Building2, BarChart2, Activity
} from "lucide-react";

/* ─── Data ─────────────────────────────────────────────────────────── */

const ENTITIES = [
  {
    id: "CID-001",
    name: "Tata Steel Limited",
    cin: "L27100MH1907PLC000260",
    sector: "IRON & STEEL",
    hq: "Mumbai, Maharashtra",
    revenue: "₹2.43L Cr",
    employees: "78,000",
    clRating: "BBB",
    clScore: 49,
    transitionScore: 71,
    physicalScore: 64,
    credibility: 52,
    greenwash: "MEDIUM",
    nzCredibility: "WEAK",
    carbonIntensity: "1.84 tCO₂/t steel",
    revenueAtRisk: "22.1%",
    strandedRisk: "$340M",
    insuranceGap: "$120M",
    highlights: [
      { type: "RISK",    label: "High coal dependency — 68% of energy from coal" },
      { type: "RISK",    label: "3 facilities in Brahmaputra flood corridor" },
      { type: "WATCH",   label: "BRSR filed but Scope 3 disclosure missing" },
      { type: "SIGNAL",  label: "Greenfield DRI announced — transition positive" },
    ],
    layers: {
      "C-CORE":    62, "C-FIN":  45, "C-RISK/P": 64,
      "C-RISK/T":  71, "C-CAPITAL": 48, "C-SUPPLY": 58,
      "C-ADAPT":   40, "C-TRUTH": 52,
    },
    regExposure: [
      { framework: "BRSR",         status: "FILED",     compliance: 74 },
      { framework: "TCFD",         status: "PARTIAL",   compliance: 55 },
      { framework: "CDP",          status: "B- SCORE",  compliance: 62 },
      { framework: "CSRD",         status: "IN SCOPE",  compliance: 38 },
      { framework: "Carbon Tax",   status: "HIGH",      compliance: null },
    ],
    geoRisk: [
      { hazard: "Flood",     exposure: 72, trend: "up"  },
      { hazard: "Heat",      exposure: 61, trend: "up"  },
      { hazard: "Drought",   exposure: 44, trend: "up"  },
      { hazard: "Cyclone",   exposure: 38, trend: "flat"},
      { hazard: "Sea Level", exposure: 28, trend: "flat"},
    ],
    supplyChain: [
      { node: "Iron Ore",      dependency: "HIGH",   climate: 68, geo: "Odisha / Jharkhand" },
      { node: "Coal",          dependency: "CRITICAL",climate: 91, geo: "Jharkhand / Imports" },
      { node: "Scrap Metal",   dependency: "MEDIUM", climate: 38, geo: "Pan India" },
      { node: "Electricity",   dependency: "HIGH",   climate: 74, geo: "Grid / Captive" },
    ],
  },
  {
    id: "CID-002",
    name: "Coal India Limited",
    cin: "L10101WB1973GOI028844",
    sector: "COAL MINING",
    hq: "Kolkata, West Bengal",
    revenue: "₹1.28L Cr",
    employees: "2,43,000",
    clRating: "CCC",
    clScore: 14,
    transitionScore: 95,
    physicalScore: 82,
    credibility: 12,
    greenwash: "HIGH",
    nzCredibility: "ABSENT",
    carbonIntensity: "2.61 tCO₂/t coal",
    revenueAtRisk: "64.2%",
    strandedRisk: "$4.1B",
    insuranceGap: "$890M",
    highlights: [
      { type: "CRITICAL", label: "Core business is stranded-asset at 2°C pathway" },
      { type: "CRITICAL", label: "No credible transition plan filed" },
      { type: "RISK",     label: "82% of facilities in physical risk zones" },
      { type: "WATCH",    label: "BRSR filed — climate disclosures material gaps" },
    ],
    layers: {
      "C-CORE": 18, "C-FIN": 11, "C-RISK/P": 82,
      "C-RISK/T": 95, "C-CAPITAL": 12, "C-SUPPLY": 22,
      "C-ADAPT": 8, "C-TRUTH": 14,
    },
    regExposure: [
      { framework: "BRSR",       status: "FILED",     compliance: 58 },
      { framework: "TCFD",       status: "NOT FILED",  compliance: 0  },
      { framework: "CDP",        status: "D SCORE",   compliance: 20 },
      { framework: "CSRD",       status: "IN SCOPE",  compliance: 12 },
      { framework: "Carbon Tax", status: "CRITICAL",  compliance: null },
    ],
    geoRisk: [
      { hazard: "Flood",     exposure: 84, trend: "up"  },
      { hazard: "Heat",      exposure: 78, trend: "up"  },
      { hazard: "Drought",   exposure: 72, trend: "up"  },
      { hazard: "Cyclone",   exposure: 42, trend: "flat"},
      { hazard: "Sea Level", exposure: 18, trend: "flat"},
    ],
    supplyChain: [
      { node: "Mine Equipment", dependency: "HIGH",    climate: 55, geo: "Imports / Domestic" },
      { node: "Railways",       dependency: "CRITICAL", climate: 62, geo: "Eastern India" },
      { node: "Power Plants",   dependency: "CRITICAL", climate: 88, geo: "Pan India" },
      { node: "Water Supply",   dependency: "HIGH",    climate: 71, geo: "Local watersheds" },
    ],
  },
  {
    id: "CID-003",
    name: "Infosys Limited",
    cin: "L85110KA1981PLC013115",
    sector: "IT SERVICES",
    hq: "Bengaluru, Karnataka",
    revenue: "₹1.53L Cr",
    employees: "3,17,000",
    clRating: "AA",
    clScore: 81,
    transitionScore: 22,
    physicalScore: 28,
    credibility: 84,
    greenwash: "LOW",
    nzCredibility: "STRONG",
    carbonIntensity: "0.018 tCO₂/FTE",
    revenueAtRisk: "4.2%",
    strandedRisk: "$12M",
    insuranceGap: "$8M",
    highlights: [
      { type: "SIGNAL",  label: "Carbon neutral since 2020 — verified by DNV" },
      { type: "SIGNAL",  label: "100% renewable electricity at all campuses" },
      { type: "WATCH",   label: "Supplier Scope 3 disclosure remains incomplete" },
      { type: "SIGNAL",  label: "2040 net-zero target with credible roadmap" },
    ],
    layers: {
      "C-CORE": 86, "C-FIN": 82, "C-RISK/P": 28,
      "C-RISK/T": 22, "C-CAPITAL": 79, "C-SUPPLY": 68,
      "C-ADAPT": 84, "C-TRUTH": 88,
    },
    regExposure: [
      { framework: "BRSR",       status: "EXEMPLARY", compliance: 94 },
      { framework: "TCFD",       status: "ALIGNED",   compliance: 88 },
      { framework: "CDP",        status: "A SCORE",   compliance: 91 },
      { framework: "CSRD",       status: "PREPARED",  compliance: 82 },
      { framework: "Carbon Tax", status: "LOW RISK",  compliance: null },
    ],
    geoRisk: [
      { hazard: "Flood",     exposure: 24, trend: "flat"},
      { hazard: "Heat",      exposure: 38, trend: "up"  },
      { hazard: "Drought",   exposure: 31, trend: "up"  },
      { hazard: "Cyclone",   exposure: 18, trend: "flat"},
      { hazard: "Sea Level", exposure: 22, trend: "flat"},
    ],
    supplyChain: [
      { node: "Cloud Infra",   dependency: "HIGH",   climate: 34, geo: "AWS / GCP / Azure" },
      { node: "Electricity",   dependency: "MEDIUM", climate: 15, geo: "100% renewable" },
      { node: "Talent",        dependency: "HIGH",   climate: 28, geo: "India / Global" },
      { node: "Facilities",    dependency: "MEDIUM", climate: 32, geo: "India / Americas" },
    ],
  },
];

/* ─── Components ─────────────────────────────────────────────────────── */

function RatingBadge({ r }: { r: string }) {
  const map: Record<string, string> = {
    AAA: "risk-aaa", AA: "risk-aa", A: "risk-a",
    BBB: "risk-bbb", BB: "risk-bb", B: "risk-b", CCC: "risk-ccc",
  };
  return <span className={map[r] ?? "risk-bbb"}>{r}</span>;
}

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color }}>{score}</span>
      </div>
      <div style={{ height: 4, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 1, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function ClayerHex({ layers }: { layers: Record<string, number> }) {
  const COLORS: Record<string, string> = {
    "C-CORE": "#4DA3FF", "C-FIN": "#70D8FF", "C-RISK/P": "#FF5B5B",
    "C-RISK/T": "#D8913F", "C-CAPITAL": "#63C982", "C-SUPPLY": "#C9A227",
    "C-ADAPT": "#8CA3BA", "C-TRUTH": "#4DA3FF",
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
      {Object.entries(layers).map(([k, v]) => (
        <div key={k}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.08em" }}>{k}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: COLORS[k] ?? "#8CA3BA" }}>{v}</span>
          </div>
          <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
            <div style={{ width: `${v}%`, height: "100%", background: COLORS[k] ?? "#8CA3BA", borderRadius: 1 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function ClimateIdentityPage() {
  const [selected, setSelected] = useState(ENTITIES[0]);

  const highlightColor = (type: string) =>
    type === "CRITICAL" ? "#FF5B5B" : type === "RISK" ? "#D8913F" : type === "WATCH" ? "#C9A227" : "#63C982";

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>
            DIGITAL CLIMATE IDENTITY REGISTRY
          </div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", letterSpacing: "-0.01em", margin: 0 }}>
            Climate Identity Engine
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-intel-ghost" style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <Fingerprint size={10} />
            Generate ID
          </button>
          <button className="btn-intel" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={10} />
            Export Profile
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 180px)" }}>

        {/* ─ Entity List ─────────────────────────────────── */}
        <div style={{ borderRight: "1px solid #1E2C3D", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="intel-header">
            <Building2 size={11} style={{ color: "#4DA3FF" }} />
            REGISTERED ENTITIES
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{ENTITIES.length}</span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {ENTITIES.map(e => (
              <div
                key={e.id}
                onClick={() => setSelected(e)}
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #1E2C3D",
                  cursor: "pointer",
                  background: selected.id === e.id ? "#152235" : "transparent",
                  borderLeft: selected.id === e.id ? "2px solid #4DA3FF" : "2px solid transparent",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={ev => { if (selected.id !== e.id) (ev.currentTarget as HTMLElement).style.background = "#111C2B"; }}
                onMouseLeave={ev => { if (selected.id !== e.id) (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{e.id}</span>
                  <RatingBadge r={e.clRating} />
                </div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#DDE7F2", marginBottom: 2 }}>{e.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.10em" }}>
                  {e.sector} · {e.hq.split(",")[0]}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A" }}>CL-SCORE</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: e.clScore >= 70 ? "#63C982" : e.clScore >= 50 ? "#4DA3FF" : e.clScore >= 30 ? "#D8913F" : "#FF5B5B" }}>{e.clScore}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A" }}>RaR</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: parseFloat(e.revenueAtRisk) > 25 ? "#FF5B5B" : "#D8913F" }}>{e.revenueAtRisk}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Identity Profile ────────────────────────────── */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Identity Header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Fingerprint size={18} style={{ color: "#4DA3FF" }} />
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em" }}>{selected.id} · {selected.cin}</div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#DDE7F2", margin: 0 }}>{selected.name}</h2>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{selected.sector}</span>
                <span style={{ color: "#1E2C3D" }}>·</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{selected.hq}</span>
                <span style={{ color: "#1E2C3D" }}>·</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{selected.revenue}</span>
                <span style={{ color: "#1E2C3D" }}>·</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{selected.employees} EMP</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 2 }}>CLIMATE RATING</div>
                <RatingBadge r={selected.clRating} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 2 }}>CL-SCORE</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "24px", fontWeight: 700, color: selected.clScore >= 70 ? "#63C982" : selected.clScore >= 50 ? "#4DA3FF" : selected.clScore >= 30 ? "#D8913F" : "#FF5B5B" }}>{selected.clScore}</div>
              </div>
            </div>
          </div>

          {/* 4-column identity metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid #1E2C3D" }}>
            {[
              { label: "REVENUE AT RISK",    val: selected.revenueAtRisk, color: parseFloat(selected.revenueAtRisk) > 25 ? "#FF5B5B" : "#D8913F" },
              { label: "STRANDED RISK",       val: selected.strandedRisk,  color: "#FF5B5B" },
              { label: "CARBON INTENSITY",    val: selected.carbonIntensity, color: "#D8913F" },
              { label: "INSURANCE GAP",       val: selected.insuranceGap,  color: "#D8913F" },
            ].map((m, i) => (
              <div key={i} style={{ padding: "10px 16px", borderRight: i < 3 ? "1px solid #1E2C3D" : "none", background: "#0F1722" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", fontWeight: 700, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Main 3-column body */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #1E2C3D" }}>

            {/* C-LAYER Scores */}
            <div style={{ borderRight: "1px solid #1E2C3D", padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, borderBottom: "1px solid #1E2C3D", paddingBottom: 6 }}>C-LAYER FRAMEWORK</div>
              <ClayerHex layers={selected.layers} />

              <div style={{ marginTop: 14, borderTop: "1px solid #1E2C3D", paddingTop: 10 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 8 }}>COMPOSITE SCORES</div>
                <ScoreBar score={selected.physicalScore}    label="Physical Risk"        color={selected.physicalScore    > 70 ? "#FF5B5B" : "#D8913F"} />
                <ScoreBar score={selected.transitionScore}  label="Transition Risk"      color={selected.transitionScore  > 70 ? "#FF5B5B" : "#D8913F"} />
                <ScoreBar score={selected.credibility}      label="Climate Credibility"  color={selected.credibility      > 70 ? "#63C982" : selected.credibility > 50 ? "#4DA3FF" : "#D8913F"} />
              </div>
            </div>

            {/* Geographic Risk + Regulatory */}
            <div style={{ borderRight: "1px solid #1E2C3D", padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10, borderBottom: "1px solid #1E2C3D", paddingBottom: 6 }}>GEOGRAPHIC HAZARD PROFILE</div>

              {selected.geoRisk.map(g => (
                <div key={g.hazard} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#8CA3BA" }}>{g.hazard}</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {g.trend === "up" ? <TrendingUp size={9} style={{ color: "#FF5B5B" }} /> : <Activity size={9} style={{ color: "#62758C" }} />}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: g.exposure > 70 ? "#FF5B5B" : g.exposure > 50 ? "#D8913F" : "#63C982" }}>{g.exposure}</span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ width: `${g.exposure}%`, height: "100%", background: g.exposure > 70 ? "#FF5B5B" : g.exposure > 50 ? "#D8913F" : "#63C982", borderRadius: 1 }} />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 14, borderTop: "1px solid #1E2C3D", paddingTop: 10 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 8 }}>REGULATORY EXPOSURE</div>
                {selected.regExposure.map(r => (
                  <div key={r.framework} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1E2C3D" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#8CA3BA" }}>{r.framework}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {r.compliance !== null && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: r.compliance > 80 ? "#63C982" : r.compliance > 50 ? "#D8913F" : "#FF5B5B" }}>{r.compliance}%</span>
                      )}
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, padding: "1px 5px",
                        color: r.status.includes("ALIGNED") || r.status.includes("EXEMPLARY") || r.status.includes("A ") ? "#63C982" : r.status.includes("HIGH") || r.status.includes("CRITICAL") || r.status.includes("NOT") ? "#FF5B5B" : "#D8913F",
                        border: "1px solid currentColor",
                        opacity: 0.9,
                      }}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supply Chain + Highlights */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10, borderBottom: "1px solid #1E2C3D", paddingBottom: 6 }}>SUPPLY CHAIN VULNERABILITY</div>

              {selected.supplyChain.map(s => (
                <div key={s.node} style={{ padding: "6px 0", borderBottom: "1px solid #1E2C3D" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#DDE7F2" }}>{s.node}</span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, padding: "1px 5px",
                      color: s.dependency === "CRITICAL" ? "#FF5B5B" : s.dependency === "HIGH" ? "#D8913F" : "#62758C",
                      border: `1px solid ${s.dependency === "CRITICAL" ? "#FF5B5B" : s.dependency === "HIGH" ? "#D8913F" : "#62758C"}33`,
                      background: `${s.dependency === "CRITICAL" ? "#FF5B5B" : s.dependency === "HIGH" ? "#D8913F" : "#62758C"}0D`,
                    }}>
                      {s.dependency}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{s.geo}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: s.climate > 70 ? "#FF5B5B" : s.climate > 50 ? "#D8913F" : "#63C982" }}>
                      CLR {s.climate}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 14, borderTop: "1px solid #1E2C3D", paddingTop: 10 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 8 }}>KEY INTELLIGENCE FLAGS</div>

                {selected.highlights.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: i < selected.highlights.length - 1 ? "1px solid #1E2C3D" : "none" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, padding: "1px 5px", flexShrink: 0, marginTop: 2,
                      color: highlightColor(h.type),
                      border: `1px solid ${highlightColor(h.type)}33`,
                      background: `${highlightColor(h.type)}0D`,
                    }}>
                      {h.type}
                    </span>
                    <span style={{ fontSize: "11px", color: "#8CA3BA", lineHeight: 1.4 }}>{h.label}</span>
                  </div>
                ))}
              </div>

              {/* NZ Credibility badge */}
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#0F1722", border: "1px solid #1E2C3D" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 4 }}>NET-ZERO CREDIBILITY</div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700,
                  color: selected.nzCredibility === "STRONG" ? "#63C982" : selected.nzCredibility === "WEAK" ? "#D8913F" : "#FF5B5B",
                }}>
                  {selected.nzCredibility}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginTop: 2 }}>
                  Greenwash risk: <span style={{ color: selected.greenwash === "LOW" ? "#63C982" : selected.greenwash === "MEDIUM" ? "#D8913F" : "#FF5B5B", fontWeight: 700 }}>{selected.greenwash}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
