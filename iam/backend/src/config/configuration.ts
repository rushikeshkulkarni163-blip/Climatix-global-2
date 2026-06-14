import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3100),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().default(20),

  // Redis
  REDIS_URL: Joi.string().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(64).required(),
  JWT_REFRESH_SECRET: Joi.string().min(64).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  JWT_REFRESH_REMEMBER_TTL: Joi.string().default('30d'),

  // Encryption
  ENCRYPTION_KEY: Joi.string().length(64).required(),  // 32-byte hex key for AES-256-GCM

  // SMTP
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  SMTP_FROM_NAME: Joi.string().default('Climactix Global'),
  SMTP_FROM_EMAIL: Joi.string().email().required(),

  // Social SSO
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_CLIENT_ID: Joi.string().optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_TENANT_ID: Joi.string().optional(),
  LINKEDIN_CLIENT_ID: Joi.string().optional(),
  LINKEDIN_CLIENT_SECRET: Joi.string().optional(),

  // Keycloak
  KEYCLOAK_URL: Joi.string().uri().optional(),
  KEYCLOAK_REALM: Joi.string().default('climactix'),
  KEYCLOAK_CLIENT_ID: Joi.string().optional(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().optional(),
  KEYCLOAK_ADMIN_USER: Joi.string().optional(),
  KEYCLOAK_ADMIN_PASS: Joi.string().optional(),

  // Security
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  COOKIE_DOMAIN: Joi.string().optional(),
  COOKIE_SECURE: Joi.boolean().default(false),
  BCRYPT_ROUNDS: Joi.number().default(12),
  MAX_LOGIN_ATTEMPTS: Joi.number().default(10),
  LOCKOUT_MINUTES: Joi.number().default(30),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(10),

  // App
  APP_URL: Joi.string().uri().required(),
  API_VERSION: Joi.string().default('v1'),
  ADMIN_INITIAL_EMAIL: Joi.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: Joi.string().optional(),
});

export const configuration = () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3100', 10),
  isProd: process.env.NODE_ENV === 'production',

  database: {
    url: process.env.DATABASE_URL!,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
  },

  redis: {
    url: process.env.REDIS_URL!,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    refreshRememberTtl: process.env.JWT_REFRESH_REMEMBER_TTL || '30d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY!,
  },

  smtp: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    fromName: process.env.SMTP_FROM_NAME || 'Climactix Global',
    fromEmail: process.env.SMTP_FROM_EMAIL!,
  },

  sso: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    },
  },

  keycloak: {
    url: process.env.KEYCLOAK_URL,
    realm: process.env.KEYCLOAK_REALM || 'climactix',
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    adminUser: process.env.KEYCLOAK_ADMIN_USER,
    adminPass: process.env.KEYCLOAK_ADMIN_PASS,
  },

  security: {
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    cookieDomain: process.env.COOKIE_DOMAIN,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '10', 10),
    lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '30', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },

  app: {
    url: process.env.APP_URL!,
    version: process.env.API_VERSION || 'v1',
  },
});
