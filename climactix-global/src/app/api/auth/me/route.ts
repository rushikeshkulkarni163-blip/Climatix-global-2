import { NextRequest, NextResponse } from "next/server";
import { verifyToken, jwtPayloadToUser } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  const token =
    req.cookies.get("climactix_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, error: "Invalid or expired token" }, { status: 401 });
  }

  const user = jwtPayloadToUser(payload);
  return NextResponse.json({ authenticated: true, user, token });
}
