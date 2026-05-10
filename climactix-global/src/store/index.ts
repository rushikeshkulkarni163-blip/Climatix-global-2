"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  LiveClimateMetric,
  TickerItem,
  ClimateAlert,
  LiveMapLayer,
  LiveDashboardState,
} from "@/types/live";
import type { User, AuthState } from "@/types/auth";

// ── Climate Metrics Store ─────────────────────────────────────────────────────

interface ClimateStore {
  metrics: LiveClimateMetric[];
  dashboard: LiveDashboardState;
  isStreamConnected: boolean;
  lastUpdated: string | null;
  setMetrics: (metrics: LiveClimateMetric[]) => void;
  updateMetric: (id: string, updates: Partial<LiveClimateMetric>) => void;
  setDashboard: (data: Partial<LiveDashboardState>) => void;
  setStreamConnected: (connected: boolean) => void;
}

export const useClimateStore = create<ClimateStore>()(
  subscribeWithSelector((set) => ({
    metrics: [],
    dashboard: {
      co2ppm: 424.7,
      globalTempAnomaly: 1.48,
      arcticSeaIceLoss: -13,
      seaLevelRiseMm: 3.7,
      extremeWeatherIndex: 5.2,
      carbonBudgetGt: 380,
      renewableSharePct: 30.3,
      climateFinanceGapT: 4.3,
      activeWildfires: 847,
      activeFloodAlerts: 23,
      activeCyclones: 4,
      aqiGlobalAvg: 64,
      updatedAt: new Date().toISOString(),
    },
    isStreamConnected: false,
    lastUpdated: null,
    setMetrics: (metrics) => set({ metrics, lastUpdated: new Date().toISOString() }),
    updateMetric: (id, updates) =>
      set((state) => ({
        metrics: state.metrics.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        lastUpdated: new Date().toISOString(),
      })),
    setDashboard: (data) =>
      set((state) => ({
        dashboard: { ...state.dashboard, ...data, updatedAt: new Date().toISOString() },
      })),
    setStreamConnected: (connected) => set({ isStreamConnected: connected }),
  }))
);

// ── Ticker Store ──────────────────────────────────────────────────────────────

interface TickerStore {
  items: TickerItem[];
  isPaused: boolean;
  speed: "slow" | "normal" | "fast";
  setItems: (items: TickerItem[]) => void;
  prependItem: (item: TickerItem) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: "slow" | "normal" | "fast") => void;
}

export const useTickerStore = create<TickerStore>()((set) => ({
  items: [],
  isPaused: false,
  speed: "normal",
  setItems: (items) => set({ items }),
  prependItem: (item) =>
    set((state) => ({
      items: [item, ...state.items].slice(0, 50),
    })),
  setPaused: (paused) => set({ isPaused: paused }),
  setSpeed: (speed) => set({ speed }),
}));

// ── Alert Store ───────────────────────────────────────────────────────────────

interface AlertStore {
  alerts: ClimateAlert[];
  dismissedIds: Set<string>;
  setAlerts: (alerts: ClimateAlert[]) => void;
  addAlert: (alert: ClimateAlert) => void;
  dismissAlert: (id: string) => void;
  clearExpired: () => void;
}

export const useAlertStore = create<AlertStore>()((set) => ({
  alerts: [],
  dismissedIds: new Set(),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 20),
    })),
  dismissAlert: (id) =>
    set((state) => ({
      dismissedIds: new Set(Array.from(state.dismissedIds).concat(id)),
    })),
  clearExpired: () =>
    set((state) => {
      const cutoff = Date.now() - 86400000;
      return {
        alerts: state.alerts.filter(
          (a: ClimateAlert) => new Date(a.timestamp).getTime() > cutoff
        ),
      };
    }),
}));

// ── Map Store ─────────────────────────────────────────────────────────────────

interface MapStore {
  layers: LiveMapLayer[];
  activeLayerId: string | null;
  viewState: { lat: number; lng: number; zoom: number };
  setLayers: (layers: LiveMapLayer[]) => void;
  toggleLayer: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setActiveLayer: (id: string | null) => void;
  setViewState: (vs: Partial<{ lat: number; lng: number; zoom: number }>) => void;
}

export const useMapStore = create<MapStore>()((set) => ({
  layers: [
    { id: "temperature", name: "Temperature Anomaly", type: "temperature", active: true, opacity: 0.7 },
    { id: "co2", name: "CO₂ Concentration", type: "co2", active: false, opacity: 0.8 },
    { id: "sea_level", name: "Sea Level Rise", type: "sea_level", active: false, opacity: 0.75 },
    { id: "arctic_ice", name: "Arctic Ice Coverage", type: "arctic_ice", active: false, opacity: 0.85 },
    { id: "wildfire", name: "Active Wildfires", type: "wildfire", active: false, opacity: 0.9 },
    { id: "aqi", name: "Air Quality Index", type: "aqi", active: false, opacity: 0.7 },
  ],
  activeLayerId: "temperature",
  viewState: { lat: 20, lng: 0, zoom: 1.5 },
  setLayers: (layers) => set({ layers }),
  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, active: !l.active } : l)),
    })),
  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
    })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setViewState: (vs) =>
    set((state) => ({ viewState: { ...state.viewState, ...vs } })),
}));

// ── Auth Store ────────────────────────────────────────────────────────────────

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    setUser: (user) =>
      set({ user, isAuthenticated: !!user }),
    setToken: (token) => set({ token }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    logout: () =>
      set({ user: null, token: null, isAuthenticated: false, error: null }),
  }))
);

// ── Simulation Store ──────────────────────────────────────────────────────────

interface SimulationStore {
  isRunning: boolean;
  scenario: "1.5" | "2.0" | "3.0" | "4.0";
  horizon: 2030 | 2040 | 2050;
  progress: number;
  results: Record<string, unknown> | null;
  setRunning: (running: boolean) => void;
  setScenario: (scenario: "1.5" | "2.0" | "3.0" | "4.0") => void;
  setHorizon: (horizon: 2030 | 2040 | 2050) => void;
  setProgress: (progress: number) => void;
  setResults: (results: Record<string, unknown> | null) => void;
}

export const useSimulationStore = create<SimulationStore>()((set) => ({
  isRunning: false,
  scenario: "2.0",
  horizon: 2050,
  progress: 0,
  results: null,
  setRunning: (isRunning) => set({ isRunning }),
  setScenario: (scenario) => set({ scenario }),
  setHorizon: (horizon) => set({ horizon }),
  setProgress: (progress) => set({ progress }),
  setResults: (results) => set({ results }),
}));

// ── Admin Content Store ───────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  type: "insight" | "case_study" | "ticker_item";
  data: Record<string, unknown>;
  published: boolean;
  updatedAt: string;
}

interface AdminStore {
  content: ContentItem[];
  isSaving: boolean;
  setContent: (content: ContentItem[]) => void;
  updateContent: (id: string, updates: Partial<ContentItem>) => void;
  addContent: (item: ContentItem) => void;
  removeContent: (id: string) => void;
  setSaving: (saving: boolean) => void;
}

export const useAdminStore = create<AdminStore>()((set) => ({
  content: [],
  isSaving: false,
  setContent: (content) => set({ content }),
  updateContent: (id, updates) =>
    set((state) => ({
      content: state.content.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  addContent: (item) =>
    set((state) => ({ content: [item, ...state.content] })),
  removeContent: (id) =>
    set((state) => ({ content: state.content.filter((c) => c.id !== id) })),
  setSaving: (isSaving) => set({ isSaving }),
}));
