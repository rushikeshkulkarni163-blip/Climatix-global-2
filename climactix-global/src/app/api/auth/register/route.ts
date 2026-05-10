import { NextRequest, NextResponse } from "next/server";
import { signToken, getPermissionsForRole } from "@/lib/auth/jwt";
import { createUser, storedToPublicUser } from "@/lib/auth/users";
import type { StoredUser } from "@/lib/auth/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, organization } = body ?? {};

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const result = createUser({ email, password, name, organization });
    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    const stored = result as StoredUser;
    const permissions = getPermissionsForRole(stored.role);
    const token = await signToken({
      sub: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      plan: stored.plan,
      permissions,
    });

    const user = storedToPublicUser(stored);
    const response = NextResponse.json({ success: true, user, token }, { status: 201 });
    response.cookies.set("climactix_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
