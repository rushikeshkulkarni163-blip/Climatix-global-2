import {
  Injectable, UnauthorizedException, BadRequestException,
  ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import { RbacService } from '../rbac/rbac.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  userType: string;
  orgId?: string;
  roles: string[];
  permissions: string[];
  tier: string;
  sessionId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly sessionsService: SessionsService,
    private readonly rbacService: RbacService,
    private readonly orgsService: OrganizationsService,
  ) {}

  // ── Registration ─────────────────────────────────────────────────────────

  async register(dto: RegisterDto, ip: string, ua: string): Promise<{ message: string; userId: string }> {
    // Check for existing account
    const existing = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      // Constant-time response to prevent user enumeration
      await this.fakeHash();
      throw new ConflictException('An account with this email already exists.');
    }

    // Password policy
    this.enforcePasswordPolicy(dto.password);

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const cxUserId = await this.generateUserId();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create user
      const user = queryRunner.manager.create(User, {
        cxUserId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        userType: dto.userType || 'community',
        status: 'pending_verification',
        emailVerified: false,
      });
      const savedUser = await queryRunner.manager.save(User, user);

      // Assign default role
      await this.rbacService.assignDefaultRole(savedUser.id, savedUser.userType, queryRunner.manager);

      // Create organization if enterprise/investor type
      if (dto.organizationName && ['enterprise_client', 'investor', 'government'].includes(dto.userType || '')) {
        await this.orgsService.createAndLinkOrganization(savedUser, dto.organizationName, dto.userType as any, queryRunner.manager);
      }

      await queryRunner.commitTransaction();

      // Send verification email (outside transaction)
      await this.sendEmailVerification(savedUser.id, savedUser.email);

      await this.auditService.log({
        eventType: 'user.register',
        category: 'auth',
        actorId: savedUser.id,
        actorEmail: savedUser.email,
        action: `User registered with type ${dto.userType}`,
        outcome: 'success',
        ipAddress: ip,
        userAgent: ua,
      });

      return { message: 'Account created. Please verify your email.', userId: savedUser.id };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Registration failed', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ── Email Verification ───────────────────────────────────────────────────

  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.dataSource.query(
      `INSERT INTO verification_tokens (user_id, type, token_hash, expires_at)
       VALUES ($1, 'email_verification', $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, tokenHash, expiresAt],
    );

    const verifyUrl = `${this.config.get('app.url')}/auth/verify-email?token=${token}`;
    await this.emailService.sendEmailVerification(email, verifyUrl);
  }

  async verifyEmail(token: string, ip: string): Promise<TokenPair> {
    const tokenHash = this.sha256(token);

    const row = await this.dataSource.query(
      `SELECT vt.*, u.id as user_id, u.email, u.user_type, u.status, u.organization_id
       FROM verification_tokens vt
       JOIN users u ON u.id = vt.user_id
       WHERE vt.token_hash = $1
         AND vt.type = 'email_verification'
         AND vt.used = FALSE
         AND vt.expires_at > NOW()`,
      [tokenHash],
    );

    if (!row.length) throw new BadRequestException('Invalid or expired verification link.');

    const { user_id, email, user_type, organization_id } = row[0];

    await this.dataSource.query(
      `UPDATE verification_tokens SET used = TRUE, used_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
    await this.dataSource.query(
      `UPDATE users SET email_verified = TRUE, email_verified_at = NOW(), status = 'active', updated_at = NOW() WHERE id = $1`,
      [user_id],
    );

    await this.auditService.log({
      eventType: 'user.email_verified',
      category: 'auth',
      actorId: user_id,
      actorEmail: email,
      action: 'Email verified',
      outcome: 'success',
      ipAddress: ip,
    });

    return this.issueTokens(user_id, email, user_type, organization_id, ip, '');
  }

  // ── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, ip: string, ua: string): Promise<TokenPair | { mfaRequired: true; challengeId: string }> {
    const email = dto.email.toLowerCase();

    // Rate limit by IP + email
    const rlKey = `login:${ip}:${email}`;
    const rl = await this.redis.checkRateLimit(
      rlKey,
      this.config.get<number>('security.authRateLimitMax')!,
      60,
    );
    if (!rl.allowed) {
      throw new ForbiddenException(`Too many login attempts. Retry in ${rl.retryAfter}s.`);
    }

    const user = await this.usersRepo.findOne({ where: { email } });

    // Constant-time failure for user-not-found
    if (!user) {
      await this.fakeHash();
      await this.logLoginAttempt(email, ip, ua, 'user_not_found', null, null);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Account status checks
    if (user.status === 'pending_verification') {
      throw new ForbiddenException('Please verify your email before logging in.');
    }
    if (user.status === 'suspended') {
      throw new ForbiddenException('Your account has been suspended. Contact support.');
    }
    if (user.status === 'deactivated') {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(`Account locked. Retry in ${retryAfter}s.`);
    }

    // SSO-only users
    if (!user.passwordHash) {
      throw new BadRequestException('This account uses SSO. Please sign in with your identity provider.');
    }

    // Password verification
    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.handleFailedAttempt(user, ip, ua, email);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset failed attempts
    if (user.failedAttempts > 0) {
      await this.usersRepo.update(user.id, { failedAttempts: 0, lockedUntil: undefined });
    }

    // MFA check
    if (user.mfaEnabled) {
      const challengeId = uuidv4();
      await this.redis.storeMfaChallenge(challengeId, {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        orgId: user.organizationId,
        rememberMe: dto.rememberMe,
        ip,
        ua,
      });
      return { mfaRequired: true, challengeId };
    }

    await this.logLoginAttempt(email, ip, ua, 'success', user.id, user.organizationId);

    await this.auditService.log({
      eventType: 'user.login',
      category: 'auth',
      actorId: user.id,
      actorEmail: user.email,
      action: 'User logged in',
      outcome: 'success',
      ipAddress: ip,
      userAgent: ua,
    });

    return this.issueTokens(user.id, user.email, user.userType, user.organizationId, ip, ua, dto.rememberMe);
  }

  // ── Token Issuance ────────────────────────────────────────────────────────

  async issueTokens(
    userId: string,
    email: string,
    userType: string,
    orgId: string | null,
    ip: string,
    ua: string,
    rememberMe = false,
  ): Promise<TokenPair> {
    const [roles, permissions, tier] = await Promise.all([
      this.rbacService.getUserRoleSlugs(userId, orgId ?? undefined),
      this.rbacService.getUserPermissions(userId, orgId ?? undefined),
      this.orgsService.getSubscriptionTier(orgId ?? undefined),
    ]);

    const sessionId = uuidv4();
    const jti = uuidv4();

    const payload: JwtPayload = {
      sub: userId,
      email,
      userType,
      orgId: orgId ?? undefined,
      roles,
      permissions,
      tier,
      sessionId,
      jti,
    };

    const accessTtl = this.config.get<string>('jwt.accessTtl')!;
    const refreshTtl = rememberMe
      ? this.config.get<string>('jwt.refreshRememberTtl')!
      : this.config.get<string>('jwt.refreshTtl')!;

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const refreshHash = this.sha256(rawRefresh);

    await this.sessionsService.createSession({
      sessionId,
      userId,
      orgId: orgId ?? null,
      refreshTokenHash: refreshHash,
      ip,
      ua,
      rememberMe,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      sessionId,
    };
  }

  // ── Token Refresh ─────────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string, ip: string, ua: string): Promise<TokenPair> {
    const tokenHash = this.sha256(rawRefreshToken);
    const session = await this.sessionsService.consumeRefreshToken(tokenHash);

    if (!session) {
      // Possible token reuse attack — revoke entire family
      const family = await this.sessionsService.getFamilyByHash(tokenHash);
      if (family) {
        await this.sessionsService.revokeFamilySessions(family);
        await this.auditService.log({
          eventType: 'security.refresh_token_reuse',
          category: 'security',
          severity: 'critical',
          action: 'Refresh token reuse detected — family revoked',
          outcome: 'denied',
          ipAddress: ip,
          userAgent: ua,
        });
      }
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.usersRepo.findOne({ where: { id: session.userId } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session invalid.');
    }

    return this.issueTokens(user.id, user.email, user.userType, user.organizationId, ip, ua, session.rememberMe);
  }

  // ── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, sessionId: string, jti: string, ip: string): Promise<void> {
    await this.sessionsService.revokeSession(sessionId, 'logout');
    const accessTtl = this.config.get<string>('jwt.accessTtl')!;
    const ttlSeconds = this.parseTtlToSeconds(accessTtl);
    await this.redis.blacklistToken(jti, ttlSeconds);

    await this.auditService.log({
      eventType: 'user.logout',
      category: 'auth',
      actorId: userId,
      action: 'User logged out',
      outcome: 'success',
      ipAddress: ip,
    });
  }

  // ── Password Reset ────────────────────────────────────────────────────────

  async requestPasswordReset(email: string, ip: string): Promise<void> {
    // Always return 200 regardless of whether user exists (prevents user enumeration)
    const user = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return;

    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.dataSource.query(
      `INSERT INTO verification_tokens (user_id, type, token_hash, expires_at)
       VALUES ($1, 'password_reset', $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    const resetUrl = `${this.config.get('app.url')}/auth/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl, user.firstName ?? '');

    await this.auditService.log({
      eventType: 'user.password_reset_requested',
      category: 'auth',
      actorId: user.id,
      actorEmail: user.email,
      action: 'Password reset requested',
      outcome: 'success',
      ipAddress: ip,
    });
  }

  async resetPassword(token: string, newPassword: string, ip: string): Promise<void> {
    this.enforcePasswordPolicy(newPassword);
    const tokenHash = this.sha256(token);

    const rows = await this.dataSource.query(
      `SELECT vt.*, u.id as user_id, u.email
       FROM verification_tokens vt
       JOIN users u ON u.id = vt.user_id
       WHERE vt.token_hash = $1
         AND vt.type = 'password_reset'
         AND vt.used = FALSE
         AND vt.expires_at > NOW()`,
      [tokenHash],
    );

    if (!rows.length) throw new BadRequestException('Invalid or expired password reset link.');

    const { user_id, email } = rows[0];
    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });

    await this.dataSource.transaction(async (em) => {
      await em.query(`UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`, [newHash, user_id]);
      await em.query(`UPDATE verification_tokens SET used = TRUE, used_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    });

    // Revoke all sessions on password reset
    await this.sessionsService.revokeAllUserSessions(user_id, 'password_reset');

    await this.auditService.log({
      eventType: 'user.password_reset',
      category: 'auth',
      actorId: user_id,
      actorEmail: email,
      action: 'Password reset completed — all sessions revoked',
      severity: 'warning',
      outcome: 'success',
      ipAddress: ip,
    });
  }

  // ── OTP Verification ──────────────────────────────────────────────────────

  async sendOtp(userId: string, type: 'email'): Promise<void> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = this.sha256(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    await this.dataSource.query(
      `INSERT INTO verification_tokens (user_id, type, token_hash, otp_code_hash, expires_at)
       VALUES ($1, 'email_verification', gen_random_uuid()::text, $2, $3)`,
      [userId, otpHash, expiresAt],
    );

    await this.emailService.sendOtp(user.email, otp);
  }

  async verifyOtp(userId: string, otpCode: string): Promise<boolean> {
    const otpHash = this.sha256(otpCode);
    const rows = await this.dataSource.query(
      `SELECT id FROM verification_tokens
       WHERE user_id = $1
         AND otp_code_hash = $2
         AND used = FALSE
         AND expires_at > NOW()
         AND attempts < 5
       LIMIT 1`,
      [userId, otpHash],
    );

    if (!rows.length) {
      await this.dataSource.query(
        `UPDATE verification_tokens SET attempts = attempts + 1
         WHERE user_id = $1 AND otp_code_hash IS NOT NULL AND used = FALSE`,
        [userId],
      );
      return false;
    }

    await this.dataSource.query(
      `UPDATE verification_tokens SET used = TRUE, used_at = NOW() WHERE id = $1`,
      [rows[0].id],
    );
    return true;
  }

  // ── SSO ───────────────────────────────────────────────────────────────────

  async handleSsoCallback(
    provider: string,
    providerUserId: string,
    email: string,
    firstName: string,
    lastName: string,
    rawProfile: object,
    ip: string,
    ua: string,
  ): Promise<TokenPair> {
    // Find or create user
    const existing = await this.dataSource.query(
      `SELECT u.* FROM sso_identities si
       JOIN users u ON u.id = si.user_id
       WHERE si.provider = $1 AND si.provider_user_id = $2`,
      [provider, providerUserId],
    );

    let userId: string;
    let userEmail: string;
    let userType: string;
    let orgId: string | null = null;

    if (existing.length) {
      const user = existing[0];
      userId = user.id;
      userEmail = user.email;
      userType = user.user_type;
      orgId = user.organization_id;

      if (user.status === 'suspended' || user.status === 'deactivated') {
        throw new ForbiddenException('Your account is not active.');
      }

      await this.dataSource.query(
        `UPDATE sso_identities SET updated_at = NOW(), raw_profile = $1 WHERE provider = $2 AND provider_user_id = $3`,
        [JSON.stringify(rawProfile), provider, providerUserId],
      );
    } else {
      // New SSO user
      const emailUser = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
      if (emailUser) {
        // Link SSO identity to existing account
        userId = emailUser.id;
        userEmail = emailUser.email;
        userType = emailUser.userType;
        orgId = emailUser.organizationId;

        await this.dataSource.query(
          `INSERT INTO sso_identities (user_id, provider, provider_user_id, provider_email, raw_profile)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, provider, providerUserId, email.toLowerCase(), JSON.stringify(rawProfile)],
        );
      } else {
        // Create new user
        const cxUserId = await this.generateUserId();
        const result = await this.dataSource.query(
          `INSERT INTO users (cx_user_id, email, first_name, last_name, user_type, status, email_verified, email_verified_at)
           VALUES ($1, $2, $3, $4, 'community', 'active', TRUE, NOW())
           RETURNING id, email, user_type`,
          [cxUserId, email.toLowerCase(), firstName, lastName],
        );
        userId = result[0].id;
        userEmail = result[0].email;
        userType = result[0].user_type;

        await this.dataSource.query(
          `INSERT INTO sso_identities (user_id, provider, provider_user_id, provider_email, raw_profile)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, provider, providerUserId, email.toLowerCase(), JSON.stringify(rawProfile)],
        );

        await this.rbacService.assignDefaultRoleBySlug(userId, 'community');
      }
    }

    await this.dataSource.query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
      [ip, userId],
    );

    await this.auditService.log({
      eventType: `user.sso_login.${provider}`,
      category: 'auth',
      actorId: userId,
      actorEmail: userEmail,
      action: `User signed in via ${provider} SSO`,
      outcome: 'success',
      ipAddress: ip,
      userAgent: ua,
    });

    return this.issueTokens(userId, userEmail, userType, orgId, ip, ua);
  }

  // ── Validate JWT ──────────────────────────────────────────────────────────

  async validateAccessToken(payload: JwtPayload): Promise<JwtPayload | null> {
    if (await this.redis.isTokenBlacklisted(payload.jti)) return null;
    return payload;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private enforcePasswordPolicy(password: string): void {
    if (password.length < 12) throw new BadRequestException('Password must be at least 12 characters.');
    if (!/[A-Z]/.test(password)) throw new BadRequestException('Password must contain at least one uppercase letter.');
    if (!/[a-z]/.test(password)) throw new BadRequestException('Password must contain at least one lowercase letter.');
    if (!/[0-9]/.test(password)) throw new BadRequestException('Password must contain at least one number.');
    if (!/[^A-Za-z0-9]/.test(password)) throw new BadRequestException('Password must contain at least one special character.');
  }

  private async handleFailedAttempt(user: User, ip: string, ua: string, email: string): Promise<void> {
    const maxAttempts = this.config.get<number>('security.maxLoginAttempts')!;
    const lockoutMinutes = this.config.get<number>('security.lockoutMinutes')!;

    const newAttempts = (user.failedAttempts || 0) + 1;
    const shouldLock = newAttempts >= maxAttempts;
    const lockedUntil = shouldLock ? new Date(Date.now() + lockoutMinutes * 60 * 1000) : undefined;

    await this.usersRepo.update(user.id, { failedAttempts: newAttempts, lockedUntil });
    await this.logLoginAttempt(email, ip, ua, 'invalid_password', user.id, user.organizationId);

    if (shouldLock) {
      await this.auditService.log({
        eventType: 'security.account_locked',
        category: 'security',
        severity: 'warning',
        actorId: user.id,
        actorEmail: user.email,
        action: `Account locked after ${maxAttempts} failed attempts`,
        outcome: 'failure',
        ipAddress: ip,
        userAgent: ua,
      });
    }
  }

  private async logLoginAttempt(
    email: string,
    ip: string,
    ua: string,
    outcome: string,
    userId: string | null,
    orgId: string | null,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO login_attempts (email, ip_address, user_agent, outcome, user_id, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, ip, ua, outcome, userId, orgId],
    );
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private async fakeHash(): Promise<void> {
    await argon2.hash('constant-time-fake-password-check');
  }

  private async generateUserId(): Promise<string> {
    const rows = await this.dataSource.query(`SELECT LPAD(nextval('user_id_seq')::TEXT, 9, '0') as seq`);
    return `CX-USR-${rows[0].seq}`;
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const [, n, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(n, 10) * (multipliers[unit] ?? 60);
  }
}
