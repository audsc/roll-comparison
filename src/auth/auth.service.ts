import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {}

  /**
   * Refreshes an expired access token using the refresh token
   * Call this when you receive a 401 error from WHOOP API
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenURL = 'https://api.prod.whoop.com/oauth/oauth2/token';
    const clientId = this.configService.get<string>('WHOOP_CLIENT_ID');
    const clientSecret = this.configService.get<string>('WHOOP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException(
        'WHOOP client credentials not configured',
      );
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    try {
      const response = await fetch(tokenURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new UnauthorizedException('Failed to refresh access token');
      }

      const data: TokenResponse = await response.json();

      // Here you would typically:
      // 1. Update the tokens in your database
      // 2. Return the new tokens to the caller

      return data;
    } catch (error) {
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  /**
   * Makes an authenticated request to WHOOP API
   * Automatically refreshes token if expired
   */
  async makeWhoopApiRequest(
    endpoint: string,
    accessToken: string,
    refreshToken: string | undefined,
  ): Promise<any> {
    const baseURL = 'https://api.prod.whoop.com/developer/v1';

    try {
      let response = await fetch(`${baseURL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // If token expired, refresh and retry
      if (response.status === 401) {
        if (!refreshToken) throw new Error('Access token expired and no refresh token available');
        const newTokens = await this.refreshAccessToken(refreshToken);

        response = await fetch(`${baseURL}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${newTokens.access_token}`,
          },
        });
      }

      if (!response.ok) {
        throw new Error(`WHOOP API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  encrypt(text: string): string {
    const key = Buffer.from(
      this.configService.get<string>('ENCRYPTION_KEY') ?? '',
      'hex',
    );
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(data: string): string {
    const key = Buffer.from(
      this.configService.get<string>('ENCRYPTION_KEY') ?? '',
      'hex',
    );
    const buf = Buffer.from(data, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }
}
