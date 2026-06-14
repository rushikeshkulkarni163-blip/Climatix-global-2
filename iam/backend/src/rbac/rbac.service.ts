import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class RbacService {
  constructor(private readonly dataSource: DataSource) {}

  async getUserRoleSlugs(userId: string, orgId?: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT r.slug
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         AND (ur.organization_id = $2 OR ur.organization_id IS NULL)`,
      [userId, orgId || null],
    );
    return rows.map((r: any) => r.slug);
  }

  async getUserPermissions(userId: string, orgId?: string): Promise<string[]> {
    // Permission resolution order: deny > user-grant > role-grant
    const rows = await this.dataSource.query(
      `WITH role_perms AS (
         SELECT DISTINCT p.slug
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1
           AND ur.is_active = TRUE
           AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
           AND (ur.organization_id = $2 OR ur.organization_id IS NULL)
       ),
       user_grants AS (
         SELECT p.slug, up.is_grant
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = $1
           AND (up.expires_at IS NULL OR up.expires_at > NOW())
           AND (up.organization_id = $2 OR up.organization_id IS NULL)
       )
       SELECT slug FROM role_perms
       WHERE slug NOT IN (SELECT slug FROM user_grants WHERE is_grant = FALSE)
       UNION
       SELECT slug FROM user_grants WHERE is_grant = TRUE`,
      [userId, orgId || null],
    );
    return rows.map((r: any) => r.slug);
  }

  async hasPermission(userId: string, permission: string, orgId?: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId, orgId);
    return perms.includes(permission) || perms.includes('platform:admin');
  }

  async assignDefaultRole(userId: string, userType: string, manager: EntityManager): Promise<void> {
    const slugMap: Record<string, string> = {
      public: 'public',
      community: 'community',
      enterprise_client: 'enterprise_client',
      esg_analyst: 'esg_analyst',
      government: 'government',
      investor: 'investor',
      auditor: 'auditor',
      super_admin: 'super_admin',
    };
    const slug = slugMap[userType] || 'community';
    await this.assignDefaultRoleBySlug(userId, slug, manager);
  }

  async assignDefaultRoleBySlug(userId: string, slug: string, manager?: EntityManager): Promise<void> {
    const em = manager || this.dataSource.manager;
    const role = await em.query(`SELECT id FROM roles WHERE slug = $1 LIMIT 1`, [slug]);
    if (!role.length) return;
    await em.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, role[0].id],
    );
  }

  async assignRole(
    targetUserId: string,
    roleSlug: string,
    grantedBy: string,
    orgId?: string,
  ): Promise<void> {
    const role = await this.dataSource.query(`SELECT id FROM roles WHERE slug = $1`, [roleSlug]);
    if (!role.length) throw new Error(`Role '${roleSlug}' not found.`);
    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, role_id, organization_id, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id, organization_id) DO UPDATE SET is_active = TRUE, revoked_at = NULL`,
      [targetUserId, role[0].id, orgId || null, grantedBy],
    );
  }

  async revokeRole(targetUserId: string, roleSlug: string, revokedBy: string, orgId?: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_roles ur
       SET is_active = FALSE, revoked_at = NOW(), revoked_by = $3
       FROM roles r
       WHERE ur.role_id = r.id
         AND r.slug = $1
         AND ur.user_id = $2
         AND (ur.organization_id = $4 OR ur.organization_id IS NULL)`,
      [roleSlug, targetUserId, revokedBy, orgId || null],
    );
  }

  async listRoles(): Promise<any[]> {
    return this.dataSource.query(`SELECT id, slug, name, description, is_system_role, priority FROM roles ORDER BY priority DESC`);
  }

  async listPermissions(): Promise<any[]> {
    return this.dataSource.query(`SELECT id, slug, resource, action, description, is_sensitive FROM permissions ORDER BY resource, action`);
  }

  async getUserRoleMatrix(userId: string): Promise<{ roles: string[]; permissions: string[]; orgId?: string }> {
    const roles = await this.getUserRoleSlugs(userId);
    const permissions = await this.getUserPermissions(userId);
    return { roles, permissions };
  }
}
