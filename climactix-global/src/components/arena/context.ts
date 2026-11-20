"use client";

import { createContext, useContext } from "react";
import type { ArenaEngine } from "./engine/ArenaEngine";
import type { CameraMode } from "./store";
import type { ArenaDataset, facilityEmissions, useWeather } from "./useArenaData";
import type { EmissionEntity, SimResult } from "@/lib/arena/emissions";

export interface ArenaCtx {
  engine: ArenaEngine | null;
  requestCamera: (m: CameraMode) => void;
  data: ArenaDataset & { loading: boolean };
  entities: EmissionEntity[];
  entity: EmissionEntity | undefined;
  sim: SimResult | null;
  facilityCo2: ReturnType<typeof facilityEmissions>;
  weather: ReturnType<typeof useWeather>;
}

export const ArenaContext = createContext<ArenaCtx | null>(null);

export function useArenaCtx(): ArenaCtx {
  const c = useContext(ArenaContext);
  if (!c) throw new Error("useArenaCtx outside ArenaApp");
  return c;
}

/** Exposure bands use the status palette: real risk encoding only. */
export const EXPOSURE_COLOR: Record<string, string> = { Low: "#1E8E3E", Moderate: "#B98A1E", High: "#D2691E", "Very high": "#DC2626" };
