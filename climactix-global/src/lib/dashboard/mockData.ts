import type { RatingGrade } from "@/components/ds/Badge";

// All data below is structured to match the shape an eventual API response
// would take (see /api/risk-score, /api/terminal/overview), so it is a
// drop-in swap rather than a UI-only mock.

export type ScenarioKey = "1.5" | "2.0" | "3.0" | "4.0";

export interface OrgStatus {
  orgName: string;
  portfolioStatus: "Operational" | "Watch" | "Elevated";
  overallRiskRating: RatingGrade;
  todaysAlerts: number;
  regulatoryUpdates: number;
  dataFreshness: "Live" | "Delayed";
  lastUpdated: string;
}

export const ORG_STATUS: OrgStatus = {
  orgName: "Climactix Global — Institutional Portfolio",
  portfolioStatus: "Watch",
  overallRiskRating: "BBB",
  todaysAlerts: 4,
  regulatoryUpdates: 2,
  dataFreshness: "Live",
  // Static mock timestamp — using `new Date()` here would be computed once at
  // server-render time and again at client-hydrate time, producing different
  // strings and a React hydration mismatch. Swap for a live API value later.
  lastUpdated: "2026-06-30T14:00:00.000Z",
};

export type KPIFormat = "score" | "currency" | "percent" | "index";

export interface KPIDefinition {
  id: string;
  label: string;
  baseValue: number;
  format: KPIFormat;
  upIsBad: boolean;
  benchmark: number;
  confidence: number;
  sparkline: number[];
  reasoning: string[];
}

export const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    id: "climate-risk-score",
    label: "Climate Risk Score",
    baseValue: 64,
    format: "score",
    upIsBad: true,
    benchmark: 58,
    confidence: 91,
    sparkline: [58, 60, 59, 62, 61, 63, 64],
    reasoning: [
      "Weighted composite of physical (40%), transition (35%), and disclosure credibility (25%) sub-scores.",
      "Driven up this quarter by coastal flood exposure revaluation in APAC manufacturing assets.",
    ],
  },
  {
    id: "transition-risk",
    label: "Transition Risk",
    baseValue: 57,
    format: "score",
    upIsBad: true,
    benchmark: 52,
    confidence: 88,
    sparkline: [50, 52, 54, 53, 55, 56, 57],
    reasoning: [
      "Reflects carbon price sensitivity, policy stringency, and stranded-asset exposure under current trajectory.",
      "EU ETS price increase of +€38/t since Q1 is the primary driver.",
    ],
  },
  {
    id: "physical-risk",
    label: "Physical Risk",
    baseValue: 71,
    format: "score",
    upIsBad: true,
    benchmark: 60,
    confidence: 85,
    sparkline: [66, 67, 69, 68, 70, 70, 71],
    reasoning: [
      "Aggregates flood, heat, drought, cyclone, and wildfire exposure across geocoded physical assets.",
      "Above benchmark due to concentration of manufacturing assets in coastal flood zones.",
    ],
  },
  {
    id: "supply-chain-exposure",
    label: "Supply Chain Exposure",
    baseValue: 48,
    format: "score",
    upIsBad: true,
    benchmark: 45,
    confidence: 76,
    sparkline: [42, 43, 45, 44, 46, 47, 48],
    reasoning: [
      "Tier-1/2/3 supplier concentration weighted by country risk and climate hazard exposure.",
      "Vietnam Tier-2 concentration (12 suppliers, single province) is the largest single contributor.",
    ],
  },
  {
    id: "revenue-at-risk",
    label: "Revenue at Risk",
    baseValue: 184_000_000,
    format: "currency",
    upIsBad: true,
    benchmark: 150_000_000,
    confidence: 80,
    sparkline: [150, 158, 162, 170, 175, 180, 184],
    reasoning: [
      "Modeled revenue exposure under current-policy scenario across physical and transition channels.",
      "Largest single exposure: $84M from coastal flood risk at APAC manufacturing sites.",
    ],
  },
  {
    id: "carbon-intensity",
    label: "Carbon Intensity",
    baseValue: 312,
    format: "index",
    upIsBad: true,
    benchmark: 280,
    confidence: 94,
    sparkline: [330, 325, 322, 318, 316, 314, 312],
    reasoning: [
      "Scope 1+2 emissions per $M revenue, normalized against sector benchmark.",
      "Trending down on renewable procurement increases at two manufacturing sites.",
    ],
  },
  {
    id: "climate-var",
    label: "Climate VaR",
    baseValue: 6.4,
    format: "percent",
    upIsBad: true,
    benchmark: 5.1,
    confidence: 72,
    sparkline: [5.0, 5.3, 5.6, 5.9, 6.1, 6.2, 6.4],
    reasoning: [
      "95% confidence Value-at-Risk from aggregate climate exposure, expressed as % of portfolio value.",
      "Confidence is lower than other metrics due to limited Scope 3 verification across holdings.",
    ],
  },
  {
    id: "greenwashing-risk",
    label: "Greenwashing Risk",
    baseValue: 34,
    format: "score",
    upIsBad: true,
    benchmark: 38,
    confidence: 83,
    sparkline: [40, 39, 37, 36, 35, 35, 34],
    reasoning: [
      "Disclosure consistency scan across annual reports, sustainability reports, and earnings calls.",
      "Below benchmark — no material unsupported claims detected this quarter.",
    ],
  },
  {
    id: "scenario-confidence",
    label: "Scenario Confidence",
    baseValue: 79,
    format: "percent",
    upIsBad: false,
    benchmark: 75,
    confidence: 79,
    sparkline: [74, 75, 76, 77, 78, 78, 79],
    reasoning: [
      "Model confidence in NGFS scenario outputs given current data coverage and asset geocoding quality.",
    ],
  },
  {
    id: "portfolio-coverage",
    label: "Portfolio Coverage",
    baseValue: 94.2,
    format: "percent",
    upIsBad: false,
    benchmark: 88,
    confidence: 97,
    sparkline: [88, 89, 91, 92, 93, 94, 94.2],
    reasoning: ["Share of AUM with verified climate risk data across all holdings."],
  },
];

// Deterministic, explainable scenario multipliers — applied to KPI base
// values when the user switches the Scenario Analysis control. Values >1
// increase risk metrics, <1 reduce them; documented per CLAUDE.md's
// "no black-box logic" scoring rule.
export const SCENARIO_MULTIPLIERS: Record<ScenarioKey, Record<string, number>> = {
  "1.5": {
    "climate-risk-score": 0.88,
    "transition-risk": 1.22,
    "physical-risk": 0.74,
    "supply-chain-exposure": 0.9,
    "revenue-at-risk": 0.7,
    "carbon-intensity": 0.82,
    "climate-var": 0.78,
    "greenwashing-risk": 1.0,
    "scenario-confidence": 0.92,
    "portfolio-coverage": 1.0,
  },
  "2.0": {
    "climate-risk-score": 1.0,
    "transition-risk": 1.0,
    "physical-risk": 1.0,
    "supply-chain-exposure": 1.0,
    "revenue-at-risk": 1.0,
    "carbon-intensity": 1.0,
    "climate-var": 1.0,
    "greenwashing-risk": 1.0,
    "scenario-confidence": 1.0,
    "portfolio-coverage": 1.0,
  },
  "3.0": {
    "climate-risk-score": 1.18,
    "transition-risk": 0.85,
    "physical-risk": 1.32,
    "supply-chain-exposure": 1.15,
    "revenue-at-risk": 1.55,
    "carbon-intensity": 1.05,
    "climate-var": 1.34,
    "greenwashing-risk": 1.0,
    "scenario-confidence": 0.85,
    "portfolio-coverage": 1.0,
  },
  "4.0": {
    "climate-risk-score": 1.34,
    "transition-risk": 0.7,
    "physical-risk": 1.58,
    "supply-chain-exposure": 1.3,
    "revenue-at-risk": 2.1,
    "carbon-intensity": 1.1,
    "climate-var": 1.7,
    "greenwashing-risk": 1.0,
    "scenario-confidence": 0.74,
    "portfolio-coverage": 1.0,
  },
};

export interface PortfolioCompany {
  id: string;
  name: string;
  sector: string;
  rating: RatingGrade;
  climateRiskScore: number;
  revenueAtRiskUSD: number;
  transitionRisk: number;
  physicalRisk: number;
  trend: "up" | "down" | "flat";
}

export const PORTFOLIO_COMPANIES: PortfolioCompany[] = [
  { id: "acme-industrial", name: "Acme Industrial Holdings", sector: "Manufacturing", rating: "BBB", climateRiskScore: 68, revenueAtRiskUSD: 42_000_000, transitionRisk: 59, physicalRisk: 74, trend: "up" },
  { id: "northbay-energy", name: "Northbay Energy Corp", sector: "Energy", rating: "BB", climateRiskScore: 77, revenueAtRiskUSD: 61_000_000, transitionRisk: 81, physicalRisk: 58, trend: "up" },
  { id: "meridian-logistics", name: "Meridian Logistics", sector: "Transport & Logistics", rating: "A", climateRiskScore: 51, revenueAtRiskUSD: 18_000_000, transitionRisk: 47, physicalRisk: 56, trend: "flat" },
  { id: "harbor-textiles", name: "Harbor Textiles Group", sector: "Consumer Goods", rating: "BBB", climateRiskScore: 63, revenueAtRiskUSD: 29_000_000, transitionRisk: 55, physicalRisk: 69, trend: "down" },
  { id: "vantage-semis", name: "Vantage Semiconductor", sector: "Technology", rating: "AA", climateRiskScore: 38, revenueAtRiskUSD: 9_000_000, transitionRisk: 33, physicalRisk: 41, trend: "flat" },
  { id: "summit-agritrade", name: "Summit AgriTrade", sector: "Agriculture", rating: "B", climateRiskScore: 82, revenueAtRiskUSD: 54_000_000, transitionRisk: 60, physicalRisk: 89, trend: "up" },
  { id: "cobalt-mining", name: "Cobalt Mining Partners", sector: "Mining & Metals", rating: "CCC", climateRiskScore: 88, revenueAtRiskUSD: 73_000_000, transitionRisk: 84, physicalRisk: 80, trend: "up" },
  { id: "evergreen-reit", name: "Evergreen REIT Trust", sector: "Real Estate", rating: "A", climateRiskScore: 47, revenueAtRiskUSD: 22_000_000, transitionRisk: 41, physicalRisk: 52, trend: "down" },
];

export interface MapAsset {
  id: string;
  name: string;
  kind: "assets" | "suppliers" | "ports" | "plants";
  lat: number;
  lng: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  country: string;
  financialImpactUSD: number;
  recommendation: string;
}

export const MAP_ASSETS: MapAsset[] = [
  { id: "asset-ho-chi-minh", name: "Ho Chi Minh Manufacturing Hub", kind: "plants", lat: 10.78, lng: 106.69, riskLevel: "critical", country: "Vietnam", financialImpactUSD: 84_000_000, recommendation: "Accelerate flood defense capex; evaluate site relocation feasibility study." },
  { id: "asset-jakarta-port", name: "Jakarta Logistics Port", kind: "ports", lat: -6.13, lng: 106.81, riskLevel: "high", country: "Indonesia", financialImpactUSD: 31_000_000, recommendation: "Diversify routing through Surabaya during Q3–Q4 monsoon window." },
  { id: "asset-rotterdam-port", name: "Rotterdam Distribution Port", kind: "ports", lat: 51.92, lng: 4.48, riskLevel: "low", country: "Netherlands", financialImpactUSD: 4_000_000, recommendation: "No action required — maintain current monitoring cadence." },
  { id: "asset-chennai-supplier", name: "Chennai Tier-1 Supplier", kind: "suppliers", lat: 13.08, lng: 80.27, riskLevel: "high", country: "India", financialImpactUSD: 19_000_000, recommendation: "Qualify backup supplier in Pune corridor within 2 quarters." },
  { id: "asset-houston-plant", name: "Houston Processing Plant", kind: "plants", lat: 29.76, lng: -95.37, riskLevel: "medium", country: "United States", financialImpactUSD: 12_000_000, recommendation: "Upgrade storm-hardening to Tier-2 standard ahead of hurricane season." },
  { id: "asset-sao-paulo-supplier", name: "São Paulo Tier-2 Supplier", kind: "suppliers", lat: -23.55, lng: -46.63, riskLevel: "medium", country: "Brazil", financialImpactUSD: 8_000_000, recommendation: "Monitor drought index; secondary water sourcing agreement recommended." },
  { id: "asset-shanghai-asset", name: "Shanghai Distribution Center", kind: "assets", lat: 31.23, lng: 121.47, riskLevel: "medium", country: "China", financialImpactUSD: 15_000_000, recommendation: "Heat-stress labor protocol review for summer operations." },
  { id: "asset-lagos-supplier", name: "Lagos Raw Materials Supplier", kind: "suppliers", lat: 6.52, lng: 3.38, riskLevel: "high", country: "Nigeria", financialImpactUSD: 11_000_000, recommendation: "Contract resilience clause renegotiation at next renewal." },
];

export interface HazardZone {
  id: string;
  hazard: "flood" | "heat" | "wildfire" | "cyclone";
  lat: number;
  lng: number;
  intensity: number; // 0-1, drives circle radius/opacity
}

export const HAZARD_ZONES: HazardZone[] = [
  { id: "hz-1", hazard: "flood", lat: 10.78, lng: 106.69, intensity: 0.9 },
  { id: "hz-2", hazard: "flood", lat: -6.13, lng: 106.81, intensity: 0.7 },
  { id: "hz-3", hazard: "heat", lat: 31.23, lng: 121.47, intensity: 0.6 },
  { id: "hz-4", hazard: "heat", lat: 13.08, lng: 80.27, intensity: 0.75 },
  { id: "hz-5", hazard: "wildfire", lat: -23.55, lng: -46.63, intensity: 0.5 },
  { id: "hz-6", hazard: "wildfire", lat: 29.76, lng: -95.37, intensity: 0.45 },
  { id: "hz-7", hazard: "cyclone", lat: 6.52, lng: 3.38, intensity: 0.65 },
  { id: "hz-8", hazard: "cyclone", lat: 10.78, lng: 106.69, intensity: 0.8 },
];

export interface RiskMatrixCellDetail {
  companies: string[];
  assets: string[];
  financialLossUSD: number;
  mitigation: string;
  evidence: string;
}

export function getRiskMatrixCell(probability: number, impact: number): RiskMatrixCellDetail {
  const severity = probability * impact;
  return {
    companies: PORTFOLIO_COMPANIES.filter((c) => Math.round((c.climateRiskScore / 100) * 25) === severity)
      .slice(0, 3)
      .map((c) => c.name)
      .concat(severity > 15 ? ["Cobalt Mining Partners"] : []),
    assets: MAP_ASSETS.filter((a) => (a.riskLevel === "critical" ? 5 : a.riskLevel === "high" ? 4 : a.riskLevel === "medium" ? 3 : 2) === impact)
      .slice(0, 2)
      .map((a) => a.name),
    financialLossUSD: severity * 4_200_000,
    mitigation:
      severity >= 16
        ? "Immediate capital allocation review; site-level mitigation plan required within 30 days."
        : severity >= 9
        ? "Quarterly mitigation review; budget contingency recommended."
        : "Standard monitoring cadence; no immediate action required.",
    evidence: `Derived from ${probability * 4 + impact * 3} underlying hazard and exposure data points across geocoded assets.`,
  };
}

export interface TimelineEvent {
  id: string;
  date: string;
  category: "weather" | "policy" | "carbon-price" | "supply-chain" | "corporate";
  title: string;
  description: string;
  impact: string;
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  { id: "tl-1", date: "2026-01-14", category: "weather", title: "Cyclone Freddy-2 — Mozambique Channel", description: "Category 3 cyclone affecting regional shipping lanes.", impact: "Logistics delay: 6–9 days for 2 supplier shipments." },
  { id: "tl-2", date: "2026-02-03", category: "policy", title: "EU CBAM reporting phase extended", description: "Carbon Border Adjustment Mechanism reporting deadline extended to Q3.", impact: "Compliance timeline relief for 3 EU-importing subsidiaries." },
  { id: "tl-3", date: "2026-02-21", category: "carbon-price", title: "EU ETS price surpasses €98/t", description: "Carbon price increase driven by tightened allowance supply.", impact: "Transition risk score +4 pts for energy-intensive holdings." },
  { id: "tl-4", date: "2026-03-09", category: "supply-chain", title: "Vietnam province flooding — Tier-2 cluster", description: "Seasonal flooding affects 12 Tier-2 suppliers in single province.", impact: "Supply chain exposure score elevated; diversification flagged." },
  { id: "tl-5", date: "2026-04-02", category: "corporate", title: "Cobalt Mining Partners downgrade", description: "Internal rating downgraded from B to CCC on stranded-asset exposure.", impact: "Portfolio-level revenue-at-risk +$9M." },
  { id: "tl-6", date: "2026-05-18", category: "policy", title: "India BRSR Core assurance mandate", description: "Mandatory third-party assurance for BRSR Core disclosures begins.", impact: "2 portfolio holdings require assurance engagement by FY-end." },
];

export interface SupplyChainNode {
  id: string;
  label: string;
  tier: 0 | 1 | 2 | 3;
  riskScore: number;
  country: string;
  parentId: string | null;
}

export const SUPPLY_CHAIN_NODES: SupplyChainNode[] = [
  { id: "org", label: "Climactix Portfolio", tier: 0, riskScore: 0, country: "—", parentId: null },

  { id: "t1-vn", label: "Vietnam Assembly Co.", tier: 1, riskScore: 78, country: "Vietnam", parentId: "org" },
  { id: "t1-in", label: "Chennai Components Ltd.", tier: 1, riskScore: 64, country: "India", parentId: "org" },
  { id: "t1-mx", label: "Monterrey Industrial S.A.", tier: 1, riskScore: 41, country: "Mexico", parentId: "org" },
  { id: "t1-de", label: "Bavaria Precision GmbH", tier: 1, riskScore: 22, country: "Germany", parentId: "org" },

  { id: "t2-vn-1", label: "Mekong Raw Materials", tier: 2, riskScore: 85, country: "Vietnam", parentId: "t1-vn" },
  { id: "t2-vn-2", label: "Saigon Logistics Partner", tier: 2, riskScore: 69, country: "Vietnam", parentId: "t1-vn" },
  { id: "t2-in-1", label: "Tamil Nadu Smelting", tier: 2, riskScore: 71, country: "India", parentId: "t1-in" },
  { id: "t2-in-2", label: "Pune Electronics Supply", tier: 2, riskScore: 48, country: "India", parentId: "t1-in" },
  { id: "t2-mx-1", label: "Sonora Plastics", tier: 2, riskScore: 39, country: "Mexico", parentId: "t1-mx" },
  { id: "t2-de-1", label: "Ruhr Steel Components", tier: 2, riskScore: 27, country: "Germany", parentId: "t1-de" },

  { id: "t3-vn-1", label: "Mekong Delta Cotton Farms", tier: 3, riskScore: 91, country: "Vietnam", parentId: "t2-vn-1" },
  { id: "t3-in-1", label: "Odisha Bauxite Mines", tier: 3, riskScore: 88, country: "India", parentId: "t2-in-1" },
];
