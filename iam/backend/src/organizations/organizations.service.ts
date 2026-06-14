import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrganizationsService {
  constructor(private readonly dataSource: DataSource) {}

  async createAndLinkOrganization(
    user: User,
    orgName: string,
    orgType: string,
    manager?: EntityManager,
  ): Promise<string> {
    const em = manager || this.dataSource.manager;

    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tenantId = await this.nextTenantId(em);
    const namespace = `cx-${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const tier = orgType === 'investor' ? 'institutional' : 'trial';

    const existing = await em.query(`SELECT id FROM organizations WHERE workspace_slug = $1`, [slug]);
    const workspaceSlug = existing.length ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;

    const result = await em.query(
      `INSERT INTO organizations (tenant_id, name, type, status, subscription_tier, workspace_slug, climate_namespace, max_seats)
       VALUES ($1, $2, $3, 'pending_onboarding', $4, $5, $6, 5)
       RETURNING id`,
      [tenantId, orgName, orgType, tier, workspaceSlug, namespace],
    );

    const orgId = result[0].id;

    // Link user to org
    await em.query(`UPDATE users SET organization_id = $1 WHERE id = $2`, [orgId, user.id]);
    await em.query(
      `INSERT INTO organization_members (organization_id, user_id, is_owner, is_admin)
       VALUES ($1, $2, TRUE, TRUE)`,
      [orgId, user.id],
    );

    return orgId;
  }

  async getSubscriptionTier(orgId?: string): Promise<string> {
    if (!orgId) return 'free';
    const rows = await this.dataSource.query(
      `SELECT subscription_tier FROM organizations WHERE id = $1`,
      [orgId],
    );
    return rows[0]?.subscription_tier ?? 'free';
  }

  async getOrganization(orgId: string): Promise<any> {
    const rows = await this.dataSource.query(
      `SELECT id, tenant_id, name, type, status, subscription_tier, workspace_slug, climate_namespace,
              sso_enabled, sso_provider, max_seats, current_seats, onboarded_at, created_at
       FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!rows.length) throw new NotFoundException('Organization not found.');
    return rows[0];
  }

  async listMembers(orgId: string, page = 1, limit = 50): Promise<any> {
    const offset = (page - 1) * limit;
    const [members, count] = await Promise.all([
      this.dataSource.query(
        `SELECT u.id, u.cx_user_id, u.email, u.first_name, u.last_name, u.user_type, u.status,
                om.is_owner, om.is_admin, om.joined_at, om.department, om.job_title
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.status = 'active'
         ORDER BY om.is_owner DESC, om.is_admin DESC, u.first_name
         LIMIT $2 OFFSET $3`,
        [orgId, limit, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*) as total FROM organization_members WHERE organization_id = $1 AND status = 'active'`, [orgId]),
    ]);
    return { data: members, total: parseInt(count[0].total, 10) };
  }

  async createInvite(orgId: string, invitedByUserId: string, email: string, roleId?: string): Promise<string> {
    const crypto = require('crypto');
    const token = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.dataSource.query(
      `INSERT INTO invites (organization_id, invited_by, email, token_hash, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, invitedByUserId, email.toLowerCase(), tokenHash, roleId || null],
    );

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return `${appUrl}/auth/invite?token=${token}`;
  }

  async updateSsoConfig(orgId: string, provider: string, metadataUrl: string, entityId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE organizations SET sso_enabled = TRUE, sso_provider = $1, sso_metadata_url = $2, sso_entity_id = $3, updated_at = NOW()
       WHERE id = $4`,
      [provider, metadataUrl, entityId, orgId],
    );
  }

  private async nextTenantId(em: EntityManager): Promise<string> {
    const rows = await em.query(`SELECT LPAD(nextval('tenant_id_seq')::TEXT, 6, '0') as seq`);
    return `CX-ORG-ENT-${rows[0].seq}`;
  }
}
