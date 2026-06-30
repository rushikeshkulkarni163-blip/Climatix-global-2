"use client";

import { SatelliteDish, Factory, FileText, Landmark, Bell, Settings, LayoutDashboard } from "lucide-react";
import EmptyState from "@/components/ds/EmptyState";

const MODULE_META: Record<string, { label: string; icon: React.ElementType; source: string }> = {
  "satellite-analytics": { label: "Satellite Analytics", icon: SatelliteDish, source: "satellite imagery providers" },
  "carbon-exposure": { label: "Carbon Exposure", icon: Factory, source: "the carbon accounting engine" },
  disclosure: { label: "Disclosure", icon: FileText, source: "the disclosure document repository" },
  regulations: { label: "Regulations", icon: Landmark, source: "the regulatory intelligence feed" },
  alerts: { label: "Alerts", icon: Bell, source: "the live alerting system" },
  settings: { label: "Settings", icon: Settings, source: "the account configuration service" },
};

export default function DashboardModulePlaceholder({ params }: { params: { module: string } }) {
  const meta = MODULE_META[params.module] ?? {
    label: params.module.replace(/-/g, " "),
    icon: LayoutDashboard,
    source: "the relevant data source",
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-ds-heading text-[24px] font-bold capitalize text-ds-text">{meta.label}</h1>
      <EmptyState
        icon={meta.icon}
        title={`${meta.label} — data integration pending`}
        description={`This module will populate once ${meta.source} is connected. No data is fabricated in the meantime.`}
      />
    </div>
  );
}
