import { findMany, type BaseRecord } from '@/lib/db/file-store';
import { getSeedCompanyAssets, getSeedCompanyById } from './scenarioStudioSeed';
import type { SimAsset } from '@/types/simulation';
import type { ScenarioAsset } from '@/types/scenario-studio';

const ASSETS_COLLECTION = 'scenario-studio-assets';

/** Resolves a company's assets to plain SimAsset shape, whichever store they live in. */
export function resolveCompanyAssets(companyId: string): SimAsset[] {
  if (getSeedCompanyById(companyId)) {
    return getSeedCompanyAssets(companyId);
  }
  const stored = findMany<ScenarioAsset & BaseRecord & { companyId: string }>(
    ASSETS_COLLECTION,
    (a) => a.companyId === companyId
  );
  return stored.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    lat: a.lat,
    lng: a.lng,
    revenue: a.revenue,
    employees: a.employees,
    country: a.country,
    region: a.region,
    sector: a.sector,
    capex: a.capex,
    scope1: a.scope1,
    scope2: a.scope2,
    linked: a.linked,
  }));
}
