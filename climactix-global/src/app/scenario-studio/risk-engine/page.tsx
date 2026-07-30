"use client";

import Card from "@/components/ds/Card";
import Table, { type DataTableColumn } from "@/components/ds/Table";
import PageHeader from "@/components/scenario-studio/PageHeader";
import { SCENARIO_FAMILIES, SCENARIO_FAMILY_ORDER } from "@/lib/simulation/scenarioFamilies";
import type { ScenarioFamilyConfig } from "@/types/scenario-studio";

const PHYSICAL_WEIGHTS = [
  { component: "Heat stress", weight: "28%" },
  { component: "Flood risk", weight: "32%" },
  { component: "Storm/cyclone risk", weight: "22%" },
  { component: "Drought (+ permafrost thaw)", weight: "18%" },
];

const TRANSITION_WEIGHTS = [
  { component: "Policy risk (carbon pricing, regulation)", weight: "62%" },
  { component: "Technology risk (stranded-asset exposure)", weight: "38%" },
];

const OVERALL_WEIGHTS = [
  { component: "Physical risk", weight: "44%" },
  { component: "Transition risk", weight: "44%" },
  { component: "Supply chain risk", weight: "12%" },
];

const DATA_SOURCES = [
  "NGFS Phase IV/V Scenario Explorer — carbon price & temperature pathways (published, ngfs.net)",
  "Climactix geographic hazard heuristic — heat/flood/storm/drought base rates by latitude and coastal proximity",
  "Climactix sector risk-weight table — 9 sectors, physical/transition multipliers, EBITDA leverage",
  "Company-submitted asset registry — location, revenue, replacement value, energy source, water dependency",
];

export default function RiskEnginePage() {
  const columns: DataTableColumn<ScenarioFamilyConfig>[] = [
    { key: "label", header: "Scenario family", accessor: (f) => f.label },
    { key: "category", header: "Category", accessor: (f) => f.category },
    { key: "temp", header: "2100 warming", align: "right", accessor: (f) => `${f.tempRise2100.toFixed(1)}°C` },
    { key: "cp2030", header: "Carbon price 2030", align: "right", accessor: (f) => `$${f.carbonPrice2030}/t` },
    { key: "cp2050", header: "Carbon price 2050", align: "right", accessor: (f) => `$${f.carbonPrice2050}/t` },
    { key: "orderliness", header: "Policy orderliness", align: "right", accessor: (f) => f.policyOrderliness.toFixed(2) },
  ];

  return (
    <div>
      <PageHeader
        title="Risk Engine"
        description="Full methodology and weighting behind every score in Scenario Studio — no black-box outputs. Every reasoning layer below feeds the Evidence panel shown alongside each metric."
      />

      <div className="flex flex-col gap-6">
        <Card title="Scenario families" description="NGFS Phase IV/V published reference scenarios, calibrated to Climactix's risk-multiplier space.">
          <Table columns={columns} data={SCENARIO_FAMILY_ORDER.map((id) => SCENARIO_FAMILIES[id])} getRowId={(f) => f.id} searchable={false} />
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card title="Physical risk composite" description="Weighted average of hazard sub-scores (0–100)">
            <ul className="flex flex-col gap-2">
              {PHYSICAL_WEIGHTS.map((w) => (
                <li key={w.component} className="flex items-center justify-between font-ds-body text-[13px]">
                  <span className="text-ds-text">{w.component}</span>
                  <span className="font-ds-number font-bold text-ds-accent">{w.weight}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Transition risk composite" description="Weighted average of policy/technology sub-scores">
            <ul className="flex flex-col gap-2">
              {TRANSITION_WEIGHTS.map((w) => (
                <li key={w.component} className="flex items-center justify-between font-ds-body text-[13px]">
                  <span className="text-ds-text">{w.component}</span>
                  <span className="font-ds-number font-bold text-ds-accent">{w.weight}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Overall risk composite" description="Portfolio/asset-level composite score">
            <ul className="flex flex-col gap-2">
              {OVERALL_WEIGHTS.map((w) => (
                <li key={w.component} className="flex items-center justify-between font-ds-body text-[13px]">
                  <span className="text-ds-text">{w.component}</span>
                  <span className="font-ds-number font-bold text-ds-accent">{w.weight}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Climate VaR methodology" description="Parametric (variance-covariance) approach — disclosed limitation vs. full Monte Carlo">
          <p className="font-ds-body text-[13px] leading-relaxed text-ds-text2">
            Expected Annual Loss (EAL) is the portfolio&apos;s revenue-at-risk aggregated across all assets for the
            selected scenario and horizon year. Loss is modeled as approximately normally distributed around EAL, with
            a coefficient of variation that widens for disorderly/fragmented scenarios (reflecting greater
            policy-timing uncertainty). VaR at a given confidence level is EAL × (1 + z<sub>c</sub> × CV), using
            standard one-tailed normal z-scores (z<sub>95</sub> = 1.645, z<sub>99</sub> = 2.326). This is a simplified
            parametric estimate, not a full Monte Carlo simulation — treat the 99% figure as directional, not a
            precise tail estimate, until a full stochastic hazard model is integrated.
          </p>
        </Card>

        <Card title="Data sources" description="Every evidence panel in Scenario Studio cites these sources">
          <ul className="list-inside list-disc space-y-1.5 font-ds-body text-[13px] text-ds-text2">
            {DATA_SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
