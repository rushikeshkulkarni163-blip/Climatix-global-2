import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { configuration, validationSchema } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RbacModule } from './rbac/rbac.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuditModule } from './audit/audit.module';
import { EmailModule } from './email/email.module';
import { MfaModule } from './mfa/mfa.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: false, abortEarly: false },
    }),

    // Rate limiting — global throttler
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: config.get<number>('security.rateLimitWindowMs')! / 1000,
            limit: config.get<number>('security.rateLimitMax')!,
          },
          {
            name: 'auth',
            ttl: 60,
            limit: config.get<number>('security.authRateLimitMax')!,
          },
        ],
        storage: undefined,  // defaults to in-memory; swap for Redis in production
      }),
    }),

    // Infrastructure
    DatabaseModule,
    RedisModule,

    // Feature modules
    EmailModule,
    AuditModule,
    RbacModule,
    SessionsModule,
    MfaModule,
    SubscriptionsModule,
    UsersModule,
    OrganizationsModule,
    AuthModule,
    AdminModule,
  ],
  providers: [
    // Global rate-limit guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'api/v1/auth/google/callback', method: RequestMethod.GET },
        { path: 'api/v1/auth/microsoft/callback', method: RequestMethod.GET },
        { path: 'api/v1/auth/linkedin/callback', method: RequestMethod.GET },
        { path: 'api/v1/auth/saml/callback', method: RequestMethod.POST },
      )
      .forRoutes(
        { path: 'api/v1/auth/*', method: RequestMethod.POST },
        { path: 'api/v1/auth/*', method: RequestMethod.DELETE },
      );
  }
}
