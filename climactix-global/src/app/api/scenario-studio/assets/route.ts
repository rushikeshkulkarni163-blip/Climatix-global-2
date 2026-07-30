import { NextRequest, NextResponse } from 'next/server';
import { findMany, insert, type BaseRecord } from '@/lib/db/file-store';
import {
  getSeedCompanyAssets,
  getSeedAssetFinancials,
  getSeedCompanyById,
} from '@/lib/simulation/scenarioStudioSeed';
import type { ScenarioAsset } from '@/types/scenario-studio';

type StoredAsset = ScenarioAsset & BaseRecord & { companyId: string };

const COLLECTION = 'scenario-studio-assets';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400, headers: corsHeaders() });
  }

  if (getSeedCompanyById(companyId)) {
    const financials = getSeedAssetFinancials();
    const assets: ScenarioAsset[] = getSeedCompanyAssets(companyId).map((a) => ({
      ...a,
      ...financials[a.id],
    }));
    return NextResponse.json({ success: true, data: assets }, { headers: corsHeaders() });
  }

  const assets = findMany<StoredAsset>(COLLECTION, (a) => a.companyId === companyId);
  return NextResponse.json({ success: true, data: assets }, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ScenarioAsset> & { companyId?: string };
    if (!body.companyId || !body.name || body.lat === undefined || body.lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'companyId, name, lat, and lng are required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    const record = insert<StoredAsset>(COLLECTION, {
      companyId: body.companyId,
      name: body.name,
      category: body.category ?? 'factory',
      lat: body.lat,
      lng: body.lng,
      revenue: body.revenue ?? 0,
      employees: body.employees ?? 0,
      country: body.country ?? '',
      region: body.region ?? '',
      sector: body.sector ?? 'Manufacturing',
      capex: body.capex ?? 0,
      scope1: body.scope1 ?? 0,
      scope2: body.scope2 ?? 0,
      revenueContributionPct: body.revenueContributionPct ?? 0,
      replacementValueUsdM: body.replacementValueUsdM ?? body.capex ?? 0,
      insuranceValueUsdM: body.insuranceValueUsdM ?? body.capex ?? 0,
      businessCriticality: body.businessCriticality ?? 'medium',
      energySource: body.energySource ?? 'grid-mixed',
      waterDependency: body.waterDependency ?? 'medium',
    });
    return NextResponse.json({ success: true, data: record }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create asset' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
