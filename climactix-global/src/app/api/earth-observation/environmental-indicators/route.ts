import { NextRequest, NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

// Proxies NDVI/NDWI/LST for an asset or a lat/lng + buffer radius (spec §13).
// GISMap.tsx calls this when an Earth Observation layer is toggled on.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  try {
    const res = await fetch(
      `${ENGINE}/api/v1/earth-observation/environmental-indicators?${qs}`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Engine ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[earth-observation/environmental-indicators]", err);
    return NextResponse.json(
      { ok: false, error: "Earth observation data temporarily unavailable." },
      { status: 503 }
    );
  }
}
