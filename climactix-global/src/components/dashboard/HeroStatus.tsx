"use client";

import { AlertTriangle, Gavel, RefreshCw } from "lucide-react";
import { RatingBadge } from "@/components/ds/Badge";
import Badge from "@/components/ds/Badge";
import type { OrgStatus } from "@/lib/dashboard/mockData";

const STATUS_KIND: Record<OrgStatus["portfolioStatus"], "success" | "warning" | "critical"> = {
  Operational: "success",
  Watch: "warning",
  Elevated: "critical",
};

export default function HeroStatus({ status }: { status: OrgStatus }) {
  const updated = new Date(status.lastUpdated);

  return (
    <section className="rounded-lg border border-ds-border bg-ds-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-ds-heading text-[24px] font-bold leading-tight text-ds-text">
            {status.orgName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge status={STATUS_KIND[status.portfolioStatus]} label={`Portfolio: ${status.portfolioStatus}`} />
            <span className="flex items-center gap-1.5 font-ds-body text-[12px] text-ds-muted">
              Overall climate risk rating
              <RatingBadge rating={status.overallRiskRating} size="sm" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroStat icon={AlertTriangle} label="Today's Alerts" value={status.todaysAlerts} accent="critical" />
          <HeroStat icon={Gavel} label="Regulatory Updates" value={status.regulatoryUpdates} accent="info" />
          <HeroStat
            icon={RefreshCw}
            label="Data Freshness"
            value={status.dataFreshness}
            accent={status.dataFreshness === "Live" ? "success" : "warning"}
          />
          <HeroStat
            label="Last Updated"
            value={updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            accent="neutral"
          />
        </div>
      </div>
    </section>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  success: "text-ds-success",
  warning: "text-ds-warning",
  critical: "text-ds-critical",
  info: "text-ds-accent",
  neutral: "text-ds-text2",
};

function HeroStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon?: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-ds-border bg-ds-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-ds-body text-[11px] uppercase tracking-wide text-ds-muted">
        {Icon && <Icon size={11} className={ACCENT_CLASSES[accent]} />}
        {label}
      </div>
      <div className={`mt-1 font-ds-number text-[18px] font-bold ${ACCENT_CLASSES[accent]}`}>{value}</div>
    </div>
  );
}
