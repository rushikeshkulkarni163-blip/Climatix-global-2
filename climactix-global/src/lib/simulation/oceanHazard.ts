/**
 * Ocean deoxygenation hazard — a physical-risk hazard type added alongside
 * heat/flood/storm/drought for coastal and marine-exposed assets (ports,
 * shipping-sector assets, and factories/farms on or near the coastline).
 *
 * Template dataset: India Exclusive Economic Zone (EEZ), Current Policies
 * pathway, marine dissolved-oxygen field relative to a pre-industrial
 * baseline, 2020-2300 in 5-year steps (source file:
 * impact-time_IND-eez_curpol-sap_marclim-oxygen_0.5_pre-industrial.csv).
 * Values below are the dataset's `marclim-oxygen_mean` column, expressed as
 * a positive percentage decline (the raw column is a negative fractional
 * deviation). At 2020 the India EEZ already shows ~10.9% relative dissolved-
 * oxygen decline vs. pre-industrial, deepening to ~21% by 2100 and ~24-26%
 * by 2150-2300 under Current Policies.
 *
 * Coverage caveat, surfaced wherever this hazard appears in the Evidence
 * panel: this curve is India-EEZ-specific. Climactix applies it as the best
 * available reference trajectory for ALL coastal/marine-exposed assets
 * globally, scaled by each scenario's own physical-severity multiplier
 * (the dataset itself represents a single, Current-Policies pathway) — this
 * is a disclosed extrapolation, not a location-specific marine model, for
 * any asset outside Indian waters. Ocean deoxygenation drives fisheries
 * collapse risk, aquaculture yield loss, and marine-cooled infrastructure
 * (ports, coastal power/desalination plants) efficiency loss; relative O2
 * declines in the 20-30% range are cited in marine biogeochemistry
 * literature as approaching regional hypoxia/ecosystem-collapse thresholds.
 */

export interface OxygenDeclinePoint {
  year: number;
  meanDeclinePct: number;
}

export const INDIA_EEZ_OXYGEN_DECLINE_CURPOL: OxygenDeclinePoint[] = [
  { year: 2020, meanDeclinePct: 10.89 },
  { year: 2025, meanDeclinePct: 11.24 },
  { year: 2030, meanDeclinePct: 12.15 },
  { year: 2035, meanDeclinePct: 12.69 },
  { year: 2040, meanDeclinePct: 13.23 },
  { year: 2045, meanDeclinePct: 13.89 },
  { year: 2050, meanDeclinePct: 14.79 },
  { year: 2055, meanDeclinePct: 15.64 },
  { year: 2060, meanDeclinePct: 16.26 },
  { year: 2065, meanDeclinePct: 16.98 },
  { year: 2070, meanDeclinePct: 17.55 },
  { year: 2075, meanDeclinePct: 17.99 },
  { year: 2080, meanDeclinePct: 18.73 },
  { year: 2085, meanDeclinePct: 19.28 },
  { year: 2090, meanDeclinePct: 20.16 },
  { year: 2095, meanDeclinePct: 20.71 },
  { year: 2100, meanDeclinePct: 21.06 },
  { year: 2150, meanDeclinePct: 24.38 },
  { year: 2200, meanDeclinePct: 25.69 },
  { year: 2300, meanDeclinePct: 24.81 },
];

/** Piecewise-linear interpolation over the reference curve; clamps to the
 *  first/last known point outside 2020-2300. */
export function oceanOxygenDeclinePct(year: number): number {
  const curve = INDIA_EEZ_OXYGEN_DECLINE_CURPOL;
  if (year <= curve[0].year) return curve[0].meanDeclinePct;
  const last = curve[curve.length - 1];
  if (year >= last.year) return last.meanDeclinePct;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return a.meanDeclinePct + t * (b.meanDeclinePct - a.meanDeclinePct);
    }
  }
  return last.meanDeclinePct;
}

/** Coastal proximity, port category, or shipping-sector exposure — the
 *  proxies Climactix uses to gate ocean-hazard applicability absent a
 *  dedicated marine-asset flag. */
export function isMarineExposed(
  asset: { category: string; sector: string },
  isCoastal: boolean
): boolean {
  return isCoastal || asset.category === 'port' || asset.sector === 'Shipping';
}

/**
 * 0-100 ocean deoxygenation risk score. Zero for non-marine-exposed assets.
 * Scales the India-EEZ reference decline by the caller's already-computed
 * scenario physical-severity multiplier (the same `physMult` used for heat/
 * flood/storm/drought), clamped to avoid runaway values at either extreme —
 * this keeps the ocean hazard consistent with, rather than independent of,
 * the scenario's overall physical severity.
 */
export function computeOceanRisk(marineExposed: boolean, year: number, physMult: number): number {
  if (!marineExposed) return 0;
  const declinePct = oceanOxygenDeclinePct(year);
  const scaled = declinePct * Math.max(0.3, Math.min(2.0, physMult));
  // 25% relative O2 decline ≈ regional hypoxia threshold per marine
  // biogeochemistry literature; used here as the 0-100 scaling anchor.
  return Math.min(100, (scaled / 25) * 100);
}
