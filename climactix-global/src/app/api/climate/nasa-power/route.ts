import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat") ?? "40.71";
  const lng = searchParams.get("lng") ?? "-74.01";
  const endYear = new Date().getFullYear() - 1;

  try {
    const res = await fetch(
      `https://power.larc.nasa.gov/api/temporal/climatology/point` +
        `?parameters=ALLSKY_SFC_SW_DWN,WS2M,T2M,RH2M` +
        `&community=RE&longitude=${lng}&latitude=${lat}&format=JSON` +
        `&start=${endYear - 2}&end=${endYear}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`NASA POWER returned ${res.status}`);
    const data = await res.json() as { properties?: { parameter?: Record<string, Record<string, number>> } };

    const props = data?.properties?.parameter ?? {};
    const avg = (obj: Record<string, number>) =>
      Object.values(obj).reduce((a, b) => a + b, 0) / Math.max(Object.values(obj).length, 1);

    return NextResponse.json(
      {
        success: true,
        data: {
          solarRadiation: avg(props.ALLSKY_SFC_SW_DWN ?? {}),
          windSpeed: avg(props.WS2M ?? {}),
          temperature: avg(props.T2M ?? {}),
          humidity: avg(props.RH2M ?? {}),
        },
      },
      { headers: corsHeaders() }
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        synthetic: true,
        data: { solarRadiation: 4.2, windSpeed: 5.1, temperature: 18, humidity: 65 },
      },
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
