import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const country = searchParams.get("country") ?? "USA";

  try {
    const res = await fetch(
      `https://api.reliefweb.int/v1/disasters?` +
        `filter[field]=country.iso3&filter[value]=${country}` +
        `&limit=20&sort[]=date:desc` +
        `&fields[include][]=name&fields[include][]=type` +
        `&fields[include][]=date&fields[include][]=status&fields[include][]=country`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`ReliefWeb returned ${res.status}`);
    const data = await res.json() as {
      data: {
        id: string;
        fields: {
          name: string;
          type?: { name: string }[];
          date?: { event?: string };
          status?: string;
        };
      }[];
    };

    const events = (data?.data ?? []).map((d) => ({
      id: d.id,
      name: d.fields.name,
      type: d.fields.type?.[0]?.name ?? "Unknown",
      country,
      date: d.fields.date?.event ?? "",
      status: d.fields.status ?? "past",
    }));

    return NextResponse.json({ success: true, data: events }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { success: true, data: SYNTHETIC_DISASTERS[country] ?? SYNTHETIC_DISASTERS["USA"], synthetic: true },
      { headers: corsHeaders() }
    );
  }
}

const SYNTHETIC_DISASTERS: Record<string, { id: string; name: string; type: string; date: string; status: string }[]> = {
  USA: [
    { id: "1", name: "Hurricane Idalia 2023", type: "Cyclone", date: "2023-08-30", status: "past" },
    { id: "2", name: "California Wildfires 2023", type: "Fire", date: "2023-09-01", status: "past" },
    { id: "3", name: "Vermont Flooding 2023", type: "Flood", date: "2023-07-12", status: "past" },
  ],
  IND: [
    { id: "4", name: "Cyclone Biparjoy 2023", type: "Cyclone", date: "2023-06-15", status: "past" },
    { id: "5", name: "Himachal Pradesh Floods 2023", type: "Flood", date: "2023-07-10", status: "past" },
  ],
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=3600",
  };
}
