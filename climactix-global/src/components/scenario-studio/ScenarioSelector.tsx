"use client";

import { useEffect, useState } from "react";
import Select from "@/components/ds/Select";
import Badge from "@/components/ds/Badge";
import { useScenarioStudioStore } from "@/store";
import { fetchCompanies, fetchScenarioFamilies } from "@/lib/api/scenarioStudio";
import { PROJECTION_YEARS } from "@/types/scenario-studio";
import type { ScenarioCompany, ScenarioFamilyConfig, ScenarioFamilyId, ProjectionYear } from "@/types/scenario-studio";

interface ScenarioSelectorProps {
  showCompareToggle?: boolean;
}

export default function ScenarioSelector({ showCompareToggle = true }: ScenarioSelectorProps) {
  const [companies, setCompanies] = useState<ScenarioCompany[]>([]);
  const [families, setFamilies] = useState<ScenarioFamilyConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedCompanyId = useScenarioStudioStore((s) => s.selectedCompanyId);
  const setSelectedCompanyId = useScenarioStudioStore((s) => s.setSelectedCompanyId);
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const setScenario = useScenarioStudioStore((s) => s.setScenario);
  const compareScenario = useScenarioStudioStore((s) => s.compareScenario);
  const setCompareScenario = useScenarioStudioStore((s) => s.setCompareScenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);
  const setHorizon = useScenarioStudioStore((s) => s.setHorizon);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCompanies(), fetchScenarioFamilies()])
      .then(([c, f]) => {
        if (cancelled) return;
        setCompanies(c);
        setFamilies(f);
        if (!selectedCompanyId && c.length > 0) setSelectedCompanyId(c[0].id);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFamily = families.find((f) => f.id === scenario);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-ds-border bg-ds-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <Select
        label="Company"
        value={selectedCompanyId ?? undefined}
        onValueChange={setSelectedCompanyId}
        placeholder={loading ? "Loading…" : "Select company"}
        options={companies.map((c) => ({ value: c.id, label: `${c.name}${c.isSample ? " (Sample)" : ""}` }))}
        className="min-w-[220px]"
      />

      <Select
        label="Scenario family"
        value={scenario}
        onValueChange={(v) => setScenario(v as ScenarioFamilyId)}
        options={families.map((f) => ({ value: f.id, label: f.label }))}
        className="min-w-[220px]"
      />

      {showCompareToggle && (
        <Select
          label="Compare against (optional)"
          value={compareScenario ?? "none"}
          onValueChange={(v) => setCompareScenario(v === "none" ? null : (v as ScenarioFamilyId))}
          options={[
            { value: "none", label: "None" },
            ...families.filter((f) => f.id !== scenario).map((f) => ({ value: f.id, label: f.label })),
          ]}
          className="min-w-[220px]"
        />
      )}

      <Select
        label="Horizon year"
        value={String(horizon)}
        onValueChange={(v) => setHorizon(Number(v) as ProjectionYear)}
        options={PROJECTION_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
        className="min-w-[120px]"
      />

      {activeFamily && (
        <Badge
          status={activeFamily.category === "orderly" ? "success" : activeFamily.category === "disorderly" ? "warning" : "critical"}
          label={activeFamily.shortLabel}
        />
      )}
    </div>
  );
}
