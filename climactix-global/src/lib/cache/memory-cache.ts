/**
 * In-process TTL cache — zero dependencies.
 *
 * Semantically identical to the Redis wrapper so switching to Redis
 * in production requires only replacing the import in each API route.
 *
 * Entries are evicted lazily on read + proactively via a 60-second
 * sweep timer so memory stays bounded even under heavy traffic.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, Entry<unknown>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(sweepIntervalMs = 60_000) {
    if (typeof globalThis.setInterval !== "undefined") {
      this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
      // Allow process to exit even with the timer running
      if (this.sweepTimer?.unref) this.sweepTimer.unref();
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlSeconds = 60): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  flush(): void {
    this.store.clear();
  }

  private sweep(): void {
    const now = Date.now();
    this.store.forEach((entry, k) => {
      if (now > entry.expiresAt) this.store.delete(k);
    });
  }
}

// Singleton — shared across all API routes in the same Node.js process
const globalForCache = globalThis as typeof globalThis & { _climactixCache?: MemoryCache };
if (!globalForCache._climactixCache) globalForCache._climactixCache = new MemoryCache();
const cache = globalForCache._climactixCache;

export function cacheGet<T>(key: string): T | null {
  return cache.get<T>(key);
}

export function cacheSet<T>(key: string, value: T, ttlSeconds = 60): void {
  cache.set(key, value, ttlSeconds);
}

export function cacheDel(key: string): void {
  cache.del(key);
}

export function cacheGetJson<T>(key: string): T | null {
  return cache.get<T>(key);
}

export function cacheSetJson<T>(key: string, value: T, ttlSeconds = 60): void {
  cache.set(key, value, ttlSeconds);
}
