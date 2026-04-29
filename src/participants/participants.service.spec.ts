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
      repo.save.mockResolvedValue(saved);
      const result = await service.add(dto);
      expect(result.id).toBe('part-1');
      expect(repo.save).toHaveBeenCalledWith(dto);
    });
  });

  describe('getBySession', () => {
    it('returns all participants for a session', async () => {
      const parts = [
        { id: 'p1', sessionId: 'session-1' },
        { id: 'p2', sessionId: 'session-1' },
      ];
      repo.find.mockResolvedValue(parts);
      const result = await service.getBySession('session-1');
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
      });
    });
  });

  describe('countBySession', () => {
    it('returns the participant count for a session', async () => {
      repo.count.mockResolvedValue(3);
      const result = await service.countBySession('session-1');
      expect(result).toBe(3);
    });
  });
});
