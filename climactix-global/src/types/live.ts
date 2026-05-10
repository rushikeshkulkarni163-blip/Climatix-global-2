export interface LiveClimateMetric {
  id: string;
  label: string;
  value: string;
  numericValue: number;
  unit: string;
  direction: "up" | "down" | "stable";
  category: "physical" | "carbon" | "economic" | "biodiversity";
  source: string;
  updatedAt: string;
  delta?: string;
  deltaDirection?: "up" | "down";
}

export interface TickerItem {
  id: string;
  label: string;
  value: string;
  dir: "up" | "down" | "stable";
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  source?: string;
  timestamp?: string;
}

export interface ClimateAlert {
  id: string;
  type: "wildfire" | "flood" | "cyclone" | "drought" | "heatwave" | "emissions_spike";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  region: string;
  country?: string;
  lat?: number;
  lng?: number;
  description: string;
  timestamp: string;
  source: string;
  active: boolean;
}

export interface LiveMapLayer {
  id: string;
  name: string;
  type: "temperature" | "co2" | "sea_level" | "arctic_ice" | "wildfire" | "flood" | "aqi" | "wind";
  active: boolean;
  opacity: number;
  dataUrl?: string;
  lastUpdated?: string;
  legend?: { value: number; color: string; label: string }[];
}

export interface StreamEvent {
  type: "metric_update" | "alert" | "ticker_update" | "layer_update";
  payload: LiveClimateMetric | ClimateAlert | TickerItem | LiveMapLayer;
  timestamp: string;
}

export interface LiveDashboardState {
  co2ppm: number;
  globalTempAnomaly: number;
  arcticSeaIceLoss: number;
  seaLevelRiseMm: number;
  extremeWeatherIndex: number;
  carbonBudgetGt: number;
  renewableSharePct: number;
  climateFinanceGapT: number;
  activeWildfires: number;
  activeFloodAlerts: number;
  activeCyclones: number;
  aqiGlobalAvg: number;
  updatedAt: string;
}

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "ping" | "pong" | "data" | "alert" | "error";
  channel?: string;
  payload?: unknown;
  timestamp: string;
}

export interface ContentBlock {
  id: string;
  type: "insight" | "case_study" | "ticker_item" | "alert" | "report";
  title: string;
  body: string;
  category: string;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
