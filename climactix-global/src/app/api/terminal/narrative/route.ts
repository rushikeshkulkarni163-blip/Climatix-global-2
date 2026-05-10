import { NextRequest, NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

async function get(path: string) {
  const res = await fetch(`${ENGINE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Engine ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") ?? "ESG";

  try {
    const [pulse, calendar, sentiment] = await Promise.all([
      get("/api/v1/narrative/topics/pulse?limit=10"),
      get("/api/v1/narrative/regulatory-calendar?region=all"),
      get(`/api/v1/narrative/sentiment?query=${encodeURIComponent(query)}&sources=all&window_days=30`),
    ]);

    return NextResponse.json(
      { ok: true, pulse, calendar, sentiment, asOf: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[terminal/narrative]", err);
    return NextResponse.json({ ok: false, error: "Engine unavailable" }, { status: 503 });
  }
}
