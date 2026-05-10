/**
 * Redis cache utility (server-only).
 *
 * Provides a thin wrapper around ioredis. When Redis is unavailable,
 * every operation silently no-ops so the application stays functional.
 *
 * Production: set REDIS_URL in your environment.
 * Development: uses the Docker Compose default.
 *
 * Install: npm install ioredis @types/ioredis
 */

type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, expiryMode?: string, time?: number) => Promise<unknown>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  quit: () => Promise<string>;
};

let _client: RedisClient | null = null;
let _connectAttempted = false;

function getClient(): RedisClient | null {
  if (_connectAttempted) return _client;
  _connectAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis");
    const client = new IORedis(
      process.env.REDIS_URL ?? "redis://localhost:6379/0",
      { lazyConnect: true, maxRetriesPerRequest: 1, enableReadyCheck: false }
    );
    client.on("error", () => { _client = null; });
    _client = client;
    return _client;
  } catch {
    return null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await getClient()?.get(key) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds = 60
): Promise<void> {
  try {
    await getClient()?.set(key, value, "EX", ttlSeconds);
  } catch {
    // silently degrade
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient()?.del(key);
  } catch {
    // silently degrade
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds = 60
): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}
