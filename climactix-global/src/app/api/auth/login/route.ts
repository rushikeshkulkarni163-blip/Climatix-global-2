import { NextRequest, NextResponse } from "next/server";
import { signToken, getPermissionsForRole } from "@/lib/auth/jwt";
import { findUserByEmail, verifyPassword, storedToPublicUser, touchLastLogin } from "@/lib/auth/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
    }

    const stored = findUserByEmail(email);
    if (!stored || !verifyPassword(stored, password)) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const permissions = getPermissionsForRole(stored.role);
    const token = await signToken({
      sub: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      plan: stored.plan,
      permissions,
    });

    touchLastLogin(stored.id);
    const user = storedToPublicUser(stored);
    const response = NextResponse.json({ success: true, user, token }, { status: 200 });

    // httpOnly cookie for SSR-protected routes
    response.cookies.set("climactix_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400, // 24h
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
