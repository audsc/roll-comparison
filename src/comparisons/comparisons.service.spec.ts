import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComparisonsService } from './comparisons.service';
import { Comparison } from './comparisons.entity';
import { ParticipantsService } from '../participants/participants.service';
import { WhoopService } from '../whoop/whoop.service';
import { AuthService } from '../auth/auth.service';
import {
  Session,
  SessionStatus,
  CloseReason,
} from '../sessions/sessions.entity';
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
        {
          provide: WhoopService,
          useValue: { getWorkouts: jest.fn(), getRecovery: jest.fn() },
        },
        { provide: AuthService, useValue: { decrypt: jest.fn() } },
        {
          provide: SseService,
          useValue: { broadcast: jest.fn(), complete: jest.fn() },
        },
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
      {
        id: 'p1',
        displayName: 'Alex',
        accessToken: 'enc-at',
        refreshToken: 'enc-rt',
      },
    ]);
    (authService.decrypt as jest.Mock).mockReturnValue('plain-token');
    (whoopService.getWorkouts as jest.Mock).mockResolvedValue({ records: [] });
    (whoopService.getRecovery as jest.Mock).mockResolvedValue({ records: [] });
    repo.save.mockImplementation((c) =>
      Promise.resolve({ ...c, id: 'comp-1', generatedAt: new Date() }),
    );

    const result = await service.generate(session);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].workout).toBeNull();
    expect(result.results[0].hrZones).toBeNull();
    expect(result.results[0].recovery).toBeNull();
    expect(sseService.broadcast).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ type: 'comparison_ready' }),
    );
    expect(sseService.complete).toHaveBeenCalledWith('session-1');
  });

  it('maps WHOOP workout data to WorkoutMetrics', async () => {
    (participantsService.getBySession as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        displayName: 'Alex',
        accessToken: 'enc-at',
        refreshToken: 'enc-rt',
      },
    ]);
    (authService.decrypt as jest.Mock).mockReturnValue('plain-token');
    (whoopService.getWorkouts as jest.Mock).mockResolvedValue({
      records: [
        {
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
        },
      ],
    });
    (whoopService.getRecovery as jest.Mock).mockResolvedValue({
      records: [
        {
          score: {
            recovery_score: 72,
            hrv_rmssd_milli: 68,
            resting_heart_rate: 52,
            sleep_performance_percentage: 84,
          },
        },
      ],
    });
    repo.save.mockImplementation((c) =>
      Promise.resolve({ ...c, id: 'comp-1', generatedAt: new Date() }),
    );

    const result = await service.generate(session);
    const r = result.results[0];
    expect(r.workout?.strain).toBe(14.2);
    expect(r.workout?.avgHr).toBe(142);
    expect(r.hrZones?.light).toBe(12);
    expect(r.hrZones?.peak).toBe(8);
    expect(r.recovery?.score).toBe(72);
  });
});
