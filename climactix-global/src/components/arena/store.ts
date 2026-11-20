"use client";

import { create } from "zustand";
import type { ScenarioId } from "@/lib/arena/science";
import type { ObsCategory } from "@/lib/arena/constellation";
import { DEFAULT_LEVERS, type Levers } from "@/lib/arena/emissions";
import { LAYERS } from "@/lib/arena/layers";

export type ModuleId = "earth" | "observation" | "city" | "carbon" | "futures" | "twin" | "simulator";
export type CameraMode = "orbit" | "satfollow" | "satview" | "satellite" | "high" | "flight" | "street" | "free" | "intel";
export type Quality = "auto" | "high" | "balanced" | "low";
export type BuildingView = "standard" | "provenance";
export type InventoryMetric = "fossil-co2" | "co2-per-capita" | "Electricity/Heat" | "Transportation" | "Manufacturing/Construction" | "Agriculture";

export type Selection =
  | { type: "country"; iso3: string; name: string }
  | { type: "plant"; id: string }
  | { type: "facility"; name: string }
  | { type: "place"; id: string }
  | { type: "airport"; code: string }
  | { type: "port"; name: string }
  | { type: "satellite"; id: string }
  | null;

export const MODULES: { id: ModuleId; label: string; hint: string }[] = [
  { id: "earth", label: "Earth", hint: "Orbit, select countries and descend to cities" },
  { id: "observation", label: "Satellite Observation", hint: "CEON constellation, observation layers and mission control" },
  { id: "city", label: "City Arena", hint: "Mumbai digital twin" },
  { id: "carbon", label: "Carbon Intelligence", hint: "Concentration, inventory and point sources, kept separate" },
  { id: "futures", label: "Climate Futures", hint: "1.5 / 2 / 3 °C — IPCC AR6 warming levels over time" },
  { id: "twin", label: "Industrial Twin", hint: "Facilities, exposure and financial consequences" },
  { id: "simulator", label: "Scenario Simulator", hint: "Baseline versus decarbonisation pathway" },
];

export const OBS_CATEGORIES: ObsCategory[] = ["carbon", "thermal", "air", "vegetation", "water", "flood"];

/** Default product per observation category. */
export const OBS_DEFAULT: Record<ObsCategory, string> = {
  carbon: "xco2", thermal: "lst-monthly", air: "no2", vegetation: "ndvi-monthly", water: "soil-moisture", flood: "flood-hazard",
};

/** Layers switched on when a module is entered (user can change them afterwards). */
export const MODULE_LAYERS: Record<ModuleId, string[]> = {
  earth: [],
  observation: ["ceon"],
  city: ["city-facilities", "city-water"],
  carbon: ["co2-countries", "co2-plants"],
  futures: ["city-facilities"],
  twin: ["plants-all", "ports", "airports", "city-facilities"],
  simulator: ["co2-plants"],
};

export interface EngineStatus {
  phase: "idle" | "loading-engine" | "ready" | "error";
  message: string;
  tilesLoading: number;
  fps: number;
  resolutionScale: number;
  imagery: string;
  terrain: string;
  buildings: string;
  error?: string;
}

export interface Compare { id: string; date: string }

interface ArenaState {
  module: ModuleId;
  camera: CameraMode;
  layers: Record<string, boolean>;
  layerTimes: Record<string, string>;     // date GIBS actually served (primary)
  layerDates: Record<string, string>;     // date requested by the user ("" = latest)
  obsProduct: Record<ObsCategory, string>;
  compare: Compare | null;
  compareTime: string | null;             // date GIBS actually served (compare)
  split: number;                          // 0..1 swipe position
  selection: Selection;
  point: { lon: number; lat: number } | null;
  mission: string;
  timeScale: number;
  inCity: boolean;
  scenario: ScenarioId;
  year: number;
  entityId: string;
  levers: Levers;
  hour: number | null;
  quality: Quality;
  buildingView: BuildingView;
  inventoryMetric: InventoryMetric;
  panelOpen: boolean;
  sourcesOpen: boolean;
  flightLabel: string | null;
  status: EngineStatus;

  setModule: (m: ModuleId) => void;
  setCamera: (c: CameraMode) => void;
  toggleLayer: (id: string, on?: boolean) => void;
  setObsProduct: (cat: ObsCategory, id: string) => void;
  toggleObs: (cat: ObsCategory, on?: boolean) => void;
  setLayerTime: (id: string, t: string) => void;
  setLayerDate: (id: string, d: string) => void;
  setCompare: (c: Compare | null) => void;
  setCompareTime: (t: string | null) => void;
  setSplit: (v: number) => void;
  select: (s: Selection) => void;
  setPoint: (p: { lon: number; lat: number } | null) => void;
  setMission: (id: string) => void;
  setTimeScale: (v: number) => void;
  setInCity: (v: boolean) => void;
  setScenario: (s: ScenarioId) => void;
  setYear: (y: number) => void;
  setEntity: (id: string) => void;
  setLever: <K extends keyof Levers>(k: K, v: Levers[K]) => void;
  resetLevers: () => void;
  setHour: (h: number | null) => void;
  setQuality: (q: Quality) => void;
  setBuildingView: (v: BuildingView) => void;
  setInventoryMetric: (m: InventoryMetric) => void;
  setPanelOpen: (v: boolean) => void;
  setSourcesOpen: (v: boolean) => void;
  setFlightLabel: (l: string | null) => void;
  setStatus: (s: Partial<EngineStatus>) => void;
}

const catOf = (id: string) => {
  const l = LAYERS.find((x) => x.id === id);
  return l && l.kind === "gibs" ? l.obs : undefined;
};

export const useArena = create<ArenaState>((set) => ({
  module: "earth",
  camera: "orbit",
  layers: { "city-facilities": true, ceon: true },
  layerTimes: {},
  layerDates: {},
  obsProduct: { ...OBS_DEFAULT },
  compare: null,
  compareTime: null,
  split: 0.5,
  selection: null,
  point: null,
  mission: "ceon-01",
  timeScale: 1,
  inCity: false,
  scenario: "1.5",
  year: 2050,
  entityId: "city:mumbai",
  levers: { ...DEFAULT_LEVERS },
  hour: null,
  quality: "auto",
  buildingView: "standard",
  inventoryMetric: "fossil-co2",
  panelOpen: true,
  sourcesOpen: false,
  flightLabel: null,
  status: { phase: "idle", message: "", tilesLoading: 0, fps: 0, resolutionScale: 1, imagery: "", terrain: "", buildings: "" },

  setModule: (module) => set((s) => {
    const layers = { ...s.layers };
    for (const id of MODULE_LAYERS[module]) layers[id] = true;
    return { module, layers };
  }),
  setCamera: (camera) => set({ camera }),
  toggleLayer: (id, on) => set((s) => {
    const next = on ?? !s.layers[id];
    const layers = { ...s.layers, [id]: next };
    // one product per observation category is visible at a time
    const cat = catOf(id);
    if (next && cat) {
      for (const l of LAYERS) if (l.kind === "gibs" && l.obs === cat && l.id !== id) layers[l.id] = false;
      return { layers, obsProduct: { ...s.obsProduct, [cat]: id }, compare: s.compare && catOf(s.compare.id) === cat && s.compare.id !== id ? null : s.compare };
    }
    return { layers, compare: !next && s.compare?.id === id ? null : s.compare };
  }),
  setObsProduct: (cat, id) => set((s) => {
    const wasOn = LAYERS.some((l) => l.kind === "gibs" && l.obs === cat && s.layers[l.id]);
    const layers = { ...s.layers };
    for (const l of LAYERS) if (l.kind === "gibs" && l.obs === cat) layers[l.id] = wasOn && l.id === id;
    return { obsProduct: { ...s.obsProduct, [cat]: id }, layers, compare: s.compare && catOf(s.compare.id) === cat ? null : s.compare };
  }),
  toggleObs: (cat, on) => set((s) => {
    const id = s.obsProduct[cat];
    const cur = !!s.layers[id];
    const next = on ?? !cur;
    const layers = { ...s.layers };
    for (const l of LAYERS) if (l.kind === "gibs" && l.obs === cat) layers[l.id] = next && l.id === id;
    return { layers, compare: !next && s.compare && catOf(s.compare.id) === cat ? null : s.compare };
  }),
  setLayerTime: (id, t) => set((s) => ({ layerTimes: { ...s.layerTimes, [id]: t } })),
  setLayerDate: (id, d) => set((s) => ({ layerDates: { ...s.layerDates, [id]: d } })),
  setCompare: (compare) => set({ compare, compareTime: null }),
  setCompareTime: (compareTime) => set({ compareTime }),
  setSplit: (split) => set({ split: Math.max(0.05, Math.min(0.95, split)) }),
  select: (selection) => set((s) => ({ selection, mission: selection?.type === "satellite" ? selection.id : s.mission })),
  setPoint: (point) => set({ point }),
  setMission: (mission) => set({ mission }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setInCity: (inCity) => set({ inCity }),
  setScenario: (scenario) => set({ scenario }),
  setYear: (year) => set({ year }),
  setEntity: (entityId) => set({ entityId }),
  setLever: (k, v) => set((s) => ({ levers: { ...s.levers, [k]: v } })),
  resetLevers: () => set({ levers: { ...DEFAULT_LEVERS } }),
  setHour: (hour) => set({ hour }),
  setQuality: (quality) => set({ quality }),
  setBuildingView: (buildingView) => set({ buildingView }),
  setInventoryMetric: (inventoryMetric) => set({ inventoryMetric }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setSourcesOpen: (sourcesOpen) => set({ sourcesOpen }),
  setFlightLabel: (flightLabel) => set({ flightLabel }),
  setStatus: (p) => set((s) => ({ status: { ...s.status, ...p } })),
}));
