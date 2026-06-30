"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import Card from "@/components/ds/Card";
import Drawer from "@/components/ds/Drawer";
import { formatCurrency } from "@/lib/utils";
import { useDashboardStore } from "@/store";
import { MAP_ASSETS, HAZARD_ZONES, type MapAsset } from "@/lib/dashboard/mockData";

const RISK_COLOR: Record<MapAsset["riskLevel"], string> = {
  low: "#1E8E3E",
  medium: "#B45309",
  high: "#E07B3A",
  critical: "#DC2626",
};

const HAZARD_COLOR: Record<string, string> = {
  flood: "#0B3D91",
  heat: "#DC2626",
  wildfire: "#B45309",
  cyclone: "#6B7280",
};

const LIGHT_TILE_URLS = [
  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
];

const SATELLITE_TILE_URLS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

function assetsToGeoJSON(kinds: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: MAP_ASSETS.filter((a) => kinds.has(a.kind)).map((a) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
      properties: { id: a.id, riskLevel: a.riskLevel },
    })),
  };
}

function hazardsToGeoJSON(hazards: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: HAZARD_ZONES.filter((h) => hazards.has(h.hazard)).map((h) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [h.lng, h.lat] },
      properties: { hazard: h.hazard, intensity: h.intensity },
    })),
  };
}

export default function IntelligenceMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const layers = useDashboardStore((s) => s.mapLayers);
  const setSelectedAssetId = useDashboardStore((s) => s.setSelectedAssetId);
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId);
  const toggleMapLayer = useDashboardStore((s) => s.toggleMapLayer);

  const selectedAsset = MAP_ASSETS.find((a) => a.id === selectedAssetId) ?? null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    (async () => {
      if (!document.querySelector("#mlgl-css")) {
        const link = document.createElement("link");
        link.id = "mlgl-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }
      const mlgl = (await import("maplibre-gl")).default;
      if (destroyed || !containerRef.current) return;

      const map = new mlgl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            base: {
              type: "raster",
              tiles: LIGHT_TILE_URLS,
              tileSize: 256,
              attribution: "© OpenStreetMap contributors © CARTO",
            },
          },
          layers: [
            { id: "background", type: "background", paint: { "background-color": "#FAFAFA" } },
            { id: "base-tiles", type: "raster", source: "base" },
          ],
        },
        center: [40, 15],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 10,
        attributionControl: false,
      });

      map.addControl(new mlgl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        if (destroyed) return;
        mapRef.current = map;

        map.addSource("hazards", { type: "geojson", data: hazardsToGeoJSON(new Set()) });
        map.addLayer({
          id: "hazard-circles",
          type: "circle",
          source: "hazards",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 14, 1, 36],
            "circle-color": [
              "match",
              ["get", "hazard"],
              "flood", HAZARD_COLOR.flood,
              "heat", HAZARD_COLOR.heat,
              "wildfire", HAZARD_COLOR.wildfire,
              "cyclone", HAZARD_COLOR.cyclone,
              "#6B7280",
            ],
            "circle-opacity": 0.18,
            "circle-stroke-width": 0,
          },
        });

        map.addSource("assets", { type: "geojson", data: assetsToGeoJSON(new Set()) });
        map.addLayer({
          id: "asset-points",
          type: "circle",
          source: "assets",
          paint: {
            "circle-radius": 6,
            "circle-color": [
              "match",
              ["get", "riskLevel"],
              "low", RISK_COLOR.low,
              "medium", RISK_COLOR.medium,
              "high", RISK_COLOR.high,
              "critical", RISK_COLOR.critical,
              "#6B7280",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        map.on("click", "asset-points", (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) setSelectedAssetId(id);
        });
        map.on("mouseenter", "asset-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "asset-points", () => {
          map.getCanvas().style.cursor = "";
        });

        setLoaded(true);
      });
    })();

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [setSelectedAssetId]);

  // React to layer toggles
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;

    const activeAssetKinds = new Set(layers.filter((l) => ["assets", "suppliers", "ports", "plants"].includes(l.id) && l.active).map((l) => l.id));
    const activeHazards = new Set(layers.filter((l) => ["flood", "heat", "wildfire", "cyclone"].includes(l.id) && l.active).map((l) => l.id));

    const assetSource = map.getSource("assets") as GeoJSONSource | undefined;
    assetSource?.setData(assetsToGeoJSON(activeAssetKinds));

    const hazardSource = map.getSource("hazards") as GeoJSONSource | undefined;
    hazardSource?.setData(hazardsToGeoJSON(activeHazards));

    const satellite = layers.find((l) => l.id === "satellite")?.active;
    if (map.getSource("base")) {
      map.removeLayer("base-tiles");
      map.removeSource("base");
      map.addSource("base", {
        type: "raster",
        tiles: satellite ? SATELLITE_TILE_URLS : LIGHT_TILE_URLS,
        tileSize: 256,
      });
      map.addLayer({ id: "base-tiles", type: "raster", source: "base" }, "hazard-circles");
    }
  }, [layers, loaded]);

  return (
    <Card id="map" title="Interactive Intelligence Map" description="Assets, suppliers, ports, and hazard overlays" padding="none">
      <div className="relative">
        <div ref={containerRef} className="h-[420px] w-full rounded-b-lg" />

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-ds-surface font-ds-body text-[13px] text-ds-muted">
            Loading map…
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-lg border border-ds-border bg-white/95 p-2.5 shadow-none">
          <span className="px-1 font-ds-body text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
            Layers
          </span>
          {layers.map((layer) => (
            <label key={layer.id} className="flex items-center gap-2 px-1 py-0.5 font-ds-body text-[12px] text-ds-text">
              <input
                type="checkbox"
                checked={layer.active}
                onChange={() => toggleMapLayer(layer.id)}
                className="h-3.5 w-3.5 accent-[#0B3D91]"
              />
              {layer.label}
            </label>
          ))}
        </div>
      </div>

      <Drawer
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAssetId(null)}
        title={selectedAsset?.name ?? ""}
        description={selectedAsset?.country}
      >
        {selectedAsset && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-ds-border bg-ds-surface p-3">
              <p className="font-ds-body text-[12px] uppercase tracking-wide text-ds-muted">Risk level</p>
              <p className="mt-1 font-ds-heading text-[16px] font-bold capitalize" style={{ color: RISK_COLOR[selectedAsset.riskLevel] }}>
                {selectedAsset.riskLevel}
              </p>
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Financial impact
              </p>
              <p className="mt-1 font-ds-number text-[20px] font-bold text-ds-text">
                {formatCurrency(selectedAsset.financialImpactUSD, "USD", true)}
              </p>
            </div>
            <div>
              <p className="font-ds-body text-[12px] font-semibold uppercase tracking-wide text-ds-muted">
                Recommendation
              </p>
              <p className="mt-1 font-ds-body text-[14px] text-ds-text">{selectedAsset.recommendation}</p>
            </div>
          </div>
        )}
      </Drawer>
    </Card>
  );
}
