"use client";

import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import Badge from "@/components/ds/Badge";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import EvidencePanel from "@/components/scenario-studio/EvidencePanel";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { buildAssetRiskRows, type AssetRiskRow } from "@/lib/simulation/scenarioStudioHelpers";
import { getEvidence } from "@/lib/simulation/scenarioFamilies";

export default function TransitionRiskPage() {
  const { assets, run, loading, error } = useScenarioRun();
  const rows = buildAssetRiskRows(assets, run);

  const columns: DataTableColumn<AssetRiskRow>[] = [
    { key: "name", header: "Asset", accessor: (r) => r.asset.name },
    { key: "sector", header: "Sector", accessor: (r) => r.asset.sector },
    {
      key: "carbonExposure",
      header: "Carbon price exposure ($/t)",
      align: "right",
      accessor: (r) => `$${r.profile.carbonPriceExposure.toFixed(0)}`,
      sortValue: (r) => r.profile.carbonPriceExposure,
    },
    { key: "policy", header: "Policy risk", align: "right", accessor: (r) => r.profile.policyRisk.toFixed(0), sortValue: (r) => r.profile.policyRisk },
    {
      key: "technology",
      header: "Technology risk",
      align: "right",
      accessor: (r) => r.profile.technologyRisk.toFixed(0),
      sortValue: (r) => r.profile.technologyRisk,
    },
    {
      key: "composite",
      header: "Transition risk (composite)",
      align: "right",
      accessor: (r) => r.profile.transitionRisk.toFixed(0),
      sortValue: (r) => r.profile.transitionRisk,
    },
    {
      key: "stranded",
      header: "Stranded asset flag",
      accessor: (r) => (r.profile.strandedRisk ? <Badge status="critical" label="At risk" size="sm" /> : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Transition Risk"
        description="Carbon pricing, energy transition, regulatory, and stranded-asset exposure per asset under the selected scenario."
      />

      <div className="mb-4">
        <ScenarioSelector />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No transition risk data" description={error} />}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <Card title="Transition risk sub-scores by asset (0–100)">
            <Table columns={columns} data={rows} getRowId={(r) => r.asset.id} exportFilename="transition-risk" />
          </Card>
          <EvidencePanel evidence={getEvidence()} />
        </div>
      )}
    </div>
  );
}
