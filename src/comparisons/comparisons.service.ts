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
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = this.authService.decrypt(participant.accessToken);
      refreshToken = this.authService.decrypt(participant.refreshToken);
    } catch {
      return { participantId: participant.id, displayName: participant.displayName, workout: null, hrZones: null, recovery: null };
    }
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
