"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { useDashboardStore } from "@/store";
import { MAP_ASSETS, HAZARD_ZONES, type MapAsset } from "@/lib/dashboard/mockData";
import { formatCurrency } from "@/lib/utils";

// ── Tile sources ─────────────────────────────────────────────────────────────
const SATELLITE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];
const LIGHT_TILES = [
  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
];

// ── Risk palette ─────────────────────────────────────────────────────────────
const RISK_COLOR: Record<MapAsset["riskLevel"], string> = {
  low: "#1E8E3E",
  medium: "#B45309",
  high: "#E07B3A",
  critical: "#DC2626",
};

const HAZARD_COLOR: Record<string, string> = {
  flood: "#3B82F6",
  heat: "#EF4444",
  wildfire: "#F97316",
  cyclone: "#A78BFA",
};

// ── Timeline data (static, no Date() at module scope) ────────────────────────
const TIMELINE_MONTHS = [
  "Jul '25", "Aug", "Sep", "Oct", "Nov", "Dec '25",
  "Jan '26", "Feb", "Mar", "Apr", "May", "Jun '26",
];
const TIMELINE_DATES = [
  "2025-07-01", "2025-08-01", "2025-09-01", "2025-10-01",
  "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01",
  "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-30",
];

// ── Layer group meta ─────────────────────────────────────────────────────────
type LayerGroupId = "hazards" | "assets" | "base";
const LAYER_GROUPS: { id: LayerGroupId; label: string; layerIds: string[] }[] = [
  { id: "hazards", label: "Hazard Overlays", layerIds: ["flood", "heat", "wildfire", "cyclone"] },
  { id: "assets",  label: "Asset Network",   layerIds: ["assets", "suppliers", "ports", "plants"] },
  { id: "base",    label: "Base Map",         layerIds: ["satellite"] },
];

const LAYER_LABEL: Record<string, string> = {
  flood: "Flood Risk", heat: "Heat Stress", wildfire: "Wildfire", cyclone: "Cyclone Path",
  assets: "Assets", suppliers: "Suppliers", ports: "Ports", plants: "Plants",
  satellite: "Satellite Imagery",
};

// ── GeoJSON builders ─────────────────────────────────────────────────────────
function assetsGeoJSON(kinds: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: MAP_ASSETS.filter((a) => kinds.has(a.kind)).map((a) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
      properties: { id: a.id, riskLevel: a.riskLevel },
    })),
  };
}

function hazardsGeoJSON(active: Set<string>) {
  return {
    type: "FeatureCollection" as const,
    features: HAZARD_ZONES.filter((h) => active.has(h.hazard)).map((h) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [h.lng, h.lat] },
      properties: { hazard: h.hazard, intensity: h.intensity },
    })),
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function IntelligenceMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<LayerGroupId>>(new Set<LayerGroupId>(["hazards", "assets"]));
  const [coords, setCoords] = useState<{ lng: string; lat: string } | null>(null);
  const [timeIdx, setTimeIdx] = useState(11);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const layers = useDashboardStore((s) => s.mapLayers);
  const toggleMapLayer = useDashboardStore((s) => s.toggleMapLayer);
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useDashboardStore((s) => s.setSelectedAssetId);
  const selectedAsset = MAP_ASSETS.find((a) => a.id === selectedAssetId) ?? null;

  // ── Map init ─────────────────────────────────────────────────────────────
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
              tiles: SATELLITE_TILES,
              tileSize: 256,
              attribution: "Esri, DigitalGlobe, GeoEye",
            },
          },
          layers: [
            { id: "background", type: "background", paint: { "background-color": "#060A1C" } },
            { id: "base-tiles", type: "raster", source: "base" },
          ],
        },
        center: [40, 12],
        zoom: 1.6,
        minZoom: 1,
        maxZoom: 12,
        attributionControl: false,
      });

      map.addControl(new mlgl.AttributionControl({ compact: true }), "bottom-right");

      map.on("mousemove", (e) => {
        setCoords({
          lat: e.lngLat.lat.toFixed(3),
          lng: e.lngLat.lng.toFixed(3),
        });
      });

      map.on("load", () => {
        if (destroyed) return;
        mapRef.current = map;

        // Hazard halo
        map.addSource("hazards", { type: "geojson", data: hazardsGeoJSON(new Set()) });
        map.addLayer({
          id: "hazard-halo",
          type: "circle",
          source: "hazards",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 22, 1, 60],
            "circle-color": [
              "match", ["get", "hazard"],
              "flood", HAZARD_COLOR.flood,
              "heat", HAZARD_COLOR.heat,
              "wildfire", HAZARD_COLOR.wildfire,
              "cyclone", HAZARD_COLOR.cyclone,
              "#6B7280",
            ],
            "circle-opacity": 0.14,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": [
              "match", ["get", "hazard"],
              "flood", HAZARD_COLOR.flood,
              "heat", HAZARD_COLOR.heat,
              "wildfire", HAZARD_COLOR.wildfire,
              "cyclone", HAZARD_COLOR.cyclone,
              "#6B7280",
            ],
            "circle-stroke-opacity": 0.45,
          },
        });

        // Asset outer glow
        map.addSource("assets", { type: "geojson", data: assetsGeoJSON(new Set()) });
        map.addLayer({
          id: "asset-glow",
          type: "circle",
          source: "assets",
          paint: {
            "circle-radius": 14,
            "circle-color": [
              "match", ["get", "riskLevel"],
              "low", RISK_COLOR.low, "medium", RISK_COLOR.medium,
              "high", RISK_COLOR.high, "critical", RISK_COLOR.critical, "#6B7280",
            ],
            "circle-opacity": 0.18,
          },
        });

        // Asset core dot
        map.addLayer({
          id: "asset-points",
          type: "circle",
          source: "assets",
          paint: {
            "circle-radius": 6,
            "circle-color": [
              "match", ["get", "riskLevel"],
              "low", RISK_COLOR.low, "medium", RISK_COLOR.medium,
              "high", RISK_COLOR.high, "critical", RISK_COLOR.critical, "#6B7280",
            ],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        const onAssetClick = (e: { features?: { properties?: { id?: string } }[] }) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) setSelectedAssetId(id);
        };
        map.on("click", "asset-points", onAssetClick);
        map.on("click", "asset-glow", onAssetClick);
        map.on("mouseenter", "asset-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "asset-points", () => { map.getCanvas().style.cursor = ""; });

        setLoaded(true);
      });
    })();

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [setSelectedAssetId]);

  // ── Layer sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;

    const activeKinds = new Set(
      layers.filter((l) => ["assets", "suppliers", "ports", "plants"].includes(l.id) && l.active).map((l) => l.id)
    );
    const activeHazards = new Set(
      layers.filter((l) => ["flood", "heat", "wildfire", "cyclone"].includes(l.id) && l.active).map((l) => l.id)
    );

    (map.getSource("assets") as GeoJSONSource | undefined)?.setData(assetsGeoJSON(activeKinds));
    (map.getSource("hazards") as GeoJSONSource | undefined)?.setData(hazardsGeoJSON(activeHazards));

    const useSatellite = layers.find((l) => l.id === "satellite")?.active ?? true;
    if (map.getSource("base")) {
      map.removeLayer("base-tiles");
      map.removeSource("base");
      map.addSource("base", { type: "raster", tiles: useSatellite ? SATELLITE_TILES : LIGHT_TILES, tileSize: 256 });
      map.addLayer({ id: "base-tiles", type: "raster", source: "base" }, "hazard-halo");
    }
  }, [layers, loaded]);

  // ── Timeline playback ────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setTimeIdx((prev) => {
          if (prev >= TIMELINE_MONTHS.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 750);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing]);

  const toggleGroup = (id: LayerGroupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const mapH = expanded ? "min(calc(100vh - 180px), 800px)" : "580px";
  const pct = (timeIdx / (TIMELINE_MONTHS.length - 1)) * 100;

  return (
    <section
      className="relative overflow-hidden"
      style={{ borderRadius: 10, border: "1px solid #1A2140" }}
      aria-label="Risk Intelligence Map"
    >
      {/* ── TOP HUD ──────────────────────────────────────────────────── */}
      <div style={hud}>
        {/* Brand label */}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#6B9FFF", textTransform: "uppercase", fontFamily: HF }}>
          Climactix · Risk Intelligence
        </span>
        <Divider />

        {/* Date chip */}
        <span style={{ fontSize: 11, color: "#A0BCFF", fontVariantNumeric: "tabular-nums", fontFamily: HF }}>
          {TIMELINE_DATES[timeIdx]}
        </span>

        {/* Live dot */}
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} />
          <span style={{ fontSize: 9, color: "#4ADE80", fontWeight: 700, letterSpacing: "0.1em", fontFamily: HF }}>LIVE</span>
        </span>

        <span style={{ flex: 1 }} />

        {/* Coordinates */}
        {coords && (
          <span style={{ fontSize: 10, color: "#5A7BAA", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em", fontFamily: HF }}>
            {Number(coords.lat) > 0 ? "+" : ""}{coords.lat}° / {Number(coords.lng) > 0 ? "+" : ""}{coords.lng}°
          </span>
        )}

        {/* Layer toggle */}
        <HudButton active={panelOpen} onClick={() => setPanelOpen((v) => !v)} title="Toggle layers">
          <LayerIcon />
          <span style={{ marginLeft: 5, fontSize: 10, letterSpacing: "0.08em", fontFamily: HF }}>LAYERS</span>
        </HudButton>

        {/* Expand */}
        <HudButton active={false} onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"}>
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </HudButton>
      </div>

      {/* ── MAP CANVAS ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: mapH, transition: "height 250ms ease", background: "#060A1C" }}
      />

      {!loaded && (
        <div style={{ position: "absolute", inset: 0, top: 37, background: "#060A1C", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: "#3A5A80", letterSpacing: "0.1em", fontFamily: HF }}>Loading satellite feed…</span>
        </div>
      )}

      {/* ── LEFT LAYER PANEL ─────────────────────────────────────────── */}
      {panelOpen && (
        <div style={panel("left", 50)}>
          <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={panelLabel}>Data Products</span>
          </div>

          {LAYER_GROUPS.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 12px" }} />}
              <button style={groupBtn} onClick={() => toggleGroup(group.id)}>
                <span style={{ color: "#8AACCC", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: HF }}>
                  {group.label}
                </span>
                <span style={{ color: "#3A5A80", fontSize: 9, transform: openGroups.has(group.id) ? "rotate(90deg)" : "none", transition: "transform 150ms", display: "inline-block" }}>▶</span>
              </button>

              {openGroups.has(group.id) && group.layerIds.map((lid) => {
                const lyr = layers.find((l) => l.id === lid);
                if (!lyr) return null;
                return (
                  <label key={lid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px 4px 22px", cursor: "pointer" }}>
                    <span style={{
                      width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                      border: `1px solid ${lyr.active ? "#3B6FCC" : "#1E2E50"}`,
                      background: lyr.active ? "#0B3D91" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {lyr.active && <span style={{ fontSize: 8, color: "#fff", lineHeight: 1 }}>✓</span>}
                    </span>
                    <input type="checkbox" checked={lyr.active} onChange={() => toggleMapLayer(lid)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                    <span style={{ fontSize: 12, color: lyr.active ? "#C0D4FF" : "#3A5A80", transition: "color 150ms", fontFamily: HF }}>
                      {LAYER_LABEL[lid] ?? lyr.label}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}

          {/* Risk legend */}
          <div style={{ padding: "8px 12px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}>
            <span style={{ ...panelLabel, display: "block", marginBottom: 6 }}>Risk Level</span>
            {(["critical", "high", "medium", "low"] as const).map((lvl) => (
              <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: RISK_COLOR[lvl], flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#6A8BAA", textTransform: "capitalize", fontFamily: HF }}>{lvl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ASSET DETAIL PANEL ───────────────────────────────────────── */}
      {selectedAsset && (
        <div style={panel("right", 50)}>
          <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#C0D4FF", lineHeight: 1.35, fontFamily: HF }}>{selectedAsset.name}</p>
              <p style={{ fontSize: 10, color: "#3A5A80", marginTop: 3, fontFamily: HF }}>{selectedAsset.country} · {selectedAsset.kind}</p>
            </div>
            <button onClick={() => setSelectedAssetId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#3A5A80", padding: 2, flexShrink: 0 }}>
              <CloseIcon />
            </button>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Risk */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLOR[selectedAsset.riskLevel] }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: RISK_COLOR[selectedAsset.riskLevel], textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: HF }}>
                {selectedAsset.riskLevel} Risk
              </span>
            </div>

            {/* Financial */}
            <div>
              <p style={{ fontSize: 9, color: "#3A5A80", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3, fontFamily: HF }}>Financial Exposure</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: HF }}>
                {formatCurrency(selectedAsset.financialImpactUSD, "USD", true)}
              </p>
            </div>

            {/* Recommendation */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
              <p style={{ fontSize: 9, color: "#3A5A80", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5, fontFamily: HF }}>Recommendation</p>
              <p style={{ fontSize: 11, color: "#7A9ABE", lineHeight: 1.55, fontFamily: HF }}>{selectedAsset.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM TIMELINE ──────────────────────────────────────────── */}
      <div style={timeline}>
        {/* Playback controls */}
        <button style={tBtn} onClick={() => setTimeIdx((p) => Math.max(0, p - 1))} title="Previous month">
          <SkipBackIcon />
        </button>
        <button
          style={{ ...tBtn, background: "rgba(11,61,145,0.5)", borderColor: "rgba(107,159,255,0.35)", color: "#6B9FFF" }}
          onClick={() => setPlaying((v) => !v)}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button style={tBtn} onClick={() => setTimeIdx((p) => Math.min(TIMELINE_MONTHS.length - 1, p + 1))} title="Next month">
          <SkipFwdIcon />
        </button>

        {/* Scrubber */}
        <div style={{ flex: 1, position: "relative", userSelect: "none" }}>
          {/* Month labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            {TIMELINE_MONTHS.map((m, i) => (
              <span
                key={m}
                onClick={() => setTimeIdx(i)}
                style={{
                  fontSize: 9, cursor: "pointer", fontFamily: HF,
                  color: i === timeIdx ? "#6B9FFF" : i === 0 || i === 5 || i === 6 || i === 11 ? "#2E4268" : "transparent",
                  fontWeight: i === timeIdx ? 700 : 400,
                  letterSpacing: "0.03em",
                  transition: "color 150ms",
                }}
              >
                {m}
              </span>
            ))}
          </div>

          {/* Track */}
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, position: "relative" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #0B3D91, #3B6FCC)", borderRadius: 2, width: `${pct}%`, transition: "width 150ms" }} />
            {/* Tick marks */}
            {TIMELINE_MONTHS.map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute", top: -3, left: `${(i / (TIMELINE_MONTHS.length - 1)) * 100}%`,
                  transform: "translateX(-50%)",
                  width: 1, height: 9,
                  background: i === timeIdx ? "rgba(107,159,255,0.8)" : "rgba(255,255,255,0.12)",
                  transition: "background 150ms",
                }}
              />
            ))}
            {/* Thumb */}
            <div style={{
              position: "absolute", top: "50%", left: `${pct}%`,
              transform: "translate(-50%, -50%)", pointerEvents: "none",
              width: 11, height: 11, borderRadius: "50%",
              background: "#6B9FFF", border: "2px solid #B8D0FF",
              transition: "left 150ms",
            }} />
            <input
              type="range" min={0} max={TIMELINE_MONTHS.length - 1} value={timeIdx}
              onChange={(e) => setTimeIdx(Number(e.target.value))}
              style={{ position: "absolute", inset: "-6px 0", opacity: 0, cursor: "pointer", width: "100%", margin: 0 }}
            />
          </div>
        </div>

        {/* Date display */}
        <span style={{ fontSize: 10, color: "#6B9FFF", fontWeight: 700, letterSpacing: "0.06em", minWidth: 72, textAlign: "right", fontVariantNumeric: "tabular-nums", fontFamily: HF }}>
          {TIMELINE_DATES[timeIdx]}
        </span>
      </div>

      {/* ── Animations ────────────────────────────────────────────────── */}
      <style>{`
        .live-dot { animation: livepulse 2s ease-in-out infinite; }
        @keyframes livepulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.85); } }
        .maplibregl-ctrl-bottom-right { bottom: 56px !important; }
        .maplibregl-ctrl-top-right { top: 46px !important; }
        .maplibregl-ctrl button { background-color: rgba(6,10,28,0.88) !important; border-color: rgba(255,255,255,0.1) !important; }
        .maplibregl-ctrl button .maplibregl-ctrl-icon { filter: invert(0.7) !important; }
      `}</style>
    </section>
  );
}

// ── Design tokens ────────────────────────────────────────────────────────────
const HF = "Helvetica Neue, Helvetica, Arial, sans-serif";
const BG = "rgba(6, 10, 28, 0.93)";
const BORDER = "rgba(255,255,255,0.08)";

// ── Shared style objects ─────────────────────────────────────────────────────
const hud: React.CSSProperties = {
  position: "absolute", top: 0, left: 0, right: 0, zIndex: 30,
  background: "rgba(4, 7, 20, 0.94)",
  borderBottom: `1px solid ${BORDER}`,
  display: "flex", alignItems: "center", gap: 12, padding: "7px 14px",
};

const panel = (side: "left" | "right", top: number): React.CSSProperties => ({
  position: "absolute", [side]: 12, top,
  zIndex: 20, width: 196,
  background: BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  overflow: "hidden",
});

const timeline: React.CSSProperties = {
  position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30,
  background: "rgba(4, 7, 20, 0.94)",
  borderTop: `1px solid ${BORDER}`,
  padding: "9px 16px 11px",
  display: "flex", alignItems: "center", gap: 10,
};

const panelLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: "#3A5A80",
  letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: HF,
};

const groupBtn: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "6px 12px", background: "transparent", border: "none",
  cursor: "pointer", fontFamily: HF,
};

const tBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 24, height: 24, borderRadius: 5, flexShrink: 0,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
  color: "#5A7BAA", cursor: "pointer",
};

// ── Inline SVG icons (no lucide-react dependency for this dark-chrome context) ─
function Divider() {
  return <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />;
}
function HudButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        display: "flex", alignItems: "center",
        background: active ? "rgba(11,61,145,0.5)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "rgba(107,159,255,0.35)" : "rgba(255,255,255,0.09)"}`,
        borderRadius: 5, padding: "4px 9px", cursor: "pointer",
        color: active ? "#6B9FFF" : "#5A7BAA",
      }}
    >
      {children}
    </button>
  );
}
function LayerIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function ExpandIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>;
}
function CollapseIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>;
}
function CloseIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function PlayIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function PauseIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
}
function SkipBackIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5"/></svg>;
}
function SkipFwdIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>;
}
