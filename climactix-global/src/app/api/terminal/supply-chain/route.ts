import { NextRequest, NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get("sector") ?? "manufacturing";

  try {
    // Post a representative scope3 calculation for the selected sector
    const res = await fetch(`${ENGINE}/api/v1/supply-chain/scope3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: "Global Portfolio Aggregate",
        sector,
        annual_revenue_usd_m: 5000,
        include_downstream: true,
        suppliers: [
          { name: "Top Supplier A", country: "CN", tier: 1, annual_spend_usd_m: 142 },
          { name: "Top Supplier B", country: "IN", tier: 1, annual_spend_usd_m: 98 },
          { name: "Supplier C",     country: "DE", tier: 2, annual_spend_usd_m: 54 },
          { name: "Supplier D",     country: "US", tier: 1, annual_spend_usd_m: 88 },
          { name: "Supplier E",     country: "BR", tier: 2, annual_spend_usd_m: 76 },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Engine ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json(
      { ok: true, data, asOf: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[terminal/supply-chain]", err);
    return NextResponse.json({ ok: false, error: "Engine unavailable" }, { status: 503 });
  }
}
