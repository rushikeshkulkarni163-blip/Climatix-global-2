import { NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

// Server-side proxy to intelligence_engine's Earth Observation Data Source
// Registry — the browser never talks to Copernicus/NASA/USGS or holds
// their credentials (spec §10). Mirrors src/app/api/terminal/finance/route.ts.
export async function GET() {
  try {
    const res = await fetch(`${ENGINE}/api/v1/earth-observation/sources`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Engine ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[earth-observation/sources]", err);
    return NextResponse.json(
      { ok: false, error: "Earth observation data temporarily unavailable." },
      { status: 503 }
    );
  }
}
