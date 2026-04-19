import {
  Controller, Post, Get, Delete, Param, Body,
  NotFoundException, Sse, HttpCode,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SessionsService, CreateSessionDto } from './sessions.service';
import { SseService } from '../sse/sse.service';
import { CloseReason, SessionStatus } from './sessions.entity';

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
    if (session.status === SessionStatus.CLOSED) {
      return { status: session.status, closeReason: session.closeReason };
    }
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
