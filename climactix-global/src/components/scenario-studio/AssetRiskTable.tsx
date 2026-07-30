"use client";

import Table, { type DataTableColumn } from "@/components/ds/Table";
import Badge from "@/components/ds/Badge";
import type { StatusKind } from "@/components/ds/Badge";
import type { AssetRiskProfile, RiskLevel } from "@/types/simulation";
import type { SimAsset } from "@/types/simulation";

const RISK_STATUS: Record<RiskLevel, StatusKind> = {
  low: "success",
  medium: "info",
  high: "warning",
  critical: "critical",
};

interface AssetRiskRow {
  asset: SimAsset;
  profile: AssetRiskProfile;
}

interface AssetRiskTableProps {
  rows: AssetRiskRow[];
  onSelect?: (assetId: string) => void;
}

export default function AssetRiskTable({ rows, onSelect }: AssetRiskTableProps) {
  const columns: DataTableColumn<AssetRiskRow>[] = [
    { key: "name", header: "Asset", accessor: (r) => r.asset.name, sortValue: (r) => r.asset.name },
    { key: "sector", header: "Sector", accessor: (r) => r.asset.sector, sortValue: (r) => r.asset.sector },
    { key: "country", header: "Country", accessor: (r) => r.asset.country, sortValue: (r) => r.asset.country },
    {
      key: "physical",
      header: "Physical risk",
      align: "right",
      accessor: (r) => r.profile.physicalRisk.toFixed(0),
      sortValue: (r) => r.profile.physicalRisk,
    },
    {
      key: "transition",
      header: "Transition risk",
      align: "right",
      accessor: (r) => r.profile.transitionRisk.toFixed(0),
      sortValue: (r) => r.profile.transitionRisk,
    },
    {
      key: "revenueAtRisk",
      header: "Revenue at risk",
      align: "right",
      accessor: (r) => `${r.profile.revenueAtRisk.toFixed(1)}%`,
      sortValue: (r) => r.profile.revenueAtRisk,
    },
    {
      key: "risk",
      header: "Overall risk",
      accessor: (r) => <Badge status={RISK_STATUS[r.profile.riskLevel]} label={r.profile.riskLevel} size="sm" />,
      sortValue: (r) => r.profile.overallRisk,
    },
  ];

  return (
    <Table
      columns={columns}
      data={rows}
      getRowId={(r) => r.asset.id}
      onRowClick={onSelect ? (r) => onSelect(r.asset.id) : undefined}
      exportFilename="scenario-studio-asset-risk"
      pageSize={10}
    />
  );
}
