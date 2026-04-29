import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant } from './participants.entity';

export interface AddParticipantDto {
  sessionId: string;
  whoopUserId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
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
