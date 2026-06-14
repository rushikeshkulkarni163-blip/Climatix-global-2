import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import type { TokenPair } from '../auth/auth.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
  ) {
    authenticator.options = { step: 30, window: 1 };
  }

  // ── TOTP Setup ────────────────────────────────────────────────────────────

  async setupTotp(userId: string, email: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> {
    const rows = await this.dataSource.query(
      `SELECT mfa_enabled FROM users WHERE id = $1`,
      [userId],
    );
    if (rows[0]?.mfa_enabled) throw new BadRequestException('MFA is already enabled.');

    const secret = authenticator.generateSecret(32);
    const otpauthUrl = authenticator.keyuri(email, 'Climactix Global', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    // Store pending secret in Redis (confirmed on first verification)
    await this.redis.set(`mfa:pending:${userId}`, secret, 600);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

    return { secret, qrCodeUrl, backupCodes };
  }

  async enableTotp(userId: string, totpCode: string, backupCodes: string[]): Promise<void> {
    const pendingSecret = await this.redis.get(`mfa:pending:${userId}`);
    if (!pendingSecret) throw new BadRequestException('MFA setup session expired. Start setup again.');

    const isValid = authenticator.check(totpCode, pendingSecret);
    if (!isValid) throw new BadRequestException('Invalid TOTP code.');

    // Encrypt the secret before storing
    const encryptedSecret = this.encryptSecret(pendingSecret);
    const hashedBackupCodes = backupCodes.map((c) => this.hashBackupCode(c));

    await this.dataSource.query(
      `UPDATE users SET mfa_enabled = TRUE, mfa_method = 'totp', mfa_secret_enc = $1, mfa_backup_codes = $2, updated_at = NOW() WHERE id = $3`,
      [encryptedSecret, hashedBackupCodes, userId],
    );

    await this.redis.del(`mfa:pending:${userId}`);
  }

  async disableTotp(userId: string, totpCode: string): Promise<void> {
    const user = await this.dataSource.query(
      `SELECT mfa_enabled, mfa_secret_enc FROM users WHERE id = $1`,
      [userId],
    );
    if (!user[0]?.mfa_enabled) throw new BadRequestException('MFA is not enabled.');

    const secret = this.decryptSecret(user[0].mfa_secret_enc);
    const isValid = authenticator.check(totpCode, secret);
    if (!isValid) throw new UnauthorizedException('Invalid TOTP code.');

    await this.dataSource.query(
      `UPDATE users SET mfa_enabled = FALSE, mfa_method = NULL, mfa_secret_enc = NULL, mfa_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }

  // ── MFA Verification (during login) ─────────────────────────────────────

  async verifyMfaChallenge(challengeId: string, code: string, ip: string, ua: string): Promise<TokenPair> {
    const challenge = await this.redis.getMfaChallenge(challengeId) as any;
    if (!challenge) throw new UnauthorizedException('MFA challenge expired or invalid.');

    const user = await this.dataSource.query(
      `SELECT id, mfa_secret_enc, mfa_backup_codes, user_type, organization_id FROM users WHERE id = $1`,
      [challenge.userId],
    );
    if (!user.length) throw new UnauthorizedException();

    const { mfa_secret_enc, mfa_backup_codes } = user[0];
    const secret = this.decryptSecret(mfa_secret_enc);

    // Try TOTP first
    let verified = authenticator.check(code, secret);

    // Try backup codes if TOTP fails
    if (!verified && mfa_backup_codes) {
      const codeHash = this.hashBackupCode(code.toUpperCase());
      const matchIdx = (mfa_backup_codes as string[]).indexOf(codeHash);
      if (matchIdx !== -1) {
        verified = true;
        // Consume the backup code
        const newCodes = [...mfa_backup_codes as string[]];
        newCodes.splice(matchIdx, 1);
        await this.dataSource.query(
          `UPDATE users SET mfa_backup_codes = $1 WHERE id = $2`,
          [newCodes, challenge.userId],
        );
      }
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid MFA code.');
    }

    await this.redis.deleteMfaChallenge(challengeId);

    return this.authService.issueTokens(
      challenge.userId,
      challenge.email,
      challenge.userType,
      challenge.orgId,
      ip || challenge.ip,
      ua || challenge.ua,
      challenge.rememberMe,
    );
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean; method: string | null; backupCodesRemaining: number }> {
    const rows = await this.dataSource.query(
      `SELECT mfa_enabled, mfa_method, ARRAY_LENGTH(mfa_backup_codes, 1) as backup_count FROM users WHERE id = $1`,
      [userId],
    );
    return {
      enabled: rows[0]?.mfa_enabled ?? false,
      method: rows[0]?.mfa_method ?? null,
      backupCodesRemaining: rows[0]?.backup_count ?? 0,
    };
  }

  // ── Crypto Helpers ───────────────────────────────────────────────────────

  private encryptSecret(plaintext: string): Buffer {
    const key = Buffer.from(this.config.get<string>('encryption.key')!, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  private decryptSecret(data: Buffer): string {
    const key = Buffer.from(this.config.get<string>('encryption.key')!, 'hex');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
