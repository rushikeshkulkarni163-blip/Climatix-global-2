import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

@ApiTags('mfa')
@ApiBearerAuth('access-token')
@Controller('mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get MFA status for current user' })
  getMfaStatus(@CurrentUser() user: JwtPayload) {
    return this.mfaService.getMfaStatus(user.sub);
  }

  @Post('totp/setup')
  @ApiOperation({ summary: 'Generate TOTP secret and QR code' })
  setupTotp(@CurrentUser() user: JwtPayload) {
    return this.mfaService.setupTotp(user.sub, user.email);
  }

  @Post('totp/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable TOTP after verifying first code' })
  enableTotp(
    @CurrentUser() user: JwtPayload,
    @Body('totpCode') totpCode: string,
    @Body('backupCodes') backupCodes: string[],
  ) {
    return this.mfaService.enableTotp(user.sub, totpCode, backupCodes);
  }

  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable TOTP MFA' })
  disableTotp(@CurrentUser() user: JwtPayload, @Body('totpCode') totpCode: string) {
    return this.mfaService.disableTotp(user.sub, totpCode);
  }

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA challenge and complete login' })
  async verifyChallenge(
    @Body('challengeId') challengeId: string,
    @Body('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.mfaService.verifyMfaChallenge(
      challengeId, code, clientIp(req), req.headers['user-agent'] || '',
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('cx_access', tokens.accessToken, {
      httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 15 * 60 * 1000,
    });
    res.cookie('cx_refresh', tokens.refreshToken, {
      httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return { message: 'MFA verified. Login complete.', sessionId: tokens.sessionId };
  }
}
