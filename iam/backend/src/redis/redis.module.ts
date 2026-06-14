import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('redis.url')!;
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 100, 3000),
          lazyConnect: true,
          enableReadyCheck: true,
          keepAlive: 10000,
        });
        client.on('error', (err) => console.error('[Redis] Connection error:', err.message));
        client.on('ready', () => console.log('[Redis] Connected'));
        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
