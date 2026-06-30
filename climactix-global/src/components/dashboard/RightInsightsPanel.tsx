"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  History,
  Database,
  TrendingUp,
  ListChecks,
  Gavel,
  RefreshCw,
} from "lucide-react";
import Badge from "@/components/ds/Badge";

interface InsightItem {
  label: string;
  meta: string;
  status?: "success" | "warning" | "critical" | "info";
}

interface InsightSection {
  key: string;
  title: string;
  icon: React.ElementType;
  items: InsightItem[];
}

const BASE_SECTIONS: InsightSection[] = [
  {
    key: "top-risks",
    title: "Top Risks",
    icon: AlertTriangle,
    items: [
      { label: "Coastal flood exposure — APAC manufacturing", meta: "Revenue at risk: $84M", status: "critical" },
      { label: "Tier-2 supplier concentration — Vietnam", meta: "12 suppliers, single province", status: "warning" },
      { label: "Carbon price sensitivity — EU ETS", meta: "+€38/t since Q1", status: "warning" },
    ],
  },
  {
    key: "recent-changes",
    title: "Recent Changes",
    icon: History,
    items: [
      { label: "Climate Risk Score recalculated", meta: "2 hours ago · +1.2 pts" },
      { label: "New NGFS scenario data ingested", meta: "6 hours ago · 2.0°C Orderly" },
      { label: "Portfolio coverage updated", meta: "Yesterday · 94.2% of AUM" },
    ],
  },
  {
    key: "data-quality",
    title: "Data Quality",
    icon: Database,
    items: [
      { label: "Scope 1/2 emissions", meta: "Verified · 14 sources", status: "success" },
      { label: "Scope 3 emissions", meta: "Estimated · confidence 68%", status: "warning" },
      { label: "Physical asset geocoding", meta: "98.4% resolved", status: "success" },
    ],
  },
  {
    key: "emerging-risks",
    title: "Emerging Risks",
    icon: TrendingUp,
    items: [
      { label: "Water stress trend — Northern India", meta: "Watch · 3 facilities", status: "warning" },
      { label: "Heat stress labor productivity", meta: "Monitoring · APAC operations" },
    ],
  },
  {
    key: "suggested-actions",
    title: "Suggested Actions",
    icon: ListChecks,
    items: [
      { label: "Review flood mitigation capex for 3 sites", meta: "Priority: P1" },
      { label: "Diversify Tier-2 supplier base — Vietnam", meta: "Priority: P2" },
      { label: "Validate Scope 3 estimation methodology", meta: "Priority: P3" },
    ],
  },
  {
    key: "regulatory-alerts",
    title: "Regulatory Alerts",
    icon: Gavel,
    items: [
      { label: "CSRD phase-in — large non-EU filers", meta: "Effective FY2026", status: "info" },
      { label: "SEC climate disclosure rule", meta: "Pending litigation review", status: "warning" },
    ],
  },
];

export default function RightInsightsPanel() {
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    setLastRefreshed(new Date());
    const id = window.setInterval(() => setLastRefreshed(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ds-border px-4 py-3.5">
        <h2 className="font-ds-heading text-[13px] font-bold uppercase tracking-wide text-ds-text">
          Intelligence Feed
        </h2>
        <span className="flex items-center gap-1 font-ds-body text-[11px] text-ds-muted">
          <RefreshCw size={11} />
          {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {BASE_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.key} className="mb-5">
              <div className="mb-2 flex items-center gap-1.5">
                <Icon size={13} className="text-ds-accent" />
                <h3 className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-text2">
                  {section.title}
                </h3>
              </div>
              <ul className="flex flex-col gap-2">
                {section.items.map((item) => (
                  <li
                    key={item.label}
                    className="rounded-lg border border-ds-border bg-ds-surface px-2.5 py-2"
                  >
                    <p className="font-ds-body text-[12.5px] leading-snug text-ds-text">{item.label}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-ds-body text-[11px] text-ds-muted">{item.meta}</span>
                      {item.status && (
                        <Badge status={item.status} label={item.status} size="sm" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
