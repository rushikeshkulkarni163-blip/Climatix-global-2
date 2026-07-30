"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import PortfolioKPIBar from "@/components/scenario-studio/PortfolioKPIBar";
import EvidencePanel from "@/components/scenario-studio/EvidencePanel";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { buildAssetRiskRows, type AssetRiskRow } from "@/lib/simulation/scenarioStudioHelpers";
import { getEvidence } from "@/lib/simulation/scenarioFamilies";

export default function FinancialImpactPage() {
  const { assets, run, loading, error } = useScenarioRun();
  const rows = buildAssetRiskRows(assets, run);

  const chartData = rows
    .slice()
    .sort((a, b) => (b.asset.revenue * b.profile.revenueAtRisk) / 100 - (a.asset.revenue * a.profile.revenueAtRisk) / 100)
    .slice(0, 8)
    .map((r) => ({
      name: r.asset.name.length > 18 ? `${r.asset.name.slice(0, 18)}…` : r.asset.name,
      revenueAtRiskM: Math.round(((r.asset.revenue * r.profile.revenueAtRisk) / 100) * 10) / 10,
    }));

  const columns: DataTableColumn<AssetRiskRow>[] = [
    { key: "name", header: "Asset", accessor: (r) => r.asset.name },
    { key: "revenue", header: "Revenue ($M)", align: "right", accessor: (r) => r.asset.revenue.toLocaleString() },
    {
      key: "revenueAtRiskPct",
      header: "Revenue at risk (%)",
      align: "right",
      accessor: (r) => `${r.profile.revenueAtRisk.toFixed(1)}%`,
      sortValue: (r) => r.profile.revenueAtRisk,
    },
    {
      key: "ebitdaImpact",
      header: "EBITDA impact (%)",
      align: "right",
      accessor: (r) => `${r.profile.ebitdaImpact.toFixed(1)}%`,
      sortValue: (r) => r.profile.ebitdaImpact,
    },
    {
      key: "complianceCost",
      header: "Compliance cost ($M)",
      align: "right",
      accessor: (r) => `$${r.profile.complianceCostM.toFixed(2)}M`,
      sortValue: (r) => r.profile.complianceCostM,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Impact"
        description="Revenue at risk, EBITDA impact, and compliance cost — the financial translation of physical and transition risk."
      />

      <div className="mb-4">
        <ScenarioSelector />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No financial impact data" description={error} />}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <PortfolioKPIBar portfolio={run.portfolio} />

          <Card title="Top revenue-at-risk exposures" description="Absolute $M revenue at risk by asset, this scenario and horizon">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                  <Tooltip formatter={(v: number) => [`$${v}M`, "Revenue at risk"]} />
                  <Bar dataKey="revenueAtRiskM" fill="#0B3D91" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Financial impact by asset">
            <Table columns={columns} data={rows} getRowId={(r) => r.asset.id} exportFilename="financial-impact" />
          </Card>

          <EvidencePanel evidence={getEvidence()} />
        </div>
      )}
    </div>
  );
}
