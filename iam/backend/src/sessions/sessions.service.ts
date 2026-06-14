import { Injectable, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

interface CreateSessionInput {
  sessionId: string;
  userId: string;
  orgId: string | null;
  refreshTokenHash: string;
  ip: string;
  ua: string;
  rememberMe: boolean;
}

@Injectable()
export class SessionsService {
  constructor(private readonly dataSource: DataSource) {}

  async createSession(input: CreateSessionInput): Promise<void> {
    const { sessionId, userId, orgId, refreshTokenHash, ip, ua, rememberMe } = input;
    const sessionTtlDays = rememberMe ? 30 : 7;
    const expiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);
    const refreshExpiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);

    await this.dataSource.transaction(async (em) => {
      // Create session
      await em.query(
        `INSERT INTO sessions (id, user_id, organization_id, session_token, ip_address, user_agent, is_active, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
        [sessionId, userId, orgId, this.sha256(sessionId), ip, ua, expiresAt],
      );

      // Store refresh token
      await em.query(
        `INSERT INTO refresh_tokens (session_id, user_id, token_hash, remember_me, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessionId, userId, refreshTokenHash, rememberMe, refreshExpiresAt, ip, ua],
      );

      // Update last login
      await em.query(
        `UPDATE users SET last_login_at = NOW(), last_login_ip = $1, last_login_ua = $2, updated_at = NOW() WHERE id = $3`,
        [ip, ua, userId],
      );
    });
  }

  async consumeRefreshToken(tokenHash: string): Promise<{
    sessionId: string;
    userId: string;
    rememberMe: boolean;
    familyId: string;
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT rt.*, s.is_active
       FROM refresh_tokens rt
       JOIN sessions s ON s.id = rt.session_id
       WHERE rt.token_hash = $1
         AND rt.is_revoked = FALSE
         AND rt.expires_at > NOW()
         AND s.is_active = TRUE`,
      [tokenHash],
    );

    if (!rows.length) return null;
    const rt = rows[0];

    // Mark current token as revoked (rotation)
    await this.dataSource.query(
      `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'rotated' WHERE token_hash = $1`,
      [tokenHash],
    );

    return {
      sessionId: rt.session_id,
      userId: rt.user_id,
      rememberMe: rt.remember_me,
      familyId: rt.family_id,
    };
  }

  async getFamilyByHash(tokenHash: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT family_id FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return rows[0]?.family_id ?? null;
  }

  async revokeFamilySessions(familyId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'reuse_attack'
       WHERE family_id = $1`,
      [familyId],
    );
    await this.dataSource.query(
      `UPDATE sessions SET is_active = FALSE, revoked_at = NOW(), revoked_reason = 'reuse_attack'
       WHERE id IN (SELECT session_id FROM refresh_tokens WHERE family_id = $1)`,
      [familyId],
    );
  }

  async revokeSession(sessionId: string, reason: string, requestingUserId?: string): Promise<void> {
    if (requestingUserId) {
      const rows = await this.dataSource.query(
        `SELECT user_id FROM sessions WHERE id = $1`,
        [sessionId],
      );
      if (!rows.length || rows[0].user_id !== requestingUserId) {
        throw new ForbiddenException('You cannot revoke another user\'s session.');
      }
    }

    await this.dataSource.query(
      `UPDATE sessions SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $1 WHERE id = $2`,
      [reason, sessionId],
    );
    await this.dataSource.query(
      `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = $1 WHERE session_id = $2`,
      [reason, sessionId],
    );
  }

  async revokeAllUserSessions(userId: string, reason: string, exceptSessionId?: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions SET is_active = FALSE, revoked_at = NOW(), revoked_reason = $1
       WHERE user_id = $2 AND is_active = TRUE AND id != COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000')`,
      [reason, userId, exceptSessionId || null],
    );
    await this.dataSource.query(
      `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = $1
       WHERE user_id = $2 AND is_revoked = FALSE`,
      [reason, userId],
    );
  }

  async listUserSessions(userId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT s.id, s.ip_address, s.user_agent, s.is_active, s.last_activity, s.expires_at, s.created_at
       FROM sessions s
       WHERE s.user_id = $1 AND s.is_active = TRUE AND s.expires_at > NOW()
       ORDER BY s.last_activity DESC`,
      [userId],
    );
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions SET last_activity = NOW() WHERE id = $1`,
      [sessionId],
    );
  }

  async purgeExpiredSessions(): Promise<void> {
    await this.dataSource.query(
      `UPDATE sessions SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE`,
    );
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
