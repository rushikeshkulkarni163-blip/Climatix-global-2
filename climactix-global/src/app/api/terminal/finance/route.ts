import { NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

async function get(path: string) {
  const res = await fetch(`${ENGINE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Engine ${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    const [carbonPrices, greenBonds, capitalFlows] = await Promise.all([
      get("/api/v1/finance/carbon-price"),
      get("/api/v1/finance/green-bonds"),
      get("/api/v1/finance/capital-flows"),
    ]);

    return NextResponse.json(
      { ok: true, carbonPrices, greenBonds, capitalFlows, asOf: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[terminal/finance]", err);
    return NextResponse.json({ ok: false, error: "Engine unavailable" }, { status: 503 });
  }
}
