"use client";

import { useState } from "react";
import { Building2, Droplets, Thermometer, Wind, Zap, AlertTriangle, Activity, MapPin, Users } from "lucide-react";

const CITIES = [
  {
    id: "SC-001", name: "Mumbai Metropolitan Region",
    population: "20.8M", area: "4,355 km²", tier: "T1-COASTAL",
    clRating: "B", overallRisk: 78,
    flood: 88, heat: 61, drought: 32, cyclone: 72, seaLevel: 91,
    infrastructure: { power: 62, water: 71, transport: 58, health: 74 },
    alerts: 4, strandedInfra: "$2.1B",
    highlights: [
      "Dharavi + Kurla: Flood inundation probability >85% at 2°C",
      "BKC business district: $890M real estate climate exposure",
      "MCGM drainage system capacity < 25mm/hr — inadequate for projected 2040 rainfall",
      "Sea level rise +0.4m by 2040: Coastal promenade + Nariman Point at risk",
    ],
  },
  {
    id: "SC-002", name: "Bengaluru Urban District",
    population: "12.4M", area: "741 km²", tier: "T1-INLAND",
    clRating: "BBB", overallRisk: 61,
    flood: 52, heat: 74, drought: 68, cyclone: 12, seaLevel: 8,
    infrastructure: { power: 74, water: 48, transport: 62, health: 81 },
    alerts: 2, strandedInfra: "$680M",
    highlights: [
      "Bellandur + Varthur lakes: Encroachment reduces flood buffer capacity 74%",
      "Water table depletion: BWSSB reservoir levels 38% below seasonal average",
      "Urban heat island: +4.2°C above rural baseline — cooling demand surge",
      "IT corridor: $1.2B infrastructure value in flood risk zones",
    ],
  },
  {
    id: "SC-003", name: "Ahmedabad City",
    population: "7.6M", area: "464 km²", tier: "T1-ARID",
    clRating: "BB", overallRisk: 71,
    flood: 44, heat: 92, drought: 81, cyclone: 28, seaLevel: 18,
    infrastructure: { power: 68, water: 44, transport: 71, health: 62 },
    alerts: 3, strandedInfra: "$420M",
    highlights: [
      "Extreme heat index >55°C recorded June 2025 — 3 fatalities",
      "Water supply vulnerability: Narmada canal dependent — drought exposure HIGH",
      "AMTS/BRTS: Fleet adaptation to heat required — delay risk 34%",
      "AMC cooling centre network: Coverage only 18% of heat-exposed population",
    ],
  },
];

const HAZARD_ICONS: Record<string, React.ElementType> = {
  flood: Droplets, heat: Thermometer, drought: Wind, cyclone: Wind, seaLevel: Activity,
};

export default function SmartCityPage() {
  const [selected, setSelected] = useState(CITIES[0]);

  const riskColor = (v: number) => v > 75 ? "#FF5B5B" : v > 55 ? "#D8913F" : v > 35 ? "#C9A227" : "#63C982";

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>INFRASTRUCTURE INTELLIGENCE — URBAN SYSTEMS</div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", margin: 0 }}>Smart City Climate Intelligence</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-intel-ghost" style={{ padding: "4px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: "10px" }}>
            <MapPin size={10} /> Add City
          </button>
          <button className="btn-intel" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Activity size={10} /> Export Report
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 180px)" }}>

        {/* City list */}
        <div style={{ borderRight: "1px solid #1E2C3D", overflowY: "auto" }}>
          <div className="intel-header">
            <Building2 size={11} style={{ color: "#4DA3FF" }} />
            MONITORED CITIES
          </div>
          {CITIES.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} style={{ padding: "12px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", background: selected.id === c.id ? "#152235" : "transparent", borderLeft: selected.id === c.id ? "2px solid #4DA3FF" : "2px solid transparent", transition: "all 0.12s ease" }}
              onMouseEnter={e => { if (selected.id !== c.id) (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { if (selected.id !== c.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{c.id}</span>
                {c.alerts > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, color: "#FF5B5B", border: "1px solid #FF5B5B33", background: "#FF5B5B0D", padding: "1px 5px" }}>{c.alerts} ALERTS</span>}
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#DDE7F2", marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 6 }}>{c.tier} · {c.population}</div>
              <div style={{ height: 4, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                <div style={{ width: `${c.overallRisk}%`, height: "100%", background: riskColor(c.overallRisk), borderRadius: 1 }} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: riskColor(c.overallRisk), fontWeight: 700, marginTop: 3 }}>RISK INDEX: {c.overallRisk}</div>
            </div>
          ))}
        </div>

        {/* City profile */}
        <div style={{ overflowY: "auto" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 4 }}>{selected.id} · {selected.tier}</div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#DDE7F2", margin: "0 0 4px" }}>{selected.name}</h2>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>
                    <Users size={9} style={{ display: "inline", marginRight: 4 }} />{selected.population}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{selected.area}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>Stranded Infra: <span style={{ color: "#FF5B5B", fontWeight: 700 }}>{selected.strandedInfra}</span></span>
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "28px", fontWeight: 700, color: riskColor(selected.overallRisk) }}>
                {selected.overallRisk}
                <div style={{ fontSize: "8px", color: "#3D506A", fontWeight: 400, marginTop: -4 }}>CLIMATE RISK INDEX</div>
              </div>
            </div>
          </div>

          {/* Hazard grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid #1E2C3D" }}>
            {(["flood", "heat", "drought", "cyclone", "seaLevel"] as const).map((h, i) => {
              const val = selected[h] as number;
              const Icon = HAZARD_ICONS[h];
              return (
                <div key={h} style={{ padding: "12px 14px", borderRight: i < 4 ? "1px solid #1E2C3D" : "none" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <Icon size={12} style={{ color: riskColor(val) }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      {h === "seaLevel" ? "SEA LEVEL" : h.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "22px", fontWeight: 700, color: riskColor(val) }}>{val}</div>
                  <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden", marginTop: 6 }}>
                    <div style={{ width: `${val}%`, height: "100%", background: riskColor(val), borderRadius: 1 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infrastructure resilience + alerts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #1E2C3D" }}>
            <div style={{ borderRight: "1px solid #1E2C3D", padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>INFRASTRUCTURE RESILIENCE</div>
              {Object.entries(selected.infrastructure).map(([sys, score]) => (
                <div key={sys} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#8CA3BA", textTransform: "uppercase" }}>{sys}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: score > 70 ? "#63C982" : score > 50 ? "#D8913F" : "#FF5B5B" }}>{score}</span>
                  </div>
                  <div style={{ height: 4, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ width: `${score}%`, height: "100%", background: score > 70 ? "#63C982" : score > 50 ? "#D8913F" : "#FF5B5B", borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>INTELLIGENCE FLAGS</div>
              {selected.highlights.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #1E2C3D" }}>
                  <AlertTriangle size={10} style={{ color: "#D8913F", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: "11px", color: "#8CA3BA", lineHeight: 1.4 }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
