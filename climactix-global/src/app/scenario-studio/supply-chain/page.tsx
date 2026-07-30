"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ds/Card";
import Badge, { type StatusKind } from "@/components/ds/Badge";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import { useScenarioStudioStore } from "@/store";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { fetchSupplyChain } from "@/lib/api/scenarioStudio";
import type { SupplyChainNode } from "@/types/scenario-studio";

const RISK_STATUS: Record<string, StatusKind> = {
  low: "success",
  medium: "info",
  high: "warning",
  critical: "critical",
};

export default function SupplyChainPage() {
  const { company, assets, loading, error } = useScenarioRun();
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);
  const [nodes, setNodes] = useState<SupplyChainNode[]>([]);

  useEffect(() => {
    if (!company) return;
    fetchSupplyChain(company.id, scenario, horizon).then((d) => setNodes(d.nodes));
  }, [company, scenario, horizon]);

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const singleSourceHighRisk = nodes.filter(
    (n) => n.singleSource && (n.riskLevel === "high" || n.riskLevel === "critical")
  );

  const columns: DataTableColumn<SupplyChainNode>[] = [
    { key: "name", header: "Node", accessor: (n) => assetById.get(n.assetId)?.name ?? n.assetId },
    { key: "region", header: "Region", accessor: (n) => n.region },
    { key: "tier", header: "Tier", accessor: (n) => `Tier ${n.tier}` },
    {
      key: "singleSource",
      header: "Single-source",
      accessor: (n) => (n.singleSource ? <Badge status="warning" label="Single-source" size="sm" /> : "—"),
    },
    {
      key: "risk",
      header: "Climate hotspot risk",
      accessor: (n) => <Badge status={RISK_STATUS[n.riskLevel]} label={n.riskLevel} size="sm" />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Supply Chain"
        description="Dependency graph, single-source suppliers, and climate-hotspot exposure across the company's network."
      />

      <div className="mb-4">
        <ScenarioSelector showCompareToggle={false} />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No supply chain to show" description={error} />}

      {!loading && !error && (
        <div className="flex flex-col gap-4">
          {singleSourceHighRisk.length > 0 && (
            <Card title="Cascading impact alert" padding="md">
              <p className="font-ds-body text-[13px] text-ds-text">
                <strong>{singleSourceHighRisk.length}</strong> single-source node
                {singleSourceHighRisk.length === 1 ? "" : "s"} sit in a high or critical climate-risk region —
                disruption here has no alternative sourcing path in the current network.
              </p>
            </Card>
          )}

          <Card title="Network nodes">
            <Table columns={columns} data={nodes} getRowId={(n) => n.assetId} exportFilename="supply-chain-nodes" />
          </Card>
        </div>
      )}
    </div>
  );
}
