import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat") ?? "40.71";
  const lng = searchParams.get("lng") ?? "-74.01";

  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
        `&start_date=${startDate.toISOString().split("T")[0]}` +
        `&end_date=${endDate.toISOString().split("T")[0]}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
        `&timezone=auto`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = (await res.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        wind_speed_10m_max?: number[];
      };
    };
    return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
  } catch (err) {
    const syntheticData = generateSynthetic(parseFloat(lat));
    return NextResponse.json(
      { success: true, data: syntheticData, synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

function generateSynthetic(lat: number) {
  const baseTemp = 25 - Math.abs(lat) * 0.4;
  const time: string[] = [];
  const tmax: number[] = [];
  const tmin: number[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    time.push(d.toISOString().split("T")[0]);
    const seasonal = Math.sin((d.getMonth() / 12) * Math.PI * 2) * 8;
    const noise = (Math.random() - 0.5) * 4;
    tmax.push(+(baseTemp + seasonal + noise + 3).toFixed(1));
    tmin.push(+(baseTemp + seasonal + noise - 3).toFixed(1));
  }
  return { daily: { time, temperature_2m_max: tmax, temperature_2m_min: tmin } };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
  };
}
