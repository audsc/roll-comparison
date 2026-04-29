# WHOOP OAuth - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Configure Environment
```bash
# Edit .env file with your WHOOP credentials
WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret
WHOOP_CALLBACK_URL=http://localhost:3000/auth/whoop/callback
```

### 2. Start Server
```bash
npm run start:dev
```

### 3. Test OAuth Flow
Open in browser: `http://localhost:3000/auth/whoop`

---

## 📋 API Endpoints

### Authentication
```
GET /auth/whoop              → Start OAuth flow
GET /auth/whoop/callback     → OAuth callback (automatic)
GET /auth/status             → Check endpoints status
```

### WHOOP Data (requires tokens)
```
GET /whoop/profile           → User profile
GET /whoop/recovery          → Recovery data
GET /whoop/cycles            → Sleep/strain cycles
GET /whoop/workouts          → Workout data
GET /whoop/sleep             → Sleep data
```

---

## 🔑 Using the API

### Get Access Tokens
1. Go to: `http://localhost:3000/auth/whoop`
2. Login with WHOOP
3. Copy `accessToken` and `refreshToken` from response

### Make API Requests
```bash
curl http://localhost:3000/whoop/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

### With Date Ranges
```bash
curl "http://localhost:3000/whoop/recovery?start=2026-01-01&end=2026-01-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

---

## 📁 Project Structure

```
src/
├── auth/
│   ├── auth.module.ts         # Auth configuration
│   ├── auth.controller.ts     # OAuth endpoints
│   ├── auth.service.ts        # Token refresh logic
│   └── whoop.strategy.ts      # OAuth strategy
│
└── whoop/
    ├── whoop.module.ts        # WHOOP API module
    ├── whoop.controller.ts    # Data endpoints
    └── whoop.service.ts       # API methods
```

---

## 🔧 Key Features

✅ **OAuth 2.0 Authorization Code Flow**
✅ **Automatic Token Refresh** (handles 401 errors)
✅ **Secure Token Management**
✅ **Pre-built WHOOP API Methods**
✅ **TypeScript Support**

---

## 🎯 Next Steps

1. **Store Tokens in Database**
   - Add TypeORM/Prisma
   - Create User model
   - Save tokens securely (encrypted)

2. **Add Session Management**
   - Use JWT or sessions
   - Implement logout

3. **Build Frontend**
   - Login button → `/auth/whoop`
   - Display WHOOP data
   - Handle callbacks

4. **Production Ready**
   - Use HTTPS
   - Secure secret management
   - Rate limiting
   - Error handling

---

## 📚 Documentation

- Full Guide: `WHOOP_OAUTH_SETUP.md`
- WHOOP API: https://developer.whoop.com/docs

---

## ⚡ Common Commands

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Testing
npm test
npm run test:e2e
```

---

## 🆘 Troubleshooting

**"Invalid callback URL"**
→ Check `.env` matches WHOOP Developer Portal

**"Invalid credentials"**
→ Verify `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`

**Token refresh fails**
→ User may need to re-authenticate

**401 on API requests**
→ Check token format: `Bearer {token}`
