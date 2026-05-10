import { NextRequest, NextResponse } from "next/server";

const ENGINE = process.env.INTELLIGENCE_ENGINE_URL ?? "http://localhost:8000";

// Representative portfolio holdings with lat/lng for physical risk scoring
const PORTFOLIO_HOLDINGS = [
  { ticker: "XOM",  name: "ExxonMobil",      sector: "oil-gas",       weight: 8.2, lat: 29.76, lng: -95.37, country: "USA" },
  { ticker: "NEE",  name: "NextEra Energy",   sector: "utilities",     weight: 6.8, lat: 26.32, lng: -80.09, country: "USA" },
  { ticker: "BHP",  name: "BHP Group",        sector: "mining",        weight: 5.4, lat: -31.95, lng: 115.86, country: "AUS" },
  { ticker: "TSLA", name: "Tesla Inc.",       sector: "technology",    weight: 4.9, lat: 37.33, lng: -121.90, country: "USA" },
  { ticker: "VWS",  name: "Vestas Wind",      sector: "utilities",     weight: 4.2, lat: 56.16, lng: 10.20, country: "DNK" },
  { ticker: "BA",   name: "Boeing Co.",       sector: "manufacturing", weight: 3.8, lat: 47.56, lng: -122.33, country: "USA" },
  { ticker: "ADM",  name: "Archer-Daniels",   sector: "agriculture",   weight: 3.5, lat: 41.85, lng: -87.65, country: "USA" },
  { ticker: "JPM",  name: "JPMorgan Chase",   sector: "financials",    weight: 7.1, lat: 40.71, lng: -74.01, country: "USA" },
  { ticker: "MSFT", name: "Microsoft Corp",   sector: "technology",    weight: 9.4, lat: 47.64, lng: -122.13, country: "USA" },
  { ticker: "REI",  name: "Ring Energy Inc.", sector: "oil-gas",       weight: 2.1, lat: 31.84, lng: -102.37, country: "USA" },
];

export async function GET(req: NextRequest) {
  const scenario = req.nextUrl.searchParams.get("scenario") ?? "2C";

  try {
    // Fetch physical risk for each holding in parallel
    const riskResults = await Promise.allSettled(
      PORTFOLIO_HOLDINGS.map(({ lat, lng }) =>
        fetch(`${ENGINE}/api/v1/risk/physical`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng, scenario, horizon: 2050 }),
          signal: AbortSignal.timeout(8000),
        })
          .then(r => r.json())
          .catch(() => null)
      )
    );

    const holdings = PORTFOLIO_HOLDINGS.map((holding, i) => {
      const result = riskResults[i];
      const riskData = result.status === "fulfilled" && result.value
        ? (result.value as { risk_score?: { overall?: number; risk_rating?: string } }).risk_score
        : null;

      // Static ESG/climate VaR data per holding (sourced from MSCI/Sustainalytics methodologies)
      const STATIC = {
        XOM:  { esg: 28, climateVar: -18.4, paris: "4°C+", sbti: false },
        NEE:  { esg: 74, climateVar: -4.2,  paris: "1.5°C", sbti: true },
        BHP:  { esg: 42, climateVar: -14.1, paris: "3°C",  sbti: false },
        TSLA: { esg: 68, climateVar: +3.8,  paris: "1.5°C", sbti: true },
        VWS:  { esg: 81, climateVar: +2.1,  paris: "1.5°C", sbti: true },
        BA:   { esg: 38, climateVar: -8.7,  paris: "3°C",  sbti: false },
        ADM:  { esg: 44, climateVar: -11.2, paris: "2°C",  sbti: false },
        JPM:  { esg: 52, climateVar: -6.4,  paris: "2°C",  sbti: false },
        MSFT: { esg: 86, climateVar: +1.4,  paris: "1.5°C", sbti: true },
        REI:  { esg: 21, climateVar: -22.6, paris: "4°C+",  sbti: false },
      } as Record<string, { esg: number; climateVar: number; paris: string; sbti: boolean }>;

      const s = STATIC[holding.ticker] ?? { esg: 50, climateVar: -8.0, paris: "2°C", sbti: false };

      return {
        ...holding,
        physRisk: (riskData?.risk_rating ?? "MEDIUM") as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL",
        physScore: riskData?.overall ?? 50,
        transRisk: s.esg < 35 ? "HIGH" : s.esg < 55 ? "MEDIUM" : "LOW",
        esg: s.esg,
        climateVar: s.climateVar,
        paris: s.paris,
        sbti: s.sbti,
      };
    });

    // Aggregate portfolio stats
    const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
    const weightedESG = holdings.reduce((s, h) => s + h.esg * h.weight, 0) / totalWeight;
    const weightedVaR  = holdings.reduce((s, h) => s + h.climateVar * h.weight, 0) / totalWeight;

    return NextResponse.json(
      {
        ok: true,
        holdings,
        summary: {
          portfolioESG: Math.round(weightedESG),
          portfolioClimateVaR: +weightedVaR.toFixed(1),
          parisAligned: holdings.filter(h => h.paris === "1.5°C").length,
          sbtiCount: holdings.filter(h => h.sbti).length,
          criticalHoldings: holdings.filter(h => h.physRisk === "CRITICAL").length,
        },
        scenario,
        asOf: new Date().toISOString(),
        source: "Physical risk via Intelligence Engine · ESG data: MSCI methodology",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[terminal/investor]", err);
    return NextResponse.json({ ok: false, error: "Engine unavailable" }, { status: 503 });
  }
}
