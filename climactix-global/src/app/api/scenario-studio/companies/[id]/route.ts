import { NextRequest, NextResponse } from 'next/server';
import { findById, upsert, remove, type BaseRecord } from '@/lib/db/file-store';
import { getSeedCompanyById } from '@/lib/simulation/scenarioStudioSeed';
import type { ScenarioCompany } from '@/types/scenario-studio';

const COLLECTION = 'scenario-studio-companies';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const seed = getSeedCompanyById(params.id);
  if (seed) return NextResponse.json({ success: true, data: seed }, { headers: corsHeaders() });

  const record = findById<ScenarioCompany & BaseRecord>(COLLECTION, params.id);
  if (!record) {
    return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404, headers: corsHeaders() });
  }
  return NextResponse.json({ success: true, data: record }, { headers: corsHeaders() });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (getSeedCompanyById(params.id)) {
    return NextResponse.json(
      { success: false, error: 'Sample companies are read-only' },
      { status: 400, headers: corsHeaders() }
    );
  }
  const updates = (await req.json()) as Partial<ScenarioCompany>;
  const record = upsert<ScenarioCompany & BaseRecord>(COLLECTION, params.id, updates);
  if (!record) {
    return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404, headers: corsHeaders() });
  }
  return NextResponse.json({ success: true, data: record }, { headers: corsHeaders() });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (getSeedCompanyById(params.id)) {
    return NextResponse.json(
      { success: false, error: 'Sample companies cannot be deleted' },
      { status: 400, headers: corsHeaders() }
    );
  }
  const ok = remove(COLLECTION, params.id);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Company not found' }, { status: 404, headers: corsHeaders() });
  }
  return NextResponse.json({ success: true }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
