"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Building2,
  Factory,
  Globe2,
  ShieldAlert,
  FileBarChart,
} from "lucide-react";
import Card from "@/components/ds/Card";
import Badge from "@/components/ds/Badge";
import PageHeader from "@/components/scenario-studio/PageHeader";
import { fetchCompanies } from "@/lib/api/scenarioStudio";
import type { ScenarioCompany } from "@/types/scenario-studio";

const QUICK_LINKS = [
  { icon: FlaskConical, label: "Run a scenario simulation", description: "Company, scenario family, horizon, results", href: "/scenario-studio/studio" },
  { icon: Building2, label: "Company Workspace", description: "Manage companies and portfolios", href: "/scenario-studio/companies" },
  { icon: Factory, label: "Asset Explorer", description: "Facility-level financial and operational data", href: "/scenario-studio/assets" },
  { icon: Globe2, label: "GIS Viewer", description: "GPU-accelerated hazard and asset map", href: "/scenario-studio/gis" },
  { icon: ShieldAlert, label: "Climate VaR", description: "Portfolio value-at-risk under stress", href: "/scenario-studio/climate-var" },
  { icon: FileBarChart, label: "Reports", description: "Board-ready scenario comparison reports", href: "/scenario-studio/reports" },
];

export default function ScenarioStudioDashboardPage() {
  const [companies, setCompanies] = useState<ScenarioCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Scenario Studio"
        description="Climate Risk Intelligence Operating System — translate climate science into financial intelligence for capital allocation."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Companies" padding="md">
          <p className="font-ds-number text-[28px] font-bold text-ds-text">{loading ? "—" : companies.length}</p>
          <p className="mt-1 font-ds-body text-[13px] text-ds-muted">
            {companies.filter((c) => c.isSample).length} sample, {companies.filter((c) => !c.isSample).length} client-created
          </p>
        </Card>
        <Card title="Scenario families" padding="md">
          <p className="font-ds-number text-[28px] font-bold text-ds-text">6</p>
          <p className="mt-1 font-ds-body text-[13px] text-ds-muted">NGFS Phase IV/V published reference set</p>
        </Card>
        <Card title="Projection horizon" padding="md">
          <p className="font-ds-number text-[28px] font-bold text-ds-text">2025–2100</p>
          <p className="mt-1 font-ds-body text-[13px] text-ds-muted">8 checkpoint years, animated timeline</p>
        </Card>
      </div>

      <h2 className="mb-3 font-ds-heading text-[18px] font-bold text-ds-text">Jump in</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map(({ icon: Icon, label, description, href }) => (
          <Link key={href} href={href}>
            <Card hoverable padding="md" className="h-full">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ds-accent-bg text-ds-accent">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-ds-heading text-[15px] font-bold text-ds-text">{label}</p>
                  <p className="mt-0.5 font-ds-body text-[13px] text-ds-muted">{description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {!loading && companies.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-ds-heading text-[18px] font-bold text-ds-text">Companies</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Card key={c.id} padding="md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-ds-heading text-[15px] font-bold text-ds-text">{c.name}</p>
                    <p className="mt-0.5 font-ds-body text-[13px] text-ds-muted">
                      {c.industry} · {c.country}
                    </p>
                  </div>
                  {c.isSample && <Badge status="info" label="Sample" size="sm" />}
                </div>
                <p className="mt-2 font-ds-number text-[16px] font-bold text-ds-text">
                  ${c.revenueUsdM.toLocaleString()}M revenue
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
