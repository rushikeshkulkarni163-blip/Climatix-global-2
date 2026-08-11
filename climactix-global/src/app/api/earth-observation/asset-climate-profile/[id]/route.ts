import { NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

// Spec §19: full asset drill-down — map, source, date, historical trend,
// methodology, confidence, physical risk — in one call for the company/asset page.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(
      `${ENGINE}/api/v1/earth-observation/asset-climate-profile/${params.id}`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (res.status === 404) {
      return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(`Engine ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[earth-observation/asset-climate-profile]", err);
    return NextResponse.json(
      { ok: false, error: "Earth observation data temporarily unavailable." },
      { status: 503 }
    );
  }
}
