# WHOOP Workout Comparison — Design Spec

**Date:** 2026-04-19
**Stack:** NestJS (backend) · Postgres · Angular (separate frontend)

---

## Overview

A shareable-link flow that lets multiple WHOOP users compare metrics from a workout they did together. The session creator specifies a time window; anyone with the link authenticates with WHOOP and joins. When a close condition is met the backend fetches everyone's data and stores a comparison result.

---

## User Flow

### Creator
1. Opens Angular app, fills in session form: label, date, start time, end time, optional max participants
2. `POST /sessions` → receives `sessionId`
3. Redirected to WHOOP OAuth: `/auth/whoop?sessionId=<id>&role=creator`
4. After auth, redirected back to Angular: `/session/:id/lobby` with a `participantToken`
5. Copies shareable link (`/join/:sessionId`) and shares it
6. Watches the lobby — participant list updates live via SSE
7. Can click "Generate Comparison" to manually close, or waits for auto-close

### Participant
1. Opens shareable link → Angular `/join/:sessionId`
2. Sees session info: label, time window, who has joined so far
3. Clicks "Join with WHOOP" → redirected to `/auth/whoop?sessionId=<id>`
4. After auth, redirected back to Angular lobby
5. Watches others join via SSE

### Session Close (first condition wins)
- **Max participants reached** — triggers immediately when the last participant joins
- **Manual** — creator clicks "Generate Comparison"
- **Time expiry** — `window_end < NOW()` checked on every request to that session; no cron needed

On close: backend fetches workout + recovery data for all participants, stores result in `comparisons`, broadcasts `comparison_ready` via SSE. All lobby clients navigate to the result view.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create session, returns `{ sessionId }` |
| `GET` | `/sessions/:id` | Session info + participant list |
| `DELETE` | `/sessions/:id/close` | Creator manually closes session |
| `GET` | `/sessions/:id/events` | SSE stream |
| `GET` | `/auth/whoop?sessionId=:id` | Initiate WHOOP OAuth for a participant |
| `GET` | `/auth/whoop/callback` | OAuth callback — stores tokens, redirects to Angular |
| `GET` | `/comparisons/:sessionId` | Stored comparison result |

### SSE Events (`GET /sessions/:id/events`)
```json
{ "type": "participant_joined", "data": { "name": "Alex", "count": 2, "maxParticipants": 4 } }
{ "type": "session_closed",    "data": { "reason": "max_reached | manual | time_expired" } }
{ "type": "comparison_ready",  "data": { "comparisonId": "<uuid>" } }
```

---

## Data Model

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK — doubles as the shareable link token |
| `label` | `varchar(255)` | e.g. "Monday Night BJJ" |
| `window_start` | `timestamptz` | Start of workout window |
| `window_end` | `timestamptz` | End of workout window — also the time-based close trigger |
| `max_participants` | `int` | Nullable — omit for no cap |
| `status` | `enum` | `open` \| `closed` |
| `close_reason` | `enum` | Nullable: `max_reached` \| `manual` \| `time_expired` |
| `created_at` | `timestamptz` | |

### `participants`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions.id` |
| `whoop_user_id` | `varchar` | From WHOOP profile after auth |
| `display_name` | `varchar(255)` | First name from WHOOP profile |
| `access_token` | `text` | AES-256 encrypted at rest |
| `refresh_token` | `text` | AES-256 encrypted at rest |
| `is_creator` | `boolean` | Creator can trigger manual close |
| `joined_at` | `timestamptz` | |

### `comparisons`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `sessions.id` (1:1) |
| `results` | `jsonb` | Array of per-participant metrics |
| `generated_at` | `timestamptz` | |

If a participant has no workout in the time window, their `results` entry is still included with `workout`, `hrZones`, and `recovery` set to `null` so the comparison view can show "no data" rather than omitting them.

#### `results` JSONB shape (per participant)
```json
{
  "participantId": "<uuid>",
  "displayName": "Alex",
  "workout": {
    "strain": 14.2,
    "avgHr": 142,
    "maxHr": 183,
    "calories": 620,
    "duration": 3600,
    "sport": "Brazilian Jiu Jitsu"
  },
  "hrZones": {
    "light": 12,
    "moderate": 18,
    "vigorous": 22,
    "peak": 8
  },
  "recovery": {
    "score": 72,
    "hrv": 68,
    "restingHr": 52,
    "sleepPerformance": 84
  }
}
```

---

## Module Structure

```
src/
├── auth/                      (existing — extend)
│   ├── auth.controller.ts     add sessionId param + Angular redirect after OAuth
│   ├── auth.service.ts        add AES-256 token encryption/decryption
│   └── whoop.strategy.ts      pass sessionId through OAuth state param
│
├── sessions/                  (new)
│   ├── sessions.module.ts
│   ├── sessions.controller.ts
│   ├── sessions.service.ts    create/close logic, request-time expiry check
│   └── sessions.entity.ts     TypeORM entity
│
├── participants/              (new)
│   ├── participants.module.ts
│   ├── participants.service.ts
│   └── participants.entity.ts
│
├── comparisons/               (new)
│   ├── comparisons.module.ts
│   ├── comparisons.controller.ts
│   ├── comparisons.service.ts  orchestrates WHOOP fetches + builds result JSONB
│   └── comparisons.entity.ts
│
├── sse/                       (new)
│   └── sse.service.ts         in-memory Subject map keyed by sessionId; broadcast to all subscribers
│
└── whoop/                     (existing — keep as-is)
```

---

## Key Technical Details

### Token Encryption
WHOOP access/refresh tokens stored encrypted in Postgres using AES-256-GCM. Requires `ENCRYPTION_KEY` env var (32-byte hex). Encryption/decryption handled in `AuthService`.

### OAuth State Param
`sessionId` passed through the WHOOP OAuth flow via the `state` parameter so the callback knows which session to attach the new participant to.

### Angular Redirect
After OAuth callback, backend redirects to:
```
<ANGULAR_APP_URL>/session/:sessionId/lobby?participantToken=<jwt>
```
`ANGULAR_APP_URL` is an env var. The `participantToken` is a short-lived JWT the Angular app uses to identify the participant in subsequent requests.

### Time Expiry Check
Every handler in `SessionsService` that reads a session calls `checkAndCloseIfExpired(session)` before returning. No scheduler or cron job. If `window_end < NOW()` and status is not `closed`, the session is closed inline and `comparison_ready` is broadcast via SSE.

### SSE
`SseService` holds an in-memory `Map<sessionId, Subject<SseEvent>>`. `GET /sessions/:id/events` returns an `Observable` from that Subject. On server restart all clients reconnect naturally — no persistence needed for the event stream.

---

## Environment Variables

```env
# Existing
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_CALLBACK_URL=http://localhost:3000/auth/whoop/callback

# New
DATABASE_URL=postgresql://user:pass@localhost:5432/roll_comparison
ENCRYPTION_KEY=<32-byte hex>
ANGULAR_APP_URL=http://localhost:4200
JWT_SECRET=<random string>
```
