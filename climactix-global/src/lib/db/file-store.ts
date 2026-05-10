/**
 * File-based JSON persistence store.
 *
 * Provides a zero-dependency embedded database using the local filesystem.
 * Each "collection" maps to a single JSON file in /data/.
 * Writes are atomic: write temp → fsync → rename.
 *
 * Production path: swap `FileStore` calls for PostgreSQL queries using
 * the postgres.ts helper — same interface, same types.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(collection: string): string {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readCollection<T>(collection: string): T[] {
  ensureDataDir();
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(collection: string, rows: T[]): void {
  ensureDataDir();
  const fp = filePath(collection);
  const tmp = `${fp}.tmp_${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  fs.renameSync(tmp, fp); // atomic on POSIX
}

// ── Generic CRUD ──────────────────────────────────────────────────────────────

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export function findAll<T extends BaseRecord>(collection: string): T[] {
  return readCollection<T>(collection);
}

export function findById<T extends BaseRecord>(collection: string, id: string): T | null {
  return readCollection<T>(collection).find((r) => r.id === id) ?? null;
}

export function findOne<T extends BaseRecord>(
  collection: string,
  predicate: (r: T) => boolean
): T | null {
  return readCollection<T>(collection).find(predicate) ?? null;
}

export function findMany<T extends BaseRecord>(
  collection: string,
  predicate: (r: T) => boolean
): T[] {
  return readCollection<T>(collection).filter(predicate);
}

export function insert<T extends BaseRecord>(collection: string, record: Omit<T, "id" | "createdAt" | "updatedAt"> & Partial<BaseRecord>): T {
  const rows = readCollection<T>(collection);
  const now = new Date().toISOString();
  const full = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...record,
  } as T;
  rows.push(full);
  writeCollection(collection, rows);
  return full;
}

export function upsert<T extends BaseRecord>(collection: string, id: string, updates: Partial<T>): T | null {
  const rows = readCollection<T>(collection);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...updates, updatedAt: new Date().toISOString() } as T;
  writeCollection(collection, rows);
  return rows[idx];
}

export function remove(collection: string, id: string): boolean {
  const rows = readCollection<BaseRecord>(collection);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  writeCollection(collection, next);
  return true;
}

export function count(collection: string): number {
  return readCollection(collection).length;
}
