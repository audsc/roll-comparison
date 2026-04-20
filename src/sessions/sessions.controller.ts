import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  NotFoundException,
  Sse,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
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

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sseService: SseService,
  ) {}

  @ApiOperation({ summary: 'Create a comparison session' })
  @ApiBody({
    schema: {
      example: {
        label: 'Monday Night BJJ',
        windowStart: '2026-04-20T18:00:00Z',
        windowEnd: '2026-04-20T19:00:00Z',
        maxParticipants: 4,
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Returns the new sessionId', schema: { example: { sessionId: 'uuid' } } })
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

  @ApiOperation({ summary: 'Get session info and participant list' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session details with participants' })
  @ApiResponse({ status: 404, description: 'Session not found' })
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

  @ApiOperation({ summary: 'Manually close a session and trigger comparison generation' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session closed' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @Delete(':id/close')
  @HttpCode(200)
  async close(@Param('id') id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === SessionStatus.CLOSED) {
      return { status: session.status, closeReason: session.closeReason };
    }
    const closed = await this.sessionsService.close(
      session,
      CloseReason.MANUAL,
    );
    return { status: closed.status, closeReason: closed.closeReason };
  }

  @ApiOperation({ summary: 'Subscribe to SSE events for a session (participant_joined, session_closed, comparison_ready)' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @Sse(':id/events')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.sseService
      .stream(id)
      .pipe(map((event) => ({ data: event }) as MessageEvent));
  }
}
