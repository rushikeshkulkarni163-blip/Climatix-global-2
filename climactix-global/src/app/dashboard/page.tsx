"use client";

import { useSimulationStore } from "@/store";
import HeroStatus from "@/components/dashboard/HeroStatus";
import KPICard from "@/components/dashboard/KPICard";
import ScenarioControl from "@/components/dashboard/ScenarioControl";
import IntelligenceMap from "@/components/dashboard/IntelligenceMap";
import RiskMatrix from "@/components/dashboard/RiskMatrix";
import EmissionsTrajectoryV4 from "@/components/dashboard/EmissionsTrajectoryV4";
import TemperatureTimelineV4 from "@/components/dashboard/TemperatureTimelineV4";
import ClimateEventTimeline from "@/components/dashboard/ClimateEventTimeline";
import SupplyChainGraph from "@/components/dashboard/SupplyChainGraph";
import PortfolioTable from "@/components/dashboard/PortfolioTable";
import { ORG_STATUS, KPI_DEFINITIONS, SCENARIO_MULTIPLIERS } from "@/lib/dashboard/mockData";

export default function DashboardPage() {
  const scenario = useSimulationStore((s) => s.scenario);
  const multipliers = SCENARIO_MULTIPLIERS[scenario];

  return (
    <div className="flex flex-col gap-6">
      <HeroStatus status={ORG_STATUS} />

      <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPI_DEFINITIONS.map((kpi) => (
          <KPICard key={kpi.id} kpi={kpi} multiplier={multipliers[kpi.id] ?? 1} />
        ))}
      </section>

      <ScenarioControl />

      <IntelligenceMap />

      <RiskMatrix />

      <section aria-label="Trend charts" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <EmissionsTrajectoryV4 />
        <TemperatureTimelineV4 />
      </section>

      <ClimateEventTimeline />

      <SupplyChainGraph />

      <PortfolioTable />
    </div>
  );
}
