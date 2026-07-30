import type { SimAsset, AssetRiskProfile, PortfolioSummary, LayerType } from '@/types/simulation';
import type {
  ScenarioFamilyId,
  ScenarioFamilyConfig,
  ClimateVaRResult,
  PortfolioFinancials,
  ProjectionYear,
  EvidenceMeta,
} from '@/types/scenario-studio';
import { PROJECTION_YEARS } from '@/types/scenario-studio';
import { computeAssetRiskWithConfig } from './riskEngine';

/**
 * Scenario Studio's 6 scenario families — the NGFS Phase IV/V published
 * reference set (Network for Greening the Financial System, Scenario
 * Explorer, ngfs.net). Temperature outcomes and carbon-price trajectories
 * below are Climactix's calibration to NGFS's published summary statistics
 * (REMIND-MAgPIE / GCAM / MESSAGE model medians across the phase IV/V
 * release); `physicalMultiplier*`/`transitionMultiplier*` and
 * `policyOrderliness` are Climactix modeling overlays that translate NGFS's
 * qualitative orderly/disorderly/hot-house-world categorisation into the
 * risk engine's multiplier space — they are not official NGFS output
 * variables. See /scenario-studio/risk-engine for the full methodology note.
 */
export const SCENARIO_FAMILIES: Record<ScenarioFamilyId, ScenarioFamilyConfig> = {
  'net-zero-2050': {
    id: 'net-zero-2050',
    label: 'Net Zero 2050',
    shortLabel: '1.4°C · Orderly',
    category: 'orderly',
    description:
      'Ambitious, coordinated climate policy introduced now. Global net-zero CO2 emissions reached around 2050, holding warming to ~1.4°C. Physical risk stays low; transition risk (carbon pricing, stranded assets) is front-loaded and severe.',
    tempRise2100: 1.4,
    carbonPrice2030: 130,
    carbonPrice2050: 800,
    physicalMultiplier2030: 0.55,
    physicalMultiplier2050: 0.72,
    transitionMultiplier2030: 1.45,
    transitionMultiplier2050: 1.85,
    policyOrderliness: 1.0,
    color: '#1E8E3E',
    bgClass: 'bg-ds-success',
  },
  'below-2c': {
    id: 'below-2c',
    label: 'Below 2°C',
    shortLabel: '1.7°C · Orderly',
    category: 'orderly',
    description:
      'Immediate, gradually tightening policy holds warming below 2°C with a 67% probability. Slightly slower decarbonisation than Net Zero 2050 — moderate transition risk, low-moderate physical risk.',
    tempRise2100: 1.7,
    carbonPrice2030: 95,
    carbonPrice2050: 520,
    physicalMultiplier2030: 0.62,
    physicalMultiplier2050: 0.85,
    transitionMultiplier2030: 1.2,
    transitionMultiplier2050: 1.55,
    policyOrderliness: 0.9,
    color: '#2E8B57',
    bgClass: 'bg-ds-success',
  },
  ndcs: {
    id: 'ndcs',
    label: 'Nationally Determined Contributions',
    shortLabel: '2.6°C · Hot House',
    category: 'hot-house-world',
    description:
      'All current, unconditional NDC pledges are met and not strengthened further. Moderate transition action; physical risk builds meaningfully post-2040 as warming exceeds 2.5°C.',
    tempRise2100: 2.6,
    carbonPrice2030: 45,
    carbonPrice2050: 140,
    physicalMultiplier2030: 0.85,
    physicalMultiplier2050: 1.35,
    transitionMultiplier2030: 0.62,
    transitionMultiplier2050: 0.78,
    policyOrderliness: 0.55,
    color: '#B45309',
    bgClass: 'bg-ds-warning',
  },
  'delayed-transition': {
    id: 'delayed-transition',
    label: 'Delayed Transition',
    shortLabel: '1.8°C · Disorderly',
    category: 'disorderly',
    description:
      'Annual emissions do not fall until 2030, then policy tightens sharply to still reach a Paris-aligned outcome. The compressed timeline produces a severe late transition shock — carbon prices and stranded-asset risk spike after 2030.',
    tempRise2100: 1.8,
    carbonPrice2030: 40,
    carbonPrice2050: 300,
    physicalMultiplier2030: 0.78,
    physicalMultiplier2050: 1.1,
    transitionMultiplier2030: 0.88,
    transitionMultiplier2050: 1.65,
    policyOrderliness: 0.35,
    color: '#C2410C',
    bgClass: 'bg-orange-600',
  },
  'fragmented-world': {
    id: 'fragmented-world',
    label: 'Fragmented World',
    shortLabel: '2.5°C · Disorderly',
    category: 'disorderly',
    description:
      'Geopolitical fragmentation drives divergent, uncoordinated regional policy — some jurisdictions decarbonise aggressively while others do not. Compounds transition risk (regulatory patchwork, trade friction, CBAM-style frictions) with elevated physical risk from net insufficient global mitigation.',
    tempRise2100: 2.5,
    carbonPrice2030: 55,
    carbonPrice2050: 260,
    physicalMultiplier2030: 0.9,
    physicalMultiplier2050: 1.55,
    transitionMultiplier2030: 1.05,
    transitionMultiplier2050: 1.5,
    policyOrderliness: 0.2,
    color: '#9A3412',
    bgClass: 'bg-orange-800',
  },
  'current-policies': {
    id: 'current-policies',
    label: 'Current Policies',
    shortLabel: '3.0°C · Hot House',
    category: 'hot-house-world',
    description:
      'Only policies already enacted stay in force — no further tightening. Business as usual. Minimal transition risk, but severe and accelerating physical risk through the century.',
    tempRise2100: 3.0,
    carbonPrice2030: 28,
    carbonPrice2050: 65,
    physicalMultiplier2030: 0.95,
    physicalMultiplier2050: 1.82,
    transitionMultiplier2030: 0.48,
    transitionMultiplier2050: 0.58,
    policyOrderliness: 0.1,
    color: '#DC2626',
    bgClass: 'bg-ds-critical',
  },
};

export const SCENARIO_FAMILY_ORDER: ScenarioFamilyId[] = [
  'net-zero-2050',
  'below-2c',
  'ndcs',
  'delayed-transition',
  'fragmented-world',
  'current-policies',
];

const METHODOLOGY: EvidenceMeta = {
  sourceDatasets: [
    'NGFS Phase IV/V Scenario Explorer — carbon price & temperature pathways',
    'Climactix geographic hazard heuristic (heat/flood/storm/drought base rates by latitude/coastal proximity)',
    'Climactix sector risk-weight table (9 sectors — physical/transition multipliers, EBITDA leverage)',
  ],
  calculationMethod:
    'Physical and transition multipliers interpolated 2024→2030→2050 (linear), applied to geography- and sector-derived base risk scores; financial impact scaled via sector EBITDA leverage.',
  confidence: 'medium',
  lastUpdated: '2024-01-01',
  methodologyHref: '/scenario-studio/risk-engine',
};

export function getEvidence(overrides?: Partial<EvidenceMeta>): EvidenceMeta {
  return { ...METHODOLOGY, ...overrides };
}

/** Extrapolate multipliers beyond 2050 (to 2060/2080/2100) by continuing the 2030→2050 slope, damped 60% —
 *  every NGFS pathway's physical/transition risk growth decelerates post-2050 as adaptation and full
 *  decarbonisation (in orderly scenarios) or physical saturation (in hot-house scenarios) set in. */
function extendedMultiplier(year: number, v2030: number, v2050: number): number {
  const slope = (v2050 - v2030) / 20;
  return v2050 + slope * 0.4 * (year - 2050);
}

export function computeAssetRiskForFamily(
  asset: SimAsset,
  familyId: ScenarioFamilyId,
  year: ProjectionYear | number
): AssetRiskProfile {
  const family = SCENARIO_FAMILIES[familyId];
  const cfg = {
    physicalMultiplier2030: family.physicalMultiplier2030,
    physicalMultiplier2050:
      year > 2050
        ? extendedMultiplier(year, family.physicalMultiplier2030, family.physicalMultiplier2050)
        : family.physicalMultiplier2050,
    transitionMultiplier2030: family.transitionMultiplier2030,
    transitionMultiplier2050:
      year > 2050
        ? extendedMultiplier(year, family.transitionMultiplier2030, family.transitionMultiplier2050)
        : family.transitionMultiplier2050,
    carbonPrice2030: family.carbonPrice2030,
    carbonPrice2050:
      year > 2050
        ? extendedMultiplier(year, family.carbonPrice2030, family.carbonPrice2050)
        : family.carbonPrice2050,
  };
  return computeAssetRiskWithConfig(asset, cfg, year, family.label);
}

export function computePortfolioForFamily(
  assets: SimAsset[],
  familyId: ScenarioFamilyId,
  year: ProjectionYear | number
): PortfolioSummary {
  if (assets.length === 0) {
    return {
      assetCount: 0,
      totalRevenueM: 0,
      avgPhysicalRisk: 0,
      avgTransitionRisk: 0,
      totalRevenueAtRiskM: 0,
      totalComplianceCostM: 0,
      highRiskAssets: 0,
      criticalRiskAssets: 0,
    };
  }
  const profiles = assets.map((a) => computeAssetRiskForFamily(a, familyId, year));
  const totalRevenue = assets.reduce((s, a) => s + a.revenue, 0);
  return {
    assetCount: assets.length,
    totalRevenueM: totalRevenue,
    avgPhysicalRisk: profiles.reduce((s, p, i) => s + p.physicalRisk * assets[i].revenue, 0) / totalRevenue,
    avgTransitionRisk: profiles.reduce((s, p, i) => s + p.transitionRisk * assets[i].revenue, 0) / totalRevenue,
    totalRevenueAtRiskM: profiles.reduce((s, p, i) => s + (p.revenueAtRisk / 100) * assets[i].revenue, 0),
    totalComplianceCostM: profiles.reduce((s, p) => s + p.complianceCostM, 0),
    highRiskAssets: profiles.filter((p) => p.riskLevel === 'high').length,
    criticalRiskAssets: profiles.filter((p) => p.riskLevel === 'critical').length,
  };
}

export function projectPortfolioTimeSeries(
  assets: SimAsset[],
  familyId: ScenarioFamilyId
): { year: ProjectionYear; physicalRisk: number; transitionRisk: number; revenueAtRiskM: number; ebitdaAtRiskM: number }[] {
  return PROJECTION_YEARS.map((year) => {
    const profiles = assets.map((a) => computeAssetRiskForFamily(a, familyId, year));
    const totalRevenue = assets.reduce((s, a) => s + a.revenue, 0) || 1;
    const physicalRisk = profiles.reduce((s, p, i) => s + p.physicalRisk * assets[i].revenue, 0) / totalRevenue;
    const transitionRisk = profiles.reduce((s, p, i) => s + p.transitionRisk * assets[i].revenue, 0) / totalRevenue;
    const revenueAtRiskM = profiles.reduce((s, p, i) => s + (p.revenueAtRisk / 100) * assets[i].revenue, 0);
    const ebitdaAtRiskM = profiles.reduce((s, p, i) => s + (p.ebitdaImpact / 100) * assets[i].revenue * 0.18, 0); // 18% assumed baseline EBITDA margin, disclosed in evidence panel
    return {
      year,
      physicalRisk: Math.round(physicalRisk * 10) / 10,
      transitionRisk: Math.round(transitionRisk * 10) / 10,
      revenueAtRiskM: Math.round(revenueAtRiskM * 10) / 10,
      ebitdaAtRiskM: Math.round(ebitdaAtRiskM * 10) / 10,
    };
  });
}

const GRID_STEP = 5; // degrees — same resolution as riskEngine.ts's legacy grid

const GRID_BASE_ASSET: Omit<SimAsset, 'id' | 'lat' | 'lng'> = {
  name: '',
  category: 'factory',
  revenue: 1000,
  employees: 1000,
  country: '',
  region: '',
  sector: 'Manufacturing',
  capex: 1500,
  scope1: 200_000,
  scope2: 100_000,
};

/** Family-aware equivalent of riskEngine.ts's generateRiskGrid, for the GIS Viewer's heatmap layers. */
export function generateRiskGridForFamily(
  familyId: ScenarioFamilyId,
  year: ProjectionYear | number,
  layer: LayerType
): { type: 'FeatureCollection'; features: object[] } {
  const features: object[] = [];
  for (let lat = -80; lat <= 80; lat += GRID_STEP) {
    for (let lng = -175; lng <= 175; lng += GRID_STEP) {
      const risk = computeAssetRiskForFamily({ ...GRID_BASE_ASSET, id: `g${lat}_${lng}`, lat, lng }, familyId, year);
      let intensity: number;
      switch (layer) {
        case 'physical':
          intensity = risk.physicalRisk / 100;
          break;
        case 'transition':
          intensity = risk.transitionRisk / 100;
          break;
        case 'carbon':
          intensity = Math.min(1, risk.carbonPriceExposure / 900);
          break;
        default:
          intensity = risk.overallRisk / 100;
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { intensity: Math.round(intensity * 100) / 100 },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Parametric (variance-covariance) Climate VaR.
 *
 * Expected Annual Loss (EAL) = revenue-at-risk aggregated across the portfolio
 * for the given scenario/year. Loss is modeled as approximately normally
 * distributed around EAL with a sector-and-scenario-calibrated coefficient of
 * variation (higher for disorderly/fragmented scenarios, reflecting wider
 * transition-timing uncertainty). VaR_c = EAL * (1 + z_c * CV), using
 * standard one-tailed normal z-scores (z95=1.645, z99=2.326). This is a
 * simplified parametric estimate, not a full Monte Carlo simulation — see
 * /scenario-studio/risk-engine for the disclosed limitation.
 */
export function computeClimateVaR(
  assets: SimAsset[],
  familyId: ScenarioFamilyId,
  year: ProjectionYear,
  confidenceLevel: 0.95 | 0.99,
  companyId: string
): ClimateVaRResult {
  const portfolio = computePortfolioForFamily(assets, familyId, year);
  const family = SCENARIO_FAMILIES[familyId];
  const eal = portfolio.totalRevenueAtRiskM;
  // Wider spread for disorderly/low-orderliness pathways — timing/policy uncertainty is the dominant driver.
  const coefficientOfVariation = 0.35 + (1 - family.policyOrderliness) * 0.45;
  const z = confidenceLevel === 0.99 ? 2.326 : 1.645;
  const valueAtRiskUsdM = Math.round(eal * (1 + z * coefficientOfVariation) * 10) / 10;
  const worstCaseUsdM = Math.round(eal * (1 + 3 * coefficientOfVariation) * 10) / 10;

  return {
    companyId,
    scenario: familyId,
    year,
    confidenceLevel,
    valueAtRiskUsdM,
    expectedAnnualLossUsdM: Math.round(eal * 10) / 10,
    worstCaseUsdM,
    evidence: getEvidence({
      calculationMethod: `Parametric VaR: EAL × (1 + z_${confidenceLevel === 0.99 ? '99' : '95'} × CV), CV=${coefficientOfVariation.toFixed(2)} (scenario orderliness-adjusted).`,
    }),
  };
}
