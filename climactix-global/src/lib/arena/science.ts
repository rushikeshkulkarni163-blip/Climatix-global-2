/**
 * Climate science reference layer for the Climate Arena.
 *
 * Every number in this file is transcribed from a named IPCC AR6 table or figure.
 * Values between the published warming levels are linearly interpolated and are
 * flagged `interpolated: true` wherever they are shown. Nothing here is a
 * Climactix projection; Climactix only combines these published values.
 */

export type ScenarioId = "baseline" | "1.5" | "2" | "3";
export type Provenance = "observed" | "projection" | "interpolated" | "estimate" | "illustrative" | "demo";

export interface Cite {
  short: string;
  full: string;
  url: string;
}

export const CITE: Record<string, Cite> = {
  spm6: {
    short: "IPCC AR6 WGI SPM, Fig. SPM.6",
    full: "IPCC (2021) Summary for Policymakers, Climate Change 2021: The Physical Science Basis, Figure SPM.6 — projected changes in the intensity and frequency of hot temperature extremes, heavy precipitation and agricultural and ecological droughts over land (median values).",
    url: "https://www.ipcc.ch/report/ar6/wg1/figures/summary-for-policymakers/figure-spm-6/",
  },
  spm1: {
    short: "IPCC AR6 WGI SPM, Table SPM.1",
    full: "IPCC (2021) Summary for Policymakers, Table SPM.1 — changes in global surface temperature for selected 20-year periods relative to 1850–1900 (best estimate and very likely range).",
    url: "https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/",
  },
  slr: {
    short: "IPCC AR6 WGI, Ch. 9 / Table 9.9",
    full: "IPCC (2021) Chapter 9, Ocean, Cryosphere and Sea Level Change — projected global mean sea-level rise relative to 1995–2014, medians and likely ranges (processes in which there is medium confidence).",
    url: "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-9/",
  },
  obs: {
    short: "IPCC AR6 WGI SPM, A.1.2",
    full: "IPCC (2021) SPM A.1.2 — global surface temperature was 1.09 [0.95–1.20] °C higher in 2011–2020 than 1850–1900.",
    url: "https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/",
  },
};

/* ── Figure SPM.6: changes at global warming levels (global land, median) ───────── */

export interface ExtremePoint { gwl: number; freq: number; intensity: number }
export interface ExtremeSeries {
  id: "hot10" | "hot50" | "rain10" | "drought10";
  label: string;
  intensityUnit: string;
  description: string;
  points: ExtremePoint[];
}

// Pre-industrial (gwl 0) is the reference: frequency 1×, intensity change 0.
export const EXTREMES: ExtremeSeries[] = [
  {
    id: "hot10", label: "10-year hot temperature extreme", intensityUnit: "°C",
    description: "Hottest daily maximum temperature that occurred once in 10 years on average in 1850–1900.",
    points: [{ gwl: 0, freq: 1, intensity: 0 }, { gwl: 1, freq: 2.8, intensity: 1.2 }, { gwl: 1.5, freq: 4.1, intensity: 1.9 }, { gwl: 2, freq: 5.6, intensity: 2.6 }, { gwl: 4, freq: 9.4, intensity: 5.1 }],
  },
  {
    id: "hot50", label: "50-year hot temperature extreme", intensityUnit: "°C",
    description: "Hottest daily maximum temperature that occurred once in 50 years on average in 1850–1900.",
    points: [{ gwl: 0, freq: 1, intensity: 0 }, { gwl: 1, freq: 4.8, intensity: 1.2 }, { gwl: 1.5, freq: 8.6, intensity: 2.0 }, { gwl: 2, freq: 13.9, intensity: 2.7 }, { gwl: 4, freq: 39.2, intensity: 5.3 }],
  },
  {
    id: "rain10", label: "10-year heavy 1-day precipitation", intensityUnit: "%",
    description: "Heaviest 1-day precipitation that occurred once in 10 years on average in 1850–1900.",
    points: [{ gwl: 0, freq: 1, intensity: 0 }, { gwl: 1, freq: 1.3, intensity: 6.7 }, { gwl: 1.5, freq: 1.5, intensity: 10.5 }, { gwl: 2, freq: 1.7, intensity: 14.0 }, { gwl: 4, freq: 2.7, intensity: 30.2 }],
  },
  {
    id: "drought10", label: "10-year agricultural & ecological drought", intensityUnit: "s.d.",
    description: "Drought that occurred once in 10 years on average in 1850–1900, in drying regions. Intensity is the change in soil moisture in standard deviations.",
    points: [{ gwl: 0, freq: 1, intensity: 0 }, { gwl: 1, freq: 1.7, intensity: 0.3 }, { gwl: 1.5, freq: 2.0, intensity: 0.5 }, { gwl: 2, freq: 2.4, intensity: 0.6 }, { gwl: 4, freq: 4.1, intensity: 1.0 }],
  },
];

const PUBLISHED_GWL = [0, 1, 1.5, 2, 4];

export interface ExtremeAt { freq: number; intensity: number; interpolated: boolean }

export function extremeAt(series: ExtremeSeries, gwl: number): ExtremeAt {
  const p = series.points;
  const g = Math.max(0, Math.min(gwl, 4));
  for (let i = 0; i < p.length - 1; i++) {
    if (g >= p[i].gwl && g <= p[i + 1].gwl) {
      const t = (g - p[i].gwl) / (p[i + 1].gwl - p[i].gwl);
      return {
        freq: p[i].freq + t * (p[i + 1].freq - p[i].freq),
        intensity: p[i].intensity + t * (p[i + 1].intensity - p[i].intensity),
        interpolated: !PUBLISHED_GWL.some((x) => Math.abs(x - g) < 1e-6),
      };
    }
  }
  const last = p[p.length - 1];
  return { freq: last.freq, intensity: last.intensity, interpolated: false };
}

export function extreme(id: ExtremeSeries["id"]): ExtremeSeries {
  const s = EXTREMES.find((e) => e.id === id);
  if (!s) throw new Error(`unknown extreme ${id}`);
  return s;
}

/* ── Table SPM.1: GSAT by SSP and period (°C above 1850–1900) ─────────────────── */

export type Ssp = "SSP1-1.9" | "SSP1-2.6" | "SSP2-4.5" | "SSP3-7.0" | "SSP5-8.5";
interface Range { best: number; lo: number; hi: number }

export const GSAT: Record<Ssp, { near: Range; mid: Range; long: Range }> = {
  "SSP1-1.9": { near: { best: 1.5, lo: 1.2, hi: 1.7 }, mid: { best: 1.6, lo: 1.2, hi: 2.0 }, long: { best: 1.4, lo: 1.0, hi: 1.8 } },
  "SSP1-2.6": { near: { best: 1.5, lo: 1.2, hi: 1.8 }, mid: { best: 1.7, lo: 1.3, hi: 2.2 }, long: { best: 1.8, lo: 1.3, hi: 2.4 } },
  "SSP2-4.5": { near: { best: 1.5, lo: 1.2, hi: 1.8 }, mid: { best: 2.0, lo: 1.6, hi: 2.5 }, long: { best: 2.7, lo: 2.1, hi: 3.5 } },
  "SSP3-7.0": { near: { best: 1.5, lo: 1.2, hi: 1.8 }, mid: { best: 2.1, lo: 1.7, hi: 2.6 }, long: { best: 3.6, lo: 2.8, hi: 4.6 } },
  "SSP5-8.5": { near: { best: 1.6, lo: 1.3, hi: 1.9 }, mid: { best: 2.4, lo: 1.9, hi: 3.0 }, long: { best: 4.4, lo: 3.3, hi: 5.7 } },
};

/** Observed 2011–2020 warming (SPM A.1.2), anchored at the period midpoint. */
export const OBSERVED_2011_2020 = { year: 2015.5, best: 1.09, lo: 0.95, hi: 1.2 };

/* ── Global mean sea-level rise, m relative to 1995–2014 (median, likely range) ── */
export const GMSL: Record<Ssp, { y2050: Range; y2100: Range }> = {
  "SSP1-1.9": { y2050: { best: 0.18, lo: 0.15, hi: 0.23 }, y2100: { best: 0.38, lo: 0.28, hi: 0.55 } },
  "SSP1-2.6": { y2050: { best: 0.19, lo: 0.16, hi: 0.25 }, y2100: { best: 0.44, lo: 0.32, hi: 0.62 } },
  "SSP2-4.5": { y2050: { best: 0.20, lo: 0.17, hi: 0.26 }, y2100: { best: 0.56, lo: 0.44, hi: 0.76 } },
  "SSP3-7.0": { y2050: { best: 0.22, lo: 0.18, hi: 0.27 }, y2100: { best: 0.68, lo: 0.55, hi: 0.90 } },
  "SSP5-8.5": { y2050: { best: 0.23, lo: 0.20, hi: 0.29 }, y2100: { best: 0.77, lo: 0.63, hi: 1.01 } },
};

/* ── Scenarios presented in the Arena ─────────────────────────────────────────── */

export interface Scenario {
  id: ScenarioId;
  label: string;
  short: string;
  ssp: Ssp | null;
  description: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "baseline", label: "Present-day baseline", short: "Baseline", ssp: null,
    description: "Climate held at the observed 2011–2020 level (1.09 °C above 1850–1900). Used as the reference for comparison; not a forecast." },
  { id: "1.5", label: "1.5 °C warming", short: "1.5 °C", ssp: "SSP1-1.9",
    description: "Very low emissions pathway (SSP1-1.9): warming peaks near 1.6 °C mid-century and returns to about 1.4 °C by 2081–2100." },
  { id: "2", label: "2 °C warming", short: "2 °C", ssp: "SSP1-2.6",
    description: "Low emissions pathway (SSP1-2.6): about 1.7 °C by 2041–2060 and 1.8 °C by 2081–2100." },
  { id: "3", label: "3 °C warming", short: "3 °C", ssp: "SSP2-4.5",
    description: "Intermediate emissions pathway (SSP2-4.5), the closest AR6 illustrative pathway to 3 °C: about 2.7 °C by 2081–2100." },
];

export const TIMELINE_YEARS = [2026, 2030, 2040, 2050, 2100] as const;

export function scenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export interface WarmingAt { gwl: number; lo: number; hi: number; basis: string; interpolated: boolean }

/**
 * Global warming level reached in a given year under a scenario.
 * Anchors: observed 2011–2020 (2015.5), and Table SPM.1 period means placed at
 * their midpoints (2030.5, 2050.5, 2090.5). 2100 uses the 2081–2100 mean.
 * Between anchors the value is linearly interpolated.
 */
export function warmingAt(id: ScenarioId, year: number): WarmingAt {
  const s = scenario(id);
  if (!s.ssp) {
    return { gwl: OBSERVED_2011_2020.best, lo: OBSERVED_2011_2020.lo, hi: OBSERVED_2011_2020.hi,
      basis: "Observed 2011–2020 mean (IPCC AR6 SPM A.1.2), held constant", interpolated: false };
  }
  const t = GSAT[s.ssp];
  const anchors: [number, Range][] = [
    [OBSERVED_2011_2020.year, OBSERVED_2011_2020],
    [2030.5, t.near], [2050.5, t.mid], [2090.5, t.long], [2100, t.long],
  ];
  const y = Math.max(anchors[0][0], Math.min(year, 2100));
  for (let i = 0; i < anchors.length - 1; i++) {
    const [y0, a] = anchors[i];
    const [y1, b] = anchors[i + 1];
    if (y >= y0 && y <= y1) {
      const f = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      const exact = Math.abs(y - y0) < 0.6 || Math.abs(y - y1) < 0.6;
      return {
        gwl: a.best + f * (b.best - a.best), lo: a.lo + f * (b.lo - a.lo), hi: a.hi + f * (b.hi - a.hi),
        basis: `${s.ssp}, IPCC AR6 Table SPM.1${exact ? "" : " (interpolated between period means)"}`,
        interpolated: !exact,
      };
    }
  }
  return { gwl: t.long.best, lo: t.long.lo, hi: t.long.hi, basis: `${s.ssp}, Table SPM.1`, interpolated: false };
}

export interface SeaLevelAt { m: number; lo: number; hi: number; basis: string }

/** GMSL rise relative to 1995–2014 (0 at 2004.5), interpolated between 2050 and 2100 medians. */
export function seaLevelAt(id: ScenarioId, year: number): SeaLevelAt {
  const s = scenario(id);
  if (!s.ssp) return { m: 0, lo: 0, hi: 0, basis: "Present-day reference (1995–2014 = 0)" };
  const g = GMSL[s.ssp];
  const y = Math.max(2004.5, Math.min(year, 2100));
  const lerp = (a: number, b: number, f: number) => a + f * (b - a);
  if (y <= 2050) {
    const f = (y - 2004.5) / (2050 - 2004.5);
    return { m: lerp(0, g.y2050.best, f), lo: lerp(0, g.y2050.lo, f), hi: lerp(0, g.y2050.hi, f),
      basis: `${s.ssp} median${y === 2050 ? "" : ", interpolated from 1995–2014 to 2050"}` };
  }
  const f = (y - 2050) / 50;
  return { m: lerp(g.y2050.best, g.y2100.best, f), lo: lerp(g.y2050.lo, g.y2100.lo, f), hi: lerp(g.y2050.hi, g.y2100.hi, f),
    basis: `${s.ssp} median${y === 2100 ? "" : ", interpolated between 2050 and 2100"}` };
}

/** Warming of the 1981–2010 period used as the ERA5 local baseline (approx., from AR6 assessed GSAT). */
export const ERA5_BASELINE_GWL = 0.6;

export interface ScenarioImpacts {
  year: number;
  scenario: Scenario;
  warming: WarmingAt;
  seaLevel: SeaLevelAt;
  hot10: ExtremeAt;
  hot50: ExtremeAt;
  rain10: ExtremeAt;
  drought10: ExtremeAt;
}

export function impactsAt(id: ScenarioId, year: number): ScenarioImpacts {
  const w = warmingAt(id, year);
  return {
    year, scenario: scenario(id), warming: w, seaLevel: seaLevelAt(id, year),
    hot10: extremeAt(extreme("hot10"), w.gwl), hot50: extremeAt(extreme("hot50"), w.gwl),
    rain10: extremeAt(extreme("rain10"), w.gwl), drought10: extremeAt(extreme("drought10"), w.gwl),
  };
}

/**
 * Change relative to the local ERA5 1981–2010 baseline rather than 1850–1900.
 * Global-land median applied to a local baseline — first-order only; regional
 * amplification (e.g. coastal moderation in Mumbai) is not modelled.
 */
export function deltaFromEra5Baseline(id: ExtremeSeries["id"], gwl: number) {
  const s = extreme(id);
  const now = extremeAt(s, gwl);
  const base = extremeAt(s, ERA5_BASELINE_GWL);
  return {
    intensity: now.intensity - base.intensity,
    freqRatio: now.freq / base.freq,
  };
}
