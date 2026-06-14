import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Query audit logs for own organization' })
  queryAudit(
    @CurrentUser() user: JwtPayload,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.auditService.query({ orgId: user.orgId, eventType, severity, page, limit });
  }
}
