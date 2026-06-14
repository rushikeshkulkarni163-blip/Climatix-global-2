import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy } from 'passport-azure-ad';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(OIDCStrategy, 'microsoft') {
  constructor(private readonly config: ConfigService) {
    const appUrl = config.get<string>('app.url')!;
    const tenantId = config.get<string>('sso.microsoft.tenantId') || 'common';
    super({
      identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
      clientID: config.get<string>('sso.microsoft.clientId') || 'MICROSOFT_CLIENT_ID',
      clientSecret: config.get<string>('sso.microsoft.clientSecret') || 'MICROSOFT_CLIENT_SECRET',
      responseType: 'code',
      responseMode: 'query',
      redirectUrl: `${appUrl}/api/v1/auth/microsoft/callback`,
      allowHttpForRedirectUrl: config.get<string>('env') !== 'production',
      validateIssuer: tenantId !== 'common',
      passReqToCallback: false,
      scope: ['openid', 'email', 'profile', 'offline_access'],
    });
  }

  validate(iss: string, sub: string, profile: any, accessToken: string, refreshToken: string, done: Function): void {
    done(null, {
      providerId: sub,
      email: profile._json?.email || profile._json?.preferred_username,
      firstName: profile._json?.given_name,
      lastName: profile._json?.family_name,
      rawProfile: profile._json,
    });
  }
}
