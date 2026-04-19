# WHOOP Workout Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shareable-link flow where multiple WHOOP users authenticate individually, join a session with a defined time window, and receive a side-by-side comparison of their workout and recovery metrics.

**Architecture:** NestJS REST API backed by Postgres (TypeORM). Each session is identified by its UUID (the shareable link token). When a close condition is met (max participants, manual, or time expiry), the backend fetches WHOOP data for all participants and stores a JSONB comparison result. SSE streams real-time join and close events to the Angular frontend.

**Tech Stack:** NestJS 11, TypeORM, Postgres, `@nestjs/jwt`, RxJS Subjects for SSE, AES-256-GCM for token encryption at rest.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/sessions/sessions.entity.ts` | TypeORM entity — sessions table |
| `src/sessions/sessions.module.ts` | Module wiring |
| `src/sessions/sessions.service.ts` | Create, get, close, expiry check |
| `src/sessions/sessions.controller.ts` | POST /sessions, GET /sessions/:id, DELETE /sessions/:id/close, SSE |
| `src/sessions/sessions.service.spec.ts` | Unit tests |
| `src/participants/participants.entity.ts` | TypeORM entity — participants table |
| `src/participants/participants.module.ts` | Module wiring |
| `src/participants/participants.service.ts` | Add participant, get by session |
| `src/participants/participants.service.spec.ts` | Unit tests |
| `src/sse/sse.service.ts` | In-memory Subject map, broadcast/stream/complete |
| `src/sse/sse.module.ts` | Module wiring |
| `src/sse/sse.service.spec.ts` | Unit tests |
| `src/comparisons/comparisons.entity.ts` | TypeORM entity — comparisons table |
| `src/comparisons/comparisons.module.ts` | Module wiring |
| `src/comparisons/comparisons.service.ts` | Fetch WHOOP data for all participants, build JSONB |
| `src/comparisons/comparisons.controller.ts` | GET /comparisons/:sessionId |
| `src/comparisons/comparisons.service.spec.ts` | Unit tests |
| `src/auth/whoop-auth.guard.ts` | Custom AuthGuard that captures sessionId before OAuth redirect |

### Modified files
| File | Change |
|------|--------|
| `src/auth/auth.service.ts` | Add `encrypt(text)` and `decrypt(data)` using AES-256-GCM |
| `src/auth/auth.service.spec.ts` | New file — unit tests for encryption |
| `src/auth/auth.controller.ts` | Store sessionId in session; after callback create participant + JWT + redirect |
| `src/auth/auth.module.ts` | Add JwtModule, ParticipantsModule, WhoopModule |
| `src/app.module.ts` | Add TypeOrmModule, all new modules |
| `src/main.ts` | Enable CORS for Angular origin |
| `.env.example` | Add DATABASE_URL, ENCRYPTION_KEY, ANGULAR_APP_URL, JWT_SECRET |

---

## Task 1: Install dependencies and update environment config

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.example`

- [ ] **Step 1: Install new packages**

```bash
npm install @nestjs/typeorm typeorm pg @nestjs/jwt
```

Expected output: packages added with no peer dependency errors.

- [ ] **Step 2: Update `.env.example`**

Open `.env.example` and replace its contents with:

```env
# Existing WHOOP OAuth
WHOOP_CLIENT_ID=your_actual_client_id
WHOOP_CLIENT_SECRET=your_actual_client_secret
WHOOP_CALLBACK_URL=http://localhost:3000/auth/whoop/callback

# App
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-me-in-production

# New — Postgres
DATABASE_URL=postgresql://postgres:password@localhost:5432/roll_comparison

# New — token encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_32_byte_hex_key_here

# New — Angular frontend origin
ANGULAR_APP_URL=http://localhost:4200

# New — JWT signing secret
JWT_SECRET=change-me-in-production
```

- [ ] **Step 3: Copy to `.env` and fill in real values**

```bash
cp .env.example .env
```

Edit `.env` with your real Postgres credentials and generate an ENCRYPTION_KEY:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: install typeorm, pg, jwt dependencies"
```

---

## Task 2: TypeORM setup and CORS

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Update `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WhoopModule } from './whoop/whoop.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // dev only — disable in production
      }),
    }),
    AuthModule,
    WhoopModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 2: Update `src/main.ts` to enable CORS**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ANGULAR_APP_URL || 'http://localhost:4200',
    credentials: true,
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 3: Start Postgres locally and verify the app connects**

```bash
npm run start:dev
```

Expected: app starts, no TypeORM connection errors in the console.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts src/main.ts
git commit -m "feat: add TypeORM postgres connection and CORS"
```

---

## Task 3: Session entity

**Files:**
- Create: `src/sessions/sessions.entity.ts`

- [ ] **Step 1: Create `src/sessions/sessions.entity.ts`**

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';
import { Participant } from '../participants/participants.entity';

export enum SessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum CloseReason {
  MAX_REACHED = 'max_reached',
  MANUAL = 'manual',
  TIME_EXPIRED = 'time_expired',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ type: 'timestamptz', name: 'window_start' })
  windowStart: Date;

  @Column({ type: 'timestamptz', name: 'window_end' })
  windowEnd: Date;

  @Column({ nullable: true, name: 'max_participants', type: 'int' })
  maxParticipants: number | null;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.OPEN })
  status: SessionStatus;

  @Column({ type: 'enum', enum: CloseReason, nullable: true, name: 'close_reason' })
  closeReason: CloseReason | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Participant, (p) => p.session, { eager: false })
  participants: Participant[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors (Participant entity doesn't exist yet — that's OK, TypeScript lazy-resolves the lambda).

- [ ] **Step 3: Commit**

```bash
git add src/sessions/sessions.entity.ts
git commit -m "feat: add Session TypeORM entity"
```

---

## Task 4: Participant entity

**Files:**
- Create: `src/participants/participants.entity.ts`

- [ ] **Step 1: Create `src/participants/participants.entity.ts`**

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Session } from '../sessions/sessions.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => Session, (s) => s.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ name: 'whoop_user_id' })
  whoopUserId: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'is_creator', default: false })
  isCreator: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/participants/participants.entity.ts
git commit -m "feat: add Participant TypeORM entity"
```

---

## Task 5: Comparison entity

**Files:**
- Create: `src/comparisons/comparisons.entity.ts`

- [ ] **Step 1: Create `src/comparisons/comparisons.entity.ts`**

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Session } from '../sessions/sessions.entity';

export interface HrZones {
  light: number;
  moderate: number;
  vigorous: number;
  peak: number;
}

export interface WorkoutMetrics {
  strain: number;
  avgHr: number;
  maxHr: number;
  calories: number;
  duration: number;
  sport: number;
}

export interface RecoveryMetrics {
  score: number;
  hrv: number;
  restingHr: number;
  sleepPerformance: number;
}

export interface ParticipantResult {
  participantId: string;
  displayName: string;
  workout: WorkoutMetrics | null;
  hrZones: HrZones | null;
  recovery: RecoveryMetrics | null;
}

@Entity('comparisons')
export class Comparison {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @OneToOne(() => Session)
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ type: 'jsonb' })
  results: ParticipantResult[];

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/comparisons/comparisons.entity.ts
git commit -m "feat: add Comparison TypeORM entity with ParticipantResult types"
```

---

## Task 6: Token encryption in AuthService

**Files:**
- Modify: `src/auth/auth.service.ts`
- Create: `src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/auth.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService — encryption', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ENCRYPTION_KEY')
                return 'a'.repeat(64); // 32 bytes as hex = 64 chars
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('encrypt returns a base64 string different from input', () => {
    const result = service.encrypt('my-token');
    expect(result).not.toBe('my-token');
    expect(Buffer.from(result, 'base64').length).toBeGreaterThan(0);
  });

  it('decrypt reverses encrypt', () => {
    const original = 'eyJhbGciOiJSUzI1NiJ9.test-token';
    const encrypted = service.encrypt(original);
    expect(service.decrypt(encrypted)).toBe(original);
  });

  it('each encrypt call produces a different ciphertext (random IV)', () => {
    const a = service.encrypt('same-input');
    const b = service.encrypt('same-input');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-input');
    expect(service.decrypt(b)).toBe('same-input');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=auth.service.spec
```

Expected: FAIL — `encrypt` and `decrypt` are not defined.

- [ ] **Step 3: Add `encrypt` and `decrypt` to `src/auth/auth.service.ts`**

Add these methods inside the `AuthService` class (after the existing `makeWhoopApiRequest` method):

```typescript
import * as crypto from 'crypto';
```

Add at the top of the file (after existing imports), then add these methods to the class:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=auth.service.spec
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat: add AES-256-GCM encrypt/decrypt to AuthService"
```

---

## Task 7: SSE service

**Files:**
- Create: `src/sse/sse.service.ts`
- Create: `src/sse/sse.module.ts`
- Create: `src/sse/sse.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/sse/sse.service.spec.ts`:

```typescript
import { SseService, SseEvent } from './sse.service';

describe('SseService', () => {
  let service: SseService;

  beforeEach(() => {
    service = new SseService();
  });

  it('stream emits events broadcast to that sessionId', (done) => {
    const received: SseEvent[] = [];
    service.stream('session-1').subscribe({ next: (e) => received.push(e) });
    service.broadcast('session-1', { type: 'participant_joined', data: { name: 'Alex' } });
    setTimeout(() => {
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('participant_joined');
      done();
    }, 10);
  });

  it('broadcast to one session does not emit to another', (done) => {
    const received: SseEvent[] = [];
    service.stream('session-2').subscribe({ next: (e) => received.push(e) });
    service.broadcast('session-1', { type: 'session_closed', data: {} });
    setTimeout(() => {
      expect(received).toHaveLength(0);
      done();
    }, 10);
  });

  it('complete closes the stream and removes the subject', (done) => {
    let completed = false;
    service.stream('session-3').subscribe({ complete: () => { completed = true; } });
    service.complete('session-3');
    setTimeout(() => {
      expect(completed).toBe(true);
      done();
    }, 10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=sse.service.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/sse/sse.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface SseEvent {
  type: 'participant_joined' | 'session_closed' | 'comparison_ready';
  data: Record<string, unknown>;
}

@Injectable()
export class SseService {
  private subjects = new Map<string, Subject<SseEvent>>();

  private getOrCreate(sessionId: string): Subject<SseEvent> {
    if (!this.subjects.has(sessionId)) {
      this.subjects.set(sessionId, new Subject<SseEvent>());
    }
    return this.subjects.get(sessionId)!;
  }

  stream(sessionId: string): Observable<SseEvent> {
    return this.getOrCreate(sessionId).asObservable();
  }

  broadcast(sessionId: string, event: SseEvent): void {
    this.subjects.get(sessionId)?.next(event);
  }

  complete(sessionId: string): void {
    this.subjects.get(sessionId)?.complete();
    this.subjects.delete(sessionId);
  }
}
```

- [ ] **Step 4: Create `src/sse/sse.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { SseService } from './sse.service';

@Module({
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sse.service.spec
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sse/
git commit -m "feat: add SseService with per-session Subject streams"
```

---

## Task 8: Sessions module — create and get

**Files:**
- Create: `src/sessions/sessions.service.ts`
- Create: `src/sessions/sessions.controller.ts`
- Create: `src/sessions/sessions.module.ts`
- Create: `src/sessions/sessions.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/sessions/sessions.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionsService } from './sessions.service';
import { Session, SessionStatus, CloseReason } from './sessions.entity';
import { SseService } from '../sse/sse.service';

const mockRepo = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
});

const mockSse = () => ({
  broadcast: jest.fn(),
  complete: jest.fn(),
});

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: jest.Mocked<Partial<Repository<Session>>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(Session), useFactory: mockRepo },
        { provide: SseService, useFactory: mockSse },
      ],
    }).compile();
    service = module.get(SessionsService);
    repo = module.get(getRepositoryToken(Session));
  });

  describe('create', () => {
    it('saves and returns a new session', async () => {
      const dto = {
        label: 'Monday BJJ',
        windowStart: new Date('2026-04-19T18:00:00Z'),
        windowEnd: new Date('2026-04-19T19:00:00Z'),
        maxParticipants: 4,
      };
      const saved = { ...dto, id: 'uuid-1', status: SessionStatus.OPEN, closeReason: null, createdAt: new Date() };
      (repo.save as jest.Mock).mockResolvedValue(saved);
      const result = await service.create(dto);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ label: 'Monday BJJ' }));
      expect(result.id).toBe('uuid-1');
    });
  });

  describe('findOne', () => {
    it('returns the session with participants', async () => {
      const session = { id: 'uuid-1', status: SessionStatus.OPEN, windowEnd: new Date(Date.now() + 3600000), participants: [] };
      (repo.findOne as jest.Mock).mockResolvedValue(session);
      const result = await service.findOne('uuid-1');
      expect(result?.id).toBe('uuid-1');
    });

    it('returns null if not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.findOne('missing');
      expect(result).toBeNull();
    });
  });

  describe('checkAndCloseIfExpired', () => {
    it('returns session unchanged if window has not ended', async () => {
      const session = { id: 'uuid-1', status: SessionStatus.OPEN, windowEnd: new Date(Date.now() + 3600000) } as Session;
      const result = await service.checkAndCloseIfExpired(session);
      expect(result.status).toBe(SessionStatus.OPEN);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('closes session if window has ended', async () => {
      const session = { id: 'uuid-1', status: SessionStatus.OPEN, windowEnd: new Date(Date.now() - 1000) } as Session;
      const closed = { ...session, status: SessionStatus.CLOSED, closeReason: CloseReason.TIME_EXPIRED };
      (repo.save as jest.Mock).mockResolvedValue(closed);
      const result = await service.checkAndCloseIfExpired(session);
      expect(result.status).toBe(SessionStatus.CLOSED);
      expect(result.closeReason).toBe(CloseReason.TIME_EXPIRED);
    });

    it('does not re-close an already closed session', async () => {
      const session = { id: 'uuid-1', status: SessionStatus.CLOSED, windowEnd: new Date(Date.now() - 1000) } as Session;
      const result = await service.checkAndCloseIfExpired(session);
      expect(result.status).toBe(SessionStatus.CLOSED);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=sessions.service.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/sessions/sessions.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus, CloseReason } from './sessions.entity';
import { SseService } from '../sse/sse.service';

export interface CreateSessionDto {
  label: string;
  windowStart: Date;
  windowEnd: Date;
  maxParticipants?: number | null;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly sseService: SseService,
  ) {}

  async create(dto: CreateSessionDto): Promise<Session> {
    return this.sessionRepo.save({
      label: dto.label,
      windowStart: dto.windowStart,
      windowEnd: dto.windowEnd,
      maxParticipants: dto.maxParticipants ?? null,
      status: SessionStatus.OPEN,
      closeReason: null,
    });
  }

  async findOne(id: string): Promise<Session | null> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['participants'],
    });
    if (!session) return null;
    return this.checkAndCloseIfExpired(session);
  }

  async checkAndCloseIfExpired(session: Session): Promise<Session> {
    if (session.status === SessionStatus.CLOSED) return session;
    if (new Date() > session.windowEnd) {
      return this.close(session, CloseReason.TIME_EXPIRED);
    }
    return session;
  }

  async close(session: Session, reason: CloseReason): Promise<Session> {
    session.status = SessionStatus.CLOSED;
    session.closeReason = reason;
    const saved = await this.sessionRepo.save(session);
    this.sseService.broadcast(saved.id, {
      type: 'session_closed',
      data: { reason },
    });
    return saved;
  }
}
```

- [ ] **Step 4: Create `src/sessions/sessions.controller.ts`**

```typescript
import {
  Controller, Post, Get, Delete, Param, Body,
  NotFoundException, Sse, HttpCode,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SessionsService, CreateSessionDto } from './sessions.service';
import { SseService } from '../sse/sse.service';

interface CreateSessionBody {
  label: string;
  windowStart: string;
  windowEnd: string;
  maxParticipants?: number;
}

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sseService: SseService,
  ) {}

  @Post()
  async create(@Body() body: CreateSessionBody) {
    const session = await this.sessionsService.create({
      label: body.label,
      windowStart: new Date(body.windowStart),
      windowEnd: new Date(body.windowEnd),
      maxParticipants: body.maxParticipants ?? null,
    });
    return { sessionId: session.id };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) throw new NotFoundException('Session not found');
    return {
      id: session.id,
      label: session.label,
      windowStart: session.windowStart,
      windowEnd: session.windowEnd,
      maxParticipants: session.maxParticipants,
      status: session.status,
      closeReason: session.closeReason,
      participants: (session.participants ?? []).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isCreator: p.isCreator,
        joinedAt: p.joinedAt,
      })),
    };
  }

  @Delete(':id/close')
  @HttpCode(200)
  async close(@Param('id') id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) throw new NotFoundException('Session not found');
    const { CloseReason } = await import('./sessions.entity');
    const closed = await this.sessionsService.close(session, CloseReason.MANUAL);
    return { status: closed.status, closeReason: closed.closeReason };
  }

  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.sseService.stream(id).pipe(
      map((event) => ({ data: event }) as MessageEvent),
    );
  }
}
```

- [ ] **Step 5: Create `src/sessions/sessions.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './sessions.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [TypeOrmModule.forFeature([Session]), SseModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=sessions.service.spec
```

Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sessions/
git commit -m "feat: add Sessions module with create, get, and expiry-check logic"
```

---

## Task 9: Participants module

**Files:**
- Create: `src/participants/participants.service.ts`
- Create: `src/participants/participants.module.ts`
- Create: `src/participants/participants.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/participants/participants.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParticipantsService, AddParticipantDto } from './participants.service';
import { Participant } from './participants.entity';

const mockRepo = () => ({ save: jest.fn(), find: jest.fn(), count: jest.fn() });

describe('ParticipantsService', () => {
  let service: ParticipantsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ParticipantsService,
        { provide: getRepositoryToken(Participant), useFactory: mockRepo },
      ],
    }).compile();
    service = module.get(ParticipantsService);
    repo = module.get(getRepositoryToken(Participant));
  });

  describe('add', () => {
    it('saves and returns a participant', async () => {
      const dto: AddParticipantDto = {
        sessionId: 'session-1',
        whoopUserId: 'whoop-99',
        displayName: 'Alex',
        accessToken: 'encrypted-at',
        refreshToken: 'encrypted-rt',
        isCreator: true,
      };
      const saved = { ...dto, id: 'part-1', joinedAt: new Date() };
      (repo.save as jest.Mock).mockResolvedValue(saved);
      const result = await service.add(dto);
      expect(result.id).toBe('part-1');
      expect(repo.save).toHaveBeenCalledWith(dto);
    });
  });

  describe('getBySession', () => {
    it('returns all participants for a session', async () => {
      const parts = [{ id: 'p1', sessionId: 'session-1' }, { id: 'p2', sessionId: 'session-1' }];
      (repo.find as jest.Mock).mockResolvedValue(parts);
      const result = await service.getBySession('session-1');
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({ where: { sessionId: 'session-1' } });
    });
  });

  describe('countBySession', () => {
    it('returns the participant count for a session', async () => {
      (repo.count as jest.Mock).mockResolvedValue(3);
      const result = await service.countBySession('session-1');
      expect(result).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=participants.service.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/participants/participants.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './participants.entity';

export interface AddParticipantDto {
  sessionId: string;
  whoopUserId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  isCreator: boolean;
}

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantRepo: Repository<Participant>,
  ) {}

  async add(dto: AddParticipantDto): Promise<Participant> {
    return this.participantRepo.save(dto);
  }

  async getBySession(sessionId: string): Promise<Participant[]> {
    return this.participantRepo.find({ where: { sessionId } });
  }

  async countBySession(sessionId: string): Promise<number> {
    return this.participantRepo.count({ where: { sessionId } });
  }
}
```

- [ ] **Step 4: Create `src/participants/participants.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Participant } from './participants.entity';
import { ParticipantsService } from './participants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Participant])],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=participants.service.spec
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/participants/
git commit -m "feat: add Participants module"
```

---

## Task 10: Extend auth flow — sessionId through OAuth, redirect to Angular

**Files:**
- Create: `src/auth/whoop-auth.guard.ts`
- Modify: `src/auth/auth.controller.ts`
- Modify: `src/auth/auth.module.ts`

- [ ] **Step 1: Create `src/auth/whoop-auth.guard.ts`**

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class WhoopAuthGuard extends AuthGuard('whoop') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (req.query.sessionId) {
      req.session.pendingSessionId = req.query.sessionId;
      req.session.pendingIsCreator = req.query.role === 'creator';
    }
    return super.canActivate(context);
  }
}
```

- [ ] **Step 2: Replace `src/auth/auth.controller.ts`**

```typescript
import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { WhoopAuthGuard } from './whoop-auth.guard';
import { ParticipantsService } from '../participants/participants.service';
import { AuthService } from './auth.service';
import { WhoopService } from '../whoop/whoop.service';
import { SessionsService } from '../sessions/sessions.service';
import { SseService } from '../sse/sse.service';
import { CloseReason } from '../sessions/sessions.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly authService: AuthService,
    private readonly whoopService: WhoopService,
    private readonly sessionsService: SessionsService,
    private readonly sseService: SseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('whoop')
  @UseGuards(WhoopAuthGuard)
  whoopAuth() {
    // Guard handles the redirect to WHOOP
  }

  @Get('whoop/callback')
  @UseGuards(AuthGuard('whoop'))
  async whoopAuthCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user as { accessToken: string; refreshToken: string };
    const sessionId: string | undefined = req.session.pendingSessionId;
    const isCreator: boolean = req.session.pendingIsCreator ?? false;

    // Clear pending session data from session
    delete req.session.pendingSessionId;
    delete req.session.pendingIsCreator;

    if (!sessionId) {
      return res.json({ message: 'Authenticated with WHOOP', accessToken, refreshToken });
    }

    const session = await this.sessionsService.findOne(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const profile = await this.whoopService.getUserProfile(accessToken, refreshToken);
    const participant = await this.participantsService.add({
      sessionId,
      whoopUserId: String(profile.user_id),
      displayName: profile.first_name ?? 'Athlete',
      accessToken: this.authService.encrypt(accessToken),
      refreshToken: this.authService.encrypt(refreshToken),
      isCreator,
    });

    const count = await this.participantsService.countBySession(sessionId);
    this.sseService.broadcast(sessionId, {
      type: 'participant_joined',
      data: { name: participant.displayName, count, maxParticipants: session.maxParticipants },
    });

    if (session.maxParticipants && count >= session.maxParticipants) {
      await this.sessionsService.close(session, CloseReason.MAX_REACHED);
    }

    const participantToken = this.jwtService.sign({ participantId: participant.id, sessionId });
    const angularUrl = this.configService.get<string>('ANGULAR_APP_URL') ?? 'http://localhost:4200';
    return res.redirect(`${angularUrl}/session/${sessionId}/lobby?participantToken=${participantToken}`);
  }

  @Get('status')
  getAuthStatus() {
    return {
      message: 'Auth endpoints available',
      endpoints: { login: '/auth/whoop', callback: '/auth/whoop/callback' },
    };
  }
}
```

- [ ] **Step 3: Update `src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { WhoopStrategy } from './whoop.strategy';
import { AuthService } from './auth.service';
import { SessionSerializer } from './session.serializer';
import { ParticipantsModule } from '../participants/participants.module';
import { WhoopModule } from '../whoop/whoop.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    ParticipantsModule,
    WhoopModule,
    SessionsModule,
    SseModule,
  ],
  controllers: [AuthController],
  providers: [WhoopStrategy, AuthService, SessionSerializer],
  exports: [PassportModule, AuthService],
})
export class AuthModule {}
```

- [ ] **Step 4: Verify the app starts**

```bash
npm run start:dev
```

Expected: app starts, no circular dependency or missing provider errors.

- [ ] **Step 5: Commit**

```bash
git add src/auth/
git commit -m "feat: extend auth flow to capture sessionId and redirect to Angular after OAuth"
```

---

## Task 11: Comparisons module

**Files:**
- Create: `src/comparisons/comparisons.service.ts`
- Create: `src/comparisons/comparisons.controller.ts`
- Create: `src/comparisons/comparisons.module.ts`
- Create: `src/comparisons/comparisons.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/comparisons/comparisons.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComparisonsService } from './comparisons.service';
import { Comparison } from './comparisons.entity';
import { ParticipantsService } from '../participants/participants.service';
import { WhoopService } from '../whoop/whoop.service';
import { AuthService } from '../auth/auth.service';
import { Session, SessionStatus, CloseReason } from '../sessions/sessions.entity';
import { SseService } from '../sse/sse.service';

const mockRepo = () => ({ save: jest.fn(), findOne: jest.fn() });

describe('ComparisonsService', () => {
  let service: ComparisonsService;
  let repo: ReturnType<typeof mockRepo>;
  let participantsService: jest.Mocked<Partial<ParticipantsService>>;
  let whoopService: jest.Mocked<Partial<WhoopService>>;
  let authService: jest.Mocked<Partial<AuthService>>;
  let sseService: jest.Mocked<Partial<SseService>>;

  const session: Session = {
    id: 'session-1',
    label: 'Test',
    windowStart: new Date('2026-04-19T18:00:00Z'),
    windowEnd: new Date('2026-04-19T19:00:00Z'),
    maxParticipants: null,
    status: SessionStatus.CLOSED,
    closeReason: CloseReason.MANUAL,
    createdAt: new Date(),
    participants: [],
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ComparisonsService,
        { provide: getRepositoryToken(Comparison), useFactory: mockRepo },
        { provide: ParticipantsService, useValue: { getBySession: jest.fn() } },
        { provide: WhoopService, useValue: { getWorkouts: jest.fn(), getRecovery: jest.fn() } },
        { provide: AuthService, useValue: { decrypt: jest.fn() } },
        { provide: SseService, useValue: { broadcast: jest.fn(), complete: jest.fn() } },
      ],
    }).compile();
    service = module.get(ComparisonsService);
    repo = module.get(getRepositoryToken(Comparison));
    participantsService = module.get(ParticipantsService);
    whoopService = module.get(WhoopService);
    authService = module.get(AuthService);
    sseService = module.get(SseService);
  });

  it('generates a comparison with null results when WHOOP returns no data', async () => {
    (participantsService.getBySession as jest.Mock).mockResolvedValue([
      { id: 'p1', displayName: 'Alex', accessToken: 'enc-at', refreshToken: 'enc-rt' },
    ]);
    (authService.decrypt as jest.Mock).mockReturnValue('plain-token');
    (whoopService.getWorkouts as jest.Mock).mockResolvedValue({ records: [] });
    (whoopService.getRecovery as jest.Mock).mockResolvedValue({ records: [] });
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve({ ...c, id: 'comp-1', generatedAt: new Date() }));

    const result = await service.generate(session);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].workout).toBeNull();
    expect(result.results[0].hrZones).toBeNull();
    expect(result.results[0].recovery).toBeNull();
    expect(sseService.broadcast).toHaveBeenCalledWith('session-1', expect.objectContaining({ type: 'comparison_ready' }));
    expect(sseService.complete).toHaveBeenCalledWith('session-1');
  });

  it('maps WHOOP workout data to WorkoutMetrics', async () => {
    (participantsService.getBySession as jest.Mock).mockResolvedValue([
      { id: 'p1', displayName: 'Alex', accessToken: 'enc-at', refreshToken: 'enc-rt' },
    ]);
    (authService.decrypt as jest.Mock).mockReturnValue('plain-token');
    (whoopService.getWorkouts as jest.Mock).mockResolvedValue({
      records: [{
        sport_id: 3,
        score: {
          strain: 14.2,
          average_heart_rate: 142,
          max_heart_rate: 183,
          kilojoule: 2594,
          duration_millis: 3600000,
          zone_duration: {
            zone_zero_milli: 0,
            zone_one_milli: 720000,
            zone_two_milli: 1080000,
            zone_three_milli: 1320000,
            zone_four_milli: 360000,
            zone_five_milli: 120000,
          },
        },
      }],
    });
    (whoopService.getRecovery as jest.Mock).mockResolvedValue({
      records: [{
        score: { recovery_score: 72, hrv_rmssd_milli: 68, resting_heart_rate: 52, sleep_performance_percentage: 84 },
      }],
    });
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve({ ...c, id: 'comp-1', generatedAt: new Date() }));

    const result = await service.generate(session);
    const r = result.results[0];
    expect(r.workout?.strain).toBe(14.2);
    expect(r.workout?.avgHr).toBe(142);
    expect(r.hrZones?.light).toBe(12);
    expect(r.hrZones?.peak).toBe(8);
    expect(r.recovery?.score).toBe(72);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=comparisons.service.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/comparisons/comparisons.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comparison, ParticipantResult } from './comparisons.entity';
import { Session } from '../sessions/sessions.entity';
import { ParticipantsService } from '../participants/participants.service';
import { WhoopService } from '../whoop/whoop.service';
import { AuthService } from '../auth/auth.service';
import { SseService } from '../sse/sse.service';
import { Participant } from '../participants/participants.entity';

@Injectable()
export class ComparisonsService {
  constructor(
    @InjectRepository(Comparison)
    private readonly comparisonRepo: Repository<Comparison>,
    private readonly participantsService: ParticipantsService,
    private readonly whoopService: WhoopService,
    private readonly authService: AuthService,
    private readonly sseService: SseService,
  ) {}

  async generate(session: Session): Promise<Comparison> {
    const participants = await this.participantsService.getBySession(session.id);
    const results = await Promise.all(
      participants.map((p) => this.buildResult(p, session)),
    );
    const comparison = await this.comparisonRepo.save({ sessionId: session.id, results });
    this.sseService.broadcast(session.id, {
      type: 'comparison_ready',
      data: { comparisonId: comparison.id },
    });
    this.sseService.complete(session.id);
    return comparison;
  }

  async findBySession(sessionId: string): Promise<Comparison | null> {
    return this.comparisonRepo.findOne({ where: { sessionId } });
  }

  private async buildResult(participant: Participant, session: Session): Promise<ParticipantResult> {
    const accessToken = this.authService.decrypt(participant.accessToken);
    const refreshToken = this.authService.decrypt(participant.refreshToken);
    const start = session.windowStart.toISOString();
    const end = session.windowEnd.toISOString();

    const [workoutsResult, recoveryResult] = await Promise.allSettled([
      this.whoopService.getWorkouts(accessToken, refreshToken, start, end),
      this.whoopService.getRecovery(accessToken, refreshToken, start, end),
    ]);

    const workout =
      workoutsResult.status === 'fulfilled'
        ? (workoutsResult.value?.records?.[0] ?? null)
        : null;
    const recovery =
      recoveryResult.status === 'fulfilled'
        ? (recoveryResult.value?.records?.[0] ?? null)
        : null;

    return {
      participantId: participant.id,
      displayName: participant.displayName,
      workout: workout?.score
        ? {
            strain: workout.score.strain,
            avgHr: workout.score.average_heart_rate,
            maxHr: workout.score.max_heart_rate,
            calories: Math.round(workout.score.kilojoule * 0.239),
            duration: Math.round(workout.score.duration_millis / 1000),
            sport: workout.sport_id,
          }
        : null,
      hrZones: workout?.score?.zone_duration
        ? {
            light: Math.round(workout.score.zone_duration.zone_one_milli / 60000),
            moderate: Math.round(workout.score.zone_duration.zone_two_milli / 60000),
            vigorous: Math.round(workout.score.zone_duration.zone_three_milli / 60000),
            peak: Math.round(
              (workout.score.zone_duration.zone_four_milli +
                workout.score.zone_duration.zone_five_milli) /
                60000,
            ),
          }
        : null,
      recovery: recovery?.score
        ? {
            score: recovery.score.recovery_score,
            hrv: recovery.score.hrv_rmssd_milli,
            restingHr: recovery.score.resting_heart_rate,
            sleepPerformance: recovery.score.sleep_performance_percentage,
          }
        : null,
    };
  }
}
```

- [ ] **Step 4: Create `src/comparisons/comparisons.controller.ts`**

```typescript
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ComparisonsService } from './comparisons.service';

@Controller('comparisons')
export class ComparisonsController {
  constructor(private readonly comparisonsService: ComparisonsService) {}

  @Get(':sessionId')
  async findBySession(@Param('sessionId') sessionId: string) {
    const comparison = await this.comparisonsService.findBySession(sessionId);
    if (!comparison) throw new NotFoundException('Comparison not found');
    return comparison;
  }
}
```

- [ ] **Step 5: Create `src/comparisons/comparisons.module.ts`**

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comparison } from './comparisons.entity';
import { ComparisonsService } from './comparisons.service';
import { ComparisonsController } from './comparisons.controller';
import { ParticipantsModule } from '../participants/participants.module';
import { WhoopModule } from '../whoop/whoop.module';
import { AuthModule } from '../auth/auth.module';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comparison]),
    ParticipantsModule,
    WhoopModule,
    forwardRef(() => AuthModule), // AuthModule → SessionsModule → ComparisonsModule cycle
    SseModule,
  ],
  controllers: [ComparisonsController],
  providers: [ComparisonsService],
  exports: [ComparisonsService],
})
export class ComparisonsModule {}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=comparisons.service.spec
```

Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/comparisons/
git commit -m "feat: add Comparisons module — fetch WHOOP data and build result JSONB"
```

---

## Task 12: Wire close-triggers to comparison generation, update AppModule

**Files:**
- Modify: `src/sessions/sessions.service.ts`
- Modify: `src/sessions/sessions.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Update `src/sessions/sessions.service.ts` to trigger comparison on close**

Add `ComparisonsService` as a dependency and call `generate` when a session closes. Replace the `close` method:

```typescript
// Add to constructor parameter list:
private readonly comparisonsService: ComparisonsService,
```

And replace the `close` method body:

```typescript
async close(session: Session, reason: CloseReason): Promise<Session> {
  session.status = SessionStatus.CLOSED;
  session.closeReason = reason;
  const saved = await this.sessionRepo.save(session);
  this.sseService.broadcast(saved.id, {
    type: 'session_closed',
    data: { reason },
  });
  // Fire-and-forget — comparison generation broadcasts comparison_ready when done
  this.comparisonsService.generate(saved).catch((err) => {
    console.error(`Failed to generate comparison for session ${saved.id}:`, err);
  });
  return saved;
}
```

Add the import at the top of the file:

```typescript
import { ComparisonsService } from '../comparisons/comparisons.service';
```

- [ ] **Step 2: Update `src/sessions/sessions.module.ts` to import ComparisonsModule**

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './sessions.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SseModule } from '../sse/sse.module';
import { ComparisonsModule } from '../comparisons/comparisons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    SseModule,
    forwardRef(() => ComparisonsModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
```

- [ ] **Step 3: Update `src/app.module.ts` to register all modules**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WhoopModule } from './whoop/whoop.module';
import { SessionsModule } from './sessions/sessions.module';
import { ParticipantsModule } from './participants/participants.module';
import { ComparisonsModule } from './comparisons/comparisons.module';
import { SseModule } from './sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),
    AuthModule,
    WhoopModule,
    SessionsModule,
    ParticipantsModule,
    ComparisonsModule,
    SseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: Update `sessions.service.spec.ts` to mock ComparisonsService**

Add to the `providers` array in the test module:

```typescript
{ provide: ComparisonsService, useValue: { generate: jest.fn().mockResolvedValue({}) } },
```

And add the import:

```typescript
import { ComparisonsService } from '../comparisons/comparisons.service';
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Start the app and verify no errors**

```bash
npm run start:dev
```

Expected: app starts, Postgres tables auto-created (`sessions`, `participants`, `comparisons`), no errors.

- [ ] **Step 7: Commit**

```bash
git add src/sessions/sessions.service.ts src/sessions/sessions.module.ts src/app.module.ts src/sessions/sessions.service.spec.ts
git commit -m "feat: wire comparison generation on session close, register all modules"
```

---

## Task 13: Smoke test the full flow

No new files — manual verification using curl.

- [ ] **Step 1: Start the app**

```bash
npm run start:dev
```

- [ ] **Step 2: Create a session**

```bash
curl -s -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Test Workout",
    "windowStart": "2026-04-19T18:00:00Z",
    "windowEnd": "2026-04-19T19:00:00Z",
    "maxParticipants": 2
  }'
```

Expected response: `{ "sessionId": "<uuid>" }` — save this UUID.

- [ ] **Step 3: Get the session**

```bash
curl -s http://localhost:3000/sessions/<sessionId>
```

Expected: JSON with `status: "open"`, empty `participants` array.

- [ ] **Step 4: Subscribe to SSE in one terminal**

```bash
curl -N http://localhost:3000/sessions/<sessionId>/events
```

Leave this running.

- [ ] **Step 5: Manually close the session**

In a second terminal:

```bash
curl -s -X DELETE http://localhost:3000/sessions/<sessionId>/close
```

Expected: SSE terminal receives `data: {"type":"session_closed","data":{"reason":"manual"}}`, followed shortly by `data: {"type":"comparison_ready",...}`.

- [ ] **Step 6: Get the comparison**

```bash
curl -s http://localhost:3000/comparisons/<sessionId>
```

Expected: JSON with `results: []` (no participants joined, so empty array).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: complete WHOOP workout comparison backend"
```

---

## Post-Implementation Notes

- **WHOOP OAuth full flow** requires real credentials and a browser — test manually by navigating to `http://localhost:3000/auth/whoop?sessionId=<id>&role=creator`
- **`synchronize: true`** auto-creates tables in dev. Before any production deployment, switch to TypeORM migrations
- **Token encryption** requires `ENCRYPTION_KEY` to be exactly 64 hex characters (32 bytes). Losing this key means stored tokens cannot be decrypted
- **Circular dependency** between `SessionsModule` and `ComparisonsModule` is resolved with `forwardRef()` — this is intentional and safe in NestJS
