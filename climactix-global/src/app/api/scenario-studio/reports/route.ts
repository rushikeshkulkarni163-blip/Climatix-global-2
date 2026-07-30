import { NextRequest, NextResponse } from 'next/server';
import { findAll, insert, type BaseRecord } from '@/lib/db/file-store';
import type { ScenarioStudioReport } from '@/types/scenario-studio';

const COLLECTION = 'scenario-studio-reports';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function GET() {
  const reports = findAll<ScenarioStudioReport & BaseRecord>(COLLECTION).sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
  return NextResponse.json({ success: true, data: reports }, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ScenarioStudioReport>;
    if (!body.companyId || !body.companyName || !body.scenario || !body.year) {
      return NextResponse.json(
        { success: false, error: 'companyId, companyName, scenario, and year are required' },
        { status: 400, headers: corsHeaders() }
      );
    }
    const record = insert<ScenarioStudioReport & BaseRecord>(COLLECTION, {
      companyId: body.companyId,
      companyName: body.companyName,
      scenario: body.scenario,
      year: body.year,
      generatedAt: new Date().toISOString(),
      generatedBy: body.generatedBy ?? 'Climactix analyst',
    });
    return NextResponse.json({ success: true, data: record }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to log report' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
