import { NextResponse } from 'next/server';
import { SCENARIO_FAMILIES, SCENARIO_FAMILY_ORDER } from '@/lib/simulation/scenarioFamilies';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' };
}

export async function GET() {
  const scenarios = SCENARIO_FAMILY_ORDER.map((id) => SCENARIO_FAMILIES[id]);
  return NextResponse.json({ success: true, data: scenarios }, { headers: corsHeaders() });
}
