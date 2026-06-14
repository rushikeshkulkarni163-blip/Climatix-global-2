import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './audit/audit.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });
  const config = app.get(ConfigService);

  const isProd = config.get<boolean>('isProd');
  const port = config.get<number>('port')!;
  const corsOrigins = config.get<string[]>('security.corsOrigins')!;
  const apiVersion = config.get<string>('app.version')!;

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  // ── Cookies & body parsing ────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix(`api/${apiVersion}`);

  // ── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // ── Serialization ─────────────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TransformInterceptor(),
    app.get(AuditInterceptor),
  );

  // ── Exception filter ──────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Climactix IAM API')
      .setDescription('Institutional Identity & Access Management — Climactix Global')
      .setVersion(apiVersion)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addCookieAuth('cx_access', { type: 'apiKey', in: 'cookie', name: 'cx_access' }, 'cookie-auth')
      .addTag('auth', 'Authentication & registration')
      .addTag('mfa', 'Multi-factor authentication')
      .addTag('sessions', 'Session management')
      .addTag('users', 'User management')
      .addTag('organizations', 'Organization & workspace management')
      .addTag('rbac', 'Role & permission management')
      .addTag('audit', 'Audit logs & security events')
      .addTag('admin', 'Super-admin operations')
      .addTag('subscriptions', 'Subscription & feature access')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('Swagger UI: http://localhost:' + port + '/api/docs');
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Climactix IAM Service running on port ${port} [${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
