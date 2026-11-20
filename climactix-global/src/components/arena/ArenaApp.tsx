"use client";

import "./arena.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArenaContext, EXPOSURE_COLOR, type ArenaCtx } from "./context";
import { loadCesium } from "./engine/loader";
import { ArenaEngine, type EngineConfig } from "./engine/ArenaEngine";
import { useArena, type CameraMode, type ModuleId } from "./store";
import { facilityEmissions, useArenaDataset, useEntities, useWeather } from "./useArenaData";
import { LAYERS, gibsActualTime, gibsLayer } from "@/lib/arena/layers";
import { impactsAt } from "@/lib/arena/science";
import { simulate } from "@/lib/arena/emissions";
import { placeById } from "@/lib/arena/places";
import { FACILITIES, MUMBAI_POINT, exposureIndex } from "@/lib/arena/mumbai";
import { BottomBar, FlightLabel, LeftDock, NoWebGL, SourcesModal, StatusBar, StreetHelp, SwipeDivider, TopBar } from "./Chrome";
import { RightColumn } from "./Panels";

function config(): EngineConfig {
  const imagery = (process.env.NEXT_PUBLIC_ARENA_IMAGERY ?? "auto") as EngineConfig["imagery"];
  // Development only: ?evalIon=1 uses CesiumJS's built-in evaluation token to preview terrain and
  // photorealistic tiles before a project token is configured. Never active in production builds.
  const evalIon = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("evalIon");
  return {
    ionToken: process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || (evalIon ? "__cesium_eval__" : undefined),
    googleKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined,
    imagery: ["auto", "ion", "esri", "gibs"].includes(imagery) ? imagery : "auto",
  };
}

function webglAvailable(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export default function ArenaApp() {
  const host = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<ArenaEngine | null>(null);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [noGL, setNoGL] = useState(false);
  const s = useArena();
  const data = useArenaDataset();
  const weather = useWeather(MUMBAI_POINT.lat, MUMBAI_POINT.lon, true);

  /* ── mount the engine once ─────────────────────────────────────────────── */
  useEffect(() => {
    if (window.innerWidth < 860) useArena.getState().setPanelOpen(false);
    if (!webglAvailable()) { setNoGL(true); return; }
    let dead = false;
    let eng: ArenaEngine | null = null;
    useArena.getState().setStatus({ phase: "loading-engine", message: "Loading 3D engine" });
    loadCesium()
      .then((C) => ArenaEngine.create(C, host.current!, credits.current!, config(), {
        onPick: (sel) => {
          const S = useArena.getState();
          if (sel && sel.type === "globe") {
            S.setPoint({ lon: sel.lon, lat: sel.lat });
            const c = eng?.global.countryAt(sel.lon, sel.lat);
            // in observation mode a click inspects the point; the country becomes the region context
            if (S.module === "observation") return;
            S.select(c ? { type: "country", iso3: c.iso3, name: c.name } : null);
          } else S.select(sel);
        },
        onHover: (label, x, y) => setHover(label ? { label, x, y } : null),
        onStatus: (p) => useArena.getState().setStatus(p),
        onFlightLabel: (l) => useArena.getState().setFlightLabel(l),
        onCityProximity: (v) => useArena.getState().setInCity(v),
      }))
      .then((e) => {
        if (dead) { e.destroy(); return; }
        eng = e;
        setEngine(e);
        if (process.env.NODE_ENV !== "production") (window as unknown as { __arena?: ArenaEngine }).__arena = e;
        useArena.getState().setStatus({ phase: "ready", message: "" });
      })
      .catch((err) => useArena.getState().setStatus({ phase: "error", error: String(err?.message ?? err) }));
    return () => { dead = true; eng?.destroy(); };
  }, []);

  const requestCamera = useCallback((m: CameraMode) => {
    useArena.getState().setCamera(m);
    engine?.setCameraMode(m);
  }, [engine]);

  /* ── layers (with requested observation dates) ────────────────────────── */
  const applied = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!engine) return;
    for (const def of LAYERS) {
      const on = !!s.layers[def.id];
      const date = s.layerDates[def.id] || "default";
      const key = `${on}|${def.kind === "gibs" ? date : ""}`;
      if (applied.current[def.id] === key) continue;
      applied.current[def.id] = key;
      engine.setLayer(def.id, on, date);
      if (on && def.kind === "gibs") {
        gibsActualTime(def, date).then((t) => t && useArena.getState().setLayerTime(def.id, t));
      }
    }
  }, [engine, s.layers, s.layerDates]);

  useEffect(() => {
    if (!engine) return;
    engine.setCompare(s.compare?.id ?? null, s.compare?.date ?? null);
    const def = s.compare ? gibsLayer(s.compare.id) : undefined;
    if (def && s.compare) gibsActualTime(def, s.compare.date).then((t) => useArena.getState().setCompareTime(t));
  }, [engine, s.compare]);
  useEffect(() => { engine?.setSplit(s.split); }, [engine, s.split]);
  useEffect(() => { engine?.selectMission(s.mission); }, [engine, s.mission]);
  useEffect(() => { engine?.setTimeScale(s.timeScale); }, [engine, s.timeScale]);
  useEffect(() => { engine?.global.setMetric(s.inventoryMetric); }, [engine, s.inventoryMetric]);

  /* ── module → camera context ──────────────────────────────────────────── */
  const lastModule = useRef<ModuleId | null>(null);
  useEffect(() => {
    if (!engine || lastModule.current === s.module) return;
    const first = lastModule.current === null;
    lastModule.current = s.module;
    if (first && s.module === "earth") return;
    if (s.module === "earth" || s.module === "observation") requestCamera("orbit");
    else if (s.module === "city") requestCamera("high");
    else if (s.module === "futures" || s.module === "twin") requestCamera("intel");
  }, [engine, s.module, requestCamera]);

  /* ── selection → fly ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!engine) return;
    const sel = s.selection;
    engine.setAutoRotate(!sel && s.module !== "observation");
    if (!sel) { engine.highlightCountry(null); return; }
    if (sel.type === "satellite") return; // mission control handles satellite cameras
    if (sel.type === "country") {
      engine.highlightCountry(sel.iso3);
      const sh = engine.global.shapes.find((x) => x.iso3 === sel.iso3);
      if (sh) {
        const span = Math.max(sh.bbox[2] - sh.bbox[0], sh.bbox[3] - sh.bbox[1]);
        engine.flyTo(sh.lon, sh.lat, Math.max(500_000, Math.min(9_000_000, span * 111_000 * 1.9)));
      }
      return;
    }
    engine.highlightCountry(null);
    if (sel.type === "plant") {
      const p = engine.global.plantById(sel.id) ?? data.plants.find((x) => x.id === sel.id);
      if (p) engine.flyTo(p.lon, p.lat, 9_000, { pitch: -32 });
    } else if (sel.type === "facility") {
      const a = engine.city.anchor(sel.name);
      if (a) engine.flyTo(a.lon, a.lat, 3_200, { pitch: -38, heading: 330 });
    } else if (sel.type === "place") {
      const p = placeById(sel.id);
      if (p) engine.flyTo(p.lon, p.lat, p.range, { pitch: p.kind === "city" || p.kind === "cluster" ? -42 : undefined });
    } else if (sel.type === "airport" || sel.type === "port") {
      const pt = engine.global.pointFor(sel);
      if (pt) engine.flyTo(pt.lon, pt.lat, 12_000, { pitch: -40 });
    }
  }, [engine, s.selection, data.plants]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── scenario-driven facility exposure styling ────────────────────────── */
  const imp = useMemo(() => impactsAt(s.scenario, s.year), [s.scenario, s.year]);
  useEffect(() => {
    if (!engine) return;
    engine.city.setView(s.buildingView);
    if (s.module === "futures" || s.module === "twin") {
      const styles: Record<string, { color: string }> = {};
      for (const f of FACILITIES) styles[f.name] = { color: EXPOSURE_COLOR[exposureIndex(f, imp).band] };
      engine.city.setFacilityStyles(styles);
    } else engine.city.setFacilityStyles(null);
  }, [engine, imp, s.buildingView, s.module]);

  const facilityCo2 = useMemo(() => facilityEmissions(data.plants), [data.plants]);

  /* ── simulator ────────────────────────────────────────────────────────── */
  const industryIso = s.selection?.type === "country" ? s.selection.iso3 : "IND";
  const entities = useEntities(data.countries, data.plants, industryIso);
  const entity = entities.find((e) => e.id === s.entityId);
  const sim = useMemo(() => (entity ? simulate(entity, s.levers) : null), [entity, s.levers]);
  useEffect(() => {
    if (!engine) return;
    const active = s.module === "simulator" && entity && sim;
    const y = Math.min(2050, Math.max(entity?.baseYear ?? 2024, s.year));
    const pt = active ? sim!.path.find((p) => p.year === y) ?? sim!.path[sim!.path.length - 1] : null;
    engine.global.setPlantOverride(active && entity!.kind === "plant" ? entity!.id.slice(6) : null, pt ? pt.scenario : null);
    engine.global.setCountryOverride(active && entity!.kind === "country" ? entity!.id.slice(8) : null, pt ? pt.scenario : null);
    const ramp = entity ? Math.min(1, Math.max(0, (y - entity.baseYear) / (2050 - entity.baseYear))) : 0;
    engine.city.setSolar(active ? (s.levers.renewables / 100) * ramp * 0.35 : 0);
    engine.city.setEvShare(active ? (s.levers.ev / 100) * ramp : 0);
  }, [engine, s.module, entity, sim, s.year, s.levers]);

  const entityId = entity?.id;
  useEffect(() => {
    if (!engine || s.module !== "simulator" || !entity) return;
    if (entity.kind === "country") {
      const sh = engine.global.shapes.find((x) => `country:${x.iso3}` === entity.id);
      if (!sh) return;
      useArena.getState().setInventoryMetric("fossil-co2");
      useArena.getState().toggleLayer("co2-countries", true);
      const span = Math.max(sh.bbox[2] - sh.bbox[0], sh.bbox[3] - sh.bbox[1]);
      engine.flyTo(sh.lon, sh.lat, Math.max(1_500_000, Math.min(9_000_000, span * 111_000 * 2.2)), { pitch: -50 });
      return;
    }
    if (!entity.location) return;
    const near = entity.kind === "plant" ? 9_000 : entity.kind === "city" ? 30_000 : 14_000;
    engine.flyTo(entity.location.lon, entity.location.lat, near, { pitch: -35 });
  }, [engine, s.module, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── view settings ────────────────────────────────────────────────────── */
  useEffect(() => { engine?.setHour(s.hour); }, [engine, s.hour]);
  useEffect(() => { engine?.setQuality(s.quality); }, [engine, s.quality]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const S = useArena.getState();
      if (S.sourcesOpen) { S.setSourcesOpen(false); return; }
      if (S.camera === "street" || S.camera === "free" || S.camera === "flight") requestCamera("high");
      else if (S.camera === "satfollow" || S.camera === "satview") requestCamera("orbit");
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [requestCamera]);

  const ctx: ArenaCtx = { engine, requestCamera, data, entities, entity, sim, facilityCo2, weather };

  return (
    <ArenaContext.Provider value={ctx}>
      <div className="ax" data-module={s.module}>
        <div ref={host} className="ax-canvas" aria-label="3D Earth and city environment" />
        {noGL && <NoWebGL />}
        {s.compare && <SwipeDivider />}
        <TopBar />
        <LeftDock />
        <RightColumn />
        <BottomBar />
        <StatusBar creditsRef={credits} />
        {s.flightLabel && <FlightLabel label={s.flightLabel} />}
        {(s.camera === "street" || s.camera === "free") && <StreetHelp mode={s.camera} />}
        {hover && <div className="ax-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>{hover.label}</div>}
        {s.sourcesOpen && <SourcesModal />}
      </div>
    </ArenaContext.Provider>
  );
}
