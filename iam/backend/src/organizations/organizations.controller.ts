import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { EmailService } from '../email/email.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly orgsService: OrganizationsService,
    private readonly emailService: EmailService,
  ) {}

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  getOrg(@Param('orgId') orgId: string) {
    return this.orgsService.getOrganization(orgId);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  listMembers(
    @Param('orgId') orgId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.orgsService.listMembers(orgId, page, limit);
  }

  @Post(':orgId/invite')
  @Roles('org_owner', 'org_admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invite user to organization' })
  async invite(
    @Param('orgId') orgId: string,
    @Body('email') email: string,
    @Body('roleId') roleId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const org = await this.orgsService.getOrganization(orgId);
    const inviteUrl = await this.orgsService.createInvite(orgId, user.sub, email, roleId);
    await this.emailService.sendInvite(email, user.email, org.name, inviteUrl);
    return { message: `Invitation sent to ${email}.` };
  }

  @Post(':orgId/sso')
  @Roles('org_owner', 'super_admin')
  @ApiOperation({ summary: 'Configure enterprise SSO for organization' })
  configureSso(
    @Param('orgId') orgId: string,
    @Body('provider') provider: string,
    @Body('metadataUrl') metadataUrl: string,
    @Body('entityId') entityId: string,
  ) {
    return this.orgsService.updateSsoConfig(orgId, provider, metadataUrl, entityId);
  }
}
