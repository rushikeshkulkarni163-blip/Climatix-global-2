"use client";

import Card from "@/components/ds/Card";
import Select from "@/components/ds/Select";
import Badge from "@/components/ds/Badge";
import PageHeader from "@/components/scenario-studio/PageHeader";
import { useScenarioStudioStore } from "@/store";
import { SCENARIO_FAMILY_ORDER, SCENARIO_FAMILIES } from "@/lib/simulation/scenarioFamilies";
import { PROJECTION_YEARS, type ScenarioFamilyId, type ProjectionYear } from "@/types/scenario-studio";

export default function ScenarioStudioSettingsPage() {
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const setScenario = useScenarioStudioStore((s) => s.setScenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);
  const setHorizon = useScenarioStudioStore((s) => s.setHorizon);

  return (
    <div>
      <PageHeader title="Settings" description="Module-level defaults for Scenario Studio." />

      <div className="flex flex-col gap-6">
        <Card title="Default scenario & horizon" description="Applied whenever you open a new Scenario Studio module">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Select
              label="Default scenario family"
              value={scenario}
              onValueChange={(v) => setScenario(v as ScenarioFamilyId)}
              options={SCENARIO_FAMILY_ORDER.map((id) => ({ value: id, label: SCENARIO_FAMILIES[id].label }))}
              className="min-w-[240px]"
            />
            <Select
              label="Default horizon year"
              value={String(horizon)}
              onValueChange={(v) => setHorizon(Number(v) as ProjectionYear)}
              options={PROJECTION_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              className="min-w-[160px]"
            />
          </div>
        </Card>

        <Card title="Access & roles" description="Scenario Studio permissions follow the platform-wide RBAC model">
          <div className="flex flex-col gap-2">
            {[
              { role: "Analyst", access: "Run simulations, view all modules, generate reports" },
              { role: "Admin", access: "Analyst permissions + manage companies, assets, and settings" },
              { role: "Viewer", access: "Read-only access to dashboards and reports" },
            ].map((r) => (
              <div key={r.role} className="flex items-center justify-between rounded-lg border border-ds-border px-3 py-2.5">
                <div>
                  <p className="font-ds-heading text-[14px] font-bold text-ds-text">{r.role}</p>
                  <p className="font-ds-body text-[13px] text-ds-muted">{r.access}</p>
                </div>
                <Badge status="info" label="simulation:run" size="sm" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Data provenance" description="Sample data disclosure">
          <p className="font-ds-body text-[13px] text-ds-text2">
            The bundled demo portfolio (Meridian Energy & Resources, Atlas Global Manufacturing, Helios Technology
            Holdings) is sample data for demonstration only — it is clearly labeled &quot;Sample&quot; throughout the
            product. Create a real company in Company Workspace to begin working with your own asset data.
          </p>
        </Card>
      </div>
    </div>
  );
}
