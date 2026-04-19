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
