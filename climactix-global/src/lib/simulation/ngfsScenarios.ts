import type { ScenarioConfig, ScenarioId } from '@/types/simulation';

/**
 * NGFS Phase IV scenario calibration (2023 release).
 *
 * Net Zero 2050  → 1.5°C  → aggressive early-transition, high carbon prices, lower physical risk
 * Delayed Trans  → 2.0°C  → slow start then sharp policy shock, moderate physical risk
 * Current Policies → 3°C+ → business-as-usual, minimal transition, severe physical risk
 *
 * Carbon prices sourced from NGFS Scenario Explorer (REMIND-MAgPIE model, 50th percentile).
 */
export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  '1.5': {
    id: '1.5',
    label: 'Net Zero 2050',
    shortLabel: '1.5°C',
    description: 'Aggressive decarbonisation. Net zero by 2050. High carbon prices, low physical damage.',
    tempRise: 1.5,
    carbonPrice2030: 130,
    carbonPrice2050: 800,
    physicalMultiplier2030: 0.55,
    physicalMultiplier2050: 0.72,
    transitionMultiplier2030: 1.45,
    transitionMultiplier2050: 1.85,
    color: '#10B981',
    bgClass: 'bg-emerald-500',
  },
  '2.0': {
    id: '2.0',
    label: 'Delayed Transition',
    shortLabel: '2°C',
    description: 'Moderate action with late-policy implementation. Paris-aligned but behind schedule.',
    tempRise: 2.0,
    carbonPrice2030: 40,
    carbonPrice2050: 300,
    physicalMultiplier2030: 0.78,
    physicalMultiplier2050: 1.1,
    transitionMultiplier2030: 0.88,
    transitionMultiplier2050: 1.38,
    color: '#F59E0B',
    bgClass: 'bg-amber-500',
  },
  '3.0': {
    id: '3.0',
    label: 'Current Policies',
    shortLabel: '3°C+',
    description: 'Business as usual. Insufficient mitigation. Severe physical damage by 2050.',
    tempRise: 3.0,
    carbonPrice2030: 28,
    carbonPrice2050: 65,
    physicalMultiplier2030: 0.95,
    physicalMultiplier2050: 1.82,
    transitionMultiplier2030: 0.48,
    transitionMultiplier2050: 0.58,
    color: '#EF4444',
    bgClass: 'bg-red-500',
  },
};

/**
 * Regional carbon price multipliers relative to global average.
 * Reflects current carbon-pricing regimes and NGFS forward projections.
 * EU: EU-ETS + CBAM  |  USA: IRA + state policies  |  China: national ETS
 */
export const REGIONAL_CARBON_MULT: Record<string, number> = {
  EU: 1.55,
  UK: 1.32,
  USA: 0.82,
  Canada: 0.92,
  Australia: 0.68,
  Japan: 0.72,
  SouthKorea: 0.62,
  China: 0.48,
  India: 0.20,
  Brazil: 0.14,
  LatAm: 0.12,
  Russia: 0.05,
  MENA: 0.08,
  Africa: 0.06,
  SEA: 0.16,
  Oceania: 0.60,
  Global: 1.00,
};

/** Map lat/lng to a broad region for carbon pricing. */
export function getRegionId(lat: number, lng: number): string {
  // EU
  if (lng >= -10 && lng <= 40 && lat >= 35 && lat <= 72) return 'EU';
  // UK
  if (lng >= -9 && lng <= 2 && lat >= 49 && lat <= 61) return 'UK';
  // USA
  if (lng >= -130 && lng <= -60 && lat >= 24 && lat <= 50) return 'USA';
  // Canada
  if (lng >= -140 && lng <= -50 && lat >= 50 && lat <= 75) return 'Canada';
  // Japan
  if (lng >= 129 && lng <= 146 && lat >= 30 && lat <= 45) return 'Japan';
  // South Korea
  if (lng >= 125 && lng <= 130 && lat >= 33 && lat <= 40) return 'SouthKorea';
  // China
  if (lng >= 75 && lng <= 135 && lat >= 18 && lat <= 54) return 'China';
  // India
  if (lng >= 68 && lng <= 97 && lat >= 8 && lat <= 36) return 'India';
  // Australia / NZ
  if (lng >= 112 && lng <= 180 && lat >= -50 && lat <= -10) return 'Australia';
  // Brazil
  if (lng >= -74 && lng <= -34 && lat >= -34 && lat <= 5) return 'Brazil';
  // LatAm (rest)
  if (lng >= -120 && lng <= -34 && lat >= -56 && lat <= 24) return 'LatAm';
  // Russia + Central Asia
  if (lng >= 28 && lng <= 190 && lat >= 50 && lat <= 78) return 'Russia';
  // MENA
  if (lng >= 25 && lng <= 65 && lat >= 12 && lat <= 42) return 'MENA';
  // Sub-Saharan Africa
  if (lat >= -36 && lat <= 37 && lng >= -18 && lng <= 52) return 'Africa';
  // SEA
  if (lng >= 92 && lng <= 145 && lat >= -12 && lat <= 28) return 'SEA';

  return 'Global';
}

/** Interpolate a value linearly from 2024 → 2030 → 2050. */
export function interpYear(
  year: number,
  val2024: number,
  val2030: number,
  val2050: number
): number {
  if (year <= 2024) return val2024;
  if (year >= 2050) return val2050;
  if (year <= 2030) {
    const t = (year - 2024) / 6;
    return val2024 + (val2030 - val2024) * t;
  }
  const t = (year - 2030) / 20;
  return val2030 + (val2050 - val2030) * t;
}
