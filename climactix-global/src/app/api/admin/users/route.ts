import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getAllUsers } from "@/lib/auth/users";

async function requireAdmin(req: NextRequest) {
  const token =
    req.cookies.get("climactix_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  const users = getAllUsers().map(({ passwordHash: _, ...u }) => u);
  return NextResponse.json({ users, total: users.length });
}
