import { SAMPLE_ASSETS } from './sampleAssets';
import type { SimAsset, AssetCategory } from '@/types/simulation';
import type {
  ScenarioCompany,
  AssetFinancialProfile,
  SupplyChainEdge,
  BusinessCriticality,
  EnergySource,
  WaterDependency,
} from '@/types/scenario-studio';

/**
 * Scenario Studio's bundled demo portfolio — three sample companies built by
 * grouping the existing SAMPLE_ASSETS (src/lib/simulation/sampleAssets.ts)
 * rather than inventing new fabricated companies. Every company/asset here
 * carries `isSample: true` so the UI can label it clearly as demo data —
 * real client portfolios are created via the Company Workspace and persist
 * through the file-store (see src/lib/db/file-store.ts).
 */
interface SeedCompanyDef {
  id: string;
  name: string;
  ticker: string;
  industry: string;
  country: string;
  assetIds: string[];
}

const SEED_COMPANIES: SeedCompanyDef[] = [
  {
    id: 'c-meridian',
    name: 'Meridian Energy & Resources',
    ticker: 'MERR',
    industry: 'Energy & Mining',
    country: 'Multinational',
    assetIds: ['a01', 'a05', 'a10'],
  },
  {
    id: 'c-atlas',
    name: 'Atlas Global Manufacturing',
    ticker: 'ATLG',
    industry: 'Manufacturing & Logistics',
    country: 'Multinational',
    assetIds: ['a02', 'a03', 'a08', 'a09', 'a11'],
  },
  {
    id: 'c-helios',
    name: 'Helios Technology Holdings',
    ticker: 'HLTH',
    industry: 'Technology & Financial Services',
    country: 'Multinational',
    assetIds: ['a04', 'a06', 'a07', 'a12'],
  },
];

const SEED_TIMESTAMP = '2024-01-01T00:00:00.000Z';

function criticalityFor(revenueSharePct: number): BusinessCriticality {
  if (revenueSharePct >= 30) return 'critical';
  if (revenueSharePct >= 15) return 'high';
  if (revenueSharePct >= 5) return 'medium';
  return 'low';
}

function energySourceFor(asset: SimAsset): EnergySource {
  switch (asset.sector) {
    case 'Energy':
    case 'Mining':
      return 'grid-fossil';
    case 'Technology':
      return asset.category === 'data-center' ? 'on-site-renewable' : 'grid-renewable';
    case 'Finance':
      return 'grid-renewable';
    case 'Agriculture':
      return 'diesel-backup';
    default:
      return 'grid-mixed';
  }
}

function waterDependencyFor(category: AssetCategory): WaterDependency {
  if (category === 'farm') return 'high';
  if (category === 'factory' || category === 'mine') return 'medium';
  return 'low';
}

export function getSeedCompanies(): ScenarioCompany[] {
  return SEED_COMPANIES.map((def) => {
    const assets = SAMPLE_ASSETS.filter((a) => def.assetIds.includes(a.id));
    const revenueUsdM = assets.reduce((s, a) => s + a.revenue, 0);
    return {
      id: def.id,
      name: def.name,
      ticker: def.ticker,
      industry: def.industry,
      country: def.country,
      reportingYear: 2024,
      revenueUsdM,
      assetIds: def.assetIds,
      isSample: true,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  });
}

export function getSeedCompanyById(id: string): ScenarioCompany | null {
  return getSeedCompanies().find((c) => c.id === id) ?? null;
}

export function getSeedCompanyAssets(companyId: string): SimAsset[] {
  const company = getSeedCompanyById(companyId);
  if (!company) return [];
  return SAMPLE_ASSETS.filter((a) => company.assetIds.includes(a.id));
}

export function getSeedAssetFinancials(): Record<string, AssetFinancialProfile> {
  const out: Record<string, AssetFinancialProfile> = {};
  getSeedCompanies().forEach((company) => {
    const assets = SAMPLE_ASSETS.filter((a) => company.assetIds.includes(a.id));
    assets.forEach((asset) => {
      const pct = company.revenueUsdM > 0 ? (asset.revenue / company.revenueUsdM) * 100 : 0;
      out[asset.id] = {
        assetId: asset.id,
        revenueContributionPct: Math.round(pct * 10) / 10,
        replacementValueUsdM: Math.round(asset.capex * 1.15 * 10) / 10,
        insuranceValueUsdM: Math.round(asset.capex * 0.85 * 10) / 10,
        businessCriticality: criticalityFor(pct),
        energySource: energySourceFor(asset),
        waterDependency: waterDependencyFor(asset.category),
      };
    });
  });
  return out;
}

export function getSeedSupplyEdges(): SupplyChainEdge[] {
  const edges: SupplyChainEdge[] = [];
  SAMPLE_ASSETS.forEach((asset) => {
    asset.linked?.forEach((targetId) => {
      edges.push({ sourceId: asset.id, targetId, dependencyPct: 100 });
    });
  });
  return edges;
}
