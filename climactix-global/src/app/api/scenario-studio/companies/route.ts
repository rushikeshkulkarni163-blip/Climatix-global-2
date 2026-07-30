import { NextRequest, NextResponse } from 'next/server';
import { findAll, insert, type BaseRecord } from '@/lib/db/file-store';
import { getSeedCompanies } from '@/lib/simulation/scenarioStudioSeed';
import type { ScenarioCompany } from '@/types/scenario-studio';

const COLLECTION = 'scenario-studio-companies';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function GET() {
  const custom = findAll<ScenarioCompany & BaseRecord>(COLLECTION);
  const companies: ScenarioCompany[] = [...getSeedCompanies(), ...custom];
  return NextResponse.json({ success: true, data: companies }, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ScenarioCompany>;
    if (!body.name || !body.industry || !body.country) {
      return NextResponse.json(
        { success: false, error: 'name, industry, and country are required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    const record = insert<ScenarioCompany & BaseRecord>(COLLECTION, {
      name: body.name,
      ticker: body.ticker,
      industry: body.industry,
      country: body.country,
      reportingYear: body.reportingYear ?? new Date().getFullYear(),
      revenueUsdM: body.revenueUsdM ?? 0,
      assetIds: [],
      isSample: false,
    });
    return NextResponse.json({ success: true, data: record }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create company' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
