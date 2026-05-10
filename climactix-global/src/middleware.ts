import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

const PROTECTED_ROUTES = ["/admin"];
const AUTH_REQUIRED_ROUTES = ["/terminal", "/simulation", "/portfolio", "/risk-analysis"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((p) => pathname.startsWith(p));
  const isAuthRequired = AUTH_REQUIRED_ROUTES.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthRequired) return NextResponse.next();

  const token =
    req.cookies.get("climactix_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    if (isProtected) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Auth-required routes: allow read-only access without login
    return NextResponse.next();
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("climactix_token");
    return res;
  }

  // Admin-only gate
  if (isProtected && payload.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Forward user info via headers for server components
  const res = NextResponse.next();
  res.headers.set("x-user-id", payload.sub);
  res.headers.set("x-user-role", payload.role);
  res.headers.set("x-user-email", payload.email);
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/terminal/:path*", "/simulation/:path*"],
};
