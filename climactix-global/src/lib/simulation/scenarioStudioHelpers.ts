import type { AssetRiskProfile } from '@/types/simulation';
import type { ScenarioAsset, ScenarioRunResult } from '@/types/scenario-studio';

export interface AssetRiskRow {
  asset: ScenarioAsset;
  profile: AssetRiskProfile;
}

export function buildAssetRiskRows(assets: ScenarioAsset[], run: ScenarioRunResult | null): AssetRiskRow[] {
  if (!run) return [];
  const profileMap = new Map(run.assetProfiles.map((p) => [p.assetId, p]));
  const rows: AssetRiskRow[] = [];
  assets.forEach((asset) => {
    const profile = profileMap.get(asset.id);
    if (profile) rows.push({ asset, profile });
  });
  return rows;
}

export function profilesById(run: ScenarioRunResult | null): Record<string, AssetRiskProfile> {
  if (!run) return {};
  const out: Record<string, AssetRiskProfile> = {};
  run.assetProfiles.forEach((p) => {
    out[p.assetId] = p;
  });
  return out;
}
