import { NextResponse } from "next/server";

export const revalidate = 86400;

export async function GET() {
  try {
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,latlng,region,subregion,population,flags",
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`REST Countries returned ${res.status}`);
    const data = await res.json() as { name: { common: string } }[];
    const sorted = data.sort((a, b) => a.name.common.localeCompare(b.name.common));
    return NextResponse.json({ success: true, data: sorted }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: true, data: FALLBACK_COUNTRIES, synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

const FALLBACK_COUNTRIES = [
  { name: { common: "United States" }, cca2: "US", cca3: "USA", latlng: [37.09, -95.71], region: "Americas" },
  { name: { common: "United Kingdom" }, cca2: "GB", cca3: "GBR", latlng: [54.0, -2.0], region: "Europe" },
  { name: { common: "Germany" }, cca2: "DE", cca3: "DEU", latlng: [51.0, 9.0], region: "Europe" },
  { name: { common: "France" }, cca2: "FR", cca3: "FRA", latlng: [46.0, 2.0], region: "Europe" },
  { name: { common: "India" }, cca2: "IN", cca3: "IND", latlng: [20.0, 77.0], region: "Asia" },
  { name: { common: "China" }, cca2: "CN", cca3: "CHN", latlng: [35.0, 105.0], region: "Asia" },
  { name: { common: "Japan" }, cca2: "JP", cca3: "JPN", latlng: [36.0, 138.0], region: "Asia" },
  { name: { common: "Brazil" }, cca2: "BR", cca3: "BRA", latlng: [-10.0, -55.0], region: "Americas" },
  { name: { common: "Australia" }, cca2: "AU", cca3: "AUS", latlng: [-27.0, 133.0], region: "Oceania" },
  { name: { common: "Canada" }, cca2: "CA", cca3: "CAN", latlng: [60.0, -96.0], region: "Americas" },
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=86400",
  };
}
