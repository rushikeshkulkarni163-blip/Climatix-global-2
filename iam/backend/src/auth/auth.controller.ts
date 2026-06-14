import {
  Controller, Post, Get, Body, Req, Res, UseGuards,
  HttpCode, HttpStatus, Delete, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './auth.service';
import {
  RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto,
  VerifyEmailDto, RefreshTokenDto, VerifyOtpDto,
} from './dto';

function clientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ── Registration ────────────────────────────────────────────────────────

  @Post('register')
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, clientIp(req), req.headers['user-agent'] || '');
  }

  // ── Email Verification ──────────────────────────────────────────────────

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email via token link' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.verifyEmail(dto.token, clientIp(req));
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    return { message: 'Email verified successfully.' };
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body('email') email: string, @Req() req: Request) {
    // Find user and resend — omit details to prevent enumeration
    const rows = await this.authService['dataSource'].query(
      `SELECT id, email FROM users WHERE email = $1 AND email_verified = FALSE AND status = 'pending_verification'`,
      [email.toLowerCase()],
    );
    if (rows.length) {
      await this.authService.sendEmailVerification(rows[0].id, rows[0].email);
    }
    return { message: 'If that account exists, a verification email has been sent.' };
  }

  // ── OTP ─────────────────────────────────────────────────────────────────

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to current user email' })
  async sendOtp(@CurrentUser('sub') userId: string) {
    await this.authService.sendOtp(userId, 'email');
    return { message: 'OTP sent.' };
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email OTP' })
  async verifyOtp(@CurrentUser('sub') userId: string, @Body() dto: VerifyOtpDto) {
    const ok = await this.authService.verifyOtp(userId, dto.otp);
    if (!ok) return { verified: false, message: 'Invalid or expired OTP.' };
    return { verified: true };
  }

  // ── Login ───────────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email & password' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, clientIp(req), req.headers['user-agent'] || '');

    if ('mfaRequired' in result) {
      return { mfaRequired: true, challengeId: result.challengeId };
    }

    this.setAuthCookies(res, result.accessToken, result.refreshToken, dto.rememberMe ?? false);
    return {
      message: 'Login successful.',
      sessionId: result.sessionId,
    };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access/refresh token pair' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.cx_refresh || (req.body as RefreshTokenDto)?.refreshToken;
    if (!rawToken) return { error: 'No refresh token provided.' };

    const tokens = await this.authService.refreshTokens(rawToken, clientIp(req), req.headers['user-agent'] || '');
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    return { message: 'Tokens refreshed.' };
  }

  // ── Logout ──────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke current session' })
  async logout(@CurrentUser() user: JwtPayload, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sub, user.sessionId, user.jti, clientIp(req));
    this.clearAuthCookies(res);
    return { message: 'Logged out.' };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@CurrentUser() user: JwtPayload, @Param('sessionId') sessionId: string, @Req() req: Request) {
    // Users can only revoke their own sessions (enforced in service)
    return this.authService['sessionsService'].revokeSession(sessionId, 'user_revoked', user.sub);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions (except current)' })
  async revokeAllSessions(@CurrentUser() user: JwtPayload, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService['sessionsService'].revokeAllUserSessions(user.sub, 'user_revoked_all', user.sessionId);
    return { message: 'All other sessions revoked.' };
  }

  // ── Me ──────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      userType: user.userType,
      orgId: user.orgId,
      roles: user.roles,
      permissions: user.permissions,
      tier: user.tier,
      sessionId: user.sessionId,
    };
  }

  // ── Password Reset ───────────────────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @Throttle({ auth: { ttl: 60, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto.email, clientIp(req));
    return { message: 'If that email exists, a password reset link has been sent.' };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.resetPassword(dto.token, dto.newPassword, clientIp(req));
    this.clearAuthCookies(res);
    return { message: 'Password reset successful. Please log in again.' };
  }

  // ── Google SSO ──────────────────────────────────────────────────────────

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 flow' })
  googleAuth(): void { /* Passport redirects */ }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const profile = (req as any).user;
    const tokens = await this.authService.handleSsoCallback(
      'google', profile.providerId, profile.email,
      profile.firstName, profile.lastName, profile.rawProfile,
      clientIp(req), req.headers['user-agent'] || '',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    res.redirect(`${this.config.get('app.url')}/dashboard`);
  }

  // ── Microsoft SSO ────────────────────────────────────────────────────────

  @Get('microsoft')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Initiate Microsoft OAuth2 flow' })
  microsoftAuth(): void { /* Passport redirects */ }

  @Get('microsoft/callback')
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @ApiOperation({ summary: 'Microsoft OAuth2 callback' })
  async microsoftCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const profile = (req as any).user;
    const tokens = await this.authService.handleSsoCallback(
      'microsoft', profile.providerId, profile.email,
      profile.firstName, profile.lastName, profile.rawProfile,
      clientIp(req), req.headers['user-agent'] || '',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    res.redirect(`${this.config.get('app.url')}/dashboard`);
  }

  // ── LinkedIn SSO ─────────────────────────────────────────────────────────

  @Get('linkedin')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth2 flow' })
  linkedinAuth(): void {}

  @Get('linkedin/callback')
  @Public()
  @UseGuards(AuthGuard('linkedin'))
  @ApiOperation({ summary: 'LinkedIn OAuth2 callback' })
  async linkedinCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const profile = (req as any).user;
    const tokens = await this.authService.handleSsoCallback(
      'linkedin', profile.providerId, profile.email,
      profile.firstName, profile.lastName, profile.rawProfile,
      clientIp(req), req.headers['user-agent'] || '',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    res.redirect(`${this.config.get('app.url')}/dashboard`);
  }

  // ── Enterprise SAML SSO ──────────────────────────────────────────────────

  @Get('saml/metadata')
  @Public()
  @ApiOperation({ summary: 'SAML SP metadata XML' })
  samlMetadata(@Res() res: Response) {
    res.type('application/xml');
    res.send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${this.config.get('app.url')}/api/v1/auth/saml/metadata">
  <SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${this.config.get('app.url')}/api/v1/auth/saml/callback"
      index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`);
  }

  @Post('saml/callback')
  @Public()
  @UseGuards(AuthGuard('saml'))
  @ApiOperation({ summary: 'SAML assertion callback' })
  async samlCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const profile = (req as any).user;
    const tokens = await this.authService.handleSsoCallback(
      'saml', profile.providerId, profile.email,
      profile.firstName, profile.lastName, profile.rawProfile,
      clientIp(req), req.headers['user-agent'] || '',
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken, false);
    res.redirect(`${this.config.get('app.url')}/dashboard`);
  }

  // ── Cookie helpers ────────────────────────────────────────────────────────

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string, rememberMe: boolean): void {
    const secure = this.config.get<boolean>('security.cookieSecure');
    const domain = this.config.get<string>('security.cookieDomain');

    res.cookie('cx_access', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      ...(domain ? { domain } : {}),
      path: '/',
    });
    res.cookie('cx_refresh', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
      path: '/api/v1/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('cx_access');
    res.clearCookie('cx_refresh', { path: '/api/v1/auth/refresh' });
  }
}
