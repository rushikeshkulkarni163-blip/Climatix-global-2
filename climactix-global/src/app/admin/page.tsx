"use client";

import { useState, useEffect } from "react";
import type { TickerItem } from "@/types/live";

interface ContentStats {
  tickerItems: number;
  activeAlerts: number;
  publishedInsights: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number | string>>({});
  const [stats] = useState<ContentStats>({
    tickerItems: 8,
    activeAlerts: 3,
    publishedInsights: 4,
    totalUsers: 3,
  });

  useEffect(() => {
    fetch("/api/live/metrics")
      .then((r) => r.json())
      .then(setLiveMetrics)
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          CONTROL PANEL
        </p>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-gray-500 text-sm mt-1">
          Real-time content management and platform monitoring
        </p>
      </div>

      {/* Live metrics grid */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">
          LIVE DATA STREAM
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1F1F1F]">
          {[
            { label: "CO₂ ppm", key: "co2ppm", suffix: " ppm", color: "text-[#EF4444]" },
            { label: "Temp Anomaly", key: "globalTempAnomaly", prefix: "+", suffix: "°C", color: "text-[#F97316]" },
            { label: "Active Wildfires", key: "activeWildfires", suffix: "", color: "text-[#F59E0B]" },
            { label: "Renewable Share", key: "renewableSharePct", suffix: "%", color: "text-[#10B981]" },
          ].map(({ label, key, prefix = "", suffix, color }) => (
            <div key={key} className="bg-[#0A0A0A] p-5">
              <div className={`text-xl font-bold ${color}`}>
                {prefix}{liveMetrics[key] ?? "—"}{suffix}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">{label}</div>
              <div className="flex items-center gap-1 mt-2">
                <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[8px] text-gray-600">LIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content stats */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">
          CONTENT STATUS
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1F1F1F]">
          {[
            { label: "Ticker Items", value: stats.tickerItems, href: "/admin/ticker" },
            { label: "Active Alerts", value: stats.activeAlerts, href: "/admin/alerts" },
            { label: "Published Insights", value: stats.publishedInsights, href: "/admin/insights" },
            { label: "Platform Users", value: stats.totalUsers, href: "/admin/users" },
          ].map(({ label, value, href }) => (
            <a key={label} href={href} className="bg-[#0A0A0A] p-5 hover:bg-[#111] transition-colors group">
              <div className="text-2xl font-bold text-white group-hover:text-[#3B82F6] transition-colors">
                {value}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-1">{label}</div>
              <div className="text-[9px] text-gray-600 mt-2 group-hover:text-gray-400 transition-colors">
                Manage →
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">
          QUICK ACTIONS
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#1F1F1F]">
          <QuickAction
            title="Edit Live Ticker"
            desc="Add, remove, or reorder Bloomberg-style ticker items"
            href="/admin/ticker"
          />
          <QuickAction
            title="Publish Insight"
            desc="Create or edit featured climate intelligence insights"
            href="/admin/insights"
          />
          <QuickAction
            title="Upload Report"
            desc="Upload PDF reports for institutional client access"
            href="/admin/reports"
          />
        </div>
      </div>

      {/* System status */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">
          SYSTEM STATUS
        </p>
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] p-6 space-y-3">
          {SYSTEM_SERVICES.map(({ name, status, endpoint }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-[#111]">
              <div>
                <span className="text-xs font-bold text-white">{name}</span>
                <span className="text-[9px] text-gray-500 ml-3">{endpoint}</span>
              </div>
              <span
                className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${
                  status === "online" ? "text-[#10B981]" : status === "degraded" ? "text-[#F59E0B]" : "text-[#EF4444]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === "online"
                      ? "bg-[#10B981] animate-pulse"
                      : status === "degraded"
                      ? "bg-[#F59E0B]"
                      : "bg-[#EF4444]"
                  }`}
                />
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="bg-[#0A0A0A] p-6 hover:bg-[#111] transition-colors group">
      <h3 className="text-sm font-bold text-white mb-2 group-hover:text-[#3B82F6] transition-colors">
        {title}
      </h3>
      <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
      <span className="text-[9px] text-gray-600 group-hover:text-gray-400 mt-3 block transition-colors">
        Open →
      </span>
    </a>
  );
}

const SYSTEM_SERVICES = [
  { name: "Next.js Frontend", status: "online", endpoint: "localhost:3000" },
  { name: "FastAPI Intelligence Engine", status: "online", endpoint: "localhost:8000" },
  { name: "Live Metrics API", status: "online", endpoint: "/api/live/metrics" },
  { name: "Live Ticker API", status: "online", endpoint: "/api/live/ticker" },
  { name: "Climate Alerts API", status: "online", endpoint: "/api/live/alerts" },
  { name: "JWT Auth Service", status: "online", endpoint: "/api/auth/*" },
  { name: "PostgreSQL + TimescaleDB", status: "degraded", endpoint: "postgres:5432" },
  { name: "Redis Cache", status: "degraded", endpoint: "redis:6379" },
];
