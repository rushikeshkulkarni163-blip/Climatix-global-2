import { NextResponse } from "next/server";
import { cacheGetJson, cacheSetJson } from "@/lib/cache/memory-cache";
import type { ClimateAlert } from "@/types/live";

const CACHE_KEY = "live:alerts";
const CACHE_TTL = 120;

async function fetchAlerts(): Promise<ClimateAlert[]> {
  const alerts: ClimateAlert[] = [];
  try {
    const res = await fetch(
      "https://api.reliefweb.int/v1/disasters?filter[field]=status&filter[value]=ongoing&limit=10&sort[]=date:desc&fields[include][]=name&fields[include][]=type&fields[include][]=country&fields[include][]=date",
      { next: { revalidate: 120 } }
    );
    if (!res.ok) throw new Error("reliefweb fetch failed");
    const data = await res.json();
    for (const ev of data?.data ?? []) {
      const f = ev.fields ?? {};
      const typeName: string = f.type?.[0]?.name ?? "Unknown";
      const isWild = typeName.toLowerCase().includes("wild");
      const isCyc = ["cyclone", "hurricane", "typhoon"].some((t) => typeName.toLowerCase().includes(t));
      const alertType: ClimateAlert["type"] = isWild ? "wildfire" : isCyc ? "cyclone" : "flood";
      alerts.push({
        id: ev.id,
        type: alertType,
        severity: isWild || isCyc ? "high" : "medium",
        title: f.name ?? typeName,
        region: f.country?.[0]?.name ?? "Unknown",
        country: f.country?.[0]?.iso3,
        description: `Active ${typeName} event — ongoing monitoring`,
        timestamp: f.date?.event ?? new Date().toISOString(),
        source: "ReliefWeb OCHA",
        active: true,
      });
    }
  } catch {
    alerts.push({
      id: "fallback_1",
      type: "wildfire",
      severity: "high",
      title: "Elevated Wildfire Activity",
      region: "North America",
      description: "Above-average wildfire conditions across western regions",
      timestamp: new Date().toISOString(),
      source: "FIRMS",
      active: true,
    });
  }
  return alerts;
}

export async function GET() {
  const cached = cacheGetJson<ClimateAlert[]>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      { alerts: cached, count: cached.length, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240" } }
    );
  }

  const alerts = await fetchAlerts();
  cacheSetJson(CACHE_KEY, alerts, CACHE_TTL);

  return NextResponse.json(
    { alerts, count: alerts.length, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240" } }
  );
}
