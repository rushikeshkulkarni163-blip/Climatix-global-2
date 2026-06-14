import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  id: string;
  emails: Array<{ value: string; verified: boolean }>;
  name: { givenName: string; familyName: string };
  _json: object;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    const appUrl = config.get<string>('app.url')!;
    super({
      clientID: config.get<string>('sso.google.clientId') || 'GOOGLE_CLIENT_ID',
      clientSecret: config.get<string>('sso.google.clientSecret') || 'GOOGLE_CLIENT_SECRET',
      callbackURL: `${appUrl}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: GoogleProfile, done: VerifyCallback): void {
    const { id, emails, name, _json } = profile;
    done(null, {
      providerId: id,
      email: emails[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      rawProfile: _json,
    });
  }
}
