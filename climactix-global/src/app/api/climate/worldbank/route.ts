import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const country = searchParams.get("country") ?? "US";
  const indicator = searchParams.get("indicator") ?? "EN.ATM.CO2E.KT";

  try {
    const res = await fetch(
      `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=30&mrv=20`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`World Bank returned ${res.status}`);
    const data = await res.json() as [unknown, { date: string; value: number | null }[]];
    const entries = (data[1] ?? [])
      .filter((e) => e.value !== null)
      .map((e) => ({ year: parseInt(e.date), value: e.value as number }))
      .reverse();

    return NextResponse.json({ success: true, data: entries }, { headers: corsHeaders() });
  } catch {
    const synthetic = Array.from({ length: 15 }, (_, i) => ({
      year: 2005 + i,
      value: 5000000 - i * 100000 + Math.random() * 50000,
    }));
    return NextResponse.json(
      { success: true, data: synthetic, synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=3600",
  };
}
