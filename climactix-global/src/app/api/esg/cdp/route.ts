import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const company = searchParams.get("company") ?? "Exxon";

  try {
    // CDP open data via Socrata API (no key for public datasets)
    const res = await fetch(
      `https://data.cdp.net/resource/hmn7-nt5v.json?$q=${encodeURIComponent(company)}&$limit=10`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`CDP returned ${res.status}`);
    const data = await res.json() as unknown[];
    return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: true, data: SYNTHETIC_CDP[company] ?? SYNTHETIC_CDP["Exxon"], synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

const SYNTHETIC_CDP: Record<string, unknown[]> = {
  Exxon: [
    { organization: "ExxonMobil", year: 2023, score: "C", sector: "Energy", emissions_scope1: 120000000, renewable_pct: 4 },
    { organization: "ExxonMobil", year: 2022, score: "C-", sector: "Energy", emissions_scope1: 125000000, renewable_pct: 3 },
  ],
  Microsoft: [
    { organization: "Microsoft", year: 2023, score: "A", sector: "Technology", emissions_scope1: 15000, renewable_pct: 100 },
    { organization: "Microsoft", year: 2022, score: "A", sector: "Technology", emissions_scope1: 17000, renewable_pct: 95 },
  ],
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=3600",
  };
}
