import { Controller, Get, Post, Delete, Patch, Param, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import { DataSource } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'internal_admin')
export class AdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
    private readonly sessionsService: SessionsService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin)' })
  async listUsers(@Query('page') page = 1, @Query('limit') limit = 50, @Query('search') search?: string) {
    const offset = (page - 1) * limit;
    const where = search ? `WHERE u.email ILIKE $3 OR u.first_name ILIKE $3 OR u.last_name ILIKE $3` : '';
    const params: any[] = [limit, offset];
    if (search) params.push(`%${search}%`);
    const users = await this.dataSource.query(
      `SELECT u.id, u.cx_user_id, u.email, u.first_name, u.last_name, u.user_type, u.status,
              u.email_verified, u.mfa_enabled, u.last_login_at, u.created_at,
              o.name as org_name, o.id as org_id
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ${where}
       ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
      params,
    );
    return { data: users, page, limit };
  }

  @Patch('users/:userId/status')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Update user status (suspend/activate/lock)' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body('status') status: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    const validStatuses = ['active', 'suspended', 'deactivated'];
    if (!validStatuses.includes(status)) throw new Error('Invalid status.');
    await this.dataSource.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, userId],
    );
    await this.auditService.log({
      eventType: 'admin.user_status_updated',
      category: 'admin',
      severity: 'warning',
      actorId: admin.sub,
      actorEmail: admin.email,
      targetType: 'user',
      targetId: userId,
      action: `Admin changed user status to ${status}`,
      outcome: 'success',
    });
    return { message: `User status updated to ${status}.` };
  }

  @Post('users/:userId/roles')
  @Permissions('users:manage_roles')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body('roleSlug') roleSlug: string,
    @Body('orgId') orgId: string | undefined,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.rbacService.assignRole(userId, roleSlug, admin.sub, orgId);
    await this.auditService.log({
      eventType: 'admin.role_assigned',
      category: 'admin',
      severity: 'warning',
      actorId: admin.sub,
      actorEmail: admin.email,
      targetType: 'user',
      targetId: userId,
      action: `Assigned role '${roleSlug}' to user`,
      outcome: 'success',
    });
    return { message: `Role '${roleSlug}' assigned.` };
  }

  @Delete('users/:userId/roles/:roleSlug')
  @Permissions('users:manage_roles')
  @ApiOperation({ summary: 'Revoke role from user' })
  async revokeRole(
    @Param('userId') userId: string,
    @Param('roleSlug') roleSlug: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.rbacService.revokeRole(userId, roleSlug, admin.sub);
    return { message: `Role '${roleSlug}' revoked.` };
  }

  // ── Organizations ────────────────────────────────────────────────────────

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations' })
  async listOrgs(@Query('page') page = 1, @Query('limit') limit = 50) {
    const offset = (page - 1) * limit;
    const orgs = await this.dataSource.query(
      `SELECT id, tenant_id, name, type, status, subscription_tier, workspace_slug,
              current_seats, max_seats, sso_enabled, created_at
       FROM organizations
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return { data: orgs, page, limit };
  }

  @Patch('organizations/:orgId/subscription')
  @ApiOperation({ summary: 'Change organization subscription tier' })
  async changeSubscription(
    @Param('orgId') orgId: string,
    @Body('tier') tier: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    await this.dataSource.query(
      `UPDATE organizations SET subscription_tier = $1, updated_at = NOW() WHERE id = $2`,
      [tier, orgId],
    );
    await this.auditService.log({
      eventType: 'admin.subscription_changed',
      category: 'admin',
      severity: 'info',
      actorId: admin.sub,
      organizationId: orgId,
      action: `Organization subscription changed to ${tier}`,
      outcome: 'success',
    });
    return { message: `Subscription updated to ${tier}.` };
  }

  // ── Audit ────────────────────────────────────────────────────────────────

  @Get('audit')
  @Permissions('audit:read_all')
  @ApiOperation({ summary: 'Query audit logs' })
  async queryAudit(
    @Query('orgId') orgId?: string,
    @Query('userId') userId?: string,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.auditService.query({
      orgId,
      userId,
      eventType,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }

  @Get('security-events')
  @Permissions('audit:read_all')
  @ApiOperation({ summary: 'List security events' })
  async securityEvents(@Query('orgId') orgId?: string, @Query('onlyOpen') onlyOpen = true) {
    return this.auditService.getSecurityEvents(orgId, onlyOpen);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  @Delete('users/:userId/sessions')
  @ApiOperation({ summary: 'Force revoke all sessions for user' })
  @HttpCode(HttpStatus.OK)
  async revokeUserSessions(@Param('userId') userId: string, @CurrentUser() admin: JwtPayload) {
    await this.sessionsService.revokeAllUserSessions(userId, 'admin_revoked');
    await this.auditService.log({
      eventType: 'admin.sessions_revoked',
      category: 'admin',
      severity: 'warning',
      actorId: admin.sub,
      targetType: 'user',
      targetId: userId,
      action: 'Admin force-revoked all user sessions',
      outcome: 'success',
    });
    return { message: 'All sessions revoked.' };
  }

  // ── RBAC ─────────────────────────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  listRoles() { return this.rbacService.listRoles(); }

  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions' })
  listPermissions() { return this.rbacService.listPermissions(); }

  // ── Platform Stats ────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Platform health and stats' })
  async platformStats() {
    const [users, orgs, sessions, auditEvents] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) as total, status FROM users GROUP BY status`),
      this.dataSource.query(`SELECT COUNT(*) as total, subscription_tier FROM organizations GROUP BY subscription_tier`),
      this.dataSource.query(`SELECT COUNT(*) as active FROM sessions WHERE is_active = TRUE AND expires_at > NOW()`),
      this.dataSource.query(`SELECT COUNT(*) as total FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);
    return { users, organizations: orgs, activeSessions: sessions[0]?.active, auditEventsLast24h: auditEvents[0]?.total };
  }
}
