import { NextResponse } from "next/server";
import { cacheGetJson, cacheSetJson } from "@/lib/cache/memory-cache";
import type { TickerItem } from "@/types/live";

const CACHE_KEY = "live:ticker";
const CACHE_TTL = 45;

const BASE_TICKER: TickerItem[] = [
  { id: "co2", label: "CO₂ Concentration", value: "424.7 ppm", dir: "up", category: "carbon", priority: "high", source: "NOAA GML" },
  { id: "temp_anomaly", label: "Global Avg Temp Anomaly", value: "+1.48°C", dir: "up", category: "physical", priority: "critical", source: "NASA GISS" },
  { id: "arctic_ice", label: "Arctic Sea Ice Loss", value: "-13%/decade", dir: "down", category: "physical", priority: "high", source: "NSIDC" },
  { id: "sea_level", label: "Sea Level Rise", value: "+3.7mm/yr", dir: "up", category: "physical", priority: "high", source: "Copernicus" },
  { id: "carbon_budget", label: "Global Carbon Budget Remaining", value: "~380 GtCO₂", dir: "down", category: "carbon", priority: "critical", source: "IPCC AR6" },
  { id: "renewable", label: "Renewable Energy Share", value: "30.3% global", dir: "up", category: "economic", priority: "medium", source: "IEA" },
  { id: "climate_finance", label: "Climate Finance Gap", value: "$4.3T/year needed", dir: "up", category: "economic", priority: "high", source: "UNEP" },
  { id: "extreme_weather", label: "Extreme Weather Events", value: "+5× since 1970", dir: "up", category: "physical", priority: "critical", source: "WMO" },
];

async function buildLiveTicker(): Promise<{ items: TickerItem[]; latestAlert?: TickerItem }> {
  const items = [...BASE_TICKER];

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const metricsRes = await fetch(`${origin}/api/live/metrics`, { cache: "no-store" });
    if (metricsRes.ok) {
      const m = await metricsRes.json();
      const co2 = items.find((i) => i.id === "co2");
      if (co2 && m.co2ppm) { co2.value = `${m.co2ppm} ppm`; co2.timestamp = m.updatedAt; }
      const temp = items.find((i) => i.id === "temp_anomaly");
      if (temp && m.globalTempAnomaly) { temp.value = `+${m.globalTempAnomaly}°C`; temp.timestamp = m.updatedAt; }
      if (m.activeWildfires > 0) {
        items.push({
          id: `wildfire_${Date.now()}`,
          label: "Active Wildfire Events",
          value: `${Number(m.activeWildfires).toLocaleString()} events`,
          dir: m.activeWildfires > 900 ? "up" : "down",
          category: "physical",
          priority: m.activeWildfires > 900 ? "critical" : "high",
          source: "FIRMS/ReliefWeb",
          timestamp: m.updatedAt,
        });
      }
    }
  } catch { /* metrics fetch non-fatal */ }

  let latestAlert: TickerItem | undefined;
  try {
    const res = await fetch(
      "https://api.reliefweb.int/v1/disasters?filter[field]=status&filter[value]=ongoing&limit=1&sort[]=date:desc&fields[include][]=name&fields[include][]=type&fields[include][]=country",
      { next: { revalidate: 600 } }
    );
    const data = await res.json();
    const ev = data?.data?.[0];
    if (ev) {
      const typeName = ev.fields?.type?.[0]?.name ?? "Disaster";
      const country = ev.fields?.country?.[0]?.name ?? "";
      latestAlert = {
        id: `alert_${ev.id}`,
        label: `ALERT: ${typeName}`,
        value: `${ev.fields?.name ?? typeName}${country ? ` — ${country}` : ""}`,
        dir: "up",
        category: "physical",
        priority: "critical",
        source: "ReliefWeb",
        timestamp: new Date().toISOString(),
      };
    }
  } catch { /* alert fetch non-fatal */ }

  return { items, latestAlert };
}

export async function GET() {
  const cached = cacheGetJson<{ items: TickerItem[] }>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90" },
    });
  }

  const result = await buildLiveTicker();
  cacheSetJson(CACHE_KEY, result, CACHE_TTL);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90" },
  });
}
