"use client";

import { useState, useEffect } from "react";
import { Bell, Search, User, ChevronDown, ExternalLink, Activity } from "lucide-react";
import Link from "next/link";

const TICKER = [
  { label: "CO₂ CONC",           value: "424.7 ppm",    delta: "+1.3",   up: true  },
  { label: "CARBON EU-ETS",       value: "€71.20/t",     delta: "+1.2%",  up: true  },
  { label: "TEMP ANOMALY",        value: "+1.52°C",      delta: "+0.04",  up: true  },
  { label: "ARCTIC ICE",          value: "4.61M km²",    delta: "-3.8%",  up: false },
  { label: "CLEAN ENERGY IDX",    value: "2,847",        delta: "+0.6%",  up: true  },
  { label: "GREEN BOND YTD",      value: "$512B",        delta: "+18.4%", up: true  },
  { label: "SEA LEVEL RISE",      value: "+3.9mm/yr",    delta: "+0.12",  up: true  },
  { label: "WATER STRESS IDX",    value: "3.82 / 5",     delta: "+0.08",  up: true  },
  { label: "CARBON INTENSITY",    value: "421 gCO₂/kWh", delta: "-2.1%",  up: false },
  { label: "RENEWABLES SHARE",    value: "38.4%",        delta: "+2.3pp", up: false },
];

const SCENARIOS = [
  "NGFS 1.5°C Net Zero",
  "NGFS 2.0°C Orderly",
  "NGFS 3.0°C Delayed",
  "NGFS Disorderly",
  "RCP 4.5",
  "RCP 8.5",
];

export default function TerminalTopBar() {
  const [time, setTime]           = useState("");
  const [alerts]                  = useState(4);
  const [scenario, setScenario]   = useState("NGFS 2.0°C Orderly");
  const [scenarioOpen, setScOpen] = useState(false);
  const [confidence]              = useState(91);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false, timeZoneName: "short",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="flex-shrink-0 flex flex-col"
      style={{ background: "#0F1722", borderBottom: "1px solid #1E2C3D" }}
    >
      {/* ── Row 1: Command Bar ─────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 h-10"
        style={{ borderBottom: "1px solid #1E2C3D" }}
      >
        {/* Left — scenario + model confidence */}
        <div className="flex items-center gap-3">
          {/* Scenario selector */}
          <div className="relative">
            <button
              onClick={() => setScOpen(o => !o)}
              className="flex items-center gap-2 transition-colors"
              style={{
                background: "rgba(77,163,255,0.08)",
                border: "1px solid rgba(77,163,255,0.2)",
                padding: "3px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#4DA3FF",
              }}
            >
              <Activity size={9} />
              {scenario}
              <ChevronDown size={9} />
            </button>

            {scenarioOpen && (
              <div
                className="absolute top-full left-0 mt-0.5 z-50 min-w-[200px]"
                style={{
                  background: "#111C2B",
                  border: "1px solid #253649",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {SCENARIOS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setScenario(s); setScOpen(false); }}
                    className="w-full text-left px-3 py-2 transition-colors"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      color: s === scenario ? "#4DA3FF" : "#8CA3BA",
                      background: s === scenario ? "rgba(77,163,255,0.08)" : "transparent",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#152235"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = s === scenario ? "rgba(77,163,255,0.08)" : "transparent"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div style={{ width: "1px", height: "16px", background: "#1E2C3D" }} />

          {/* Stats */}
          {[
            { label: "ACTIVE CASCADES",  value: "7",         color: "#FF5B5B" },
            { label: "MODEL CONFIDENCE", value: `${confidence}%`, color: "#4DA3FF" },
            { label: "EXPOSURE COUNT",   value: "248",        color: "#D8913F" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  color: "#3D506A",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 700,
                  color,
                }}
              >
                {value}
              </span>
            </div>
          ))}

          {/* Live indicator */}
          <div style={{ width: "1px", height: "16px", background: "#1E2C3D" }} />
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#63C982", animation: "pulse-dot 2s ease-in-out infinite" }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                fontWeight: 700,
                color: "#63C982",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              LIVE
            </span>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "#3D506A",
            }}
          >
            {time}
          </span>

          {/* Search */}
          <button
            className="flex items-center gap-2 transition-colors"
            style={{
              background: "#152235",
              border: "1px solid #1E2C3D",
              padding: "4px 10px",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#253649"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1E2C3D"; }}
          >
            <Search size={11} style={{ color: "#3D506A" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "#3D506A" }}>
              Search entities, risk events…
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                color: "#253649",
                border: "1px solid #253649",
                padding: "0 4px",
              }}
            >
              ⌘K
            </span>
          </button>

          {/* Alerts bell */}
          <button className="relative p-1.5 transition-colors" style={{ color: "#62758C" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#DDE7F2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#62758C"; }}
          >
            <Bell size={14} />
            {alerts > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full"
                style={{
                  width: "14px", height: "14px",
                  background: "#FF5B5B",
                  fontFamily: "var(--font-mono)",
                  fontSize: "7px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {alerts}
              </span>
            )}
          </button>

          {/* User */}
          <button
            className="flex items-center gap-1.5 px-2 py-1 transition-colors"
            style={{ border: "1px solid #1E2C3D" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#152235"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div
              className="w-5 h-5 flex items-center justify-center"
              style={{ background: "rgba(77,163,255,0.1)", border: "1px solid rgba(77,163,255,0.2)" }}
            >
              <User size={10} style={{ color: "#4DA3FF" }} />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                fontWeight: 600,
                color: "#62758C",
                letterSpacing: "0.08em",
              }}
            >
              ENTERPRISE
            </span>
            <ChevronDown size={9} style={{ color: "#3D506A" }} />
          </button>

          <Link
            href="/"
            className="flex items-center gap-1 transition-colors"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              fontWeight: 600,
              color: "#3D506A",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#62758C"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#3D506A"; }}
          >
            Public Site <ExternalLink size={9} style={{ marginLeft: "2px" }} />
          </Link>
        </div>
      </div>

      {/* ── Row 2: Market Intelligence Ticker ─────────── */}
      <div
        className="flex items-center h-7"
        style={{ background: "#0C1220" }}
      >
        <div
          className="flex-shrink-0 px-3 h-full flex items-center"
          style={{ borderRight: "1px solid #1E2C3D" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "7px",
              fontWeight: 700,
              color: "#4DA3FF",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            CLIMATE DATA
          </span>
        </div>
        <div className="ticker-wrap flex-1 overflow-hidden">
          <div className="ticker-track">
            {[...TICKER, ...TICKER].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    color: "#3D506A",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    fontWeight: 600,
                    color: "#8CA3BA",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.value}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    fontWeight: 600,
                    color: item.up ? "#FF5B5B" : "#63C982",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.up ? "▲" : "▼"} {item.delta}
                </span>
                <span style={{ color: "#1E2C3D", fontSize: "10px" }}>│</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
