import crypto from "crypto";
import type { User, UserRole, Permission } from "@/types/auth";
import { getPermissionsForRole } from "./jwt";
import { findOne, findAll, insert, upsert, type BaseRecord } from "@/lib/db/file-store";

// ── Schema ────────────────────────────────────────────────────────────────────

export interface StoredUser extends BaseRecord {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  plan: "free" | "professional" | "enterprise";
  organization?: string;
  lastLoginAt?: string;
}

const COLLECTION = "users";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function hashPassword(password: string, salt: string): string {
  // scrypt (OWASP recommended) with per-user random salt
  return crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Seed demo accounts on first run ──────────────────────────────────────────
// Seed passwords read from env — never stored in source code

function seedIfEmpty() {
  if (findAll<StoredUser>(COLLECTION).length > 0) return;

  const adminPw   = process.env.SEED_ADMIN_PASSWORD;
  const analystPw = process.env.SEED_ANALYST_PASSWORD;
  const demoPw    = process.env.SEED_DEMO_PASSWORD;

  if (!adminPw || !analystPw || !demoPw) {
    console.warn("[auth] Seed passwords not set — skipping demo account creation. Set SEED_ADMIN_PASSWORD, SEED_ANALYST_PASSWORD, SEED_DEMO_PASSWORD.");
    return;
  }

  const now = new Date().toISOString();
  const rawSeeds = [
    { email: "admin@climactixglobal.com",   name: "Climactix Admin", role: "admin"   as UserRole, plan: "enterprise"   as const, organization: "Climactix Global", pw: adminPw },
    { email: "analyst@climactixglobal.com", name: "Climate Analyst", role: "analyst" as UserRole, plan: "professional" as const, organization: "Climactix Global", pw: analystPw },
    { email: "demo@climactixglobal.com",    name: "Demo User",       role: "viewer"  as UserRole, plan: "free"         as const,                                   pw: demoPw },
  ];

  for (const s of rawSeeds) {
    const salt = generateSalt();
    insert<StoredUser>(COLLECTION, {
      id: crypto.randomUUID(), createdAt: now,
      email: s.email, name: s.name, role: s.role, plan: s.plan,
      organization: s.organization,
      salt,
      passwordHash: hashPassword(s.pw, salt),
    });
  }
}

// Run seed once per process
let _seeded = false;
function ensureSeeded() {
  if (_seeded) return;
  _seeded = true;
  seedIfEmpty();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function findUserByEmail(email: string): StoredUser | null {
  ensureSeeded();
  return findOne<StoredUser>(COLLECTION, (u) => u.email === email.toLowerCase());
}

export function findUserById(id: string): StoredUser | null {
  ensureSeeded();
  return findOne<StoredUser>(COLLECTION, (u) => u.id === id);
}

export function verifyPassword(stored: StoredUser, password: string): boolean {
  if (!stored.salt) return false;
  return crypto.timingSafeEqual(
    Buffer.from(stored.passwordHash, "hex"),
    Buffer.from(hashPassword(password, stored.salt), "hex")
  );
}

export function touchLastLogin(id: string): void {
  upsert<StoredUser>(COLLECTION, id, { lastLoginAt: new Date().toISOString() });
}

export function createUser(payload: {
  email: string;
  password: string;
  name: string;
  organization?: string;
  role?: UserRole;
}): StoredUser | { error: string } {
  ensureSeeded();
  const email = payload.email.toLowerCase();
  if (findOne<StoredUser>(COLLECTION, (u) => u.email === email)) {
    return { error: "Email already registered" };
  }
  if (payload.password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  const salt = generateSalt();
  return insert<StoredUser>(COLLECTION, {
    email,
    name: payload.name,
    salt,
    passwordHash: hashPassword(payload.password, salt),
    role: payload.role ?? "viewer",
    plan: "free",
    organization: payload.organization,
  });
}

export function getAllUsers(): StoredUser[] {
  ensureSeeded();
  return findAll<StoredUser>(COLLECTION).map((u) => ({
    ...u,
    passwordHash: "***",
  }));
}

export function storedToPublicUser(stored: StoredUser): User {
  return {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    plan: stored.plan,
    organization: stored.organization,
    permissions: getPermissionsForRole(stored.role) as Permission[],
    createdAt: stored.createdAt,
    lastLoginAt: stored.lastLoginAt,
  };
}
