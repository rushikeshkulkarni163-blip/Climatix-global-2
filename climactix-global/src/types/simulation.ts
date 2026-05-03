export type ScenarioId = '1.5' | '2.0' | '3.0';
export type AssetCategory =
  | 'factory'
  | 'office'
  | 'warehouse'
  | 'port'
  | 'data-center'
  | 'supply-node'
  | 'mine'
  | 'farm';
export type LayerType = 'physical' | 'transition' | 'carbon' | 'composite';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SimAsset {
  id: string;
  name: string;
  category: AssetCategory;
  lat: number;
  lng: number;
  /** Annual revenue in $M */
  revenue: number;
  employees: number;
  country: string;
  region: string;
  sector: string;
  /** Replacement capex in $M */
  capex: number;
  /** Scope 1 emissions tCO2e/year */
  scope1: number;
  /** Scope 2 emissions tCO2e/year */
  scope2: number;
  /** IDs of linked supply-chain nodes */
  linked?: string[];
}

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  /** Peak warming by 2100 °C above pre-industrial */
  tempRise: number;
  carbonPrice2030: number;
  carbonPrice2050: number;
  physicalMultiplier2030: number;
  physicalMultiplier2050: number;
  transitionMultiplier2030: number;
  transitionMultiplier2050: number;
  color: string;
  bgClass: string;
}

export interface AssetRiskProfile {
  assetId: string;
  year: number;
  scenario: ScenarioId;
  // Physical risk sub-scores (0–100)
  heatStress: number;
  floodRisk: number;
  stormRisk: number;
  droughtRisk: number;
  physicalRisk: number;
  // Transition risk sub-scores (0–100)
  carbonPriceExposure: number; // $/tCO2 effective regional price
  policyRisk: number;
  technologyRisk: number;
  transitionRisk: number;
  // Financial impact
  revenueAtRisk: number;    // % of revenue
  ebitdaImpact: number;     // % of EBITDA (typically > revenueAtRisk due to operating leverage)
  complianceCostM: number;  // $M absolute carbon compliance cost
  supplyChainRisk: number;  // 0–100
  strandedRisk: boolean;
  overallRisk: number;      // 0–100 composite
  riskLevel: RiskLevel;
}

export interface PortfolioSummary {
  assetCount: number;
  totalRevenueM: number;
  avgPhysicalRisk: number;
  avgTransitionRisk: number;
  totalRevenueAtRiskM: number;
  totalComplianceCostM: number;
  highRiskAssets: number;
  criticalRiskAssets: number;
}

export interface TimeSeriesPoint {
  year: number;
  physicalRisk: number;
  transitionRisk: number;
  revenueAtRisk: number;
  complianceCostM: number;
}
