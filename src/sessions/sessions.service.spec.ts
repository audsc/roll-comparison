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
