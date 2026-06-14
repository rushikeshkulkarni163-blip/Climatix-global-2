import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cx_user_id', unique: true })
  cxUserId: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', nullable: true })
  @Exclude()
  passwordHash: string | null;

  @Column({ name: 'first_name', nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', nullable: true })
  lastName: string | null;

  @Column({ name: 'display_name', nullable: true })
  displayName: string | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

  @Column({ name: 'user_type', default: 'community' })
  userType: string;

  @Index()
  @Column({ default: 'pending_verification' })
  status: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verified_at', nullable: true, type: 'timestamptz' })
  emailVerifiedAt: Date | null;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_method', nullable: true })
  mfaMethod: string | null;

  @Column({ name: 'mfa_secret_enc', nullable: true, type: 'bytea' })
  @Exclude()
  mfaSecretEnc: Buffer | null;

  @Column({ name: 'mfa_backup_codes', type: 'text', array: true, nullable: true })
  @Exclude()
  mfaBackupCodes: string[] | null;

  @Column({ name: 'organization_id', nullable: true, type: 'uuid' })
  organizationId: string | null;

  @Column({ name: 'keycloak_id', nullable: true })
  keycloakId: string | null;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @Column({ name: 'locked_until', nullable: true, type: 'timestamptz' })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date | null;

  @Column({ name: 'last_login_ip', nullable: true })
  lastLoginIp: string | null;

  @Column({ name: 'password_changed_at', nullable: true, type: 'timestamptz' })
  passwordChangedAt: Date | null;

  @Column({ name: 'timezone', default: 'UTC' })
  timezone: string;

  @Column({ name: 'locale', default: 'en' })
  locale: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  get fullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.email;
  }
}
