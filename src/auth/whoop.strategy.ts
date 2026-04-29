import { Strategy } from 'passport-oauth2';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhoopStrategy extends PassportStrategy(Strategy, 'whoop') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('WHOOP_CLIENT_ID');
    const clientSecret = configService.get<string>('WHOOP_CLIENT_SECRET');

    if (!clientID || !clientSecret) {
      throw new Error(
        'WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET must be configured',
      );
    }

    super({
      authorizationURL: 'https://api.prod.whoop.com/oauth/oauth2/auth',
      tokenURL: 'https://api.prod.whoop.com/oauth/oauth2/token',
      clientID,
      clientSecret,
      callbackURL:
        configService.get<string>('WHOOP_CALLBACK_URL') ||
        'http://localhost:3000/auth/whoop/callback',
      scope: ['read:profile', 'read:recovery', 'read:cycles', 'read:workout', 'offline'],
      state: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ) {
    try {
      // Here you would typically:
      // 1. Fetch user profile from WHOOP API using the access token
      // 2. Save/update user in your database
      // 3. Store tokens securely

      const user = {
        accessToken,
        refreshToken,
        // Add additional user data as needed
      };

      done(null, user);
    } catch (error) {
      done(
        new UnauthorizedException('Failed to authenticate with WHOOP'),
        false,
      );
    }
  }
}
