import { NextRequest, NextResponse } from "next/server";
import type { ReportConfig } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReportConfig;
    if (!body.companyName) {
      return NextResponse.json({ success: false, error: "companyName required" }, { status: 400 });
    }
    // Server-side route just validates; actual PDF generation is client-side via jsPDF
    return NextResponse.json(
      {
        success: true,
        message: "Report configuration validated. Use client-side generator.",
        reportId: `CG-${Date.now().toString(36).toUpperCase()}`,
      },
      { headers: corsHeaders() }
    );
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
