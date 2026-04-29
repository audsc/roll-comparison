import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus, CloseReason } from './sessions.entity';
import { SseService } from '../sse/sse.service';
import { ComparisonsService } from '../comparisons/comparisons.service';

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
    private readonly comparisonsService: ComparisonsService,
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
    return this.sessionRepo.findOne({ where: { id }, relations: ['participants'] });
  }

  async close(session: Session, reason: CloseReason): Promise<Session> {
    await this.sessionRepo.update(session.id, {
      status: SessionStatus.CLOSED,
      closeReason: reason,
    });
    const saved = { ...session, status: SessionStatus.CLOSED, closeReason: reason };
    this.sseService.broadcast(saved.id, {
      type: 'session_closed',
      data: { reason },
    });
    this.comparisonsService.generate(saved).catch((err) => {
      console.error(
        `Failed to generate comparison for session ${saved.id}:`,
        err,
      );
    });
    return saved;
  }
}
