import { NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${ENGINE}/api/v1/earth-observation/assets/${params.id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(`Engine ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[earth-observation/assets/:id]", err);
    return NextResponse.json(
      { ok: false, error: "Earth observation data temporarily unavailable." },
      { status: 503 }
    );
  }
}
