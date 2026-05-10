import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload, User, Permission } from "@/types/auth";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "climactix-jwt-secret-replace-in-production-min-32-chars"
);

const ALG = "HS256";
const EXPIRY = "24h";

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .setIssuer("climactix-global")
    .setAudience("climactix-platform")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: "climactix-global",
      audience: "climactix-platform",
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function jwtPayloadToUser(payload: JWTPayload): User {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    plan: payload.plan as User["plan"],
    permissions: payload.permissions as Permission[],
    createdAt: new Date(payload.iat * 1000).toISOString(),
  };
}

// ── Role permission matrix ────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "terminal:read", "terminal:write", "simulation:run", "risk:full",
    "portfolio:manage", "admin:content", "admin:users", "reports:generate",
    "api:access", "esg:scanner",
  ],
  analyst: [
    "terminal:read", "simulation:run", "risk:full", "portfolio:manage",
    "reports:generate", "esg:scanner",
  ],
  enterprise: [
    "terminal:read", "simulation:run", "risk:full", "portfolio:manage",
    "reports:generate", "api:access", "esg:scanner",
  ],
  viewer: ["terminal:read", "esg:scanner"],
};

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["viewer"];
}
