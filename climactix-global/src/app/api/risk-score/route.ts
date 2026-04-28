import { NextRequest, NextResponse } from "next/server";
import { calculateRiskScore } from "@/lib/scoring/riskEngine";
import type { AssessmentFormData } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssessmentFormData;

    if (!body.companyProfile?.industry) {
      return NextResponse.json({ success: false, error: "Industry is required" }, { status: 400 });
    }

    const score = calculateRiskScore(body);
    return NextResponse.json({ success: true, data: score }, { headers: corsHeaders() });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to calculate risk score" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
