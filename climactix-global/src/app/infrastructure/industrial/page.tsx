"use client";

import { useState } from "react";
import { Building2, Droplets, Wind, AlertTriangle, Activity, MapPin } from "lucide-react";

const ZONES = [
  {
    id: "IZ-001", name: "MIDC Tarapur Industrial Area",
    type: "CHEMICAL / PHARMA",
    region: "Palghar, Maharashtra",
    units: 540, employment: "85,000",
    clRating: "B",
    flood: 74, heat: 58, drought: 32, seaLevel: 68, water: 72,
    strandedInfra: "$320M", disruption: "HIGH",
    highlights: [
      "14 chemical units in 100-yr flood zone — no adaptation plan",
      "Water stress: Surya reservoir capacity down 34% — industrial supply risk",
      "Coastal proximity: Sea-level rise +0.5m by 2050 affects MIDC Phase IV",
    ],
  },
  {
    id: "IZ-002", name: "SEZ Mundra Industrial Cluster",
    type: "PORT / LOGISTICS",
    region: "Kutch, Gujarat",
    units: 220, employment: "42,000",
    clRating: "BB",
    flood: 48, heat: 82, drought: 78, seaLevel: 52, water: 84,
    strandedInfra: "$180M", disruption: "ELEVATED",
    highlights: [
      "Extreme heat: Industrial operations productivity loss estimated 22% by 2035",
      "Water scarcity: Deep aquifer dependency — recharge rate < extraction rate",
      "Cyclone risk: Proximity to Arabian Sea — 5 events in past decade",
    ],
  },
  {
    id: "IZ-003", name: "Noida Special Economic Zone",
    type: "IT / ELECTRONICS",
    region: "UP / NCR",
    units: 890, employment: "1,80,000",
    clRating: "BBB",
    flood: 61, heat: 72, drought: 48, seaLevel: 8, water: 58,
    strandedInfra: "$95M", disruption: "ELEVATED",
    highlights: [
      "Urban flooding: Yamuna floodplain proximity — 3 events in 5 years",
      "Air quality / WBGT: Worker productivity impact estimated 8–12%",
      "Power grid: Extreme heat events causing 4–8hr grid stress annually",
    ],
  },
];

const riskColor = (v: number) => v > 75 ? "#FF5B5B" : v > 55 ? "#D8913F" : v > 35 ? "#C9A227" : "#63C982";

export default function IndustrialZonesPage() {
  const [selected, setSelected] = useState(ZONES[0]);

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>INFRASTRUCTURE INTELLIGENCE — INDUSTRIAL SYSTEMS</div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", margin: 0 }}>Industrial Zone Climate Intelligence</h1>
        </div>
        <button className="btn-intel" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Activity size={10} /> Export Risk Report
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 180px)" }}>
        {/* Zone list */}
        <div style={{ borderRight: "1px solid #1E2C3D", overflowY: "auto" }}>
          <div className="intel-header"><Building2 size={11} style={{ color: "#4DA3FF" }} />INDUSTRIAL ZONES</div>
          {ZONES.map(z => (
            <div key={z.id} onClick={() => setSelected(z)} style={{ padding: "12px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", background: selected.id === z.id ? "#152235" : "transparent", borderLeft: selected.id === z.id ? "2px solid #4DA3FF" : "2px solid transparent", transition: "all 0.12s ease" }}
              onMouseEnter={e => { if (selected.id !== z.id) (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { if (selected.id !== z.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 2 }}>{z.id} · {z.type}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#DDE7F2", marginBottom: 2 }}>{z.name}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <MapPin size={9} style={{ color: "#3D506A" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{z.region}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{z.units} units</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{z.employment} emp</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: z.disruption === "HIGH" ? "#D8913F" : "#63C982" }}>{z.disruption}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Zone detail */}
        <div style={{ overflowY: "auto" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722", display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 3 }}>{selected.id} · {selected.type} · {selected.region}</div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#DDE7F2", margin: "0 0 6px" }}>{selected.name}</h2>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { l: "UNITS",           v: String(selected.units)      },
                  { l: "EMPLOYMENT",      v: selected.employment         },
                  { l: "STRANDED INFRA",  v: selected.strandedInfra      },
                  { l: "DISRUPTION RISK", v: selected.disruption         },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.14em" }}>{l}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 700, color: l === "DISRUPTION RISK" ? (v === "HIGH" ? "#D8913F" : "#63C982") : "#DDE7F2" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hazard grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid #1E2C3D" }}>
            {[
              { label: "FLOOD",    val: selected.flood    },
              { label: "HEAT",     val: selected.heat     },
              { label: "DROUGHT",  val: selected.drought  },
              { label: "SEA LEVEL",val: selected.seaLevel },
              { label: "WATER",    val: selected.water    },
            ].map(({ label, val }, i) => (
              <div key={label} style={{ padding: "12px 14px", borderRight: i < 4 ? "1px solid #1E2C3D" : "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.12em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "22px", fontWeight: 700, color: riskColor(val) }}>{val}</div>
                <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden", marginTop: 6 }}>
                  <div style={{ width: `${val}%`, height: "100%", background: riskColor(val), borderRadius: 1 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Intelligence flags */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>CLIMATE INTELLIGENCE FLAGS</div>
            {selected.highlights.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #1E2C3D" }}>
                <AlertTriangle size={10} style={{ color: "#D8913F", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: "12px", color: "#8CA3BA", lineHeight: 1.4 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
