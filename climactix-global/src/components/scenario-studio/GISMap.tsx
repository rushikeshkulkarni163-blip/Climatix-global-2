"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useScenarioStudioStore } from "@/store";
import { generateRiskGridForFamily } from "@/lib/simulation/scenarioFamilies";
import { riskColor } from "@/lib/simulation/riskEngine";
import type { SimAsset, AssetRiskProfile, RiskLevel } from "@/types/simulation";
import type { SupplyChainEdge } from "@/types/scenario-studio";

/** Institutional pin marker — pointer-shaped (not a plain dot), risk-colored
 *  fill with a white ring + inner dot, thin dark stroke for definition
 *  against the light basemap. One data URI per risk level (client-only). */
function pinDataUri(hex: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="54" viewBox="0 0 40 54">` +
    `<path d="M20 1C9.5 1 1 9.4 1 19.8c0 13.6 19 32.2 19 32.2s19-18.6 19-32.2C39 9.4 30.5 1 20 1z" ` +
    `fill="${hex}" stroke="#111111" stroke-width="1.25" stroke-opacity="0.35"/>` +
    `<circle cx="20" cy="19.8" r="9" fill="#FFFFFF" stroke="${hex}" stroke-width="2"/>` +
    `<circle cx="20" cy="19.8" r="3.5" fill="${hex}"/>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${window.btoa(svg)}`;
}

interface HoverInfo {
  x: number;
  y: number;
  asset: SimAsset;
  profile?: AssetRiskProfile;
}

const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

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
      const { IconLayer, LineLayer } = await import("@deck.gl/layers");
      const { HeatmapLayer } = await import("@deck.gl/aggregation-layers");
      if (cancelled) return;

      const pinIcons: Record<RiskLevel, string> = {
        critical: pinDataUri(riskColor("critical")),
        high: pinDataUri(riskColor("high")),
        medium: pinDataUri(riskColor("medium")),
        low: pinDataUri(riskColor("low")),
      };

      const layers: unknown[] = [];
      const activeIds = new Set(gisLayers.filter((l) => l.active).map((l) => l.id));

      const riskLayerType = activeIds.has("physical")
        ? "physical"
        : activeIds.has("transition")
        ? "transition"
        : activeIds.has("carbon")
        ? "carbon"
        : activeIds.has("ocean")
        ? "ocean"
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
          new IconLayer({
            id: "assets",
            data: assets,
            getIcon: (d: SimAsset) => ({
              url: pinIcons[profiles[d.id]?.riskLevel ?? "medium"],
              width: 40,
              height: 54,
              anchorY: 54,
            }),
            getPosition: (d: SimAsset) => [d.lng, d.lat],
            getSize: (d: SimAsset) => Math.max(30, Math.min(52, 24 + Math.sqrt(d.revenue) * 1.1)),
            sizeUnits: "pixels",
            pickable: true,
            onClick: (info: { object?: SimAsset }) => {
              if (info.object && onSelectAsset) onSelectAsset(info.object.id);
            },
            onHover: (info: { object?: SimAsset; x: number; y: number }) => {
              if (info.object) {
                setHoverInfo({ x: info.x, y: info.y, asset: info.object, profile: profiles[info.object.id] });
              } else {
                setHoverInfo(null);
              }
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
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-ds-border bg-white px-3 py-2 shadow-none"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
        >
          <p className="font-ds-heading text-[13px] font-bold text-ds-text">{hoverInfo.asset.name}</p>
          <p className="font-ds-body text-[12px] text-ds-muted">
            {hoverInfo.asset.sector} · {hoverInfo.asset.country}
          </p>
          {hoverInfo.profile && (
            <div className="mt-1.5 flex items-center justify-between gap-3 font-ds-body text-[12px]">
              <span
                className="font-bold"
                style={{ color: riskColor(hoverInfo.profile.riskLevel) }}
              >
                {RISK_LABEL[hoverInfo.profile.riskLevel]} risk
              </span>
              <span className="font-ds-number font-bold text-ds-text">
                {Math.round(hoverInfo.profile.overallRisk)}/100
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
