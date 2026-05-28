"use client";

import { useState } from "react";
import { Landmark, AlertTriangle, TrendingDown, Shield, BarChart2, Activity } from "lucide-react";

const BANKS = [
  {
    id: "FI-001", name: "State Bank of India", type: "PUBLIC SECTOR",
    assets: "₹62.2L Cr", clRating: "BBB",
    climateExposure: "$4.8B", npaClimateRisk: "8.4%", strandedBook: "$1.2B",
    sectorExposure: [
      { sector: "Coal/Thermal Power", exposure: 18.2, climateRisk: "CRITICAL", npaRisk: 72 },
      { sector: "Steel & Metals",      exposure: 12.4, climateRisk: "HIGH",     npaRisk: 58 },
      { sector: "Oil & Gas",           exposure: 9.8,  climateRisk: "HIGH",     npaRisk: 64 },
      { sector: "Agriculture",         exposure: 14.1, climateRisk: "ELEVATED", npaRisk: 48 },
      { sector: "Real Estate",         exposure: 8.7,  climateRisk: "ELEVATED", npaRisk: 44 },
      { sector: "Renewables",          exposure: 6.2,  climateRisk: "LOW",      npaRisk: 18 },
    ],
    tcfdAlignment: 48, borrowerClimateScore: 42,
    highlights: [
      "₹8.4L Cr coal-linked lending book — highest fossil fuel exposure in Indian banking",
      "Thermal power NPAs elevated: 3 accounts on NCLT — climate transition accelerant",
      "Agriculture portfolio: 34% in drought-prone districts — physical risk HIGH",
      "No climate risk in credit scoring framework — critical governance gap",
    ],
  },
  {
    id: "FI-002", name: "HDFC Bank", type: "PRIVATE SECTOR",
    assets: "₹31.4L Cr", clRating: "A",
    climateExposure: "$1.4B", npaClimateRisk: "3.8%", strandedBook: "$280M",
    sectorExposure: [
      { sector: "MSME",               exposure: 24.1, climateRisk: "ELEVATED", npaRisk: 38 },
      { sector: "Real Estate",        exposure: 16.8, climateRisk: "ELEVATED", npaRisk: 42 },
      { sector: "Auto / EV",          exposure: 11.2, climateRisk: "LOW",      npaRisk: 22 },
      { sector: "Agri / Kisan CC",    exposure: 8.4,  climateRisk: "ELEVATED", npaRisk: 44 },
      { sector: "Infrastructure",     exposure: 7.9,  climateRisk: "MEDIUM",   npaRisk: 34 },
      { sector: "Renewables",         exposure: 4.8,  climateRisk: "LOW",      npaRisk: 16 },
    ],
    tcfdAlignment: 74, borrowerClimateScore: 68,
    highlights: [
      "TCFD-aligned lending assessment piloted in corporate banking — industry leading",
      "MSME portfolio: Physical risk concentration in flood-prone Gujarat districts",
      "Renewable energy lending: +42% YoY growth — transition aligned",
      "Climate stress test embedded in 2025 ICAAP — regulatory alignment",
    ],
  },
];

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#FF5B5B", HIGH: "#D8913F", ELEVATED: "#C9A227",
  MEDIUM: "#4DA3FF", LOW: "#63C982",
};

export default function BankingIntelligencePage() {
  const [selected, setSelected] = useState(BANKS[0]);

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>INFRASTRUCTURE INTELLIGENCE — FINANCIAL INSTITUTIONS</div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", margin: 0 }}>Banking & NBFC Climate Intelligence</h1>
        </div>
        <button className="btn-intel" style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <BarChart2 size={10} /> Climate Risk Report
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "calc(100vh - 180px)" }}>

        {/* FI list */}
        <div style={{ borderRight: "1px solid #1E2C3D", overflowY: "auto" }}>
          <div className="intel-header"><Landmark size={11} style={{ color: "#4DA3FF" }} />MONITORED FIs</div>
          {BANKS.map(b => (
            <div key={b.id} onClick={() => setSelected(b)} style={{ padding: "12px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", background: selected.id === b.id ? "#152235" : "transparent", borderLeft: selected.id === b.id ? "2px solid #4DA3FF" : "2px solid transparent", transition: "all 0.12s ease" }}
              onMouseEnter={e => { if (selected.id !== b.id) (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
              onMouseLeave={e => { if (selected.id !== b.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 2 }}>{b.id} · {b.type}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#DDE7F2", marginBottom: 4 }}>{b.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#3D506A" }}>Assets: <span style={{ color: "#62758C", fontWeight: 600 }}>{b.assets}</span></span>
                <span className={`risk-${b.clRating.toLowerCase()}`}>{b.clRating}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#D8913F", marginTop: 4 }}>
                Climate Exposure: <span style={{ fontWeight: 700 }}>{b.climateExposure}</span>
              </div>
            </div>
          ))}
        </div>

        {/* FI profile */}
        <div style={{ overflowY: "auto" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginBottom: 3 }}>{selected.id} · {selected.type}</div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#DDE7F2", margin: "0 0 6px" }}>{selected.name}</h2>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { label: "TOTAL ASSETS",       val: selected.assets,             color: "#4DA3FF" },
                    { label: "CLIMATE EXPOSURE",    val: selected.climateExposure,    color: "#D8913F" },
                    { label: "NPA CLIMATE RISK",    val: selected.npaClimateRisk,     color: "#FF5B5B" },
                    { label: "STRANDED BOOK",       val: selected.strandedBook,       color: "#FF5B5B" },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", marginBottom: 2 }}>CLIMATE RATING</div>
                  <span className={`risk-${selected.clRating.toLowerCase().replace("bbb","bbb").replace("b","b")}`}>{selected.clRating}</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", marginBottom: 2 }}>TCFD ALIGNMENT</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: selected.tcfdAlignment > 70 ? "#63C982" : "#D8913F" }}>{selected.tcfdAlignment}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sector exposure table */}
          <div style={{ borderBottom: "1px solid #1E2C3D" }}>
            <div className="intel-header"><BarChart2 size={11} style={{ color: "#4DA3FF" }} />LENDING BOOK CLIMATE EXPOSURE BY SECTOR</div>
            <table className="intel-table" style={{ width: "100%" }}>
              <thead>
                <tr><th>SECTOR</th><th>% OF BOOK</th><th>CLIMATE RISK</th><th>NPA CLIMATE RISK</th></tr>
              </thead>
              <tbody>
                {selected.sectorExposure.map(s => (
                  <tr key={s.sector}>
                    <td><span style={{ fontWeight: 600, color: "#DDE7F2", fontSize: "11px" }}>{s.sector}</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: "#8CA3BA" }}>{s.exposure}%</span></td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, padding: "1px 6px", color: RISK_COLOR[s.climateRisk], border: `1px solid ${RISK_COLOR[s.climateRisk]}33`, background: `${RISK_COLOR[s.climateRisk]}0D` }}>
                        {s.climateRisk}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                          <div style={{ width: `${s.npaRisk}%`, height: "100%", background: RISK_COLOR[s.climateRisk], borderRadius: 1 }} />
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: RISK_COLOR[s.climateRisk] }}>{s.npaRisk}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Intelligence flags */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>KEY INTELLIGENCE FLAGS</div>
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
