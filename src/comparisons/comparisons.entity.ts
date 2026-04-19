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
