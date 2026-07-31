import type { ScenarioCategory } from '@/types/scenario-studio';

/**
 * NGFS Phase V / Kotz et al. (2024) chronic physical damage-function overlay.
 *
 * Reference: Kotz, Kuik, Levermann & Wenz (2024), "The economic commitment
 * of climate change," Nature 628, 551-557 — the damage function NGFS adopted
 * for Phase V, replacing the Kalkuhl & Wenz (2020) function used through
 * Phase III/IV. Calibrated on the DOSE database (83 countries, 1,660
 * sub-national regions, 1960-2019) against 5 climate variables — average
 * annual temperature, daily temperature variability, total precipitation,
 * wet-day count, and extreme daily rainfall — rather than mean temperature
 * alone, with effects that persist up to 10 years after a climate shock
 * (10 lags for temperature terms, 4 for precipitation terms). NGFS reports
 * materially higher median loss estimates under this function than the
 * prior one — e.g. Current Policies median GDP loss ~5%→~15% by 2050 (and
 * ~30% by 2100); Net Zero 2050 ~2%→~7% by 2050 — and now uses the median
 * (50th percentile) estimate by default rather than the high-damage (95th
 * percentile) convention used since Phase III, because the new function is
 * already comprehensive enough not to need that extra margin.
 *
 * Climactix does not have per-asset grid climate variables (temperature
 * variability, wet days, extreme rainfall), so this module does not
 * replicate the underlying panel regression. It recalibrates the
 * scenario-level physical-severity curve in scenarioFamilies.ts /
 * ngfsScenarios.ts to the published Phase V reference points, and encodes
 * the function's two most decision-relevant properties for a risk-multiplier
 * model: (1) higher severity than the prior calibration, and (2) persistence
 * — damage does not resolve the moment warming stabilizes, so post-2050
 * behaviour differs by scenario orderliness rather than uniformly
 * decelerating. See /scenario-studio/risk-engine for full disclosure.
 *
 * NGFS guidance (explicitly disclosed here, not modeled as an offset):
 * chronic damage-function output and acute NatCat hazard models (drought,
 * heatwave, flood, cyclone) should NOT simply be summed — the new function's
 * variables (temperature variability, extreme rainfall) may already
 * partially capture acute-hazard effects. Climactix's heat/flood/storm/
 * drought sub-scores are a geographic hazard heuristic, not a NatCat model,
 * so this risk is reduced but not eliminated; treat overall physical risk
 * as directional, not additive across independently-sourced hazard models.
 */

// Category-differentiated 2050 uplift applied once to each scenario's legacy
// physicalMultiplier2050 to reflect Kotz et al.'s higher median loss
// estimates relative to the prior damage function. A literal 3x transplant
// of the published GDP-loss ratios would saturate nearly every asset to
// maximum risk regardless of scenario — destroying the differentiation this
// metric exists to convey inside Climactix's internal 0-100 risk-multiplier
// scale (which is a risk score, not a literal %GDP figure). This uplift is
// intentionally more conservative than the raw published ratio while
// preserving the same ordering (hot-house-world > disorderly > orderly).
export const DAMAGE_FUNCTION_2050_UPLIFT: Record<ScenarioCategory, number> = {
  orderly: 1.18,
  disorderly: 1.28,
  'hot-house-world': 1.35,
};

// Post-2050 continuation shape, replacing a prior "decelerate everywhere"
// assumption. Kotz et al.'s persistence effect means damage does not
// resolve the moment warming stabilizes — it keeps compounding while
// warming continues, and only slowly attenuates once it stops.
//   - orderly:          warming plateaus post-2050 → growth slows sharply,
//                        bounded by the committed-damage floor below.
//   - disorderly:       partial continued warming in laggard jurisdictions
//                        → moderate continued growth.
//   - hot-house-world:  warming keeps rising through 2100 → continued
//                        growth at the same slope, no damping.
export const POST_2050_SLOPE_DAMPING: Record<ScenarioCategory, number> = {
  orderly: 0.25,
  disorderly: 0.7,
  'hot-house-world': 1.0,
};

// Committed/locked-in damage floor: post-2050, the physical multiplier never
// falls below this fraction of its 2050 value, in any scenario — Kotz et
// al.'s central finding is that a meaningful share of climate damage is
// already committed and does not reverse even under aggressive mitigation.
export const COMMITTED_DAMAGE_FLOOR = 0.85;

/** Apply the Phase V / Kotz et al. uplift to a legacy (pre-Phase V)
 *  physicalMultiplier2050 value. */
export function recalibratedPhysicalMultiplier2050(
  legacyMultiplier2050: number,
  category: ScenarioCategory
): number {
  return Math.round(legacyMultiplier2050 * DAMAGE_FUNCTION_2050_UPLIFT[category] * 100) / 100;
}

/** Post-2050 physical-multiplier continuation under the Kotz et al. (2024) /
 *  NGFS Phase V persistence model — replaces flat, uniform-deceleration
 *  extrapolation with a category-aware shape plus a committed-damage floor. */
export function extendedPhysicalMultiplier(
  year: number,
  m2030: number,
  m2050: number,
  category: ScenarioCategory
): number {
  const slope = (m2050 - m2030) / 20;
  const damping = POST_2050_SLOPE_DAMPING[category];
  const raw = m2050 + slope * damping * (year - 2050);
  const floor = m2050 * COMMITTED_DAMAGE_FLOOR;
  return Math.max(raw, floor);
}
