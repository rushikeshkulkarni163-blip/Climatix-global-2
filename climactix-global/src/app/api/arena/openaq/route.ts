import { NextRequest, NextResponse } from "next/server";

/**
 * Ground-monitor air quality near a point via OpenAQ v3 (includes India CPCB
 * CAAQMS stations). The API key stays server-side (OPENAQ_API_KEY).
 * Never substitutes values: no key, no stations or stale readings are reported
 * as such, with timestamps.
 */
export const dynamic = "force-dynamic";

const BASE = "https://api.openaq.org/v3";

interface Sensor { id: number; parameter: { name: string; units: string; displayName?: string } }
interface Location {
  id: number; name: string; locality: string | null; distance?: number;
  provider?: { name: string }; owner?: { name: string };
  coordinates: { latitude: number; longitude: number };
  sensors: Sensor[]; datetimeLast?: { utc: string } | null;
}
interface Latest { value: number; datetime: { utc: string; local: string }; sensorsId: number }

export async function GET(req: NextRequest) {
  const key = process.env.OPENAQ_API_KEY;
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  if (!key) {
    return NextResponse.json({ configured: false, stations: [], message: "Ground-monitor network not connected: set OPENAQ_API_KEY on the server." });
  }
  const headers = { "X-API-Key": key, Accept: "application/json" };
  try {
    const r = await fetch(`${BASE}/locations?coordinates=${lat.toFixed(4)},${lon.toFixed(4)}&radius=25000&limit=8`, { headers, next: { revalidate: 600 } });
    if (!r.ok) return NextResponse.json({ configured: true, stations: [], message: `OpenAQ returned ${r.status}` }, { status: 502 });
    const locs = ((await r.json()) as { results: Location[] }).results ?? [];
    const stations = await Promise.all(locs.slice(0, 5).map(async (loc) => {
      const lr = await fetch(`${BASE}/locations/${loc.id}/latest`, { headers, next: { revalidate: 600 } });
      const latest = lr.ok ? (((await lr.json()) as { results: Latest[] }).results ?? []) : [];
      const readings = latest.map((x) => {
        const s = loc.sensors.find((y) => y.id === x.sensorsId);
        return s ? { parameter: s.parameter.name, label: s.parameter.displayName ?? s.parameter.name, units: s.parameter.units, value: x.value, utc: x.datetime.utc } : null;
      }).filter(Boolean);
      return {
        id: loc.id, name: loc.name, locality: loc.locality, provider: loc.provider?.name ?? null, owner: loc.owner?.name ?? null,
        lat: loc.coordinates.latitude, lon: loc.coordinates.longitude, distanceM: loc.distance ?? null,
        lastUpdated: loc.datetimeLast?.utc ?? null, readings,
      };
    }));
    return NextResponse.json({ configured: true, stations, fetched: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ configured: true, stations: [], message: `OpenAQ request failed: ${String((e as Error).message)}` }, { status: 502 });
  }
}
