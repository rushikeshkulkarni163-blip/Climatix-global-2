"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import { useScenarioStudioStore } from "@/store";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { buildAssetRiskRows, type AssetRiskRow } from "@/lib/simulation/scenarioStudioHelpers";
import { SCENARIO_FAMILIES } from "@/lib/simulation/scenarioFamilies";

export default function CarbonPricingPage() {
  const { assets, run, loading, error } = useScenarioRun();
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const rows = buildAssetRiskRows(assets, run);
  const family = SCENARIO_FAMILIES[scenario];

  const trajectory = [
    { year: 2024, price: Math.round(family.carbonPrice2030 * 0.3) },
    { year: 2030, price: family.carbonPrice2030 },
    { year: 2050, price: family.carbonPrice2050 },
  ];

  const columns: DataTableColumn<AssetRiskRow>[] = [
    { key: "name", header: "Asset", accessor: (r) => r.asset.name },
    { key: "sector", header: "Sector", accessor: (r) => r.asset.sector },
    {
      key: "exposure",
      header: "Effective carbon price ($/t)",
      align: "right",
      accessor: (r) => `$${r.profile.carbonPriceExposure.toFixed(0)}`,
      sortValue: (r) => r.profile.carbonPriceExposure,
    },
    {
      key: "cost",
      header: "Annual compliance cost ($M)",
      align: "right",
      accessor: (r) => `$${r.profile.complianceCostM.toFixed(2)}M`,
      sortValue: (r) => r.profile.complianceCostM,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Carbon Pricing"
        description="Regional carbon-price trajectories under the selected scenario, and the resulting compliance cost per asset."
      />

      <div className="mb-4">
        <ScenarioSelector />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No carbon pricing data" description={error} />}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <Card title={`${family.label} — carbon price trajectory`} description="Global reference price, before regional multipliers">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v}/tCO2e`, "Carbon price"]} />
                  <Area type="monotone" dataKey="price" stroke="#0B3D91" fill="#EAF0FA" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Compliance cost by asset">
            <Table columns={columns} data={rows} getRowId={(r) => r.asset.id} exportFilename="carbon-pricing" />
          </Card>
        </div>
      )}
    </div>
  );
}
