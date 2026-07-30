"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ds/Card";
import EmptyState from "@/components/ds/EmptyState";
import PageHeader from "@/components/scenario-studio/PageHeader";
import ScenarioSelector from "@/components/scenario-studio/ScenarioSelector";
import GISMap from "@/components/scenario-studio/GISMap";
import { useScenarioStudioStore } from "@/store";
import { useScenarioRun } from "@/hooks/useScenarioRun";
import { profilesById } from "@/lib/simulation/scenarioStudioHelpers";
import { fetchSupplyChain } from "@/lib/api/scenarioStudio";
import type { SupplyChainEdge } from "@/types/scenario-studio";

export default function GisViewerPage() {
  const { company, assets, run, loading, error } = useScenarioRun();
  const gisLayers = useScenarioStudioStore((s) => s.gisLayers);
  const toggleGisLayer = useScenarioStudioStore((s) => s.toggleGisLayer);
  const setSelectedAssetId = useScenarioStudioStore((s) => s.setSelectedAssetId);
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);

  const [edges, setEdges] = useState<SupplyChainEdge[]>([]);

  useEffect(() => {
    if (!company) return;
    fetchSupplyChain(company.id, scenario, horizon)
      .then((d) => setEdges(d.edges))
      .catch(() => setEdges([]));
  }, [company, scenario, horizon]);

  return (
    <div>
      <PageHeader
        title="GIS Viewer"
        description="GPU-accelerated map — company assets, supply chain links, and physical/transition/carbon risk layers, rendered with MapLibre GL + deck.gl."
      />

      <div className="mb-4">
        <ScenarioSelector showCompareToggle={false} />
      </div>

      {loading && <p className="font-ds-body text-[13px] text-ds-muted">Loading…</p>}
      {!loading && error && <EmptyState title="No map to show" description={error} />}

      {!loading && !error && run && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <Card padding="sm" title="Layers">
            <div className="flex flex-col gap-1">
              {gisLayers.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 font-ds-body text-[13px] text-ds-text hover:bg-ds-surface"
                >
                  <input
                    type="checkbox"
                    checked={layer.active}
                    onChange={() => toggleGisLayer(layer.id)}
                    className="h-3.5 w-3.5 accent-[#0B3D91]"
                  />
                  {layer.label}
                </label>
              ))}
            </div>
          </Card>

          <div className="h-[640px]">
            <GISMap assets={assets} profiles={profilesById(run)} edges={edges} onSelectAsset={setSelectedAssetId} />
          </div>
        </div>
      )}
    </div>
  );
}
