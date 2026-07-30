"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Card from "@/components/ds/Card";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import EvidencePanel from "@/components/scenario-studio/EvidencePanel";
import { useScenarioRun } from "@/hooks/useScenarioRun";

export default function ClimateVaRPage() {
  const { company, run, loading, error } = useScenarioRun();

  const chartData = run
    ? [
        { label: "Expected annual loss", value: run.portfolio.climateVaR95.expectedAnnualLossUsdM, fill: "#1E8E3E" },
        { label: "VaR (95%)", value: run.portfolio.climateVaR95.valueAtRiskUsdM, fill: "#B45309" },
        { label: "VaR (99%)", value: run.portfolio.climateVaR99.valueAtRiskUsdM, fill: "#DC2626" },
        { label: "Worst case (99%)", value: run.portfolio.climateVaR99.worstCaseUsdM, fill: "#7F1D1D" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Climate VaR"
        description="Portfolio Value-at-Risk under climate stress — the single number institutional risk committees ask for first."
      />

      <div className="mb-4">
        <ScenarioSelector />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No VaR to show" description={error} />}

      {!loading && !error && run && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="md" title="Expected annual loss">
              <p className="font-ds-number text-[26px] font-bold text-ds-text">
                ${run.portfolio.climateVaR95.expectedAnnualLossUsdM.toFixed(1)}M
              </p>
            </Card>
            <Card padding="md" title="VaR (95% confidence)">
              <p className="font-ds-number text-[26px] font-bold text-ds-warning">
                ${run.portfolio.climateVaR95.valueAtRiskUsdM.toFixed(1)}M
              </p>
            </Card>
            <Card padding="md" title="VaR (99% confidence)">
              <p className="font-ds-number text-[26px] font-bold text-ds-critical">
                ${run.portfolio.climateVaR99.valueAtRiskUsdM.toFixed(1)}M
              </p>
            </Card>
            <Card padding="md" title="Worst case (99%)">
              <p className="font-ds-number text-[26px] font-bold text-ds-critical">
                ${run.portfolio.climateVaR99.worstCaseUsdM.toFixed(1)}M
              </p>
            </Card>
          </div>

          <Card title={`${company?.name ?? "Portfolio"} — loss distribution, ${run.scenario} at ${run.year}`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}M`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, "Loss"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.label} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <EvidencePanel evidence={run.portfolio.climateVaR95.evidence} />
        </div>
      )}
    </div>
  );
}
