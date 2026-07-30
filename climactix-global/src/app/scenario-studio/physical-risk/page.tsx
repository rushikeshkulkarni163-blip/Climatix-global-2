"use client";

import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import EvidencePanel from "@/components/scenario-studio/EvidencePanel";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { buildAssetRiskRows, type AssetRiskRow } from "@/lib/simulation/scenarioStudioHelpers";
import { getEvidence } from "@/lib/simulation/scenarioFamilies";

export default function PhysicalRiskPage() {
  const { assets, run, loading, error } = useScenarioRun();
  const rows = buildAssetRiskRows(assets, run);

  const columns: DataTableColumn<AssetRiskRow>[] = [
    { key: "name", header: "Asset", accessor: (r) => r.asset.name },
    { key: "country", header: "Country", accessor: (r) => r.asset.country },
    { key: "heat", header: "Heat stress", align: "right", accessor: (r) => r.profile.heatStress.toFixed(0), sortValue: (r) => r.profile.heatStress },
    { key: "flood", header: "Flood risk", align: "right", accessor: (r) => r.profile.floodRisk.toFixed(0), sortValue: (r) => r.profile.floodRisk },
    { key: "storm", header: "Storm/cyclone", align: "right", accessor: (r) => r.profile.stormRisk.toFixed(0), sortValue: (r) => r.profile.stormRisk },
    { key: "drought", header: "Drought", align: "right", accessor: (r) => r.profile.droughtRisk.toFixed(0), sortValue: (r) => r.profile.droughtRisk },
    {
      key: "composite",
      header: "Physical risk (composite)",
      align: "right",
      accessor: (r) => r.profile.physicalRisk.toFixed(0),
      sortValue: (r) => r.profile.physicalRisk,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Physical Risk"
        description="Flood, heatwave, cyclone, drought, and wildfire-adjacent exposure per asset, derived from geographic hazard heuristics and scenario physical multipliers."
      />

      <div className="mb-4">
        <ScenarioSelector />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No physical risk data" description={error} />}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <Card title="Physical hazard sub-scores by asset (0–100)">
            <Table columns={columns} data={rows} getRowId={(r) => r.asset.id} exportFilename="physical-risk" />
          </Card>
          <EvidencePanel evidence={getEvidence()} />
        </div>
      )}
    </div>
  );
}
