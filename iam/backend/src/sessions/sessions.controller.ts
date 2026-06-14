import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionsService } from './sessions.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('sessions')
@ApiBearerAuth('access-token')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List active sessions for current user' })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.sessionsService.listUserSessions(user.sub);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Revoke a specific session' })
  revokeSession(@CurrentUser() user: JwtPayload, @Param('sessionId') sessionId: string) {
    return this.sessionsService.revokeSession(sessionId, 'user_revoked', user.sub);
  }
}
