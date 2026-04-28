export interface ClimateRiskScore {
  overall: number;
  physicalRisk: {
    acute: number;
    chronic: number;
    score: number;
  };
  transitionRisk: {
    policy: number;
    technology: number;
    market: number;
    reputation: number;
    score: number;
  };
  esgScore: {
    environmental: number;
    social: number;
    governance: number;
    score: number;
  };
  vulnerabilityIndex: number;
  adaptationCapacity: number;
  riskRating: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";
  confidence: number;
}

export interface AssessmentFormData {
  companyProfile: {
    organizationName: string;
    industry: Industry;
    subSector: string;
    country: string;
    countryCode: string;
    revenueRange: RevenueRange;
    employeeCount: EmployeeRange;
    latitude: number;
    longitude: number;
  };
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    useEstimate: boolean;
    fossilFuelPercent: number;
    renewablePercent: number;
    energyIntensity: number;
    emissionsTrend: "increasing" | "stable" | "decreasing";
  };
  physicalAssets: {
    assetTypes: AssetType[];
    floodZone: boolean;
    coastalProximity: boolean;
    wildfireZone: boolean;
    waterStressRegion: boolean;
    heatStressDays: number;
    waterStressIndex: number;
  };
  esgGovernance: {
    climatePolicy: "none" | "developing" | "established" | "leading";
    netZeroYear: number | null;
    boardOversight: boolean;
    tcfdDisclosure: boolean;
    cdpDisclosure: boolean;
    carbonOffsets: boolean;
    supplyChainEsg: boolean;
  };
  scenario: {
    timeHorizon: 2030 | 2040 | 2050;
    warmingScenario: "1.5" | "2.0" | "3.0" | "4.0";
    reportType: "executive" | "technical" | "investor";
    units: "metric" | "imperial";
  };
}

export type Industry =
  | "energy-oil-gas"
  | "energy-utilities"
  | "energy-renewables"
  | "manufacturing-heavy"
  | "manufacturing-chemicals"
  | "manufacturing-cement"
  | "agriculture-food"
  | "real-estate"
  | "transportation"
  | "financial-services"
  | "technology"
  | "mining-metals"
  | "retail-consumer"
  | "healthcare"
  | "water-waste"
  | "tourism-hospitality";

export type AssetType =
  | "manufacturing"
  | "office"
  | "warehouse"
  | "farm"
  | "coastal"
  | "data-center"
  | "retail";

export type RevenueRange =
  | "under-1m"
  | "1m-10m"
  | "10m-100m"
  | "100m-1b"
  | "over-1b";

export type EmployeeRange =
  | "1-50"
  | "51-250"
  | "251-1000"
  | "1001-10000"
  | "over-10000";

export interface SectorConfig {
  id: Industry;
  label: string;
  carbonIntensityBenchmark: number;
  waterStressSensitivity: number;
  regulatoryExposure: number;
  supplyChainVulnerability: number;
  physicalAssetRisk: number;
  subSectors: string[];
  tcfdRequirements: string[];
}

export interface ClimateDataPoint {
  date: string;
  value: number;
  unit: string;
}

export interface TemperatureData {
  time: string[];
  temperature2m: number[];
  temperatureAnomaly?: number[];
}

export interface AirQualityData {
  location: string;
  pm25: number;
  pm10: number;
  no2: number;
  co: number;
  so2: number;
  aqi: number;
  timestamp: string;
}

export interface DisasterEvent {
  id: string;
  name: string;
  type: string;
  country: string;
  date: string;
  status: string;
}

export interface Country {
  name: { common: string; official: string };
  cca2: string;
  cca3: string;
  latlng: [number, number];
  region: string;
  subregion: string;
  population: number;
  flags: { png: string; svg: string };
}

export interface NASAPowerData {
  solarRadiation: number;
  windSpeed: number;
  temperature: number;
  humidity: number;
  waterStress: number;
}

export interface WorldBankClimateData {
  country: string;
  indicator: string;
  values: { year: number; value: number }[];
}

export interface PortfolioHolding {
  id: string;
  company: string;
  sector: Industry;
  weight: number;
  riskScore?: ClimateRiskScore;
  carbonIntensity?: number;
  country?: string;
}

export interface ReportConfig {
  companyName: string;
  sector: string;
  date: string;
  horizon: number;
  scenario: string;
  reportType: string;
  riskScore: ClimateRiskScore;
  formData: AssessmentFormData;
  climateData?: {
    temperature?: TemperatureData;
    airQuality?: AirQualityData;
    nasaPower?: NASAPowerData;
    disasters?: DisasterEvent[];
  };
}

export interface SDGIndicator {
  goal: number;
  target: string;
  indicator: string;
  series: string;
  description: string;
}
