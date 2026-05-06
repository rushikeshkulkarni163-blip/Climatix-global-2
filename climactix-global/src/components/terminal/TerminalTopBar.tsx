"use client";

import { useState, useEffect } from "react";
import { Bell, Search, User, ChevronDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const TICKER = [
  { label: "CO₂", value: "423 ppm", change: "+1.2", up: true },
  { label: "Carbon Price (EU-ETS)", value: "€68.40/t", change: "+0.8%", up: true },
  { label: "Global Temp Anomaly", value: "+1.48°C", change: "+0.02", up: true },
  { label: "Arctic Sea Ice", value: "4.82M km²", change: "-3.1%", up: false },
  { label: "S&P ESG Index", value: "4,812", change: "+0.4%", up: true },
  { label: "Green Bond Issuance", value: "$487B YTD", change: "+22%", up: true },
  { label: "Renewable Capacity", value: "3,870 GW", change: "+12%", up: true },
  { label: "Sea Level Rise", value: "+3.7mm/yr", change: "+0.1", up: true },
];

export default function TerminalTopBar() {
  const [time, setTime] = useState("");
  const [alerts] = useState(3);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZoneName: "short",
        })
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex-shrink-0 bg-[#000000] border-b border-[#1A1A1A] flex flex-col">
      {/* Top row */}
      <div className="flex items-center justify-between px-5 h-10 border-b border-[#111111]">
        {/* Left — breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-[#2A2A2A] uppercase tracking-[0.2em]">
            CLIMACTIX TERMINAL
          </span>
          <span className="text-[#1A1A1A]">/</span>
          <span className="text-[9px] font-bold text-[#5A5A5A] uppercase tracking-[0.2em]">
            CLIMATE RISK INTELLIGENCE OS
          </span>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-[#3A3A3A]">{time}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[9px] font-bold text-[#10B981] uppercase tracking-widest">LIVE</span>
          </div>

          {/* Search */}
          <button className="flex items-center gap-1.5 bg-[#111111] border border-[#1F1F1F] px-3 py-1 hover:border-[#2A2A2A] transition-colors">
            <Search className="w-3 h-3 text-[#5A5A5A]" />
            <span className="text-[9px] text-[#3A3A3A]">Search companies, assets...</span>
            <span className="text-[8px] text-[#2A2A2A] border border-[#2A2A2A] px-1">⌘K</span>
          </button>

          {/* Alerts */}
          <button className="relative p-1.5 text-[#5A5A5A] hover:text-white transition-colors">
            <Bell className="w-4 h-4" />
            {alerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#EF4444] text-white text-[7px] font-bold flex items-center justify-center rounded-full">
                {alerts}
              </span>
            )}
          </button>

          {/* User */}
          <button className="flex items-center gap-1.5 hover:bg-[#111111] px-2 py-1 transition-colors">
            <div className="w-5 h-5 bg-[#0A1F44] flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="text-[9px] font-bold text-[#5A5A5A] uppercase">Enterprise</span>
            <ChevronDown className="w-3 h-3 text-[#3A3A3A]" />
          </button>

          <Link
            href="/"
            className="flex items-center gap-1 text-[9px] font-bold text-[#3A3A3A] hover:text-[#5A5A5A] transition-colors uppercase tracking-widest"
          >
            Public Site <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Market ticker */}
      <div className="flex items-center h-8 overflow-hidden">
        <div className="flex-shrink-0 px-4 border-r border-[#111111] h-full flex items-center">
          <span className="text-[8px] font-bold text-white uppercase tracking-[0.18em] whitespace-nowrap">
            MARKET DATA
          </span>
        </div>
        <div className="ticker-wrap flex-1">
          <div className="ticker-content flex gap-8 items-center">
            {[...TICKER, ...TICKER].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[9px] text-[#3A3A3A] uppercase tracking-wider whitespace-nowrap">
                  {item.label}
                </span>
                <span className="text-[9px] font-bold text-[#9CA3AF] whitespace-nowrap">{item.value}</span>
                <span className={`text-[8px] font-bold whitespace-nowrap ${item.up ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                  {item.up ? "▲" : "▼"} {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
