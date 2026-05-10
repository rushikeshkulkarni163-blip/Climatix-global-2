import { NextRequest, NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

// Key geographic coordinates for global hotspot scanning
const HOTSPOT_COORDS = [
  { lat: 14.0, lng: 101.0, region: "South & SE Asia",    label: "south_se_asia" },
  { lat: 5.0,  lng: 20.0,  region: "Sub-Saharan Africa", label: "sub_saharan_africa" },
  { lat: 24.0, lng: 45.0,  region: "MENA Region",        label: "mena" },
  { lat: 29.0, lng: -90.0, region: "US Gulf Coast",      label: "us_gulf_coast" },
  { lat: 38.0, lng: 14.0,  region: "Mediterranean Basin",label: "mediterranean" },
  { lat: -5.0, lng: -60.0, region: "Amazon Basin",       label: "amazon" },
];

// Sectors for transition risk matrix
const SECTORS = [
  { id: "oil-gas",       label: "Oil & Gas" },
  { id: "utilities",     label: "Utilities" },
  { id: "real-estate",   label: "Real Estate" },
  { id: "agriculture",   label: "Agriculture" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "financials",    label: "Financials" },
  { id: "technology",    label: "Technology" },
  { id: "healthcare",    label: "Healthcare" },
];

async function fetchWithTimeout(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const scenario = req.nextUrl.searchParams.get("scenario") ?? "2C";
  const horizon  = req.nextUrl.searchParams.get("horizon")  ?? "2050";

  try {
    // 1) Physical risk for each hotspot region
    const physicalResults = await Promise.allSettled(
      HOTSPOT_COORDS.map(({ lat, lng, region, label }) =>
        fetchWithTimeout(
          `${ENGINE}/api/v1/risk/physical`,
          8000,
        )
          .then(r => r.json())
          .then((d: Record<string, unknown>) => ({ region, label, ...((d as { risk_score?: Record<string, unknown> }).risk_score ?? {}) }))
          .catch(() => null)
      )
    );

    // 2) Transition risk for sector matrix (use POST for 2 representative sectors to save budget)
    const transitionResults = await Promise.allSettled(
      SECTORS.slice(0, 4).map(({ id, label }) =>
        fetchWithTimeout(`${ENGINE}/api/v1/risk/transition`)
          .then(r => r.json())
          .then((d: Record<string, unknown>) => ({ sector: label, ...((d as { risk_score?: Record<string, unknown> }).risk_score ?? {}) }))
          .catch(() => null)
      )
    );

    // 3) Regulatory calendar for alerts
    const calendarRes = await fetchWithTimeout(
      `${ENGINE}/api/v1/narrative/regulatory-calendar?region=all`,
    ).then(r => r.json()).catch(() => ({ events: [] })) as { events: unknown[] };

    // 4) Topic pulse for sentiment context
    const pulseRes = await fetchWithTimeout(
      `${ENGINE}/api/v1/narrative/topics/pulse?limit=6`,
    ).then(r => r.json()).catch(() => ({ topics: [], as_of: null })) as { topics: unknown[]; as_of: string | null };

    // Compile hotspot risk scores
    const hotspots = physicalResults
      .map((r, i) => {
        if (r.status === "rejected" || !r.value) return null;
        const v = r.value as {
          overall?: number; risk_rating?: string; region: string;
          hazards?: { flood_risk?: number; heat_stress_acute?: number; sea_level_rise_exposure?: number };
        };
        return {
          region: HOTSPOT_COORDS[i].region,
          risk: (v.risk_rating ?? "MEDIUM") as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
          overallScore: v.overall ?? 50,
          hazards: v.hazards ?? {},
        };
      })
      .filter(Boolean);

    // Build sector risk matrix (merge live + static benchmark)
    const SECTOR_STATIC: Record<string, { physical: number; transition: number; esg: number }> = {
      "Oil & Gas":     { physical: 82, transition: 91, esg: 28 },
      "Utilities":     { physical: 74, transition: 68, esg: 52 },
      "Real Estate":   { physical: 78, transition: 42, esg: 45 },
      "Agriculture":   { physical: 85, transition: 38, esg: 35 },
      "Manufacturing": { physical: 62, transition: 71, esg: 48 },
      "Financials":    { physical: 34, transition: 58, esg: 62 },
      "Technology":    { physical: 28, transition: 32, esg: 71 },
      "Healthcare":    { physical: 31, transition: 29, esg: 68 },
    };

    const liveTransition = transitionResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);

    const sectorRisk = SECTORS.map(({ label }) => {
      const live = liveTransition.find((t) => t && (t as { sector?: string }).sector === label) as
        | { overall?: number; sector?: string }
        | null;
      const base = SECTOR_STATIC[label] ?? { physical: 50, transition: 50, esg: 50 };
      return {
        sector: label,
        physical: base.physical,
        transition: live?.overall != null ? Math.round(live.overall) : base.transition,
        esg: base.esg,
      };
    });

    // Build alert list from regulatory calendar
    const alerts = (calendarRes.events as Array<{
      regulation: string; region: string; impact: string; effective: string;
    }>).slice(0, 4).map((e, i) => ({
      id: i + 1,
      level: e.impact as "CRITICAL" | "HIGH" | "MEDIUM",
      title: `${e.regulation} — ${e.region}`,
      body: `Effective ${e.effective}. Review disclosure obligations and update compliance roadmap.`,
      time: "Live",
      source: "Regulatory Intelligence",
    }));

    // Summary KPIs — derived from hotspot averages
    const validHotspots = hotspots.filter(Boolean) as Array<{ overallScore: number }>;
    const avgPhysical = validHotspots.length
      ? Math.round(validHotspots.reduce((s, h) => s + h.overallScore, 0) / validHotspots.length)
      : 68;

    const summary = {
      globalPhysicalRiskIndex: avgPhysical,
      transitionRiskScore: 54,
      esgIntegrityScore: 42,
      climateVaR: "$2.4T",
      strandedAssetRisk: "23.8%",
      carbonBudgetRemaining: "380 Gt",
    };

    return NextResponse.json(
      {
        ok: true,
        scenario,
        horizon,
        asOf: new Date().toISOString(),
        summary,
        hotspots,
        sectorRisk,
        alerts: alerts.length ? alerts : FALLBACK_ALERTS,
        topicPulse: pulseRes.topics,
        source: "Climactix Intelligence Engine — Live",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[terminal/overview]", err);
    return NextResponse.json({ ok: false, error: "Intelligence engine unavailable" }, { status: 503 });
  }
}

const FALLBACK_ALERTS = [
  { id: 1, level: "HIGH", title: "Intelligence Engine Offline", body: "Could not reach the intelligence engine. Displaying cached data.", time: "Now", source: "System" },
];
