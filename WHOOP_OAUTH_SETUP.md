# WHOOP OAuth 2.0 Implementation Guide

This guide explains how to set up and use WHOOP OAuth 2.0 authentication in this NestJS application.

## Overview

The implementation includes:
- OAuth 2.0 authorization code flow
- Automatic token refresh handling
- WHOOP API service with common endpoints
- Secure token management

## Architecture

```
src/
├── auth/
│   ├── auth.module.ts          # Auth module configuration
│   ├── auth.controller.ts      # OAuth endpoints (login, callback)
│   ├── auth.service.ts         # Token refresh and API request helper
│   └── whoop.strategy.ts       # Passport OAuth strategy
└── whoop/
    ├── whoop.module.ts         # WHOOP API module
    ├── whoop.controller.ts     # API endpoints (profile, recovery, etc.)
    └── whoop.service.ts        # WHOOP API methods
```

## Setup Instructions

### 1. Register Your Application with WHOOP

1. Go to [WHOOP Developer Portal](https://developer.whoop.com/)
2. Create a new application
3. Note your `Client ID` and `Client Secret`
4. Add callback URL: `http://localhost:3000/auth/whoop/callback`

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
WHOOP_CLIENT_ID=your_actual_client_id
WHOOP_CLIENT_SECRET=your_actual_client_secret
WHOOP_CALLBACK_URL=http://localhost:3000/auth/whoop/callback
PORT=3000
NODE_ENV=development
```

### 3. Install Dependencies

Dependencies are already installed, but if you need to reinstall:

```bash
npm install
```

### 4. Start the Application

```bash
npm run start:dev
```

## Usage Flow

### 1. Initiate OAuth Flow

Direct users to: `http://localhost:3000/auth/whoop`

This will redirect them to WHOOP's authorization page.

### 2. User Authorizes Application

The user logs in to WHOOP and grants permissions to your application.

### 3. Handle Callback

WHOOP redirects back to: `http://localhost:3000/auth/whoop/callback`

The callback endpoint receives:
- Authorization code (automatically)
- Exchanges it for access and refresh tokens
- Returns the tokens in the response

**Response example:**
```json
{
  "message": "Successfully authenticated with WHOOP",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### 4. Store Tokens Securely

**Important:** In production, you should:
- Store tokens in a secure database (encrypted)
- Associate tokens with user sessions
- Never expose tokens in API responses
- Use session tokens or JWTs for client authentication

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/whoop` | GET | Initiates OAuth flow |
| `/auth/whoop/callback` | GET | Handles OAuth callback |
| `/auth/status` | GET | Check auth endpoints status |

### WHOOP Data Endpoints

All WHOOP endpoints require authentication headers:
- `Authorization: Bearer {accessToken}`
- `x-refresh-token: {refreshToken}`

| Endpoint | Method | Query Params | Description |
|----------|--------|--------------|-------------|
| `/whoop/profile` | GET | - | Get user profile |
| `/whoop/recovery` | GET | `start`, `end` | Get recovery data |
| `/whoop/cycles` | GET | `start`, `end` | Get cycle data |
| `/whoop/workouts` | GET | `start`, `end` | Get workout data |
| `/whoop/sleep` | GET | `start`, `end` | Get sleep data |

### Example API Requests

**Get User Profile:**
```bash
curl http://localhost:3000/whoop/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

**Get Recovery Data:**
```bash
curl "http://localhost:3000/whoop/recovery?start=2026-01-01&end=2026-01-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

## Token Management

### Access Token Expiration

WHOOP access tokens are short-lived. The implementation automatically:
1. Detects 401 (Unauthorized) responses
2. Uses the refresh token to get a new access token
3. Retries the original request with the new token

This is handled in `auth.service.ts` → `makeWhoopApiRequest()` method.

### Manual Token Refresh

You can manually refresh tokens using the `AuthService`:

```typescript
import { AuthService } from './auth/auth.service';

// In your service/controller
const newTokens = await this.authService.refreshAccessToken(refreshToken);
```

## Security Best Practices

### Production Deployment

1. **Use HTTPS:** Always use HTTPS in production
   ```env
   WHOOP_CALLBACK_URL=https://yourdomain.com/auth/whoop/callback
   ```

2. **Secure Token Storage:**
   - Store tokens encrypted in database
   - Never log tokens
   - Use secure session management
   - Implement token rotation

3. **Environment Variables:**
   - Never commit `.env` file
   - Use secure secret management (AWS Secrets Manager, Vault, etc.)
   - Rotate client secrets regularly

4. **Add Session Management:**
   ```typescript
   // Example: Create session after OAuth callback
   @Get('whoop/callback')
   async whoopAuthCallback(@Req() req: Request, @Res() res: Response) {
     const user = req.user;
     
     // Save to database
     await this.userService.saveTokens(userId, {
       accessToken: user['accessToken'],
       refreshToken: user['refreshToken'],
     });
     
     // Create session/JWT
     const sessionToken = await this.authService.createSession(userId);
     
     // Redirect to frontend with session
     return res.redirect(`https://yourapp.com/dashboard?token=${sessionToken}`);
   }
   ```

## Available WHOOP Scopes

The implementation requests these scopes:
- `read:profile` - User profile information
- `read:recovery` - Recovery scores
- `read:cycles` - Sleep and strain cycles
- `read:workout` - Workout data

You can modify scopes in `whoop.strategy.ts`:
```typescript
scope: ['read:profile', 'read:recovery', 'read:cycles', 'read:workout'],
```

## Testing the Implementation

### 1. Start the Server
```bash
npm run start:dev
```

### 2. Test Auth Flow
1. Open browser: `http://localhost:3000/auth/whoop`
2. Log in with WHOOP credentials
3. Grant permissions
4. You'll receive tokens in the response

### 3. Test API Endpoints
Use the tokens from step 2 to test WHOOP API endpoints:
```bash
# Save tokens from callback
ACCESS_TOKEN="your_access_token_here"
REFRESH_TOKEN="your_refresh_token_here"

# Test profile endpoint
curl http://localhost:3000/whoop/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-refresh-token: $REFRESH_TOKEN"
```

## Troubleshooting

### Common Issues

**1. "Invalid callback URL" error**
- Ensure callback URL in `.env` matches the one registered in WHOOP Developer Portal
- Include the full URL with protocol (http:// or https://)

**2. "Invalid client credentials" error**
- Double-check `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` in `.env`
- Ensure no extra spaces or quotes in the values

**3. Token refresh fails**
- Refresh tokens can expire or be revoked
- User may need to re-authenticate
- Check WHOOP API status

**4. 401 errors on API requests**
- Ensure both access token and refresh token are provided
- Check token format (should be Bearer token)
- Verify scopes are sufficient for the endpoint

## Next Steps

### Recommended Enhancements

1. **Add Database Integration:**
   - Store users and tokens in a database
   - Implement user model with TypeORM or Prisma

2. **Add Session Management:**
   - Use Passport sessions or JWT
   - Implement logout functionality

3. **Add User Interface:**
   - Create frontend login button
   - Display WHOOP data in dashboard
   - Show authentication status

4. **Add Webhook Support:**
   - WHOOP supports webhooks for real-time data
   - Implement webhook endpoints

5. **Add Rate Limiting:**
   - Protect your endpoints
   - Handle WHOOP API rate limits

6. **Add Testing:**
   - Unit tests for services
   - Integration tests for OAuth flow
   - E2E tests for complete flow

## Resources

- [WHOOP Developer Documentation](https://developer.whoop.com/docs)
- [WHOOP API Reference](https://developer.whoop.com/api)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [NestJS Passport Documentation](https://docs.nestjs.com/security/authentication)

## Support

For issues specific to:
- **This implementation:** Check the code in `src/auth/` and `src/whoop/`
- **WHOOP API:** Contact WHOOP Developer Support
- **NestJS/Passport:** Refer to official documentation
