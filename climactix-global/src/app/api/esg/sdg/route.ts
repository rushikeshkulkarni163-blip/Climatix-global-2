import { NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET() {
  try {
    const res = await fetch(
      "https://unstats.un.org/SDGAPI/v1/sdg/Indicator/List",
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error("SDG API failed");
    const data = await res.json() as unknown[];
    return NextResponse.json({ success: true, data: data.slice(0, 30) }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: true, data: CLIMATE_SDGS, synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

const CLIMATE_SDGS = [
  { goal: 7, target: "7.2", indicator: "7.2.1", description: "Renewable energy share in total final energy consumption" },
  { goal: 7, target: "7.3", indicator: "7.3.1", description: "Energy intensity measured in terms of primary energy and GDP" },
  { goal: 13, target: "13.1", indicator: "13.1.1", description: "Number of deaths, missing persons attributed to disasters" },
  { goal: 13, target: "13.2", indicator: "13.2.2", description: "Total greenhouse gas emissions per year" },
  { goal: 15, target: "15.1", indicator: "15.1.1", description: "Forest area as a proportion of total land area" },
  { goal: 6, target: "6.4", indicator: "6.4.2", description: "Level of water stress: freshwater withdrawal" },
  { goal: 11, target: "11.b", indicator: "11.b.1", description: "Sendai Framework for DRR adoption" },
  { goal: 12, target: "12.c", indicator: "12.c.1", description: "Amount of fossil-fuel subsidies per unit of GDP" },
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=86400",
  };
}
