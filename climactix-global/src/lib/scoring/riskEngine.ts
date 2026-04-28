import type { ClimateRiskScore, AssessmentFormData } from "@/types";
import { SECTOR_CONFIGS } from "./sectorConfig";
import { clamp } from "@/lib/utils";

function scorePhysicalAcute(data: AssessmentFormData): number {
  const { physicalAssets } = data;
  let score = 0;

  if (physicalAssets.heatStressDays > 30) score += 25;
  else if (physicalAssets.heatStressDays > 15) score += 15;
  else if (physicalAssets.heatStressDays > 5) score += 8;

  if (physicalAssets.floodZone) score += 25;
  if (physicalAssets.coastalProximity) score += 20;
  if (physicalAssets.wildfireZone) score += 20;

  const assetTypeRisk: Record<string, number> = {
    coastal: 15,
    farm: 10,
    manufacturing: 8,
    warehouse: 6,
    "data-center": 12,
    office: 4,
    retail: 5,
  };
  const assetRisk = physicalAssets.assetTypes.reduce(
    (acc, t) => acc + (assetTypeRisk[t] ?? 5),
    0
  );
  score += Math.min(assetRisk, 20);

  return clamp(score, 0, 100);
}

function scorePhysicalChronic(data: AssessmentFormData): number {
  const { physicalAssets, scenario } = data;
  const horizonMultiplier = scenario.timeHorizon === 2050 ? 1.3 : scenario.timeHorizon === 2040 ? 1.1 : 1.0;
  const warmingMultiplier = parseFloat(scenario.warmingScenario) / 2.0;

  let score = 0;
  if (physicalAssets.waterStressRegion) score += 20;
  if (physicalAssets.waterStressIndex > 0.6) score += 20;
  else if (physicalAssets.waterStressIndex > 0.3) score += 10;
  if (physicalAssets.coastalProximity) score += 15;

  score = score * horizonMultiplier * warmingMultiplier;
  return clamp(score, 0, 100);
}

function scoreTransitionPolicy(data: AssessmentFormData): number {
  const sector = SECTOR_CONFIGS[data.companyProfile.industry];
  const { emissions, esgGovernance } = data;

  let score = sector.regulatoryExposure * 60;

  const carbonIntensity =
    (emissions.scope1 + emissions.scope2) /
    Math.max(getRevenueMidpoint(data.companyProfile.revenueRange) / 1e6, 1);

  if (carbonIntensity > sector.carbonIntensityBenchmark * 1.5) score += 25;
  else if (carbonIntensity > sector.carbonIntensityBenchmark) score += 15;

  if (esgGovernance.climatePolicy === "none") score += 15;
  else if (esgGovernance.climatePolicy === "developing") score += 8;
  else if (esgGovernance.climatePolicy === "established") score -= 5;
  else if (esgGovernance.climatePolicy === "leading") score -= 15;

  return clamp(score, 0, 100);
}

function scoreTransitionTechnology(data: AssessmentFormData): number {
  const { emissions } = data;
  let score = 50;

  if (emissions.fossilFuelPercent > 80) score += 30;
  else if (emissions.fossilFuelPercent > 50) score += 15;
  else if (emissions.fossilFuelPercent < 20) score -= 20;

  if (emissions.renewablePercent > 80) score -= 25;
  else if (emissions.renewablePercent > 50) score -= 10;

  const sector = SECTOR_CONFIGS[data.companyProfile.industry];
  score += sector.physicalAssetRisk * 20;

  return clamp(score, 0, 100);
}

function scoreTransitionMarket(data: AssessmentFormData): number {
  const { esgGovernance, scenario } = data;
  let score = 40;

  if (!esgGovernance.netZeroYear) score += 20;
  else {
    const yearsToNetZero = esgGovernance.netZeroYear - 2024;
    if (yearsToNetZero > 26) score += 15;
    else if (yearsToNetZero > 16) score += 5;
    else score -= 10;
  }

  const warmingMult = parseFloat(scenario.warmingScenario) / 2.0;
  score = score * warmingMult;

  return clamp(score, 0, 100);
}

function scoreTransitionReputation(data: AssessmentFormData): number {
  const { esgGovernance } = data;
  let score = 50;

  if (!esgGovernance.tcfdDisclosure) score += 15;
  if (!esgGovernance.cdpDisclosure) score += 10;
  if (!esgGovernance.boardOversight) score += 10;
  if (!esgGovernance.supplyChainEsg) score += 10;
  if (esgGovernance.carbonOffsets) score -= 5;

  return clamp(score, 0, 100);
}

function scoreESGEnvironmental(data: AssessmentFormData): number {
  const { emissions } = data;
  const sector = SECTOR_CONFIGS[data.companyProfile.industry];

  let score = 50;
  const carbonIntensity =
    (emissions.scope1 + emissions.scope2 + emissions.scope3 * 0.3) /
    Math.max(getRevenueMidpoint(data.companyProfile.revenueRange) / 1e6, 1);

  const benchmark = sector.carbonIntensityBenchmark;
  const ratio = carbonIntensity / benchmark;

  if (ratio > 2) score += 35;
  else if (ratio > 1.5) score += 20;
  else if (ratio > 1) score += 10;
  else if (ratio < 0.5) score -= 20;
  else if (ratio < 0.75) score -= 10;

  if (emissions.emissionsTrend === "decreasing") score -= 15;
  else if (emissions.emissionsTrend === "increasing") score += 15;

  return clamp(score, 0, 100);
}

function scoreESGSocial(data: AssessmentFormData): number {
  const { esgGovernance } = data;
  let score = 45;

  if (!esgGovernance.supplyChainEsg) score += 20;
  if (!esgGovernance.boardOversight) score += 10;

  const sector = SECTOR_CONFIGS[data.companyProfile.industry];
  score += sector.supplyChainVulnerability * 25;

  return clamp(score, 0, 100);
}

function scoreESGGovernance(data: AssessmentFormData): number {
  const { esgGovernance } = data;
  let score = 60;

  if (esgGovernance.boardOversight) score -= 20;
  if (esgGovernance.tcfdDisclosure) score -= 15;
  if (esgGovernance.cdpDisclosure) score -= 10;
  if (esgGovernance.netZeroYear) score -= 10;
  if (esgGovernance.climatePolicy === "leading") score -= 15;
  else if (esgGovernance.climatePolicy === "established") score -= 8;

  return clamp(score, 0, 100);
}

function getRevenueMidpoint(range: string): number {
  const midpoints: Record<string, number> = {
    "under-1m": 500_000,
    "1m-10m": 5_000_000,
    "10m-100m": 50_000_000,
    "100m-1b": 500_000_000,
    "over-1b": 5_000_000_000,
  };
  return midpoints[range] ?? 50_000_000;
}

function computeRating(score: number): ClimateRiskScore["riskRating"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "MINIMAL";
}

function computeConfidence(data: AssessmentFormData): number {
  let filled = 0;
  const total = 12;

  if (data.companyProfile.organizationName) filled++;
  if (data.companyProfile.country) filled++;
  if (data.emissions.scope1 > 0) filled++;
  if (data.emissions.scope2 > 0) filled++;
  if (data.emissions.scope3 > 0) filled++;
  if (data.physicalAssets.assetTypes.length > 0) filled++;
  if (data.physicalAssets.heatStressDays > 0) filled++;
  if (data.physicalAssets.waterStressIndex > 0) filled++;
  if (data.esgGovernance.climatePolicy !== "none") filled++;
  if (data.esgGovernance.netZeroYear) filled++;
  if (data.esgGovernance.tcfdDisclosure) filled++;
  if (data.esgGovernance.boardOversight) filled++;

  return Math.round((filled / total) * 100);
}

export function calculateRiskScore(data: AssessmentFormData): ClimateRiskScore {
  const acute = scorePhysicalAcute(data);
  const chronic = scorePhysicalChronic(data);
  const physicalScore = acute * 0.45 + chronic * 0.55;

  const policy = scoreTransitionPolicy(data);
  const technology = scoreTransitionTechnology(data);
  const market = scoreTransitionMarket(data);
  const reputation = scoreTransitionReputation(data);
  const transitionScore =
    policy * 0.35 + technology * 0.30 + market * 0.20 + reputation * 0.15;

  const environmental = scoreESGEnvironmental(data);
  const social = scoreESGSocial(data);
  const governance = scoreESGGovernance(data);
  const esgScore = environmental * 0.50 + social * 0.25 + governance * 0.25;

  const overall = clamp(
    physicalScore * 0.40 + transitionScore * 0.40 + esgScore * 0.20,
    0,
    100
  );

  const sector = SECTOR_CONFIGS[data.companyProfile.industry];
  const vulnerabilityIndex = clamp(
    sector.waterStressSensitivity * 40 + sector.physicalAssetRisk * 60,
    0,
    100
  );

  const adaptationCapacity = clamp(100 - overall * 0.7, 0, 100);

  return {
    overall: Math.round(overall),
    physicalRisk: {
      acute: Math.round(acute),
      chronic: Math.round(chronic),
      score: Math.round(physicalScore),
    },
    transitionRisk: {
      policy: Math.round(policy),
      technology: Math.round(technology),
      market: Math.round(market),
      reputation: Math.round(reputation),
      score: Math.round(transitionScore),
    },
    esgScore: {
      environmental: Math.round(environmental),
      social: Math.round(social),
      governance: Math.round(governance),
      score: Math.round(esgScore),
    },
    vulnerabilityIndex: Math.round(vulnerabilityIndex),
    adaptationCapacity: Math.round(adaptationCapacity),
    riskRating: computeRating(overall),
    confidence: computeConfidence(data),
  };
}

export function generateScenarioProjections(
  baseScore: ClimateRiskScore,
  timeHorizon: number
): { year: number; bau: number; ndc: number; netZero: number }[] {
  const years = [];
  const startYear = 2024;
  const steps = Math.round((timeHorizon - startYear) / 5);

  for (let i = 0; i <= steps; i++) {
    const year = startYear + i * 5;
    const t = i / steps;
    years.push({
      year,
      bau: Math.round(clamp(baseScore.overall * (1 + t * 0.4), 0, 100)),
      ndc: Math.round(clamp(baseScore.overall * (1 + t * 0.1), 0, 100)),
      netZero: Math.round(clamp(baseScore.overall * (1 - t * 0.3), 0, 100)),
    });
  }
  return years;
}
