import { NextRequest, NextResponse } from 'next/server';
import { findMany, type BaseRecord } from '@/lib/db/file-store';
import { resolveCompanyAssets } from '@/lib/simulation/companyAssets';
import { getSeedSupplyEdges } from '@/lib/simulation/scenarioStudioSeed';
import { computeAssetRiskForFamily } from '@/lib/simulation/scenarioFamilies';
import type { SupplyChainNode, SupplyChainEdge, ScenarioFamilyId } from '@/types/scenario-studio';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*' };
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId');
  const scenario = (req.nextUrl.searchParams.get('scenario') as ScenarioFamilyId) ?? 'delayed-transition';
  const year = Number(req.nextUrl.searchParams.get('year') ?? '2040');

  if (!companyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400, headers: corsHeaders() });
  }

  const assets = resolveCompanyAssets(companyId);
  const assetIds = new Set(assets.map((a) => a.id));

  const seedEdges = getSeedSupplyEdges().filter((e) => assetIds.has(e.sourceId) && assetIds.has(e.targetId));
  const customEdges = findMany<SupplyChainEdge & BaseRecord>('scenario-studio-supply-edges', (e) => assetIds.has(e.sourceId));
  const edges: SupplyChainEdge[] = [...seedEdges, ...customEdges];

  // A source is "single-source" when it is the only supplier feeding a given downstream target.
  const incomingByTarget = new Map<string, string[]>();
  edges.forEach((e) => {
    incomingByTarget.set(e.targetId, [...(incomingByTarget.get(e.targetId) ?? []), e.sourceId]);
  });
  const singleSourceIds = new Set<string>();
  incomingByTarget.forEach((sources) => {
    if (sources.length === 1) singleSourceIds.add(sources[0]);
  });

  const nodes: SupplyChainNode[] = assets.map((asset) => {
    const risk = computeAssetRiskForFamily(asset, scenario, year);
    return {
      assetId: asset.id,
      tier: asset.category === 'supply-node' ? 2 : 1,
      singleSource: singleSourceIds.has(asset.id),
      region: asset.region,
      riskLevel: risk.riskLevel,
    };
  });

  return NextResponse.json({ success: true, data: { nodes, edges } }, { headers: corsHeaders() });
}
