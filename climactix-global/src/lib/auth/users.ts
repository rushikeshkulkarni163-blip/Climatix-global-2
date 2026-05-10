import crypto from "crypto";
import type { User, UserRole, Permission } from "@/types/auth";
import { getPermissionsForRole } from "./jwt";
import { findOne, findAll, insert, upsert, type BaseRecord } from "@/lib/db/file-store";

// ── Schema ────────────────────────────────────────────────────────────────────

export interface StoredUser extends BaseRecord {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  plan: "free" | "professional" | "enterprise";
  organization?: string;
  lastLoginAt?: string;
}

const COLLECTION = "users";

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "climactix_salt_v1")
    .digest("hex");
}

// ── Seed demo accounts on first run ──────────────────────────────────────────

function seedIfEmpty() {
  if (findAll<StoredUser>(COLLECTION).length > 0) return;

  const now = "2024-01-01T00:00:00.000Z";
  const seeds: Omit<StoredUser, "updatedAt">[] = [
    {
      id: crypto.randomUUID(),
      email: "admin@climactixglobal.com",
      name: "Climactix Admin",
      passwordHash: hashPassword("Climactix2024!"),
      role: "admin",
      plan: "enterprise",
      organization: "Climactix Global",
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      email: "analyst@climactixglobal.com",
      name: "Climate Analyst",
      passwordHash: hashPassword("Analyst2024!"),
      role: "analyst",
      plan: "professional",
      organization: "Climactix Global",
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      email: "demo@climactixglobal.com",
      name: "Demo User",
      passwordHash: hashPassword("Demo2024!"),
      role: "viewer",
      plan: "free",
      createdAt: now,
    },
  ];

  for (const seed of seeds) {
    insert<StoredUser>(COLLECTION, seed);
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
  return stored.passwordHash === hashPassword(password);
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
  return insert<StoredUser>(COLLECTION, {
    email,
    name: payload.name,
    passwordHash: hashPassword(payload.password),
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
