/**
 * Scenario Studio domain types.
 *
 * Deliberately layered on top of `types/simulation.ts` (SimAsset, AssetRiskProfile,
 * RiskLevel) rather than redefining asset/risk shapes — Scenario Studio adds a
 * Company/ScenarioFamily/Evidence/VaR layer above the existing geospatial risk
 * engine instead of forking it.
 */
import type { SimAsset, AssetRiskProfile, RiskLevel } from './simulation';

// ── Scenario families ──────────────────────────────────────────────────────
// The 6 NGFS Phase IV/V published reference scenarios. Distinct from the
// legacy `ScenarioId` ('1.5'|'2.0'|'3.0') used by /simulation and
// /terminal/simulation — those remain untouched. See
// lib/simulation/scenarioFamilies.ts for the calibration + mapping.
export type ScenarioFamilyId =
  | 'current-policies'
  | 'ndcs'
  | 'below-2c'
  | 'net-zero-2050'
  | 'delayed-transition'
  | 'fragmented-world';

export type ScenarioCategory = 'orderly' | 'disorderly' | 'hot-house-world';

export interface ScenarioFamilyConfig {
  id: ScenarioFamilyId;
  label: string;
  shortLabel: string;
  category: ScenarioCategory;
  description: string;
  /** Approx. peak/2100 warming (°C above pre-industrial) per NGFS Phase IV/V summary statistics. */
  tempRise2100: number;
  carbonPrice2030: number;
  carbonPrice2050: number;
  physicalMultiplier2030: number;
  physicalMultiplier2050: number;
  transitionMultiplier2030: number;
  transitionMultiplier2050: number;
  /** 0 = maximally disorderly/fragmented policy response, 1 = fully orderly/coordinated. */
  policyOrderliness: number;
  color: string;
  bgClass: string;
}

export const PROJECTION_YEARS = [2025, 2030, 2035, 2040, 2050, 2060, 2080, 2100] as const;
export type ProjectionYear = (typeof PROJECTION_YEARS)[number];

// ── Evidence / explainability ──────────────────────────────────────────────

export interface EvidenceMeta {
  sourceDatasets: string[];
  calculationMethod: string;
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
  methodologyHref: string;
}

// ── Company workspace ───────────────────────────────────────────────────────

export interface ScenarioCompany {
  id: string;
  name: string;
  ticker?: string;
  industry: string;
  country: string;
  reportingYear: number;
  revenueUsdM: number;
  assetIds: string[];
  /** True for the bundled demo portfolio; false once a real company record is created. */
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BusinessCriticality = 'low' | 'medium' | 'high' | 'critical';
export type EnergySource =
  | 'grid-fossil'
  | 'grid-mixed'
  | 'grid-renewable'
  | 'on-site-renewable'
  | 'diesel-backup';
export type WaterDependency = 'low' | 'medium' | 'high';

/** Extends SimAsset with the financial/operational fields the Asset Explorer prompt calls for. */
export interface AssetFinancialProfile {
  assetId: string;
  revenueContributionPct: number;
  replacementValueUsdM: number;
  insuranceValueUsdM: number;
  businessCriticality: BusinessCriticality;
  energySource: EnergySource;
  waterDependency: WaterDependency;
}

export type ScenarioAsset = SimAsset & Partial<AssetFinancialProfile>;

// ── Supply chain ────────────────────────────────────────────────────────────

export interface SupplyChainNode {
  assetId: string;
  tier: 1 | 2 | 3;
  singleSource: boolean;
  region: string;
  riskLevel: RiskLevel;
}

export interface SupplyChainEdge {
  sourceId: string;
  targetId: string;
  dependencyPct: number;
}

// ── Financial intelligence ──────────────────────────────────────────────────

export interface ClimateVaRResult {
  companyId: string;
  scenario: ScenarioFamilyId;
  year: ProjectionYear;
  confidenceLevel: 0.95 | 0.99;
  valueAtRiskUsdM: number;
  expectedAnnualLossUsdM: number;
  worstCaseUsdM: number;
  evidence: EvidenceMeta;
}

export interface PortfolioFinancials {
  totalRevenueM: number;
  totalRevenueAtRiskM: number;
  totalEbitdaAtRiskM: number;
  totalComplianceCostM: number;
  totalAssetValueAtRiskM: number;
  climateVaR95: ClimateVaRResult;
  climateVaR99: ClimateVaRResult;
}

// ── Scenario run (a saved simulation snapshot) ──────────────────────────────

export interface ScenarioRunResult {
  id: string;
  companyId: string;
  scenario: ScenarioFamilyId;
  year: ProjectionYear;
  assetProfiles: AssetRiskProfile[];
  portfolio: PortfolioFinancials;
  createdAt: string;
}

// ── Reports ──────────────────────────────────────────────────────────────────

export interface ScenarioStudioReport {
  id: string;
  companyId: string;
  companyName: string;
  scenario: ScenarioFamilyId;
  year: ProjectionYear;
  generatedAt: string;
  generatedBy: string;
}
