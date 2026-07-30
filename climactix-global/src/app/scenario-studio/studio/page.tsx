"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import Card from "@/components/ds/Card";
import Button from "@/components/ds/Button";
import EmptyState from "@/components/ds/EmptyState";
import Skeleton from "@/components/ds/Skeleton";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import PortfolioKPIBar from "@/components/scenario-studio/PortfolioKPIBar";
import TimelineScrubber from "@/components/scenario-studio/TimelineScrubber";
import AssetRiskTable from "@/components/scenario-studio/AssetRiskTable";
import EvidencePanel from "@/components/scenario-studio/EvidencePanel";
import AIAnalystPanel from "@/components/scenario-studio/AIAnalystPanel";
import { useScenarioStudioStore } from "@/store";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { buildAssetRiskRows } from "@/lib/simulation/scenarioStudioHelpers";
import { getEvidence } from "@/lib/simulation/scenarioFamilies";

export default function ScenarioStudioFlagshipPage() {
  const { company, assets, run, compareRun, loading, error, refetch } = useScenarioRun();
  const setAiAnalystOpen = useScenarioStudioStore((s) => s.setAiAnalystOpen);
  const compareScenario = useScenarioStudioStore((s) => s.compareScenario);

  const rows = buildAssetRiskRows(assets, run);

  return (
    <div>
      <PageHeader
        title="Scenario Studio"
        description="Select a company, industry, country, reporting year, projection horizon, and scenario family to simulate company-level climate risk."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw size={14} /> Re-run
            </Button>
            <Button size="sm" onClick={() => setAiAnalystOpen(true)}>
              <Sparkles size={14} /> Ask the Analyst
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <ScenarioSelector />
      </div>

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!loading && error && (
        <EmptyState title="No simulation to show" description={error} />
      )}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <PortfolioKPIBar portfolio={run.portfolio} />

          <TimelineScrubber />

          {compareScenario && compareRun && (
            <Card title="Scenario comparison" description={`${run.scenario} vs ${compareRun.scenario} at ${run.year}`}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-ds-body text-[12px] font-medium uppercase tracking-wide text-ds-muted">Primary — revenue at risk</p>
                  <p className="font-ds-number text-[22px] font-bold text-ds-accent">${run.portfolio.totalRevenueAtRiskM.toFixed(1)}M</p>
                </div>
                <div>
                  <p className="font-ds-body text-[12px] font-medium uppercase tracking-wide text-ds-muted">Comparison — revenue at risk</p>
                  <p className="font-ds-number text-[22px] font-bold text-ds-warning">${compareRun.portfolio.totalRevenueAtRiskM.toFixed(1)}M</p>
                </div>
              </div>
            </Card>
          )}

          <Card title={`Asset risk breakdown — ${company?.name ?? ""}`} description="Physical + transition risk per facility, this scenario and horizon.">
            <AssetRiskTable rows={rows} />
          </Card>

          <EvidencePanel evidence={getEvidence()} />
        </div>
      )}

      <AIAnalystPanel company={company} run={run} />
    </div>
  );
}
