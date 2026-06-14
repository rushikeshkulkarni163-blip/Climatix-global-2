import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-saml';

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor(private readonly config: ConfigService) {
    const appUrl = config.get<string>('app.url')!;
    super({
      path: '/api/v1/auth/saml/callback',
      entryPoint: 'https://idp.example.com/sso/saml',      // overridden per-org at runtime
      issuer: `${appUrl}/api/v1/auth/saml/metadata`,
      callbackUrl: `${appUrl}/api/v1/auth/saml/callback`,
      cert: process.env.SAML_IDP_CERT || '',
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      acceptedClockSkewMs: 5000,
    });
  }

  validate(profile: any, done: Function): void {
    done(null, {
      providerId: profile.nameID,
      email: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || profile.email,
      firstName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || profile.firstName,
      lastName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || profile.lastName,
      rawProfile: profile,
    });
  }
}
