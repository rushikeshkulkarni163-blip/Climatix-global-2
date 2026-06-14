import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RbacService } from './rbac.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('rbac')
@ApiBearerAuth('access-token')
@Controller('rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List available roles' })
  listRoles() { return this.rbacService.listRoles(); }

  @Get('permissions')
  @ApiOperation({ summary: 'List available permissions' })
  listPermissions() { return this.rbacService.listPermissions(); }

  @Get('me')
  @ApiOperation({ summary: 'Get current user role & permission matrix' })
  myMatrix(@CurrentUser() user: JwtPayload) {
    return { roles: user.roles, permissions: user.permissions };
  }

  @Post('users/:userId/roles')
  @Roles('org_owner', 'org_admin', 'super_admin', 'internal_admin')
  @ApiOperation({ summary: 'Assign role to user within organization' })
  assignRole(
    @Param('userId') userId: string,
    @Body('roleSlug') roleSlug: string,
    @CurrentUser() grantedBy: JwtPayload,
  ) {
    return this.rbacService.assignRole(userId, roleSlug, grantedBy.sub, grantedBy.orgId);
  }

  @Delete('users/:userId/roles/:roleSlug')
  @Roles('org_owner', 'org_admin', 'super_admin', 'internal_admin')
  @ApiOperation({ summary: 'Revoke role from user' })
  revokeRole(
    @Param('userId') userId: string,
    @Param('roleSlug') roleSlug: string,
    @CurrentUser() revokedBy: JwtPayload,
  ) {
    return this.rbacService.revokeRole(userId, roleSlug, revokedBy.sub, revokedBy.orgId);
  }
}
