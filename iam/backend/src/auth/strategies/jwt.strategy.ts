import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService, JwtPayload } from '../auth.service';

function cookieOrBearerExtractor(req: Request): string | null {
  // 1. Try HttpOnly cookie
  if (req?.cookies?.cx_access) return req.cookies.cx_access;
  // 2. Fall back to Authorization header
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const valid = await this.authService.validateAccessToken(payload);
    if (!valid) throw new UnauthorizedException('Session expired or revoked.');
    return valid;
  }
}
