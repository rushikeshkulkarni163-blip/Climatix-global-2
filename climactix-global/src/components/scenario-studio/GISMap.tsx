"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useScenarioStudioStore } from "@/store";
import { generateRiskGridForFamily } from "@/lib/simulation/scenarioFamilies";
import { riskColor } from "@/lib/simulation/riskEngine";
import type { SimAsset, AssetRiskProfile } from "@/types/simulation";
import type { SupplyChainEdge } from "@/types/scenario-studio";

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

interface GISMapProps {
  assets: SimAsset[];
  profiles: Record<string, AssetRiskProfile>;
  edges: SupplyChainEdge[];
  onSelectAsset?: (assetId: string) => void;
}

export default function GISMap({ assets, profiles, edges, onSelectAsset }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const overlayRef = useRef<{ setProps: (props: Record<string, unknown>) => void } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const gisLayers = useScenarioStudioStore((s) => s.gisLayers);
  const scenario = useScenarioStudioStore((s) => s.scenario);
  const horizon = useScenarioStudioStore((s) => s.horizon);

  const assetsById = new Map(assets.map((a) => [a.id, a]));

  // ── Map init (client-side only) ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      if (!document.getElementById("mlgl-css")) {
        const link = document.createElement("link");
        link.id = "mlgl-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }

      const maplibregl = await import("maplibre-gl");
      const { MapboxOverlay } = await import("@deck.gl/mapbox");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            "carto-light": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap &copy; CARTO",
            },
          },
          layers: [{ id: "carto-light-layer", type: "raster", source: "carto-light" }],
        },
        center: [10, 20],
        zoom: 1.4,
      });

      const overlay = new MapboxOverlay({ layers: [] });
      map.addControl(overlay as unknown as import("maplibre-gl").IControl);

      map.on("load", () => {
        if (cancelled) return;
        mapRef.current = map;
        overlayRef.current = overlay;
        setMapLoaded(true);
      });
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reactive layer rebuild ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !overlayRef.current) return;

    let cancelled = false;

    async function buildLayers() {
      const { ScatterplotLayer, LineLayer } = await import("@deck.gl/layers");
      const { HeatmapLayer } = await import("@deck.gl/aggregation-layers");
      if (cancelled) return;

      const layers: unknown[] = [];
      const activeIds = new Set(gisLayers.filter((l) => l.active).map((l) => l.id));

      const riskLayerType = activeIds.has("physical")
        ? "physical"
        : activeIds.has("transition")
        ? "transition"
        : activeIds.has("carbon")
        ? "carbon"
        : null;

      if (riskLayerType) {
        const grid = generateRiskGridForFamily(scenario, horizon, riskLayerType);
        layers.push(
          new HeatmapLayer({
            id: `heatmap-${riskLayerType}`,
            data: (grid.features as { geometry: { coordinates: [number, number] }; properties: { intensity: number } }[]),
            getPosition: (d) => d.geometry.coordinates,
            getWeight: (d) => d.properties.intensity,
            radiusPixels: 60,
            intensity: 1,
            threshold: 0.03,
            colorRange: [
              [30, 143, 62, 60],
              [180, 83, 9, 100],
              [220, 38, 38, 140],
              [220, 38, 38, 200],
            ],
          })
        );
      }

      if (activeIds.has("supply-links") && edges.length > 0) {
        const edgeLines = edges
          .map((e) => {
            const s = assetsById.get(e.sourceId);
            const t = assetsById.get(e.targetId);
            if (!s || !t) return null;
            return { source: [s.lng, s.lat] as [number, number], target: [t.lng, t.lat] as [number, number] };
          })
          .filter((x): x is { source: [number, number]; target: [number, number] } => x !== null);

        layers.push(
          new LineLayer({
            id: "supply-links",
            data: edgeLines,
            getSourcePosition: (d) => d.source,
            getTargetPosition: (d) => d.target,
            getColor: [11, 61, 145, 140],
            getWidth: 1.5,
          })
        );
      }

      if (activeIds.has("assets")) {
        layers.push(
          new ScatterplotLayer({
            id: "assets",
            data: assets,
            getPosition: (d: SimAsset) => [d.lng, d.lat],
            getFillColor: (d: SimAsset) => {
              const p = profiles[d.id];
              return p ? hexToRgb(riskColor(p.riskLevel)) : [107, 114, 128];
            },
            getRadius: (d: SimAsset) => Math.max(6, Math.sqrt(d.revenue) * 400),
            radiusMinPixels: 5,
            radiusMaxPixels: 22,
            pickable: true,
            stroked: true,
            getLineColor: [255, 255, 255],
            lineWidthMinPixels: 1.5,
            onClick: (info: { object?: SimAsset }) => {
              if (info.object && onSelectAsset) onSelectAsset(info.object.id);
            },
          })
        );
      }

      overlayRef.current?.setProps({ layers });
    }

    buildLayers();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, gisLayers, scenario, horizon, assets, profiles, edges]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-ds-border">
      <div ref={containerRef} className="h-full w-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-ds-surface font-ds-body text-[13px] text-ds-muted">
          Loading map…
        </div>
      )}
    </div>
  );
}
