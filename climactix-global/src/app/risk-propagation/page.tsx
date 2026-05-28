"use client";

import { useState } from "react";
import { AlertTriangle, Activity, Shield, TrendingDown, ChevronRight, Info, Zap } from "lucide-react";

/* ─── Propagation Data ──────────────────────────────────────────────── */

const PROPAGATION_NODES = [
  {
    id: "N01", layer: "PHYSICAL",
    name: "Bay of Bengal Cyclone",
    type: "CLIMATE HAZARD",
    exposure: 91, financialImpact: "$2.1B", confidence: 88,
    trend: "ACCELERATING", severity: "CRITICAL",
    desc: "Category 4 landfall probability 74% within 96h. Wind speeds >185 km/h at coastal strip.",
    propagatesTo: ["N04", "N06", "N08"],
  },
  {
    id: "N02", layer: "PHYSICAL",
    name: "Deccan Heatwave Cluster",
    type: "CLIMATE HAZARD",
    exposure: 78, financialImpact: "$890M", confidence: 82,
    trend: "ACTIVE", severity: "HIGH",
    desc: "72-hour sustained heat index >52°C across 340,000 km². 12M people affected.",
    propagatesTo: ["N05", "N07"],
  },
  {
    id: "N03", layer: "PHYSICAL",
    name: "Brahmaputra Flood Event",
    type: "CLIMATE HAZARD",
    exposure: 84, financialImpact: "$1.4B", confidence: 91,
    trend: "ACTIVE", severity: "CRITICAL",
    desc: "Water level 3.2m above danger mark. 8 industrial facilities in inundation zone.",
    propagatesTo: ["N06", "N09"],
  },
  {
    id: "N04", layer: "INFRASTRUCTURE",
    name: "Coastal Port Disruption",
    type: "INFRASTRUCTURE",
    exposure: 72, financialImpact: "$780M", confidence: 84,
    trend: "ACTIVE", severity: "HIGH",
    desc: "5 major ports operational risk — JNPT, Paradip, Vizag. 240 vessels potentially impacted.",
    propagatesTo: ["N10", "N12"],
  },
  {
    id: "N05", layer: "INFRASTRUCTURE",
    name: "Power Grid Stress",
    type: "INFRASTRUCTURE",
    exposure: 68, financialImpact: "$450M", confidence: 79,
    trend: "ACTIVE", severity: "HIGH",
    desc: "Cooling load 34% above seasonal average. 3 generating units on forced outage.",
    propagatesTo: ["N11"],
  },
  {
    id: "N06", layer: "ENTERPRISE",
    name: "Steel Sector Disruption",
    type: "ENTERPRISE",
    exposure: 61, financialImpact: "$620M", confidence: 77,
    trend: "ELEVATED", severity: "HIGH",
    desc: "Raw material supply chains severed. Tata Steel Kalinganagar + JSW Dolvi at risk.",
    propagatesTo: ["N12", "N13"],
  },
  {
    id: "N07", layer: "ENTERPRISE",
    name: "Agricultural Yield Loss",
    type: "ENTERPRISE",
    exposure: 74, financialImpact: "$1.1B", confidence: 85,
    trend: "ACTIVE", severity: "HIGH",
    desc: "Kharif crop damage estimated 18–24% yield reduction. 4.2M farmers affected.",
    propagatesTo: ["N13", "N14"],
  },
  {
    id: "N08", layer: "ENTERPRISE",
    name: "Real Estate Writedown",
    type: "ENTERPRISE",
    exposure: 55, financialImpact: "$340M", confidence: 71,
    trend: "WATCH", severity: "ELEVATED",
    desc: "Coastal property valuations under review. 12,000 units in flood-risk corridor.",
    propagatesTo: ["N14"],
  },
  {
    id: "N09", layer: "ENTERPRISE",
    name: "Manufacturing Shutdown",
    type: "ENTERPRISE",
    exposure: 66, financialImpact: "$520M", confidence: 80,
    trend: "ACTIVE", severity: "HIGH",
    desc: "7 manufacturing plants forced shutdown. Supply disruption cascading to Tier-2.",
    propagatesTo: ["N12", "N13"],
  },
  {
    id: "N10", layer: "FINANCIAL",
    name: "Trade Finance Exposure",
    type: "FINANCIAL",
    exposure: 58, financialImpact: "$1.8B", confidence: 74,
    trend: "ELEVATED", severity: "HIGH",
    desc: "Port disruption triggering LC non-performance. 3 banks with >$200M trade exposure.",
    propagatesTo: ["N15"],
  },
  {
    id: "N11", layer: "FINANCIAL",
    name: "DISCOM Credit Stress",
    type: "FINANCIAL",
    exposure: 62, financialImpact: "$430M", confidence: 76,
    trend: "ELEVATED", severity: "HIGH",
    desc: "Power distribution companies: AT&C losses spiking, payment delays to generators.",
    propagatesTo: ["N15"],
  },
  {
    id: "N12", layer: "FINANCIAL",
    name: "NPA Elevation Risk",
    type: "FINANCIAL",
    exposure: 71, financialImpact: "$2.4B", confidence: 82,
    trend: "ACTIVE", severity: "HIGH",
    desc: "Sector NPA migration probability elevated. 14 corporate borrowers on watchlist.",
    propagatesTo: ["N15", "N16"],
  },
  {
    id: "N13", layer: "FINANCIAL",
    name: "Commodity Price Spike",
    type: "FINANCIAL",
    exposure: 64, financialImpact: "$940M", confidence: 79,
    trend: "ACTIVE", severity: "HIGH",
    desc: "Iron ore +12%, wheat +18% in 7-day spot markets. Inflation pressure building.",
    propagatesTo: ["N16"],
  },
  {
    id: "N14", layer: "FINANCIAL",
    name: "Insurance Claims Surge",
    type: "FINANCIAL",
    exposure: 69, financialImpact: "$1.6B", confidence: 86,
    trend: "ACTIVE", severity: "HIGH",
    desc: "Estimated claims exceeding reinsurance buffers. 3 insurers on watchlist.",
    propagatesTo: ["N16"],
  },
  {
    id: "N15", layer: "SYSTEMIC",
    name: "Banking System Stress",
    type: "SYSTEMIC",
    exposure: 74, financialImpact: "$4.8B", confidence: 77,
    trend: "ELEVATED", severity: "CRITICAL",
    desc: "System-wide credit quality deterioration. RBI macroprudential buffer activation possible.",
    propagatesTo: ["N16"],
  },
  {
    id: "N16", layer: "SYSTEMIC",
    name: "Macroeconomic Contagion",
    type: "SYSTEMIC",
    exposure: 81, financialImpact: "$8.2B", confidence: 73,
    trend: "WATCH", severity: "CRITICAL",
    desc: "GDP impact estimate: -0.4pp. CPI: +0.8pp. Fiscal burden: ₹14,000–18,000 Cr.",
    propagatesTo: [],
  },
];

const LAYER_COLORS: Record<string, string> = {
  PHYSICAL:       "#4DA3FF",
  INFRASTRUCTURE: "#70D8FF",
  ENTERPRISE:     "#D8913F",
  FINANCIAL:      "#C9A227",
  SYSTEMIC:       "#FF5B5B",
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#FF5B5B",
  HIGH:     "#D8913F",
  ELEVATED: "#C9A227",
  WATCH:    "#4DA3FF",
};

const LAYER_ORDER = ["PHYSICAL", "INFRASTRUCTURE", "ENTERPRISE", "FINANCIAL", "SYSTEMIC"];

/* ─── Component ──────────────────────────────────────────────────────── */

export default function RiskPropagationPage() {
  const [selected, setSelected] = useState<typeof PROPAGATION_NODES[0] | null>(null);

  const getDownstream = (node: typeof PROPAGATION_NODES[0]) =>
    node.propagatesTo.map(id => PROPAGATION_NODES.find(n => n.id === id)).filter(Boolean) as typeof PROPAGATION_NODES;

  const getUpstream = (node: typeof PROPAGATION_NODES[0]) =>
    PROPAGATION_NODES.filter(n => n.propagatesTo.includes(node.id));

  return (
    <div style={{ minHeight: "100%", background: "#0C1220" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1E2C3D", background: "#0F1722" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.20em", textTransform: "uppercase", marginBottom: "3px" }}>CLIMATE RISK INTELLIGENCE — CASCADE ANALYSIS</div>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "#DDE7F2", letterSpacing: "-0.01em", margin: 0 }}>Risk Propagation Engine</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "ACTIVE CASCADES", val: "7",    color: "#FF5B5B" },
            { label: "TOTAL EXPOSURE",  val: "$8.2B", color: "#D8913F" },
            { label: "CONF. LEVEL",     val: "77%",   color: "#4DA3FF" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.14em" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "calc(100vh - 180px)" }}>

        {/* ─ Propagation graph ─────────────────────────── */}
        <div style={{ borderRight: "1px solid #1E2C3D", overflowY: "auto", padding: "0" }}>
          {LAYER_ORDER.map(layer => {
            const nodes = PROPAGATION_NODES.filter(n => n.layer === layer);
            return (
              <div key={layer}>
                {/* Layer header */}
                <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", background: "#0C1220", borderBottom: "1px solid #1E2C3D", gap: 8, position: "sticky", top: 0, zIndex: 1 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: LAYER_COLORS[layer], flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", fontWeight: 700, color: LAYER_COLORS[layer], letterSpacing: "0.18em" }}>
                    LAYER {LAYER_ORDER.indexOf(layer) + 1} — {layer} RISK
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", marginLeft: "auto" }}>
                    {nodes.length} NODE{nodes.length > 1 ? "S" : ""}
                  </span>
                </div>

                {/* Nodes */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 0 }}>
                  {nodes.map(node => {
                    const isSelected = selected?.id === node.id;
                    const isDownstream = selected ? selected.propagatesTo.includes(node.id) : false;
                    const isUpstream   = selected ? node.propagatesTo.includes(selected.id) : false;
                    const isConnected  = isSelected || isDownstream || isUpstream;

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelected(isSelected ? null : node)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #1E2C3D",
                          borderRight: "1px solid #1E2C3D",
                          cursor: "pointer",
                          background: isSelected ? "#152235" : isConnected ? "#111C2B" : "transparent",
                          borderLeft: isSelected ? `3px solid ${LAYER_COLORS[layer]}` : isDownstream ? "3px solid #FF5B5B" : isUpstream ? "3px solid #63C982" : "3px solid transparent",
                          opacity: selected && !isConnected ? 0.5 : 1,
                          transition: "all 0.12s ease",
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isConnected ? "#111C2B" : "transparent"; }}
                      >
                        {/* Node header */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{node.id}</span>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700,
                              color: LAYER_COLORS[node.layer],
                              border: `1px solid ${LAYER_COLORS[node.layer]}33`,
                              background: `${LAYER_COLORS[node.layer]}0D`,
                              padding: "1px 5px",
                            }}>
                              {node.type}
                            </span>
                          </div>
                          <span style={{
                            fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, padding: "1px 5px",
                            color: SEVERITY_COLOR[node.severity], border: `1px solid ${SEVERITY_COLOR[node.severity]}33`,
                            background: `${SEVERITY_COLOR[node.severity]}0D`,
                          }}>
                            {node.severity}
                          </span>
                        </div>

                        {/* Node name */}
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#DDE7F2", marginBottom: 4 }}>{node.name}</div>

                        {/* Node description */}
                        <div style={{ fontSize: "11px", color: "#62758C", lineHeight: 1.4, marginBottom: 8 }}>{node.desc}</div>

                        {/* Metrics row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                          {[
                            { label: "EXPOSURE",   val: `${node.exposure}%`,      color: node.exposure > 70 ? "#FF5B5B" : "#D8913F" },
                            { label: "IMPACT",     val: node.financialImpact,      color: "#C9A227" },
                            { label: "CONFIDENCE", val: `${node.confidence}%`,     color: "#4DA3FF" },
                            { label: "STATUS",     val: node.trend,                color: node.trend === "ACTIVE" || node.trend === "ACCELERATING" ? "#FF5B5B" : "#D8913F" },
                          ].map(({ label, val, color }) => (
                            <div key={label} style={{ background: "#0F1722", border: "1px solid #1E2C3D", padding: "4px 6px" }}>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A", letterSpacing: "0.10em" }}>{label}</div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color, marginTop: "1px" }}>{val}</div>
                            </div>
                          ))}
                        </div>

                        {/* Propagates to */}
                        {node.propagatesTo.length > 0 && (
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "#3D506A" }}>PROPAGATES →</span>
                            {node.propagatesTo.map(id => (
                              <span key={id} style={{ fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, padding: "1px 5px", color: "#4DA3FF", border: "1px solid #4DA3FF33", background: "#4DA3FF0D" }}>
                                {id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─ Detail Panel ──────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", background: "#0F1722" }}>
          <div className="intel-header">
            <Activity size={11} style={{ color: "#4DA3FF" }} />
            {selected ? "NODE ANALYSIS" : "PROPAGATION LEGEND"}
          </div>

          {!selected ? (
            <div style={{ padding: "16px 14px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "#62758C", lineHeight: 1.6, marginBottom: 16 }}>
                Click any node to view its detailed analysis, upstream drivers, and downstream cascade propagation chains.
              </div>

              {/* Layer legend */}
              {LAYER_ORDER.map((l, i) => (
                <div key={l} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #1E2C3D" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: LAYER_COLORS[l], flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: LAYER_COLORS[l] }}>LAYER {i + 1} — {l}</div>
                    <div style={{ fontSize: "11px", color: "#62758C", marginTop: 2 }}>
                      {l === "PHYSICAL" && "Climate hazard events — direct impact triggers"}
                      {l === "INFRASTRUCTURE" && "Critical infrastructure stress cascade"}
                      {l === "ENTERPRISE" && "Enterprise and sector-level disruptions"}
                      {l === "FINANCIAL" && "Financial sector and credit transmission"}
                      {l === "SYSTEMIC" && "System-wide macroeconomic contagion"}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 14, padding: "10px 12px", background: "#0C1220", border: "1px solid #1E2C3D" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 6 }}>BORDER COLOR LEGEND</div>
                {[
                  { color: "#4DA3FF", label: "Selected node" },
                  { color: "#FF5B5B", label: "Downstream (receives cascade)" },
                  { color: "#63C982", label: "Upstream (triggers selected)" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div style={{ width: 16, height: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Node summary */}
              <div style={{ padding: "14px 14px", borderBottom: "1px solid #1E2C3D" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{selected.id}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", fontWeight: 700, color: LAYER_COLORS[selected.layer], border: `1px solid ${LAYER_COLORS[selected.layer]}33`, background: `${LAYER_COLORS[selected.layer]}0D`, padding: "1px 5px" }}>{selected.layer}</span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#DDE7F2", marginBottom: 8 }}>{selected.name}</div>
                <div style={{ fontSize: "12px", color: "#8CA3BA", lineHeight: 1.5 }}>{selected.desc}</div>
              </div>

              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #1E2C3D" }}>
                {[
                  { label: "EXPOSURE",       val: `${selected.exposure}%`,   color: selected.exposure > 70 ? "#FF5B5B" : "#D8913F" },
                  { label: "FINANCIAL IMPACT",val: selected.financialImpact, color: "#C9A227" },
                  { label: "CONFIDENCE",      val: `${selected.confidence}%`, color: "#4DA3FF" },
                  { label: "TREND",           val: selected.trend,            color: selected.trend === "ACTIVE" ? "#FF5B5B" : "#D8913F" },
                ].map(({ label, val, color }, i) => (
                  <div key={label} style={{ padding: "10px 14px", borderRight: i % 2 === 0 ? "1px solid #1E2C3D" : "none", borderBottom: i < 2 ? "1px solid #1E2C3D" : "none" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "16px", fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Upstream drivers */}
              {getUpstream(selected).length > 0 && (
                <>
                  <div className="intel-header" style={{ background: "#0C1220" }}>
                    <Shield size={10} style={{ color: "#63C982" }} />
                    UPSTREAM DRIVERS ({getUpstream(selected).length})
                  </div>
                  {getUpstream(selected).map(n => (
                    <div key={n.id} onClick={() => setSelected(n)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", transition: "background 0.12s ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#DDE7F2" }}>{n.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{n.id} · {n.layer}</div>
                      </div>
                      <ChevronRight size={12} style={{ color: "#63C982" }} />
                    </div>
                  ))}
                </>
              )}

              {/* Downstream cascade */}
              {getDownstream(selected).length > 0 && (
                <>
                  <div className="intel-header" style={{ background: "#0C1220" }}>
                    <AlertTriangle size={10} style={{ color: "#FF5B5B" }} />
                    DOWNSTREAM CASCADE ({getDownstream(selected).length})
                  </div>
                  {getDownstream(selected).map(n => (
                    <div key={n.id} onClick={() => setSelected(n)} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #1E2C3D", cursor: "pointer", transition: "background 0.12s ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111C2B"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#DDE7F2" }}>{n.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A" }}>{n.id} · {n.layer} · {n.financialImpact}</div>
                      </div>
                      <ChevronRight size={12} style={{ color: "#FF5B5B" }} />
                    </div>
                  ))}
                </>
              )}

              {/* Probability chain */}
              <div style={{ padding: "12px 14px", borderTop: "1px solid #1E2C3D", background: "#0C1220" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#3D506A", letterSpacing: "0.14em", marginBottom: 8 }}>PROPAGATION CHAIN DEPTH</div>
                {[
                  { depth: "Direct", pct: selected.exposure,             color: SEVERITY_COLOR[selected.severity] },
                  { depth: "1-step", pct: Math.round(selected.exposure * 0.72), color: "#D8913F" },
                  { depth: "2-step", pct: Math.round(selected.exposure * 0.51), color: "#C9A227" },
                  { depth: "3-step", pct: Math.round(selected.exposure * 0.33), color: "#4DA3FF" },
                ].map(({ depth, pct, color }) => (
                  <div key={depth} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#62758C" }}>{depth}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 3, background: "#1E2C3D", borderRadius: 1, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
