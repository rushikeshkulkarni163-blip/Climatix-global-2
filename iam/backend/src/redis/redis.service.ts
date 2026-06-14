import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.redis.hdel(key, ...fields);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    await this.redis.sadd(key, ...members);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.redis.sismember(key, member)) === 1;
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    await this.redis.srem(key, ...members);
  }

  // Session blacklist helpers
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:jwt:${jti}`, '1', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.exists(`blacklist:jwt:${jti}`);
  }

  // Rate limiting helpers
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
    const count = await this.incrWithExpiry(`rl:${key}`, windowSeconds);
    const remaining = Math.max(0, limit - count);
    const retryAfter = count > limit ? await this.ttl(`rl:${key}`) : 0;
    return { allowed: count <= limit, remaining, retryAfter };
  }

  // MFA challenge storage
  async storeMfaChallenge(challengeId: string, payload: object, ttlSeconds = 300): Promise<void> {
    await this.set(`mfa:challenge:${challengeId}`, JSON.stringify(payload), ttlSeconds);
  }

  async getMfaChallenge(challengeId: string): Promise<object | null> {
    const raw = await this.get(`mfa:challenge:${challengeId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async deleteMfaChallenge(challengeId: string): Promise<void> {
    await this.del(`mfa:challenge:${challengeId}`);
  }

  // CSRF token helpers
  async storecsrf(sessionId: string, token: string, ttlSeconds = 3600): Promise<void> {
    await this.set(`csrf:${sessionId}`, token, ttlSeconds);
  }

  async verifycsrf(sessionId: string, token: string): Promise<boolean> {
    const stored = await this.get(`csrf:${sessionId}`);
    return stored === token;
  }
}
