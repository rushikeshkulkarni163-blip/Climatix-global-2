import { NextRequest, NextResponse } from 'next/server';
import { insert, type BaseRecord } from '@/lib/db/file-store';
import { resolveCompanyAssets } from '@/lib/simulation/companyAssets';
import {
  SCENARIO_FAMILIES,
  computeAssetRiskForFamily,
  computePortfolioForFamily,
  computeClimateVaR,
} from '@/lib/simulation/scenarioFamilies';
import type { ScenarioFamilyId, ProjectionYear, ScenarioRunResult } from '@/types/scenario-studio';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      scenario?: ScenarioFamilyId;
      year?: ProjectionYear;
    };

    if (!body.companyId) {
      return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400, headers: corsHeaders() });
    }
    if (!body.scenario || !SCENARIO_FAMILIES[body.scenario]) {
      return NextResponse.json(
        { success: false, error: 'A valid scenario family is required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    const year = body.year ?? 2040;

    const assets = resolveCompanyAssets(body.companyId);
    if (assets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This company has no assets yet — add assets in Asset Explorer before running a simulation.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const assetProfiles = assets.map((a) => computeAssetRiskForFamily(a, body.scenario as ScenarioFamilyId, year));
    const portfolio = computePortfolioForFamily(assets, body.scenario, year);
    const climateVaR95 = computeClimateVaR(assets, body.scenario, year, 0.95, body.companyId);
    const climateVaR99 = computeClimateVaR(assets, body.scenario, year, 0.99, body.companyId);

    const result: Omit<ScenarioRunResult, 'id' | 'createdAt'> = {
      companyId: body.companyId,
      scenario: body.scenario,
      year,
      assetProfiles,
      portfolio: {
        totalRevenueM: portfolio.totalRevenueM,
        totalRevenueAtRiskM: Math.round(portfolio.totalRevenueAtRiskM * 10) / 10,
        totalEbitdaAtRiskM: Math.round(climateVaR95.expectedAnnualLossUsdM * 1.5 * 10) / 10,
        totalComplianceCostM: Math.round(portfolio.totalComplianceCostM * 10) / 10,
        totalAssetValueAtRiskM: Math.round(
          assets.reduce((s, a, i) => s + a.capex * (assetProfiles[i].overallRisk / 100) * 0.3, 0) * 10
        ) / 10,
        climateVaR95,
        climateVaR99,
      },
    };

    const saved = insert<ScenarioRunResult & BaseRecord>('scenario-studio-runs', result);

    return NextResponse.json({ success: true, data: saved }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Simulation failed to run' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
