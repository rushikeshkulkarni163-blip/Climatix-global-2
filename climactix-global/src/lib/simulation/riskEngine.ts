import type {
  SimAsset,
  AssetRiskProfile,
  ScenarioId,
  RiskLevel,
  LayerType,
  PortfolioSummary,
  TimeSeriesPoint,
} from '@/types/simulation';
import {
  SCENARIOS,
  REGIONAL_CARBON_MULT,
  getRegionId,
  interpYear,
} from './ngfsScenarios';

// ─── Physical risk base scores by geography ──────────────────────────────────

function basePhysical(lat: number, lng: number) {
  const a = Math.abs(lat);

  // Heat stress: peaks in tropics/subtropics
  const heat =
    a <= 15 ? 85
    : a <= 30 ? 72
    : a <= 45 ? 45
    : a <= 60 ? 22
    : 12;

  // Flood: coastal + tropical river basins
  const isCoastal =
    Math.min(Math.abs(lng + 180), Math.abs(lng - 180), Math.abs(lng)) < 15 ||
    // specific coastal hotspots: Bay of Bengal, Gulf of Mexico, SE Asia
    (lng >= 80 && lng <= 95 && lat >= 10 && lat <= 25) ||
    (lng >= -98 && lng <= -82 && lat >= 18 && lat <= 30) ||
    (lng >= 100 && lng <= 125 && lat >= 0 && lat <= 22);
  const flood =
    isCoastal ? (a <= 30 ? 78 : 55)
    : a <= 20 ? 62
    : a <= 40 ? 38
    : 20;

  // Storm / cyclone (tropical cyclone belt + mid-lat storms)
  const storm =
    (a >= 5 && a <= 20) ? 80        // prime cyclone belt
    : (a > 20 && a <= 35) ? 60      // hurricane zone
    : (a > 35 && a <= 60) ? 32      // mid-latitude storms
    : 12;

  // Drought: subtropical arid bands
  const drought =
    (a >= 15 && a <= 30) ? 72
    : (a > 30 && a <= 45) ? 48
    : (a > 45 && a <= 65) ? 25
    : 15;

  // Arctic permafrost thaw (unique physical risk at high latitudes)
  const permafrost = a >= 65 ? 65 : 0;

  return { heat, flood, storm, drought, permafrost };
}

// ─── Sector-specific risk weights ────────────────────────────────────────────

interface SectorWeights {
  physicalMult: number;
  transitionMult: number;
  carbonIntensityFactor: number; // relative to default tCO2/$M revenue
  ebitdaLeverage: number;        // amplifies revenue-at-risk → EBITDA impact
}

const SECTOR_WEIGHTS: Record<string, SectorWeights> = {
  Energy:       { physicalMult: 0.9, transitionMult: 1.6, carbonIntensityFactor: 2.2, ebitdaLeverage: 1.8 },
  Mining:       { physicalMult: 1.4, transitionMult: 1.5, carbonIntensityFactor: 1.9, ebitdaLeverage: 1.7 },
  Manufacturing:{ physicalMult: 1.2, transitionMult: 1.2, carbonIntensityFactor: 1.4, ebitdaLeverage: 1.5 },
  Agriculture:  { physicalMult: 1.9, transitionMult: 0.7, carbonIntensityFactor: 0.9, ebitdaLeverage: 2.2 },
  'Real Estate':{ physicalMult: 1.6, transitionMult: 1.1, carbonIntensityFactor: 0.7, ebitdaLeverage: 2.0 },
  Finance:      { physicalMult: 0.4, transitionMult: 1.4, carbonIntensityFactor: 0.2, ebitdaLeverage: 1.2 },
  Technology:   { physicalMult: 0.7, transitionMult: 0.9, carbonIntensityFactor: 0.5, ebitdaLeverage: 1.3 },
  Logistics:    { physicalMult: 1.1, transitionMult: 1.4, carbonIntensityFactor: 1.3, ebitdaLeverage: 1.6 },
  Shipping:     { physicalMult: 1.4, transitionMult: 1.7, carbonIntensityFactor: 1.6, ebitdaLeverage: 1.7 },
};

function sectorWeights(sector: string): SectorWeights {
  return SECTOR_WEIGHTS[sector] ?? { physicalMult: 1.0, transitionMult: 1.0, carbonIntensityFactor: 1.0, ebitdaLeverage: 1.5 };
}

// ─── Transition risk base by region ──────────────────────────────────────────

function baseTransitionByRegion(lat: number, lng: number): number {
  const r = getRegionId(lat, lng);
  const map: Record<string, number> = {
    EU: 78, UK: 72, USA: 55, Canada: 60, Japan: 52, SouthKorea: 46,
    China: 42, Australia: 36, India: 25, Brazil: 16, LatAm: 13,
    Russia: 8, MENA: 10, Africa: 7, SEA: 18, Oceania: 35, Global: 20,
  };
  return map[r] ?? 20;
}

// ─── Core computation ─────────────────────────────────────────────────────────

export function computeAssetRisk(
  asset: SimAsset,
  scenario: ScenarioId,
  year: number
): AssetRiskProfile {
  const cfg = SCENARIOS[scenario];
  const bp = basePhysical(asset.lat, asset.lng);
  const sw = sectorWeights(asset.sector);

  // Interpolated scenario multipliers
  const physMult = interpYear(year, 0.18, cfg.physicalMultiplier2030, cfg.physicalMultiplier2050);
  const transMult = interpYear(year, 0.28, cfg.transitionMultiplier2030, cfg.transitionMultiplier2050);
  const carbonPrice = interpYear(year, 28, cfg.carbonPrice2030, cfg.carbonPrice2050);

  // Physical sub-scores
  const heatStress  = Math.min(100, bp.heat   * physMult * sw.physicalMult);
  const floodRisk   = Math.min(100, bp.flood  * physMult * sw.physicalMult);
  const stormRisk   = Math.min(100, bp.storm  * physMult * sw.physicalMult);
  const droughtRisk = Math.min(100, (bp.drought + bp.permafrost * 0.3) * physMult * sw.physicalMult);

  const physicalRisk = Math.min(
    100,
    heatStress * 0.28 + floodRisk * 0.32 + stormRisk * 0.22 + droughtRisk * 0.18
  );

  // Transition sub-scores
  const regionId = getRegionId(asset.lat, asset.lng);
  const regionCarbonMult = REGIONAL_CARBON_MULT[regionId] ?? 1.0;
  const carbonPriceExposure = carbonPrice * regionCarbonMult;
  const baseTrans = baseTransitionByRegion(asset.lat, asset.lng);

  const policyRisk = Math.min(100, baseTrans * transMult * sw.transitionMult);
  const technologyRisk = Math.min(100, 28 * transMult * sw.transitionMult);
  const transitionRisk = Math.min(100, policyRisk * 0.62 + technologyRisk * 0.38);

  // Financial impact
  const physF = physicalRisk / 100;
  const transF = transitionRisk / 100;
  const revenueAtRisk = Math.min(48, (physF * 16 + transF * 13) * sw.physicalMult);
  const ebitdaImpact = Math.min(80, revenueAtRisk * sw.ebitdaLeverage);

  const totalEmissions = asset.scope1 + asset.scope2;
  const complianceCostM = (totalEmissions * carbonPriceExposure) / 1_000_000;

  const supplyChainRisk = Math.min(100, physicalRisk * 0.38 + transitionRisk * 0.28 + 18);
  const overallRisk = Math.min(100, physicalRisk * 0.44 + transitionRisk * 0.44 + supplyChainRisk * 0.12);

  let riskLevel: RiskLevel;
  if (overallRisk >= 68) riskLevel = 'critical';
  else if (overallRisk >= 46) riskLevel = 'high';
  else if (overallRisk >= 26) riskLevel = 'medium';
  else riskLevel = 'low';

  const strandedRisk =
    overallRisk >= 68 && (asset.sector === 'Energy' || asset.sector === 'Mining');

  return {
    assetId: asset.id,
    year,
    scenario,
    heatStress,
    floodRisk,
    stormRisk,
    droughtRisk,
    physicalRisk,
    carbonPriceExposure,
    policyRisk,
    technologyRisk,
    transitionRisk,
    revenueAtRisk,
    ebitdaImpact,
    complianceCostM,
    supplyChainRisk,
    strandedRisk,
    overallRisk,
    riskLevel,
  };
}

// ─── Portfolio aggregation ────────────────────────────────────────────────────

export function computePortfolio(
  assets: SimAsset[],
  scenario: ScenarioId,
  year: number
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

  const profiles = assets.map(a => computeAssetRisk(a, scenario, year));
  const totalRevenue = assets.reduce((s, a) => s + a.revenue, 0);

  const avgPhysicalRisk =
    profiles.reduce((s, p, i) => s + p.physicalRisk * assets[i].revenue, 0) / totalRevenue;
  const avgTransitionRisk =
    profiles.reduce((s, p, i) => s + p.transitionRisk * assets[i].revenue, 0) / totalRevenue;
  const totalRevenueAtRiskM =
    profiles.reduce((s, p, i) => s + (p.revenueAtRisk / 100) * assets[i].revenue, 0);
  const totalComplianceCostM = profiles.reduce((s, p) => s + p.complianceCostM, 0);

  return {
    assetCount: assets.length,
    totalRevenueM: totalRevenue,
    avgPhysicalRisk,
    avgTransitionRisk,
    totalRevenueAtRiskM,
    totalComplianceCostM,
    highRiskAssets: profiles.filter(p => p.riskLevel === 'high').length,
    criticalRiskAssets: profiles.filter(p => p.riskLevel === 'critical').length,
  };
}

// ─── Time-series projection for a single asset ───────────────────────────────

const PROJECTION_YEARS = [2024, 2027, 2030, 2033, 2036, 2040, 2045, 2050];

export function projectAssetTimeSeries(
  asset: SimAsset,
  scenario: ScenarioId
): TimeSeriesPoint[] {
  return PROJECTION_YEARS.map(year => {
    const r = computeAssetRisk(asset, scenario, year);
    return {
      year,
      physicalRisk: Math.round(r.physicalRisk * 10) / 10,
      transitionRisk: Math.round(r.transitionRisk * 10) / 10,
      revenueAtRisk: Math.round(r.revenueAtRisk * 10) / 10,
      complianceCostM: Math.round(r.complianceCostM * 10) / 10,
    };
  });
}

// ─── Heatmap grid data for MapLibre ──────────────────────────────────────────

const GRID_STEP = 5; // degrees

const MOCK_ASSET_BASE: Omit<SimAsset, 'id' | 'lat' | 'lng'> = {
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

export function generateRiskGrid(
  scenario: ScenarioId,
  year: number,
  layer: LayerType
): { type: 'FeatureCollection'; features: object[] } {
  const features: object[] = [];

  for (let lat = -80; lat <= 80; lat += GRID_STEP) {
    for (let lng = -175; lng <= 175; lng += GRID_STEP) {
      const risk = computeAssetRisk(
        { ...MOCK_ASSET_BASE, id: `g${lat}_${lng}`, lat, lng },
        scenario,
        year
      );

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

// ─── Asset GeoJSON for MapLibre circle layer ─────────────────────────────────

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return '#EF4444';
    case 'high':     return '#F97316';
    case 'medium':   return '#F59E0B';
    case 'low':      return '#10B981';
  }
}

export function buildAssetGeoJSON(
  assets: SimAsset[],
  scenario: ScenarioId,
  year: number
): { type: 'FeatureCollection'; features: object[] } {
  const features = assets.map(asset => {
    const risk = computeAssetRisk(asset, scenario, year);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [asset.lng, asset.lat] },
      properties: {
        id: asset.id,
        name: asset.name,
        category: asset.category,
        sector: asset.sector,
        color: riskColor(risk.riskLevel),
        riskLevel: risk.riskLevel,
        overallRisk: Math.round(risk.overallRisk),
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

// ─── Supply-chain link GeoJSON ────────────────────────────────────────────────

export function buildLinkGeoJSON(
  assets: SimAsset[]
): { type: 'FeatureCollection'; features: object[] } {
  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
  const features: object[] = [];

  assets.forEach(asset => {
    if (!asset.linked) return;
    asset.linked.forEach(targetId => {
      const target = assetMap[targetId];
      if (!target) return;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [asset.lng, asset.lat],
            [target.lng, target.lat],
          ],
        },
        properties: { source: asset.id, target: targetId },
      });
    });
  });

  return { type: 'FeatureCollection', features };
}
